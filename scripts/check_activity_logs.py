
import boto3
import os
from dotenv import load_dotenv

load_dotenv()

# AWS Config
AWS_REGION = os.getenv("AWS_REGION", "us-east-1")

dynamodb = boto3.resource('dynamodb', region_name=AWS_REGION)
table = dynamodb.Table('rnd-hub-activity')

print(f"Scanning 'rnd-hub-activity'...")

try:
    response = table.scan()
    items = response.get('Items', [])
    print(f"Total Logs: {len(items)}")
    
    # Sort by timestamp desc
    items.sort(key=lambda x: x['timestamp'], reverse=True)
    
    # Filter
    actiondevents = ['FILE_DOWNLOAD', 'FILE_PREVIEW', 'FILE_DELETE', 'FILE_PERMANENT_DELETE', 'FILE_RESTORE', 'LOGIN']
    
    # Exclude boring GET requests
    filtered_items = [i for i in items if i.get('method') in actiondevents]
    
    print("\n--- Latest 10 Actionable Logs ---")
    for i, item in enumerate(filtered_items[:10]):
        print(f"[{i+1}] {item.get('timestamp')} | {item.get('method')} | User: {item.get('user')} | File: {item.get('path')} | Details: {item.get('details')}")

except Exception as e:
    print(f"Error scanning table: {e}")
