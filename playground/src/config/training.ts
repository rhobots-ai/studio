export interface TrainingConfig {
  // Number of steps to accumulate gradients before update
  gradient_accumulation_steps: number;
  
  // Learning rate warmup steps
  warmup_steps: number;
  
  // LoRA adapter rank for parameter-efficient fine-tuning
  lora_rank: number;
  
  // Quantization method for model compression
  quantization: '4bit' | '8bit' | 'none';
  
  // Interval for logging metrics
  logging_steps: number;
  
  // L2 regularization factor
  weight_decay: number;
  
  // Random seed for reproducibility
  seed: number;
  
  // Experiment tracking platform
  report_to: 'wandb' | 'tensorboard' | 'none';
  
  // Dataset Sampling Parameters
  max_sample_size: number | null; // null = use all data, number = limit to N samples

  // Optimization Parameters
  lr_scheduler_type: 'cosine'| 'linear' | 'polynomial' | 'constant' | 'constant_with_warmup';
  adam_beta1: number;
  adam_beta2: number;
  adam_epsilon: number;
  max_grad_norm: number;

  // Training Stability Parameters
  dropout_rate: number;
  attention_dropout: number;
  label_smoothing_factor: number;
  temperature: number;

  // Memory & Performance Parameters
  dataloader_num_workers: number;
  dataloader_pin_memory: boolean;
  gradient_checkpointing: boolean;
  fp16: boolean;
  bf16: boolean;

  // Monitoring & Checkpointing
  save_strategy: 'steps' | 'epoch' | 'no';
  save_steps: number;
  evaluation_strategy: 'steps' | 'epoch' | 'no';
  eval_steps: number;
  metric_for_best_model: string;
  load_best_model_at_end: boolean;
  save_total_limit: number;

  // Advanced LoRA Parameters
  lora_alpha: number;
  lora_dropout: number;
  lora_target_modules: string[];

  // Additional Training Options
  early_stopping_patience: number;
  early_stopping_threshold: number;
  remove_unused_columns: boolean;
  push_to_hub: boolean;
  hub_model_id: string;
}

// Default configuration values
export const defaultTrainingConfig: TrainingConfig = {
  gradient_accumulation_steps: 4,
  warmup_steps: 100,
  lora_rank: 8,
  quantization: '4bit',
  logging_steps: 1,
  weight_decay: 0.01,
  seed: 42,
  report_to: 'tensorboard',

  // Dataset Sampling Parameters
  max_sample_size: null, // null = use all data

  // Optimization Parameters
  lr_scheduler_type: 'cosine',
  adam_beta1: 0.9,
  adam_beta2: 0.999,
  adam_epsilon: 1e-8,
  max_grad_norm: 1.0,

  // Training Stability Parameters
  dropout_rate: 0.1,
  attention_dropout: 0.1,
  label_smoothing_factor: 0.0,
  temperature: 1.0,

  // Memory & Performance Parameters
  dataloader_num_workers: 0,
  dataloader_pin_memory: true,
  gradient_checkpointing: false,
  fp16: false,
  bf16: false,

  // Monitoring & Checkpointing
  save_strategy: 'steps',
  save_steps: 500,
  evaluation_strategy: 'steps',
  eval_steps: 500,
  metric_for_best_model: 'eval_loss',
  load_best_model_at_end: true,
  save_total_limit: 3,

  // Advanced LoRA Parameters
  lora_alpha: 16,
  lora_dropout: 0.1,
  lora_target_modules: ['q_proj', 'v_proj'],

  // Additional Training Options
  early_stopping_patience: 3,
  early_stopping_threshold: 0.0001,
  remove_unused_columns: true,
  push_to_hub: false,
  hub_model_id: '',
};

// Validate and merge user config with defaults
export function createTrainingConfig(userConfig: Partial<TrainingConfig>): TrainingConfig {
  return {
    ...defaultTrainingConfig,
    ...userConfig,
  };
}
