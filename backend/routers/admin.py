from fastapi import APIRouter, HTTPException, Depends, Body
from fastapi.responses import StreamingResponse
import boto3
from backend.config import settings
from boto3.dynamodb.conditions import Key
import datetime
from backend.auth import require_admin
import uuid
import csv
import io

router = APIRouter(
    prefix="/admin",
    tags=["admin"],
    dependencies=[Depends(require_admin)]
)

dynamodb = boto3.resource('dynamodb', region_name=settings.AWS_REGION)
activity_table = dynamodb.Table('rnd-hub-activity')
files_table = dynamodb.Table('rnd-hub-metadata')
s3 = boto3.client('s3', region_name=settings.AWS_REGION)
cognito = boto3.client('cognito-idp', region_name=settings.AWS_REGION)

@router.get("/stats")
def get_dashboard_stats():
    try:
        # File Counts
        files_response = files_table.scan(Select='COUNT')
        total_files = files_response['Count']
        
        # Storage Calculation
        storage_bytes = 0
        scan_kwargs = {'ProjectionExpression': 'file_size'} # Note: attribute is 'size' in our DB
        done = False
        start_key = None
        
        # Scan for full storage sum (optimized scan)
        # Note: If 'size' attribute exists. Let's check our schema. 
        # Previous Upload saves 'size'.
        files = files_table.scan()
        for item in files.get('Items', []):
            storage_bytes += int(item.get('size', 0))
            
        storage_display = "0 MB"
        if storage_bytes < 1024 * 1024:
             storage_display = f"{round(storage_bytes / 1024, 2)} KB"
        else:
             storage_display = f"{round(storage_bytes / (1024 * 1024), 2)} MB"
        
        # User Count (Cognito - Total Registered)
        users = cognito.list_users(UserPoolId=settings.COGNITO_USER_POOL_ID)
        total_registered = len(users.get('Users', []))

        # Online Users (Activity in last 15 mins)
        now = datetime.datetime.utcnow()
        threshold = (now - datetime.timedelta(minutes=15)).isoformat() + 'Z'
        
        # Scan Activity Table for recent logs
        # Note: In prod, use a GSI on timestamp. For MVP, Scan is fine.
        activity_response = activity_table.scan(
            FilterExpression=Key('timestamp').gt(threshold),
            ProjectionExpression='#u',
            ExpressionAttributeNames={'#u': 'user'}
        )
        
        recent_users = set()
        for item in activity_response.get('Items', []):
            u = item.get('user')
            if u and u not in ['unknown', 'anonymous', 'unknown_user']:
                recent_users.add(u)
                
        online_count = len(recent_users)

        return {
            "total_files": total_files,
            "active_users": total_registered, # Kept for backward compat if needed, or use online_count
            "online_users_count": online_count,
            "online_users_list": list(recent_users),
            "storage_used": storage_display,
            "system_health": "Healthy"
        }
    except Exception as e:
        print(f"Stats error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/users")
def get_users():
    try:
        # Fetch Users
        response = cognito.list_users(UserPoolId=settings.COGNITO_USER_POOL_ID)
        users = []
        for u in response.get('Users', []):
            # Extract attributes
            attrs = {a['Name']: a['Value'] for a in u['Attributes']}
            
            # Fetch Groups for user
            groups_resp = cognito.admin_list_groups_for_user(
                UserPoolId=settings.COGNITO_USER_POOL_ID,
                Username=u['Username']
            )
            model = {
                "username": u['Username'],
                "email": attrs.get('email', ''),
                "status": u['UserStatus'],
                "created_at": u['UserCreateDate'],
                "last_modified": u['UserLastModifiedDate'],
                "enabled": u['Enabled'],
                "groups": [g['GroupName'] for g in groups_resp.get('Groups', [])]
            }
            users.append(model)
        return users
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/log-login")
def log_login(user_details: dict = Body(...)):
    try:
        item = {
            'event_id': str(uuid.uuid4()),
            'timestamp': datetime.datetime.utcnow().isoformat(),
            'method': 'LOGIN', # Special method for login events
            'path': '/auth/login',
            'status_code': 200,
            'duration_ms': 0,
            'user': user_details.get('username', 'unknown'),
            'details': f"Login from {user_details.get('source', 'web')}"
        }
        activity_table.put_item(Item=item)
        return {"status": "logged"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/audit-logs")
def get_audit_logs():
    try:
        # Scan logs
        response = activity_table.scan(Limit=100) # Cap at 100 for now
        items = response.get('Items', [])
        # Sort by timestamp desc
        items.sort(key=lambda x: x['timestamp'], reverse=True)
        return items
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/export-audit")
def export_audit_logs():
    try:
        response = activity_table.scan()
        items = response.get('Items', [])
        
        # Define CSV Columns
        fieldnames = ['timestamp', 'user', 'method', 'path', 'status_code', 'details', 'ip']
        
        output = io.StringIO()
        writer = csv.DictWriter(output, fieldnames=fieldnames, extrasaction='ignore')
        writer.writeheader()
        
        for row in items:
            writer.writerow(row)
            
        output.seek(0)
        
        return StreamingResponse(
            io.BytesIO(output.getvalue().encode()),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=audit_logs_{datetime.datetime.now().strftime('%Y%m%d')}.csv"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
