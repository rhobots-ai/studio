# Model Finetuning API

A FastAPI-based service for finetuning language models with real-time monitoring and logging capabilities.

## Features

- **RESTful API** for model finetuning
- **Real-time dashboard** for monitoring training progress
- **Background job processing** for long-running training tasks
- **Detailed logging** with JSON-formatted logs
- **Job management** with status tracking and cancellation
- **Configurable training parameters**

## Installation

1. Clone this repository
2. Install dependencies:
```bash
pip install -r requirements.txt
```

## Usage

### Starting the API Server

```bash
python main.py
```

The API will be available at `http://localhost:8000`

### API Documentation

Once the server is running, visit:
- API Documentation: `http://localhost:8000/docs`
- Alternative docs: `http://localhost:8000/redoc`

### Available Endpoints

#### 1. Start Finetuning Job
```http
POST /finetune
```

**Request Body:**
```json
{
  "dataset_name": "your_dataset",
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
  "lora_dropout": 0.0
}
```

**Response:**
```json
{
  "job_id": "uuid-string",
  "status": "queued",
  "message": "Finetuning job has been queued and will start shortly",
  "dashboard_url": "http://localhost:5000"
}
```

#### 2. Get Job Status
```http
GET /jobs/{job_id}
```

**Response:**
```json
{
  "job_id": "uuid-string",
  "status": "running",
  "progress": {...},
  "logs": [...],
  "error": null
}
```

#### 3. List All Jobs
```http
GET /jobs
```

#### 4. Get Job Logs
```http
GET /logs/{job_id}
```

#### 5. Cancel Job
```http
DELETE /jobs/{job_id}
```

#### 6. Dashboard Info
```http
GET /dashboard
```

### Real-time Monitoring Dashboard

During training, a real-time dashboard is available at `http://localhost:5000` that shows:

- **Training Status**: Current status, step, and epoch
- **Loss Chart**: Real-time training loss visualization
- **Learning Rate Chart**: Learning rate schedule visualization
- **Recent Logs**: Latest training logs and events

## Example Usage

### Using curl

```bash
# Start a finetuning job
curl -X POST "http://localhost:8000/finetune" \
     -H "Content-Type: application/json" \
     -d '{
       "dataset_name": "alpaca",
       "num_train_epochs": 1,
       "max_steps": 100
     }'

# Check job status
curl "http://localhost:8000/jobs/{job_id}"

# Get all jobs
curl "http://localhost:8000/jobs"
```

### Using Python requests

```python
import requests

# Start finetuning
response = requests.post("http://localhost:8000/finetune", json={
    "dataset_name": "your_dataset",
    "num_train_epochs": 3,
    "max_steps": 60
})

job_data = response.json()
job_id = job_data["job_id"]

# Monitor progress
status_response = requests.get(f"http://localhost:8000/jobs/{job_id}")
print(status_response.json())
```

## Configuration

### Training Parameters

All training parameters can be customized through the API request:

- `dataset_name`: Name of the dataset to use for training
- `model_name`: Base model to finetune (default: "unsloth/llama-3-8b-bnb-4bit")
- `max_seq_length`: Maximum sequence length (default: 2048)
- `num_train_epochs`: Number of training epochs (default: 3)
- `per_device_train_batch_size`: Batch size per device (default: 2)
- `gradient_accumulation_steps`: Gradient accumulation steps (default: 4)
- `learning_rate`: Learning rate (default: 2e-4)
- `max_steps`: Maximum training steps (default: 60)
- `warmup_steps`: Warmup steps (default: 5)
- `save_steps`: Save model every N steps (default: 25)
- `logging_steps`: Log every N steps (default: 1)
- `output_dir`: Output directory for results (default: "./results")
- `lora_r`: LoRA rank (default: 16)
- `lora_alpha`: LoRA alpha (default: 16)
- `lora_dropout`: LoRA dropout (default: 0.0)

### Dataset Format

The training script expects datasets with the following structure:
- `instruction`: The instruction/prompt
- `input`: Optional input context
- `output`: Expected response

## File Structure

```
.
├── main.py                 # FastAPI application
├── train_with_logging.py   # Training script with logging
├── log_monitor.py          # Logging callback and dashboard
├── requirements.txt        # Python dependencies
├── README.md              # This file
├── templates/             # Dashboard HTML templates
├── training_logs.jsonl    # Training logs (created during training)
├── results/               # Training outputs (created during training)
└── lora_model/           # Saved model (created after training)
```

## Logs

Training logs are saved in JSON Lines format in `training_logs.jsonl`. Each log entry contains:

```json
{
  "timestamp": "2024-01-01T12:00:00",
  "type": "training_step",
  "level": "INFO",
  "message": "Step 10 completed",
  "step": 10,
  "epoch": 0,
  "step_time": 1.5,
  "learning_rate": 0.0002,
  "loss": 0.5,
  "grad_norm": 1.0
}
```

## Requirements

- Python 3.8+
- CUDA-compatible GPU (recommended)
- Sufficient GPU memory for the model (8GB+ recommended)

## Notes

- The training process runs in the background, allowing multiple concurrent API requests
- The dashboard updates in real-time every 2 seconds
- Model checkpoints are saved according to the `save_steps` parameter
- Training can be monitored through both the API endpoints and the web dashboard
