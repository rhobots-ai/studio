from fastapi import FastAPI, HTTPException, BackgroundTasks, UploadFile, File, Form, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, StreamingResponse
from pydantic import BaseModel
from typing import Optional, Dict, Any, Union, List
from contextlib import asynccontextmanager
import asyncio
import threading
import json
import os
from datetime import datetime
import uuid
import pandas as pd
import tempfile
import shutil
import base64
import logging

# Import enhanced models and config processor
from models.training_models import TrainerConfig, TrainingArgsConfig, EnhancedFinetuneRequest
from config_processor import merge_trainer_and_training_configs, validate_hub_configuration, get_config_summary

# Import IST timezone utilities
from timezone_utils import get_ist_timestamp, get_ist_datetime, convert_to_ist_timestamp

# Import the training functionality
from train_with_logging import train_with_config

# Import the model manager for chat functionality
from model_manager import model_manager

# Import the evaluation service
from evaluation_service import evaluation_service, validate_test_data, load_test_data_from_file

# Import the file manager
from file_manager import file_manager

# Import monitoring services
from services.monitoring_service import system_monitor
from services.alert_service import alert_manager
from api.routes.monitoring_routes import router as monitoring_router, broadcast_metrics, broadcast_alerts
from api.routes.file_routes import router as file_router
from api.routes.dataset_routes import router as dataset_router
from api.routes.prediction_routes import router as prediction_router
from api.routes.evaluation_routes import router as evaluation_router
from core.websocket_manager import websocket_manager, connection_cleanup_task

# Lifespan function to manage startup and shutdown
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logging.info("Starting monitoring services...")
    
    # Start system monitoring
    monitoring_task = asyncio.create_task(system_monitor.start_monitoring())
    
    # Start metrics broadcasting
    broadcast_task = asyncio.create_task(broadcast_metrics())
    
    # Start alerts broadcasting
    alerts_task = asyncio.create_task(broadcast_alerts())
    
    # Start connection cleanup
    cleanup_task = asyncio.create_task(connection_cleanup_task())
    
    # Add alert callback
    def on_alert(alert):
        logging.warning(f"ALERT: {alert.title} - {alert.message}")
    
    alert_manager.add_callback(on_alert)
    
    yield
    
    # Shutdown
    logging.info("Stopping monitoring services...")
    system_monitor.stop_monitoring()
    monitoring_task.cancel()
    broadcast_task.cancel()
    alerts_task.cancel()
    cleanup_task.cancel()

app = FastAPI(
    title="Model Finetuning API",
    description="API for finetuning language models with real-time logging and monitoring",
    version="1.0.0",
    lifespan=lifespan
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)

# Include monitoring router
app.include_router(monitoring_router)

# Include file management router
app.include_router(file_router)

# Include dataset management router
app.include_router(dataset_router)

# Include prediction router
app.include_router(prediction_router)

# Include evaluation router
app.include_router(evaluation_router)

# Store training jobs status
training_jobs: Dict[str, Dict[str, Any]] = {}

# Enhanced training session storage with folder structure
def create_session_directory(session_id: str) -> str:
    """Create a dedicated directory for a training session"""
    sessions_base_dir = "training_sessions"
    session_dir = os.path.join(sessions_base_dir, session_id)
    
    # Create main session directory
    if not os.path.exists(session_dir):
        os.makedirs(session_dir)
    
    # Create subdirectories
    subdirs = ['logs', 'config', 'data', 'checkpoints', 'outputs', 'artifacts']
    for subdir in subdirs:
        subdir_path = os.path.join(session_dir, subdir)
        if not os.path.exists(subdir_path):
            os.makedirs(subdir_path)
    
    return session_dir

def save_training_session(session_id: str, session_data: Dict[str, Any]):
    """Save training session to persistent storage with folder structure"""
    # Create session directory if it doesn't exist
    session_dir = create_session_directory(session_id)
    
    # Save main metadata
    metadata_file = os.path.join(session_dir, "metadata.json")
    with open(metadata_file, 'w') as f:
        json.dump(session_data, f, indent=2, default=str)
    
    # Save detailed configuration
    if 'config' in session_data:
        config_file = os.path.join(session_dir, "config", "training_config.json")
        with open(config_file, 'w') as f:
            json.dump(session_data['config'], f, indent=2, default=str)
    
    # Save dataset information
    if 'dataset_info' in session_data:
        dataset_file = os.path.join(session_dir, "config", "dataset_info.json")
        with open(dataset_file, 'w') as f:
            json.dump(session_data['dataset_info'], f, indent=2, default=str)
    
    # Update session data with directory paths
    session_data['session_directory'] = session_dir
    session_data['logs_directory'] = os.path.join(session_dir, "logs")
    session_data['config_directory'] = os.path.join(session_dir, "config")
    session_data['data_directory'] = os.path.join(session_dir, "data")
    session_data['checkpoints_directory'] = os.path.join(session_dir, "checkpoints")
    session_data['outputs_directory'] = os.path.join(session_dir, "outputs")
    session_data['artifacts_directory'] = os.path.join(session_dir, "artifacts")

def load_training_session(session_id: str) -> Optional[Dict[str, Any]]:
    """Load training session from persistent storage (folder structure)"""
    sessions_base_dir = "training_sessions"
    
    # Try new folder structure first
    session_dir = os.path.join(sessions_base_dir, session_id)
    metadata_file = os.path.join(session_dir, "metadata.json")
    
    if os.path.exists(metadata_file):
        try:
            with open(metadata_file, 'r') as f:
                session_data = json.load(f)
            
            # Add directory paths
            session_data['session_directory'] = session_dir
            session_data['logs_directory'] = os.path.join(session_dir, "logs")
            session_data['config_directory'] = os.path.join(session_dir, "config")
            session_data['data_directory'] = os.path.join(session_dir, "data")
            session_data['checkpoints_directory'] = os.path.join(session_dir, "checkpoints")
            session_data['outputs_directory'] = os.path.join(session_dir, "outputs")
            session_data['artifacts_directory'] = os.path.join(session_dir, "artifacts")
            
            return session_data
        except Exception as e:
            print(f"Error loading session {session_id}: {e}")
    
    # Fallback to old JSON file structure for backward compatibility
    old_session_file = os.path.join(sessions_base_dir, f"{session_id}.json")
    if os.path.exists(old_session_file):
        try:
            with open(old_session_file, 'r') as f:
                session_data = json.load(f)
            
            # Migrate to new folder structure
            migrate_session_to_folder(session_id, session_data)
            return session_data
        except Exception as e:
            print(f"Error loading legacy session {session_id}: {e}")
    
    return None

def migrate_session_to_folder(session_id: str, session_data: Dict[str, Any]):
    """Migrate old JSON session to new folder structure"""
    try:
        # Create new folder structure
        session_dir = create_session_directory(session_id)
        
        # Save to new structure
        save_training_session(session_id, session_data)
        
        # Remove old JSON file
        old_file = os.path.join("training_sessions", f"{session_id}.json")
        if os.path.exists(old_file):
            os.remove(old_file)
        
        print(f"Migrated session {session_id} to folder structure")
    except Exception as e:
        print(f"Error migrating session {session_id}: {e}")

def list_training_sessions() -> List[Dict[str, Any]]:
    """List all training sessions (both folder and legacy formats)"""
    sessions_base_dir = "training_sessions"
    sessions = []
    
    if not os.path.exists(sessions_base_dir):
        return sessions
    
    for item in os.listdir(sessions_base_dir):
        item_path = os.path.join(sessions_base_dir, item)
        
        # Check if it's a directory (new format)
        if os.path.isdir(item_path):
            session_data = load_training_session(item)
            if session_data:
                sessions.append(session_data)
        
        # Check if it's a JSON file (legacy format)
        elif item.endswith('.json'):
            session_id = item[:-5]  # Remove .json extension
            session_data = load_training_session(session_id)
            if session_data:
                sessions.append(session_data)
    
    return sessions

def save_session_logs(session_id: str, logs: List[Dict[str, Any]]):
    """Save logs to session-specific log files"""
    session_data = load_training_session(session_id)
    if not session_data:
        return
    
    logs_dir = session_data.get('logs_directory')
    if not logs_dir or not os.path.exists(logs_dir):
        return
    
    # Save training logs
    training_log_file = os.path.join(logs_dir, "training.log")
    metrics_file = os.path.join(logs_dir, "metrics.jsonl")
    
    with open(training_log_file, 'w') as f:
        for log in logs:
            f.write(f"[{log.get('timestamp', '')}] {log.get('level', 'INFO')}: {log.get('message', '')}\n")
    
    with open(metrics_file, 'w') as f:
        for log in logs:
            if log.get('type') in ['training_step', 'epoch_end', 'metrics']:
                f.write(json.dumps(log) + '\n')

def save_training_data_copy(session_id: str, data_file_path: str):
    """Save a copy of training data to session directory"""
    session_data = load_training_session(session_id)
    if not session_data:
        return
    
    data_dir = session_data.get('data_directory')
    if not data_dir or not os.path.exists(data_dir):
        return
    
    # Copy training data file
    if os.path.exists(data_file_path):
        filename = os.path.basename(data_file_path)
        dest_path = os.path.join(data_dir, f"training_data_{filename}")
        shutil.copy2(data_file_path, dest_path)
        
        # Update session metadata with data file path
        session_data['training_data_file'] = dest_path
        save_training_session(session_id, session_data)

def get_session_files(session_id: str) -> Dict[str, Any]:
    """Get all files and directories for a session"""
    session_data = load_training_session(session_id)
    if not session_data:
        return {}
    
    session_dir = session_data.get('session_directory')
    if not session_dir or not os.path.exists(session_dir):
        return {}
    
    files_info = {
        'session_id': session_id,
        'session_directory': session_dir,
        'directories': {},
        'files': {}
    }
    
    # Scan each subdirectory
    subdirs = ['logs', 'config', 'data', 'checkpoints', 'outputs', 'artifacts']
    for subdir in subdirs:
        subdir_path = os.path.join(session_dir, subdir)
        if os.path.exists(subdir_path):
            files_info['directories'][subdir] = []
            for file in os.listdir(subdir_path):
                file_path = os.path.join(subdir_path, file)
                if os.path.isfile(file_path):
                    file_stat = os.stat(file_path)
                    files_info['directories'][subdir].append({
                        'name': file,
                        'path': file_path,
                        'size': file_stat.st_size,
                        'modified': datetime.fromtimestamp(file_stat.st_mtime).isoformat()
                    })
    
    # Add main metadata file
    metadata_file = os.path.join(session_dir, "metadata.json")
    if os.path.exists(metadata_file):
        file_stat = os.stat(metadata_file)
        files_info['files']['metadata'] = {
            'name': 'metadata.json',
            'path': metadata_file,
            'size': file_stat.st_size,
            'modified': datetime.fromtimestamp(file_stat.st_mtime).isoformat()
        }
    
    return files_info

# Configuration management models
class ConfigSaveRequest(BaseModel):
    name: str
    description: Optional[str] = ""
    basic_parameters: Dict[str, Any]
    advanced_parameters: Dict[str, Any]

class ConfigResponse(BaseModel):
    status: str
    message: str
    config_name: Optional[str] = None

class ConfigListResponse(BaseModel):
    status: str
    configs: List[Dict[str, Any]]
    total: int

class FinetuneRequest(BaseModel):
    file_id: Optional[str] = None  # Use uploaded file by ID
    dataset_name: Optional[str] = "alpaca"  # Made optional with default
    model_name: Optional[str] = "unsloth/llama-3-8b-bnb-4bit"
    max_seq_length: Optional[int] = 2048
    num_train_epochs: Optional[int] = 3
    per_device_train_batch_size: Optional[int] = 2
    gradient_accumulation_steps: Optional[int] = 4
    learning_rate: Optional[float] = 2e-4
    max_steps: Optional[int] = 60
    warmup_steps: Optional[int] = 5
    save_steps: Optional[int] = 25
    logging_steps: Optional[int] = 1
    output_dir: Optional[str] = "./results"
    lora_r: Optional[int] = 16
    lora_alpha: Optional[int] = 16
    lora_dropout: Optional[float] = 0.0
    max_sample_size: Optional[int] = None  # Limit number of training samples
    
    class Config:
        # Allow extra fields to be ignored
        extra = "ignore"

class FinetuneBase64Request(BaseModel):
    file_content: str  # base64 encoded file content
    file_type: str     # "csv", "json", "jsonl"
    model_name: Optional[str] = "unsloth/llama-3-8b-bnb-4bit"
    max_seq_length: Optional[int] = 2048
    num_train_epochs: Optional[int] = 3
    per_device_train_batch_size: Optional[int] = 2
    gradient_accumulation_steps: Optional[int] = 4
    learning_rate: Optional[float] = 2e-4
    max_steps: Optional[int] = 60
    warmup_steps: Optional[int] = 5
    save_steps: Optional[int] = 25
    logging_steps: Optional[int] = 1
    output_dir: Optional[str] = "./results"
    lora_r: Optional[int] = 16
    lora_alpha: Optional[int] = 16
    lora_dropout: Optional[float] = 0.0
    
    class Config:
        # Allow extra fields to be ignored
        extra = "ignore"

