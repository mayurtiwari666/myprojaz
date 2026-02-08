import boto3
import uuid
import datetime
from backend.config import settings

# Initialize Resource Once
dynamodb = boto3.resource('dynamodb', region_name=settings.AWS_REGION)
table = dynamodb.Table('rnd-hub-activity')

def log_audit_event(user: str, action: str, details: str, related_file: str = None):
    """
    Logs a high-level audit event to DynamoDB.
    actions: FILE_DOWNLOAD, FILE_PREVIEW, LOGIN, DELETE, RESTORE
    """
    try:
        item = {
            'event_id': str(uuid.uuid4()),
            'timestamp': datetime.datetime.utcnow().isoformat() + 'Z',
            'method': action, # Re-using 'method' field for audit action type
            'user': user,
            'details': details,
            'path': related_file or 'unknown' # Storing filename in path for easy searching
        }
        table.put_item(Item=item)
    except Exception as e:
        print(f"Audit Log Failed: {e}")
