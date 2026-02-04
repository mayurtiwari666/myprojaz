import boto3
import os
from dotenv import load_dotenv

# Load env vars
load_dotenv()

# Config
REGION = 'us-east-1'
BUCKET_NAME = "rnd-hub-files-0202"
TABLE_NAME = 'rnd-hub-metadata'

# Clients
s3 = boto3.client('s3', region_name=REGION)
dynamodb = boto3.resource('dynamodb', region_name=REGION)
table = dynamodb.Table(TABLE_NAME)

def sync_s3_to_db():
    print("🔄 Syncing S3 Bucket to DynamoDB...")
    
    try:
        # 1. Get all files from S3
        response = s3.list_objects_v2(Bucket=BUCKET_NAME)
        if 'Contents' not in response:
            print("❌ No files found in S3 bucket.")
            return

        s3_files = response['Contents']
        print(f"Found {len(s3_files)} files in S3.")

        # 2. Check and Add to DynamoDB
        for obj in s3_files:
            key = obj['Key']
            size = obj['Size']
            
            # Simple check if item exists (could be optimized with batch_get)
            resp = table.get_item(Key={'file_id': key})
            
            if 'Item' not in resp:
                print(f"➕ Adding missing file to DB: {key}")
                table.put_item(
                    Item={
                        'file_id': key,
                        'filename': key,
                        'content_type': 'application/pdf', # Defaulting for sync
                        'size': size,
                        'status': 'indexed' # Assume indexed if it's there
                    }
                )
            else:
                print(f"✅ File already in DB: {key}")

        print("🎉 Sync Complete!")

    except Exception as e:
        print(f"❌ Error during sync: {e}")

if __name__ == "__main__":
    sync_s3_to_db()
