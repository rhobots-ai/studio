"""
API routes for enhanced file management with manual column mapping support.
"""

from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Request
from fastapi.responses import StreamingResponse
from typing import Optional, List
import pandas as pd
import tempfile
import os
import shutil
import uuid
import base64
import json
from datetime import datetime

from models.file_models import (
    ColumnMappingRequest, ColumnMappingResponse,
    MappedPreviewRequest, MappedPreviewResponse,
    ProcessedFileResponse, TrainingExample,
    FileUploadResponse, FileListResponse, FilePreviewResponse
)
from services.column_mapping_service import column_mapping_service
from file_manager import file_manager

router = APIRouter(prefix="/api/files", tags=["files"])


@router.post("/upload", response_model=FileUploadResponse)
async def upload_file(
    request: Request
):
    """Upload a training data file with basic validation"""
    
    content_type = request.headers.get("content-type", "")
    
    if content_type.startswith("multipart/form-data"):
        return await handle_file_upload_multipart(request)
    elif content_type.startswith("application/json"):
        return await handle_file_upload_base64(request)
    else:
        raise HTTPException(
            status_code=400,
            detail="Content-Type must be either 'multipart/form-data' or 'application/json'"
        )


async def handle_file_upload_multipart(request: Request):
    """Handle multipart file upload"""
    try:
        form = await request.form()
        
        # Extract file and metadata
        data_file = form.get("file")
        display_name = form.get("display_name")
        
        if not data_file:
            raise HTTPException(status_code=400, detail="file is required")
        
        if not hasattr(data_file, 'filename') or not hasattr(data_file, 'file'):
            raise HTTPException(status_code=400, detail="file must be a valid file upload")
        
        if not data_file.filename:
            raise HTTPException(status_code=400, detail="File must have a filename")
        
        # Validate file type
        allowed_extensions = ['.csv', '.json', '.jsonl', '.xlsx', '.xls', '.pkl', '.pickle']
        file_extension = os.path.splitext(data_file.filename)[1].lower()
        
        if file_extension not in allowed_extensions:
            raise HTTPException(
                status_code=400, 
                detail=f"File must be one of: {', '.join(allowed_extensions)}. Got: {file_extension}"
            )
        
        # Read file content
        file_content = await data_file.read()
        
        # Upload file with enhanced column info
        result = await upload_file_with_column_info(
            file_content=file_content,
            original_filename=data_file.filename,
            display_name=display_name
        )
        
        if result['success']:
            return FileUploadResponse(
                success=True,
                file_id=result['file_id'],
                message=f"File '{data_file.filename}' uploaded successfully",
                metadata=result['metadata']
            )
        else:
            raise HTTPException(status_code=400, detail=result['error'])
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error uploading file: {str(e)}")


async def handle_file_upload_base64(request: Request):
    """Handle base64 file upload"""
    try:
        body = await request.json()
        
        file_content_b64 = body.get('file_content')
        original_filename = body.get('original_filename')
        display_name = body.get('display_name')
        
        if not file_content_b64:
            raise HTTPException(status_code=400, detail="file_content is required")
        
        if not original_filename:
            raise HTTPException(status_code=400, detail="original_filename is required")
        
        # Decode base64 content
        try:
            file_content = base64.b64decode(file_content_b64)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid base64 encoding: {str(e)}")
        
        # Validate file type
        allowed_extensions = ['.csv', '.json', '.jsonl', '.xlsx', '.xls', '.pkl', '.pickle']
        file_extension = os.path.splitext(original_filename)[1].lower()
        
        if file_extension not in allowed_extensions:
            raise HTTPException(
                status_code=400, 
                detail=f"File must be one of: {', '.join(allowed_extensions)}. Got: {file_extension}"
            )
        
        # Upload file with enhanced column info
        result = await upload_file_with_column_info(
            file_content=file_content,
            original_filename=original_filename,
            display_name=display_name
        )
        
        if result['success']:
            return FileUploadResponse(
                success=True,
                file_id=result['file_id'],
                message=f"File '{original_filename}' uploaded successfully",
                metadata=result['metadata']
            )
        else:
            raise HTTPException(status_code=400, detail=result['error'])
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error uploading file: {str(e)}")


