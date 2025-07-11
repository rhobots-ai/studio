import json
import os
from typing import Dict, Any, List, Tuple
import difflib

def parse_json_string(json_str: str) -> Dict[str, Any]:
    """Safely parse a JSON string, handling various formats."""
    if not json_str:
        return {}
    
    try:
        # First try direct parsing
        return json.loads(json_str)
    except:
        try:
            # Try to handle escaped quotes
            cleaned = json_str.replace('\\"', '"').replace('\\n', '').replace('\\t', '')
            return json.loads(cleaned)
        except:
            try:
                # Try to extract JSON from nested structure
                if json_str.startswith('{"invoice_date": "{'):
                    # Extract the inner JSON
                    start = json_str.find('": "') + 4
                    end = json_str.rfind('"}')
                    if start > 3 and end > start:
                        inner_json = json_str[start:end]
                        inner_json = inner_json.replace('\\"', '"')
                        return json.loads(inner_json)
            except:
                pass
    
    return {"raw_data": json_str}

def calculate_field_accuracy(predicted: Dict[str, Any], expected: Dict[str, Any]) -> Dict[str, float]:
    """Calculate field-level accuracy between predicted and expected JSON."""
    field_accuracies = {}
    all_fields = set(predicted.keys()) | set(expected.keys())
    
    for field in all_fields:
        pred_value = predicted.get(field)
        exp_value = expected.get(field)
        
        if pred_value == exp_value:
            field_accuracies[field] = 1.0
        elif pred_value is None or exp_value is None:
            field_accuracies[field] = 0.0
        else:
            # Convert to strings for comparison
            pred_str = str(pred_value).strip()
            exp_str = str(exp_value).strip()
            
            if pred_str == exp_str:
                field_accuracies[field] = 1.0
            else:
                # Use similarity ratio for partial matches
                similarity = difflib.SequenceMatcher(None, pred_str, exp_str).ratio()
                field_accuracies[field] = similarity
    
    return field_accuracies

def analyze_filtered_evaluation_results(file_path: str) -> Dict[str, Any]:
    """Analyze evaluation results, filtering out samples with empty predictions."""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except Exception as e:
        return {"error": f"Could not load file: {e}"}
    
    if isinstance(data, list):
        samples = data
    else:
        return {"error": "Expected data to be a list of samples"}
    
    # Filter out samples with empty predictions
    filtered_samples = []
    empty_predictions = 0
    
    for sample in samples:
        predict_value = sample.get("predict", "")
        if predict_value and predict_value.strip():
            filtered_samples.append(sample)
        else:
            empty_predictions += 1
    
    results = {
        "original_total_samples": len(samples),
        "empty_predictions": empty_predictions,
        "filtered_samples": len(filtered_samples),
        "field_accuracies": {},
        "overall_accuracy": 0.0,
        "perfect_matches": 0,
        "parsing_errors": 0,
        "detailed_analysis": []
    }
    
    if not filtered_samples:
        return {**results, "error": "No samples with non-empty predictions found"}
    
    field_accuracy_sums = {}
    field_counts = {}
    perfect_match_count = 0
    parsing_errors = 0
    
    for i, sample in enumerate(filtered_samples):
        sample_analysis = {
            "sample_index": i,
            "predicted_raw": sample.get("predict", ""),
            "expected_raw": sample.get("expected", ""),
            "parsing_success": False,
            "field_accuracies": {}
        }
        
        # Parse predicted JSON
        predicted_json = parse_json_string(sample.get("predict", ""))
        
        # Parse expected JSON - handle the nested structure
        expected_raw = sample.get("expected", "")
        expected_json = parse_json_string(expected_raw)
        
        # If expected is still nested, try to extract the inner JSON
        if "invoice_date" in expected_json and isinstance(expected_json["invoice_date"], str):
            inner_expected = parse_json_string(expected_json["invoice_date"])
            if inner_expected and "raw_data" not in inner_expected:
                expected_json = inner_expected
        
        sample_analysis["predicted_parsed"] = predicted_json
        sample_analysis["expected_parsed"] = expected_json
        
        # Check if parsing was successful
        if (isinstance(predicted_json, dict) and "raw_data" not in predicted_json and 
            isinstance(expected_json, dict) and "raw_data" not in expected_json):
            sample_analysis["parsing_success"] = True
            
            # Calculate field accuracies
            field_accs = calculate_field_accuracy(predicted_json, expected_json)
            sample_analysis["field_accuracies"] = field_accs
            
            # Check for perfect match
            if all(acc == 1.0 for acc in field_accs.values()) and len(field_accs) > 0:
                perfect_match_count += 1
            
            # Accumulate field accuracies
            for field, acc in field_accs.items():
                if field not in field_accuracy_sums:
                    field_accuracy_sums[field] = 0.0
                    field_counts[field] = 0
                field_accuracy_sums[field] += acc
                field_counts[field] += 1
        else:
            parsing_errors += 1
        
        # Store detailed analysis for first 10 samples
        if i < 10:
            results["detailed_analysis"].append(sample_analysis)
    
    # Calculate average field accuracies
    for field in field_accuracy_sums:
        if field_counts[field] > 0:
            results["field_accuracies"][field] = field_accuracy_sums[field] / field_counts[field]
    
    # Calculate overall accuracy
    if results["field_accuracies"]:
        results["overall_accuracy"] = sum(results["field_accuracies"].values()) / len(results["field_accuracies"])
    
    results["perfect_matches"] = perfect_match_count
    results["perfect_match_rate"] = perfect_match_count / len(filtered_samples) if len(filtered_samples) > 0 else 0
    results["parsing_errors"] = parsing_errors
    results["parsing_success_rate"] = (len(filtered_samples) - parsing_errors) / len(filtered_samples) if len(filtered_samples) > 0 else 0
    
    return results

