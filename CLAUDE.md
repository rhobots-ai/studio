# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

RHStudio is an open-source AI Fine Tuning platform that helps analyze unstructured data, extract insights, and collaborate in one powerful workspace. The project is structured as a monorepo with two main components:

- **Core (Python)**: FastAPI-based backend service for model fine-tuning with real-time monitoring
- **Web (React/TypeScript)**: Frontend dashboard for managing training sessions and monitoring progress

## Development Commands

### Environment Setup
```bash
# Initial setup
pnpm dev                           # Start development environment with Docker services
pnpm i && pnpm run infra:dev:up --pull always  # Install dependencies and start dev infrastructure

# Infrastructure management
pnpm run infra:dev:up             # Start development containers
pnpm run infra:dev:down           # Stop development containers
pnpm run infra:dev:prune          # Stop containers and remove volumes
pnpm run infra:up                 # Start production containers
```

### Build and Development
```bash
# Build commands
pnpm run build                    # Build all packages using Turbo
turbo run build                   # Direct Turbo build command

# Individual package commands
cd web && pnpm run dev           # Start web development server (Vite)
cd web && pnpm run build         # Build web package
cd web && pnpm run lint          # Lint web package
cd web && pnpm run preview       # Preview web build

# Core API
cd core && python main.py        # Start FastAPI server (port 8000)
cd core && python start_server.py # Alternative server start
```

### Testing
The project includes various test files but no centralized testing framework configured:
- Core has individual test files: `test_*.py` (manual execution)
- Web has ESLint configured but no test runner
- Run tests manually: `python core/test_*.py`

### Database and Data Management
```bash
pnpm run db:reset                # Reset databases in development
pnpm run init                    # Initialize database user
pnpm run nuke                    # Complete cleanup (runs scripts/nuke.sh)
```

## Architecture

### Core Service (Python)
- **FastAPI application** (`core/main.py`) - Main API server
- **Training orchestration** (`core/train_with_logging.py`) - Model fine-tuning with logging
- **Real-time monitoring** (`core/log_monitor.py`) - Dashboard and logging callbacks
- **File management** (`core/file_manager.py`) - Dataset and model file handling
- **Model management** (`core/model_manager.py`) - Model lifecycle management

Key API endpoints:
- `POST /finetune` - Start fine-tuning job
- `GET /jobs/{job_id}` - Get job status
- `GET /logs/{job_id}` - Get job logs
- `DELETE /jobs/{job_id}` - Cancel job

### Web Frontend (React/TypeScript)
- **Vite + React** with TypeScript
- **Tailwind CSS** for styling
- **React Router** for navigation
- **Recharts** for data visualization
- **Framer Motion** for animations

Key routes structure:
- `/` - Dashboard
- `/configure/*` - Model configuration
- `/prediction/*` - Prediction setup and progress
- `/evaluate/*` - Model evaluation and comparison
- `/monitoring` - Real-time monitoring dashboard
- `/settings` - Application settings

### Services Integration
- **Real-time communication** via WebSocket for training progress
- **RESTful API** communication between web and core
- **Docker Compose** for local development and production deployment

## Key Configuration Files

- `turbo.json` - Monorepo build configuration
- `pnpm-workspace.yaml` - pnpm workspace configuration
- `docker-compose.yml` - Production deployment
- `docker-compose.dev.yml` - Development environment
- `core/requirements.txt` - Python dependencies
- `web/package.json` - Frontend dependencies

## Development Workflow

1. **Local Development**: Use `pnpm dev` to start the full development environment
2. **API Development**: Core service runs on port 8000 with FastAPI auto-reload
3. **Frontend Development**: Web interface runs on port 3000 with Vite hot reload
4. **Real-time Dashboard**: Training monitoring available on port 5000
5. **Production**: Deploy using Docker Compose with health checks

## Training Sessions

Training sessions are stored in `core/training_sessions/` with the following structure:
- `config/` - Training configuration files
- `data/` - Training data samples
- `logs/` - Training logs in JSONL format
- `metadata.json` - Session metadata

Training logs use structured JSON format with timestamps, metrics, and progress information.