import os
import json
import sys
import threading
import shutil
from datetime import datetime
from unsloth import FastLanguageModel
from datasets import load_dataset
from transformers import TrainingArguments
from trl import SFTTrainer
import torch
import pandas as pd
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Import our custom logging callback
from log_monitor import DetailedLoggingCallback

# Import IST timezone utilities
from timezone_utils import get_ist_timestamp, get_ist_datetime, convert_to_ist_timestamp

# Import prediction service for model registration
from services.prediction_service import prediction_service
from models.prediction_models import ModelInfo, ModelStatus

def setup_model_and_tokenizer():
    """Setup Unsloth model and tokenizer"""
    model, tokenizer = FastLanguageModel.from_pretrained(
        model_name="unsloth/llama-3-8b-bnb-4bit",
        max_seq_length=2048,
        dtype=None,
        load_in_4bit=False,
    )
    
    model = FastLanguageModel.get_peft_model(
        model,
        r=16,
        target_modules=["q_proj", "k_proj", "v_proj", "o_proj",
                       "gate_proj", "up_proj", "down_proj"],
        lora_alpha=16,
        lora_dropout=0,
        bias="none",
        use_gradient_checkpointing="unsloth",
        random_state=3407,
        use_rslora=False,
        loftq_config=None,
    )
    
    return model, tokenizer

def prepare_dataset_from_file(file_path: str, tokenizer, max_sample_size: int = None):
    """Prepare dataset from CSV, JSON, or JSONL file with optional sampling"""
    file_extension = os.path.splitext(file_path)[1].lower()
    
    if file_extension == '.csv':
        # Load CSV data
        df = pd.read_csv(file_path)
    
    elif file_extension == '.json':
        # Load JSON data
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
    
    elif file_extension == '.jsonl':
        # Load JSONL data
        data = []
        with open(file_path, 'r', encoding='utf-8') as f:
            for line in f:
                if line.strip():
                    data.append(json.loads(line))
        df = pd.DataFrame(data)
    
    else:
        raise ValueError(f"Unsupported file format: {file_extension}")
    
    # Apply sampling if max_sample_size is specified
    original_size = len(df)
    if max_sample_size is not None and max_sample_size > 0 and max_sample_size < original_size:
        # Use random sampling to get a representative subset
        df = df.sample(n=max_sample_size, random_state=42).reset_index(drop=True)
        print(f"Dataset sampled: Using {len(df)} samples out of {original_size} available ({(len(df)/original_size)*100:.1f}%)")
    elif max_sample_size is not None and max_sample_size >= original_size:
        print(f"Max sample size ({max_sample_size}) is greater than or equal to available data ({original_size}). Using all data.")
    else:
        print(f"Using all available data: {original_size} samples")
    
    def formatting_prompts_func(examples):
        instructions = examples["instruction"]
        inputs = examples.get("input", [""] * len(instructions))  # Handle missing input column
        outputs = examples["output"]
        texts = []
        
        for instruction, input_text, output in zip(instructions, inputs, outputs):
            text = f"### Instruction:\n{instruction}\n\n"
            if input_text and str(input_text).strip() and str(input_text) != 'nan':  # Only add input if it exists and is not empty
                text += f"### Input:\n{input_text}\n\n"
            text += f"### Response:\n{output}"
            texts.append(text)
        
        return {"text": texts}
    
    # Convert DataFrame to HuggingFace Dataset
    from datasets import Dataset
    dataset = Dataset.from_pandas(df)
    dataset = dataset.map(formatting_prompts_func, batched=True)
    return dataset

def prepare_dataset_from_csv(csv_path: str, tokenizer):
    """Prepare dataset from CSV file (legacy function)"""
    return prepare_dataset_from_file(csv_path, tokenizer)

def prepare_dataset(tokenizer):
    """Prepare your dataset (legacy method)"""
    # Replace with your actual dataset loading
    dataset = load_dataset("your_dataset", split="train", token="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")
    
    def formatting_prompts_func(examples):
        instructions = examples["instruction"]
        inputs = examples["input"]
        outputs = examples["output"]
        texts = []
        
        for instruction, input_text, output in zip(instructions, inputs, outputs):
            text = f"### Instruction:\n{instruction}\n\n"
            if input_text:
                text += f"### Input:\n{input_text}\n\n"
            text += f"### Response:\n{output}"
            texts.append(text)
        
        return {"text": texts}
    
    dataset = dataset.map(formatting_prompts_func, batched=True)
    return dataset

