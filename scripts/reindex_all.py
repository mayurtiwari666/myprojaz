import boto3
import os
from dotenv import load_dotenv
from backend.services.vector_store import vector_store
from backend.services.pdf_processor import extract_text_from_s3

# Load env vars
load_dotenv()

# Config
REGION = 'us-east-1'
BUCKET_NAME = "rnd-hub-files-0202"

# Clients
s3 = boto3.client('s3', region_name=REGION)

def reindex_all():
    print("🔄 Re-indexing ALL files from S3...")
    
    try:
        # 1. Get all files from S3
        response = s3.list_objects_v2(Bucket=BUCKET_NAME)
        if 'Contents' not in response:
            print("❌ No files found in S3 bucket.")
            return

        s3_files = response['Contents']
        print(f"Found {len(s3_files)} files in S3.")

        # 2. Process each file
        for obj in s3_files:
            key = obj['Key']
            print(f"📄 Processing {key}...")
            
            try:
                # Extract Text
                text = extract_text_from_s3(key)
                
                if not text.strip():
                     print(f"⚠️ Warning: No text extracted from {key}")
                     continue

                # Add to Vector Store
                vector_store.add_document(text, key)
                print(f"✅ Indexed {key}")
                
            except Exception as e:
                print(f"❌ Failed to process {key}: {e}")

        print("🎉 Re-indexing Complete!")

    except Exception as e:
        print(f"❌ Error during re-indexing: {e}")

if __name__ == "__main__":
    reindex_all()
