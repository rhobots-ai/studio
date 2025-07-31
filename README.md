![Studio GitHub Banner](https://rhstudio.s3.ap-south-1.amazonaws.com/images/github-banner.png)

<div align="center">
   <div>
      <h3>
        <a href="https://langfuse.com/blog/2025-06-04-open-sourcing-langfuse-product">
            <strong>Rhobots Is Doubling Down On Open Source</strong>
         </a> <br> <br>
        <strong>Self Host</strong>
      </h3>
   </div>

   <span>Rhobots Studio uses <a href="https://github.com/orgs/rhobots-ai/discussions"><strong>Github Discussions</strong></a>  for Support and Feature Requests.</span>
   <br/>
   <br/>
   <div>
   </div>
</div>

<p align="center">
   <a href="https://github.com/rhobots-ai/studio/blob/main/LICENSE">
   <img src="https://img.shields.io/badge/License-MIT-E11311.svg" alt="MIT License">
   </a>
   <br/>
   <a href="https://discord.gg/bVQrhHDjkY" target="_blank">
      <img src="https://img.shields.io/discord/1394649845205303436?logo=discord&labelColor=%20%235462eb&logoColor=%20%23f5f5f5&color=%20%235462eb"
      alt="chat on Discord">
   </a>
</p>

<h3 align="center">
Rhobots Studio – Fine-Tune. Evaluate. Deploy. All in One Open Platform.
</h3>

Rhobots Studio is an open-source platform for curating datasets, fine-tuning language models, evaluating performance, and running inference—all in one unified interface.
Whether you're a researcher or a developer, Rhobots Studio simplifies and accelerates the entire LLM lifecycle.
Rhobots Studio can be **self-hosted in minutes**.

## 🎥 Introduction to Rhobots Studio

<video src="https://github.com/rhobots-ai/studio/raw/main/web/public/videos/rhobots_studio_intr.mp4" controls="controls" style="max-width: 730px;">
</video>

*Watch this introduction video to see Rhobots Studio in action - from dataset preparation to model fine-tuning, evaluation, and deployment.*

---

## 📦 Deploy Rhobots Studio

### Self-Host Rhobots Studio

Run Rhobots Studio on your own machine in 5 minutes using Docker Compose.

```bash
# Clone the repository
git clone https://github.com/rhobots-ai/studio.git
cd studio

# Copy environment configuration
cp .env.example .env

# Configure your environment (required)
vim .env  # Add your HF_TOKEN and other configurations

# Start RHStudio
docker compose up -d
```

**Access the application:**
- Web Interface: http://localhost:5173
- API Documentation: http://localhost:8000/docs
- Training Dashboard: http://localhost:8000/dashboard

### 🛠️ Development Setup

For development and customization:

```bash
# Install dependencies
pnpm install

# Start development environment
pnpm run dev

# This will start:
# - Web interface on http://localhost:5173
# - Core API on http://localhost:8000
# - Database and other services
```

## 🏗️ Architecture

RHStudio follows a modern microservices architecture:

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Web Frontend  │    │   Core API      │    │   File Storage  │
│   (React/Vite)  │◄──►│   (FastAPI)     │◄──►│   (Local/S3)    │
│   Port: 5173    │    │   Port: 8000    │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       ▼                       │
         │              ┌─────────────────┐              │
         │              │   Training      │              │
         └──────────────►│   Engine        │◄─────────────┘
                        │   (Unsloth)     │
                        └─────────────────┘
                                 │
                                 ▼
                        ┌─────────────────┐
                        │   Model Store   │
                        │   & Artifacts   │
                        └─────────────────┘
```

### Core Components

#### **Web Frontend** (`/web`)
- **Framework**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS with custom components
- **State Management**: React Context + Hooks
- **Charts**: Recharts for data visualization
- **Real-time**: WebSocket connections for live updates

#### **Core API** (`/core`)
- **Framework**: FastAPI with async support
- **Training**: Unsloth for efficient LoRA fine-tuning
- **Models**: Transformers + PyTorch ecosystem
- **Monitoring**: Real-time system and training metrics
- **Storage**: Local filesystem with session management

#### **Key Services**
- **File Manager**: Upload, validation, and storage management
- **Training Service**: Model fine-tuning with session persistence
- **Evaluation Service**: Automated model evaluation
- **Deployment Manager**: Model serving and scaling
- **Monitoring Service**: System health and performance tracking

## 📚 Detailed Usage Guide

### 🗂️ Data Management

#### Supported Formats
- **CSV**: Comma-separated values with headers
- **JSON**: Array of objects or single object
- **JSONL**: JSON Lines format (one JSON object per line)

#### Required Data Structure
```json
{
  "instruction": "What is the capital of France?",
  "input": "Optional context or additional input",
  "output": "The capital of France is Paris."
}
```

#### File Upload Methods
1. **Web Interface**: Drag-and-drop or file picker
2. **API Upload**: Multipart form data or base64 encoding
3. **Dataset Library**: Pre-processed datasets

### 🎯 Model Fine-Tuning

#### Supported Models
- **Hugging Face Models**: Any compatible transformer model
- **Popular Models**: Llama, Mistral, Phi, Gemma, Qwen
- **Custom Models**: Local model files and configurations

#### Training Configuration

**Basic Parameters:**
```json
{
  "model_name": "microsoft/Phi-3-mini-4k-instruct",
  "num_train_epochs": 3,
  "learning_rate": 2e-4,
  "per_device_train_batch_size": 8,
  "max_seq_length": 2048
}
```

**LoRA Configuration:**
```json
{
  "lora_rank": 16,
  "lora_alpha": 32,
  "lora_dropout": 0.1,
  "target_modules": ["q_proj", "v_proj"]
}
```

**Advanced Settings:**
- **Quantization**: 4-bit, 8-bit, or full precision
- **Gradient Accumulation**: For effective larger batch sizes
- **Learning Rate Scheduling**: Warmup and decay strategies
- **Memory Optimization**: Gradient checkpointing, mixed precision

#### Training Monitoring

Real-time monitoring includes:
- **Training Loss**: Step-by-step loss tracking
- **Learning Rate**: Dynamic learning rate visualization
- **System Metrics**: GPU utilization, memory usage
- **Progress Tracking**: ETA and completion estimates

### 📊 Model Evaluation

#### Evaluation Types
1. **Automated Evaluation**: Batch processing with configurable parameters
2. **Custom Metrics**: Integration with evaluation frameworks
3. **Comparative Analysis**: Side-by-side model comparison

#### Configuration Options
```json
{
  "batch_size": 50,
  "max_tokens": 150,
  "temperature": 0.7,
  "custom_parameters": {
    "top_p": 0.9,
    "repetition_penalty": 1.1
  }
}
```

### 🚀 Model Deployment

#### Deployment Options
1. **Local Deployment**: Single-instance serving
2. **Scaled Deployment**: Multi-instance with load balancing
3. **Cloud Deployment**: AWS/GCP integration

#### Configuration
```yaml
# nginx-deployment-config.example
deployment:
  replicas: 3
  resources:
    gpu: 1
    memory: "8Gi"
  scaling:
    min_replicas: 1
    max_replicas: 10
    target_gpu_utilization: 70
```

## 🔧 Configuration

### Environment Variables

Create a `.env` file with the following configurations:

```bash
# Hugging Face Token (required for model downloads)
HF_TOKEN=your_huggingface_token_here

# Development Configuration
NODE_ENV=development
VITE_API_BASE_URL=http://localhost:8000

# Deployment Configuration
DEPLOYMENT_MODE=development
DEPLOYMENT_HOST=localhost
DEPLOYMENT_PROTOCOL=http
DEPLOYMENT_BASE_URL=
DEPLOYMENT_DOMAIN=your-domain.com

# Optional: Custom model cache directory
MODEL_CACHE_DIR=/path/to/model/cache

# Optional: Custom data directory
DATA_DIR=/path/to/data

# Optional: GPU configuration
CUDA_VISIBLE_DEVICES=0,1
```

### Advanced Configuration

#### Training Defaults (`/core/config/training.py`)
```python
DEFAULT_TRAINING_CONFIG = {
    "max_seq_length": 2048,
    "num_train_epochs": 3,
    "learning_rate": 2e-4,
    "lora_rank": 16,
    "lora_alpha": 32,
    "quantization": "4bit"
}
```

#### API Configuration (`/web/src/config/api.ts`)
```typescript
export const API_CONFIG = {
  BASE_URL: process.env.VITE_API_BASE_URL || 'http://localhost:8000',
  TIMEOUT: 30000,
  RETRY_ATTEMPTS: 3
};
```

## 🔌 API Reference

### Training API

#### Start Fine-tuning
```bash
POST /finetune-with-file?file_id={file_id}
Content-Type: application/json

{
  "trainer_config": {
    "model_name": "microsoft/Phi-3-mini-4k-instruct",
    "quantization": "4bit",
    "max_seq_length": 2048
  },
  "training_args_config": {
    "num_train_epochs": 3,
    "learning_rate": 2e-4,
    "per_device_train_batch_size": 8,
    "lora_rank": 16,
    "lora_alpha": 32
  }
}
```

#### Monitor Training
```bash
GET /api/training/{session_id}/status
GET /api/training/{session_id}/logs
GET /api/training/{session_id}/metrics
```

### Evaluation API

#### Start Evaluation
```bash
POST /evaluate/predict-with-mapping
Content-Type: application/json

{
  "model_path": "path/to/model",
  "test_data": [...],
  "mapping": {
    "input_columns": {"instruction": "question"},
    "output_column": "answer"
  },
  "batch_size": 50
}
```

### Chat API

#### Single Message
```bash
POST /chat/single
Content-Type: application/json

{
  "message": "Hello, how are you?",
  "model_path": "path/to/model",
  "max_tokens": 150,
  "temperature": 0.7
}
```

#### Conversation
```bash
POST /chat/conversation
Content-Type: application/json

{
  "messages": [
    {"role": "user", "content": "Hello"},
    {"role": "assistant", "content": "Hi there!"},
    {"role": "user", "content": "How are you?"}
  ],
  "max_tokens": 150
}
```

## 🐳 Docker Deployment

### Production Deployment

```yaml
# docker-compose.yml
services:
  web:
    image: rhobotsai/studio-web:latest
    ports:
      - "5173:5173"
    depends_on:
      - core
    restart: always

  core:
    image: rhobotsai/studio-core:latest
    ports:
      - "8000:8000"
    volumes:
      - core_data:/app/training_sessions
    environment:
      - HF_TOKEN=${HF_TOKEN}
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]
    restart: always