def train_with_config(csv_path: str = None, config: dict = None, session_id: str = None):
    """Train model with configurable parameters and optional CSV data"""
    
    # Set default config if not provided
    if config is None:
        config = {
            "model_name": "unsloth/llama-3-8b-bnb-4bit",
            "max_seq_length": 2048,
            "num_train_epochs": 3,
            "per_device_train_batch_size": 2,
            "gradient_accumulation_steps": 4,
            "learning_rate": 2e-4,
            "max_steps": 60,
            "warmup_steps": 5,
            "save_steps": 25,
            "logging_steps": 1,
            "output_dir": "./results",
            "lora_r": 16,
            "lora_alpha": 16,
            "lora_dropout": 0.0,
            "hub_model_id": os.getenv("HUB_MODEL_ID")
        }
    
    # Define valid parameters for FastLanguageModel.from_pretrained
    VALID_MODEL_PARAMS = {
        "model_name", "max_seq_length", "dtype", "load_in_4bit", "load_in_8bit",
        "device_map", "torch_dtype", "attn_implementation", "trust_remote_code",
        "use_cache", "low_cpu_mem_usage", "revision", "subfolder", "token",
        "cache_dir", "force_download", "resume_download", "proxies", "local_files_only",
        "use_auth_token", "revision", "torch_dtype", "device_map", "max_memory",
        "offload_folder", "offload_state_dict", "load_in_8bit", "load_in_4bit",
        "quantization_config", "bnb_4bit_compute_dtype", "bnb_4bit_quant_type",
        "bnb_4bit_use_double_quant", "bnb_4bit_quant_storage"
    }
    
    # Define valid parameters for LoRA configuration
    VALID_LORA_PARAMS = {
        "r", "lora_alpha", "target_modules", "lora_dropout", "fan_in_fan_out",
        "bias", "modules_to_save", "init_lora_weights", "layers_to_transform",
        "layers_pattern", "rank_pattern", "alpha_pattern", "use_rslora",
        "use_dora", "layer_replication", "runtime_config", "loaded_in_8bit",
        "loaded_in_4bit", "loftq_config", "use_gradient_checkpointing",
        "random_state", "lora_rank", "lora_r"  # Include both naming conventions
    }
    
    # Define valid parameters for TrainingArguments
    VALID_TRAINING_PARAMS = {
        # Core training parameters
        "output_dir", "num_train_epochs", "per_device_train_batch_size", 
        "gradient_accumulation_steps", "learning_rate", "weight_decay",
        "warmup_steps", "warmup_ratio", "max_steps", "max_grad_norm",
        
        # Optimization parameters
        "optim", "adam_beta1", "adam_beta2", "adam_epsilon", "lr_scheduler_type",
        "lr_scheduler_kwargs", "polynomial_decay_power", "cosine_schedule_num_cycles",
        
        # Precision and performance
        "fp16", "bf16", "fp16_opt_level", "half_precision_backend", "bf16_full_eval",
        "tf32", "dataloader_drop_last", "dataloader_num_workers", "dataloader_pin_memory",
        
        # Logging and saving
        "logging_dir", "logging_strategy", "logging_steps", "logging_first_step",
        "save_strategy", "save_steps", "save_total_limit", "save_on_each_node",
        "save_safetensors", "save_only_model", "restore_callback_states_from_checkpoint",
        
        # Evaluation
        "evaluation_strategy", "eval_steps", "eval_delay", "per_device_eval_batch_size",
        "eval_accumulation_steps", "eval_on_start", "greater_is_better", "metric_for_best_model",
        
        # Advanced training
        "gradient_checkpointing", "gradient_checkpointing_kwargs", "include_inputs_for_metrics",
        "auto_find_batch_size", "full_determinism", "torchdynamo", "ray_scope",
        
        # Distributed training
        "local_rank", "ddp_backend", "ddp_broadcast_buffers", "ddp_bucket_cap_mb",
        "ddp_find_unused_parameters", "ddp_timeout", "dataloader_persistent_workers",
        
        # Reporting and debugging
        "report_to", "run_name", "disable_tqdm", "remove_unused_columns", "label_names",
        "load_best_model_at_end", "ignore_data_skip", "fsdp", "fsdp_config",
        
        # Memory optimization
        "deepspeed", "label_smoothing_factor", "debug", "sharded_ddp", "fsdp_transformer_layer_cls_to_wrap",
        
        # Reproducibility
        "seed", "data_seed", "jit_mode_eval", "use_ipex", "use_cpu", "use_mps_device",
        
        # Hub integration
        "push_to_hub", "hub_model_id", "hub_strategy", "hub_token", "hub_private_repo"
    }
    
    # Setup session-specific logging
    if session_id:
        session_logs_dir = f"training_sessions/{session_id}/logs"
        os.makedirs(session_logs_dir, exist_ok=True)
        
        # Session-specific log files
        training_log_file = os.path.join(session_logs_dir, "training.log")
        metrics_log_file = os.path.join(session_logs_dir, "metrics.jsonl")
        console_log_file = os.path.join(session_logs_dir, "console.log")
        errors_log_file = os.path.join(session_logs_dir, "errors.log")
        
        # Also create a global log file for backward compatibility
        global_log_file = 'training_logs.jsonl'
        
        print(f"Starting training with session-specific logging...")
        print(f"Session ID: {session_id}")
        print(f"Logs directory: {session_logs_dir}")
        print(f"Dashboard available at: http://localhost:8000/training/{session_id}")
    else:
        # Fallback to global logging
        global_log_file = 'training_logs.jsonl'
        training_log_file = None
        metrics_log_file = None
        console_log_file = None
        errors_log_file = None
        
        print("Starting training with global logging...")
        print("Dashboard available at: http://localhost:8000/dashboard")
    
    # Helper function to write logs to session-specific training_logs.jsonl file only
    def write_log_entry(log_entry, log_type="general"):
        # Write to session-specific training_logs.jsonl file if session_id is provided
        if session_id:
            session_training_log_file = os.path.join(session_logs_dir, "training_logs.jsonl")
            with open(session_training_log_file, 'a') as f:
                f.write(json.dumps(log_entry) + '\n')
        else:
            # Fallback to global log file if no session_id (for backward compatibility)
            with open('training_logs.jsonl', 'a') as f:
                f.write(json.dumps(log_entry) + '\n')
    
    # Log configuration
    log_entry = {
        "timestamp": get_ist_timestamp(),
        "type": "config_loaded",
        "level": "INFO",
        "message": "🔧 Training configuration loaded",
        "step": 0,
        "epoch": 0,
        "config": config,
        "session_id": session_id
    }
    write_log_entry(log_entry)
    
    # Log initialization steps
    log_entry = {
        "timestamp": get_ist_timestamp(),
        "type": "setup_start",
        "level": "INFO",
        "message": "🚀 Setting up model and tokenizer...",
        "step": 0,
        "epoch": 0,
        "session_id": session_id
    }
    write_log_entry(log_entry)
    
    # Setup model with configurable parameters
    # Get quantization setting from config
    quantization = config.get("quantization", "4bit")
    
    # Set quantization parameters based on user choice
    if quantization == "4bit":
        load_in_4bit = True
        load_in_8bit = False
    elif quantization == "8bit":
        load_in_4bit = False
        load_in_8bit = True
    else:  # "none"
        load_in_4bit = False
        load_in_8bit = False
    
    # Build model loading parameters with safe filtering
    model_params = {
        "model_name": config.get("model_name", "unsloth/llama-3-8b-bnb-4bit"),
        "max_seq_length": config.get("max_seq_length", 2048),
        "dtype": config.get("dtype", None),
        "load_in_4bit": load_in_4bit,
        "load_in_8bit": load_in_8bit,
    }
    
    # Add valid custom model parameters from config
    custom_model_params_applied = []
    for param_name, param_value in config.items():
        if param_name in VALID_MODEL_PARAMS and param_name not in model_params:
            model_params[param_name] = param_value
            custom_model_params_applied.append(f"{param_name}={param_value}")
    
    # Filter out None values to avoid issues
    model_params = {k: v for k, v in model_params.items() if v is not None}
    
    # Log custom model parameters being applied
    if custom_model_params_applied:
        log_entry = {
            "timestamp": get_ist_timestamp(),
            "type": "custom_model_params",
            "level": "INFO",
            "message": f"🔧 Applying custom model parameters: {', '.join(custom_model_params_applied)}",
            "step": 0,
            "epoch": 0,
            "session_id": session_id
        }
        write_log_entry(log_entry)
    
    model, tokenizer = FastLanguageModel.from_pretrained(**model_params)
    
    # Build LoRA parameters with safe filtering
    lora_params = {
        "r": config.get("lora_r", config.get("r", 16)),  # Support both naming conventions
        "target_modules": config.get("target_modules", ["q_proj", "k_proj", "v_proj", "o_proj",
                                                        "gate_proj", "up_proj", "down_proj"]),
        "lora_alpha": config.get("lora_alpha", 16),
        "lora_dropout": config.get("lora_dropout", 0.0),
        "bias": config.get("bias", "none"),
        "use_gradient_checkpointing": config.get("use_gradient_checkpointing", "unsloth"),
        "random_state": config.get("random_state", 3407),
        "use_rslora": config.get("use_rslora", False),
        "loftq_config": config.get("loftq_config", None),
    }
    
    # Add valid custom LoRA parameters from config
    custom_lora_params_applied = []
    for param_name, param_value in config.items():
        if param_name in VALID_LORA_PARAMS and param_name not in lora_params:
            # Handle naming convention differences
            if param_name == "lora_rank":
                lora_params["r"] = param_value
                custom_lora_params_applied.append(f"r={param_value} (from lora_rank)")
            else:
                lora_params[param_name] = param_value
                custom_lora_params_applied.append(f"{param_name}={param_value}")
    
    # Filter out None values to avoid issues
    lora_params = {k: v for k, v in lora_params.items() if v is not None}
    
    # Log custom LoRA parameters being applied
    if custom_lora_params_applied:
        log_entry = {
            "timestamp": get_ist_timestamp(),
            "type": "custom_lora_params",
            "level": "INFO",
            "message": f"🔧 Applying custom LoRA parameters: {', '.join(custom_lora_params_applied)}",
            "step": 0,
            "epoch": 0,
            "session_id": session_id
        }
        write_log_entry(log_entry)
    
    model = FastLanguageModel.get_peft_model(model, **lora_params)
    
    # Log model setup completion
    log_entry = {
        "timestamp": get_ist_timestamp(),
        "type": "model_loaded",
        "level": "INFO",
        "message": "✅ Model and tokenizer loaded successfully",
        "step": 0,
        "epoch": 0,
        "session_id": session_id
    }
    write_log_entry(log_entry)
    
    # Log dataset preparation
    log_entry = {
        "timestamp": get_ist_timestamp(),
        "type": "dataset_prep",
        "level": "INFO",
        "message": "📊 Preparing dataset...",
        "step": 0,
        "epoch": 0,
        "session_id": session_id
    }
    write_log_entry(log_entry)
    
    # Prepare dataset (file or default)
    actual_file_path = None
    if csv_path and os.path.exists(csv_path):
        max_sample_size = config.get("max_sample_size")
        dataset = prepare_dataset_from_file(csv_path, tokenizer, max_sample_size)
        file_extension = os.path.splitext(csv_path)[1].upper()
        dataset_source = f"{file_extension[1:]} file: {os.path.basename(csv_path)}"
        actual_file_path = os.path.abspath(csv_path)  # Store the full absolute path
    else:
        dataset = prepare_dataset(tokenizer)
        dataset_source = "Default HuggingFace dataset"
        actual_file_path = None
    
    # Log dataset preparation completion
    log_entry = {
        "timestamp": get_ist_timestamp(),
        "type": "dataset_ready",
        "level": "INFO",
        "message": f"✅ Dataset prepared and ready for training from {dataset_source}",
        "step": 0,
        "epoch": 0,
        "dataset_size": len(dataset) if dataset else 0,
        "session_id": session_id
    }
    write_log_entry(log_entry)
    
    # Build training arguments with safe filtering
    training_params = {
        "output_dir": config.get("output_dir", "./results"),
        "num_train_epochs": config.get("num_train_epochs", 3),
        "per_device_train_batch_size": config.get("per_device_train_batch_size", 2),
        "gradient_accumulation_steps": config.get("gradient_accumulation_steps", 4),
        "learning_rate": config.get("learning_rate", 2e-4),
        "warmup_steps": config.get("warmup_steps", 5),
        "logging_steps": config.get("logging_steps", 1),
        "save_steps": config.get("save_steps", 25),
        
        # Default values that can be overridden by custom parameters
        "optim": config.get("optim", "adamw_8bit"),
        "logging_dir": config.get("logging_dir", "./logs"),
        "save_total_limit": config.get("save_total_limit", 3),
        "dataloader_pin_memory": config.get("dataloader_pin_memory", False),
        "report_to": config.get("report_to", None),
        "fp16": config.get("fp16", not torch.cuda.is_bf16_supported()),
        "bf16": config.get("bf16", torch.cuda.is_bf16_supported()),
    }
    
    # Add valid custom training parameters from config
    custom_training_params_applied = []
    for param_name, param_value in config.items():
        if param_name in VALID_TRAINING_PARAMS and param_name not in training_params:
            training_params[param_name] = param_value
            custom_training_params_applied.append(f"{param_name}={param_value}")
    
    # Filter out None values to avoid issues
    training_params = {k: v for k, v in training_params.items() if v is not None}
    
    # Log custom training parameters being applied
    if custom_training_params_applied:
        log_entry = {
            "timestamp": get_ist_timestamp(),
            "type": "custom_training_params",
            "level": "INFO",
            "message": f"🔧 Applying custom training parameters: {', '.join(custom_training_params_applied)}",
            "step": 0,
            "epoch": 0,
            "session_id": session_id
        }
        write_log_entry(log_entry)
    
    # Create TrainingArguments with all parameters
    training_args = TrainingArguments(**training_params)
    
    # Log training arguments
    log_entry = {
        "timestamp": get_ist_timestamp(),
        "type": "training_args",
        "level": "INFO",
        "message": "⚙️ Training arguments configured",
        "step": 0,
        "epoch": 0,
        "training_args": {
            "num_train_epochs": training_args.num_train_epochs,
            "per_device_train_batch_size": training_args.per_device_train_batch_size,
            "learning_rate": training_args.learning_rate,
            "max_steps": training_args.max_steps,
            "warmup_steps": training_args.warmup_steps
        },
        "session_id": session_id
    }
    write_log_entry(log_entry)
    
    # Create trainer with custom callback
    trainer = SFTTrainer(
        model=model,
        tokenizer=tokenizer,
        train_dataset=dataset,
        dataset_text_field="text",
        max_seq_length=config.get("max_seq_length", 2048),
        dataset_num_proc=2,
        packing=False,
        args=training_args,
        callbacks=[DetailedLoggingCallback(logging_steps=config.get("logging_steps", 1), session_id=session_id)]
    )
    
    # Show model info
    trainer.model.print_trainable_parameters()
    
    # Start training
    print("Training started! Check the dashboard for real-time updates.")
    trainer_stats = trainer.train()
    
    # Save model
    model_output_dir = config.get("output_dir", "./results")
    # model_output_dir = "./results"
    model.save_pretrained(model_output_dir)
    tokenizer.save_pretrained(model_output_dir)

    completion_log = {
        "timestamp": get_ist_timestamp(),
        "type": "training_complete",
        "level": "INFO",
        "message": f"🎉 Training completed successfully! Model saved to {model_output_dir}",
        "step": trainer_stats.global_step if hasattr(trainer_stats, 'global_step') else 0,
        "epoch": 0,
        "stats": {
            "train_runtime": trainer_stats.metrics.get("train_runtime"),
            "train_samples_per_second": trainer_stats.metrics.get("train_samples_per_second"),
            "train_steps_per_second": trainer_stats.metrics.get("train_steps_per_second"),
            "total_flos": trainer_stats.metrics.get("total_flos"),
            "train_loss": trainer_stats.metrics.get("train_loss")
        },
        "session_id": session_id
    }
    write_log_entry(completion_log, "training_complete")

    # Push to Hugging Face Hub with proper validation
    model_id = config.get("hub_model_id")
    hf_token = os.getenv("HF_TOKEN")
    
    # Validate required parameters for hub pushing
    if model_id and hf_token:
        print(f"🚀 Pushing model to Hugging Face Hub: {model_id}")
        
        try:
            model.push_to_hub_merged(
                model_id,
                tokenizer,
                # save_method = "merged_16bit",
                token=hf_token
            )
            
            # Log successful hub push
            hub_success_log = {
                "timestamp": get_ist_timestamp(),
                "type": "hub_push_success",
                "level": "INFO",
                "message": f"✅ Model successfully pushed to Hugging Face Hub: {model_id}",
                "step": trainer_stats.global_step if hasattr(trainer_stats, 'global_step') else 0,
                "epoch": 0,
                "hub_model_id": model_id,
                "session_id": session_id
            }
            write_log_entry(hub_success_log, "hub_push")
            
            # clean up
            if os.path.exists(model_id):
                shutil.rmtree(model_id)

        except Exception as e:
            # Log hub push error
            hub_error_log = {
                "timestamp": get_ist_timestamp(),
                "type": "hub_push_error",
                "level": "ERROR",
                "message": f"❌ Failed to push model to Hugging Face Hub: {str(e)}",
                "step": trainer_stats.global_step if hasattr(trainer_stats, 'global_step') else 0,
                "epoch": 0,
                "hub_model_id": model_id,
                "error": str(e),
                "session_id": session_id
            }
            write_log_entry(hub_error_log, "hub_push_error")
            print(f"❌ Error pushing to hub: {str(e)}")
            
    else:
        # Log missing configuration
        missing_items = []
        if not model_id:
            missing_items.append("hub_model_id")
        if not hf_token:
            missing_items.append("HF_TOKEN")
            
        warning_log = {
            "timestamp": get_ist_timestamp(),
            "type": "hub_push_skipped",
            "level": "WARNING",
            "message": f"⚠️ Skipping Hugging Face Hub push - missing: {', '.join(missing_items)}",
            "step": trainer_stats.global_step if hasattr(trainer_stats, 'global_step') else 0,
            "epoch": 0,
            "missing_config": missing_items,
            "session_id": session_id
        }
        write_log_entry(warning_log, "hub_push_skipped")
        print(f"⚠️ Skipping hub push - missing: {', '.join(missing_items)}")
        print("💡 To enable hub pushing:")
        if not model_id:
            print("   - Set 'hub_model_id' in your config or HUB_MODEL_ID in .env file")
        if not hf_token:
            print("   - Set HF_TOKEN in your .env file")
    
    # Log completion
    completion_log = {
        "timestamp": get_ist_timestamp(),
        "type": "model saved to hugging face",
        "level": "INFO",
        "message": f"🎉 Training completed successfully! Model saved to {model_id}",
        "step": trainer_stats.global_step if hasattr(trainer_stats, 'global_step') else 0,
        "epoch": 0,
        "stats": {
            "train_runtime": trainer_stats.metrics.get("train_runtime"),
            "train_samples_per_second": trainer_stats.metrics.get("train_samples_per_second"),
            "train_steps_per_second": trainer_stats.metrics.get("train_steps_per_second"),
            "total_flos": trainer_stats.metrics.get("total_flos"),
            "train_loss": trainer_stats.metrics.get("train_loss")
        },
        "session_id": session_id
    }
    write_log_entry(completion_log, "training_complete")
    
    print(f"Training completed! Final model saved to '{model_id}'")
    
    # Register model for predictions
    print(f"\n🔧 Registering model for prediction...")
    print(f"   Session ID: {session_id}")
    print(f"   Model Output Dir: {model_output_dir}")
    print(f"   Model ID: {model_id}")
    print(f"   Dataset Source: {dataset_source}")
    
    try:
        register_model_for_prediction(
            session_id=session_id,
            config=config,
            model_output_dir=model_output_dir,
            model_id=model_id,
            trainer_stats=trainer_stats,
            dataset_info={
                "source": dataset_source,
                "size": len(dataset) if dataset else 0,
                "actual_file_path": actual_file_path  # Pass the actual file path
            }
        )
        print(f"✅ Model registration completed successfully!")
    except Exception as e:
        print(f"❌ ERROR: Failed to register model for prediction: {str(e)}")
        print(f"   This means the model won't appear in the prediction interface")
        print(f"   You can manually register it later using the registration scripts")
        
        # Print detailed error information
        import traceback
        print(f"   Detailed error:")
        traceback.print_exc()
        
        # Log the error but don't fail the training
        error_log = {
            "timestamp": get_ist_timestamp(),
            "type": "prediction_registration_error",
            "level": "ERROR",
            "message": f"❌ Failed to register model for prediction: {str(e)}",
            "session_id": session_id,
            "error": str(e),
            "traceback": traceback.format_exc()
        }
        write_log_entry(error_log, "prediction_registration_error")


