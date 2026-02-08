
import boto3
import argparse
from datetime import datetime, timedelta, timezone
from dotenv import load_dotenv

# Add backend to path if needed (for config)
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from backend.config import settings

load_dotenv()

# Setup AWS Clients
dynamodb = boto3.resource('dynamodb', region_name=settings.AWS_REGION)
table = dynamodb.Table(settings.DYNAMODB_TABLE)
s3 = boto3.client('s3', region_name=settings.AWS_REGION)

RETENTION_DAYS = 30

def cleanup_trash(dry_run=True):
    print(f"--- Trash Cleanup Script (Dry Run: {dry_run}) ---")
    print(f"Policy: Delete contents in Trash older than {RETENTION_DAYS} days.\n")

    cutoff_date = datetime.now(timezone.utc) - timedelta(days=RETENTION_DAYS)
    
    # 1. Scan for deleted items (Filter: is_deleted = true)
    # Note: Scanning is okay for a maintenance script.
    try:
        response = table.scan(
            FilterExpression=boto3.dynamodb.conditions.Attr('is_deleted').eq(True)
        )
        items = response.get('Items', [])
        
        print(f"Found {len(items)} items in Trash.")
        
        deleted_count = 0
        
        for item in items:
            deleted_at_str = item.get('deleted_at')
            if not deleted_at_str:
                # Fallback: ignore or use updated_at? Let's skip safely.
                # print(f"⚠️  Skipping {item['filename']} (No deleted_at timestamp)")
                continue

            try:
                # ISO format: 2024-02-02T10:00:00+00:00
                deleted_at = datetime.fromisoformat(deleted_at_str)
                
                if deleted_at < cutoff_date:
                    days_ago = (datetime.now(timezone.utc) - deleted_at).days
                    print(f"🗑️  To Delete: {item['filename']} (Deleted {days_ago} days ago)")
                    
                    if not dry_run:
                        # 2. Delete S3 Object
                        print(f"   Deleting S3 Object: {item['file_id']}...")
                        s3.delete_object(Bucket=settings.S3_BUCKET_NAME, Key=item['file_id'])
                        
                        # 3. Delete DynamoDB Record
                        print(f"   Deleting DB Record...")
                        table.delete_item(Key={'file_id': item['file_id']})
                        deleted_count += 1
                else:
                    # print(f"✅ Keeping {item['filename']} (Only deleted recently)")
                    pass
                    
            except ValueError:
                print(f"⚠️  Skipping {item['filename']} (Invalid Date: {deleted_at_str})")
        
        if dry_run:
            print("\n[DRY RUN] No files were actually deleted.")
            print(f"Would have deleted {deleted_count} files.")
            print("Run with --force to execute.")
        else:
            print(f"\n✅ Cleanup Complete. Permanently deleted {deleted_count} files.")

    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Clean up old files from Trash.")
    parser.add_argument("--force", action="store_true", help="Execute deletion (default is Dry Run)")
    parser.add_argument("--days", type=int, default=30, help="Retention days (default: 30)")
    
    args = parser.parse_args()
    
    if args.days:
        RETENTION_DAYS = args.days
        
    cleanup_trash(dry_run=not args.force)
