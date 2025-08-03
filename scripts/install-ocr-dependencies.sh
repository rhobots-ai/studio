#!/bin/bash

# OCR Dependencies Installation Script for Headless Servers
# This script installs all necessary dependencies for PaddleOCR in server environments

set -e  # Exit on any error

echo "🚀 Installing OCR Dependencies for Headless Server Environment"
echo "=============================================================="

# Detect OS
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux
    if command -v apt-get &> /dev/null; then
        # Ubuntu/Debian
        echo "📦 Detected Ubuntu/Debian system"
        
        echo "🔄 Updating package list..."
        sudo apt-get update
        
        echo "📚 Installing system dependencies..."
        sudo apt-get install -y \
            libgl1-mesa-dev \
            libgl1 \
            libglib2.0-0 \
            libsm6 \
            libxext6 \
            libxrender1 \
            libgomp1 \
            libgthread-2.0-0 \
            libfontconfig1 \
            poppler-utils \
            python3-dev \
            python3-pip \
            ffmpeg \
            libsm6 \
            libxext6
            
        echo "✅ System dependencies installed successfully"
        
    elif command -v yum &> /dev/null; then
        # CentOS/RHEL
        echo "📦 Detected CentOS/RHEL system"
        
        echo "🔄 Installing EPEL repository..."
        sudo yum install -y epel-release
        
        echo "📚 Installing system dependencies..."
        sudo yum install -y \
            mesa-libGL \
            glib2 \
            libSM \
            libXext \
            libXrender \
            libgomp \
            fontconfig \
            poppler-utils \
            python3-devel \
            python3-pip
            
        echo "✅ System dependencies installed successfully"
        
    else
        echo "❌ Unsupported Linux distribution. Please install dependencies manually."
        exit 1
    fi
    
elif [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    echo "📦 Detected macOS system"
    
    if command -v brew &> /dev/null; then
        echo "📚 Installing dependencies with Homebrew..."
        brew install poppler
        echo "✅ System dependencies installed successfully"
    else
        echo "❌ Homebrew not found. Please install Homebrew first: https://brew.sh/"
        exit 1
    fi
    
else
    echo "❌ Unsupported operating system: $OSTYPE"
    exit 1
fi

# Install Python dependencies
echo "🐍 Installing Python dependencies..."

# Upgrade pip first
python3 -m pip install --upgrade pip

# Install core dependencies
echo "📦 Installing core OCR dependencies..."
python3 -m pip install \
    paddlepaddle \
    paddleocr \
    opencv-python-headless \
    Pillow \
    pdf2image

echo "✅ Python dependencies installed successfully"

# Test installation
echo "🧪 Testing OCR installation..."

python3 -c "
import sys
import os

# Test imports
try:
    print('Testing PaddleOCR import...')
    os.environ['DISPLAY'] = ':0'  # Set display for headless
    from paddleocr import PaddleOCR
    print('✅ PaddleOCR imported successfully')
    
    print('Testing OpenCV import...')
    import cv2
    print('✅ OpenCV imported successfully')
    
    print('Testing Pillow import...')
    from PIL import Image
    print('✅ Pillow imported successfully')
    
    print('Testing PDF processing...')
    from pdf2image import convert_from_path
    print('✅ PDF processing available')
    
    print('')
    print('🎉 All OCR dependencies are working correctly!')
    print('✅ Installation completed successfully')
    
except Exception as e:
    print(f'❌ Error during testing: {e}')
    print('Please check the installation and try again.')
    sys.exit(1)
"

if [ $? -eq 0 ]; then
    echo ""
    echo "🎉 OCR Dependencies Installation Complete!"
    echo "=========================================="
    echo ""
    echo "✅ All dependencies installed successfully"
    echo "✅ PaddleOCR is ready for use"
    echo "✅ Headless server environment configured"
    echo ""
    echo "🚀 You can now start your application with OCR support!"
    echo ""
    echo "Next steps:"
    echo "1. Start your application: python3 core/main.py"
    echo "2. Test OCR functionality with the new endpoints"
    echo "3. Upload documents for processing"
    echo ""
else
    echo ""
    echo "❌ Installation failed. Please check the errors above."
    echo "You may need to install dependencies manually."
    exit 1
fi