def register_model_for_prediction(session_id: str, config: dict, model_output_dir: str, 
                                model_id: str, trainer_stats, dataset_info: dict):
    """Register a trained model for prediction use"""
    try:
        # Extract input/output schema from training configuration and dataset
        input_schema = extract_input_schema_from_training(config, dataset_info)
        output_schema = extract_output_schema_from_training(config, dataset_info)
        
        # Calculate accuracy from training stats
        accuracy = None
        if hasattr(trainer_stats, 'metrics') and trainer_stats.metrics:
            # Try to extract accuracy or use loss as proxy
            train_loss = trainer_stats.metrics.get("train_loss")
            if train_loss:
                # Convert loss to approximate accuracy (this is a rough estimate)
                accuracy = max(0.0, min(1.0, 1.0 - (train_loss / 10.0)))
        
        # Determine model path - prefer local path over hub model
        model_path = None
        if os.path.exists(model_output_dir):
            model_path = os.path.abspath(model_output_dir)
        elif model_id:
            # If local path doesn't exist, use hub model ID
            model_path = model_id
        
        # Extract static instruction text
        static_instruction = extract_static_instruction_from_training(config, dataset_info)
        
        # Create model info
        model_info = ModelInfo(
            name=os.path.basename(model_path),
            model_id=f"model_{session_id}" if session_id else f"model_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
            base_model=config.get("model_name", "Trained Model").replace("unsloth/", "").replace("-bnb-4bit", ""),
            description=f"Fine-tuned model from session {session_id}. Trained on {dataset_info.get('source', 'dataset')} with {dataset_info.get('size', 0)} samples.",
            input_schema=input_schema,
            output_schema=output_schema,
            created_at=datetime.now(),
            accuracy=accuracy,
            status=ModelStatus.READY,
            training_session_id=session_id,
            model_type="unsloth_lora",
            version="1.0",
            model_path=model_path,
            metadata={
                "training_config": config,
                "training_stats": {
                    "train_runtime": trainer_stats.metrics.get("train_runtime") if hasattr(trainer_stats, 'metrics') else None,
                    "train_loss": trainer_stats.metrics.get("train_loss") if hasattr(trainer_stats, 'metrics') else None,
                    "train_samples_per_second": trainer_stats.metrics.get("train_samples_per_second") if hasattr(trainer_stats, 'metrics') else None,
                },
                "dataset_info": dataset_info,
                "hub_model_id": model_id,
                "static_instruction": static_instruction
            }
        )
        
        # Register with prediction service
        success = prediction_service.register_model(model_info)
        
        if success:
            print(f"✅ Model registered for prediction: {model_info.model_id}")
            print(f"   Model name: {model_info.name}")
            print(f"   Input schema: {list(input_schema.keys())}")
            print(f"   Output schema: {list(output_schema.keys())}")
            print(f"   Accuracy: {accuracy:.3f}" if accuracy else "   Accuracy: Not available")
            print(f"   Available in Prediction tab!")
        else:
            print(f"❌ Failed to register model for prediction")
            
    except Exception as e:
        print(f"Error in register_model_for_prediction: {str(e)}")
        raise


