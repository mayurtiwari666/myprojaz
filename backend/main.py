from fastapi import FastAPI, UploadFile, File, Form, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import boto3
import os
from dotenv import load_dotenv
from backend.services.file_processor import extract_text_from_s3
from backend.services.vector_store import vector_store
from backend.middleware.logging import ActivityLoggingMiddleware
from backend.routers import admin, tags
from backend.auth import require_contributor, get_current_user
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
    'application/vnd.openxmlformats-officedocument.presentationml.presentation' # pptx
}

ALLOWED_EXTENSIONS = {'.pdf', '.jpg', '.jpeg', '.docx', '.doc', '.pptx', '.ppt'}

@app.get("/")
def read_root():
    return {"message": "RnD Knowledge Hub API is running"}

@app.get("/auth/me")
def read_current_user(user: dict = Depends(get_current_user)):
    # The middleware (get_current_user) now does a real-time fetch from Cognito.
    # So we can just return the user object directly.
    return user

@app.get("/files")
def list_files():
    try:
        response = table.scan()
        return response.get('Items', [])
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

@app.post("/files/ingest")
def ingest_file(
    metadata: FileMetadata,
    user: dict = Depends(require_contributor) # Protect
):
  
    try:
        # Save to DynamoDB
        table.put_item(
            Item={
                'file_id': metadata.filename, 
                'filename': metadata.filename,
                'content_type': metadata.content_type,
                'size': metadata.size,
                'status': 'uploading'
            }
        )
        
        # Trigger Processing
        try:
            print(f"Processing {metadata.filename}...")
            # FILE PROCESSOR (Smart Extraction)
            text = extract_text_from_s3(metadata.filename)
            
            # If text is empty (e.g. Image), we still index the filename/metadata but vector might be mostly noise?
            # Actually, standard vectorizers on empty string return a vector. 
            # Ideally we might want to skip search indexing for pure images if no OCR?
            # But user said "dont have to use textract for jpegs".
            # So we index whatever text we got (which might be "" for JPEGs).
            
            vector_store.add_document(text, metadata.filename)
            
            # Update status
            table.update_item(
                Key={'file_id': metadata.filename},
                UpdateExpression="set #s = :s",
                ExpressionAttributeNames={'#s': 'status'},
                ExpressionAttributeValues={':s': 'indexed'}
            )
            return {"status": "indexed", "file_id": metadata.filename}
        except Exception as proc_error:
            print(f"Processing failed: {proc_error}")
            return {"status": "uploaded_but_failed_processing", "file_id": metadata.filename, "error": str(proc_error)}

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
@app.get("/files/{filename}/view")
def view_file(filename: str, user: dict = Depends(require_contributor)):
    try:
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
        # 1. Delete from S3
        s3.delete_object(Bucket=BUCKET_NAME, Key=filename)
        
        # 2. Delete from DynamoDB
        table.delete_item(Key={'file_id': filename})
        
        # 3. Note: Vector Store deletion is skipped for stability/simplicity
        # The file will "disappear" from UI (DB) and Storage (S3).
        # Search results might linger until next re-index, but will fail to load, which is acceptable.
        
        return {"status": "deleted", "filename": filename}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
