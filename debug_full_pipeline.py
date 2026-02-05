
import sys
import boto3
import json
import numpy as np
import os
from dotenv import load_dotenv

# Setup paths
sys.path.append(os.getcwd())
load_dotenv()

from backend.services.file_processor import extract_text_from_s3
from backend.services.vector_store import vector_store

FILE_KEY = "Varanasi_City_Detailed_Guide.pdf"
QUERY = "cremation grounds"

print(f"--- Debugging Pipeline for {FILE_KEY} ---")

# 1. Extraction
print("1. Extracting Text...")
try:
    text = extract_text_from_s3(FILE_KEY)
    print(f"   Extracted {len(text)} chars.")
    if "cremation" in text.lower():
        print("   ✅ Text contains 'cremation'.")
    else:
        print("   ❌ Text DOES NOT contain 'cremation'. STOPPING.")
        exit()
except Exception as e:
    print(f"   ❌ Extraction Failed: {e}")
    exit()

# 2. Chunking
print("\n2. Chunking Text (size=400)...")
chunks = vector_store._smart_chunk(text, chunk_size=400, overlap=100)
print(f"   Generated {len(chunks)} chunks.")

target_chunk = None
target_idx = -1

for i, chunk in enumerate(chunks):
    if "cremation" in chunk.lower():
        print(f"   ✅ Found 'cremation' in Chunk {i}")
        print(f"      Preview: '{chunk[:50]}...'")
        target_chunk = chunk
        target_idx = i
        break

if not target_chunk:
    print("   ❌ 'cremation' lost during chunking! STOPPING.")
    exit()

# 3. Embedding
print(f"\n3. Embedding Chunk {target_idx} & Query...")
try:
    chunk_vec = np.array(vector_store.embed_text(target_chunk))
    query_vec = np.array(vector_store.embed_text(QUERY))
    
    # Verify Normalization
    print(f"   Chunk Norm: {np.linalg.norm(chunk_vec):.4f}")
    print(f"   Query Norm: {np.linalg.norm(query_vec):.4f}")
    
    # Calculate Similarity
    dist = np.linalg.norm(chunk_vec - query_vec)
    dot = np.dot(chunk_vec, query_vec)
    
    print(f"\n4. Comparison Results:")
    print(f"   L2 Distance: {dist:.4f}")
    print(f"   Dot Product: {dot:.4f}")
    
    if dist < 1.0: # ~0.5 similarity
        print("   ✅ MATCH! (Distance < 1.0)")
    elif dist < 1.2:
        print("   ⚠️ WEAK MATCH (Distance 1.0 - 1.2)")
    else:
        print("   ❌ NO MATCH (Distance > 1.2)")
        
except Exception as e:
    print(f"   ❌ Embedding Failed: {e}")
