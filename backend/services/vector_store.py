import faiss
import pickle
import os
import json
import numpy as np
import boto3
from typing import List, Dict
from backend.config import settings

# Paths
INDEX_FILE = "faiss_index.bin"
METADATA_FILE = "metadata.pkl"
S3_PREFIX = "vector_store"  # s3://bucket/vector_store/faiss_index.bin

class VectorStore:
    def __init__(self):
        # AWS Clients
        self.bedrock = boto3.client('bedrock-runtime', region_name=settings.AWS_REGION)
        self.s3 = boto3.client('s3', region_name=settings.AWS_REGION)
        
        # Titian Embeddings v1 = 1536 dimensions
        self.dimension = 1536
        self.index = None
        self.metadata = {}
        
        # Load from S3 on startup (Persistence Layer)
        self.load_from_s3()

    def load_from_s3(self):
        """Downloads the managed index from S3 on startup."""
        try:
            print("Downloading Vector Index from S3...")
            self.s3.download_file(settings.S3_BUCKET_NAME, f"{S3_PREFIX}/{INDEX_FILE}", INDEX_FILE)
            self.s3.download_file(settings.S3_BUCKET_NAME, f"{S3_PREFIX}/{METADATA_FILE}", METADATA_FILE)
            print("Download Complete.")
        except Exception as e:
            print(f"No existing index found in S3 (New Deployment?): {e}")

        # Load into memory
        if os.path.exists(INDEX_FILE):
             self.index = faiss.read_index(INDEX_FILE)
        else:
             self.index = faiss.IndexFlatL2(self.dimension)
        
        if os.path.exists(METADATA_FILE):
            with open(METADATA_FILE, "rb") as f:
                self.metadata = pickle.load(f)

    def sync_to_s3(self):
        """Uploads the current index to S3 for durability."""
        try:
            # Save locally first
            faiss.write_index(self.index, INDEX_FILE)
            with open(METADATA_FILE, "wb") as f:
                pickle.dump(self.metadata, f)
            
            # Upload
            print("Syncing Vector Index to S3...")
            self.s3.upload_file(INDEX_FILE, settings.S3_BUCKET_NAME, f"{S3_PREFIX}/{INDEX_FILE}")
            self.s3.upload_file(METADATA_FILE, settings.S3_BUCKET_NAME, f"{S3_PREFIX}/{METADATA_FILE}")
            print("Sync Complete.")
        except Exception as e:
            print(f"Failed to sync to S3: {e}")

    def embed_text(self, text: str) -> List[float]:
        """Generates embeddings using AWS Bedrock (Titan) with retry logic."""
        import time
        retries = 0
        max_retries = 5
        
        while retries < max_retries:
            try:
                body = json.dumps({"inputText": text})
                response = self.bedrock.invoke_model(
                    body=body,
                    modelId="amazon.titan-embed-text-v1",
                    accept="application/json",
                    contentType="application/json"
                )
                response_body = json.loads(response.get("body").read())
                embedding = np.array(response_body.get("embedding"))
                
                # Normalize vector to L2 unit length
                # This ensures L2 Distance correlates to Cosine Similarity
                norm = np.linalg.norm(embedding)
                if norm > 0:
                     embedding = embedding / norm
                     
                return embedding.tolist()

            except Exception as e:
                # Handle Throttling specifically
                if "ThrottlingException" in str(e):
                    wait_time = (2 ** retries) # Exponential Backoff: 1, 2, 4, 8, 16 sec
                    print(f"Bedrock Throttled. Retrying in {wait_time}s...")
                    time.sleep(wait_time)
                    retries += 1
                else:
                    # Other errors (e.g. Validation) -> Fail immediately
                    print(f"Embedding Error: {e}")
                    raise e
        
        raise Exception("Max Retries Exceeded for Bedrock Embedding")

    def _smart_chunk(self, text: str, chunk_size: int = 1000, overlap: int = 200) -> List[str]:
        """
        Splits text into chunks respecting word boundaries and adding overlap.
        """
        words = text.split()
        chunks = []
        current_chunk = []
        current_length = 0
        
        for word in words:
            word_len = len(word) + 1 # +1 for space
            
            if current_length + word_len > chunk_size:
                # Chunk is full
                chunks.append(" ".join(current_chunk))
                
                # Create overlap for next chunk
                # Keep last N words that fit within overlap limit
                overlap_chunk = []
                overlap_len = 0
                for w in reversed(current_chunk):
                    if overlap_len + len(w) + 1 <= overlap:
                         overlap_chunk.insert(0, w)
                         overlap_len += len(w) + 1
                    else:
                        break
                
                current_chunk = overlap_chunk
                current_length = overlap_len
            
            current_chunk.append(word)
            current_length += word_len
            
        if current_chunk:
            chunks.append(" ".join(current_chunk))
            
        return chunks

    def add_document(self, text: str, file_key: str):
        # Clean text
        text = " ".join(text.split()) # Remove excessive whitespace
        
        # Smart Chunking
        # Use larger overlap to prevent splitting phrases like "cremation grounds"
        chunks = self._smart_chunk(text, chunk_size=400, overlap=200) 
        
        if not chunks:
            return

        # Generate Embeddings via Bedrock
        embeddings = []
        valid_chunks = []
        
        for chunk in chunks:
            try:
                emb = self.embed_text(chunk)
                embeddings.append(emb)
                valid_chunks.append(chunk)
            except Exception as e:
                print(f"Error embedding chunk: {e}")
                continue

        if not embeddings:
            return

        # Add to FAISS
        start_id = self.index.ntotal
        self.index.add(np.array(embeddings).astype('float32'))
        
        # Update metadata
        for i, chunk in enumerate(valid_chunks):
            self.metadata[start_id + i] = {"text": chunk, "source": file_key}
            
        # Trigger S3 Sync
        self.sync_to_s3()

    def search(self, query: str, k: int = 5) -> List[Dict]:
        try:
            # 1. Vector Search
            query_vector = self.embed_text(query)
            # Fetch more candidates
            distances, indices = self.index.search(np.array([query_vector]).astype('float32'), k * 3) 
            
            results = []
            seen_texts = set()

            # 2. Collect Vector Results
            if indices.size > 0:
                for i, idx in enumerate(indices[0]):
                    if idx != -1 and idx in self.metadata:
                        meta = self.metadata[idx]
                        # Score conversion: L2 Dist -> Similarity
                        # L2 can be large. We use 1/(1+dist) for simple ranking.
                        dist = float(distances[0][i])
                        score = 1 / (1 + dist)
                        
                        res = {
                            "score": score,
                            "source": meta.get('source'),
                            "content": meta.get('text'),
                            "metadata": meta,
                            "tags": ["Semantic"]
                        }
                        results.append(res)
                        seen_texts.add(meta.get('text'))

            # 3. Smart Keyword Fallback (Match ALL terms)
            # This catches cases where "cremation" and "grounds" are in the chunk,
            # but the vector model missed the semantic connection.
            q_lower = query.lower()
            terms = q_lower.split()
            
            # Only run if we have meaningful terms (avoid matching "the")
            meaningful_terms = [t for t in terms if len(t) > 2]
            
            if meaningful_terms:
                for idx, meta in self.metadata.items():
                    text = meta.get('text', '').lower()
                    # Check if ALL terms are present in this chunk
                    if all(term in text for term in meaningful_terms):
                        original_text = meta.get('text', '')
                        if original_text not in seen_texts:
                            res = {
                                "score": 1.5, # Boost (High Priority)
                                "source": meta.get('source'),
                                "content": original_text,
                                "metadata": meta,
                                "tags": ["Keyword Match"]
                            }
                            results.append(res)
                            seen_texts.add(original_text)

            # 4. Sort & Limit
            results.sort(key=lambda x: x['score'], reverse=True)
            return results[:k]

        except Exception as e:
            print(f"Search error: {e}")
            return []

# Global Interaction
vector_store = VectorStore()
