import boto3
from backend.config import settings
import sys

def test_admin_logic():
    print("🧪 Testing Admin Logic...")
    print(f"Indices: Region={settings.AWS_REGION}, PoolID={settings.COGNITO_USER_POOL_ID}")

    # 1. Test Cognito
    try:
        cognito = boto3.client('cognito-idp', region_name=settings.AWS_REGION)
        print("✅ Cognito Client Created")
        users = cognito.list_users(UserPoolId=settings.COGNITO_USER_POOL_ID)
        count = len(users.get('Users', []))
        print(f"✅ Found {count} Users")
        for u in users.get('Users', []):
            print(f"   - {u['Username']} ({u['UserStatus']})")
    except Exception as e:
        print(f"❌ Cognito Failed: {e}")

    # 2. Test DynamoDB (Storage)
    try:
        dynamodb = boto3.resource('dynamodb', region_name=settings.AWS_REGION)
        table = dynamodb.Table(settings.DYNAMODB_TABLE)
        print(f"✅ DynamoDB Table: {settings.DYNAMODB_TABLE}")
        
        storage_bytes = 0
        response = table.scan()
        items = response.get('Items', [])
        print(f"✅ Found {len(items)} Files")
        
        for item in items:
            size = int(item.get('size', 0))
            storage_bytes += size
            print(f"   - {item.get('filename')}: {size} bytes")
            
        mb = round(storage_bytes / (1024 * 1024), 2)
        kb = round(storage_bytes / 1024, 2)
        print(f"📊 Storage: {storage_bytes} bytes = {kb} KB = {mb} MB")
        
    except Exception as e:
        print(f"❌ DynamoDB Failed: {e}")

if __name__ == "__main__":
    # Add project root to path
    sys.path.append(".") 
    test_admin_logic()
