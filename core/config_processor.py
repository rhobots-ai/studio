from typing import Dict, Any
from models.training_models import TrainerConfig, TrainingArgsConfig

def merge_trainer_and_training_configs(
    trainer_config: TrainerConfig, 
    training_args_config: TrainingArgsConfig
) -> Dict[str, Any]:
    """
    Merge trainer and training args into unified training config for backward compatibility
    with existing training functions.
    
    Args:
        trainer_config: Trainer infrastructure configuration
        training_args_config: Training arguments and hyperparameters
        
    Returns:
        Dict containing merged configuration for training
    """
    
    config = {
        # From trainer config (infrastructure & system settings)
        "model_name": trainer_config.model_name,
        "max_seq_length": trainer_config.max_seq_length,
        "quantization": trainer_config.quantization,
        "dataloader_num_workers": trainer_config.dataloader_num_workers,
        "dataloader_pin_memory": trainer_config.dataloader_pin_memory,
        "gradient_checkpointing": trainer_config.gradient_checkpointing,
        "fp16": trainer_config.fp16,
        "bf16": trainer_config.bf16,
        "push_to_hub": trainer_config.push_to_hub,
        "hub_model_id": trainer_config.hub_model_id,
        
        # From training args config (hyperparameters & training process)
        "num_train_epochs": training_args_config.num_train_epochs,
        "learning_rate": training_args_config.learning_rate,
        "per_device_train_batch_size": training_args_config.per_device_train_batch_size,
        "logging_steps": training_args_config.logging_steps,
        "lora_r": training_args_config.lora_r,
        "lora_alpha": training_args_config.lora_alpha,
        "lora_dropout": training_args_config.lora_dropout,
        "lr_scheduler_type": training_args_config.lr_scheduler_type,
        "warmup_steps": training_args_config.warmup_steps,
        "adam_beta1": training_args_config.adam_beta1,
        "adam_beta2": training_args_config.adam_beta2,
        "adam_epsilon": training_args_config.adam_epsilon,
        "max_grad_norm": training_args_config.max_grad_norm,
        "gradient_accumulation_steps": training_args_config.gradient_accumulation_steps,
        "weight_decay": training_args_config.weight_decay,
        "dropout_rate": training_args_config.dropout_rate,
        "attention_dropout": training_args_config.attention_dropout,
        "label_smoothing_factor": training_args_config.label_smoothing_factor,
        "save_steps": training_args_config.save_steps,
        "seed": training_args_config.seed,
        "remove_unused_columns": training_args_config.remove_unused_columns,
        "report_to": training_args_config.report_to,
        "output_dir": training_args_config.output_dir,
    }
    
    # Merge custom parameters from both sections
    # Custom trainer parameters (infrastructure-related)
    config.update(trainer_config.custom_trainer_parameters)
    
    # Custom training arguments (hyperparameter-related)
    config.update(training_args_config.custom_training_arguments)
    
    return config

def validate_hub_configuration(trainer_config: TrainerConfig) -> Dict[str, str]:
    """
    Validate Hugging Face Hub configuration
    
    Args:
        trainer_config: Trainer configuration to validate
        
    Returns:
        Dict with validation results
    """
    errors = {}
    
    if trainer_config.push_to_hub:
        if not trainer_config.hub_model_id:
            errors["hub_model_id"] = "Repository ID is required when push to hub is enabled"
        elif trainer_config.hub_model_id:
            # Validate format: username/repository-name
            import re
            pattern = r'^[a-zA-Z0-9]([a-zA-Z0-9._-]*[a-zA-Z0-9])?\/[a-zA-Z0-9]([a-zA-Z0-9._-]*[a-zA-Z0-9])?$'
            if not re.match(pattern, trainer_config.hub_model_id):
                errors["hub_model_id"] = "Format should be: username/repository-name"
    
    return errors

