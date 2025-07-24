from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List

class TrainerConfig(BaseModel):
    """Configuration for trainer infrastructure and system-level settings"""
    
    # Model Name and Description
    model_name: str = Field(min_length=1, description="Name for the fine-tuned model")
    push_to_hub: bool = Field(default=False, description="Whether to push model to Hugging Face Hub")
    hub_model_id: Optional[str] = Field(default=None, description="Hugging Face Hub repository ID")
    
    # Quantization Configuration
    quantization: str = Field(default="4bit", pattern="^(4bit|8bit|none)$", description="Model quantization method")
    
    # Max Sequence Length (trainer-level setting)
    max_seq_length: int = Field(default=2048, ge=128, le=4096, description="Maximum sequence length for training")
    
    # Memory & Performance
    dataloader_num_workers: int = Field(default=4, ge=0, le=8, description="Number of dataloader workers")
    dataloader_pin_memory: bool = Field(default=True, description="Pin memory for faster data transfer")
    gradient_checkpointing: bool = Field(default=False, description="Enable gradient checkpointing for memory savings")
    fp16: bool = Field(default=False, description="Enable FP16 mixed precision training")
    bf16: bool = Field(default=False, description="Enable BF16 mixed precision training")
    
    # Custom Trainer Parameters
    custom_trainer_parameters: Dict[str, Any] = Field(default_factory=dict, description="Custom trainer parameters")

class TrainingArgsConfig(BaseModel):
    """Configuration for training arguments and hyperparameters"""
    
    # Basic Parameters
    num_train_epochs: int = Field(default=3, ge=1, le=10, description="Number of training epochs")
    learning_rate: float = Field(default=0.0002, ge=0.00001, le=0.001, description="Learning rate")
    per_device_train_batch_size: int = Field(default=8, ge=1, le=32, description="Training batch size per device")
    logging_steps: int = Field(default=10, ge=1, le=100, description="Number of steps between logging")
    
    # LoRA Configuration
    lora_r: int = Field(default=16, ge=1, le=256, description="LoRA rank")
    lora_alpha: int = Field(default=32, ge=1, le=512, description="LoRA alpha parameter")
    lora_dropout: float = Field(default=0.1, ge=0, le=0.5, description="LoRA dropout rate")
    
    # Optimization Parameters
    lr_scheduler_type: str = Field(default="linear", description="Learning rate scheduler type")
    warmup_steps: int = Field(default=100, ge=0, le=1000, description="Number of warmup steps")
    adam_beta1: float = Field(default=0.9, ge=0.8, le=0.999, description="Adam beta1 parameter")
    adam_beta2: float = Field(default=0.999, ge=0.9, le=0.9999, description="Adam beta2 parameter")
    adam_epsilon: float = Field(default=1e-8, description="Adam epsilon parameter")
    max_grad_norm: float = Field(default=1.0, ge=0.1, le=10, description="Maximum gradient norm for clipping")
    gradient_accumulation_steps: int = Field(default=1, ge=1, le=32, description="Gradient accumulation steps")
    
    # Training Stability
    weight_decay: float = Field(default=0.01, ge=0, le=0.1, description="Weight decay for regularization")
    dropout_rate: float = Field(default=0.1, ge=0, le=0.5, description="Dropout rate")
    attention_dropout: float = Field(default=0.1, ge=0, le=0.5, description="Attention dropout rate")
    label_smoothing_factor: float = Field(default=0, ge=0, le=0.3, description="Label smoothing factor")
    
    # Additional settings
    save_steps: int = Field(default=500, ge=1, description="Number of steps between model saves")
    seed: int = Field(default=42, description="Random seed for reproducibility")
    remove_unused_columns: bool = Field(default=True, description="Remove unused columns from dataset")
    report_to: str = Field(default="none", description="Logging service to report to")
    output_dir: str = Field(default="./results", description="Output directory for model and logs")
    
    # Custom Training Arguments
    custom_training_arguments: Dict[str, Any] = Field(default_factory=dict, description="Custom training arguments")

class EnhancedFinetuneRequest(BaseModel):
    """Enhanced fine-tuning request with structured configuration"""
    
    trainer_config: TrainerConfig = Field(description="Trainer infrastructure configuration")
    training_args_config: TrainingArgsConfig = Field(description="Training arguments and hyperparameters")
    
    class Config:
        extra = "ignore"
        schema_extra = {
            "example": {
                "trainer_config": {
                    "model_name": "my-fine-tuned-model",
                    "push_to_hub": False,
                    "hub_model_id": "username/repository-name",
                    "quantization": "4bit",
                    "max_seq_length": 2048,
                    "dataloader_num_workers": 4,
                    "dataloader_pin_memory": True,
                    "gradient_checkpointing": False,
                    "fp16": False,
                    "bf16": False,
                    "custom_trainer_parameters": {}
                },
                "training_args_config": {
                    "num_train_epochs": 3,
                    "learning_rate": 0.0002,
                    "per_device_train_batch_size": 8,
                    "logging_steps": 10,
                    "lora_r": 16,
                    "lora_alpha": 32,
                    "lora_dropout": 0.1,
                    "lr_scheduler_type": "linear",
                    "warmup_steps": 100,
                    "adam_beta1": 0.9,
                    "adam_beta2": 0.999,
                    "adam_epsilon": 1e-8,
                    "max_grad_norm": 1.0,
                    "gradient_accumulation_steps": 1,
                    "weight_decay": 0.01,
                    "dropout_rate": 0.1,
                    "attention_dropout": 0.1,
                    "label_smoothing_factor": 0.0,
                    "save_steps": 500,
                    "seed": 42,
                    "remove_unused_columns": True,
                    "report_to": "",
                    "output_dir": "./results/my-fine-tuned-model",
                    "custom_training_arguments": {}
                }
            }
        }