async def upload_file_with_column_info(
    file_content: bytes,
    original_filename: str,
    display_name: Optional[str] = None
) -> dict:
    """Upload file and get basic column information"""
    
    # Create temporary file for analysis
    temp_dir = tempfile.mkdtemp()
    file_extension = os.path.splitext(original_filename)[1].lower()
    temp_file_path = os.path.join(temp_dir, f"upload_{uuid.uuid4().hex}{file_extension}")
    
    try:
        # Write content to temp file
        with open(temp_file_path, "wb") as f:
            f.write(file_content)
        
        # Load data for basic analysis
        data = load_data_file(temp_file_path)
        
        # Get column information
        column_info = column_mapping_service.get_column_info(data)
        
        # Use existing file manager for upload
        result = file_manager.upload_file(
            file_content=file_content,
            original_filename=original_filename,
            display_name=display_name
        )
        
        if result['success']:
            # Enhance metadata with column information
            file_id = result['file_id']
            enhanced_metadata = result['metadata'].copy()
            
            # Add column information to validation details
            validation_details = enhanced_metadata.get('validation_details', {})
            validation_details.update({
                'column_types': {
                    col: info.get('data_type', 'object')
                    for col, info in column_info['column_info'].items()
                },
                'column_stats': column_info['column_info']
            })
            
            enhanced_metadata['validation_details'] = validation_details
            
            # Update file metadata in storage
            file_manager.update_file_metadata(file_id, {
                'validation_details': validation_details
            })
            
            result['metadata'] = enhanced_metadata
        
        return result
        
    finally:
        # Clean up temp file
        if os.path.exists(temp_file_path):
            os.remove(temp_file_path)
        if os.path.exists(temp_dir):
            os.rmdir(temp_dir)


def load_data_file(file_path: str) -> pd.DataFrame:
    """Load data from file into DataFrame"""
    file_extension = os.path.splitext(file_path)[1].lower()
    
    if file_extension == '.csv':
        return pd.read_csv(file_path)
    elif file_extension == '.json':
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        # Convert complex nested objects to JSON strings before creating DataFrame
        def serialize_complex_objects(obj):
            if isinstance(obj, list):
                return [serialize_complex_objects(item) for item in obj]
            elif isinstance(obj, dict):
                return {k: json.dumps(v) if isinstance(v, (dict, list)) else v for k, v in obj.items()}
            else:
                return obj
        
        if isinstance(data, list):
            # Process each record to handle nested objects
            processed_data = [serialize_complex_objects(record) for record in data]
            return pd.DataFrame(processed_data)
        elif isinstance(data, dict):
            # Check if it's a dict with list values (columnar format)
            if data and all(isinstance(v, list) for v in data.values()):
                return pd.DataFrame(data)
            else:
                # Single object, wrap in list and process
                processed_data = [serialize_complex_objects(data)]
                return pd.DataFrame(processed_data)
        else:
            raise ValueError("Invalid JSON format")
    elif file_extension == '.jsonl':
        data = []
        with open(file_path, 'r', encoding='utf-8') as f:
            for line in f:
                if line.strip():
                    data.append(pd.read_json(line, typ='series').to_dict())
        return pd.DataFrame(data)
    elif file_extension in ['.xlsx', '.xls']:
        # Read Excel file, using first sheet by default
        return pd.read_excel(file_path, sheet_name=0)
    elif file_extension in ['.pkl', '.pickle']:
        # Read pickle file using pandas
        df = pd.read_pickle(file_path)
        # Ensure it's a DataFrame
        if not isinstance(df, pd.DataFrame):
            raise ValueError("Pickle file must contain a pandas DataFrame")
        return df
    else:
        raise ValueError(f"Unsupported file format: {file_extension}")


