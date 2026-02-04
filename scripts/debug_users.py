import boto3
from backend.config import settings

def list_users_and_groups():
    client = boto3.client('cognito-idp', region_name=settings.AWS_REGION)
    user_pool_id = settings.COGNITO_USER_POOL_ID
    
    try:
        response = client.list_users(UserPoolId=user_pool_id)
        users = response.get('Users', [])
        
        print(f"Found {len(users)} users:")
        for u in users:
            username = u['Username']
            # Fetch groups
            groups_resp = client.admin_list_groups_for_user(
                UserPoolId=user_pool_id,
                Username=username
            )
            groups = [g['GroupName'] for g in groups_resp.get('Groups', [])]
            print(f"- {username}: {groups}")

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    list_users_and_groups()
