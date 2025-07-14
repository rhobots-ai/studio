#!/usr/bin/env python3

import json
import os

def update_model_schema_directly():
    """Directly update model schema in the models index file"""
    
    print("🔧 Fixing Model Schema Directly")
    print("=" * 40)
    
    models_index_file = "models/models_index.json"
    
    # Check if models index exists
    if not os.path.exists(models_index_file):
        print("❌ Models index file not found")
        return
    
    # Load models index
    try:
        with open(models_index_file, 'r', encoding='utf-8') as f:
            models_index = json.load(f)
    except Exception as e:
        print(f"❌ Error loading models index: {e}")
        return
    
    if not models_index:
        print("❌ No models found in index")
        return
    
    print(f"📊 Found {len(models_index)} models")
    
    # Update each model's schema
    updated_count = 0
    
    for model_id, model_data in models_index.items():
        print(f"\n🔍 Model: {model_data.get('name', model_id)}")
        print(f"   Current input schema: {model_data.get('input_schema', {})}")
        
        # Check if this model has the old single "input" field
        current_schema = model_data.get('input_schema', {})
        
        if current_schema == {"input": "string"} or "input" in current_schema:
            print("   🔄 Updating to nested schema...")
            
            # Update with nested schema
            new_input_schema = {
                "raw_text": "string",
                "invoice_date": "string"
            }
            
            new_output_schema = {
                "seller_gstin": "string",
                "buyer_gstin": "string",
                "confidence": "number"
            }
            
            new_static_instruction = "You're invoice assistant"
            
            # Update the model data
            model_data["input_schema"] = new_input_schema
            model_data["output_schema"] = new_output_schema
            
            # Add static instruction to metadata
            if "metadata" not in model_data:
                model_data["metadata"] = {}
            model_data["metadata"]["static_instruction"] = new_static_instruction
            
            print(f"   ✅ Updated input schema: {new_input_schema}")
            print(f"   ✅ Updated output schema: {new_output_schema}")
            print(f"   ✅ Added static instruction: '{new_static_instruction}'")
            
            updated_count += 1
        else:
            print("   ✅ Schema already looks correct")
    
    if updated_count > 0:
        # Save updated models index
        try:
            with open(models_index_file, 'w', encoding='utf-8') as f:
                json.dump(models_index, f, indent=2, default=str)
            
            print(f"\n🎉 Successfully updated {updated_count} models!")
            print("\n🔄 Please refresh your browser and try the prediction interface again.")
            print("   You should now see:")
            print("   • Left Panel: 'You're invoice assistant'")
            print("   • Middle Panel: 2 input fields (raw_text, invoice_date)")
            print("   • Right Panel: 3 output fields (seller_gstin, buyer_gstin, confidence)")
            
        except Exception as e:
            print(f"❌ Error saving updated models index: {e}")
    else:
        print("\n📝 No models needed updating")

if __name__ == "__main__":
    update_model_schema_directly()
