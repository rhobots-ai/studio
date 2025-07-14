#!/usr/bin/env python3
"""
Startup script for the Model Finetuning API
"""

import subprocess
import sys
import os
import time

def check_dependencies():
    """Check if required dependencies are installed"""
    print("🔍 Checking dependencies...")
    
    required_packages = [
        'fastapi',
        'uvicorn',
        'flask',
        'transformers',
        'torch'
    ]
    
    missing_packages = []
    
    for package in required_packages:
        try:
            __import__(package)
            print(f"   ✅ {package}")
        except ImportError:
            print(f"   ❌ {package} (missing)")
            missing_packages.append(package)
    
    if missing_packages:
        print(f"\n⚠️  Missing packages: {', '.join(missing_packages)}")
        print("   Please install dependencies with: pip install -r requirements.txt")
        return False
    
    print("✅ All dependencies are installed!")
    return True

def start_api_server():
    """Start the FastAPI server"""
    print("\n🚀 Starting FastAPI server...")
    print("   API will be available at: http://localhost:8000")
    print("   API docs will be available at: http://localhost:8000/docs")
    print("   Training dashboard will be available at: http://localhost:5000")
    print("\n   Press Ctrl+C to stop the server")
    print("=" * 60)
    
    try:
        # Start the FastAPI server using uvicorn
        subprocess.run([
            sys.executable, "-m", "uvicorn", 
            "main:app", 
            "--host", "0.0.0.0", 
            "--port", "8800",
            "--reload"
        ])
    except KeyboardInterrupt:
        print("\n\n🛑 Server stopped by user")
    except Exception as e:
        print(f"\n❌ Error starting server: {e}")

def main():
    """Main function"""
    print("🤖 Model Finetuning API Server")
    print("=" * 40)
    
    # Check if we're in the right directory
    if not os.path.exists("main.py"):
        print("❌ main.py not found. Please run this script from the project directory.")
        sys.exit(1)
    
    # Check dependencies
    if not check_dependencies():
        sys.exit(1)
    
    # Start the server
    start_api_server()

if __name__ == "__main__":
    main()
