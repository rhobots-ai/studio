"""
API routes for model evaluation functionality.
"""

from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from typing import Dict, List, Any, Optional
import json
import base64
import tempfile
import os
import csv
from pydantic import BaseModel

from evaluation_service import evaluation_service, validate_test_data, validate_test_data_with_mapping, load_test_data_from_file

router = APIRouter(prefix="/evaluate", tags=["evaluation"])

# Request/Response Models
class EvaluationRequest(BaseModel):
    model_path: str
    test_data: List[Dict[str, Any]]
    batch_size: int = 50

class EvaluationFileRequest(BaseModel):
    model_path: str
    file_content: str  # base64 encoded
    file_type: str  # csv, json, jsonl, pkl, pickle
    batch_size: int = 50
    mapping: Optional[Dict[str, Any]] = None

class EvaluationMapping(BaseModel):
    input_columns: Dict[str, str]
    output_column: Optional[str] = None  # Legacy support
    output_columns: Optional[Dict[str, str]] = None  # New structure
    # Dynamic instruction configuration
    instruction_source: Optional[str] = "static"  # "static", "column", "file"
    instruction_column: Optional[str] = None  # Column name for instructions
    instruction_file_content: Optional[str] = None  # Base64 encoded instruction file
    instruction_file_type: Optional[str] = None  # json, csv, jsonl
    instruction_file_mapping: Optional[Dict[str, str]] = None  # How to map instruction file to dataset
    static_instruction: Optional[str] = None  # Fallback static instruction
    preprocessing_options: Dict[str, Any] = {}

class AnalyzeColumnsRequest(BaseModel):
    file_content: str  # base64 encoded
    file_type: str  # csv, json, jsonl, pkl, pickle

class ValidateMappingRequest(BaseModel):
    file_content: str  # base64 encoded
    file_type: str  # csv, json, jsonl, pkl, pickle
    mapping: EvaluationMapping
    model_schema: Dict[str, Any]

class EvaluationResponse(BaseModel):
    job_id: str
    status: str
    message: str
    total_rows: int

class JobStatusResponse(BaseModel):
    job_id: str
    status: str
    progress: Dict[str, Any]
    error: Optional[str] = None

class JobResultsResponse(BaseModel):
    job_id: str
    status: str
    total_results: int
    results: List[Dict[str, Any]]

