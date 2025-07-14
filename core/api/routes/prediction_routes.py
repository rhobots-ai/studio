"""
API routes for prediction functionality.
"""

from fastapi import APIRouter, HTTPException, Query
from typing import Optional, List
from datetime import datetime

from models.prediction_models import (
    StartPredictionRequest, PredictionJobResponse, ModelListResponse,
    PredictionStatusResponse, PredictionResultsResponse, PredictionJobsListResponse,
    MappingValidationRequest, MappingValidationResponse, ModelStatsResponse,
    CancelJobRequest, CancelJobResponse, DeleteJobResponse,
    PredictionOverviewResponse, ModelInfo, PredictionJob
)
from services.prediction_service import prediction_service

router = APIRouter(prefix="/api/predictions", tags=["predictions"])


@router.get("/models", response_model=ModelListResponse)
async def get_available_models():
    """Get list of available trained models for prediction"""
    try:
        models = prediction_service.get_available_models()
        
        return ModelListResponse(
            success=True,
            models=models,
            total=len(models)
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting available models: {str(e)}")


@router.get("/models/{model_id}")
async def get_model_details(model_id: str):
    """Get details of a specific model"""
    try:
        model = prediction_service.get_model(model_id)
        if not model:
            raise HTTPException(status_code=404, detail="Model not found")
        
        return {
            "success": True,
            "model": model
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting model details: {str(e)}")


@router.post("/start", response_model=PredictionJobResponse)
async def start_prediction(request: StartPredictionRequest):
    """Start a new prediction job"""
    try:
        job = await prediction_service.start_prediction(
            file_id=request.file_id,
            model_id=request.model_id,
            mapping=request.mapping,
            job_name=request.job_name,
            description=request.description
        )
        
        if not job:
            raise HTTPException(status_code=400, detail="Failed to start prediction job")
        
        return PredictionJobResponse(
            success=True,
            job_id=job.job_id,
            message=f"Prediction job '{job.job_name}' started successfully",
            job=job
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error starting prediction: {str(e)}")


@router.get("/jobs/{job_id}/status", response_model=PredictionStatusResponse)
async def get_prediction_status(job_id: str):
    """Get status of a prediction job"""
    try:
        job = prediction_service.get_prediction_job(job_id)
        if not job:
            raise HTTPException(status_code=404, detail="Prediction job not found")
        
        return PredictionStatusResponse(
            success=True,
            job=job
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting prediction status: {str(e)}")


@router.get("/jobs/{job_id}/results", response_model=PredictionResultsResponse)
async def get_prediction_results(
    job_id: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=1000)
):
    """Get results of a completed prediction job"""
    try:
        job = prediction_service.get_prediction_job(job_id)
        if not job:
            raise HTTPException(status_code=404, detail="Prediction job not found")
        
        if job.status != "completed":
            raise HTTPException(status_code=400, detail="Prediction job is not completed yet")
        
        # Load results if not already loaded
        if not job.results:
            job.results = prediction_service._load_job_results(job_id)
        
        # Paginate results
        start_idx = (page - 1) * page_size
        end_idx = start_idx + page_size
        paginated_results = job.results[start_idx:end_idx] if job.results else []
        
        total_results = len(job.results) if job.results else 0
        has_more = end_idx < total_results
        
        return PredictionResultsResponse(
            success=True,
            job_id=job_id,
            results=paginated_results,
            total_results=total_results,
            page=page,
            page_size=page_size,
            has_more=has_more
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting prediction results: {str(e)}")


@router.get("/jobs/{job_id}/download")
async def download_prediction_results(
    job_id: str,
    format: str = Query("csv", regex="^(csv|json)$")
):
    """Download prediction results as CSV or JSON"""
    try:
        from fastapi.responses import StreamingResponse
        import io
        import csv
        import json
        
        job = prediction_service.get_prediction_job(job_id)
        if not job:
            raise HTTPException(status_code=404, detail="Prediction job not found")
        
        if job.status != "completed":
            raise HTTPException(status_code=400, detail="Prediction job is not completed yet")
        
        # Load results if not already loaded
        if not job.results:
            job.results = prediction_service._load_job_results(job_id)
        
        if not job.results:
            raise HTTPException(status_code=404, detail="No results found for this job")
        
        if format == "csv":
            # Generate CSV
            output = io.StringIO()
            writer = csv.writer(output)
            
            # Write header
            headers = ["row_index", "prediction", "confidence", "processing_time_ms"]
            # Add input data columns
            if job.results:
                input_keys = list(job.results[0].input_data.keys())
                headers.extend([f"input_{key}" for key in input_keys])
            writer.writerow(headers)
            
            # Write data
            for result in job.results:
                row = [
                    result.row_index,
                    json.dumps(result.prediction) if isinstance(result.prediction, dict) else str(result.prediction),
                    result.confidence or "",
                    result.processing_time_ms or ""
                ]
                # Add input data
                for key in input_keys:
                    row.append(result.input_data.get(key, ""))
                writer.writerow(row)
            
            output.seek(0)
            
            return StreamingResponse(
                io.BytesIO(output.getvalue().encode()),
                media_type="text/csv",
                headers={"Content-Disposition": f"attachment; filename=prediction_results_{job_id}.csv"}
            )
        
        else:  # JSON format
            results_data = {
                "job_id": job_id,
                "job_name": job.job_name,
                "model_id": job.model_id,
                "created_at": job.created_at.isoformat(),
                "completed_at": job.completed_at.isoformat() if job.completed_at else None,
                "total_results": len(job.results),
                "results": [result.dict() for result in job.results]
            }
            
            json_str = json.dumps(results_data, indent=2, default=str)
            
            return StreamingResponse(
                io.BytesIO(json_str.encode()),
                media_type="application/json",
                headers={"Content-Disposition": f"attachment; filename=prediction_results_{job_id}.json"}
            )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error downloading results: {str(e)}")


@router.get("/jobs", response_model=PredictionJobsListResponse)
async def get_prediction_jobs(
    status: Optional[str] = Query(None),
    model_id: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=1000)
):
    """Get list of prediction jobs with optional filtering"""
    try:
        jobs = prediction_service.get_prediction_jobs(
            status=status,
            model_id=model_id,
            limit=page_size * 10  # Get more to handle pagination
        )
        
        # Paginate
        start_idx = (page - 1) * page_size
        end_idx = start_idx + page_size
        paginated_jobs = jobs[start_idx:end_idx]
        
        total_jobs = len(jobs)
        has_more = end_idx < total_jobs
        
        return PredictionJobsListResponse(
            success=True,
            jobs=paginated_jobs,
            total=total_jobs,
            page=page,
            page_size=page_size,
            has_more=has_more
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting prediction jobs: {str(e)}")


@router.post("/jobs/{job_id}/cancel", response_model=CancelJobResponse)
async def cancel_prediction_job(job_id: str, request: CancelJobRequest = None):
    """Cancel a running prediction job"""
    try:
        success = prediction_service.cancel_prediction_job(job_id)
        if not success:
            raise HTTPException(status_code=400, detail="Cannot cancel this job")
        
        return CancelJobResponse(
            success=True,
            message="Prediction job cancelled successfully",
            job_id=job_id
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error cancelling prediction job: {str(e)}")


@router.delete("/jobs/{job_id}", response_model=DeleteJobResponse)
async def delete_prediction_job(job_id: str):
    """Delete a prediction job and its results"""
    try:
        success = prediction_service.delete_prediction_job(job_id)
        if not success:
            raise HTTPException(status_code=404, detail="Prediction job not found")
        
        return DeleteJobResponse(
            success=True,
            message="Prediction job deleted successfully",
            job_id=job_id
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error deleting prediction job: {str(e)}")


@router.post("/validate-mapping", response_model=MappingValidationResponse)
async def validate_column_mapping(request: MappingValidationRequest):
    """Validate column mapping for a model"""
    try:
        validation = prediction_service.validate_mapping(
            model_id=request.model_id,
            file_id=request.file_id,
            mapping=request.mapping
        )
        
        return MappingValidationResponse(
            success=True,
            validation=validation
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error validating mapping: {str(e)}")


@router.get("/models/{model_id}/stats", response_model=ModelStatsResponse)
async def get_model_prediction_stats(model_id: str):
    """Get prediction statistics for a model"""
    try:
        # Get model info
        model = prediction_service.get_model(model_id)
        if not model:
            raise HTTPException(status_code=404, detail="Model not found")
        
        # Get jobs for this model
        jobs = prediction_service.get_prediction_jobs(model_id=model_id, limit=1000)
        
        # Calculate statistics
        completed_jobs = [job for job in jobs if job.status == "completed"]
        total_predictions = sum(job.total_rows for job in completed_jobs)
        
        # Calculate averages
        avg_confidence = None
        avg_processing_time = None
        
        if completed_jobs:
            confidences = []
            processing_times = []
            
            for job in completed_jobs:
                if job.results:
                    for result in job.results:
                        if result.confidence is not None:
                            confidences.append(result.confidence)
                        if result.processing_time_ms is not None:
                            processing_times.append(result.processing_time_ms)
            
            if confidences:
                avg_confidence = sum(confidences) / len(confidences)
            if processing_times:
                avg_processing_time = sum(processing_times) / len(processing_times)
        
        success_rate = len(completed_jobs) / len(jobs) if jobs else 0.0
        recent_jobs = jobs[:5]  # Most recent 5 jobs
        
        from models.prediction_models import ModelPredictionStats
        stats = ModelPredictionStats(
            total_predictions=total_predictions,
            avg_confidence=avg_confidence,
            avg_processing_time=avg_processing_time,
            success_rate=success_rate,
            recent_jobs=recent_jobs
        )
        
        return ModelStatsResponse(
            success=True,
            model_id=model_id,
            stats=stats
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting model stats: {str(e)}")


@router.get("/overview", response_model=PredictionOverviewResponse)
async def get_prediction_overview():
    """Get overview of all prediction activity"""
    try:
        jobs = prediction_service.get_prediction_jobs(limit=1000)
        
        total_jobs = len(jobs)
        active_jobs = len([job for job in jobs if job.status in ["pending", "running"]])
        completed_jobs = len([job for job in jobs if job.status == "completed"])
        failed_jobs = len([job for job in jobs if job.status == "failed"])
        
        total_predictions = sum(job.total_rows for job in jobs if job.status == "completed")
        
        # Calculate average processing time
        avg_processing_time = None
        processing_times = []
        
        for job in jobs:
            if job.status == "completed" and job.results:
                for result in job.results:
                    if result.processing_time_ms is not None:
                        processing_times.append(result.processing_time_ms)
        
        if processing_times:
            avg_processing_time = sum(processing_times) / len(processing_times)
        
        # Count unique models used
        models_used = len(set(job.model_id for job in jobs))
        
        # Recent activity (last 10 jobs)
        recent_activity = jobs[:10]
        
        from models.prediction_models import PredictionOverview
        overview = PredictionOverview(
            total_jobs=total_jobs,
            active_jobs=active_jobs,
            completed_jobs=completed_jobs,
            failed_jobs=failed_jobs,
            total_predictions=total_predictions,
            avg_processing_time=avg_processing_time,
            models_used=models_used,
            recent_activity=recent_activity
        )
        
        return PredictionOverviewResponse(
            success=True,
            overview=overview
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting prediction overview: {str(e)}")
