"""
File management models with enhanced multi-column mapping support.
"""

from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List, Union
from enum import Enum


class ColumnRole(str, Enum):
    """Column role in training data"""
    PRIMARY = "primary"
    CONTEXT = "context"
    METADATA = "metadata"


class ColumnFormat(str, Enum):
    """Column formatting options"""
    TEXT = "text"
    JSON = "json"
    LIST = "list"
    TABLE = "table"


class ColumnConfig(BaseModel):
    """Configuration for a single column in the mapping"""
    column_name: str = Field(..., description="Name of the column in the source data")
    target_field: Optional[str] = Field(default=None, description="Target field name in JSON output (if different from column_name)")
    role: ColumnRole = Field(default=ColumnRole.PRIMARY, description="Role of this column")
    weight: Optional[float] = Field(default=1.0, ge=0, le=10, description="Importance weight (0-10)")
    format_type: ColumnFormat = Field(default=ColumnFormat.TEXT, description="How to format this column")
    custom_template: Optional[str] = Field(default=None, description="Custom formatting template")
    parse_json: bool = Field(default=False, description="Whether to parse this column as JSON")
    
    def get_target_field(self) -> str:
        """Get the target field name, defaulting to column_name if not specified"""
        return self.target_field if self.target_field else self.column_name


class ColumnMapping(BaseModel):
    """Enhanced multi-column mapping configuration"""
    # Static instruction text (optional)
    static_instruction: Optional[str] = Field(default="", description="Static instruction text to prepend")
    
    # Instruction columns and template
    instruction_columns: List[ColumnConfig] = Field(default=[], description="Columns that form the instruction")
    instruction_template: str = Field(default="", description="Template for combining instruction columns")
    
    # Input columns (for context JSON object)
    input_columns: List[ColumnConfig] = Field(default=[], description="Columns that form the input context")
    
    # Output columns (can be single string or JSON object)
    output_columns: List[ColumnConfig] = Field(..., description="Columns that form the output")
    output_template: str = Field(default="", description="Template for combining output columns")
    
    # Optional: columns to ignore
    ignored_columns: Optional[List[str]] = Field(default=[], description="Columns to ignore")
    
    # Metadata
    mapping_name: Optional[str] = Field(default=None, description="Name for this mapping configuration")
    description: Optional[str] = Field(default=None, description="Description of this mapping")
    created_at: Optional[str] = Field(default=None, description="When this mapping was created")


class ValidationDetails(BaseModel):
    """Enhanced validation details with column mapping support"""
    status: str = Field(..., description="Validation status")
    total_rows: int = Field(..., description="Total number of rows")
    columns: List[str] = Field(..., description="List of all columns in the file")
    file_type: str = Field(..., description="Type of file (CSV, JSON, JSONL)")
    sample_data: List[Dict[str, Any]] = Field(..., description="Sample rows from the file")
    null_counts: Dict[str, int] = Field(default={}, description="Null value counts per column")
    issues: List[str] = Field(default=[], description="List of validation issues")
    
    # Column information (no AI suggestions)
    column_types: Optional[Dict[str, str]] = Field(default={}, description="Detected data types for each column")
    column_stats: Optional[Dict[str, Dict[str, Any]]] = Field(default={}, description="Statistics for each column")


class FileMetadata(BaseModel):
    """Enhanced file metadata with column mapping support"""
    file_id: str = Field(..., description="Unique file identifier")
    display_name: str = Field(..., description="User-friendly display name")
    original_filename: str = Field(..., description="Original filename when uploaded")
    stored_filename: str = Field(..., description="Filename as stored on disk")
    file_type: str = Field(..., description="File type (csv, json, jsonl)")
    file_size: int = Field(..., description="File size in bytes")
    upload_date: str = Field(..., description="Upload timestamp")
    last_used: Optional[str] = Field(default=None, description="Last usage timestamp")
    usage_count: int = Field(default=0, description="Number of times used in training")
    
    # Validation information
    validation_status: str = Field(..., description="Validation status (valid, invalid, pending)")
    validation_details: ValidationDetails = Field(..., description="Detailed validation results")
    
    # Column mapping fields
    column_mapping: Optional[ColumnMapping] = Field(default=None, description="Column mapping configuration")
    has_mapping: bool = Field(default=False, description="Whether this file has a column mapping")
    
    # Metadata
    tags: List[str] = Field(default=[], description="User-defined tags")
    used_in_sessions: List[str] = Field(default=[], description="Training sessions that used this file")