volumes:
  core_data:
```

### Development Deployment

```yaml
# docker-compose.dev.yml
services:
  web:
    build:
      context: ./web
      dockerfile: Dockerfile.dev
    volumes:
      - ./web:/app
      - /app/node_modules
    ports:
      - "5173:5173"

  core:
    build:
      context: ./core
      dockerfile: Dockerfile.dev
    volumes:
      - ./core:/app
      - core_data:/app/training_sessions
    ports:
      - "8000:8000"
```

## 🔧 Development

### Project Structure

```
studio/
├── web/                    # React frontend
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── pages/          # Page components
│   │   ├── services/       # API services
│   │   └── utils/          # Utility functions
│   ├── public/             # Static assets
│   └── package.json
├── core/                   # Python backend
│   ├── api/                # API routes
│   ├── services/           # Business logic
│   ├── models/             # Data models
│   └── main.py             # FastAPI application
├── scripts/                # Deployment scripts
├── docs/                   # Documentation
└── docker-compose.yml     # Docker configuration
```

### Development Workflow

1. **Setup Development Environment**
   ```bash
   pnpm install
   pnpm run dev
   ```

2. **Code Style and Linting**
   ```bash
   # Frontend
   cd web && npm run lint
   
   # Backend
   cd core && python -m flake8
   ```

3. **Testing**
   ```bash
   # Frontend tests
   cd web && npm test
   
   # Backend tests
   cd core && python -m pytest
   ```

4. **Building for Production**
   ```bash
   pnpm run build
   docker compose -f docker-compose.build.yml build
   ```

### Contributing

1. **Fork the Repository**
2. **Create a Feature Branch**
   ```bash
   git checkout -b feature/amazing-feature
   ```
3. **Make Changes and Test**
4. **Commit with Conventional Commits**
   ```bash
   git commit -m "feat: add amazing feature"
   ```
5. **Push and Create Pull Request**

## 📊 Monitoring and Observability

### System Monitoring

RHStudio includes comprehensive monitoring:

- **Training Metrics**: Real-time loss, learning rate, and progress
- **System Health**: CPU, GPU, memory utilization
- **API Performance**: Request latency, error rates
- **Model Performance**: Inference speed, accuracy metrics

### Logging

Structured logging with multiple levels:
- **Training Logs**: Step-by-step training progress
- **API Logs**: Request/response logging
- **System Logs**: Infrastructure and error logs
- **Audit Logs**: User actions and security events

### Alerting

Configurable alerts for:
- Training failures or anomalies
- System resource exhaustion
- API errors and downtime
- Model performance degradation

## 🔒 Security

### Authentication & Authorization
- JWT-based authentication
- Role-based access control (RBAC)
- API key management
- Session management

### Data Security
- Encrypted data at rest
- Secure file uploads with validation
- Input sanitization and validation
- CORS and security headers

### Infrastructure Security
- Container security scanning
- Network isolation
- Secrets management
- Regular security updates

## 🚀 Production Deployment

### AWS Deployment

Comprehensive AWS deployment guide available in `AWS_DEPLOYMENT_GUIDE.md`:

1. **Infrastructure Setup**
   - EC2 instances with GPU support
   - Load balancers and auto-scaling
   - S3 for model and data storage
   - CloudWatch monitoring

2. **Deployment Process**
   ```bash
   # Configure AWS credentials
   aws configure
   
   # Deploy infrastructure
   ./scripts/setup-aws-nginx.sh
   
   # Deploy application
   docker compose -f docker-compose.aws.yml up -d
   ```

### Kubernetes Deployment

Kubernetes manifests available in `/k8s`:

```bash
# Deploy to Kubernetes
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
kubectl apply -f k8s/ingress.yaml
```

### Performance Optimization

- **Model Optimization**: Quantization, pruning, distillation
- **Caching**: Redis for API responses and model caching
- **CDN**: Static asset delivery optimization
- **Database**: PostgreSQL with connection pooling

## 🧪 Testing

### Test Coverage

- **Unit Tests**: Core business logic
- **Integration Tests**: API endpoints
- **E2E Tests**: Complete user workflows
- **Performance Tests**: Load and stress testing

### Running Tests

```bash
# All tests
pnpm test

