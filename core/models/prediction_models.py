"""
Pydantic models for prediction functionality.
"""

from pydantic import BaseModel, Field
from typing import Dict, List, Any, Optional, Union
from datetime import datetime
from enum import Enum


class PredictionStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class ModelStatus(str, Enum):
    READY = "ready"
    LOADING = "loading"
    ERROR = "error"
    UNAVAILABLE = "unavailable"


class PreprocessingOptions(BaseModel):
    normalize_text: bool = True
    handle_missing_values: str = Field(default="default", pattern="^(skip|default|error)$")
    default_values: Dict[str, Any] = Field(default_factory=dict)
    batch_size: Optional[int] = Field(default=32, ge=1, le=1000)


class PredictionMapping(BaseModel):
    input_columns: Dict[str, str] = Field(
        description="Maps model input fields to file columns"
    )
    preprocessing_options: PreprocessingOptions = Field(
        default_factory=PreprocessingOptions
    )


class ModelInfo(BaseModel):
    model_id: str
    name: str
    description: str
    input_schema: Dict[str, Any]
    output_schema: Dict[str, Any]
    created_at: datetime
    accuracy: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    status: ModelStatus = ModelStatus.READY
    training_session_id: Optional[str] = None
    model_type: Optional[str] = None
    version: Optional[str] = None
    model_path: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict)
    base_model: str


class PredictionResult(BaseModel):
    row_index: int = Field(ge=0)
    input_data: Dict[str, Any]
    prediction: Any
    confidence: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    processing_time_ms: Optional[float] = Field(default=None, ge=0.0)
    model_version: Optional[str] = None
    error_message: Optional[str] = None


class PredictionJob(BaseModel):
    job_id: str
    model_id: str
    file_id: str
    status: PredictionStatus = PredictionStatus.PENDING
    progress: float = Field(default=0.0, ge=0.0, le=100.0)
    total_rows: int = Field(ge=0)
    processed_rows: int = Field(default=0, ge=0)
    results: Optional[List[PredictionResult]] = None
    error_message: Optional[str] = None
    created_at: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    estimated_completion: Optional[datetime] = None
    job_name: Optional[str] = None
    description: Optional[str] = None
    mapping: PredictionMapping
    created_by: Optional[str] = None


class StartPredictionRequest(BaseModel):
    file_id: str
    model_id: str
    mapping: PredictionMapping
    job_name: Optional[str] = None
    description: Optional[str] = None


class PredictionJobResponse(BaseModel):
    success: bool
    job_id: Optional[str] = None
    message: str
    job: Optional[PredictionJob] = None


class ModelListResponse(BaseModel):
    success: bool
    models: List[ModelInfo]
    total: int


class PredictionStatusResponse(BaseModel):
    success: bool
    job: PredictionJob



class PredictionResultsResponse(BaseModel):
    success: bool
    job_id: str
    results: List[PredictionResult]
    total_results: int
    page: int = Field(ge=1)
    page_size: int = Field(ge=1, le=1000)
    has_more: bool


class PredictionJobsListResponse(BaseModel):
    success: bool
    jobs: List[PredictionJob]
    total: int
    page: int = Field(ge=1)
    page_size: int = Field(ge=1, le=1000)
    has_more: bool


class ValidationResult(BaseModel):
    is_valid: bool
    issues: List[str] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)
    sample_preview: Optional[List[PredictionResult]] = None


class MappingValidationRequest(BaseModel):
    model_id: str
    file_id: str
    mapping: PredictionMapping


class MappingValidationResponse(BaseModel):
    success: bool
    validation: ValidationResult


class ModelPredictionStats(BaseModel):
    total_predictions: int = Field(ge=0)
    avg_confidence: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    avg_processing_time: Optional[float] = Field(default=None, ge=0.0)
    success_rate: float = Field(ge=0.0, le=1.0)
    recent_jobs: List[PredictionJob] = Field(default_factory=list)
    predictions_by_day: Optional[Dict[str, int]] = Field(default_factory=dict)


class ModelStatsResponse(BaseModel):
    success: bool
    model_id: str
    stats: ModelPredictionStats


class CancelJobRequest(BaseModel):
    reason: Optional[str] = None


class CancelJobResponse(BaseModel):
    success: bool
    message: str
    job_id: str


class DeleteJobResponse(BaseModel):
    success: bool
    message: str
    job_id: str


class PredictionOverview(BaseModel):
    total_jobs: int = Field(ge=0)
    active_jobs: int = Field(ge=0)
    completed_jobs: int = Field(ge=0)
    failed_jobs: int = Field(ge=0)
    total_predictions: int = Field(ge=0)
    avg_processing_time: Optional[float] = Field(default=None, ge=0.0)
    models_used: int = Field(ge=0)
    recent_activity: List[PredictionJob] = Field(default_factory=list)


class PredictionOverviewResponse(BaseModel):
    success: bool
    overview: PredictionOverview


# Error response models
class PredictionError(BaseModel):
    error_code: str
    message: str
    details: Optional[Dict[str, Any]] = None


class PredictionErrorResponse(BaseModel):
    success: bool = False
    error: PredictionError