class FinetuneResponse(BaseModel):
    job_id: str
    status: str
    message: str
    dashboard_url: Optional[str] = None

class JobStatusResponse(BaseModel):
    job_id: str
    status: str
    progress: Optional[Dict[str, Any]] = None
    logs: Optional[list] = None
    error: Optional[str] = None

# Chat API Models
class ChatMessage(BaseModel):
    role: str  # "user" or "assistant"
    content: str

class SingleChatRequest(BaseModel):
    message: str
    model_path: Optional[str] = None
    max_tokens: Optional[int] = 150
    temperature: Optional[float] = 0.7
    do_sample: Optional[bool] = True

class ConversationChatRequest(BaseModel):
    messages: List[ChatMessage]
    model_path: Optional[str] = None
    max_tokens: Optional[int] = 150
    temperature: Optional[float] = 0.7

class ChatResponse(BaseModel):
    status: str
    message: str
    response: str
    model_path: Optional[str] = None

class ModelLoadRequest(BaseModel):
    model_path: str
    max_seq_length: Optional[int] = 2048

class ModelResponse(BaseModel):
    status: str
    message: str
    model_path: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None

def validate_data_file(data: pd.DataFrame, file_type: str) -> Dict[str, Any]:
    """Validate data format for training (supports CSV and JSON)"""
    required_columns = ['instruction', 'output']
    optional_columns = ['input']
    
    # Check if required columns exist
    missing_columns = [col for col in required_columns if col not in data.columns]
    if missing_columns:
        raise ValueError(f"Missing required columns: {missing_columns}")
    
    # Check for empty data
    if len(data) == 0:
        raise ValueError(f"{file_type.upper()} file is empty")
    
    # Check for null values in required columns
    null_counts = {}
    for col in required_columns:
        null_count = data[col].isnull().sum()
        if null_count > 0:
            null_counts[col] = null_count
    
    return {
        "total_rows": len(data),
        "columns": list(data.columns),
        "null_counts": null_counts,
        "sample_data": data.head(3).to_dict('records'),
        "file_type": file_type.upper()
    }

def load_data_file(file_path: str) -> tuple[pd.DataFrame, str]:
    """Load data from CSV or JSON file"""
    file_extension = os.path.splitext(file_path)[1].lower()
    
    if file_extension == '.csv':
        df = pd.read_csv(file_path)
        return df, 'csv'
    
    elif file_extension == '.json':
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        # Handle different JSON structures
        if isinstance(data, list):
            # Array of objects: [{"instruction": "...", "output": "..."}, ...]
            df = pd.DataFrame(data)
        elif isinstance(data, dict):
            # Check if it's object with arrays: {"instruction": [...], "output": [...]}
            if all(isinstance(v, list) for v in data.values()):
                df = pd.DataFrame(data)
            else:
                # Single object, convert to single-row DataFrame
                df = pd.DataFrame([data])
        else:
            raise ValueError("Invalid JSON format. Expected array of objects or object with arrays.")
        
        return df, 'json'
    
    elif file_extension == '.jsonl':
        # Handle JSONL (JSON Lines) format
        data = []
        with open(file_path, 'r', encoding='utf-8') as f:
            for line in f:
                if line.strip():
                    data.append(json.loads(line))
        df = pd.DataFrame(data)
        return df, 'jsonl'
    
    else:
        raise ValueError(f"Unsupported file format: {file_extension}. Supported formats: .csv, .json, .jsonl")

def run_training_job_with_data_file(job_id: str, data_file_path: str, config: Dict[str, Any]):
    """Run training with data file (CSV/JSON) in a separate thread"""
    try:
        training_jobs[job_id]["status"] = "running"
        training_jobs[job_id]["started_at"] = get_ist_timestamp()
        
        # Save updated session to persistent storage
        save_training_session(job_id, training_jobs[job_id])
        
        # Save a copy of training data to session directory
        save_training_data_copy(job_id, data_file_path)
        
        # Update config to use session-specific output directory
        session_data = load_training_session(job_id)
        # if session_data and session_data.get('outputs_directory'):
        #     config['output_dir'] = session_data['outputs_directory']
        
        # Call training function with data file and config
        train_with_config(data_file_path, config, job_id)
        
        training_jobs[job_id]["status"] = "completed"
        training_jobs[job_id]["completed_at"] = get_ist_timestamp()
        training_jobs[job_id]["message"] = "Training completed successfully"
        
        # Save logs to session directory
        if os.path.exists('training_logs.jsonl'):
            try:
                with open('training_logs.jsonl', 'r') as f:
                    logs = [json.loads(line) for line in f.readlines()]
                save_session_logs(job_id, logs)
            except Exception as log_error:
                print(f"Warning: Could not save session logs: {log_error}")
        
        # Save final session state to persistent storage
        save_training_session(job_id, training_jobs[job_id])
        
    except Exception as e:
        training_jobs[job_id]["status"] = "failed"
        training_jobs[job_id]["error"] = str(e)
        training_jobs[job_id]["failed_at"] = get_ist_timestamp()
        
        # Save failed session state to persistent storage
        save_training_session(job_id, training_jobs[job_id])
    finally:
        # Clean up temporary data file
        if os.path.exists(data_file_path):
            os.remove(data_file_path)

def run_training_job_with_file_id(job_id: str, file_id: str, config: Dict[str, Any]):
    """Run training with file_id from file manager"""
    try:
        training_jobs[job_id]["status"] = "running"
        training_jobs[job_id]["started_at"] = get_ist_timestamp()
        
        # Save updated session to persistent storage
        save_training_session(job_id, training_jobs[job_id])
        
        # Get file path from file manager
        file_path = file_manager.get_file_path(file_id)
        if not file_path:
            raise ValueError(f"File with ID {file_id} not found")
        
        # Update file usage statistics
        file_manager.update_file_usage(file_id, job_id)
        
        # Call training function with file path and config
        train_with_config(file_path, config, job_id)
        
        training_jobs[job_id]["status"] = "completed"
        training_jobs[job_id]["completed_at"] = get_ist_timestamp()
        training_jobs[job_id]["message"] = "Training completed successfully"
        
        # Save logs to session directory
        if os.path.exists('training_logs.jsonl'):
            try:
                with open('training_logs.jsonl', 'r') as f:
                    logs = [json.loads(line) for line in f.readlines()]
                save_session_logs(job_id, logs)
            except Exception as log_error:
                print(f"Warning: Could not save session logs: {log_error}")
        
        # Save final session state to persistent storage
        save_training_session(job_id, training_jobs[job_id])
        
    except Exception as e:
        training_jobs[job_id]["status"] = "failed"
        training_jobs[job_id]["error"] = str(e)
        training_jobs[job_id]["failed_at"] = datetime.now().isoformat()
        
        # Save failed session state to persistent storage
        save_training_session(job_id, training_jobs[job_id])

def run_training_job_with_dataset(job_id: str, dataset_id: str, config: Dict[str, Any]):
    """Run training with dataset_id from dataset library"""
    try:
        training_jobs[job_id]["status"] = "running"
        training_jobs[job_id]["started_at"] = get_ist_timestamp()
        
        # Save updated session to persistent storage
        save_training_session(job_id, training_jobs[job_id])
        
        # Get dataset data from dataset service
        from services.dataset_service import dataset_service
        
        dataset_data = dataset_service.get_dataset_data(dataset_id)
        if not dataset_data:
            raise ValueError(f"Dataset with ID {dataset_id} not found or data not accessible")
        
        # Convert TrainingExample objects to dictionaries for JSON serialization
        training_data = []
        for example in dataset_data:
            if hasattr(example, 'dict'):
                # It's a Pydantic model, convert to dict
                training_data.append(example.dict())
            elif isinstance(example, dict):
                # It's already a dict
                training_data.append(example)
            else:
                # Convert to dict if possible
                training_data.append(dict(example))
        
        # Create temporary file with dataset data
        temp_dir = tempfile.mkdtemp()
        temp_file_path = os.path.join(temp_dir, f"dataset_{uuid.uuid4().hex}.json")
        
        with open(temp_file_path, 'w', encoding='utf-8') as f:
            json.dump(training_data, f, indent=2, ensure_ascii=False)
        
        # Save a copy of training data to session directory
        save_training_data_copy(job_id, temp_file_path)
        
        # Track dataset usage
        dataset_service.track_usage(dataset_id)
        
        # Call training function with dataset file path and config
        train_with_config(temp_file_path, config, job_id)
        
        training_jobs[job_id]["status"] = "completed"
        training_jobs[job_id]["completed_at"] = get_ist_timestamp()
        training_jobs[job_id]["message"] = "Training completed successfully"
        
        # Save logs to session directory
        if os.path.exists('training_logs.jsonl'):
            try:
                with open('training_logs.jsonl', 'r') as f:
                    logs = [json.loads(line) for line in f.readlines()]
                save_session_logs(job_id, logs)
            except Exception as log_error:
                print(f"Warning: Could not save session logs: {log_error}")
        
        # Save final session state to persistent storage
        save_training_session(job_id, training_jobs[job_id])
        
    except Exception as e:
        training_jobs[job_id]["status"] = "failed"
        training_jobs[job_id]["error"] = str(e)
        training_jobs[job_id]["failed_at"] = get_ist_timestamp()
        
        # Save failed session state to persistent storage
        save_training_session(job_id, training_jobs[job_id])
    finally:
        # Clean up temporary dataset file
        if 'temp_file_path' in locals() and os.path.exists(temp_file_path):
            os.remove(temp_file_path)
        if 'temp_dir' in locals() and os.path.exists(temp_dir):
            os.rmdir(temp_dir)

def run_training_job(job_id: str, config: FinetuneRequest):
    """Run training in a separate thread (legacy method)"""
    try:
        training_jobs[job_id]["status"] = "running"
        training_jobs[job_id]["started_at"] = datetime.now().isoformat()
        
        # Check if file_id is provided
        if config.file_id:
            # Use file from file manager
            file_path = file_manager.get_file_path(config.file_id)
            if not file_path:
                raise ValueError(f"File with ID {config.file_id} not found")
            
            # Update file usage statistics
            file_manager.update_file_usage(config.file_id, job_id)
            
            # Convert to dict and call training function with file
            config_dict = config.dict()
            config_dict.pop('file_id', None)  # Remove file_id from config
            train_with_config(file_path, config_dict, job_id)
        else:
            # Convert to dict and call new training function
            config_dict = config.dict()
            config_dict.pop('file_id', None)  # Remove file_id from config
            train_with_config(None, config_dict, job_id)
        
        training_jobs[job_id]["status"] = "completed"
        training_jobs[job_id]["completed_at"] = datetime.now().isoformat()
        training_jobs[job_id]["message"] = "Training completed successfully"
        
    except Exception as e:
        training_jobs[job_id]["status"] = "failed"
        training_jobs[job_id]["error"] = str(e)
        training_jobs[job_id]["failed_at"] = datetime.now().isoformat()

@app.get("/")
async def root():
    """Root endpoint with API information"""
    return {
        "message": "Model Finetuning & Chat API",
        "version": "1.0.0",
        "interfaces": {
            "/chat": "Web interface for chatting with fine-tuned models",
            "/dashboard": "Web interface for monitoring training progress",
            "/docs": "Interactive API documentation"
        },
        "endpoints": {
            "training": {
                "/finetune": "POST - Start a new finetuning job",
                "/jobs/{job_id}": "GET - Get job status",
                "/jobs": "GET - List all jobs",
                "/logs/{job_id}": "GET - Get job logs",
                "/dashboard": "GET - Get training dashboard"
            },
            "chat": {
                "/models/available": "GET - List available trained models",
                "/models/status": "GET - Get current loaded model status",
                "/models/load": "POST - Load a model for chat",
                "/models/unload": "POST - Unload current model",
                "/chat/single": "POST - Send single message to model",
                "/chat/conversation": "POST - Send conversation to model",
                "/chat/quick": "POST - Quick chat with query parameters",
                "/chat": "GET - Web chat interface"
            }
        }
    }

@app.post("/finetune-simple")
async def start_simple_finetuning(background_tasks: BackgroundTasks):
    """Start a simple finetuning job with default parameters"""
    
    # Create default request
    request = FinetuneRequest()
    
    # Generate unique job ID
    job_id = str(uuid.uuid4())
    
    # Initialize job tracking
    training_jobs[job_id] = {
        "id": job_id,
        "status": "queued",
        "config": request.dict(),
        "created_at": get_ist_timestamp(),
        "logs": []
    }
    
    # Start training in background
    background_tasks.add_task(run_training_job, job_id, request)
    
    return {
        "job_id": job_id,
        "status": "queued",
        "message": "Simple finetuning job started with default parameters",
        "dashboard_url": "https://finetune_engine.deepcite.in/dashboard"
    }

