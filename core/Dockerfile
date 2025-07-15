# -----------------------------------
# Python base (used for everything)
# -----------------------------------
FROM --platform=${TARGETPLATFORM} nvidia/cuda:12.8.1-devel-ubuntu24.04 AS base

# Set CUDA environment variables
ENV CUDA_HOME=/usr/local/cuda
ENV PATH=${CUDA_HOME}/bin:${PATH}
ENV LD_LIBRARY_PATH=${CUDA_HOME}/lib64:${LD_LIBRARY_PATH}

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PYTHONIOENCODING=UTF-8

# Create a non-root user
ARG UID=1001
ARG GID=1001
RUN groupadd -g $GID core && \
    useradd -u $UID -g core -m core

# Install Python 3.12 and essential tools
RUN apt-get update && apt-get install -y \
    python3.12 python3.12-dev python3.12-venv python3-pip \
    build-essential git curl wget dumb-init && \
    ln -sf /usr/bin/python3.12 /usr/bin/python && \
    ln -sf /usr/bin/pip3 /usr/bin/pip && \
    python -m venv /venv && \
    /venv/bin/pip install --upgrade pip && \
    rm -rf /var/lib/apt/lists/* \
# -----------------------------------
# Build python dependencies
# -----------------------------------
FROM base AS builder

# Install Python deps
WORKDIR /app

COPY core .

RUN /venv/bin/pip install --no-cache-dir -r requirements.txt

RUN /venv/bin/pip install --no-cache-dir vllm==0.9.1

RUN rm -rf ~/.cache

## -----------------------------------
## Runtime Image
## -----------------------------------
#CMD ["tail", "-f", "/dev/null"]
CMD ["/venv/bin/python", "start_server.py"]
