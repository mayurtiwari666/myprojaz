from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
import boto3
from backend.config import settings
from backend.auth import require_admin, require_contributor

router = APIRouter(prefix="/tags", tags=["tags"])

dynamodb = boto3.resource('dynamodb', region_name=settings.AWS_REGION)
table = dynamodb.Table('rnd-hub-tags')
files_table = dynamodb.Table('rnd-hub-metadata')

class TagCreate(BaseModel):
    name: str
    color: str

@router.get("/")
def get_tags():
    try:
        response = table.scan()
        tags = response.get('Items', [])
        
        # Calculate usage count for each tag (Slow Scan for MVP)
        # In prod, increment a counter on the tag item when assigning
        files = files_table.scan().get('Items', [])
        
        for tag in tags:
            count = 0
            for f in files:
                if tag['name'] in f.get('tags', []):
                    count += 1
            tag['count'] = count
            
        return tags
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/")
def create_tag(tag: TagCreate, user: dict = Depends(require_admin)):
    try:
        table.put_item(
            Item={
                'name': tag.name,
                'color': tag.color
            }
        )
        return {"status": "success", "tag": tag.dict()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{name}")
def delete_tag(name: str, user: dict = Depends(require_admin)):
    try:
        table.delete_item(Key={'name': name})
        return {"status": "deleted", "name": name}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class AssignTagRequest(BaseModel):
    file_id: str
    tags: list[str]

@router.post("/assign")
def assign_tags(req: AssignTagRequest, user: dict = Depends(require_contributor)):
    try:
        files_table.update_item(
            Key={'file_id': req.file_id},
            UpdateExpression="set tags = :t",
            ExpressionAttributeValues={':t': req.tags}
        )
        return {"status": "success", "tags": req.tags}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class BulkAssignTagRequest(BaseModel):
    file_ids: list[str]
    tags: list[str]
    mode: str = 'add' # 'add' or 'replace'

@router.post("/bulk-assign")
def bulk_assign_tags(req: BulkAssignTagRequest, user: dict = Depends(require_contributor)):
    """
    Assigns tags to multiple files.
    Mode 'add': Appends tags.
    Mode 'replace': Overwrites tags.
    """
    try:
        updated_count = 0
        for file_id in req.file_ids:
            if req.mode == 'replace':
                files_table.update_item(
                    Key={'file_id': file_id},
                    UpdateExpression="set tags = :t",
                    ExpressionAttributeValues={':t': req.tags}
                )
            else:
                # Add mode: Read -> Merge -> Write
                item_resp = files_table.get_item(Key={'file_id': file_id})
                item = item_resp.get('Item')
                if not item: continue
                
                current_tags = item.get('tags', [])
                # Merge and unique
                new_set = set(current_tags + req.tags)
                final_tags = list(new_set)
                
                files_table.update_item(
                    Key={'file_id': file_id},
                    UpdateExpression="set tags = :t",
                    ExpressionAttributeValues={':t': final_tags}
                )
            updated_count += 1
            
        return {"status": "success", "updated": updated_count}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