def extract_trainer_config_from_legacy(legacy_config: Dict[str, Any]) -> TrainerConfig:
    """
    Extract trainer configuration from legacy flat configuration
    
    Args:
        legacy_config: Legacy flat configuration dictionary
        
    Returns:
        TrainerConfig object
    """
    trainer_data = {
        "model_name": legacy_config.get("model_name", ""),
        "push_to_hub": legacy_config.get("push_to_hub", False),
        "hub_model_id": legacy_config.get("hub_model_id"),
        "quantization": legacy_config.get("quantization", "4bit"),
        "max_seq_length": legacy_config.get("max_seq_length", 2048),
        "dataloader_num_workers": legacy_config.get("dataloader_num_workers", 4),
        "dataloader_pin_memory": legacy_config.get("dataloader_pin_memory", True),
        "gradient_checkpointing": legacy_config.get("gradient_checkpointing", False),
        "fp16": legacy_config.get("fp16", False),
        "bf16": legacy_config.get("bf16", False),
        "custom_trainer_parameters": {}
    }
    
    return TrainerConfig(**trainer_data)

def extract_training_args_config_from_legacy(legacy_config: Dict[str, Any]) -> TrainingArgsConfig:
    """
    Extract training arguments configuration from legacy flat configuration
    
    Args:
        legacy_config: Legacy flat configuration dictionary
        
    Returns:
        TrainingArgsConfig object
    """
    training_args_data = {
        "num_train_epochs": legacy_config.get("num_train_epochs", 3),
        "learning_rate": legacy_config.get("learning_rate", 0.0002),
        "per_device_train_batch_size": legacy_config.get("per_device_train_batch_size", 8),
        "logging_steps": legacy_config.get("logging_steps", 10),
        "lora_r": legacy_config.get("lora_r", 16),
        "lora_alpha": legacy_config.get("lora_alpha", 32),
        "lora_dropout": legacy_config.get("lora_dropout", 0.1),
        "lr_scheduler_type": legacy_config.get("lr_scheduler_type", "linear"),
        "warmup_steps": legacy_config.get("warmup_steps", 100),
        "adam_beta1": legacy_config.get("adam_beta1", 0.9),
        "adam_beta2": legacy_config.get("adam_beta2", 0.999),
        "adam_epsilon": legacy_config.get("adam_epsilon", 1e-8),
        "max_grad_norm": legacy_config.get("max_grad_norm", 1.0),
        "gradient_accumulation_steps": legacy_config.get("gradient_accumulation_steps", 1),
        "weight_decay": legacy_config.get("weight_decay", 0.01),
        "dropout_rate": legacy_config.get("dropout_rate", 0.1),
        "attention_dropout": legacy_config.get("attention_dropout", 0.1),
        "label_smoothing_factor": legacy_config.get("label_smoothing_factor", 0.0),
        "save_steps": legacy_config.get("save_steps", 500),
        "seed": legacy_config.get("seed", 42),
        "remove_unused_columns": legacy_config.get("remove_unused_columns", True),
        "report_to": legacy_config.get("report_to", []),
        "output_dir": legacy_config.get("output_dir", "./results"),
        "custom_training_arguments": {}
    }
    
    return TrainingArgsConfig(**training_args_data)

def get_config_summary(trainer_config: TrainerConfig, training_args_config: TrainingArgsConfig) -> Dict[str, Any]:
    """
    Generate a summary of the configuration for logging and display
    
    Args:
        trainer_config: Trainer configuration
        training_args_config: Training arguments configuration
        
    Returns:
        Dict containing configuration summary
    """
    return {
        "model_info": {
            "model_name": trainer_config.model_name,
            "quantization": trainer_config.quantization,
            "max_seq_length": trainer_config.max_seq_length,
            "push_to_hub": trainer_config.push_to_hub
        },
        "training_params": {
            "epochs": training_args_config.num_train_epochs,
            "learning_rate": training_args_config.learning_rate,
            "batch_size": training_args_config.per_device_train_batch_size,
            "lora_rank": training_args_config.lora_r,
            "lora_alpha": training_args_config.lora_alpha
        },
        "optimization": {
            "warmup_steps": training_args_config.warmup_steps,
            "weight_decay": training_args_config.weight_decay,
            "gradient_accumulation_steps": training_args_config.gradient_accumulation_steps
        },
        "infrastructure": {
            "fp16": trainer_config.fp16,
            "bf16": trainer_config.bf16,
            "gradient_checkpointing": trainer_config.gradient_checkpointing,
            "dataloader_workers": trainer_config.dataloader_num_workers
        },
        "custom_params": {
            "trainer_custom_count": len(trainer_config.custom_trainer_parameters),
            "training_args_custom_count": len(training_args_config.custom_training_arguments)
        }
    }
