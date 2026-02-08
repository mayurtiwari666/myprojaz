
import boto3
import json
import os
from dotenv import load_dotenv

load_dotenv()

SECRET_NAME = "rnd-hub-secrets"
REGION = "us-east-1"

def create_secret():
    client = boto3.client('secretsmanager', region_name=REGION)
    
    # Secrets to store
    secrets = {
        "COGNITO_USER_POOL_ID": os.getenv("COGNITO_USER_POOL_ID"),
        "COGNITO_CLIENT_ID": os.getenv("COGNITO_CLIENT_ID"),
        "S3_BUCKET_NAME": os.getenv("S3_BUCKET_NAME"),
        "DYNAMODB_TABLE": os.getenv("DYNAMODB_TABLE"),
    }
    
    # Filter out None values
    secrets = {k: v for k, v in secrets.items() if v}
    
    if not secrets:
        print("❌ No secrets found in .env to upload.")
        return

    try:
        print(f"Creating/Updating secret '{SECRET_NAME}'...")
        
        # Check if exists
        try:
            client.describe_secret(SecretId=SECRET_NAME)
            # Update
            client.put_secret_value(SecretId=SECRET_NAME, SecretString=json.dumps(secrets))
            print("✅ Secret updated successfully.")
        except client.exceptions.ResourceNotFoundException:
            # Create
            client.create_secret(
                Name=SECRET_NAME,
                Description="Secrets for Rnd Hub (Backend)",
                SecretString=json.dumps(secrets)
            )
            print("✅ Secret created successfully.")
            
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    create_secret()
