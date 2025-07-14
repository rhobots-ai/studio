"""
API routes for dataset management.
"""

from fastapi import APIRouter, HTTPException
from typing import Optional, List
from datetime import datetime

from models.dataset_models import (
    DatasetCreateRequest, DatasetCreateResponse, DatasetListResponse,
    DatasetPreviewResponse, DatasetUpdateRequest, DatasetUsageResponse,
    ProcessedDataset
)
from services.dataset_service import dataset_service

router = APIRouter(prefix="/api/datasets", tags=["datasets"])


@router.post("/create", response_model=DatasetCreateResponse)
async def create_dataset(request: DatasetCreateRequest):
    """Create a new processed dataset"""
    try:
        result = dataset_service.create_dataset(request)
        
        if result['success']:
            return DatasetCreateResponse(
                success=True,
                dataset_id=result['dataset_id'],
                message=f"Dataset '{request.name}' created successfully",
                dataset=result['dataset']
            )
        else:
            raise HTTPException(status_code=400, detail=result['error'])
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error creating dataset: {str(e)}")


@router.get("", response_model=DatasetListResponse)
async def list_datasets(
    sort_by: str = 'created_at',
    sort_desc: bool = True,
    filter_tags: Optional[str] = None
):
    """List all datasets with optional filtering and sorting"""
    try:
        # Parse filter tags
        tags_list = None
        if filter_tags:
            tags_list = [tag.strip() for tag in filter_tags.split(',') if tag.strip()]
        
        result = dataset_service.list_datasets(
            sort_by=sort_by,
            sort_desc=sort_desc,
            filter_tags=tags_list
        )
        
        if result['success']:
            return DatasetListResponse(
                datasets=result['datasets'],
                total=result['total'],
                storage_stats=result['storage_stats']
            )
        else:
            raise HTTPException(status_code=500, detail=result['error'])
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error listing datasets: {str(e)}")


