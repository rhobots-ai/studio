#!/bin/bash

# ------------------------
# Configurable Defaults
# ------------------------

DOCKER_IMAGE=${DOCKER_IMAGE:-rhobotsai/studio-web:latest}
DOCKERFILE=${DOCKERFILE:-web/Dockerfile}

VITE_API_BASE_URL=${VITE_API_BASE_URL:-http://localhost:5001}
VITE_PROXY_TARGET=${VITE_PROXY_TARGET:-http://localhost:5001}

# ------------------------
# Docker Build Command
# ------------------------

echo "🛠  Building Docker image: $DOCKER_IMAGE"
docker build \
  -f "$DOCKERFILE" \
  --build-arg VITE_API_BASE_URL="$VITE_API_BASE_URL" \
  --build-arg VITE_PROXY_TARGET="$VITE_PROXY_TARGET" \
  -t "$DOCKER_IMAGE" .

echo "✅ Build complete"
