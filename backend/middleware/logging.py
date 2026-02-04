from starlette.middleware.base import BaseHTTPMiddleware
from fastapi import Request
import time
import uuid
import boto3
from datetime import datetime
from backend.config import settings

from jose import jwt

class ActivityLoggingMiddleware(BaseHTTPMiddleware):
    def __init__(self, app):
        super().__init__(app)
        self.dynamodb = boto3.resource('dynamodb', region_name=settings.AWS_REGION)
        self.table = self.dynamodb.Table('rnd-hub-activity')

    async def dispatch(self, request: Request, call_next):
        start_time = time.time()
        
        # Process request
        response = await call_next(request)
        
        # Calculate duration
        process_time = time.time() - start_time
        
        # Log interesting events (skip health checks / options)
        if request.method != "OPTIONS" and request.url.path != "/":
            try:
                # Basic info
                event_id = str(uuid.uuid4())
                # Explicit UTC with Z suffix
                timestamp = datetime.utcnow().isoformat() + 'Z'
                
                # Extract User from Token
                user = "anonymous"
                auth_header = request.headers.get("Authorization")
                if auth_header and auth_header.startswith("Bearer "):
                    try:
                        token = auth_header.split(" ")[1]
                        # Debug Print
                        # print(f"DEBUG: Processing token {token[:10]}...")
                        
                        claims = jwt.get_unverified_claims(token)
                        # print(f"DEBUG: Claims keys: {claims.keys()}")
                        
                        user = claims.get("username") or claims.get("cognito:username") or claims.get("sub")
                        
                        if not user:
                             print(f"DEBUG: User not found in claims. Claims: {claims}")
                             user = "unknown_user"
                             
                    except Exception as e:
                        print(f"DEBUG: Token parsing failed: {e}")
                        pass # Keep anonymous if token is bad
                
                item = {
                    'event_id': event_id,
                    'timestamp': timestamp,
                    'method': request.method,
                    'path': request.url.path,
                    'status_code': response.status_code,
                    'duration_ms': int(process_time * 1000),
                    'user': user,
                    'ip': request.client.host if request.client else "unknown"
                }

                # Save to DynamoDB (Async ideally, but sync for now is fine for MVP)
                self.table.put_item(Item=item)
            except Exception as e:
                print(f"Failed to log activity: {e}")

        return response