@router.get("/{dataset_id}")
async def get_dataset(dataset_id: str):
    """Get detailed information about a specific dataset"""
    try:
        dataset = dataset_service.get_dataset(dataset_id)
        if not dataset:
            raise HTTPException(status_code=404, detail="Dataset not found")
        
        return {
            "success": True,
            "dataset": dataset
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting dataset: {str(e)}")


@router.get("/{dataset_id}/preview", response_model=DatasetPreviewResponse)
async def preview_dataset(dataset_id: str, limit: int = 10):
    """Get a preview of dataset training examples"""
    try:
        result = dataset_service.preview_dataset(dataset_id, limit)
        
        if result['success']:
            return DatasetPreviewResponse(
                success=True,
                dataset_id=dataset_id,
                preview_data=result['preview_data'],
                total_examples=result['total_examples'],
                showing_examples=result['showing_examples']
            )
        else:
            raise HTTPException(status_code=404, detail=result['error'])
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error previewing dataset: {str(e)}")


@router.get("/{dataset_id}/download")
async def download_dataset(dataset_id: str):
    """Download the complete dataset as JSON"""
    try:
        from fastapi.responses import FileResponse
        import os
        
        dataset = dataset_service.get_dataset(dataset_id)
        if not dataset:
            raise HTTPException(status_code=404, detail="Dataset not found")
        
        if not os.path.exists(dataset.file_path):
            raise HTTPException(status_code=404, detail="Dataset file not found")
        
        # Track usage
        dataset_service.track_usage(dataset_id)
        
        return FileResponse(
            path=dataset.file_path,
            filename=f"{dataset.name.replace(' ', '_')}.json",
            media_type='application/json'
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error downloading dataset: {str(e)}")


@router.put("/{dataset_id}")
async def update_dataset(dataset_id: str, request: DatasetUpdateRequest):
    """Update dataset metadata"""
    try:
        updates = {}
        if request.name is not None:
            updates['name'] = request.name
        if request.description is not None:
            updates['description'] = request.description
        if request.tags is not None:
            updates['tags'] = request.tags
        
        result = dataset_service.update_dataset(dataset_id, updates)
        
        if result['success']:
            return {
                "success": True,
                "message": "Dataset updated successfully",
                "dataset": result['dataset']
            }
        else:
            raise HTTPException(status_code=404, detail=result['error'])
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error updating dataset: {str(e)}")


@router.delete("/{dataset_id}")
async def delete_dataset(dataset_id: str):
    """Delete a dataset and its data"""
    try:
        result = dataset_service.delete_dataset(dataset_id)
        
        if result['success']:
            return {
                "success": True,
                "message": result['message'],
                "dataset_id": dataset_id
            }
        else:
            raise HTTPException(status_code=404, detail=result['error'])
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error deleting dataset: {str(e)}")


@router.post("/{dataset_id}/use", response_model=DatasetUsageResponse)
async def track_dataset_usage(dataset_id: str):
    """Track dataset usage (called when dataset is used for training)"""
    try:
        result = dataset_service.track_usage(dataset_id)
        
        if result['success']:
            return DatasetUsageResponse(
                success=True,
                dataset_id=dataset_id,
                usage_count=result['usage_count'],
                last_used=result['last_used']
            )
        else:
            raise HTTPException(status_code=404, detail=result['error'])
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error tracking usage: {str(e)}")


@router.get("/{dataset_id}/data")
async def get_dataset_data(dataset_id: str):
    """Get the complete training data for a dataset"""
    try:
        dataset = dataset_service.get_dataset(dataset_id)
        if not dataset:
            raise HTTPException(status_code=404, detail="Dataset not found")
        
        training_data = dataset_service.get_dataset_data(dataset_id)
        if training_data is None:
            raise HTTPException(status_code=404, detail="Dataset data not accessible")
        
        # Track usage
        dataset_service.track_usage(dataset_id)
        
        return {
            "success": True,
            "dataset_id": dataset_id,
            "data": training_data,
            "total_examples": len(training_data)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting dataset data: {str(e)}")


@router.get("/stats/overview")
async def get_datasets_overview():
    """Get overview statistics for all datasets"""
    try:
        result = dataset_service.list_datasets()
        
        if not result['success']:
            raise HTTPException(status_code=500, detail=result['error'])
        
        datasets = result['datasets']
        
        # Calculate additional statistics
        if datasets:
            recent_datasets = sorted(datasets, key=lambda x: x.created_at, reverse=True)[:5]
            popular_datasets = sorted(datasets, key=lambda x: x.usage_count, reverse=True)[:5]
            
            # Tag statistics
            all_tags = []
            for dataset in datasets:
                all_tags.extend(dataset.tags)
            
            tag_counts = {}
            for tag in all_tags:
                tag_counts[tag] = tag_counts.get(tag, 0) + 1
            
            popular_tags = sorted(tag_counts.items(), key=lambda x: x[1], reverse=True)[:10]
        else:
            recent_datasets = []
            popular_datasets = []
            popular_tags = []
        
        return {
            "success": True,
            "overview": {
                "total_datasets": result['total'],
                "storage_stats": result['storage_stats'],
                "recent_datasets": recent_datasets,
                "popular_datasets": popular_datasets,
                "popular_tags": popular_tags
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting overview: {str(e)}")


@router.post("/{dataset_id}/duplicate")
async def duplicate_dataset(dataset_id: str, new_name: str):
    """Create a copy of an existing dataset"""
    try:
        # Get original dataset
        original_dataset = dataset_service.get_dataset(dataset_id)
        if not original_dataset:
            raise HTTPException(status_code=404, detail="Original dataset not found")
        
        # Create duplicate request
        duplicate_request = DatasetCreateRequest(
            name=new_name,
            description=f"Copy of {original_dataset.name}",
            source_file_id=original_dataset.source_file_id,
            column_mapping=original_dataset.column_mapping,
            tags=original_dataset.tags + ["duplicate"]
        )
        
        # Create the duplicate
        result = dataset_service.create_dataset(duplicate_request)
        
        if result['success']:
            return {
                "success": True,
                "message": f"Dataset duplicated as '{new_name}'",
                "original_dataset_id": dataset_id,
                "new_dataset_id": result['dataset_id'],
                "new_dataset": result['dataset']
            }
        else:
            raise HTTPException(status_code=400, detail=result['error'])
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error duplicating dataset: {str(e)}")