def print_filtered_report(results: Dict[str, Any]):
    """Print a filtered analysis report."""
    if "error" in results:
        print(f"Error: {results['error']}")
        return
    
    print("=" * 80)
    print("FILTERED EVALUATION RESULTS ACCURACY ANALYSIS")
    print("(Only samples with non-empty predictions)")
    print("=" * 80)
    
    print(f"\n📊 FILTERING STATISTICS:")
    print(f"   Original Total Samples: {results['original_total_samples']:,}")
    print(f"   Empty Predictions: {results['empty_predictions']:,}")
    print(f"   Filtered Samples (Non-empty): {results['filtered_samples']:,}")
    print(f"   Filter Rate: {(results['filtered_samples']/results['original_total_samples']*100):.2f}%")
    
    print(f"\n📊 ACCURACY STATISTICS:")
    print(f"   Parsing Success Rate: {results['parsing_success_rate']:.2%}")
    print(f"   Parsing Errors: {results['parsing_errors']:,}")
    print(f"   Perfect Matches: {results['perfect_matches']:,} ({results['perfect_match_rate']:.2%})")
    print(f"   Overall Accuracy: {results['overall_accuracy']:.4f} ({results['overall_accuracy']:.2%})")
    
    print(f"\n📋 FIELD-LEVEL ACCURACIES:")
    print("-" * 60)
    if results['field_accuracies']:
        for field, accuracy in sorted(results['field_accuracies'].items(), key=lambda x: x[1], reverse=True):
            print(f"   {field:25}: {accuracy:.4f} ({accuracy:.2%})")
    else:
        print("   No field accuracies calculated")
    
    print(f"\n🔍 DETAILED SAMPLE ANALYSIS (First 10 filtered samples):")
    print("-" * 60)
    for sample in results['detailed_analysis']:
        print(f"\n   Sample {sample['sample_index'] + 1}:")
        print(f"     Parsing Success: {sample['parsing_success']}")
        if sample['parsing_success']:
            print(f"     Predicted Fields: {list(sample['predicted_parsed'].keys())}")
            print(f"     Expected Fields: {list(sample['expected_parsed'].keys())}")
            if sample['field_accuracies']:
                avg_acc = sum(sample['field_accuracies'].values()) / len(sample['field_accuracies'])
                print(f"     Sample Accuracy: {avg_acc:.4f} ({avg_acc:.2%})")
        else:
            print(f"     Parsing failed for predicted or expected JSON")

if __name__ == "__main__":
    file_path = "evaluation_results_966_e_qwen-2.5-1.5I-15Inv_2025-07-05 (5).json"
    
    if not os.path.exists(file_path):
        print(f"File not found: {file_path}")
        exit(1)
    
    print(f"Analyzing file: {file_path}")
    print(f"File size: {os.path.getsize(file_path) / (1024*1024):.2f} MB")
    
    results = analyze_filtered_evaluation_results(file_path)
    print_filtered_report(results)
    
    # Save results
    output_file = "filtered_accuracy_analysis_results.json"
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    
    print(f"\n💾 Detailed results saved to: {output_file}")
