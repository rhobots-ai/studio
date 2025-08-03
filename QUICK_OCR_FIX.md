# Quick OCR Fix for OpenGL Issues

## 🚨 Immediate Fix for `libGL.so.1` Error

If you're getting the error:
```
libGL.so.1: cannot open shared object file: No such file or directory
```

### Ubuntu/Debian (Modern versions):
```bash
# Install OpenGL libraries
sudo apt-get update
sudo apt-get install -y libgl1 libgl1-mesa-dev libglib2.0-0

# Install other required libraries
sudo apt-get install -y libxrender1 libxext6 libsm6 poppler-utils

# Install Python dependencies
pip install -r core/requirements.txt
```

### Ubuntu/Debian (Older versions):
```bash
# Try these alternative packages
sudo apt-get install -y libgl1-mesa-glx libglib2.0-0 libxrender-dev
```

### CentOS/RHEL:
```bash
sudo yum install -y mesa-libGL glib2 libXrender poppler-utils
pip install -r core/requirements.txt
```

### Alternative: Use the Installation Script
```bash
# Run our automated script
./scripts/install-ocr-dependencies.sh
```

## 🔧 Test the Fix

After installation, test with:
```bash
python3 -c "
import os
os.environ['DISPLAY'] = ':0'
from paddleocr import PaddleOCR
print('✅ PaddleOCR working!')
"
```

## 🐳 Docker Alternative

If system installation is problematic, use Docker:
```dockerfile
FROM python:3.9-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    libgl1 \
    libglib2.0-0 \
    libxrender1 \
    libxext6 \
    libsm6 \
    poppler-utils \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install -r requirements.txt

# Copy and run application
COPY . /app
WORKDIR /app
CMD ["python3", "core/main.py"]
```

## 🚀 Quick Start

1. **Fix dependencies**: Run the commands above for your OS
2. **Install Python packages**: `pip install -r core/requirements.txt`
3. **Test**: `python3 -c "from paddleocr import PaddleOCR; print('OK')"`
4. **Start app**: `python3 core/main.py`

The OCR system should now work without OpenGL errors!
