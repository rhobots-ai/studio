#!/usr/bin/env python3

import json
import os
from datetime import datetime

def create_test_model_with_nested_schema():
    """Create a test model with nested input schema"""
    
    print("🧪 Creating Test Model with Nested Schema")
    print("=" * 50)
    
    # Create models directory if it doesn't exist
    models_dir = "models"
    os.makedirs(models_dir, exist_ok=True)
    
    # Create test model data
    test_model = {
        "model_id": "test_invoice_model_nested",
        "name": "Invoice Assistant (Nested Input)",
        "description": "Test model with nested input schema for invoice processing",
        "input_schema": {
            "raw_text": "string",
            "invoice_date": "string"
        },
        "output_schema": {
            "seller_gstin": "string",
            "buyer_gstin": "string",
            "confidence": "number"
        },
        "created_at": datetime.now().isoformat(),
        "accuracy": 0.92,
        "status": "ready",
        "training_session_id": "test_session_nested",
        "model_type": "unsloth_lora",
        "version": "1.0",
        "model_path": "/fake/path/for/testing",
        "metadata": {
            "static_instruction": "You're invoice assistant",
            "training_config": {
                "model_name": "unsloth/llama-3-8b-bnb-4bit",
                "num_train_epochs": 3,
                "learning_rate": 2e-4
            },
            "dataset_info": {
                "source": "JSON file: sample_nested_input_training_data.json",
                "size": 3
            }
        }
    }
    
    # Load existing models index or create new one
    models_index_file = os.path.join(models_dir, "models_index.json")
    
    if os.path.exists(models_index_file):
        with open(models_index_file, 'r', encoding='utf-8') as f:
            models_index = json.load(f)
    else:
        models_index = {}
    
    # Add test model
    models_index[test_model["model_id"]] = test_model
    
    # Save models index
    with open(models_index_file, 'w', encoding='utf-8') as f:
        json.dump(models_index, f, indent=2, default=str)
    
    print("✅ Test model created successfully!")
    print(f"   Model ID: {test_model['model_id']}")
    print(f"   Name: {test_model['name']}")
    print(f"   Input Schema: {test_model['input_schema']}")
    print(f"   Output Schema: {test_model['output_schema']}")
    print(f"   Static Instruction: {test_model['metadata']['static_instruction']}")
    
    print("\n🎯 Now try the prediction interface - you should see:")
    print("   • Left Panel: 'You're invoice assistant'")
    print("   • Middle Panel: 2 input fields (raw_text, invoice_date)")
    print("   • Right Panel: 3 output fields (seller_gstin, buyer_gstin, confidence)")
    
    print("\n🔄 Please refresh your browser to see the new model!")

if __name__ == "__main__":
    create_test_model_with_nested_schema()
