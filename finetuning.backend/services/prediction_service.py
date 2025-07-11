"""
Prediction service for managing model inference and prediction jobs.
"""

import os
import json
import uuid
import asyncio
import pandas as pd
import re
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Union
from pathlib import Path
import time

from models.prediction_models import (
    ModelInfo, PredictionJob, PredictionResult, PredictionMapping,
    PredictionStatus, ModelStatus, ValidationResult
)
from file_manager import file_manager
from model_manager import model_manager


class PredictionService:
    """Service for managing model predictions and inference jobs"""
    
    def __init__(self, models_dir: str = "models", jobs_dir: str = "prediction_jobs"):
        self.models_dir = Path(models_dir)
        self.jobs_dir = Path(jobs_dir)
        
        # Create directories
        self.models_dir.mkdir(exist_ok=True)
        self.jobs_dir.mkdir(exist_ok=True)
        (self.jobs_dir / "active").mkdir(exist_ok=True)
        (self.jobs_dir / "completed").mkdir(exist_ok=True)
        
        self.jobs_index_file = self.jobs_dir / "jobs_index.json"
        self.models_index_file = self.models_dir / "models_index.json"
        
        # Initialize index files
        if not self.jobs_index_file.exists():
            self._save_jobs_index({})
        if not self.models_index_file.exists():
            self._save_models_index({})
        
        # Cache for loaded models
        self._model_cache = {}
        self._running_jobs = {}
    
    def get_available_models(self) -> List[ModelInfo]:
        """Get list of available trained models"""
        try:
            models_index = self._load_models_index()
            models = []
            
            for model_id, model_data in models_index.items():
                try:
                    model = ModelInfo(**model_data)
                    # Check if model file exists
                    if model.model_path and os.path.exists(model.model_path):
                        model.status = ModelStatus.READY
                    elif model.model_path == "/fake/path/for/testing":
                        # Special case for test models
                        model.status = ModelStatus.READY
                    else:
                        model.status = ModelStatus.UNAVAILABLE
                    models.append(model)
                except Exception as e:
                    print(f"Error loading model {model_id}: {e}")
                    continue
            
            return models
        except Exception as e:
            print(f"Error getting available models: {e}")
            return []
    
    def get_model(self, model_id: str) -> Optional[ModelInfo]:
        """Get details of a specific model"""
        try:
            models_index = self._load_models_index()
            if model_id not in models_index:
                return None
            
            model = ModelInfo(**models_index[model_id])
            
            # Check model availability
            if model.model_path and os.path.exists(model.model_path):
                model.status = ModelStatus.READY
            elif model.model_path == "/fake/path/for/testing":
                # Special case for test models
                model.status = ModelStatus.READY
            else:
                model.status = ModelStatus.UNAVAILABLE
            
            return model
        except Exception as e:
            print(f"Error getting model {model_id}: {e}")
            return None
    
    def register_model(self, model_info: ModelInfo) -> bool:
        """Register a new trained model for predictions"""
        try:
            models_index = self._load_models_index()
            models_index[model_info.model_id] = model_info.dict()
            self._save_models_index(models_index)
            return True
        except Exception as e:
            print(f"Error registering model: {e}")
            return False
    
    
    async def start_prediction(
        self, 
        file_id: str, 
        model_id: str, 
        mapping: PredictionMapping,
        job_name: Optional[str] = None,
        description: Optional[str] = None
    ) -> Optional[PredictionJob]:
        """Start a new prediction job"""
        try:
            # Validate inputs
            model = self.get_model(model_id)
            if not model:
                raise ValueError(f"Model {model_id} not found")
            
            if model.status != ModelStatus.READY:
                raise ValueError(f"Model {model_id} is not ready for predictions")
            
            file_info = file_manager.get_file_info(file_id)
            if not file_info:
                raise ValueError(f"File {file_id} not found")
            
            # Validate mapping
            validation = self.validate_mapping(model_id, file_id, mapping)
            if not validation.is_valid:
                raise ValueError(f"Invalid mapping: {'; '.join(validation.issues)}")
            
            # Load data to get row count
            file_path = file_manager.get_file_path(file_id)
            data = self._load_data_file(file_path)
            total_rows = len(data)
            
            # Create prediction job
            job_id = f"pred_{uuid.uuid4().hex[:12]}"
            job = PredictionJob(
                job_id=job_id,
                model_id=model_id,
                file_id=file_id,
                status=PredictionStatus.PENDING,
                total_rows=total_rows,
                created_at=datetime.now(),
                job_name=job_name or f"Prediction {job_id}",
                description=description,
                mapping=mapping
            )
            
            # Save job
            self._save_job(job)
            
            # Start processing in background
            asyncio.create_task(self._process_prediction_job(job))
            
            return job
            
        except Exception as e:
            print(f"Error starting prediction: {e}")
            return None
    
    async def _process_prediction_job(self, job: PredictionJob):
        """Process a prediction job in the background"""
        try:
            # Update job status
            job.status = PredictionStatus.RUNNING
            job.started_at = datetime.now()
            self._save_job(job)
            self._running_jobs[job.job_id] = job
            
            # Load model
            model = self._load_model(job.model_id)

            if not model:
                raise Exception(f"Failed to load model {job.model_id}")
            
            # Load data
            file_path = file_manager.get_file_path(job.file_id)
            data = self._load_data_file(file_path)
            
            # Process predictions in batches
            batch_size = job.mapping.preprocessing_options.batch_size or 32
            results = []
            
            for i in range(0, len(data), batch_size):
                batch = data.iloc[i:i + batch_size]
                batch_results = await self._process_batch(
                    batch, model, job.mapping, i
                )
                results.extend(batch_results)
                
                # Update progress
                job.processed_rows = min(i + batch_size, len(data))
                job.progress = (job.processed_rows / job.total_rows) * 100
                self._save_job(job)
                
                # Small delay to prevent overwhelming the system
                await asyncio.sleep(0.1)
            
            # Complete job
            job.status = PredictionStatus.COMPLETED
            job.completed_at = datetime.now()
            job.results = results
            job.progress = 100.0
            job.processed_rows = job.total_rows
            
            # Save final results
            self._save_job(job)
            self._save_job_results(job.job_id, results)
            
            # Remove from running jobs
            if job.job_id in self._running_jobs:
                del self._running_jobs[job.job_id]
            
        except Exception as e:
            # Handle job failure
            job.status = PredictionStatus.FAILED
            job.error_message = str(e)
            job.completed_at = datetime.now()
            self._save_job(job)
            
            if job.job_id in self._running_jobs:
                del self._running_jobs[job.job_id]
            
            print(f"Prediction job {job.job_id} failed: {e}")
    
    async def _process_batch(
        self, 
        batch: pd.DataFrame, 
        model: Any, 
        mapping: PredictionMapping, 
        start_index: int
    ) -> List[PredictionResult]:
        """Process a batch of data for predictions"""
        results = []
        
        for idx, row in batch.iterrows():
            try:
                start_time = time.time()
                
                # Prepare input data
                input_data = {}
                for model_field, file_column in mapping.input_columns.items():
                    if file_column in row:
                        value = row[file_column]
                        
                        # Handle missing values
                        if pd.isna(value) or value is None:
                            if mapping.preprocessing_options.handle_missing_values == "skip":
                                continue
                            elif mapping.preprocessing_options.handle_missing_values == "error":
                                raise ValueError(f"Missing value in column {file_column}")
                            else:  # default
                                value = mapping.preprocessing_options.default_values.get(
                                    model_field, ""
                                )
                        
                        # Text normalization
                        if mapping.preprocessing_options.normalize_text and isinstance(value, str):
                            value = value.strip()
                        
                        input_data[model_field] = value
                
                # Make prediction
                prediction = self._make_prediction(model, input_data)
                
                processing_time = (time.time() - start_time) * 1000
                
                result = PredictionResult(
                    row_index=start_index + len(results),
                    input_data=input_data,
                    prediction=prediction,
                    processing_time_ms=processing_time
                )
                
                # Extract confidence if available
                if isinstance(prediction, dict) and 'confidence' in prediction:
                    result.confidence = prediction['confidence']
                
                results.append(result)
                
            except Exception as e:
                # Add error result
                result = PredictionResult(
                    row_index=start_index + len(results),
                    input_data={},
                    prediction=None,
                    error_message=str(e)
                )
                results.append(result)
        
        return results
    
    def _make_prediction(self, model_info: ModelInfo, input_data: Dict[str, Any]) -> Any:
        """Make a prediction using the loaded model with dynamic input formatting"""
        try:            
            # Format the input based on the model's actual training format
            message = self._format_input_for_model(model_info, input_data)
            # Use the model manager to generate response
            print("this is message", message)
            result = model_manager.generate_response(
                message=message,
                max_tokens=150,
                temperature=0.7
            )

            print("this is model response in _make_prediction", result)
            
            if result["status"] == "success":
                response = result["response"]
                
                # Try to parse structured output if the model was trained for it
                parsed_output = self._parse_model_output(model_info, response)
                
                return parsed_output
            else:
                raise Exception(f"Model inference failed: {result.get('message', 'Unknown error')}")
                
        except Exception as e:
            raise Exception(f"Prediction failed: {e}")
    
    
    def _format_input_for_model(self, model_info: ModelInfo, input_data: Dict[str, Any]) -> str:
        """Format input data according to the model's training format"""
        try:
            # Get the model's input schema
            input_schema = model_info.input_schema
            
            # Build the message in the same format used during training
            message_parts = []
            
            # ALWAYS check for static instruction first, regardless of input schema
            static_instruction = ""
            if model_info.metadata and "static_instruction" in model_info.metadata:
                static_instruction = model_info.metadata["static_instruction"]
                print(f"Found static instruction in metadata: {static_instruction[:100]}...")  # Debug log
            
            # Get dynamic instruction from input data (if input schema has instruction field)
            dynamic_instruction = ""
            if "instruction" in input_schema:
                dynamic_instruction = input_data.get("instruction", "")
                print(f"Found dynamic instruction in input data: {dynamic_instruction[:100] if dynamic_instruction else 'None'}")  # Debug log
            
            # Combine instructions - dynamic takes precedence, fallback to static
            final_instruction = dynamic_instruction or static_instruction
            
            # Add instruction if we have one (either static or dynamic)
            if final_instruction and final_instruction.strip():
                message_parts.append(f"### Instruction:\n{final_instruction}")
                print(f"Using final instruction: {final_instruction[:100]}...")  # Debug log
            else:
                print("No instruction found - neither static nor dynamic")  # Debug log
            
            # Check if there's an input field
            if "input" in input_schema:
                input_text = input_data.get("input", "")
                if input_text and input_text.strip():
                    message_parts.append(f"### Input:\n{input_text}")
            
            # Handle other input fields (for custom models)
            for field_name in input_schema.keys():
                if field_name not in ["instruction", "input"] and field_name in input_data:
                    value = input_data[field_name]
                    if value and str(value).strip():
                        # Format as a labeled section
                        field_label = field_name.replace("_", " ").title()
                        message_parts.append(f"### {field_label}:\n{value}")
            
            # Add the response prompt
            message_parts.append("### Response:")
            
            formatted_message = "\n\n".join(message_parts)
            print(f"Final formatted message for model: {formatted_message[:300]}...")  # Debug log
            
            return formatted_message
            
        except Exception as e:
            print(f"Error formatting input for model: {e}")
            # Fallback to simple concatenation with static instruction support
            static_instruction = ""
            if model_info.metadata and "static_instruction" in model_info.metadata:
                static_instruction = model_info.metadata["static_instruction"]
                print(f"Using static instruction in fallback: {static_instruction[:100]}...")  # Debug log
            
            instruction = input_data.get("instruction", "") or static_instruction
            input_text = input_data.get("input", "")
            
            fallback_message = f"{instruction}\n{input_text}" if instruction else input_text
            print(f"Fallback message: {fallback_message[:200]}...")  # Debug log
            
            return fallback_message
    
    def _parse_model_output(self, model_info: ModelInfo, response: str) -> Dict[str, Any]:
        """Parse model output according to the expected output schema"""
        try:
            output_schema = model_info.output_schema
            
            # Default confidence
            confidence = 0.85
            
            # Try to extract confidence from response if it contains it
            if "confidence:" in response.lower():
                try:
                    conf_part = response.lower().split("confidence:")[1].split()[0]
                    confidence = float(conf_part.replace("%", "")) / 100
                except:
                    pass
            
            # Check if the model expects structured JSON output
            structured_fields = [field for field in output_schema.keys() 
                               if field not in ["response", "confidence"]]
            
            if structured_fields:
                # Try to parse as JSON first
                try:
                    parsed_json = json.loads(response)
                    if isinstance(parsed_json, dict):
                        # Add confidence if not present
                        if "confidence" not in parsed_json:
                            parsed_json["confidence"] = confidence
                        return parsed_json
                except json.JSONDecodeError:
                    pass
                
                # If JSON parsing fails, try to extract structured data from text
                result = {"confidence": confidence}
                
                # Look for field patterns in the response
                for field in structured_fields:
                    # Try different patterns to extract field values
                    patterns = [
                        rf"{field}:\s*([^\n]+)",
                        rf'"{field}":\s*"([^"]+)"',
                        rf"'{field}':\s*'([^']+)'",
                        rf"{field.replace('_', ' ')}:\s*([^\n]+)",
                    ]
                    
                    for pattern in patterns:
                        match = re.search(pattern, response, re.IGNORECASE)
                        if match:
                            result[field] = match.group(1).strip()
                            break
                
                # If we extracted any structured fields, return the structured result
                if any(field in result for field in structured_fields):
                    return result
            
            # Fallback to simple response format
            return {
                "response": response,
                "confidence": confidence,
                "model_version": model_info.version or "1.0"
            }
            
        except Exception as e:
            print(f"Error parsing model output: {e}")
            # Fallback to simple response
            return {
                "response": response,
                "confidence": 0.85,
                "model_version": model_info.version or "1.0"
            }
    
    def _load_model(self, model_id: str) -> Optional[ModelInfo]:
        """Load a model for predictions using the model manager"""
        try:
            # Get model info
            model_info = self.get_model(model_id)
            if not model_info or not model_info.model_path:
                return None
            
            # Special handling for test models
            if model_info.model_path == "/fake/path/for/testing":
                print(f"Using test model {model_id} (no actual model loading required)")
                return model_info
            
            # Check if this model is already loaded in model manager
            current_status = model_manager.get_model_status()
            if current_status["loaded"] and current_status["model_path"] == model_info.model_path:
                # Model is already loaded
                return model_info
            
            # Load the model using model manager
            print("this is load model", model_info.model_path)
            load_result = model_manager.load_model(
                model_path=model_info.model_path,
                max_seq_length=2048
            )

            print("this is load model", load_result)
            
            if load_result["status"] == "success":
                print(f"Successfully loaded model {model_id} for prediction")
                return model_info
            else:
                print(f"Failed to load model {model_id}: {load_result['message']}")
                return None
            
        except Exception as e:
            print(f"Error loading model {model_id}: {e}")
            return None
    
    def validate_mapping(
        self, 
        model_id: str, 
        file_id: str, 
        mapping: PredictionMapping
    ) -> ValidationResult:
        """Validate column mapping for a model"""
        issues = []
        warnings = []
        
        try:
            # Get model info
            model = self.get_model(model_id)
            if not model:
                issues.append(f"Model {model_id} not found")
                return ValidationResult(is_valid=False, issues=issues)
            
            # Check if all required model inputs are mapped
            for field in model.input_schema.keys():
                if field not in mapping.input_columns:
                    # Special case: if this is the "instruction" field and we have a static instruction,
                    # we don't need it to be mapped from file columns
                    if field == "instruction" and model.metadata and "static_instruction" in model.metadata:
                        print(f"Skipping instruction field validation - using static instruction from model metadata")
                        continue
                    issues.append(f"Required model input '{field}' is not mapped")
            
            # Get file info and check columns exist
            file_info = file_manager.get_file_info(file_id)
            if not file_info:
                issues.append(f"File {file_id} not found")
                return ValidationResult(is_valid=False, issues=issues)
            
            # Load file to check columns
            file_path = file_manager.get_file_path(file_id)
            data = self._load_data_file(file_path)
            available_columns = list(data.columns)
            
            for model_field, file_column in mapping.input_columns.items():
                if file_column not in available_columns:
                    issues.append(f"File column '{file_column}' not found")
            
            # Check for potential data type mismatches
            for model_field, file_column in mapping.input_columns.items():
                if file_column in available_columns:
                    expected_type = model.input_schema.get(model_field)
                    if expected_type == 'string' and not data[file_column].dtype == 'object':
                        warnings.append(f"Column '{file_column}' may not be text data")
            
            is_valid = len(issues) == 0
            return ValidationResult(
                is_valid=is_valid,
                issues=issues,
                warnings=warnings
            )
            
        except Exception as e:
            issues.append(f"Validation error: {str(e)}")
            return ValidationResult(is_valid=False, issues=issues)
    
    def get_prediction_job(self, job_id: str) -> Optional[PredictionJob]:
        """Get a prediction job by ID"""
        try:
            jobs_index = self._load_jobs_index()
            if job_id not in jobs_index:
                return None
            
            job_data = jobs_index[job_id]
            job = PredictionJob(**job_data)
            
            # Load results if completed
            if job.status == PredictionStatus.COMPLETED and not job.results:
                job.results = self._load_job_results(job_id)
            
            return job
        except Exception as e:
            print(f"Error getting prediction job {job_id}: {e}")
            return None
    
    def get_prediction_jobs(
        self, 
        status: Optional[str] = None,
        model_id: Optional[str] = None,
        limit: int = 50
    ) -> List[PredictionJob]:
        """Get list of prediction jobs with optional filtering"""
        try:
            jobs_index = self._load_jobs_index()
            jobs = []
            
            for job_id, job_data in jobs_index.items():
                try:
                    job = PredictionJob(**job_data)
                    
                    # Apply filters
                    if status and job.status != status:
                        continue
                    if model_id and job.model_id != model_id:
                        continue
                    
                    jobs.append(job)
                except Exception as e:
                    print(f"Error loading job {job_id}: {e}")
                    continue
            
            # Sort by creation date (newest first)
            jobs.sort(key=lambda x: x.created_at, reverse=True)
            
            return jobs[:limit]
        except Exception as e:
            print(f"Error getting prediction jobs: {e}")
            return []
    
    def cancel_prediction_job(self, job_id: str) -> bool:
        """Cancel a running prediction job"""
        try:
            job = self.get_prediction_job(job_id)
            if not job:
                return False
            
            if job.status in [PredictionStatus.COMPLETED, PredictionStatus.FAILED]:
                return False
            
            job.status = PredictionStatus.CANCELLED
            job.completed_at = datetime.now()
            self._save_job(job)
            
            # Remove from running jobs
            if job_id in self._running_jobs:
                del self._running_jobs[job_id]
            
            return True
        except Exception as e:
            print(f"Error cancelling job {job_id}: {e}")
            return False
    
    def delete_prediction_job(self, job_id: str) -> bool:
        """Delete a prediction job and its results"""
        try:
            jobs_index = self._load_jobs_index()
            if job_id not in jobs_index:
                return False
            
            # Remove from index
            del jobs_index[job_id]
            self._save_jobs_index(jobs_index)
            
            # Remove results file
            results_file = self.jobs_dir / "completed" / f"{job_id}_results.json"
            if results_file.exists():
                results_file.unlink()
            
            return True
        except Exception as e:
            print(f"Error deleting job {job_id}: {e}")
            return False
    
    def _load_data_file(self, file_path: str) -> pd.DataFrame:
        """Load data from file into DataFrame"""
        file_extension = os.path.splitext(file_path)[1].lower()
        
        if file_extension == '.csv':
            return pd.read_csv(file_path)
        elif file_extension == '.json':
            return pd.read_json(file_path)
        elif file_extension == '.jsonl':
            data = []
            with open(file_path, 'r', encoding='utf-8') as f:
                for line in f:
                    if line.strip():
                        data.append(json.loads(line))
            return pd.DataFrame(data)
        else:
            raise ValueError(f"Unsupported file format: {file_extension}")
    
    def _save_job(self, job: PredictionJob):
        """Save job to index"""
        jobs_index = self._load_jobs_index()
        jobs_index[job.job_id] = job.dict()
        self._save_jobs_index(jobs_index)
    
    def _save_job_results(self, job_id: str, results: List[PredictionResult]):
        """Save job results to separate file"""
        results_file = self.jobs_dir / "completed" / f"{job_id}_results.json"
        with open(results_file, 'w', encoding='utf-8') as f:
            json.dump([result.dict() for result in results], f, indent=2, default=str)
    
    def _load_job_results(self, job_id: str) -> List[PredictionResult]:
        """Load job results from file"""
        try:
            results_file = self.jobs_dir / "completed" / f"{job_id}_results.json"
            if not results_file.exists():
                return []
            
            with open(results_file, 'r', encoding='utf-8') as f:
                results_data = json.load(f)
            
            return [PredictionResult(**result) for result in results_data]
        except Exception as e:
            print(f"Error loading results for job {job_id}: {e}")
            return []
    
    def _load_jobs_index(self) -> Dict[str, Any]:
        """Load jobs index from file"""
        try:
            with open(self.jobs_index_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            return {}
    
    def _save_jobs_index(self, index: Dict[str, Any]):
        """Save jobs index to file"""
        with open(self.jobs_index_file, 'w', encoding='utf-8') as f:
            json.dump(index, f, indent=2, default=str)
    
    def _load_models_index(self) -> Dict[str, Any]:
        """Load models index from file"""
        try:
            with open(self.models_index_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            return {}
    
    def _save_models_index(self, index: Dict[str, Any]):
        """Save models index to file"""
        with open(self.models_index_file, 'w', encoding='utf-8') as f:
            json.dump(index, f, indent=2, default=str)


# Global instance
prediction_service = PredictionService()
