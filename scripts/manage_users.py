import boto3
import sys

# Constants
USER_POOL_ID = 'us-east-1_VT82bTVEX'
REGION = 'us-east-1'

client = boto3.client('cognito-idp', region_name=REGION)

def create_user(username, email, group):
    try:
        # 1. Create User
        print(f"Creating user {username} ({email})...")
        client.admin_create_user(
            UserPoolId=USER_POOL_ID,
            Username=username,
            UserAttributes=[
                {'Name': 'email', 'Value': email},
                {'Name': 'email_verified', 'Value': 'true'}
            ],
            TemporaryPassword='TempPassword123!',
            MessageAction='SUPPRESS' # Don't send email
        )
        
        # 2. Set Password (to skip change requirement)
        client.admin_set_user_password(
            UserPoolId=USER_POOL_ID,
            Username=username,
            Password='PermanentPassword123!',
            Permanent=True
        )
        
        # 3. Add to Group
        print(f"Adding user to group {group}...")
        client.admin_add_user_to_group(
            UserPoolId=USER_POOL_ID,
            Username=username,
            GroupName=group
        )
        
        print(f"✅ User {username} created successfully with role {group}.")
        print(f"👉 Login with: {username} / PermanentPassword123!")
        
    except client.exceptions.UsernameExistsException:
        print(f"❌ User {username} already exists.")
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    print("AWS Cognito User Manager")
    print("------------------------")
    print("Roles: Admins, Contributors, Readers")
    
    username = input("Enter Username: ")
    email = input("Enter Email: ")
    group = input("Enter Role (Admins/Contributors/Readers): ")
    
    if group not in ['Admins', 'Contributors', 'Readers']:
        print("Invalid role. Must be Admins, Contributors, or Readers.")
    else:
        create_user(username, email, group)
