from dotenv import load_dotenv
load_dotenv() # Load Environment Variables FIRST

from fastapi import FastAPI, UploadFile, File, Form, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import boto3
import os
from backend.services.file_processor import extract_text_from_s3
from backend.services.vector_store import vector_store
from backend.middleware.logging import ActivityLoggingMiddleware
from backend.routers import admin, tags, storage_paths
from backend.auth import require_contributor, get_current_user, require_admin
from pydantic import BaseModel
from backend.config import settings

cognito = boto3.client('cognito-idp', region_name=settings.AWS_REGION)

load_dotenv()

app = FastAPI()

# Middleware
app.add_middleware(ActivityLoggingMiddleware)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(admin.router)
app.include_router(tags.router)
app.include_router(storage_paths.router)

# AWS Clients
s3 = boto3.client('s3', region_name='us-east-1')
dynamodb = boto3.resource('dynamodb', region_name='us-east-1')
table = dynamodb.Table('rnd-hub-metadata')
BUCKET_NAME = "rnd-hub-files-0202"

class FileMetadata(BaseModel):
    filename: str
    content_type: str
    size: int

ALLOWED_TYPES = {
    'application/pdf',
    'image/jpeg',
    'image/jpg',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', # docx
    'application/vnd.openxmlformats-officedocument.presentationml.presentation', # pptx
    'text/plain'
}

ALLOWED_EXTENSIONS = {'.pdf', '.jpg', '.jpeg', '.docx', '.doc', '.pptx', '.ppt', '.txt'}

@app.get("/")
def read_root():
    return {"message": "RnD Knowledge Hub API is running"}

@app.get("/auth/me")
def read_current_user(user: dict = Depends(get_current_user)):
    # The middleware (get_current_user) now does a real-time fetch from Cognito.
    # So we can just return the user object directly.
    return user