def extract_input_schema_from_training(config: dict, dataset_info: dict) -> dict:
    """Extract input schema from actual training data (excluding instruction)"""
    input_schema = {}
    
    try:
        # Try to get the actual training data file path from dataset_info
        dataset_source = dataset_info.get("source", "")
        actual_file_path = dataset_info.get("actual_file_path")
        
        # If we have a file path, analyze the actual data
        if "file:" in dataset_source:
            # Extract filename from source like "JSON file: sample_training_data.json"
            filename = dataset_source.split(": ")[-1] if ": " in dataset_source else None
            
            # Try to find and analyze the training data
            sample_data = None
            possible_paths = []
            
            # First priority: use the actual file path if available
            if actual_file_path and os.path.exists(actual_file_path):
                possible_paths.append(actual_file_path)
                print(f"🔍 Using actual file path: {actual_file_path}")
            
            # Fallback paths
            possible_paths.extend([
                filename,
                f"core/{filename}",
                f"./{filename}",
                "sample_training_data.json",  # fallback
                "core/sample_training_data.json"  # fallback
            ])
            
            for path in possible_paths:
                if path and os.path.exists(path):
                    try:
                        with open(path, 'r', encoding='utf-8') as f:
                            if path.endswith('.json'):
                                sample_data = json.load(f)
                            elif path.endswith('.jsonl'):
                                sample_data = []
                                for line in f:
                                    if line.strip():
                                        sample_data.append(json.loads(line))
                        break
                    except Exception as e:
                        print(f"Could not read {path}: {e}")
                        continue
            
            # Analyze the sample data to extract schema
            if sample_data and isinstance(sample_data, list) and len(sample_data) > 0:
                first_example = sample_data[0]
                
                # Check for input field (but NOT instruction - that's static)
                if "input" in first_example:
                    input_value = first_example["input"]
                    
                    # Check if input is a nested JSON object
                    if isinstance(input_value, dict):
                        # Extract individual fields from nested input object
                        print(f"Found nested input object with fields: {list(input_value.keys())}")
                        for nested_key, nested_value in input_value.items():
                            # Determine type based on value
                            if isinstance(nested_value, str):
                                input_schema[nested_key] = "string"
                            elif isinstance(nested_value, (int, float)):
                                input_schema[nested_key] = "number"
                            elif isinstance(nested_value, bool):
                                input_schema[nested_key] = "boolean"
                            else:
                                input_schema[nested_key] = "string"  # default to string
                    elif isinstance(input_value, str):
                        # Check if it's a JSON string that can be parsed
                        try:
                            parsed_input = json.loads(input_value)
                            if isinstance(parsed_input, dict):
                                # Extract individual fields from parsed JSON
                                print(f"Found JSON string input with fields: {list(parsed_input.keys())}")
                                for nested_key, nested_value in parsed_input.items():
                                    if isinstance(nested_value, str):
                                        input_schema[nested_key] = "string"
                                    elif isinstance(nested_value, (int, float)):
                                        input_schema[nested_key] = "number"
                                    elif isinstance(nested_value, bool):
                                        input_schema[nested_key] = "boolean"
                                    else:
                                        input_schema[nested_key] = "string"
                            else:
                                # It's a simple string
                                input_schema["input"] = "string"
                        except json.JSONDecodeError:
                            # It's a simple string, not JSON
                            input_schema["input"] = "string"
                    else:
                        # Other types, treat as string
                        input_schema["input"] = "string"
                
                # Check for any other input fields (excluding 'output', 'response', and 'instruction')
                for key, value in first_example.items():
                    if key not in ["output", "response", "instruction", "input"] and key not in input_schema:
                        # Determine type based on value
                        if isinstance(value, str):
                            input_schema[key] = "string"
                        elif isinstance(value, (int, float)):
                            input_schema[key] = "number"
                        elif isinstance(value, bool):
                            input_schema[key] = "boolean"
                        else:
                            input_schema[key] = "string"  # default to string
    
    except Exception as e:
        print(f"Error extracting input schema: {e}")
    
    # Fallback to default if nothing was extracted (but NOT instruction)
    if not input_schema:
        input_schema = {"input": "string"}
    
    # Add any custom fields from config if available
    if "input_fields" in config:
        for field, field_type in config["input_fields"].items():
            if field != "instruction":  # Don't add instruction to input schema
                input_schema[field] = field_type
    
    return input_schema


