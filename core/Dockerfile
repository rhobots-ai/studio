# -----------------------------------
# Python base (used for everything)
# -----------------------------------
FROM --platform=${TARGETPLATFORM} python:3.10-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PYTHONIOENCODING=UTF-8

# Create a non-root user
ARG UID=1001
ARG GID=1001
RUN groupadd -g $GID rag && \
    useradd -u $UID -g rag -m rag

RUN echo "Acquire::http::Pipeline-Depth 0;" > /etc/apt/apt.conf.d/99custom && \
    echo "Acquire::http::No-Cache true;" >> /etc/apt/apt.conf.d/99custom && \
    echo "Acquire::BrokenProxy    true;" >> /etc/apt/apt.conf.d/99custom

RUN apt-get update -qqy && \
    apt-get install -y --no-install-recommends \
        ssh \
        git \
        unzip \
        curl \
        cargo \
        gcc \
        g++ \
        poppler-utils \
        libpoppler-dev

# Clean up
RUN apt-get autoremove \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*
# -----------------------------------
# Build python dependencies
# -----------------------------------
FROM base AS builder

# Install Python deps (supports pyproject or requirements.txt)
WORKDIR /app

#COPY rag/scripts/download_pdfjs.sh /app/scripts/download_pdfjs.sh
#RUN chmod +x /app/scripts/download_pdfjs.sh
#ENV PDFJS_PREBUILT_DIR="/app/libs/ktem/ktem/assets/prebuilt/pdfjs-dist"
#RUN bash scripts/download_pdfjs.sh $PDFJS_PREBUILT_DIR

COPY rag .

RUN pip install --upgrade pip
RUN --mount=type=ssh  \
    --mount=type=cache,target=/root/.cache/pip  \
    pip install -e "libs/kotaemon" \
    && pip install -e "libs/ktem" \
    && pip install "pdfservices-sdk@git+https://github.com/niallcm/pdfservices-python-sdk.git@bump-and-unfreeze-requirements"

RUN pip install --no-cache-dir -r requirements.txt

RUN rm -rf ~/.cache

## -----------------------------------
## Runtime Image
## -----------------------------------
#CMD ["tail", "-f", "/dev/null"]
CMD ["gunicorn", "-k", "uvicorn.workers.UvicornWorker", "api:app", "--bind", "0.0.0.0:5001", "--timeout", "0"]
