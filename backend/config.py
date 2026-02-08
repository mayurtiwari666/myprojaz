import os
import boto3
import json
from pydantic_settings import BaseSettings

# --- AWS Secrets Manager Integration ---
def get_secret(secret_name, region_name="us-east-1"):
    """
    Fetches secrets from AWS Secrets Manager.
    Returns a dict of key-value pairs or empty dict on failure.
    """
    try:
        session = boto3.session.Session()
        client = session.client(
            service_name='secretsmanager',
            region_name=region_name
        )
        get_secret_value_response = client.get_secret_value(
            SecretId=secret_name
        )
        if 'SecretString' in get_secret_value_response:
            return json.loads(get_secret_value_response['SecretString'])
    except Exception as e:
        print(f"⚠️  Could not load AWS Secret '{secret_name}': {e}")
        print("ℹ️  Falling back to environment variables / .env file.")
        return {}

# Attempt to load secrets and inject into environment
# This allows Pydantic to pick them up as if they were env vars
# Priority: 
# 1. Existing Env Vars (e.g. from docker run) - We should respecting them? 
#    Actually, usually SECRETS > ENV. But for local dev, .env > Secrets.
#    Let's use a strategy: Load secrets into a dict, and pass as defaults.
aws_secrets = get_secret("rnd-hub-secrets")

class Settings(BaseSettings):
    AWS_REGION: str = "us-east-1"
    
    # Defaults come from AWS Secrets if available, otherwise fallback to these strings
    S3_BUCKET_NAME: str = aws_secrets.get("S3_BUCKET_NAME", "rnd-hub-files-0202")
    DYNAMODB_TABLE: str = aws_secrets.get("DYNAMODB_TABLE", "rnd-hub-metadata")
    COGNITO_USER_POOL_ID: str = aws_secrets.get("COGNITO_USER_POOL_ID", "us-east-1_VT82bTVEX")
    COGNITO_CLIENT_ID: str = aws_secrets.get("COGNITO_CLIENT_ID", "2mhovll3csgcqmg8uj6le5ffhd")

    # Main AWS Credentials (Optional, picked up by Boto3 via Env)
    AWS_ACCESS_KEY_ID: str = ""
    AWS_SECRET_ACCESS_KEY: str = ""

    class Config:
        env_file = ".env"
        # .env file values will OVERRIDE the defaults set above.
        # This achieves: Local (.env) > Production (Secrets Manager default)

settings = Settings()
