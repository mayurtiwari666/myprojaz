import pickle
import faiss
import os

INDEX_FILE = "backend/faiss_index.bin"
METADATA_FILE = "backend/metadata.pkl"

def analyze_index():
    print("🔍 Analyzing Vector Index...")
    
    if not os.path.exists(INDEX_FILE) or not os.path.exists(METADATA_FILE):
        print("❌ Index or Metadata file not found.")
        return

    index = faiss.read_index(INDEX_FILE)
    with open(METADATA_FILE, "rb") as f:
        metadata = pickle.load(f)

    print(f"📊 Total Vectors in Index: {index.ntotal}")
    print(f"📚 Total Metadata Entries: {len(metadata)}")

    # Count vectors per file
    files = {}
    for key, data in metadata.items():
        source = data.get('source', 'unknown')
        if source not in files:
            files[source] = 0
        files[source] += 1

    print("\n📂 Files in Index:")
    for filename, count in files.items():
        print(f"  - {filename}: {count} chunks")

if __name__ == "__main__":
    analyze_index()
