
from fastapi import APIRouter, HTTPException, Depends, Body
import boto3
from backend.config import settings
from backend.auth import require_contributor, get_current_user
import datetime
from boto3.dynamodb.conditions import Key, Attr
from typing import List



router = APIRouter(
    prefix="/storage-paths",
    tags=["storage-paths"],
    dependencies=[Depends(get_current_user)]
)




# DynamoDB Resources
dynamodb = boto3.resource('dynamodb', region_name=settings.AWS_REGION)
table_paths = dynamodb.Table('rnd-hub-storage-paths')
table_files = dynamodb.Table('rnd-hub-metadata')

@router.get("")
def list_storage_paths():
    """List all storage paths with file counts."""
    try:
        # Get all paths
        response = table_paths.scan()
        paths = response.get('Items', [])
        
        # Get counts (This is expensive in DynamoDB without aggregations, but for MVP we scan or use GSI)
        # Better approach: when adding a file to a path, increment a counter on the path item?
        # For now, let's just return the paths. The frontend can query files by path to get count if needed, 
        # or we implement aggregation later.
        # Actually, let's do a quick scan of files to aggregate counts.
        
        files_resp = table_files.scan(ProjectionExpression='storage_path')
        files = files_resp.get('Items', [])
        
        counts = {}
        for f in files:
            p = f.get('storage_path')
            if p:
                counts[p] = counts.get(p, 0) + 1
                
        # Merge counts
        result = []
        for p in paths:
            p['count'] = counts.get(p['path_name'], 0)
            result.append(p)
            
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("")
def create_storage_path(
    path_name: str = Body(..., embed=True), 
    description: str = Body(None, embed=True)
):
    try:
        # Check existence
        existing = table_paths.get_item(Key={'path_name': path_name})
        if 'Item' in existing:
            raise HTTPException(status_code=400, detail="Path already exists")
            
        item = {
            'path_name': path_name,
            'description': description,
            'created_at': datetime.datetime.utcnow().isoformat()
        }
        table_paths.put_item(Item=item)
        return item
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{path_name:path}")
def delete_storage_path(path_name: str, force: bool = False):
    try:
        # Check if empty
        # Scan files where storage_path = path_name
        response = table_files.scan(
            FilterExpression=Attr('storage_path').eq(path_name),
            Select='COUNT'
        )
        if response['Count'] > 0:
            if not force:
                raise HTTPException(status_code=400, detail="Cannot delete non-empty path. Add ?force=true to move files to root.")
            else:
                # Force Delete: Move files to root (None)
                # We need to find the files first (Scan again to get keys)
                files_resp = table_files.scan(
                    FilterExpression=Attr('storage_path').eq(path_name)
                )
                for item in files_resp.get('Items', []):
                    table_files.update_item(
                        Key={'file_id': item['file_id']},
                        UpdateExpression="REMOVE storage_path"
                    )
            
        table_paths.delete_item(Key={'path_name': path_name})
        return {"status": "deleted", "path": path_name}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/bulk-assign")
def bulk_assign_path(
    file_ids: List[str] = Body(...),
    target_path: str = Body(...)
):
    try:
        # Check if path exists (unless it's empty string/None for "Root")
        if target_path:
            path_item = table_paths.get_item(Key={'path_name': target_path})
            if 'Item' not in path_item:
                 # Auto-create if not exists? Or strict? 
                 # Let's act strictly for now to avoid typos creating folders.
                 # Actually, UI sends existing paths. But user might want to create on fly.
                 # Let's be strict.
                 raise HTTPException(status_code=400, detail=f"Path '{target_path}' does not exist.")
        
        # Batch Update (DynamoDB doesn't have BatchUpdate, so we loop)
        # For 50 files, this is 50 writes. Acceptable for MVP.
        updated_count = 0
        for fid in file_ids:
            try:
                table_files.update_item(
                    Key={'file_id': fid},
                    UpdateExpression="set #p = :p",
                    ExpressionAttributeNames={'#p': 'storage_path'},
                    ExpressionAttributeValues={':p': target_path if target_path else None}
                )
                updated_count += 1
            except Exception as e:
                print(f"Failed to update {fid}: {e}")
                
        return {"status": "success", "updated_count": updated_count}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