@app.get("/files")
def list_files(trash: bool = False, storage_path: str = None):
    try:
        response = table.scan()
        all_items = response.get('Items', [])
        
        # Filter Logic
        if trash:
            # Show ONLY deleted items
            return [item for item in all_items if item.get('is_deleted') is True]
        else:
            # Show ONLY active items (is_deleted is False or None)
            # AND filter out infected files
            active = [
                item for item in all_items 
                if not item.get('is_deleted') 
                and item.get('virus_status') != 'infected'
            ]
            
            # Filter by Storage Path
            if storage_path:
                return [item for item in active if item.get('storage_path') == storage_path]
                
            return active
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/files/upload-url")
def generate_upload_url(
    filename: str, 
    content_type: str,
    user: dict = Depends(require_contributor) # Protect
):
    # 1. Allowlist Validation
    ext = os.path.splitext(filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
         raise HTTPException(status_code=400, detail=f"File type {ext} not supported. Allowed: PDF, DOCX, PPTX, JPEG")
    
    # Optional: Check Content-Type header strictness
    # if content_type not in ALLOWED_TYPES:
    #     raise HTTPException(status_code=400, detail="Invalid Content-Type")

    try:
        key = filename
        presigned_url = s3.generate_presigned_url(
            'put_object',
            Params={'Bucket': BUCKET_NAME, 'Key': key, 'ContentType': content_type},
            ExpiresIn=3600
        )
        return {"upload_url": presigned_url, "filename": filename}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

from fastapi import BackgroundTasks

def process_file_background(metadata: FileMetadata):
    """Background task to extract text and update vector index."""
    try:
        print(f"Background Processing Started: {metadata.filename}")
        
        # 1. Update Status -> 'processing'
        table.update_item(
            Key={'file_id': metadata.filename},
            UpdateExpression="set #s = :s",
            ExpressionAttributeNames={'#s': 'status'},
            ExpressionAttributeValues={':s': 'processing'}
        )

        # 2. Extract Text
        text = extract_text_from_s3(metadata.filename)
        
        # 2a. PII Analysis (Safe Mode)
        from backend.services.file_processor import analyze_sensitivity
        pii_flags = analyze_sensitivity(text)
        if pii_flags:
            print(f"PII Detected for {metadata.filename}: {pii_flags}")

        # 3. Index Vector
        vector_store.add_document(text, metadata.filename)
        
        # 4. Update Status -> 'indexed' (and save PII flags)
        update_expr = "set #s = :s"
        expr_values = {':s': 'indexed'}
        expr_names = {'#s': 'status'}

        if pii_flags:
            update_expr += ", #pii = :pii"
            expr_values[':pii'] = pii_flags
            expr_names['#pii'] = 'pii_flags'

        table.update_item(
            Key={'file_id': metadata.filename},
            UpdateExpression=update_expr,
            ExpressionAttributeNames=expr_names,
            ExpressionAttributeValues=expr_values
        )
        print(f"Background Processing Complete: {metadata.filename}")

    except Exception as e:
        print(f"Background Processing Failed for {metadata.filename}: {e}")
        # Update Status -> 'failed'
        try:
             table.update_item(
                Key={'file_id': metadata.filename},
                UpdateExpression="set #s = :s, #err = :err",
                ExpressionAttributeNames={'#s': 'status', '#err': 'error_message'},
                ExpressionAttributeValues={':s': 'failed', ':err': str(e)}
            )
        except:
            pass

@app.post("/files/ingest")
def ingest_file(
    metadata: FileMetadata,
    background_tasks: BackgroundTasks,
    user: dict = Depends(require_contributor)
):
    try:
        # Initial Save (Status: uploading/queued)
        table.put_item(
            Item={
                'file_id': metadata.filename,
                'filename': metadata.filename,
                'content_type': metadata.content_type,
                'size': metadata.size,
                'status': 'queued',
                'uploaded_by': user.get('username', 'unknown'),
                'timestamp': str(os.getenv('timestamp', '')) # Optional
            }
        )
        
        # Trigger Background Task
        background_tasks.add_task(process_file_background, metadata)
        
        return {"status": "queued", "message": "File accepted for background processing", "file_id": metadata.filename}

    except Exception as e:
        print(e)
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/search")
def search_files(q: str):
    try:
        results = vector_store.search(q)
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/files/{filename}/versions")
def get_file_versions(filename: str):
    try:
        response = s3.list_object_versions(Bucket=BUCKET_NAME, Prefix=filename)
        versions = response.get('Versions', [])
        return [
            {
                "version_id": v['VersionId'],
                "last_modified": v['LastModified'],
                "size": v['Size'],
                "is_latest": v['IsLatest']
            }
            for v in versions
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
from backend.services.logging_service import log_audit_event

@app.get("/files/{filename}/view")
def view_file(filename: str, user: dict = Depends(require_contributor)):
    try:
        # Audit Log: Preview
        log_audit_event(
            user=user.get('username', 'unknown'),
            action='FILE_PREVIEW',
            details='User previewed file (inline)',
            related_file=filename
        )
        # Generate presigned URL for inline viewing
        url = s3.generate_presigned_url(
            'get_object',
            Params={
                'Bucket': BUCKET_NAME, 
                'Key': filename,
                'ResponseContentDisposition': 'inline'
            },
            ExpiresIn=300 # 5 minutes
        )
        return {"view_url": url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/files/{filename}/download")
def download_file(filename: str, user: dict = Depends(require_contributor)):
    try:
        # Audit Log: Download
        log_audit_event(
            user=user.get('username', 'unknown'),
            action='FILE_DOWNLOAD',
            details='User downloaded file (attachment)',
            related_file=filename
        )
        # Generate presigned URL for downloading (attachment)
        url = s3.generate_presigned_url(
            'get_object',
            Params={
                'Bucket': BUCKET_NAME, 
                'Key': filename,
                'ResponseContentDisposition': f'attachment; filename="{filename}"'
            },
            ExpiresIn=300 # 5 minutes
        )
        return {"download_url": url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/files/{filename}")
def delete_file(filename: str, user: dict = Depends(require_contributor)):
    try:
        log_audit_event(user.get('username', 'unknown'), 'FILE_DELETE', 'Soft Deleted', filename)
        # Soft Delete: Mark as deleted in DynamoDB (do not remove from S3)
        table.update_item(
            Key={'file_id': filename},
            UpdateExpression="set #d = :d, #dt = :dt",
            ExpressionAttributeNames={'#d': 'is_deleted', '#dt': 'deleted_at'},
            ExpressionAttributeValues={':d': True, ':dt': str(os.getenv('timestamp', ''))}
        )
        return {"status": "soft_deleted", "filename": filename}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/files/{filename}/restore")
def restore_file(filename: str, user: dict = Depends(require_contributor)):
    try:
        log_audit_event(user.get('username', 'unknown'), 'FILE_RESTORE', 'Restored from Trash', filename)
        # Restore: Unmark deletion
        table.update_item(
            Key={'file_id': filename},
            UpdateExpression="set #d = :d",
            ExpressionAttributeNames={'#d': 'is_deleted'},
            ExpressionAttributeValues={':d': False}
        )
        return {"status": "restored", "filename": filename}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/files/{filename}/permanent")
def delete_file_permanent(filename: str, user: dict = Depends(require_admin)):
    try:
        log_audit_event(user.get('username', 'unknown'), 'FILE_PERMANENT_DELETE', 'Permanently Deleted from S3', filename)
        # Hard Delete: Remove from S3 and DynamoDB
        s3.delete_object(Bucket=BUCKET_NAME, Key=filename)
        table.delete_item(Key={'file_id': filename})
        return {"status": "permanently_deleted", "filename": filename}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