@router.get("/{file_id}/column-info")
async def get_file_column_info(file_id: str):
    """Get detailed column information for a file"""
    try:
        # Validate file exists
        file_info = file_manager.get_file_info(file_id)
        if not file_info:
            raise HTTPException(status_code=404, detail="File not found")
        
        # Get file path and load data
        file_path = file_manager.get_file_path(file_id)
        if not file_path or not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="File not found on disk")
        
        # Load data and get column info
        data = load_data_file(file_path)
        column_info = column_mapping_service.get_column_info(data)
        
        return {
            "success": True,
            "file_id": file_id,
            **column_info
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting column info: {str(e)}")


@router.post("/{file_id}/validate-mapping")
async def validate_column_mapping(file_id: str, request: ColumnMappingRequest):
    """Validate a column mapping configuration"""
    try:
        # Validate file exists
        file_info = file_manager.get_file_info(file_id)
        if not file_info:
            raise HTTPException(status_code=404, detail="File not found")
        
        # Get file path and load data
        file_path = file_manager.get_file_path(file_id)
        if not file_path or not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="File not found on disk")
        
        # Load data and validate mapping
        data = load_data_file(file_path)
        validation_result = column_mapping_service.validate_mapping(data, request.column_mapping)
        
        return {
            "success": True,
            "file_id": file_id,
            "validation": validation_result
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error validating mapping: {str(e)}")


@router.post("/{file_id}/map-columns", response_model=ColumnMappingResponse)
async def save_column_mapping(file_id: str, request: ColumnMappingRequest):
    """Save column mapping configuration for a file"""
    try:
        # Validate file exists
        file_info = file_manager.get_file_info(file_id)
        if not file_info:
            raise HTTPException(status_code=404, detail="File not found")
        
        # Get file path and load data
        file_path = file_manager.get_file_path(file_id)
        if not file_path or not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="File not found on disk")
        
        # Load data and validate mapping
        data = load_data_file(file_path)
        validation_result = column_mapping_service.validate_mapping(data, request.column_mapping)
        
        if not validation_result['is_valid']:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid column mapping: {'; '.join(validation_result['issues'])}"
            )
        
        # Test the mapping with a small sample
        try:
            preview_result = column_mapping_service.preview_mapping(data, request.column_mapping, limit=5)
            if not preview_result:
                raise HTTPException(
                    status_code=400,
                    detail="Column mapping produces no valid training examples"
                )
        except Exception as e:
            raise HTTPException(
                status_code=400,
                detail=f"Error testing column mapping: {str(e)}"
            )
        
        # Save mapping to file metadata
        mapping_dict = request.column_mapping.dict()
        success = file_manager.update_file_metadata(file_id, {
            'column_mapping': mapping_dict,
            'has_mapping': True,
            'validation_status': 'valid'
        })
        
        if not success:
            raise HTTPException(status_code=500, detail="Failed to save column mapping")
        
        return ColumnMappingResponse(
            success=True,
            message="Column mapping saved successfully",
            file_id=file_id,
            validation_status="valid"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error saving column mapping: {str(e)}")


@router.post("/{file_id}/preview-mapped", response_model=MappedPreviewResponse)
async def preview_mapped_data(file_id: str, request: MappedPreviewRequest):
    """Preview how data will look with applied column mapping"""
    try:
        # Validate file exists
        file_info = file_manager.get_file_info(file_id)
        if not file_info:
            raise HTTPException(status_code=404, detail="File not found")
        
        # Get file path and load data
        file_path = file_manager.get_file_path(file_id)
        if not file_path or not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="File not found on disk")
        
        # Load data
        data = load_data_file(file_path)
        
        # Apply mapping and get preview
        preview_result = column_mapping_service.preview_mapping(
            data, request.column_mapping, request.limit
        )
        
        return MappedPreviewResponse(
            success=True,
            file_id=file_id,
            preview_data=preview_result,
            total_rows=len(data),
            showing_rows=len(preview_result),
            mapping_applied=request.column_mapping
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error previewing mapped data: {str(e)}")


@router.post("/{file_id}/process-complete", response_model=ProcessedFileResponse)
async def process_complete_file(file_id: str, request: ColumnMappingRequest):
    """Process the entire file with the given column mapping"""
    try:
        # Validate file exists
        file_info = file_manager.get_file_info(file_id)
        if not file_info:
            raise HTTPException(status_code=404, detail="File not found")
        
        # Get file path and load data
        file_path = file_manager.get_file_path(file_id)
        if not file_path or not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="File not found on disk")
        
        # Load data
        data = load_data_file(file_path)
        
        # Validate mapping first
        validation_result = column_mapping_service.validate_mapping(data, request.column_mapping)
        if not validation_result['is_valid']:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid column mapping: {'; '.join(validation_result['issues'])}"
            )
        
        # Process the entire file
        processed_examples = column_mapping_service.apply_mapping(data, request.column_mapping)
        
        # Get processing statistics
        processing_stats = column_mapping_service.get_processing_stats(data, request.column_mapping)
        
        # Update file usage statistics
        file_manager.update_file_metadata(file_id, {
            'last_used': datetime.now().isoformat(),
            'usage_count': file_info.get('usage_count', 0) + 1
        })
        
        return ProcessedFileResponse(
            success=True,
            file_id=file_id,
            processed_data=processed_examples,
            total_examples=len(processed_examples),
            processing_stats=processing_stats
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing file: {str(e)}")


@router.get("/{file_id}/mapping")
async def get_file_mapping(file_id: str):
    """Get the current column mapping for a file"""
    try:
        file_info = file_manager.get_file_info(file_id)
        if not file_info:
            raise HTTPException(status_code=404, detail="File not found")
        
        column_mapping = file_info.get('column_mapping')
        if not column_mapping:
            raise HTTPException(status_code=404, detail="No column mapping found for this file")
        
        return {
            "success": True,
            "file_id": file_id,
            "column_mapping": column_mapping,
            "has_mapping": file_info.get('has_mapping', False)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting file mapping: {str(e)}")


@router.delete("/{file_id}/mapping")
async def remove_file_mapping(file_id: str):
    """Remove column mapping from a file"""
    try:
        file_info = file_manager.get_file_info(file_id)
        if not file_info:
            raise HTTPException(status_code=404, detail="File not found")
        
        # Remove mapping from metadata
        success = file_manager.update_file_metadata(file_id, {
            'column_mapping': None,
            'has_mapping': False,
            'validation_status': 'pending'  # Reset validation status
        })
        
        if not success:
            raise HTTPException(status_code=500, detail="Failed to remove column mapping")
        
        return {
            "success": True,
            "message": "Column mapping removed successfully",
            "file_id": file_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error removing file mapping: {str(e)}")


# Include existing file management endpoints
@router.get("", response_model=FileListResponse)
async def list_files(
    filter_by: Optional[str] = None,
    sort_by: Optional[str] = "upload_date",
    sort_desc: Optional[bool] = True
):
    """List all uploaded files"""
    try:
        files = file_manager.list_files(
            filter_by=filter_by,
            sort_by=sort_by,
            sort_desc=sort_desc
        )
        
        storage_stats = file_manager.get_storage_stats()
        
        return FileListResponse(
            files=files,
            total=len(files),
            storage_stats=storage_stats
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error listing files: {str(e)}")


@router.get("/{file_id}")
async def get_file_info(file_id: str):
    """Get detailed information about a file"""
    try:
        file_info = file_manager.get_file_info(file_id)
        if not file_info:
            raise HTTPException(status_code=404, detail="File not found")
        
        return {
            "success": True,
            "file_info": file_info
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting file info: {str(e)}")


@router.get("/{file_id}/preview", response_model=FilePreviewResponse)
async def get_file_preview(file_id: str, limit: int = 10):
    """Get preview data for a file"""
    try:
        file_info = file_manager.get_file_info(file_id)
        if not file_info:
            raise HTTPException(status_code=404, detail="File not found")
        
        preview_data = file_manager.get_file_preview(file_id, limit)
        if preview_data is None:
            raise HTTPException(status_code=404, detail="Preview data not available")
        
        return FilePreviewResponse(
            success=True,
            file_id=file_id,
            preview_data=preview_data,
            total_rows=file_info.get('validation_details', {}).get('total_rows', 0),
            showing_rows=len(preview_data),
            columns=file_info.get('validation_details', {}).get('columns', [])
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting file preview: {str(e)}")


@router.delete("/{file_id}")
async def delete_file(file_id: str):
    """Delete a file"""
    try:
        file_info = file_manager.get_file_info(file_id)
        if not file_info:
            raise HTTPException(status_code=404, detail="File not found")
        
        success = file_manager.delete_file(file_id)
        if not success:
            raise HTTPException(status_code=500, detail="Failed to delete file")
        
        return {
            "success": True,
            "message": f"File '{file_info['display_name']}' deleted successfully",
            "file_id": file_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error deleting file: {str(e)}")
