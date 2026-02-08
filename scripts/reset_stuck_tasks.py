import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import boto3
from backend.config import settings

dynamodb = boto3.resource('dynamodb', region_name='us-east-1')
table = dynamodb.Table('rnd-hub-metadata')

print("--- Resetting Stuck Tasks ---")
scan = table.scan()
items = scan.get('Items', [])

for item in items:
    fname = item.get('filename')
    status = item.get('status')
    
    if status == 'processing':
        print(f" [RESET] Marking {fname} as 'failed' (Stuck due to restart)")
        table.update_item(
            Key={'file_id': fname},
            UpdateExpression="set #s = :s, #err = :err",
            ExpressionAttributeNames={'#s': 'status', '#err': 'error_message'},
            ExpressionAttributeValues={':s': 'failed', ':err': 'Processing interrupted by server restart'}
        )

print("--- Done ---")
