import json
import boto3
import os
import subprocess
import urllib.parse
from botocore.exceptions import ClientError

s3 = boto3.client('s3')
dynamodb = boto3.resource('dynamodb')

# Env vars
TABLE_NAME = os.environ.get('DYNAMODB_TABLE', 'rnd-hub-metadata')
table = dynamodb.Table(TABLE_NAME)

def lambda_handler(event, context):
    print("Received event: " + json.dumps(event, indent=2))

    # Get the object from the event
    for record in event['Records']:
        bucket = record['s3']['bucket']['name']
        key = urllib.parse.unquote_plus(record['s3']['object']['key'], encoding='utf-8')
        
        # Skip if key is in 'quarantine/' to avoid loops
        if key.startswith('quarantine/'):
            print(f"Skipping quarantine file: {key}")
            continue

        try:
            print(f"Scanning file: s3://{bucket}/{key}")
            
            # Download to /tmp
            local_path = f"/tmp/{os.path.basename(key)}"
            s3.download_file(bucket, key, local_path)
            
            # Scan
            # clamscan -d /var/lib/clamav/ -r /tmp/file
            # Note: freshclam runs in build, so DB is at /var/lib/clamav
            scan_result = subprocess.run(
                ['clamscan', '--database=/var/lib/clamav', local_path],
                capture_output=True,
                text=True
            )
            
            print("Scan Output:", scan_result.stdout)
            print("Scan Error:", scan_result.stderr)
            print("Return Code:", scan_result.returncode)
            
            # Return Code 0: Clean
            # Return Code 1: Infected
            is_infected = scan_result.returncode == 1
            
            if is_infected:
                print(f"🚨 INFECTED: {key}")
                # Action: Tag as infected, Update DB, Delete (or Move)
                
                # 1. Update S3 Tag
                s3.put_object_tagging(
                    Bucket=bucket,
                    Key=key,
                    Tagging={'TagSet': [{'Key': 'virus_status', 'Value': 'infected'}]}
                )
                
                # 2. Update DynamoDB
                # We need file_id (which is the key for us usually)
                try:
                    table.update_item(
                        Key={'file_id': key},
                        UpdateExpression="set virus_status = :v",
                        ExpressionAttributeValues={':v': 'infected'}
                    )
                except Exception as e:
                    print(f"Failed to update DB: {e}")

                # 3. Quarantine (Move and Delete)
                quarantine_key = f"quarantine/{os.path.basename(key)}"
                print(f"Moving to {quarantine_key}...")
                
                s3.copy_object(
                    CopySource={'Bucket': bucket, 'Key': key},
                    Bucket=bucket,
                    Key=quarantine_key
                )
                s3.delete_object(Bucket=bucket, Key=key)
                print("File quarantined and deleted from source.")
                
            else:
                print(f"✅ CLEAN: {key}")
                # Tag as clean
                s3.put_object_tagging(
                    Bucket=bucket,
                    Key=key,
                    Tagging={'TagSet': [{'Key': 'virus_status', 'Value': 'clean'}]}
                )
                
                # Update DB
                try:
                    table.update_item(
                        Key={'file_id': key},
                        UpdateExpression="set virus_status = :v",
                        ExpressionAttributeValues={':v': 'clean'}
                    )
                except Exception as e:
                    print(f"Failed to update DB: {e}")

            # Cleanup
            if os.path.exists(local_path):
                os.remove(local_path)

        except Exception as e:
            print(e)
            print(f"Error processing object {key} from bucket {bucket}.")
            raise e

    return "Scan Complete"