@router.post("/predict", response_model=EvaluationResponse)
async def start_prediction_job(request: EvaluationRequest):
    """Start a prediction job with test data array"""
    try:
        # Validate test data
        validation = validate_test_data(request.test_data)
        if not validation.get("isValid", False):
            raise HTTPException(
                status_code=400,
                detail=f"Invalid test data: {'; '.join(validation.get('errors', []))}"
            )
        
        # Start prediction job
        job_id = evaluation_service.create_prediction_job(
            model_path=request.model_path,
            test_data=request.test_data,
            batch_size=request.batch_size
        )
        
        return EvaluationResponse(
            job_id=job_id,
            status="queued",
            message="Prediction job started successfully",
            total_rows=len(request.test_data)
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/predict-file", response_model=EvaluationResponse)
async def start_prediction_job_with_file(request: EvaluationFileRequest):
    """Start a prediction job with base64 file content and mapping"""
    try:
        # Handle base64 content - different handling for binary vs text files
        try:
            if request.file_type in ['pkl', 'pickle']:
                # Binary file - decode to bytes
                decoded_content = base64.b64decode(request.file_content)
                file_mode = 'wb'
            else:
                # Text file - decode to string
                decoded_content = base64.b64decode(request.file_content).decode('utf-8')
                file_mode = 'w'
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid base64 content: {str(e)}")
        
        # Create temporary file
        with tempfile.NamedTemporaryFile(mode=file_mode, delete=False, suffix=f".{request.file_type}") as tmp_file:
            tmp_file.write(decoded_content)
            tmp_file.flush()
            
            try:
                test_data, file_format = load_test_data_from_file(tmp_file.name)
            finally:
                os.unlink(tmp_file.name)
        
        # Get mapping if provided
        mapping_dict = request.mapping
        
        # Validate data with mapping if provided
        if mapping_dict:
            validation = validate_test_data_with_mapping(test_data, mapping_dict)
            if not validation.get("isValid", False):
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid test data with mapping: {'; '.join(validation.get('errors', []))}"
                )
        else:
            # Basic validation without mapping
            validation = validate_test_data(test_data)
            if not validation.get("isValid", False):
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid test data: {'; '.join(validation.get('errors', []))}"
                )
        
        # Start prediction job
        job_id = evaluation_service.create_prediction_job(
            model_path=request.model_path,
            test_data=test_data,
            batch_size=request.batch_size,
            mapping=mapping_dict
        )
        
        return EvaluationResponse(
            job_id=job_id,
            status="queued",
            message="Prediction job started successfully",
            total_rows=len(test_data)
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/analyze-columns")
async def analyze_file_columns(request: AnalyzeColumnsRequest):
    """Analyze file columns and return column information"""
    try:
        # Decode base64 content - different handling for binary vs text files
        try:
            if request.file_type in ['pkl', 'pickle']:
                # Binary file - decode to bytes
                decoded_content = base64.b64decode(request.file_content)
                file_mode = 'wb'
            else:
                # Text file - decode to string
                decoded_content = base64.b64decode(request.file_content).decode('utf-8')
                file_mode = 'w'
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid base64 content: {str(e)}")
        
        # Create temporary file and load data
        with tempfile.NamedTemporaryFile(mode=file_mode, delete=False, suffix=f".{request.file_type}") as tmp_file:
            tmp_file.write(decoded_content)
            tmp_file.flush()
            
            try:
                test_data, file_format = load_test_data_from_file(tmp_file.name)
            finally:
                os.unlink(tmp_file.name)
        
        if not test_data:
            raise HTTPException(status_code=400, detail="No data found in file")
        
        # Analyze columns without pandas
        if not test_data:
            raise HTTPException(status_code=400, detail="No data found in file")
        
        columns = list(test_data[0].keys()) if test_data else []
        column_info = {}
        total_rows = len(test_data)
        
        for col in columns:
            # Collect all values for this column
            values = [row.get(col) for row in test_data]
            
            # Basic statistics
            null_count = sum(1 for v in values if v is None or v == '')
            null_percentage = (null_count / total_rows) * 100
            
            # Non-null values
            non_null_values = [v for v in values if v is not None and v != '']
            unique_count = len(set(str(v) for v in non_null_values))
            
            # Sample values (first 5 non-null)
            sample_values = non_null_values[:5]
            
            # Data type detection
            if non_null_values:
                # Check if all non-null values are strings
                if all(isinstance(v, str) for v in non_null_values):
                    data_type = 'string'
                    # Calculate text length statistics
                    text_lengths = [len(str(v)) for v in non_null_values]
                    avg_length = sum(text_lengths) / len(text_lengths) if text_lengths else 0
                    max_length = max(text_lengths) if text_lengths else 0
                    min_length = min(text_lengths) if text_lengths else 0
                else:
                    # Try to detect numeric
                    try:
                        numeric_values = [float(v) for v in non_null_values]
                        data_type = 'numeric'
                        avg_length = max_length = min_length = None
                    except (ValueError, TypeError):
                        data_type = 'mixed'
                        avg_length = max_length = min_length = None
            else:
                data_type = 'unknown'
                avg_length = max_length = min_length = None
            
            column_info[col] = {
                'name': col,
                'data_type': data_type,
                'null_count': null_count,
                'null_percentage': null_percentage,
                'unique_count': unique_count,
                'sample_values': sample_values,
                'total_rows': total_rows,
                'avg_length': avg_length,
                'max_length': max_length,
                'min_length': min_length,
            }
        
        return {
            'columns': columns,
            'columnInfo': column_info,
            'totalRows': total_rows
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/validate-mapping")
async def validate_mapping(request: ValidateMappingRequest):
    """Validate column mapping for evaluation"""
    try:
        # Decode base64 content - different handling for binary vs text files
        try:
            if request.file_type in ['pkl', 'pickle']:
                # Binary file - decode to bytes
                decoded_content = base64.b64decode(request.file_content)
                file_mode = 'wb'
            else:
                # Text file - decode to string
                decoded_content = base64.b64decode(request.file_content).decode('utf-8')
                file_mode = 'w'
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid base64 content: {str(e)}")
        
        # Create temporary file and load data
        with tempfile.NamedTemporaryFile(mode=file_mode, delete=False, suffix=f".{request.file_type}") as tmp_file:
            tmp_file.write(decoded_content)
            tmp_file.flush()
            
            try:
                test_data, file_format = load_test_data_from_file(tmp_file.name)
            finally:
                os.unlink(tmp_file.name)
        
        # Validate mapping
        mapping_dict = request.mapping.dict()
        validation = validate_test_data_with_mapping(test_data, mapping_dict)
        
        return validation
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/status/{job_id}", response_model=JobStatusResponse)
async def get_job_status(job_id: str):
    """Get status of an evaluation job"""
    try:
        job = evaluation_service.get_job_status(job_id)
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")
        
        progress = {
            "completed_rows": job.get("completed_rows", 0),
            "total_rows": job.get("total_rows", 0),
            "progress_percentage": job.get("progress_percentage", 0),
            "estimated_completion_time": job.get("estimated_completion_time"),
            "avg_time_per_example": job.get("avg_time_per_example", 0),
            "processing_speed": job.get("processing_speed", 0)
        }
        
        return JobStatusResponse(
            job_id=job_id,
            status=job["status"],
            progress=progress,
            error=job.get("error")
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/results/{job_id}", response_model=JobResultsResponse)
async def get_job_results(job_id: str):
    """Get results of a completed evaluation job"""
    try:
        results = evaluation_service.get_job_results(job_id)
        if results is None:
            job = evaluation_service.get_job_status(job_id)
            if not job:
                raise HTTPException(status_code=404, detail="Job not found")
            elif job["status"] != "completed":
                raise HTTPException(status_code=400, detail=f"Job is not completed. Current status: {job['status']}")
            else:
                raise HTTPException(status_code=404, detail="Results not found")
        
        return JobResultsResponse(
            job_id=job_id,
            status="completed",
            total_results=len(results),
            results=results
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/jobs")
async def list_jobs():
    """List all evaluation jobs"""
    try:
        jobs = evaluation_service.list_jobs()
        return {
            "jobs": jobs,
            "total": len(jobs)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/jobs/{job_id}")
async def delete_job(job_id: str):
    """Delete an evaluation job"""
    try:
        success = evaluation_service.delete_job(job_id)
        if not success:
            raise HTTPException(status_code=404, detail="Job not found")
        
        return {
            "job_id": job_id,
            "status": "deleted",
            "message": "Job deleted successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/models")
async def get_available_models():
    """Get available models from prediction service"""
    try:
        models = evaluation_service.get_available_models()
        return {
            "status": "success",
            "models": models,
            "total": len(models)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting available models: {str(e)}")

@router.get("/models/{model_id}")
async def get_model_details(model_id: str):
    """Get details of a specific model"""
    try:
        model = evaluation_service.get_model(model_id)
        if not model:
            raise HTTPException(status_code=404, detail="Model not found")
        
        return {
            "status": "success",
            "model": model.dict() if hasattr(model, 'dict') else model
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting model details: {str(e)}")

@router.get("/metrics/{job_id}")
async def get_job_accuracy_metrics(job_id: str):
    """Get accuracy metrics for an evaluation job"""
    try:
        metrics = evaluation_service.get_job_accuracy_metrics(job_id)
        if metrics is None:
            job = evaluation_service.get_job_status(job_id)
            if not job:
                raise HTTPException(status_code=404, detail="Job not found")
            elif job["status"] != "completed":
                raise HTTPException(status_code=400, detail=f"Job is not completed. Current status: {job['status']}")
            elif not job.get("mapping", {}).get("output_columns"):
                raise HTTPException(status_code=400, detail="Job does not have output column mapping for accuracy calculation")
            else:
                raise HTTPException(status_code=404, detail="Accuracy metrics not available")
        
        return {
            "status": "success",
            "job_id": job_id,
            "metrics": metrics
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting accuracy metrics: {str(e)}")
