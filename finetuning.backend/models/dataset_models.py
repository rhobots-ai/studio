"""
Dataset management models for processed training datasets.
"""

from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
from datetime import datetime
from models.file_models import ColumnMapping, TrainingExample



class ProcessingStats(BaseModel):
    """Statistics from dataset processing"""
    total_input_rows: int = Field(..., description="Total rows in source file")
    valid_output_rows: int = Field(..., description="Valid training examples generated")
    skipped_rows: int = Field(..., description="Rows that couldn't be processed")
    success_rate: float = Field(..., description="Percentage of successful conversions")
    instruction_stats: Dict[str, float] = Field(..., description="Instruction length statistics")
    output_types: Dict[str, int] = Field(..., description="Output format type counts")
    column_usage: Dict[str, int] = Field(..., description="Column usage statistics")


class ProcessedDataset(BaseModel):
    """A processed dataset ready for training"""
    dataset_id: str = Field(..., description="Unique dataset identifier")
    name: str = Field(..., description="User-friendly dataset name")
    description: Optional[str] = Field(default="", description="Dataset description")
    
    # Source information
    source_file_id: str = Field(..., description="Original file ID")
    source_filename: str = Field(..., description="Original filename")
    
    # Processing configuration
    column_mapping: ColumnMapping = Field(..., description="Column mapping used")
    
    # Dataset statistics
    total_examples: int = Field(..., description="Total training examples")
    processing_stats: ProcessingStats = Field(..., description="Processing statistics")
    
    # Storage information
    file_path: str = Field(..., description="Path to stored dataset file")
    file_size: int = Field(..., description="Dataset file size in bytes")
    
    # Metadata
    created_at: str = Field(..., description="Creation timestamp")
    last_modified: str = Field(..., description="Last modification timestamp")
    created_by: Optional[str] = Field(default=None, description="User who created the dataset")
    tags: List[str] = Field(default=[], description="Dataset tags")
    
    # Usage tracking
    usage_count: int = Field(default=0, description="Number of times used in training")
    last_used: Optional[str] = Field(default=None, description="Last usage timestamp")


class DatasetCreateRequest(BaseModel):
    """Request to create a new dataset"""
    name: str = Field(..., description="Dataset name")
    description: Optional[str] = Field(default="", description="Dataset description")
    source_file_id: str = Field(..., description="Source file ID")
    column_mapping: ColumnMapping = Field(..., description="Column mapping configuration")
    tags: Optional[List[str]] = Field(default=[], description="Dataset tags")


class DatasetUpdateRequest(BaseModel):
    """Request to update dataset metadata"""
    name: Optional[str] = Field(default=None, description="New dataset name")
    description: Optional[str] = Field(default=None, description="New dataset description")
    tags: Optional[List[str]] = Field(default=None, description="New dataset tags")


class DatasetCreateResponse(BaseModel):
    """Response for dataset creation"""
    success: bool = Field(..., description="Whether creation was successful")
    dataset_id: Optional[str] = Field(default=None, description="Created dataset ID")
    message: str = Field(..., description="Status message")
    dataset: Optional[ProcessedDataset] = Field(default=None, description="Created dataset details")


class DatasetListResponse(BaseModel):
    """Response for dataset listing"""
    datasets: List[ProcessedDataset] = Field(..., description="List of datasets")
    total: int = Field(..., description="Total number of datasets")
    storage_stats: Dict[str, Any] = Field(..., description="Storage statistics")


class DatasetPreviewResponse(BaseModel):
    """Response for dataset preview"""
    success: bool = Field(..., description="Whether preview was successful")
    dataset_id: str = Field(..., description="Dataset identifier")
    preview_data: List[TrainingExample] = Field(..., description="Sample training examples")
    total_examples: int = Field(..., description="Total examples in dataset")
    showing_examples: int = Field(..., description="Number of examples in preview")


class DatasetUsageResponse(BaseModel):
    """Response for dataset usage tracking"""
    success: bool = Field(..., description="Whether usage tracking was successful")
    dataset_id: str = Field(..., description="Dataset identifier")
    usage_count: int = Field(..., description="Updated usage count")
    last_used: str = Field(..., description="Last usage timestamp")


class DatasetTemplate(BaseModel):
    """Reusable dataset template"""
    template_id: str = Field(..., description="Unique template identifier")
    name: str = Field(..., description="Template name")
    description: str = Field(..., description="Template description")
    column_mapping: ColumnMapping = Field(..., description="Column mapping configuration")
    use_cases: List[str] = Field(..., description="Common use cases")
    created_at: str = Field(..., description="Creation timestamp")
    usage_count: int = Field(default=0, description="Number of times used")


class DatasetTemplateListResponse(BaseModel):
    """Response for listing dataset templates"""
    templates: List[DatasetTemplate] = Field(..., description="Available templates")
    total: int = Field(..., description="Total number of templates")
