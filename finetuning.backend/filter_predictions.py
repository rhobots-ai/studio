#!/usr/bin/env python3
"""
Filter predict.json to create a new file with only non-empty predictions
"""

import json
import sys

def filter_non_empty_predictions(input_file="predict.json", output_file="predict_filtered.json"):
    """Filter out records with empty predictions."""
    
    print(f"Loading data from {input_file}...")
    
    try:
        with open(input_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        print(f"Loaded {len(data):,} total records")
        
        # Filter records with non-empty predictions
        filtered_data = []
        empty_count = 0
        
        for i, record in enumerate(data):
            predict_text = record.get('predict', '').strip()
            
            if predict_text:  # Non-empty prediction
                filtered_data.append(record)
            else:
                empty_count += 1
            
            if (i + 1) % 5000 == 0:
                print(f"Processed {i + 1:,} records...")
        
        print(f"\nFiltering complete:")
        print(f"- Total records: {len(data):,}")
        print(f"- Records with predictions: {len(filtered_data):,}")
        print(f"- Empty predictions removed: {empty_count:,}")
        print(f"- Retention rate: {len(filtered_data)/len(data)*100:.1f}%")
        
        # Save filtered data
        print(f"\nSaving filtered data to {output_file}...")
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(filtered_data, f, indent=2, ensure_ascii=False)
        
        print(f"✅ Successfully created {output_file} with {len(filtered_data):,} records")
        
        return len(filtered_data), empty_count
        
    except FileNotFoundError:
        print(f"❌ Error: File {input_file} not found.")
        return 0, 0
    except json.JSONDecodeError as e:
        print(f"❌ Error: Invalid JSON in {input_file}: {e}")
        return 0, 0
    except Exception as e:
        print(f"❌ Error: {e}")
        return 0, 0

def main():
    """Main function with command-line interface."""
    input_file = "predict.json"
    output_file = "predict_filtered.json"
    
    if len(sys.argv) > 1:
        input_file = sys.argv[1]
    if len(sys.argv) > 2:
        output_file = sys.argv[2]
    
    print("=" * 60)
    print("PREDICTION FILTER - Remove Empty Predictions")
    print("=" * 60)
    
    filtered_count, empty_count = filter_non_empty_predictions(input_file, output_file)
    
    if filtered_count > 0:
        print(f"\n🎯 SUMMARY:")
        print(f"Input file: {input_file}")
        print(f"Output file: {output_file}")
        print(f"Records with predictions: {filtered_count:,}")
        print(f"Empty predictions removed: {empty_count:,}")
        
        print(f"\n📊 You can now run accuracy analysis on the filtered file:")
        print(f"python3 accuracy_checker.py --file {output_file}")
        print(f"python3 accuracy_checker_filtered.py --file {output_file}")

if __name__ == "__main__":
    main()
