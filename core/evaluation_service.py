import asyncio
import json
import os
import uuid
import re
from datetime import datetime
from typing import Dict, List, Any, Optional
import tempfile
import threading
from concurrent.futures import ThreadPoolExecutor
import time

# Import the model manager for loading models
from model_manager import model_manager

# Import prediction service for model management
from services.prediction_service import prediction_service

# Import enhanced JSON parser and VLLM response handler
from enhanced_json_parser import EnhancedJSONParser
from vllm_response_handler import vllm_response_handler
# Import the new remote API responder
from remote_api_responder import RemoteAPIResponder

# Store evaluation jobs status
evaluation_jobs: Dict[str, Dict[str, Any]] = {}

class EvaluationService:
    def __init__(self):
        self.jobs = evaluation_jobs
        self.executor = ThreadPoolExecutor(max_workers=2)  # Limit concurrent evaluations
        self.instruction_cache = {}  # Cache for loaded instruction files
    
    def create_prediction_job(self, model_path: str, test_data: List[Dict], batch_size: int = 50, mapping: Dict[str, Any] = None) -> str:
        """Create a new prediction job with optional column mapping"""
        job_id = f"eval_{uuid.uuid4().hex[:8]}"
        
        # Initialize job tracking
        self.jobs[job_id] = {
            "id": job_id,
            "status": "queued",
            "model_path": model_path,
            "total_rows": len(test_data),
            "completed_rows": 0,
            "batch_size": batch_size,
            "mapping": mapping,  # Store mapping configuration
            "created_at": datetime.now().isoformat(),
            "started_at": None,
            "completed_at": None,
            "error": None,
            "results": [],
            "progress_percentage": 0,
            "example_timings": [],
            "estimated_completion_time": None,
            "avg_time_per_example": 0,
            "processing_speed": 0
        }
        
        # Start processing in background
        self.executor.submit(self._process_prediction_job, job_id, model_path, test_data, batch_size, mapping)
        
        return job_id
    
    def _process_prediction_job(self, job_id: str, model_path: str, test_data: List[Dict], batch_size: int, mapping: Dict[str, Any] = None):
        """Process prediction job in background thread with batch inference and column mapping support"""
        batch_size = batch_size
        try:
            self.jobs[job_id]["status"] = "running"
            self.jobs[job_id]["started_at"] = datetime.now().isoformat()

            print(f"Loading model for evaluation job {job_id}: {model_path}")
            # load_result = model_manager.load_model(model_path)

            # if load_result["status"] == "error":
            #     raise Exception(f"Failed to load model: {load_result['message']}")

            # print(f"Model loaded successfully for job {job_id}")
            model_name = os.path.basename(model_path)
            #Todo
            # model_path = f"finvix/{model_name}"
            # model_path = "finvix/prediction_model_v2"
            model_path = "LaaP-ai/qwen-base-invoicev1.01-1.5B"
            
            # Use RemoteAPIResponder instead of VLLMResponder for reliable predictions
            print(f"Initializing Remote API responder for model: {model_path}")
            vllm_engine = RemoteAPIResponder(model_path=model_path)
            results = []
            total_rows = len(test_data)

            for i in range(0, total_rows, batch_size):
                batch = test_data[i:i + batch_size]
                example_start_time = time.time()

                # Format prompts in a batch with mapping support
                prompts = []
                example_prompts = []  # Store prompts for each example
                for idx, example in enumerate(batch):
                    row_index = i + idx  # Global row index
                    if mapping and mapping.get('input_columns'):
                        # Use column mapping to extract input data
                        mapped_data = self._apply_input_mapping(example, mapping)
                        prompt = self._format_prompt_with_mapping(mapped_data, mapping, example, row_index)
                    else:
                        # Fallback to original format
                        prompt = self._format_prompt(example.get('instruction', ''), example.get('input', ''))
                    prompts.append(prompt)
                    example_prompts.append(prompt)  # Store for later use

                # Run batch inference with enhanced error handling
                try:
                    raw_responses = vllm_engine.generate_response_using_batch(prompts)
                    print("raw response!!", raw_responses)
                except Exception as e:
                    print("error!!", str(e))
                    raw_responses = [f"[ERROR: {str(e)}]"] * len(batch)

                # Process responses with VLLM response handler
                processed_responses = []
                response_metadata = []
                
                for raw_response in raw_responses:
                    try:
                        # Use VLLM response handler to extract prediction
                        prediction_text, recovery_method, metadata = vllm_response_handler.extract_prediction_from_response(raw_response)
                        processed_responses.append(prediction_text)
                        response_metadata.append({
                            "recovery_method": recovery_method,
                            "metadata": metadata,
                            "raw_response": str(raw_response)[:500] if len(str(raw_response)) > 500 else str(raw_response)  # Truncate for storage
                        })
                    except Exception as e:
                        # Fallback to string conversion
                        processed_responses.append(str(raw_response))
                        response_metadata.append({
                            "recovery_method": "fallback_string",
                            "metadata": {"error": str(e)},
                            "raw_response": str(raw_response)[:500] if len(str(raw_response)) > 500 else str(raw_response)
                        })

                # Save results with mapping support and enhanced metadata
                for example, prediction, prompt, resp_metadata in zip(batch, processed_responses, example_prompts, response_metadata):
                    # Create the correct structure with nested input
                    if mapping and mapping.get('input_columns'):
                        # Create structured result with nested input
                        input_data = {}
                        instruction = None
                        
                        # Extract mapped input fields
                        input_columns = mapping.get('input_columns', {})
                        for model_field, file_column in input_columns.items():
                            if file_column in example:
                                value = example[file_column]
                                if model_field == 'instruction':
                                    # Don't use instruction from CSV - use static instruction from model
                                    pass
                                else:
                                    input_data[file_column] = value  # Use original column name as key
                        
                        # Get static instruction from model metadata (not from CSV)
                        # instruction = self._get_static_instruction_from_model(model_path)
                        
                        # Create the structured result
                        result = {
                            "input": input_data,
                            "predict": prediction,
                            "prompt_sent_to_model": prompt,  # Add the actual prompt sent to model
                            "response_metadata": resp_metadata  # Add response processing metadata
                        }
                    else:
                        # Fallback to original flat structure
                        result = {**example, "predict": prediction, "prompt_sent_to_model": prompt, "response_metadata": resp_metadata}
                    
                    # Create expected JSON from CSV columns using output mapping
                    if mapping and mapping.get('output_columns'):
                        expected_json = self._create_expected_json(example, mapping)
                        result['expected_json'] = expected_json
                        result['expected'] = json.dumps(expected_json)  # For compatibility
                    elif mapping and mapping.get('output_column'):
                        # Legacy support for single output column
                        expected_output = example.get(mapping['output_column'], '')
                        result['expected'] = expected_output
                    
                    # Parse prediction and add quality assessment
                    parsed_prediction = vllm_response_handler.parse_prediction_content(prediction)
                    
                    # Get expected fields from mapping for quality assessment
                    expected_fields = None
                    if mapping and mapping.get('output_columns'):
                        expected_fields = list(mapping['output_columns'].keys())
                    
                    quality_category, confidence_score = vllm_response_handler.get_prediction_quality_score(
                        resp_metadata.get("recovery_method", "unknown"), 
                        parsed_prediction,
                        expected_fields
                    )
                    
                    result['parsed_prediction'] = parsed_prediction
                    result['prediction_quality'] = {
                        "category": quality_category,
                        "confidence_score": confidence_score,
                        "recovery_method": resp_metadata.get("recovery_method", "unknown")
                    }
                    
                    results.append(result)

                # Timing stats
                example_end_time = time.time()
                batch_duration = example_end_time - example_start_time
                timings = self.jobs[job_id]["example_timings"]
                per_example_time = batch_duration / len(batch)
                if len(timings) == 0 or per_example_time <= 3 * (sum(timings) / len(timings)):
                    timings.extend([per_example_time] * len(batch))

                # Progress & ETA
                completed = len(results)
                progress_percentage = (completed / total_rows) * 100
                time_estimates = self._calculate_time_estimates(timings, completed, total_rows)

                self.jobs[job_id].update({
                    "completed_rows": completed,
                    "progress_percentage": round(progress_percentage, 2),
                    "example_timings": timings,
                    "estimated_completion_time": time_estimates["estimated_completion_time"],
                    "avg_time_per_example": time_estimates["avg_time_per_example"],
                    "processing_speed": time_estimates["processing_speed"]
                })

                print(f"Job {job_id}: Processed {completed}/{total_rows} rows ({progress_percentage:.1f}%) - ETA: {time_estimates['eta_formatted']}")

            # Finish job
            self.jobs[job_id]["results"] = results
            self.jobs[job_id]["status"] = "completed"
            self.jobs[job_id]["completed_at"] = datetime.now().isoformat()

            # clean up the model
            vllm_engine.stop_engine()
            print(f"Job {job_id} completed successfully with {len(results)} predictions")

        except Exception as e:
            print(f"Job {job_id} failed: {str(e)}")
            self.jobs[job_id]["status"] = "failed"
            self.jobs[job_id]["error"] = str(e)
            self.jobs[job_id]["completed_at"] = datetime.now().isoformat()
    
    def _process_batch(self, batch: List[Dict]) -> List[Dict]:
        """Process a batch of test examples"""
        results = []
        
        for example in batch:
            try:
                # Format the prompt based on instruction and input
                prompt = self._format_prompt(example.get('instruction', ''), example.get('input', ''))
                
                # Generate prediction using the loaded model
                generation_result = model_manager.generate_response(
                    message=prompt,
                    max_tokens=150,
                    temperature=0.7,
                    do_sample=True
                )
                
                if generation_result["status"] == "success":
                    prediction = generation_result["response"].strip()
                else:
                    prediction = f"[ERROR: {generation_result['message']}]"
                
                # Create result with prediction
                result = {
                    **example,  # Keep original instruction, input, output
                    "predict": prediction
                }
                results.append(result)
                
            except Exception as e:
                # Handle individual prediction errors
                result = {
                    **example,
                    "predict": f"[ERROR: {str(e)}]"
                }
                results.append(result)
        
        return results
    
    def _calculate_time_estimates(self, timings: List[float], completed: int, total: int) -> Dict[str, Any]:
        """Calculate time estimates using hybrid approach"""
        if not timings or completed == 0:
            return {
                "estimated_completion_time": None,
                "avg_time_per_example": 0,
                "processing_speed": 0,
                "eta_formatted": "Calculating..."
            }
        
        # Hybrid approach: simple average for first 3, weighted moving average after
        if len(timings) < 3:
            # Phase 1: Simple average for quick initial estimates
            avg_time = sum(timings) / len(timings)
        else:
            # Phase 2: Weighted moving average (last 5 examples, more weight to recent)
            recent_timings = timings[-5:]
            weights = [1, 1.2, 1.4, 1.6, 2.0]  # More weight to recent examples
            weighted_sum = sum(t * w for t, w in zip(recent_timings, weights[:len(recent_timings)]))
            weight_sum = sum(weights[:len(recent_timings)])
            avg_time = weighted_sum / weight_sum
        
        # Calculate estimates
        remaining_examples = total - completed
        estimated_seconds = remaining_examples * avg_time
        
        # Processing speed (examples per minute)
        processing_speed = 60 / avg_time if avg_time > 0 else 0
        
        # Format ETA
        eta_formatted = self._format_time_duration(estimated_seconds)
        
        return {
            "estimated_completion_time": estimated_seconds,
            "avg_time_per_example": avg_time,
            "processing_speed": round(processing_speed, 1),
            "eta_formatted": eta_formatted
        }
    
    def _format_time_duration(self, seconds: float) -> str:
        """Format time duration in user-friendly format"""
        if seconds < 0:
            return "Calculating..."
        
        if seconds < 60:
            return f"{int(seconds)} seconds"
        elif seconds < 3600:
            minutes = int(seconds // 60)
            remaining_seconds = int(seconds % 60)
            if remaining_seconds == 0:
                return f"{minutes} minute{'s' if minutes != 1 else ''}"
            else:
                return f"{minutes}m {remaining_seconds}s"
        else:
            hours = int(seconds // 3600)
            minutes = int((seconds % 3600) // 60)
            return f"{hours}h {minutes}m"
    
    def _format_prompt(self, instruction: str, input_text: str) -> str:
        """Format instruction and input into a proper prompt"""
        if input_text and input_text.strip():
            return f"{instruction}\n\nInput: {input_text}\n\nOutput:"
        else:
            return f"{instruction}\n\nOutput:"
    
    def _apply_input_mapping(self, example: Dict[str, Any], mapping: Dict[str, Any]) -> Dict[str, Any]:
        """Apply column mapping to extract input data from the example"""
        mapped_data = {}
        input_columns = mapping.get('input_columns', {})
        
        for model_field, file_column in input_columns.items():
            if file_column in example:
                value = example[file_column]
                
                # Handle preprocessing options
                preprocessing = mapping.get('preprocessing_options', {})
                
                # Handle missing values
                if value is None or (isinstance(value, str) and not value.strip()):
                    handle_missing = preprocessing.get('handle_missing_values', 'default')
                    if handle_missing == 'skip':
                        continue
                    elif handle_missing == 'error':
                        raise ValueError(f"Missing value in column {file_column}")
                    else:  # default
                        default_values = preprocessing.get('default_values', {})
                        value = default_values.get(model_field, "")
                
                # Text normalization
                if preprocessing.get('normalize_text', True) and isinstance(value, str):
                    value = value.strip()
                
                mapped_data[model_field] = value
        
        return mapped_data
    
    def _format_prompt_with_mapping(self, mapped_data: Dict[str, Any], mapping: Dict[str, Any], row_data: Dict[str, Any] = None, row_index: int = 0) -> str:
        """Format prompt using mapped data with dynamic instruction support"""
        # Build the message parts
        message_parts = []
        
        # Get dynamic instruction based on mapping configuration
        instruction = self._get_dynamic_instruction(row_data or mapped_data, row_index, mapping)
        
        if instruction and instruction.strip():
            message_parts.append(f"### Instruction:\n{instruction}")
        
        # Check for input field
        input_text = mapped_data.get('input', '')
        if input_text and input_text.strip():
            message_parts.append(f"### Input:\n{input_text}")
        
        # Handle other input fields (for custom models)
        for field_name, value in mapped_data.items():
            if field_name not in ["instruction", "input"] and value and str(value).strip():
                # Format as a labeled section
                field_label = field_name.replace("_", " ").title()
                message_parts.append(f"### {field_label}:\n{value}")
        
        # Add the response prompt
        message_parts.append("### Response:")
        
        formatted_message = "\n\n".join(message_parts)
        return formatted_message
    
    def _get_dynamic_instruction(self, row_data: Dict[str, Any], row_index: int, mapping: Dict[str, Any]) -> str:
        """Get instruction for a specific row based on mapping configuration"""
        if not mapping:
            return self._get_default_static_instruction()
        
        instruction_source = mapping.get('instruction_source', 'static')        
        
        # Priority 1: Row-level instruction column
        if instruction_source == 'column':
            instruction_column = mapping.get('instruction_column')
            if instruction_column and instruction_column in row_data:
                row_instruction = row_data[instruction_column]
                if row_instruction and str(row_instruction).strip():
                    return str(row_instruction).strip()
            # If column instruction is configured but not found, fall back to static instruction
            if mapping.get('static_instruction'):
                return mapping['static_instruction']
            return self._get_default_static_instruction()
        
        # Priority 2: External instruction file
        elif instruction_source == 'file':
            instruction = self._get_instruction_from_file(row_data, row_index, mapping)
            if instruction:
                return instruction
            # If file instruction is configured but not found, fall back to static instruction
            if mapping.get('static_instruction'):
                return mapping['static_instruction']
            return self._get_default_static_instruction()
        
        # Priority 3: Static instruction from mapping (only when source is 'static')
        elif instruction_source == 'static':
            if mapping.get('static_instruction'):
                return mapping['static_instruction']
            # Only use default static instruction when explicitly using static source
            return self._get_default_static_instruction()
        
        # Default fallback
        return self._get_default_static_instruction()
    
    def _get_instruction_from_file(self, row_data: Dict[str, Any], row_index: int, mapping: Dict[str, Any]) -> Optional[str]:
        """Get instruction from external file based on mapping"""
        try:
            instruction_file_content = mapping.get('instruction_file_content')
            instruction_file_type = mapping.get('instruction_file_type')
            instruction_file_mapping = mapping.get('instruction_file_mapping', {})
            
            if not instruction_file_content or not instruction_file_type:
                return None
            
            # Create cache key for this instruction file
            cache_key = f"{instruction_file_type}_{hash(instruction_file_content)}"
            
            # Load instruction file if not cached
            if cache_key not in self.instruction_cache:
                instructions = self._load_instruction_file(instruction_file_content, instruction_file_type)
                self.instruction_cache[cache_key] = instructions
            else:
                instructions = self.instruction_cache[cache_key]
            
            if not instructions:
                return None
            
            # Map row data to instruction using configured mapping
            if instruction_file_mapping:
                # Use mapping to find the right instruction
                for instruction_key_field, row_key_field in instruction_file_mapping.items():
                    if row_key_field in row_data:
                        row_key_value = str(row_data[row_key_field]).strip()
                        if row_key_value in instructions:
                            return instructions[row_key_value]
            else:
                # Try common mapping strategies
                # Strategy 1: Use row index
                if str(row_index) in instructions:
                    return instructions[str(row_index)]
                
                # Strategy 2: Use first column value as key
                if row_data:
                    first_value = str(list(row_data.values())[0]).strip()
                    if first_value in instructions:
                        return instructions[first_value]
            
            return None
            
        except Exception as e:
            print(f"Error getting instruction from file: {e}")
            return None
    
    def _load_instruction_file(self, file_content: str, file_type: str) -> Dict[str, str]:
        """Load instructions from base64 encoded file content"""
        try:
            import base64
            import tempfile
            import os
            
            # Decode base64 content
            if file_type in ['pkl', 'pickle']:
                decoded_content = base64.b64decode(file_content)
                file_mode = 'wb'
            else:
                decoded_content = base64.b64decode(file_content).decode('utf-8')
                file_mode = 'w'
            
            # Create temporary file
            with tempfile.NamedTemporaryFile(mode=file_mode, delete=False, suffix=f".{file_type}") as tmp_file:
                tmp_file.write(decoded_content)
                tmp_file.flush()
                
                try:
                    instructions = {}
                    
                    if file_type == 'json':
                        with open(tmp_file.name, 'r', encoding='utf-8') as f:
                            data = json.load(f)
                        
                        if isinstance(data, dict):
                            # Direct key-value mapping
                            instructions = {str(k): str(v) for k, v in data.items()}
                        elif isinstance(data, list):
                            # List of objects with key-instruction pairs
                            for i, item in enumerate(data):
                                if isinstance(item, dict):
                                    # Try to find key and instruction fields
                                    key_field = None
                                    instruction_field = None
                                    
                                    for field in item.keys():
                                        if field.lower() in ['key', 'id', 'name', 'type']:
                                            key_field = field
                                        elif field.lower() in ['instruction', 'prompt', 'template', 'text']:
                                            instruction_field = field
                                    
                                    if key_field and instruction_field:
                                        instructions[str(item[key_field])] = str(item[instruction_field])
                                    else:
                                        # Use index as key
                                        instructions[str(i)] = str(item)
                    
                    elif file_type == 'csv':
                        import csv
                        with open(tmp_file.name, 'r', encoding='utf-8') as f:
                            reader = csv.DictReader(f)
                            for i, row in enumerate(reader):
                                # Try to find key and instruction columns
                                key_value = None
                                instruction_value = None
                                
                                for col, value in row.items():
                                    if col.lower() in ['key', 'id', 'name', 'type']:
                                        key_value = str(value).strip()
                                    elif col.lower() in ['instruction', 'prompt', 'template', 'text']:
                                        instruction_value = str(value).strip()
                                
                                if key_value and instruction_value:
                                    instructions[key_value] = instruction_value
                                elif instruction_value:
                                    # Use row index as key
                                    instructions[str(i)] = instruction_value
                    
                    elif file_type == 'jsonl':
                        with open(tmp_file.name, 'r', encoding='utf-8') as f:
                            for i, line in enumerate(f):
                                if line.strip():
                                    item = json.loads(line)
                                    if isinstance(item, dict):
                                        # Similar logic as JSON list handling
                                        key_field = None
                                        instruction_field = None
                                        
                                        for field in item.keys():
                                            if field.lower() in ['key', 'id', 'name', 'type']:
                                                key_field = field
                                            elif field.lower() in ['instruction', 'prompt', 'template', 'text']:
                                                instruction_field = field
                                        
                                        if key_field and instruction_field:
                                            instructions[str(item[key_field])] = str(item[instruction_field])
                                        else:
                                            instructions[str(i)] = str(item)
                    
                    return instructions
                    
                finally:
                    os.unlink(tmp_file.name)
                    
        except Exception as e:
            print(f"Error loading instruction file: {e}")
            return {}
    
    def _get_default_static_instruction(self) -> str:
        """Get default static instruction"""
        return """
        - You are an accountant looking at invoices from various sellers. 
        - You need to extract the following values and return as a json object maintaining the exact variable name shown below.
        - Not all values are found in all invoices, so if you cant find the appropriate value return a null value against those fields invoice_no (string) invoice_date (DD-MM-YYYY format) amount (integer only, no commas)
        """
    
    def get_job_status(self, job_id: str) -> Optional[Dict[str, Any]]:
        """Get status of a prediction job"""
        return self.jobs.get(job_id)
    
    def get_job_results(self, job_id: str) -> Optional[List[Dict]]:
        """Get results of a completed prediction job"""
        job = self.jobs.get(job_id)
        if job and job["status"] == "completed":
            return job["results"]
        return None
    
    def list_jobs(self) -> List[Dict[str, Any]]:
        """List all evaluation jobs"""
        return list(self.jobs.values())
    
    def delete_job(self, job_id: str) -> bool:
        """Delete a job and its results"""
        if job_id in self.jobs:
            del self.jobs[job_id]
            return True
        return False
    
    def get_available_models(self):
        """Get available models from prediction service"""
        try:
            models = prediction_service.get_available_models()
            # Convert ModelInfo objects to dictionaries for JSON serialization
            return [model.dict() if hasattr(model, 'dict') else model for model in models]
        except Exception as e:
            print(f"Error getting available models: {e}")
            return []
    
    def get_model(self, model_id: str):
        """Get model details from prediction service"""
        try:
            model = prediction_service.get_model(model_id)
            if model:
                # Convert ModelInfo object to dictionary for JSON serialization
                return model.dict() if hasattr(model, 'dict') else model
            return None
        except Exception as e:
            print(f"Error getting model {model_id}: {e}")
            return None
    
    def _create_expected_json(self, csv_row: Dict[str, Any], mapping: Dict[str, Any]) -> Dict[str, Any]:
        """Create expected JSON from CSV row using output column mapping"""
        
        if not mapping or 'output_columns' not in mapping:
            return {}
        
        expected_json = {}
        output_columns = mapping['output_columns']
        
        for json_field, csv_column in output_columns.items():
            if csv_column in csv_row:
                value = csv_row[csv_column]
                # Simple processing: convert to string and strip whitespace
                expected_json[json_field] = str(value).strip() if value is not None else None
        
        return expected_json
    
    def _parse_prediction_json(self, model_response: str) -> Dict[str, Any]:
        """Parse JSON from model response using enhanced parser that treats every prediction as containing JSON"""
        if not model_response:
            return {}
        
        # Use the enhanced JSON parser
        parser = EnhancedJSONParser()
        extracted_json = parser.extract_json_from_any_format(model_response)
        
        # Normalize field names
        if extracted_json:
            field_mappings = {
                'invoice_no': ['invoice_no', 'invoice_number', 'invoiceno', 'invoice_num', 'bill_no'],
                'invoice_date': ['invoice_date', 'billDate', 'bill_date', 'date'],
                'amount': ['amount', 'invoice_amount', 'invoiceAmount', 'total_amount', 'total'],
                'buyer_gstin': ['buyer_gstin', 'buyerGSTIN', 'buyer_gst', 'customer_gstin'],
                'seller_gstin': ['seller_gstin', 'sellerGSTIN', 'seller_gst', 'vendor_gstin']
            }
            extracted_json = parser.normalize_field_names(extracted_json)
        
        return extracted_json
    
    def _clean_json_string(self, json_str: str) -> str:
        """Clean and fix common JSON formatting issues"""
        # Remove leading/trailing whitespace and newlines
        json_str = json_str.strip()
        
        # Fix common issues
        json_str = re.sub(r',\s*}', '}', json_str)  # Remove trailing commas
        json_str = re.sub(r',\s*]', ']', json_str)  # Remove trailing commas in arrays
        
        return json_str
    
    def _extract_key_value_pairs(self, text: str) -> Dict[str, Any]:
        """Extract key-value pairs using regex patterns"""
        result = {}
        
        # Common patterns for key-value extraction
        patterns = [
            r'"([^"]+)":\s*"([^"]*)"',  # "key": "value"
            r'"([^"]+)":\s*([^,}\s]+)',  # "key": value
            r'(\w+):\s*"([^"]*)"',      # key: "value"
            r'(\w+):\s*([^,}\s]+)',     # key: value
        ]
        
        for pattern in patterns:
            matches = re.findall(pattern, text)
            for key, value in matches:
                # Clean up key and value
                key = key.strip().lower()
                value = str(value).strip().strip('"').strip("'")
                
                if key and value and value != 'null':
                    result[key] = value
        
        return result if result else {}
    
    def _fields_match(self, expected, predicted) -> bool:
        """Enhanced field comparison with robust data type and formatting handling"""
        
        if expected is None and predicted is None:
            return True
        
        if expected is None or predicted is None:
            return False
        
        # Convert both to strings for comparison
        expected_str = str(expected).strip()
        predicted_str = str(predicted).strip()
        
        # Exact match first (fastest)
        if expected_str == predicted_str:
            return True
        
        # Handle numeric comparisons (amounts)
        if self._is_numeric_field(expected_str) and self._is_numeric_field(predicted_str):
            try:
                # Remove currency symbols and commas
                expected_clean = re.sub(r'[₹$,\s]', '', expected_str)
                predicted_clean = re.sub(r'[₹$,\s]', '', predicted_str)
                
                expected_num = float(expected_clean)
                predicted_num = float(predicted_clean)
                return abs(expected_num - predicted_num) < 0.01  # Allow small floating point differences
            except (ValueError, TypeError):
                pass
        
        # Handle date comparisons with comprehensive normalization
        if self._is_date_field(expected_str) or self._is_date_field(predicted_str):
            normalized_expected = self._normalize_date_enhanced(expected_str)
            normalized_predicted = self._normalize_date_enhanced(predicted_str)
            if normalized_expected and normalized_predicted:
                return normalized_expected == normalized_predicted
        
        # Handle GSTIN comparisons (case-insensitive, alphanumeric only)
        if self._is_gstin_field(expected_str) or self._is_gstin_field(predicted_str):
            expected_gstin = ''.join(c.upper() for c in expected_str if c.isalnum())
            predicted_gstin = ''.join(c.upper() for c in predicted_str if c.isalnum())
            return expected_gstin == predicted_gstin
        
        # Fuzzy string matching (case-insensitive, whitespace-normalized)
        expected_clean = ' '.join(expected_str.lower().split())
        predicted_clean = ' '.join(predicted_str.lower().split())
        
        return expected_clean == predicted_clean
    
    def _normalize_date_enhanced(self, date_str: str) -> str:
        """Enhanced date normalization with multiple format support"""
        if not date_str:
            return ""
        
        # Common date patterns
        date_patterns = [
            r'(\d{4})-(\d{1,2})-(\d{1,2})',  # YYYY-MM-DD
            r'(\d{1,2})-(\d{1,2})-(\d{4})',  # DD-MM-YYYY
            r'(\d{1,2})/(\d{1,2})/(\d{4})',  # DD/MM/YYYY
            r'(\d{4})/(\d{1,2})/(\d{1,2})',  # YYYY/MM/DD
            r'(\d{1,2})-([A-Za-z]{3})-(\d{2,4})',  # DD-MMM-YY/YYYY
        ]
        
        for pattern in date_patterns:
            match = re.search(pattern, date_str)
            if match:
                try:
                    groups = match.groups()
                    if len(groups) == 3:
                        if pattern.startswith(r'(\d{4})'):  # Year first
                            year, month, day = groups
                        elif pattern.endswith(r'(\d{4})'):  # Year last
                            day, month, year = groups
                        else:  # Month name pattern
                            day, month_name, year = groups
                            month_map = {
                                'jan': '01', 'feb': '02', 'mar': '03', 'apr': '04',
                                'may': '05', 'jun': '06', 'jul': '07', 'aug': '08',
                                'sep': '09', 'oct': '10', 'nov': '11', 'dec': '12'
                            }
                            month = month_map.get(month_name.lower()[:3], month_name)
                        
                        # Ensure 4-digit year
                        if len(year) == 2:
                            year = '20' + year if int(year) < 50 else '19' + year
                        
                        # Format as YYYY-MM-DD
                        return f"{year}-{month.zfill(2)}-{day.zfill(2)}"
                except:
                    continue
        
        return date_str.lower()
    
    def _is_numeric_field(self, value: str) -> bool:
        """Check if a field appears to be numeric"""
        # Remove common formatting characters
        clean_value = value.replace(',', '').replace(' ', '').replace('₹', '').replace('$', '')
        try:
            float(clean_value)
            return True
        except (ValueError, TypeError):
            return False
    
    def _is_date_field(self, value: str) -> bool:
        """Check if a field appears to be a date"""
        # Common date patterns
        date_indicators = ['/', '-', '20', '19', 'jan', 'feb', 'mar', 'apr', 'may', 'jun',
                          'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
        value_lower = value.lower()
        return any(indicator in value_lower for indicator in date_indicators) and len(value) >= 6
    
    def _is_gstin_field(self, value: str) -> bool:
        """Check if a field appears to be a GSTIN"""
        # GSTIN pattern: 15 characters, specific format
        clean_value = ''.join(c for c in value if c.isalnum())
        return len(clean_value) == 15 and clean_value[:2].isdigit()
    
    def _normalize_date(self, date_str: str) -> str:
        """Normalize date string to a standard format"""
        try:
            # Remove extra spaces and common separators
            clean_date = date_str.strip().replace('/', '-').replace('.', '-')
            
            # Try to parse common date formats
            from datetime import datetime
            
            # Try different date formats
            formats = ['%d-%m-%Y', '%d-%m-%y', '%Y-%m-%d', '%m-%d-%Y', '%m-%d-%y']
            
            for fmt in formats:
                try:
                    parsed_date = datetime.strptime(clean_date, fmt)
                    # Convert 2-digit years to 4-digit (assume 21st century)
                    if parsed_date.year < 100:
                        parsed_date = parsed_date.replace(year=parsed_date.year + 2000)
                    return parsed_date.strftime('%Y-%m-%d')
                except ValueError:
                    continue
            
            # If parsing fails, return cleaned string
            return clean_date.lower()
            
        except Exception:
            return date_str.lower()
    
    def calculate_structured_data_accuracy(self, job_id: str, exclude_empty_predictions: bool = True) -> Optional[Dict[str, Any]]:
        """Calculate structured data accuracy for a completed job with enhanced filtering"""
        
        job = self.jobs.get(job_id)
        if not job or job["status"] != "completed":
            return None
        
        results = job.get("results", [])
        if not results:
            return None
        
        # Filter out empty predictions if requested
        filtered_results = []
        empty_predictions_excluded = 0
        
        for result in results:
            predict_text = result.get('predict', '').strip()
            if exclude_empty_predictions and not predict_text:
                empty_predictions_excluded += 1
                continue
            filtered_results.append(result)
        
        if not filtered_results:
            return None
        
        field_stats = {}
        total_records = len(results)
        records_with_predictions = len(filtered_results)
        perfect_extractions = 0
        json_parsing_success = 0
        
        # Enhanced recovery statistics
        recovery_stats = {
            "vllm_standard": 0,
            "extracted_content": 0,
            "enhanced_extraction": 0,
            "fallback_string": 0,
            "other": 0
        }
        
        quality_stats = {
            "high": 0,
            "medium": 0,
            "low": 0
        }
        
        # Field mapping for normalization (similar to accuracy checker)
        field_mappings = {
            'invoice_no': ['invoice_no', 'invoice_number', 'invoiceno', 'invoice_num', 'bill_no'],
            'invoice_date': ['invoice_date', 'billDate', 'bill_date', 'date'],
            'amount': ['amount', 'invoice_amount', 'invoiceAmount', 'total_amount', 'total'],
            'buyer_gstin': ['buyer_gstin', 'buyerGSTIN', 'buyer_gst', 'customer_gstin'],
            'seller_gstin': ['seller_gstin', 'sellerGSTIN', 'seller_gst', 'vendor_gstin']
        }
        
        for result in filtered_results:
            expected_json = result.get('expected_json', {})
            predicted_json = self._parse_prediction_json(result.get('predict', '{}'))
            
            # Count successful JSON parsing
            if predicted_json:
                json_parsing_success += 1
                # Normalize predicted field names
                predicted_json = self._normalize_predicted_field_names(predicted_json, field_mappings)
            
            # Collect recovery and quality statistics
            prediction_quality = result.get('prediction_quality', {})
            recovery_method = prediction_quality.get('recovery_method', 'unknown')
            quality_category = prediction_quality.get('category', 'unknown')
            
            # Update recovery stats
            if recovery_method in recovery_stats:
                recovery_stats[recovery_method] += 1
            else:
                recovery_stats['other'] += 1
            
            # Update quality stats
            if quality_category in quality_stats:
                quality_stats[quality_category] += 1
            
            # Get all fields from expected JSON (dynamic based on mapping)
            all_fields = set(expected_json.keys())
            record_perfect = True
            
            for field in all_fields:
                if field not in field_stats:
                    field_stats[field] = {'correct': 0, 'total': 0, 'missing': 0, 'incorrect': 0, 'fuzzy_matches': 0}
                
                field_stats[field]['total'] += 1
                
                expected_value = expected_json.get(field)
                predicted_value = predicted_json.get(field)
                
                # Enhanced field matching
                exact_match = self._fields_match(expected_value, predicted_value)
                fuzzy_match = False
                
                if not exact_match and expected_value and predicted_value:
                    # Try fuzzy matching (case-insensitive, whitespace-normalized)
                    exp_norm = str(expected_value).lower().strip()
                    pred_norm = str(predicted_value).lower().strip()
                    fuzzy_match = exp_norm == pred_norm
                
                if exact_match:
                    field_stats[field]['correct'] += 1
                elif fuzzy_match:
                    field_stats[field]['fuzzy_matches'] += 1
                    # Count fuzzy matches as correct for overall accuracy
                    field_stats[field]['correct'] += 1
                else:
                    record_perfect = False
                    if predicted_value is None or str(predicted_value).strip() == '':
                        field_stats[field]['missing'] += 1
                    else:
                        field_stats[field]['incorrect'] += 1
            
            if record_perfect:
                perfect_extractions += 1
        
        # Calculate enhanced accuracy metrics
        accuracy_metrics = {
            'overall_accuracy': perfect_extractions / records_with_predictions if records_with_predictions > 0 else 0,
            'field_accuracies': {
                field: {
                    'exact_accuracy': stats['correct'] / stats['total'] if stats['total'] > 0 else 0,
                    'fuzzy_accuracy': stats['fuzzy_matches'] / stats['total'] if stats['total'] > 0 else 0,
                    'prediction_coverage': (stats['total'] - stats['missing']) / stats['total'] if stats['total'] > 0 else 0,
                    'total_attempts': stats['total']
                }
                for field, stats in field_stats.items()
            },
            'field_details': field_stats,
            'perfect_extractions': perfect_extractions,
            'total_records': total_records,
            'records_with_predictions': records_with_predictions,
            'empty_predictions_excluded': empty_predictions_excluded,
            'json_parsing_success': json_parsing_success,
            'json_parsing_success_rate': json_parsing_success / records_with_predictions if records_with_predictions > 0 else 0,
            'evaluated_fields': list(field_stats.keys()),
            'exclude_empty_predictions': exclude_empty_predictions,
            # Enhanced recovery and quality statistics
            'recovery_statistics': {
                'methods': recovery_stats,
                'recovery_success_rate': (recovery_stats['vllm_standard'] + recovery_stats['extracted_content'] + recovery_stats['enhanced_extraction']) / records_with_predictions if records_with_predictions > 0 else 0,
                'total_recovered': sum(recovery_stats.values())
            },
            'quality_statistics': {
                'categories': quality_stats,
                'high_quality_rate': quality_stats['high'] / records_with_predictions if records_with_predictions > 0 else 0,
                'medium_quality_rate': quality_stats['medium'] / records_with_predictions if records_with_predictions > 0 else 0,
                'low_quality_rate': quality_stats['low'] / records_with_predictions if records_with_predictions > 0 else 0
            }
        }
        
        # Store metrics in job
        self.jobs[job_id]['accuracy_metrics'] = accuracy_metrics
        
        return accuracy_metrics
    
    def _normalize_predicted_field_names(self, predicted_json: Dict[str, Any], field_mappings: Dict[str, List[str]]) -> Dict[str, Any]:
        """Normalize predicted field names to standard format"""
        normalized = {}
        
        for key, value in predicted_json.items():
            # Find the standard field name for this key
            standard_key = None
            key_lower = key.lower().strip()
            
            for standard_name, variations in field_mappings.items():
                if key_lower in [v.lower() for v in variations]:
                    standard_key = standard_name
                    break
            
            if standard_key:
                normalized[standard_key] = value
            else:
                # Keep original key if no mapping found
                normalized[key] = value
        
        return normalized
    
    def get_job_accuracy_metrics(self, job_id: str) -> Optional[Dict[str, Any]]:
        """Get accuracy metrics for a job (calculate if not already done)"""
        
        job = self.jobs.get(job_id)
        if not job:
            return None
        
        # Return cached metrics if available
        if 'accuracy_metrics' in job:
            return job['accuracy_metrics']
        
        # Calculate metrics if job is completed and has structured data
        if job["status"] == "completed" and job.get("mapping", {}).get("output_columns"):
            return self.calculate_structured_data_accuracy(job_id)
        
        return None
    
    def _get_static_instruction_from_model(self, model_path: str) -> str:
        """Get static instruction from model metadata"""
        try:
            # Try to get model details from prediction service
            
            # model_name = os.path.basename(model_path)
            model_name = "model_3a66f268-c42f-4f71-8ee5-30f060cf19be"
            model = prediction_service.get_model(model_name)
            
            if model and hasattr(model, 'metadata') and model.metadata:
                # Try to get static instruction from metadata
                if hasattr(model.metadata, 'static_instruction') and model.metadata.get("static_instruction"):
                    return model.metadata.get("static_instruction")
                
                # Try to get from training config
                if hasattr(model.metadata, 'training_config') and model.metadata.training_config:
                    training_config = model.metadata.training_config
                    if isinstance(training_config, dict) and 'static_instruction' in training_config:
                        return training_config['static_instruction']
                
                # Try to infer from dataset info
                if hasattr(model.metadata, 'dataset_info') and model.metadata.dataset_info:
                    dataset_info = model.metadata.dataset_info
                    if isinstance(dataset_info, dict) and 'source' in dataset_info:
                        source = dataset_info['source'].lower()
                        if 'invoice' in source:
                            return 'You are an accountant examining invoices. you need to extract the following values from the invoice.'
                        elif 'sentiment' in source:
                            return 'Analyze the sentiment of the following text'
                        elif 'classification' in source:
                            return 'Classify the following text'
            
            # Try to infer from model name
            if model and hasattr(model, 'name'):
                model_name_lower = model.name.lower()
                if 'invoice' in model_name_lower:
                    return 'You are an accountant examining invoices. you need to extract the following values from the invoice.'
                elif 'sentiment' in model_name_lower:
                    return 'Analyze the sentiment of the following text'
                elif 'classification' in model_name_lower:
                    return 'Classify the following text'
            
            # Default fallback
            return 'You are an accountant examining invoices. you need to extract the following values from the invoice.'
            
        except Exception as e:
            print(f"Error getting static instruction from model {model_path}: {e}")
            # Fallback to default
            return 'You are an accountant examining invoices. you need to extract the following values from the invoice.'

def _convert_value_for_json(value):
    """Convert any value to JSON-serializable format with robust handling"""
    import pandas as pd
    import numpy as np
    import datetime
    
    if value is None or pd.isna(value):
        return None
    elif isinstance(value, pd.DataFrame):
        # Convert DataFrame to dict of lists, but handle nested DataFrames
        try:
            return value.to_dict('list')
        except (ValueError, TypeError):
            return str(value)  # Fallback to string representation
    elif isinstance(value, pd.Series):
        # Convert Series to list
        try:
            return value.tolist()
        except (AttributeError, ValueError, TypeError):
            # If tolist() fails, iterate through values
            return [_convert_value_for_json(val) for val in value]
    elif isinstance(value, (datetime.date, datetime.datetime)):
        # Convert date/datetime objects to ISO format strings
        return value.isoformat()
    elif isinstance(value, pd.Timestamp):
        # Convert pandas Timestamp to ISO format string
        return value.isoformat()
    elif isinstance(value, np.datetime64):
        # Convert numpy datetime64 to ISO format string
        return pd.Timestamp(value).isoformat()
    elif isinstance(value, datetime.time):
        # Convert time objects to string
        return value.isoformat()
    elif isinstance(value, np.integer):
        return int(value)
    elif isinstance(value, np.floating):
        return float(value)
    elif isinstance(value, np.bool_):
        return bool(value)
    elif isinstance(value, np.ndarray):
        return value.tolist()
    elif isinstance(value, (list, tuple)):
        return [_convert_value_for_json(item) for item in value]
    elif isinstance(value, dict):
        return {key: _convert_value_for_json(val) for key, val in value.items()}
    elif hasattr(value, 'item'):  # numpy scalar
        return value.item()
    else:
        return value

# Global evaluation service instance
evaluation_service = EvaluationService()

def validate_test_data(data: List[Dict]) -> Dict[str, Any]:
    """Validate test data format - flexible validation for column mapping"""
    if not data:
        return {
            "isValid": False,
            "errors": ["Test data cannot be empty"],
            "total_rows": 0,
            "fields": [],
            "field_coverage": {},
            "sample_data": []
        }
    
    errors = []
    warnings = []
    
    # Check first few rows for basic structure
    sample_size = min(5, len(data))
    for i, row in enumerate(data[:sample_size]):
        if not isinstance(row, dict):
            errors.append(f"Row {i} is not a valid object")
    
    # Count fields and analyze data
    field_counts = {}
    for row in data:
        if isinstance(row, dict):
            for field in row.keys():
                field_counts[field] = field_counts.get(field, 0) + 1
    
    # Check if we have any fields at all
    if not field_counts:
        errors.append("No valid data fields found")
    
    # Basic data quality checks
    total_rows = len(data)
    for field, count in field_counts.items():
        coverage_percentage = (count / total_rows) * 100
        if coverage_percentage < 50:
            warnings.append(f"Field '{field}' has low coverage ({coverage_percentage:.1f}%)")
    
    return {
        "isValid": len(errors) == 0,
        "errors": errors,
        "warnings": warnings,
        "total_rows": total_rows,
        "fields": list(field_counts.keys()),
        "field_coverage": field_counts,
        "sample_data": data[:3]  # First 3 rows as sample
    }

def validate_test_data_with_mapping(data: List[Dict], mapping: Dict[str, Any]) -> Dict[str, Any]:
    """Validate test data format with column mapping"""
    if not data:
        return {
            "isValid": False,
            "errors": ["Test data cannot be empty"],
            "warnings": []
        }
    
    errors = []
    warnings = []
    
    # Get available columns from first row
    if data and isinstance(data[0], dict):
        available_columns = list(data[0].keys())
    else:
        return {
            "isValid": False,
            "errors": ["Invalid data format"],
            "warnings": []
        }
    
    # Check input column mappings
    input_columns = mapping.get('input_columns', {})
    for model_field, file_column in input_columns.items():
        if file_column not in available_columns:
            errors.append(f"Input mapping error: Column '{file_column}' not found in data")
    
    # Check output column mappings (new structure)
    output_columns = mapping.get('output_columns', {})
    if output_columns:
        for json_field, csv_column in output_columns.items():
            if csv_column not in available_columns:
                errors.append(f"Output mapping error: Column '{csv_column}' not found for field '{json_field}'")
    else:
        # Legacy support for single output column
        output_column = mapping.get('output_column')
        if not output_column:
            warnings.append("No output fields mapped - accuracy calculation will be limited")
        elif output_column not in available_columns:
            errors.append(f"Output column '{output_column}' not found in data")
    
    # Data quality checks for output columns
    if output_columns:
        for json_field, csv_column in output_columns.items():
            if csv_column in available_columns:
                # Check output column quality
                output_values = [row.get(csv_column) for row in data[:100]]  # Sample first 100
                non_empty_values = [v for v in output_values if v is not None and str(v).strip()]
                
                if len(non_empty_values) < len(output_values) * 0.8:
                    warnings.append(f"Output column '{csv_column}' for field '{json_field}' has many empty values")
                
                unique_values = len(set(str(v) for v in non_empty_values))
                if unique_values < 2:
                    warnings.append(f"Output column '{csv_column}' for field '{json_field}' has very few unique values")
    
    return {
        "isValid": len(errors) == 0,
        "errors": errors,
        "warnings": warnings
    }

def load_test_data_from_file(file_path: str) -> tuple[List[Dict], str]:
    """Load test data from CSV, JSON, JSONL, or Pickle file"""
    file_extension = os.path.splitext(file_path)[1].lower()
    
    if file_extension == '.csv':
        # Simple CSV parsing without pandas
        import csv
        data = []
        with open(file_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                data.append(dict(row))
        return data, 'csv'
    
    elif file_extension == '.json':
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        # Handle different JSON structures
        if isinstance(data, list):
            return data, 'json'
        elif isinstance(data, dict):
            # Convert single object to list
            return [data], 'json'
        else:
            raise ValueError("Invalid JSON format. Expected array of objects or single object.")
    
    elif file_extension == '.jsonl':
        data = []
        with open(file_path, 'r', encoding='utf-8') as f:
            for line in f:
                if line.strip():
                    data.append(json.loads(line))
        return data, 'jsonl'
    
    elif file_extension in ['.pkl', '.pickle']:
        # Load pickle file using pandas with robust data type conversion
        import pandas as pd
        import datetime
        import numpy as np
        
        try:
            df = pd.read_pickle(file_path)
            
            # Ensure it's a DataFrame
            if not isinstance(df, pd.DataFrame):
                raise ValueError("Pickle file must contain a pandas DataFrame")
            
            # Convert DataFrame to list of dictionaries with robust data type handling
            # Use the same robust conversion logic as data preparation
            data = []
            for _, row in df.iterrows():
                record = {}
                for col, value in row.items():
                    # Handle various data types for JSON serialization using robust conversion
                    record[col] = _convert_value_for_json(value)
                
                data.append(record)
            
            return data, 'pickle'
            
        except Exception as e:
            raise ValueError(f"Error loading pickle file: {str(e)}")
    
    else:
        raise ValueError(f"Unsupported file format: {file_extension}. Supported: .csv, .json, .jsonl, .pkl, .pickle")
