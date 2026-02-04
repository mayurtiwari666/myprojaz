import time
import requests
from jose import jwk, jwt
from jose.utils import base64url_decode
from fastapi import Request, HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from functools import lru_cache

# Configuration
from backend.config import settings

import boto3

# Configuration
REGION = settings.AWS_REGION
USER_POOL_ID = settings.COGNITO_USER_POOL_ID
APP_CLIENT_ID = settings.COGNITO_CLIENT_ID
KEYS_URL = f'https://cognito-idp.{REGION}.amazonaws.com/{USER_POOL_ID}/.well-known/jwks.json'

security = HTTPBearer()

@lru_cache()
def get_cognito_client():
    return boto3.client('cognito-idp', region_name=REGION)

@lru_cache()
def get_jwks():
    return requests.get(KEYS_URL).json()

def get_current_user(credentials: HTTPAuthorizationCredentials = Security(security)):
    token = credentials.credentials
    keys = get_jwks()['keys']
    
    # Get the kid from the headers
    headers = jwt.get_unverified_headers(token)
    kid = headers['kid']
    
    # Find the public key
    key_index = -1
    for i in range(len(keys)):
        if kid == keys[i]['kid']:
            key_index = i
            break
            
    if key_index == -1:
        raise HTTPException(status_code=401, detail='Public key not found in JWK set')
        
    public_key = keys[key_index]
    
    # Construct the public key object
    hmac_key = jwk.construct(public_key)
    
    try:
        # Verify signature and expiration
        claims = jwt.decode(
            token,
            hmac_key,
            algorithms=['RS256'],
            options={"verify_aud": False} 
        )
        
        # Additional checks
        expected_iss = f'https://cognito-idp.{REGION}.amazonaws.com/{USER_POOL_ID}'
        if claims['iss'] != expected_iss:
             raise HTTPException(status_code=401, detail='Token issuer mismatch')

        if claims['token_use'] != 'access':
             raise HTTPException(status_code=401, detail='Invalid token use')

        # --- REAL TIME GROUP CHECK ---
        # Don't trust the token groups (stale). Check Cognito directly.
        raw_username = claims.get('cognito:username') or claims.get('username')
        real_groups = []
        
        try:
            # 1. Try direct lookup
            try:
                g_resp = get_cognito_client().admin_list_groups_for_user(
                    UserPoolId=USER_POOL_ID,
                    Username=raw_username
                )
            except get_cognito_client().exceptions.UserNotFoundException:
                # 2. UUID Fallback
                print(f"AuthMiddleware: UserNotFound for {raw_username}, trying UUID resolution...")
                u_resp = get_cognito_client().list_users(
                    UserPoolId=USER_POOL_ID,
                    Filter=f'sub = "{raw_username}"'
                )
                if u_resp['Users']:
                    resolved_username = u_resp['Users'][0]['Username']
                    print(f"AuthMiddleware: Resolved {raw_username} -> {resolved_username}")
                    g_resp = get_cognito_client().admin_list_groups_for_user(
                        UserPoolId=USER_POOL_ID,
                        Username=resolved_username
                    )
                    raw_username = resolved_username # Update for return
                else:
                    raise Exception("User not found by UUID")
            
            real_groups = [g['GroupName'] for g in g_resp.get('Groups', [])]
            
        except Exception as aws_err:
             print(f"AuthMiddleware: Failed to fetch real-time groups. Using token backup. Error: {aws_err}")
             # Fallback to token
             real_groups = claims.get('cognito:groups', [])

        return {
            "username": raw_username,
            "groups": real_groups
        }
        
    except Exception as e:
        print(f"Token validation failed: {e}")
        raise HTTPException(status_code=401, detail=f'Invalid token: {str(e)}')

def require_admin(user = Security(get_current_user)):
    if 'Admins' not in user['groups']:
        raise HTTPException(status_code=403, detail="Admins only")
    return user

def require_contributor(user = Security(get_current_user)):
    # Admins also have contributor access
    if 'Contributors' not in user['groups'] and 'Admins' not in user['groups']:
        raise HTTPException(status_code=403, detail="Contributors or Admins only")
    return user