def extract_output_schema_from_training(config: dict, dataset_info: dict = None) -> dict:
    """Extract output schema from actual training data"""
    output_schema = {}
    
    try:
        # Try to analyze actual training data if available
        if dataset_info:
            dataset_source = dataset_info.get("source", "")
            actual_file_path = dataset_info.get("actual_file_path")
            
            if "file:" in dataset_source:
                filename = dataset_source.split(": ")[-1] if ": " in dataset_source else None
                
                sample_data = None
                possible_paths = []
                
                # First priority: use the actual file path if available
                if actual_file_path and os.path.exists(actual_file_path):
                    possible_paths.append(actual_file_path)
                
                # Fallback paths
                possible_paths.extend([
                    filename,
                    f"core/{filename}",
                    f"./{filename}",
                    "sample_training_data.json",
                    "core/sample_training_data.json"
                ])
                
                for path in possible_paths:
                    if path and os.path.exists(path):
                        try:
                            with open(path, 'r', encoding='utf-8') as f:
                                if path.endswith('.json'):
                                    sample_data = json.load(f)
                                elif path.endswith('.jsonl'):
                                    sample_data = []
                                    for line in f:
                                        if line.strip():
                                            sample_data.append(json.loads(line))
                            break
                        except Exception as e:
                            continue
                
                # Analyze output format
                if sample_data and isinstance(sample_data, list) and len(sample_data) > 0:
                    first_example = sample_data[0]
                    
                    # Check the output field
                    if "output" in first_example:
                        output_value = first_example["output"]
                        
                        # If output is a string, check if it looks like JSON
                        if isinstance(output_value, str):
                            try:
                                # Try to parse as JSON to see if it's structured
                                parsed_output = json.loads(output_value)
                                if isinstance(parsed_output, dict):
                                    # It's structured JSON, extract schema
                                    for key, value in parsed_output.items():
                                        if isinstance(value, str):
                                            output_schema[key] = "string"
                                        elif isinstance(value, (int, float)):
                                            output_schema[key] = "number"
                                        elif isinstance(value, bool):
                                            output_schema[key] = "boolean"
                                        else:
                                            output_schema[key] = "string"
                                else:
                                    # It's a JSON array or primitive
                                    output_schema["response"] = "string"
                            except json.JSONDecodeError:
                                # It's plain text
                                output_schema["response"] = "string"
                        elif isinstance(output_value, dict):
                            # Output is already a dictionary
                            for key, value in output_value.items():
                                if isinstance(value, str):
                                    output_schema[key] = "string"
                                elif isinstance(value, (int, float)):
                                    output_schema[key] = "number"
                                elif isinstance(value, bool):
                                    output_schema[key] = "boolean"
                                else:
                                    output_schema[key] = "string"
                        else:
                            output_schema["response"] = "string"
    
    except Exception as e:
        print(f"Error extracting output schema: {e}")
    
    # Fallback to default if nothing was extracted
    if not output_schema:
        output_schema = {"response": "string"}
    
    # Always add confidence as it's generated during prediction
    # output_schema["confidence"] = "number"
    
    # Add any custom output fields from config if available
    if "output_fields" in config:
        for field, field_type in config["output_fields"].items():
            output_schema[field] = field_type
    
    return output_schema