@app.post("/finetune")
async def start_finetuning_hybrid(
    request: Request,
    background_tasks: BackgroundTasks
):
    """Hybrid endpoint: Start finetuning with either multipart file upload or base64 JSON"""
    
    content_type = request.headers.get("content-type", "")
    
    if content_type.startswith("multipart/form-data"):
        # Handle multipart file upload
        return await handle_multipart_request(request, background_tasks)
    elif content_type.startswith("application/json"):
        # Handle base64 JSON request
        return await handle_base64_request(request, background_tasks)
    else:
        raise HTTPException(
            status_code=400,
            detail="Content-Type must be either 'multipart/form-data' or 'application/json'"
        )

async def handle_multipart_request(request: Request, background_tasks: BackgroundTasks):
    """Handle multipart file upload request"""
    try:
        # Parse multipart form data
        form = await request.form()
        
        # Extract file
        data_file = form.get("data_file")
        if not data_file:
            raise HTTPException(status_code=400, detail="data_file is required")
        
        # Check if data_file is actually an UploadFile object
        if not hasattr(data_file, 'filename') or not hasattr(data_file, 'file'):
            raise HTTPException(status_code=400, detail="data_file must be a valid file upload")
        
        # Extract parameters with defaults
        model_name = str(form.get("model_name", "unsloth/llama-3-8b-bnb-4bit"))
        max_seq_length = int(form.get("max_seq_length", 2048))
        num_train_epochs = int(form.get("num_train_epochs", 3))
        per_device_train_batch_size = int(form.get("per_device_train_batch_size", 2))
        gradient_accumulation_steps = int(form.get("gradient_accumulation_steps", 4))
        learning_rate = float(form.get("learning_rate", 2e-4))
        max_steps = int(form.get("max_steps", 60))
        warmup_steps = int(form.get("warmup_steps", 5))
        save_steps = int(form.get("save_steps", 25))
        logging_steps = int(form.get("logging_steps", 1))
        output_dir = str(form.get("output_dir", "./results"))
        lora_r = int(form.get("lora_r", 16))
        lora_alpha = int(form.get("lora_alpha", 16))
        lora_dropout = float(form.get("lora_dropout", 0.0))
        
        # Validate file type
        allowed_extensions = ['.csv', '.json', '.jsonl']
        if not data_file.filename:
            raise HTTPException(status_code=400, detail="File must have a filename")
        
        file_extension = os.path.splitext(data_file.filename)[1].lower()
        
        if file_extension not in allowed_extensions:
            raise HTTPException(
                status_code=400, 
                detail=f"File must be one of: {', '.join(allowed_extensions)}. Got: {file_extension}"
            )
        
        # Validate parameters
        if max_steps <= 0:
            raise HTTPException(status_code=400, detail="max_steps must be greater than 0")
        
        if num_train_epochs <= 0:
            raise HTTPException(status_code=400, detail="num_train_epochs must be greater than 0")
        
        if learning_rate <= 0 or learning_rate > 1:
            raise HTTPException(status_code=400, detail="learning_rate must be between 0 and 1")
        
        # Save uploaded file temporarily
        temp_dir = tempfile.mkdtemp()
        temp_file_path = os.path.join(temp_dir, f"training_data_{uuid.uuid4().hex}{file_extension}")
        
        with open(temp_file_path, "wb") as buffer:
            shutil.copyfileobj(data_file.file, buffer)
        
        # Load and validate data file
        try:
            df, file_type = load_data_file(temp_file_path)
            validation_result = validate_data_file(df, file_type)
        except Exception as e:
            # Clean up temp file
            if os.path.exists(temp_file_path):
                os.remove(temp_file_path)
            raise HTTPException(status_code=400, detail=f"Invalid {file_extension} file: {str(e)}")
        
        # Generate unique job ID
        job_id = str(uuid.uuid4())
        
        # Prepare configuration
        config = {
            "model_name": model_name,
            "max_seq_length": max_seq_length,
            "num_train_epochs": num_train_epochs,
            "per_device_train_batch_size": per_device_train_batch_size,
            "gradient_accumulation_steps": gradient_accumulation_steps,
            "learning_rate": learning_rate,
            "max_steps": max_steps,
            "warmup_steps": warmup_steps,
            "save_steps": save_steps,
            "logging_steps": logging_steps,
            "output_dir": output_dir,
            "lora_r": lora_r,
            "lora_alpha": lora_alpha,
            "lora_dropout": lora_dropout
        }
        
        # Initialize job tracking
        session_data = {
            "id": job_id,
            "status": "queued",
            "config": config,
            "dataset_info": validation_result,
            "created_at": get_ist_timestamp(),
            "logs": [],
            "upload_method": "multipart"
        }
        
        training_jobs[job_id] = session_data
        
        # Save session to persistent storage
        save_training_session(job_id, session_data)
        
        # Start training in background
        background_tasks.add_task(run_training_job_with_data_file, job_id, temp_file_path, config)
        
        return {
            "job_id": job_id,
            "status": "queued",
            "message": f"Finetuning job queued with {validation_result['total_rows']} training samples from {validation_result['file_type']} file (multipart upload)",
            "dashboard_url": f"https://finetune_engine.deepcite.in/training/{job_id}",
            "training_url": f"https://finetune_engine.deepcite.in/training/{job_id}",
            "dataset_info": validation_result,
            "config": config
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing multipart request: {str(e)}")

async def handle_base64_request(request: Request, background_tasks: BackgroundTasks):
    """Handle base64 JSON request"""
    try:
        # Parse JSON body
        body = await request.json()
        base64_request = FinetuneBase64Request(**body)
        
        # Validate file type
        allowed_file_types = ['csv', 'json', 'jsonl']
        if base64_request.file_type.lower() not in allowed_file_types:
            raise HTTPException(
                status_code=400,
                detail=f"file_type must be one of: {', '.join(allowed_file_types)}. Got: {base64_request.file_type}"
            )
        
        # Validate parameters
        if base64_request.max_steps <= 0:
            raise HTTPException(status_code=400, detail="max_steps must be greater than 0")
        
        if base64_request.num_train_epochs <= 0:
            raise HTTPException(status_code=400, detail="num_train_epochs must be greater than 0")
        
        if base64_request.learning_rate <= 0 or base64_request.learning_rate > 1:
            raise HTTPException(status_code=400, detail="learning_rate must be between 0 and 1")
        
        # Decode base64 content
        try:
            file_content = base64.b64decode(base64_request.file_content)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid base64 encoding: {str(e)}")
        
        # Create temporary file
        temp_dir = tempfile.mkdtemp()
        file_extension = f".{base64_request.file_type.lower()}"
        temp_file_path = os.path.join(temp_dir, f"training_data_{uuid.uuid4().hex}{file_extension}")
        
        with open(temp_file_path, "wb") as f:
            f.write(file_content)
        
        # Load and validate data file
        try:
            df, file_type = load_data_file(temp_file_path)
            validation_result = validate_data_file(df, file_type)
        except Exception as e:
            # Clean up temp file
            if os.path.exists(temp_file_path):
                os.remove(temp_file_path)
            raise HTTPException(status_code=400, detail=f"Invalid {base64_request.file_type} content: {str(e)}")
        
        # Generate unique job ID
        job_id = str(uuid.uuid4())
        # Prepare configuration
        config = {
            "model_name": base64_request.model_name,
            "max_seq_length": base64_request.max_seq_length,
            "num_train_epochs": base64_request.num_train_epochs,
            "per_device_train_batch_size": base64_request.per_device_train_batch_size,
            "gradient_accumulation_steps": base64_request.gradient_accumulation_steps,
            "learning_rate": base64_request.learning_rate,
            "max_steps": base64_request.max_steps,
            "warmup_steps": base64_request.warmup_steps,
            "save_steps": base64_request.save_steps,
            "logging_steps": base64_request.logging_steps,
            "output_dir": base64_request.output_dir,
            "lora_r": base64_request.lora_r,
            "lora_alpha": base64_request.lora_alpha,
            "lora_dropout": base64_request.lora_dropout
        }
        
        # Initialize job tracking
        training_jobs[job_id] = {
            "id": job_id,
            "status": "queued",
            "config": config,
            "dataset_info": validation_result,
            "created_at": get_ist_timestamp(),
            "logs": [],
            "upload_method": "base64"
        }
        
        # Start training in background
        background_tasks.add_task(run_training_job_with_data_file, job_id, temp_file_path, config)
        
        return {
            "job_id": job_id,
            "status": "queued",
            "message": f"Finetuning job queued with {validation_result['total_rows']} training samples from {validation_result['file_type']} content (base64 upload)",
            "dashboard_url": "https://finetune_engine.deepcite.in/dashboard",
            "dataset_info": validation_result,
            "config": config
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing base64 request: {str(e)}")

@app.post("/finetune-with-file", response_model=FinetuneResponse)
async def start_finetuning_with_file_id(
    file_id: str,
    request: EnhancedFinetuneRequest,
    background_tasks: BackgroundTasks
):
    """Start finetuning with enhanced structured configuration"""
    try:
        # Extract configurations
        trainer_config = request.trainer_config
        training_args_config = request.training_args_config
        
        # Validate model name
        if not trainer_config.model_name or trainer_config.model_name.strip() == '':
            raise HTTPException(status_code=400, detail='Model name is required')
        
        # Validate Hub configuration if enabled
        hub_validation_errors = validate_hub_configuration(trainer_config)
        if hub_validation_errors:
            error_messages = [f"{field}: {error}" for field, error in hub_validation_errors.items()]
            raise HTTPException(status_code=400, detail=f"Hub configuration errors: {'; '.join(error_messages)}")
        
        # Merge configurations for training
        merged_config = merge_trainer_and_training_configs(trainer_config, training_args_config)
        
        # Get configuration summary for logging
        config_summary = get_config_summary(trainer_config, training_args_config)
        
        # Check if it's a dataset ID or file ID
        if file_id.startswith('dataset_'):
            # It's a dataset ID, use dataset service
            from services.dataset_service import dataset_service
            
            dataset = dataset_service.get_dataset(file_id)
            if not dataset:
                raise HTTPException(status_code=404, detail=f"Dataset with ID {file_id} not found")
            
            # Generate unique job ID
            job_id = str(uuid.uuid4())
            
            # Initialize job tracking with enhanced structured config
            session_data = {
                "id": job_id,
                "status": "queued",
                "trainer_config": trainer_config.dict(),
                "training_args_config": training_args_config.dict(),
                "merged_config": merged_config,  # For backward compatibility
                "config_summary": config_summary,
                "dataset_id": file_id,
                "dataset_info": {
                    "name": dataset.name,
                    "total_examples": dataset.total_examples,
                    "source_filename": dataset.source_filename,
                    "file_size": dataset.file_size
                },
                "created_at": get_ist_timestamp(),
                "logs": [],
                "upload_method": "dataset_library_enhanced"
            }
            
            training_jobs[job_id] = session_data
            
            # Save session to persistent storage
            save_training_session(job_id, session_data)
            
            # Start training in background with dataset
            background_tasks.add_task(run_training_job_with_dataset, job_id, file_id, merged_config)
            
            return FinetuneResponse(
                job_id=job_id,
                status="queued",
                message=f"Enhanced finetuning job queued with dataset '{dataset.name}' ({dataset.total_examples} examples)",
                dashboard_url=f"https://finetune_engine.deepcite.in/training/{job_id}"
            )
        else:
            # It's a file ID, use file manager
            file_info = file_manager.get_file_info(file_id)
            if not file_info:
                raise HTTPException(status_code=404, detail=f"File with ID {file_id} not found")
            
            # Validate file status
            if file_info.get('validation_status') != 'valid':
                raise HTTPException(
                    status_code=400, 
                    detail=f"File validation failed: {file_info.get('validation_details', {}).get('issues', ['Unknown validation error'])}"
                )
            
            # Generate unique job ID
            job_id = str(uuid.uuid4())
            
            # Initialize job tracking with enhanced structured config
            session_data = {
                "id": job_id,
                "status": "queued",
                "trainer_config": trainer_config.dict(),
                "training_args_config": training_args_config.dict(),
                "merged_config": merged_config,  # For backward compatibility
                "config_summary": config_summary,
                "file_id": file_id,
                "file_info": file_info,
                "dataset_info": file_info.get('validation_details', {}),
                "created_at": get_ist_timestamp(),
                "logs": [],
                "upload_method": "file_manager_enhanced"
            }
            
            training_jobs[job_id] = session_data
            
            # Save session to persistent storage
            save_training_session(job_id, session_data)
            
            # Start training in background with file_id
            background_tasks.add_task(run_training_job_with_file_id, job_id, file_id, merged_config)
            
            return FinetuneResponse(
                job_id=job_id,
                status="queued",
                message=f"Enhanced finetuning job queued with model '{trainer_config.model_name}' using file '{file_info['display_name']}' ({file_info['validation_details']['total_rows']} samples)",
                dashboard_url=f"https://finetune_engine.deepcite.in/training/{job_id}"
            )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error starting enhanced training: {str(e)}")

@app.post("/finetune-legacy", response_model=FinetuneResponse)
async def start_finetuning_legacy(request: FinetuneRequest, background_tasks: BackgroundTasks):
    """Start a new finetuning job (legacy endpoint without CSV upload)"""
    
    try:
        # Validate request parameters
        if request.max_steps and request.max_steps <= 0:
            raise HTTPException(status_code=400, detail="max_steps must be greater than 0")
        
        if request.num_train_epochs and request.num_train_epochs <= 0:
            raise HTTPException(status_code=400, detail="num_train_epochs must be greater than 0")
        
        if request.learning_rate and (request.learning_rate <= 0 or request.learning_rate > 1):
            raise HTTPException(status_code=400, detail="learning_rate must be between 0 and 1")
        
        # Generate unique job ID
        job_id = str(uuid.uuid4())
        
        # Initialize job tracking
        training_jobs[job_id] = {
            "id": job_id,
            "status": "queued",
            "config": request.dict(),
            "created_at": get_ist_timestamp(),
            "logs": []
        }
        
        # Start training in background
        background_tasks.add_task(run_training_job, job_id, request)
        
        return FinetuneResponse(
            job_id=job_id,
            status="queued",
            message="Finetuning job has been queued and will start shortly",
            dashboard_url="https://finetune_engine.deepcite.in/dashboard"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error starting training job: {str(e)}")

@app.get("/jobs/{job_id}", response_model=JobStatusResponse)
async def get_job_status(job_id: str):
    """Get the status of a specific training job"""
    
    if job_id not in training_jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    
    job = training_jobs[job_id]
    
    # Try to read logs if they exist
    logs = []
    if os.path.exists('training_logs.jsonl'):
        try:
            with open('training_logs.jsonl', 'r') as f:
                logs = [json.loads(line) for line in f.readlines()]
        except Exception:
            pass
    
    return JobStatusResponse(
        job_id=job_id,
        status=job["status"],
        progress=job.get("progress"),
        logs=logs[-10:],  # Return last 10 log entries
        error=job.get("error")
    )

@app.get("/jobs")
async def list_jobs():
    """List all training jobs"""
    return {
        "jobs": list(training_jobs.values()),
        "total": len(training_jobs)
    }

@app.get("/logs/{job_id}")
async def get_job_logs(job_id: str):
    """Get detailed logs for a specific job"""
    
    if job_id not in training_jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    
    logs = []
    if os.path.exists('training_logs.jsonl'):
        try:
            with open('training_logs.jsonl', 'r') as f:
                logs = [json.loads(line) for line in f.readlines()]
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error reading logs: {str(e)}")
    
    return {
        "job_id": job_id,
        "logs": logs
    }

# Monitoring API endpoints (moved from Flask to FastAPI)
@app.get("/api/logs")
async def get_training_logs():
    """API endpoint to get aggregated training logs from all sessions"""
    all_logs = []
    
    # Get all training sessions
    sessions = list_training_sessions()
    
    # Read logs from each session's log files
    for session in sessions:
        session_id = session.get('id')
        if not session_id:
            continue
        
        # Try to read from session-specific log files
        logs_dir = session.get('logs_directory')
        if logs_dir and os.path.exists(logs_dir):
            
            # Read from session-specific metrics.jsonl
            metrics_file = os.path.join(logs_dir, "metrics.jsonl")
            if os.path.exists(metrics_file):
                try:
                    with open(metrics_file, 'r') as f:
                        for line in f:
                            if line.strip():
                                log_entry = json.loads(line)
                                log_entry['source'] = 'session_specific'
                                log_entry['session_id'] = session_id
                                all_logs.append(log_entry)
                except Exception as e:
                    print(f"Warning: Could not read session metrics for {session_id}: {e}")
            
            # Read from session-specific console.log
            console_file = os.path.join(logs_dir, "console.log")
            if os.path.exists(console_file):
                try:
                    with open(console_file, 'r') as f:
                        for line in f:
                            if line.strip():
                                log_entry = json.loads(line)
                                log_entry['source'] = 'session_specific'
                                log_entry['session_id'] = session_id
                                all_logs.append(log_entry)
                except Exception as e:
                    print(f"Warning: Could not read session console logs for {session_id}: {e}")
    
    # Fallback: Read from global training_logs.jsonl if no session logs found
    if not all_logs and os.path.exists('training_logs.jsonl'):
        try:
            with open('training_logs.jsonl', 'r') as f:
                for line in f:
                    if line.strip():
                        log_entry = json.loads(line)
                        log_entry['source'] = 'global'
                        all_logs.append(log_entry)
        except Exception as e:
            print(f"Warning: Could not read global logs: {e}")
    
    # Also include any recent global logs that might not be in sessions yet
    if os.path.exists('training_logs.jsonl'):
        try:
            with open('training_logs.jsonl', 'r') as f:
                for line in f:
                    if line.strip():
                        log_entry = json.loads(line)
                        # Only add if not already included from session-specific logs
                        session_id = log_entry.get('session_id')
                        if session_id:
                            # Check if we already have logs for this session
                            existing_session_logs = [log for log in all_logs if log.get('session_id') == session_id]
                            if not existing_session_logs:
                                log_entry['source'] = 'global_fallback'
                                all_logs.append(log_entry)
                        else:
                            # Legacy log without session_id
                            log_entry['source'] = 'global_legacy'
                            all_logs.append(log_entry)
        except Exception as e:
            print(f"Warning: Could not read global logs for fallback: {e}")
    
    # Sort logs by timestamp (newest first)
    try:
        all_logs.sort(key=lambda x: x.get('timestamp', ''), reverse=True)
    except Exception as e:
        print(f"Warning: Could not sort logs: {e}")
    
    return {
        "logs": all_logs,
        "total_logs": len(all_logs),
        "sources": {
            "session_specific": len([log for log in all_logs if log.get('source') == 'session_specific']),
            "global_fallback": len([log for log in all_logs if log.get('source') == 'global_fallback']),
            "global_legacy": len([log for log in all_logs if log.get('source') == 'global_legacy'])
        }
    }

@app.get("/api/status")
async def get_training_status():
    """API endpoint to get training status"""
    status = {
        "status": "running",
        "timestamp": datetime.now().isoformat(),
        "log_count": 0
    }
    
    if os.path.exists('training_logs.jsonl'):
        try:
            with open('training_logs.jsonl', 'r') as f:
                lines = f.readlines()
                status["log_count"] = len(lines)
                
                if lines:
                    last_log = json.loads(lines[-1])
                    status["last_update"] = last_log.get("timestamp")
                    status["current_step"] = last_log.get("step", 0)
                    status["current_epoch"] = last_log.get("epoch", 0)
                    
                    if last_log.get("type") == "training_complete":
                        status["status"] = "completed"
        except Exception:
            pass
    
    return status

@app.get("/chat", response_class=HTMLResponse)
async def get_chat_interface():
    """Serve the chat interface"""
    try:
        with open('chat_interface.html', 'r', encoding='utf-8') as f:
            return f.read()
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Chat interface not found")

@app.get("/dashboard", response_class=HTMLResponse)
async def get_dashboard():
    """Serve the training dashboard"""
    dashboard_html = '''
<!DOCTYPE html>
<html>
<head>
    <title>Training Dashboard</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .container { max-width: 1200px; margin: 0 auto; }
        .status-card { background: #f5f5f5; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
        .charts-container { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; }
        .chart-container { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .logs-container { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .log-entry { padding: 8px; border-bottom: 1px solid #eee; font-family: monospace; font-size: 12px; }
        .log-info { color: #2196F3; }
        .log-error { color: #f44336; }
        .log-debug { color: #9E9E9E; }
        #status { font-size: 18px; font-weight: bold; }
        .running { color: #4CAF50; }
        .completed { color: #2196F3; }
        .failed { color: #f44336; }
    </style>
</head>
<body>
    <div class="container">
        <h1>Model Training Dashboard</h1>
        
        <div class="status-card">
            <h2>Training Status</h2>
            <div id="status">Loading...</div>
            <div id="progress"></div>
        </div>
        
        <div class="charts-container">
            <div class="chart-container">
                <h3>Training Loss</h3>
                <canvas id="lossChart"></canvas>
            </div>
            <div class="chart-container">
                <h3>Learning Rate</h3>
                <canvas id="lrChart"></canvas>
            </div>
        </div>
        
        <div class="logs-container">
            <h3>Recent Logs</h3>
            <div id="logs" style="height: 300px; overflow-y: auto;"></div>
        </div>
    </div>

    <script>
        let lossChart, lrChart;
        
        function initCharts() {
            const lossCtx = document.getElementById('lossChart').getContext('2d');
            lossChart = new Chart(lossCtx, {
                type: 'line',
                data: {
                    labels: [],
                    datasets: [{
                        label: 'Training Loss',
                        data: [],
                        borderColor: 'rgb(75, 192, 192)',
                        tension: 0.1
                    }]
                },
                options: {
                    responsive: true,
                    scales: {
                        y: {
                            beginAtZero: false
                        }
                    }
                }
            });
            
            const lrCtx = document.getElementById('lrChart').getContext('2d');
            lrChart = new Chart(lrCtx, {
                type: 'line',
                data: {
                    labels: [],
                    datasets: [{
                        label: 'Learning Rate',
                        data: [],
                        borderColor: 'rgb(255, 99, 132)',
                        tension: 0.1
                    }]
                },
                options: {
                    responsive: true,
                    scales: {
                        y: {
                            beginAtZero: true
                        }
                    }
                }
            });
        }
        
        function updateDashboard() {
            fetch('/api/status')
                .then(response => response.json())
                .then(data => {
                    const statusEl = document.getElementById('status');
                    statusEl.textContent = `Status: ${data.status}`;
                    statusEl.className = data.status;
                    
                    const progressEl = document.getElementById('progress');
                    progressEl.innerHTML = `
                        <p>Current Step: ${data.current_step || 0}</p>
                        <p>Current Epoch: ${data.current_epoch || 0}</p>
                        <p>Last Update: ${data.last_update || 'N/A'}</p>
                        <p>Total Logs: ${data.log_count}</p>
                    `;
                });
            
            fetch('/api/logs')
                .then(response => response.json())
                .then(data => {
                    updateCharts(data.logs);
                    updateLogs(data.logs);
                });
        }
        
        function updateCharts(logs) {
            const lossData = [];
            const lrData = [];
            const labels = [];
            
            logs.forEach(log => {
                if (log.type === 'training_step' && log.loss !== undefined) {
                    labels.push(log.step);
                    lossData.push(log.loss);
                    lrData.push(log.learning_rate);
                }
            });
            
            lossChart.data.labels = labels;
            lossChart.data.datasets[0].data = lossData;
            lossChart.update();
            
            lrChart.data.labels = labels;
            lrChart.data.datasets[0].data = lrData;
            lrChart.update();
        }
        
        function updateLogs(logs) {
            const logsEl = document.getElementById('logs');
            const recentLogs = logs.slice(-20).reverse();
            
            logsEl.innerHTML = recentLogs.map(log => `
                <div class="log-entry log-${log.level.toLowerCase()}">
                    [${log.timestamp}] ${log.level}: ${log.message}
                </div>
            `).join('');
        }
        
        // Initialize
        initCharts();
        updateDashboard();
        
        // Update every 2 seconds
        setInterval(updateDashboard, 2000);
    </script>
</body>
</html>
    '''
    return dashboard_html

@app.get("/dashboard-info")
async def get_dashboard_info():
    """Get dashboard information"""
    return {
        "dashboard_url": "https://finetune_engine.deepcite.in/dashboard",
        "status": "available",
        "description": "Real-time training monitoring dashboard"
    }

@app.delete("/jobs/{job_id}")
async def cancel_job(job_id: str):
    """Cancel a training job (if possible)"""
    
    if job_id not in training_jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    
    job = training_jobs[job_id]
    
    if job["status"] in ["completed", "failed"]:
        raise HTTPException(status_code=400, detail="Cannot cancel completed or failed job")
    
    # In a real implementation, you'd need to actually stop the training process
    # For now, we'll just mark it as cancelled
    training_jobs[job_id]["status"] = "cancelled"
    training_jobs[job_id]["cancelled_at"] = datetime.now().isoformat()
    
    return {
        "job_id": job_id,
        "status": "cancelled",
        "message": "Job has been cancelled"
    }

# ============================================================================
# TRAINING SESSION SPECIFIC ENDPOINTS
# ============================================================================

@app.get("/api/training/{session_id}/status")
async def get_training_session_status(session_id: str):
    """Get status of a specific training session"""
    
    print(f"DEBUG: Looking for session {session_id}")
    
    # Try to load from persistent storage first
    session_data = load_training_session(session_id)
    print(f"DEBUG: Persistent storage result: {session_data is not None}")
    
    if not session_data:
        # Fallback to in-memory storage
        print(f"DEBUG: In-memory jobs: {list(training_jobs.keys())}")
        if session_id not in training_jobs:
            # List available sessions for debugging
            available_sessions = list_training_sessions()
            print(f"DEBUG: Available persistent sessions: {[s.get('id') for s in available_sessions]}")
            raise HTTPException(
                status_code=404, 
                detail=f"Training session not found. Available sessions: {len(available_sessions)}"
            )
        session_data = training_jobs[session_id]
    
    # Try to read logs if they exist
    logs = []
    if os.path.exists('training_logs.jsonl'):
        try:
            with open('training_logs.jsonl', 'r') as f:
                logs = [json.loads(line) for line in f.readlines()]
        except Exception:
            pass
    
    return {
        "session_id": session_id,
        "status": session_data["status"],
        "config": session_data.get("config", {}),
        "dataset_info": session_data.get("dataset_info", {}),
        "created_at": session_data.get("created_at"),
        "started_at": session_data.get("started_at"),
        "completed_at": session_data.get("completed_at"),
        "progress": session_data.get("progress"),
        "logs": logs[-10:],  # Return last 10 log entries
        "error": session_data.get("error")
    }

@app.get("/api/training/{session_id}/logs")
async def get_training_session_logs(session_id: str):
    """Get detailed logs for a specific training session"""
    
    # Check if session exists
    session_data = load_training_session(session_id)
    if not session_data and session_id not in training_jobs:
        raise HTTPException(status_code=404, detail="Training session not found")
    
    logs = []
    
    # Try to read from session-specific training_logs.jsonl file first
    if session_data and session_data.get('logs_directory'):
        logs_dir = session_data['logs_directory']
        
        # Read from session-specific training_logs.jsonl
        session_training_logs_file = os.path.join(logs_dir, "training_logs.jsonl")
        if os.path.exists(session_training_logs_file):
            try:
                with open(session_training_logs_file, 'r') as f:
                    for line in f:
                        if line.strip():
                            logs.append(json.loads(line))
                print(f"Read {len(logs)} logs from session-specific training_logs.jsonl")
            except Exception as e:
                print(f"Warning: Could not read session training logs: {e}")
    
    # Fallback to global logs if no session-specific logs found
    if not logs and os.path.exists('training_logs.jsonl'):
        try:
            with open('training_logs.jsonl', 'r') as f:
                all_logs = [json.loads(line) for line in f.readlines() if line.strip()]
            
            # Filter logs for this specific session
            logs = [log for log in all_logs if log.get('session_id') == session_id]
            
            # If no session-specific logs found, return all logs for backward compatibility
            if not logs:
                logs = all_logs
                
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error reading logs: {str(e)}")
    
    return {
        "session_id": session_id,
        "logs": logs,
        "total_logs": len(logs),
        "source": "session_specific" if session_data and session_data.get('logs_directory') and os.path.exists(os.path.join(session_data['logs_directory'], "training_logs.jsonl")) else "global"
    }

@app.get("/api/training/{session_id}/metrics")
async def get_training_session_metrics(session_id: str):
    """Get training metrics for a specific session"""
    
    # Check if session exists
    session_data = load_training_session(session_id)
    if not session_data and session_id not in training_jobs:
        raise HTTPException(status_code=404, detail="Training session not found")
    
    logs = []
    
    # Try to read from session-specific metrics file first
    if session_data and session_data.get('logs_directory'):
        logs_dir = session_data['logs_directory']
        metrics_file = os.path.join(logs_dir, "metrics.jsonl")
        
        if os.path.exists(metrics_file):
            try:
                with open(metrics_file, 'r') as f:
                    for line in f:
                        if line.strip():
                            logs.append(json.loads(line))
            except Exception as e:
                print(f"Warning: Could not read session metrics: {e}")
    
    # Fallback to global logs if no session-specific metrics found
    if not logs and os.path.exists('training_logs.jsonl'):
        try:
            with open('training_logs.jsonl', 'r') as f:
                all_logs = [json.loads(line) for line in f.readlines() if line.strip()]
            
            # Filter logs for this specific session
            logs = [log for log in all_logs if log.get('session_id') == session_id]
            
            # If no session-specific logs found, return all logs for backward compatibility
            if not logs:
                logs = all_logs
                
        except Exception:
            pass
    
    # Extract metrics from logs
    training_metrics = []
    validation_metrics = []
    
    for log in logs:
        if log.get("type") == "training_step":
            training_metrics.append({
                "step": log.get("step", 0),
                "epoch": log.get("epoch", 0),
                "loss": log.get("loss"),
                "learning_rate": log.get("learning_rate"),
                "grad_norm": log.get("grad_norm"),
                "step_time": log.get("step_time"),
                "timestamp": log.get("timestamp")
            })
        elif log.get("type") == "epoch_end":
            validation_metrics.append({
                "epoch": log.get("epoch", 0),
                "train_loss": log.get("train_loss"),
                "eval_loss": log.get("eval_loss"),
                "timestamp": log.get("timestamp")
            })
    
    return {
        "session_id": session_id,
        "training_metrics": training_metrics,
        "validation_metrics": validation_metrics,
        "total_training_steps": len(training_metrics),
        "total_epochs": len(validation_metrics),
        "source": "session_specific" if session_data and session_data.get('logs_directory') else "global"
    }

@app.get("/api/training/sessions")
async def list_all_training_sessions(
    status: Optional[str] = None,
    limit: Optional[int] = None,
    offset: Optional[int] = 0,
    search: Optional[str] = None
):
    """List all training sessions with filtering and pagination"""
    
    # Get sessions from persistent storage
    persistent_sessions = list_training_sessions()
    
    # Get active sessions from memory
    active_sessions = list(training_jobs.values())
    
    # Combine and deduplicate
    all_sessions = {}
    
    # Add persistent sessions
    for session in persistent_sessions:
        all_sessions[session["id"]] = session
    
    # Add/update with active sessions
    for session in active_sessions:
        session_id = session["id"]
        if session_id in all_sessions:
            # Update with latest data from memory
            all_sessions[session_id].update(session)
        else:
            all_sessions[session_id] = session
    
    # Convert to list
    sessions_list = list(all_sessions.values())
    
    # Apply filters
    if status:
        sessions_list = [s for s in sessions_list if s.get("status") == status]
    
    if search:
        search_lower = search.lower()
        sessions_list = [
            s for s in sessions_list 
            if search_lower in s.get("id", "").lower() 
            or search_lower in s.get("config", {}).get("model_name", "").lower()
        ]
    
    # Sort by creation date (newest first)
    sessions_list.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    
    # Apply pagination
    total_sessions = len(sessions_list)
    if limit:
        sessions_list = sessions_list[offset:offset + limit]
    
    return {
        "sessions": sessions_list,
        "total": total_sessions,
        "limit": limit,
        "offset": offset
    }

@app.get("/api/training/dashboard/stats")
async def get_training_dashboard_stats():
    """Get training dashboard statistics"""
    
    # Get all sessions
    persistent_sessions = list_training_sessions()
    active_sessions = list(training_jobs.values())
    
    # Combine sessions
    all_sessions = {}
    for session in persistent_sessions:
        all_sessions[session["id"]] = session
    
    for session in active_sessions:
        session_id = session["id"]
        if session_id in all_sessions:
            all_sessions[session_id].update(session)
        else:
            all_sessions[session_id] = session
    
    sessions_list = list(all_sessions.values())
    
    # Calculate statistics
    total_sessions = len(sessions_list)
    
    # Count by status
    status_counts = {}
    for session in sessions_list:
        status = session.get("status", "unknown")
        status_counts[status] = status_counts.get(status, 0) + 1
    
    active_sessions_count = status_counts.get("running", 0) + status_counts.get("queued", 0) + status_counts.get("initializing", 0)
    completed_sessions = status_counts.get("completed", 0)
    failed_sessions = status_counts.get("failed", 0)
    
    # Calculate success rate
    finished_sessions = completed_sessions + failed_sessions
    success_rate = (completed_sessions / finished_sessions * 100) if finished_sessions > 0 else 0
    
    # Calculate average training time for completed sessions
    completed_session_times = []
    for session in sessions_list:
        if session.get("status") == "completed" and session.get("started_at") and session.get("completed_at"):
            try:
                start_time = datetime.fromisoformat(session["started_at"].replace('Z', '+00:00'))
                end_time = datetime.fromisoformat(session["completed_at"].replace('Z', '+00:00'))
                duration = (end_time - start_time).total_seconds()
                completed_session_times.append(duration)
            except:
                continue
    
    avg_training_time = sum(completed_session_times) / len(completed_session_times) if completed_session_times else 0
    
    # Most used models
    model_usage = {}
    for session in sessions_list:
        model_name = session.get("config", {}).get("model_name", "Unknown")
        model_usage[model_name] = model_usage.get(model_name, 0) + 1
    
    most_used_model = max(model_usage.items(), key=lambda x: x[1]) if model_usage else ("None", 0)
    
    return {
        "total_sessions": total_sessions,
        "active_sessions": active_sessions_count,
        "completed_sessions": completed_sessions,
        "failed_sessions": failed_sessions,
        "success_rate": round(success_rate, 1),
        "avg_training_time_seconds": round(avg_training_time, 0),
        "avg_training_time_formatted": format_duration(avg_training_time),
        "most_used_model": most_used_model[0],
        "status_breakdown": status_counts,
        "model_usage": model_usage
    }

def format_duration(seconds):
    """Format duration in seconds to human readable format"""
    if seconds < 60:
        return f"{int(seconds)}s"
    elif seconds < 3600:
        minutes = int(seconds // 60)
        return f"{minutes}m {int(seconds % 60)}s"
    else:
        hours = int(seconds // 3600)
        minutes = int((seconds % 3600) // 60)
        return f"{hours}h {minutes}m"

@app.get("/api/training/{session_id}/files")
async def get_training_session_files(session_id: str):
    """Get all files and directories for a training session"""
    
    # Check if session exists
    session_data = load_training_session(session_id)
    if not session_data and session_id not in training_jobs:
        raise HTTPException(status_code=404, detail="Training session not found")
    
    files_info = get_session_files(session_id)
    if not files_info:
        raise HTTPException(status_code=404, detail="Session files not found")
    
    return files_info

@app.get("/api/training/{session_id}/files/{file_type}/{filename}")
async def download_session_file(session_id: str, file_type: str, filename: str):
    """Download a specific file from a training session"""
    
    # Check if session exists
    session_data = load_training_session(session_id)
    if not session_data:
        raise HTTPException(status_code=404, detail="Training session not found")
    
    # Validate file type
    allowed_types = ['logs', 'config', 'data', 'checkpoints', 'outputs', 'artifacts']
    if file_type not in allowed_types:
        raise HTTPException(status_code=400, detail=f"Invalid file type. Must be one of: {allowed_types}")
    
    # Construct file path
    session_dir = session_data.get('session_directory')
    if not session_dir:
        raise HTTPException(status_code=404, detail="Session directory not found")
    
    file_path = os.path.join(session_dir, file_type, filename)
    
    # Check if file exists
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")
    
    # Return file as download
    def file_generator():
        with open(file_path, 'rb') as f:
            while True:
                chunk = f.read(8192)
                if not chunk:
                    break
                yield chunk
    
    return StreamingResponse(
        file_generator(),
        media_type='application/octet-stream',
        headers={
            'Content-Disposition': f'attachment; filename="{filename}"'
        }
    )

@app.get("/api/training/{session_id}/files/metadata")
async def get_session_metadata_file(session_id: str):
    """Download the metadata.json file for a training session"""
    
    # Check if session exists
    session_data = load_training_session(session_id)
    if not session_data:
        raise HTTPException(status_code=404, detail="Training session not found")
    
    session_dir = session_data.get('session_directory')
    if not session_dir:
        raise HTTPException(status_code=404, detail="Session directory not found")
    
    metadata_file = os.path.join(session_dir, "metadata.json")
    
    if not os.path.exists(metadata_file):
        raise HTTPException(status_code=404, detail="Metadata file not found")
    
    def file_generator():
        with open(metadata_file, 'rb') as f:
            while True:
                chunk = f.read(8192)
                if not chunk:
                    break
                yield chunk
    
    return StreamingResponse(
        file_generator(),
        media_type='application/json',
        headers={
            'Content-Disposition': f'attachment; filename="metadata_{session_id}.json"'
        }
    )

@app.post("/api/training/{session_id}/archive")
async def create_session_archive(session_id: str):
    """Create a ZIP archive of the entire training session"""
    
    # Check if session exists
    session_data = load_training_session(session_id)
    if not session_data:
        raise HTTPException(status_code=404, detail="Training session not found")
    
    session_dir = session_data.get('session_directory')
    if not session_dir or not os.path.exists(session_dir):
        raise HTTPException(status_code=404, detail="Session directory not found")
    
    import zipfile
    import tempfile
    
    # Create temporary zip file
    temp_zip = tempfile.NamedTemporaryFile(delete=False, suffix='.zip')
    temp_zip.close()
    
    try:
        with zipfile.ZipFile(temp_zip.name, 'w', zipfile.ZIP_DEFLATED) as zipf:
            # Walk through session directory and add all files
            for root, dirs, files in os.walk(session_dir):
                for file in files:
                    file_path = os.path.join(root, file)
                    # Create archive path relative to session directory
                    archive_path = os.path.relpath(file_path, session_dir)
                    zipf.write(file_path, archive_path)
        
        # Return zip file as download
        def file_generator():
            with open(temp_zip.name, 'rb') as f:
                while True:
                    chunk = f.read(8192)
                    if not chunk:
                        break
                    yield chunk
            # Clean up temp file after streaming
            os.unlink(temp_zip.name)
        
        return StreamingResponse(
            file_generator(),
            media_type='application/zip',
            headers={
                'Content-Disposition': f'attachment; filename="training_session_{session_id}.zip"'
            }
        )
        
    except Exception as e:
        # Clean up temp file on error
        if os.path.exists(temp_zip.name):
            os.unlink(temp_zip.name)
        raise HTTPException(status_code=500, detail=f"Error creating archive: {str(e)}")

@app.delete("/api/training/{session_id}")
async def delete_training_session(session_id: str):
    """Delete a training session and all its files"""
    
    # Check if session exists
    session_data = load_training_session(session_id)
    if not session_data:
        raise HTTPException(status_code=404, detail="Training session not found")
    
    session_dir = session_data.get('session_directory')
    if session_dir and os.path.exists(session_dir):
        try:
            # Remove entire session directory
            shutil.rmtree(session_dir)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error deleting session directory: {str(e)}")
    
    # Remove from in-memory storage if present
    if session_id in training_jobs:
        del training_jobs[session_id]
    
    return {
        "session_id": session_id,
        "status": "deleted",
        "message": "Training session and all associated files have been deleted"
    }

@app.get("/training/{session_id}", response_class=HTMLResponse)
async def get_training_session_page(session_id: str):
    """Serve a dedicated page for a specific training session"""
    
    # Check if session exists
    session_data = load_training_session(session_id)
    if not session_data and session_id not in training_jobs:
        raise HTTPException(status_code=404, detail="Training session not found")
    
    # Get session data
    if session_data:
        session_info = session_data
    else:
        session_info = training_jobs[session_id]
    
    session_html = f'''
<!DOCTYPE html>
<html>
<head>
    <title>Training Session {session_id}</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        body {{ font-family: Arial, sans-serif; margin: 20px; background-color: #f5f5f5; }}
        .container {{ max-width: 1200px; margin: 0 auto; }}
        .header {{ background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }}
        .session-info {{ display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; margin-bottom: 20px; }}
        .info-card {{ background: white; padding: 15px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }}
        .status-badge {{ padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: bold; }}
        .status-queued {{ background: #fef3c7; color: #92400e; }}
        .status-running {{ background: #d1fae5; color: #065f46; }}
        .status-completed {{ background: #dbeafe; color: #1e40af; }}
        .status-failed {{ background: #fee2e2; color: #991b1b; }}
        .charts-container {{ display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; }}
        .chart-container {{ background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }}
        .logs-container {{ background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }}
        .log-entry {{ padding: 8px; border-bottom: 1px solid #eee; font-family: monospace; font-size: 12px; }}
        .share-url {{ background: #f8f9fa; padding: 10px; border-radius: 4px; font-family: monospace; font-size: 14px; margin-top: 10px; }}
        .copy-btn {{ background: #007bff; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; margin-left: 10px; }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Training Session</h1>
            <p><strong>Session ID:</strong> {session_id}</p>
            <p><strong>Status:</strong> <span class="status-badge status-{session_info.get('status', 'unknown')}">{session_info.get('status', 'Unknown').title()}</span></p>
            <p><strong>Created:</strong> {session_info.get('created_at', 'Unknown')}</p>
            
            <div class="share-url">
                <strong>Share this training session:</strong><br>
                <span id="shareUrl">https://finetune_engine.deepcite.in/training/{session_id}</span>
                <button class="copy-btn" onclick="copyToClipboard()">Copy URL</button>
            </div>
        </div>
        
        <div class="session-info">
            <div class="info-card">
                <h3>Model Configuration</h3>
                <p><strong>Model:</strong> {session_info.get('config', {}).get('model_name', 'N/A')}</p>
                <p><strong>Epochs:</strong> {session_info.get('config', {}).get('num_train_epochs', 'N/A')}</p>
                <p><strong>Learning Rate:</strong> {session_info.get('config', {}).get('learning_rate', 'N/A')}</p>
            </div>
            
            <div class="info-card">
                <h3>Dataset Information</h3>
                <p><strong>Total Rows:</strong> {session_info.get('dataset_info', {}).get('total_rows', 'N/A')}</p>
                <p><strong>File Type:</strong> {session_info.get('dataset_info', {}).get('file_type', 'N/A')}</p>
                <p><strong>Upload Method:</strong> {session_info.get('upload_method', 'N/A')}</p>
            </div>
            
            <div class="info-card">
                <h3>Training Progress</h3>
                <p><strong>Current Status:</strong> {session_info.get('status', 'Unknown')}</p>
                <p><strong>Started:</strong> {session_info.get('started_at', 'Not started')}</p>
                <p><strong>Completed:</strong> {session_info.get('completed_at', 'Not completed')}</p>
            </div>
        </div>
        
        <div class="charts-container">
            <div class="chart-container">
                <h3>Training Loss</h3>
                <canvas id="lossChart"></canvas>
            </div>
            <div class="chart-container">
                <h3>Learning Rate</h3>
                <canvas id="lrChart"></canvas>
            </div>
        </div>
        
        <div class="logs-container">
            <h3>Training Logs</h3>
            <div id="logs" style="height: 400px; overflow-y: auto;"></div>
        </div>
    </div>

    <script>
        let lossChart, lrChart;
        const sessionId = '{session_id}';
        
        function initCharts() {{
            const lossCtx = document.getElementById('lossChart').getContext('2d');
            lossChart = new Chart(lossCtx, {{
                type: 'line',
                data: {{
                    labels: [],
                    datasets: [{{
                        label: 'Training Loss',
                        data: [],
                        borderColor: 'rgb(75, 192, 192)',
                        tension: 0.1
                    }}]
                }},
                options: {{
                    responsive: true,
                    scales: {{
                        y: {{
                            beginAtZero: false
                        }}
                    }}
                }}
            }});
            
            const lrCtx = document.getElementById('lrChart').getContext('2d');
            lrChart = new Chart(lrCtx, {{
                type: 'line',
                data: {{
                    labels: [],
                    datasets: [{{
                        label: 'Learning Rate',
                        data: [],
                        borderColor: 'rgb(255, 99, 132)',
                        tension: 0.1
                    }}]
                }},
                options: {{
                    responsive: true,
                    scales: {{
                        y: {{
                            beginAtZero: true
                        }}
                    }}
                }}
            }});
        }}
        
        function updateDashboard() {{
            fetch(`/api/training/${{sessionId}}/metrics`)
                .then(response => response.json())
                .then(data => {{
                    updateCharts(data.training_metrics);
                }});
            
            fetch(`/api/training/${{sessionId}}/logs`)
                .then(response => response.json())
                .then(data => {{
                    updateLogs(data.logs);
                }});
        }}
        
        function updateCharts(metrics) {{
            const lossData = [];
            const lrData = [];
            const labels = [];
            
            metrics.forEach(metric => {{
                if (metric.loss !== undefined) {{
                    labels.push(metric.step);
                    lossData.push(metric.loss);
                    lrData.push(metric.learning_rate);
                }}
            }});
            
            lossChart.data.labels = labels;
            lossChart.data.datasets[0].data = lossData;
            lossChart.update();
            
            lrChart.data.labels = labels;
            lrChart.data.datasets[0].data = lrData;
            lrChart.update();
        }}
        
        function updateLogs(logs) {{
            const logsEl = document.getElementById('logs');
            const recentLogs = logs.slice(-50).reverse();
            
            logsEl.innerHTML = recentLogs.map(log => `
                <div class="log-entry">
                    [${{log.timestamp}}] ${{log.level}}: ${{log.message}}
                </div>
            `).join('');
        }}
        
        function copyToClipboard() {{
            const url = document.getElementById('shareUrl').textContent;
            navigator.clipboard.writeText(url).then(() => {{
                alert('URL copied to clipboard!');
            }});
        }}
        
        // Initialize
        initCharts();
        updateDashboard();
        
        // Update every 3 seconds
        setInterval(updateDashboard, 3000);
    </script>
</body>
</html>
    '''
    
    return session_html

# ============================================================================
# CHAT API ENDPOINTS
# ============================================================================

@app.get("/api/models/available")
async def get_available_models():
    """Get list of available trained models"""
    try:
        models = model_manager.get_available_models()
        return {
            "status": "success",
            "models": models,
            "total": len(models)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting available models: {str(e)}")

@app.get("/api/models/huggingface")
async def get_huggingface_models():
    """Get curated list of popular verified Hugging Face models"""
    try:
        # Return curated list of verified popular models
        curated_models = [
            {
                "id": "microsoft-phi-3-mini-4k-instruct",
                "name": "microsoft/Phi-3-mini-4k-instruct",
                "description": "Microsoft Phi-3 Mini 4K context instruction model",
                "size": "3.8B",
                "architecture": "Phi-3",
                "family": "Microsoft",
                "isBase": True,
                "hf_model_id": "microsoft/Phi-3-mini-4k-instruct"
            },
            {
                "id": "meta-llama-3.2-3b-instruct",
                "name": "meta-llama/Llama-3.2-3B-Instruct",
                "description": "Meta Llama 3.2 3B instruction-tuned model",
                "size": "3B",
                "architecture": "Llama-3.2",
                "family": "Meta",
                "isBase": True,
                "hf_model_id": "meta-llama/Llama-3.2-3B-Instruct"
            },
            {
                "id": "mistralai-mistral-7b-instruct-v0.3",
                "name": "mistralai/Mistral-7B-Instruct-v0.3",
                "description": "Mistral 7B instruction-tuned model v0.3",
                "size": "7B",
                "architecture": "Mistral",
                "family": "Mistral",
                "isBase": True,
                "hf_model_id": "mistralai/Mistral-7B-Instruct-v0.3"
            },
            {
                "id": "google-gemma-2-2b-it",
                "name": "google/gemma-2-2b-it",
                "description": "Google Gemma 2 2B instruction-tuned model",
                "size": "2B",
                "architecture": "Gemma-2",
                "family": "Google",
                "isBase": True,
                "hf_model_id": "google/gemma-2-2b-it"
            },
            {
                "id": "qwen-qwen2.5-7b-instruct",
                "name": "Qwen/Qwen2.5-7B-Instruct",
                "description": "Qwen2.5 7B parameter instruction-tuned model",
                "size": "7B",
                "architecture": "Qwen2.5",
                "family": "Qwen",
                "isBase": True,
                "hf_model_id": "Qwen/Qwen2.5-7B-Instruct"
            }
        ]
        
        return {
            "status": "success",
            "models": curated_models,
            "total": len(curated_models)
        }
        
    except Exception as e:
        # Fallback to minimal list if any error
        fallback_models = [
            {
                "id": "microsoft-phi-3-mini-4k-instruct",
                "name": "microsoft/Phi-3-mini-4k-instruct",
                "description": "Microsoft 3.8B parameter instruction model",
                "size": "3.8B",
                "architecture": "Phi",
                "family": "Microsoft",
                "isBase": True,
                "hf_model_id": "microsoft/Phi-3-mini-4k-instruct"
            }
        ]
        
        return {
            "status": "success",
            "models": fallback_models,
            "total": len(fallback_models),
            "note": "Using fallback models"
        }

@app.get("/api/models/huggingface/search")
async def search_huggingface_models(query: str, limit: int = 20):
    """Search Hugging Face models without restrictions"""
    try:
        import requests
        import re
        
        def extract_model_size(model_name, tags=None):
            """Extract model size from name or tags"""
            name_lower = model_name.lower()
            
            # Common size patterns in model names
            size_patterns = [
                r'(\d+\.?\d*)b(?!yte)',  # 7b, 3.5b, etc.
                r'(\d+\.?\d*)-?b(?!yte)',  # 7-b, 3.5-b, etc.
            ]
            
            for pattern in size_patterns:
                match = re.search(pattern, name_lower)
                if match:
                    size = float(match.group(1))
                    return f"{size}B"
            
            # Check tags if available
            if tags:
                for tag in tags:
                    if isinstance(tag, str):
                        tag_lower = tag.lower()
                        for pattern in size_patterns:
                            match = re.search(pattern, tag_lower)
                            if match:
                                size = float(match.group(1))
                                return f"{size}B"
            
            return "Unknown"
        
        def get_organization(model_id):
            """Extract organization from model ID"""
            if '/' in model_id:
                return model_id.split('/')[0]
            return 'Unknown'
        
        # Search Hugging Face API
        response = requests.get(
            "https://huggingface.co/api/models",
            params={
                "search": query,
                "filter": "text-generation",
                "sort": "downloads",
                "direction": -1,
                "limit": limit
            },
            timeout=30.0
        )
        response.raise_for_status()
        search_results = response.json()
        
        # Process all results without filtering
        models = []
        for model in search_results:
            model_id = model.get('id', '')
            org = get_organization(model_id)
            size = extract_model_size(model_id, model.get('tags', []))
            downloads = model.get('downloads', 0)
            
            model_entry = {
                "id": model_id.replace('/', '-').lower(),
                "name": model_id,
                "description": f"{org} model with {downloads:,} downloads",
                "size": size,
                "architecture": org,
                "family": org,
                "isBase": True,
                "hf_model_id": model_id,
                "downloads": downloads
            }
            models.append(model_entry)
        
        return {
            "status": "success",
            "query": query,
            "models": models,
            "total": len(models)
        }
        
    except Exception as e:
        return {
            "status": "error",
            "query": query,
            "message": f"Search failed: {str(e)}",
            "models": [],
            "total": 0
        }

@app.get("/models/status")
async def get_model_status():
    """Get current loaded model status"""
    try:
        status = model_manager.get_model_status()
        return status
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting model status: {str(e)}")

@app.post("/api/models/load", response_model=ModelResponse)
async def load_model(request: ModelLoadRequest):
    """Load a specific model for chat"""
    try:
        result = model_manager.load_model(
            model_path=request.model_path,
            max_seq_length=request.max_seq_length
        )
        
        if result["status"] == "error":
            raise HTTPException(status_code=400, detail=result["message"])
        
        return ModelResponse(**result)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error loading model: {str(e)}")

@app.post("/api/models/unload", response_model=ModelResponse)
async def unload_model():
    """Unload the current model to free memory"""
    try:
        result = model_manager.unload_model()
        return ModelResponse(**result)
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error unloading model: {str(e)}")

@app.post("/chat/single", response_model=ChatResponse)
async def chat_single(request: SingleChatRequest):
    """Send a single message to the model and get a response"""
    try:
        # Load model if specified and not already loaded
        if request.model_path and model_manager.current_model_path != request.model_path:
            load_result = model_manager.load_model(request.model_path)
            if load_result["status"] == "error":
                raise HTTPException(status_code=400, detail=load_result["message"])
        
        # Generate response
        result = model_manager.generate_response(
            message=request.message,
            max_tokens=request.max_tokens,
            temperature=request.temperature,
            do_sample=request.do_sample
        )
        
        if result["status"] == "error":
            raise HTTPException(status_code=400, detail=result["message"])
        
        return ChatResponse(
            status=result["status"],
            message=result["message"],
            response=result["response"],
            model_path=model_manager.current_model_path
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating response: {str(e)}")

@app.post("/chat/conversation", response_model=ChatResponse)
async def chat_conversation(request: ConversationChatRequest):
    """Send a conversation with multiple turns and get a response"""
    try:
        # Validate messages format
        if not request.messages:
            raise HTTPException(status_code=400, detail="Messages list cannot be empty")
        
        for msg in request.messages:
            if msg.role not in ["user", "assistant"]:
                raise HTTPException(status_code=400, detail="Message role must be 'user' or 'assistant'")
        
        # Load model if specified and not already loaded
        if request.model_path and model_manager.current_model_path != request.model_path:
            load_result = model_manager.load_model(request.model_path)
            if load_result["status"] == "error":
                raise HTTPException(status_code=400, detail=load_result["message"])
        
        # Convert messages to dict format
        messages_dict = [{"role": msg.role, "content": msg.content} for msg in request.messages]
        
        # Generate response
        result = model_manager.generate_conversation_response(
            messages=messages_dict,
            max_tokens=request.max_tokens,
            temperature=request.temperature
        )
        
        if result["status"] == "error":
            raise HTTPException(status_code=400, detail=result["message"])
        
        return ChatResponse(
            status=result["status"],
            message=result["message"],
            response=result["response"],
            model_path=model_manager.current_model_path
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating conversation response: {str(e)}")

@app.post("/chat/quick")
async def chat_quick(message: str, model_path: Optional[str] = None):
    """Quick chat endpoint - send message as query parameter"""
    try:
        if not message.strip():
            raise HTTPException(status_code=400, detail="Message cannot be empty")
        
        # Load model if specified and not already loaded
        if model_path and model_manager.current_model_path != model_path:
            load_result = model_manager.load_model(model_path)
            if load_result["status"] == "error":
                raise HTTPException(status_code=400, detail=load_result["message"])
        
        # Generate response with default parameters
        result = model_manager.generate_response(
            message=message,
            max_tokens=150,
            temperature=0.7
        )
        
        if result["status"] == "error":
            raise HTTPException(status_code=400, detail=result["message"])
        
        return {
            "message": message,
            "response": result["response"],
            "model_path": model_manager.current_model_path
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error in quick chat: {str(e)}")

@app.post("/chat/stream")
async def chat_stream(request: SingleChatRequest):
    """Stream chat response token by token"""
    try:
        # Load model if specified and not already loaded
        if request.model_path and model_manager.current_model_path != request.model_path:
            load_result = model_manager.load_model(request.model_path)
            if load_result["status"] == "error":
                raise HTTPException(status_code=400, detail=load_result["message"])
        
        # Generate streaming response
        def generate_stream():
            for chunk in model_manager.generate_response_stream(
                message=request.message,
                max_tokens=request.max_tokens,
                temperature=request.temperature,
                do_sample=request.do_sample
            ):
                yield f"data: {chunk}\n\n"
        
        return StreamingResponse(
            generate_stream(),
            media_type="text/plain",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "*",
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error in streaming chat: {str(e)}")

# ============================================================================
# EVALUATION API ENDPOINTS
# ============================================================================

# Evaluation API Models
class EvaluationRequest(BaseModel):
    model_path: str
    test_data: List[Dict[str, Any]]
    batch_size: Optional[int] = 50

class EvaluationBase64Request(BaseModel):
    model_path: str
    file_content: str  # base64 encoded file content
    file_type: str     # "csv", "json", "jsonl"
    batch_size: Optional[int] = 50

class EvaluationResponse(BaseModel):
    job_id: str
    status: str
    message: str
    total_rows: int

class EvaluationStatusResponse(BaseModel):
    job_id: str
    status: str
    progress: Dict[str, Any]
    error: Optional[str] = None

@app.post("/evaluate/predict", response_model=EvaluationResponse)
async def start_prediction_job(request: EvaluationRequest):
    """Start a prediction job with test data"""
    try:
        # Validate model path
        if not request.model_path or not request.model_path.strip():
            raise HTTPException(status_code=400, detail="Model path is required")
        
        # Validate test data
        if not request.test_data:
            raise HTTPException(status_code=400, detail="Test data cannot be empty")
        
        # Validate test data format
        try:
            validation_result = validate_test_data(request.test_data)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid test data format: {str(e)}")
        
        # Create prediction job
        job_id = evaluation_service.create_prediction_job(
            model_path=request.model_path,
            test_data=request.test_data,
            batch_size=request.batch_size
        )
        
        return EvaluationResponse(
            job_id=job_id,
            status="queued",
            message=f"Prediction job created with {len(request.test_data)} test examples",
            total_rows=len(request.test_data)
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error creating prediction job: {str(e)}")

@app.post("/evaluate/predict-file")
async def start_prediction_job_with_file(
    request: Request
):
    """Start prediction job with file upload (multipart or base64)"""
    
    content_type = request.headers.get("content-type", "")
    
    if content_type.startswith("multipart/form-data"):
        return await handle_evaluation_multipart_request(request)
    elif content_type.startswith("application/json"):
        return await handle_evaluation_base64_request(request)
    else:
        raise HTTPException(
            status_code=400,
            detail="Content-Type must be either 'multipart/form-data' or 'application/json'"
        )

async def handle_evaluation_multipart_request(request: Request):
    """Handle multipart file upload for evaluation"""
    try:
        # Parse multipart form data
        form = await request.form()
        
        # Debug: Log form data
        print(f"DEBUG: Form keys: {list(form.keys())}")
        
        # Extract file and model path
        data_file = form.get("data_file")
        model_path = form.get("model_path")
        batch_size = int(form.get("batch_size", 50))
        
        print(f"DEBUG: data_file type: {type(data_file)}")
        print(f"DEBUG: model_path: {model_path}")
        print(f"DEBUG: batch_size: {batch_size}")
        
        if not data_file:
            raise HTTPException(status_code=400, detail="data_file is required")
        
        if not model_path:
            raise HTTPException(status_code=400, detail="model_path is required")
        
        # Check if data_file is actually an UploadFile object
        if not hasattr(data_file, 'filename') or not hasattr(data_file, 'file'):
            print(f"DEBUG: data_file attributes: {dir(data_file)}")
            raise HTTPException(status_code=400, detail="data_file must be a valid file upload")
        
        # Validate file type
        allowed_extensions = ['.csv', '.json', '.jsonl']
        if not data_file.filename:
            raise HTTPException(status_code=400, detail="File must have a filename")
        
        file_extension = os.path.splitext(data_file.filename)[1].lower()
        
        if file_extension not in allowed_extensions:
            raise HTTPException(
                status_code=400, 
                detail=f"File must be one of: {', '.join(allowed_extensions)}. Got: {file_extension}"
            )
        
        # Save uploaded file temporarily
        temp_dir = tempfile.mkdtemp()
        temp_file_path = os.path.join(temp_dir, f"test_data_{uuid.uuid4().hex}{file_extension}")
        
        with open(temp_file_path, "wb") as buffer:
            shutil.copyfileobj(data_file.file, buffer)
        
        # Load and validate test data
        try:
            test_data, file_type = load_test_data_from_file(temp_file_path)
            validation_result = validate_test_data(test_data)
        except Exception as e:
            # Clean up temp file
            if os.path.exists(temp_file_path):
                os.remove(temp_file_path)
            raise HTTPException(status_code=400, detail=f"Invalid {file_extension} file: {str(e)}")
        finally:
            # Clean up temp file
            if os.path.exists(temp_file_path):
                os.remove(temp_file_path)
        
        # Create prediction job
        job_id = evaluation_service.create_prediction_job(
            model_path=str(model_path),
            test_data=test_data,
            batch_size=batch_size
        )
        
        return {
            "job_id": job_id,
            "status": "queued",
            "message": f"Prediction job created with {len(test_data)} test examples from {file_type.upper()} file",
            "total_rows": len(test_data),
            "dataset_info": validation_result
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing evaluation request: {str(e)}")

async def handle_evaluation_base64_request(request: Request):
    """Handle base64 JSON request for evaluation"""
    try:
        # Parse JSON body
        try:
            body = await request.json()
        except Exception as json_error:
            raise HTTPException(status_code=400, detail=f"Invalid JSON in request body: {str(json_error)}")
        
        # Debug: Log the received body
        print(f"DEBUG: Received body keys: {list(body.keys()) if isinstance(body, dict) else 'Not a dict'}")
        
        eval_request = EvaluationBase64Request(**body)
        
        # Validate file type
        allowed_file_types = ['csv', 'json', 'jsonl']
        if eval_request.file_type.lower() not in allowed_file_types:
            raise HTTPException(
                status_code=400,
                detail=f"file_type must be one of: {', '.join(allowed_file_types)}. Got: {eval_request.file_type}"
            )
        
        # Decode base64 content
        try:
            file_content = base64.b64decode(eval_request.file_content)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid base64 encoding: {str(e)}")
        
        # Create temporary file
        temp_dir = tempfile.mkdtemp()
        file_extension = f".{eval_request.file_type.lower()}"
        temp_file_path = os.path.join(temp_dir, f"test_data_{uuid.uuid4().hex}{file_extension}")
        
        with open(temp_file_path, "wb") as f:
            f.write(file_content)
        
        # Load and validate test data
        try:
            test_data, file_type = load_test_data_from_file(temp_file_path)
            validation_result = validate_test_data(test_data)
        except Exception as e:
            # Clean up temp file
            if os.path.exists(temp_file_path):
                os.remove(temp_file_path)
            raise HTTPException(status_code=400, detail=f"Invalid {eval_request.file_type} content: {str(e)}")
        finally:
            # Clean up temp file
            if os.path.exists(temp_file_path):
                os.remove(temp_file_path)
        
        # Create prediction job
        job_id = evaluation_service.create_prediction_job(
            model_path=f"./results/{eval_request.model_path}",
            test_data=test_data,
            batch_size=eval_request.batch_size
        )
        
        return {
            "job_id": job_id,
            "status": "queued",
            "message": f"Prediction job created with {len(test_data)} test examples from {file_type.upper()} content",
            "total_rows": len(test_data),
            "dataset_info": validation_result
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing base64 evaluation request: {str(e)}")

@app.get("/evaluate/status/{job_id}", response_model=EvaluationStatusResponse)
async def get_evaluation_status(job_id: str):
    """Get status of an evaluation job"""
    
    job = evaluation_service.get_job_status(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Evaluation job not found")
    
    progress = {
        "completed_rows": job["completed_rows"],
        "total_rows": job["total_rows"],
        "progress_percentage": job["progress_percentage"],
        "estimated_completion_time": job.get("estimated_completion_time"),
        "avg_time_per_example": job.get("avg_time_per_example", 0),
        "processing_speed": job.get("processing_speed", 0)
    }
    
    return EvaluationStatusResponse(
        job_id=job_id,
        status=job["status"],
        progress=progress,
        error=job.get("error")
    )

@app.get("/evaluate/results/{job_id}")
async def get_evaluation_results(job_id: str):
    """Get results of a completed evaluation job"""
    
    results = evaluation_service.get_job_results(job_id)
    if results is None:
        job = evaluation_service.get_job_status(job_id)
        if not job:
            raise HTTPException(status_code=404, detail="Evaluation job not found")
        
        if job["status"] == "running":
            raise HTTPException(status_code=202, detail="Evaluation job is still running")
        elif job["status"] == "failed":
            raise HTTPException(status_code=400, detail=f"Evaluation job failed: {job.get('error', 'Unknown error')}")
        else:
            raise HTTPException(status_code=404, detail="Evaluation results not available")
    
    return {
        "job_id": job_id,
        "status": "completed",
        "total_results": len(results),
        "results": results
    }

@app.get("/evaluate/jobs")
async def list_evaluation_jobs():
    """List all evaluation jobs"""
    jobs = evaluation_service.list_jobs()
    return {
        "jobs": jobs,
        "total": len(jobs)
    }

@app.delete("/evaluate/jobs/{job_id}")
async def delete_evaluation_job(job_id: str):
    """Delete an evaluation job and its results"""
    
    success = evaluation_service.delete_job(job_id)
    if not success:
        raise HTTPException(status_code=404, detail="Evaluation job not found")
    
    return {
        "job_id": job_id,
        "status": "deleted",
        "message": "Evaluation job deleted successfully"
    }

# ============================================================================
# FILE MANAGEMENT ENDPOINTS
# ============================================================================

class FileUploadRequest(BaseModel):
    file_content: str  # base64 encoded file content
    original_filename: str
    display_name: Optional[str] = None

class FileUploadResponse(BaseModel):
    success: bool
    file_id: Optional[str] = None
    message: str
    metadata: Optional[Dict[str, Any]] = None

class FileListResponse(BaseModel):
    files: List[Dict[str, Any]]
    total: int
    storage_stats: Dict[str, Any]

class FileUpdateRequest(BaseModel):
    display_name: Optional[str] = None
    tags: Optional[List[str]] = None

@app.post("/api/files/upload", response_model=FileUploadResponse)
async def upload_training_file(
    request: Request
):
    """Upload a training data file (multipart or base64)"""
    
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
        allowed_extensions = ['.csv', '.json', '.jsonl']
        file_extension = os.path.splitext(data_file.filename)[1].lower()
        
        if file_extension not in allowed_extensions:
            raise HTTPException(
                status_code=400, 
                detail=f"File must be one of: {', '.join(allowed_extensions)}. Got: {file_extension}"
            )
        
        # Read file content
        file_content = await data_file.read()
        
        # Upload file using file manager
        result = file_manager.upload_file(
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
        upload_request = FileUploadRequest(**body)
        
        # Decode base64 content
        try:
            file_content = base64.b64decode(upload_request.file_content)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid base64 encoding: {str(e)}")
        
        # Validate file type
        allowed_extensions = ['.csv', '.json', '.jsonl']
        file_extension = os.path.splitext(upload_request.original_filename)[1].lower()
        
        if file_extension not in allowed_extensions:
            raise HTTPException(
                status_code=400, 
                detail=f"File must be one of: {', '.join(allowed_extensions)}. Got: {file_extension}"
            )
        
        # Upload file using file manager
        result = file_manager.upload_file(
            file_content=file_content,
            original_filename=upload_request.original_filename,
            display_name=upload_request.display_name
        )
        
        if result['success']:
            return FileUploadResponse(
                success=True,
                file_id=result['file_id'],
                message=f"File '{upload_request.original_filename}' uploaded successfully",
                metadata=result['metadata']
            )
        else:
            raise HTTPException(status_code=400, detail=result['error'])
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error uploading file: {str(e)}")

@app.get("/api/files", response_model=FileListResponse)
async def list_training_files(
    filter_by: Optional[str] = None,
    sort_by: Optional[str] = "upload_date",
    sort_desc: Optional[bool] = True
):
    """List all uploaded training files"""
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

@app.get("/api/files/{file_id}")
async def get_file_info(file_id: str):
    """Get detailed information about a specific file"""
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

@app.get("/api/files/{file_id}/preview")
async def get_file_preview(file_id: str, limit: int = 10):
    """Get preview data for a file"""
    try:
        file_info = file_manager.get_file_info(file_id)
        if not file_info:
            raise HTTPException(status_code=404, detail="File not found")
        
        preview_data = file_manager.get_file_preview(file_id, limit)
        if preview_data is None:
            raise HTTPException(status_code=404, detail="Preview data not available")
        
        return {
            "success": True,
            "file_id": file_id,
            "preview_data": preview_data,
            "total_rows": file_info.get('validation_details', {}).get('total_rows', 0),
            "showing_rows": len(preview_data)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting file preview: {str(e)}")

@app.get("/api/files/{file_id}/download")
async def download_file(file_id: str):
    """Download a training file"""
    try:
        file_info = file_manager.get_file_info(file_id)
        if not file_info:
            raise HTTPException(status_code=404, detail="File not found")
        
        file_path = file_manager.get_file_path(file_id)
        if not file_path or not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="File not found on disk")
        
        def file_generator():
            with open(file_path, 'rb') as f:
                while True:
                    chunk = f.read(8192)
                    if not chunk:
                        break
                    yield chunk
        
        return StreamingResponse(
            file_generator(),
            media_type='application/octet-stream',
            headers={
                'Content-Disposition': f'attachment; filename="{file_info["original_filename"]}"'
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error downloading file: {str(e)}")

@app.put("/api/files/{file_id}")
async def update_file_metadata(file_id: str, request: FileUpdateRequest):
    """Update file metadata (display name, tags, etc.)"""
    try:
        file_info = file_manager.get_file_info(file_id)
        if not file_info:
            raise HTTPException(status_code=404, detail="File not found")
        
        updates = {}
        if request.display_name is not None:
            updates['display_name'] = request.display_name
        if request.tags is not None:
            updates['tags'] = request.tags
        
        success = file_manager.update_file_metadata(file_id, updates)
        if not success:
            raise HTTPException(status_code=400, detail="Failed to update file metadata")
        
        return {
            "success": True,
            "message": "File metadata updated successfully",
            "file_id": file_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error updating file metadata: {str(e)}")

@app.post("/api/files/{file_id}/revalidate")
async def revalidate_file(file_id: str):
    """Re-validate a file and update its validation status"""
    try:
        file_info = file_manager.get_file_info(file_id)
        if not file_info:
            raise HTTPException(status_code=404, detail="File not found")
        
        success = file_manager.revalidate_file(file_id)
        if not success:
            raise HTTPException(status_code=400, detail="Failed to revalidate file")
        
        # Get updated file info
        updated_file_info = file_manager.get_file_info(file_id)
        
        return {
            "success": True,
            "message": "File revalidated successfully",
            "file_id": file_id,
            "validation_status": updated_file_info['validation_status'],
            "validation_details": updated_file_info['validation_details']
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error revalidating file: {str(e)}")

@app.delete("/api/files/{file_id}")
async def delete_file(file_id: str):
    """Delete a training file"""
    try:
        file_info = file_manager.get_file_info(file_id)
        if not file_info:
            raise HTTPException(status_code=404, detail="File not found")
        
        success = file_manager.delete_file(file_id)
        if not success:
            raise HTTPException(status_code=400, detail="Failed to delete file")
        
        return {
            "success": True,
            "message": f"File '{file_info['display_name']}' deleted successfully",
            "file_id": file_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error deleting file: {str(e)}")

@app.get("/api/files/stats")
async def get_storage_stats():
    """Get file storage statistics"""
    try:
        stats = file_manager.get_storage_stats()
        return {
            "success": True,
            "stats": stats
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting storage stats: {str(e)}")

# ============================================================================
# CONFIGURATION MANAGEMENT ENDPOINTS
# ============================================================================

def ensure_configs_directory():
    """Ensure the configs directory exists"""
    configs_dir = "configs"
    if not os.path.exists(configs_dir):
        os.makedirs(configs_dir)
    return configs_dir

def sanitize_filename(filename: str) -> str:
    """Sanitize filename to be safe for filesystem"""
    import re
    # Remove or replace invalid characters
    sanitized = re.sub(r'[<>:"/\\|?*]', '_', filename)
    # Remove leading/trailing spaces and dots
    sanitized = sanitized.strip(' .')
    # Limit length
    if len(sanitized) > 100:
        sanitized = sanitized[:100]
    return sanitized

@app.post("/api/configs/save", response_model=ConfigResponse)
async def save_configuration(request: ConfigSaveRequest):
    """Save a training configuration to file"""
    try:
        # Validate configuration name
        if not request.name or not request.name.strip():
            raise HTTPException(status_code=400, detail="Configuration name is required")
        
        # Sanitize filename
        safe_name = sanitize_filename(request.name.strip())
        if not safe_name:
            raise HTTPException(status_code=400, detail="Invalid configuration name")
        
        # Ensure configs directory exists
        configs_dir = ensure_configs_directory()
        config_file_path = os.path.join(configs_dir, f"{safe_name}.json")
        
        # Check if config already exists
        if os.path.exists(config_file_path):
            raise HTTPException(status_code=409, detail=f"Configuration '{request.name}' already exists")
        
        # Prepare configuration data
        config_data = {
            "metadata": {
                "name": request.name,
                "description": request.description,
                "created_at": get_ist_timestamp(),
                "version": "1.0"
            },
            "basic_parameters": request.basic_parameters,
            "advanced_parameters": request.advanced_parameters
        }
        
        # Save to file
        with open(config_file_path, 'w', encoding='utf-8') as f:
            json.dump(config_data, f, indent=2, ensure_ascii=False)
        
        return ConfigResponse(
            status="success",
            message=f"Configuration '{request.name}' saved successfully",
            config_name=request.name
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error saving configuration: {str(e)}")

@app.get("/api/configs/list", response_model=ConfigListResponse)
async def list_configurations():
    """List all saved configurations"""
    try:
        configs_dir = ensure_configs_directory()
        configs = []
        
        # Read all JSON files in configs directory
        for filename in os.listdir(configs_dir):
            if filename.endswith('.json'):
                config_path = os.path.join(configs_dir, filename)
                try:
                    with open(config_path, 'r', encoding='utf-8') as f:
                        config_data = json.load(f)
                    
                    # Extract metadata for list view
                    metadata = config_data.get('metadata', {})
                    config_summary = {
                        "name": metadata.get('name', filename[:-5]),  # Remove .json extension
                        "description": metadata.get('description', ''),
                        "created_at": metadata.get('created_at', ''),
                        "version": metadata.get('version', '1.0'),
                        "filename": filename
                    }
                    configs.append(config_summary)
                    
                except Exception as e:
                    # Skip invalid config files
                    print(f"Warning: Could not read config file {filename}: {e}")
                    continue
        
        # Sort by creation date (newest first)
        configs.sort(key=lambda x: x.get('created_at', ''), reverse=True)
        
        return ConfigListResponse(
            status="success",
            configs=configs,
            total=len(configs)
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error listing configurations: {str(e)}")

@app.get("/api/configs/{config_name}")
async def load_configuration(config_name: str):
    """Load a specific configuration"""
    try:
        # Sanitize the config name
        safe_name = sanitize_filename(config_name)
        if not safe_name:
            raise HTTPException(status_code=400, detail="Invalid configuration name")
        
        configs_dir = ensure_configs_directory()
        config_file_path = os.path.join(configs_dir, f"{safe_name}.json")
        
        # Check if config exists
        if not os.path.exists(config_file_path):
            raise HTTPException(status_code=404, detail=f"Configuration '{config_name}' not found")
        
        # Load configuration
        with open(config_file_path, 'r', encoding='utf-8') as f:
            config_data = json.load(f)
        
        return {
            "status": "success",
            "message": f"Configuration '{config_name}' loaded successfully",
            "config": config_data
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error loading configuration: {str(e)}")

@app.delete("/api/configs/{config_name}", response_model=ConfigResponse)
async def delete_configuration(config_name: str):
    """Delete a specific configuration"""
    try:
        # Sanitize the config name
        safe_name = sanitize_filename(config_name)
        if not safe_name:
            raise HTTPException(status_code=400, detail="Invalid configuration name")
        
        configs_dir = ensure_configs_directory()
        config_file_path = os.path.join(configs_dir, f"{safe_name}.json")
        
        # Check if config exists
        if not os.path.exists(config_file_path):
            raise HTTPException(status_code=404, detail=f"Configuration '{config_name}' not found")
        
        # Delete the file
        os.remove(config_file_path)
        
        return ConfigResponse(
            status="success",
            message=f"Configuration '{config_name}' deleted successfully",
            config_name=config_name
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error deleting configuration: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