# Frontend tests
cd web && npm test

# Backend tests
cd core && python -m pytest

# E2E tests
pnpm run test:e2e
```

## 📈 Performance Benchmarks

### Training Performance
- **Llama-7B**: ~2 hours on RTX 4090
- **Phi-3-mini**: ~30 minutes on RTX 4090
- **Memory Usage**: 8-16GB VRAM with 4-bit quantization

### Inference Performance
- **Throughput**: 50-100 tokens/second
- **Latency**: <200ms first token
- **Concurrent Users**: 10-50 depending on model size

### System Requirements

**Minimum:**
- 8GB RAM, 4GB VRAM
- 4 CPU cores
- 50GB storage

**Recommended:**
- 32GB RAM, 16GB VRAM
- 8+ CPU cores
- 500GB SSD storage

## 🤝 Community and Support

### Getting Help

1. **Documentation**: Comprehensive guides and API docs
2. **GitHub Discussions**: Community Q&A and feature requests
3. **Discord**: Real-time community chat
4. **GitHub Issues**: Bug reports and feature requests

### Contributing

We welcome contributions! See `CONTRIBUTING.md` for guidelines:

- **Code Contributions**: Features, bug fixes, optimizations
- **Documentation**: Guides, tutorials, API docs
- **Testing**: Test cases, performance benchmarks
- **Community**: Helping others, sharing examples

### Roadmap

**Q1 2025:**
- Multi-GPU training support
- Advanced evaluation metrics
- Model versioning and registry

**Q2 2025:**
- Distributed training
- Custom model architectures
- Enterprise features

## 📄 License

This repository is MIT licensed, except for the `ee` (Enterprise Edition) folders. See [LICENSE](LICENSE) for details.

**Open Source Components:**
- Core training and evaluation engine
- Web interface and API
- Basic deployment tools
- Community features

**Enterprise Edition:**
- Advanced security features
- Enterprise integrations
- Priority support
- Custom deployment options

## 🙏 Acknowledgments

RHStudio is built on top of amazing open-source projects:

- **[Unsloth](https://github.com/unslothai/unsloth)**: Efficient LLM training
- **[Transformers](https://github.com/huggingface/transformers)**: Model implementations
- **[FastAPI](https://fastapi.tiangolo.com/)**: Modern Python web framework
- **[React](https://reactjs.org/)**: Frontend framework
- **[Tailwind CSS](https://tailwindcss.com/)**: Utility-first CSS framework

## ⭐️ Star Us

If you find RHStudio useful, please consider starring the repository to show your support!

![star-studio-on-github](https://documentlm.s3.ap-south-1.amazonaws.com/images/github-star.gif)

---

<div align="center">
  <p>Built with ❤️ by the <a href="https://rhobots.ai">Rhobots</a> team</p>
  <p>
    <a href="https://github.com/rhobots-ai/studio">GitHub</a> •
    <a href="https://docs.rhstudio.ai">Documentation</a> •
    <a href="https://discord.gg/bVQrhHDjkY">Discord</a> •
    <a href="https://twitter.com/rhobots">Twitter</a>
  </p>
</div>