class FileUploadResponse(BaseModel):
    """Response for file upload operations"""
    success: bool = Field(..., description="Whether the upload was successful")
    file_id: Optional[str] = Field(default=None, description="ID of the uploaded file")
    message: str = Field(..., description="Status message")
    metadata: Optional[FileMetadata] = Field(default=None, description="File metadata if successful")


class FileListResponse(BaseModel):
    """Response for file listing operations"""
    files: List[FileMetadata] = Field(..., description="List of files")
    total: int = Field(..., description="Total number of files")
    storage_stats: Dict[str, Any] = Field(..., description="Storage statistics")


class FilePreviewResponse(BaseModel):
    """Response for file preview operations"""
    success: bool = Field(..., description="Whether the preview was successful")
    file_id: str = Field(..., description="File identifier")
    preview_data: List[Dict[str, Any]] = Field(..., description="Preview data rows")
    total_rows: int = Field(..., description="Total rows in file")
    showing_rows: int = Field(..., description="Number of rows in preview")
    columns: List[str] = Field(..., description="Column names")


class ColumnMappingRequest(BaseModel):
    """Request to save column mapping"""
    file_id: str = Field(..., description="File identifier")
    column_mapping: ColumnMapping = Field(..., description="Column mapping configuration")


class ColumnMappingResponse(BaseModel):
    """Response for column mapping operations"""
    success: bool = Field(..., description="Whether the operation was successful")
    message: str = Field(..., description="Status message")
    file_id: str = Field(..., description="File identifier")
    validation_status: Optional[str] = Field(default=None, description="Updated validation status")


class MappedPreviewRequest(BaseModel):
    """Request for preview with applied mapping"""
    file_id: str = Field(..., description="File identifier")
    column_mapping: ColumnMapping = Field(..., description="Column mapping to apply")
    limit: Optional[int] = Field(default=10, ge=1, le=100, description="Number of rows to preview")


class TrainingExample(BaseModel):
    """Single training example with flexible input/output types"""
    instruction: str = Field(..., description="The instruction text")
    input: Union[str, Dict[str, Any]] = Field(..., description="Input context (string or JSON object)")
    output: Union[str, Dict[str, Any]] = Field(..., description="Expected output (string or JSON object)")


class MappedPreviewResponse(BaseModel):
    """Response for mapped preview"""
    success: bool = Field(..., description="Whether the preview was successful")
    file_id: str = Field(..., description="File identifier")
    preview_data: List[TrainingExample] = Field(..., description="Mapped preview data")
    total_rows: int = Field(..., description="Total rows that would be processed")
    showing_rows: int = Field(..., description="Number of rows in preview")
    mapping_applied: ColumnMapping = Field(..., description="The mapping that was applied")


class ProcessedFileResponse(BaseModel):
    """Response for complete file processing"""
    success: bool = Field(..., description="Whether processing was successful")
    file_id: str = Field(..., description="Source file identifier")
    processed_data: List[TrainingExample] = Field(..., description="All processed training examples")
    total_examples: int = Field(..., description="Total number of training examples generated")
    processing_stats: Dict[str, Any] = Field(..., description="Processing statistics")


class MappingTemplate(BaseModel):
    """Reusable column mapping template"""
    template_id: str = Field(..., description="Unique template identifier")
    name: str = Field(..., description="Template name")
    description: str = Field(..., description="Template description")
    use_cases: List[str] = Field(..., description="Common use cases for this template")
    column_mapping: ColumnMapping = Field(..., description="The mapping configuration")
    created_at: str = Field(..., description="Creation timestamp")
    usage_count: int = Field(default=0, description="Number of times this template was used")


class MappingTemplateListResponse(BaseModel):
    """Response for listing mapping templates"""
    templates: List[MappingTemplate] = Field(..., description="Available templates")
    total: int = Field(..., description="Total number of templates")