def extract_static_instruction_from_training(config: dict, dataset_info: dict = None) -> str:
    """Extract static instruction text from actual training data"""
    static_instruction = "Process the following data"  # default
    
    try:
        # Try to analyze actual training data if available
        if dataset_info:
            dataset_source = dataset_info.get("source", "")
            actual_file_path = dataset_info.get("actual_file_path")
            
            if "file:" in dataset_source:
                filename = dataset_source.split(": ")[-1] if ": " in dataset_source else None
                
                sample_data = None
                possible_paths = []
                
                # First priority: use the actual file path if available
                if actual_file_path and os.path.exists(actual_file_path):
                    possible_paths.append(actual_file_path)
                
                # Fallback paths
                possible_paths.extend([
                    filename,
                    f"core/{filename}",
                    f"./{filename}",
                    "sample_training_data.json",
                    "core/sample_training_data.json"
                ])
                
                for path in possible_paths:
                    if path and os.path.exists(path):
                        try:
                            with open(path, 'r', encoding='utf-8') as f:
                                if path.endswith('.json'):
                                    sample_data = json.load(f)
                                elif path.endswith('.jsonl'):
                                    sample_data = []
                                    for line in f:
                                        if line.strip():
                                            sample_data.append(json.loads(line))
                            break
                        except Exception as e:
                            continue
                
                # Extract instruction text from first example
                if sample_data and isinstance(sample_data, list) and len(sample_data) > 0:
                    first_example = sample_data[0]
                    
                    if "instruction" in first_example:
                        static_instruction = first_example["instruction"]
    
    except Exception as e:
        print(f"Error extracting static instruction: {e}")
    
    return static_instruction


def main():
    """Legacy main function for backward compatibility"""
    train_with_config()

if __name__ == "__main__":
    main()
