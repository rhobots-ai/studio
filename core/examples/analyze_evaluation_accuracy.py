import json
import os
from typing import Dict, Any, List, Tuple
import difflib

def load_evaluation_results(file_path: str) -> Dict[str, Any]:
    """Load the evaluation results JSON file."""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"Error loading file: {e}")
        return {}

def calculate_json_field_accuracy(predicted: Dict[str, Any], expected: Dict[str, Any]) -> Dict[str, float]:
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
            # For string comparison, use similarity ratio
            if isinstance(pred_value, str) and isinstance(exp_value, str):
                similarity = difflib.SequenceMatcher(None, str(pred_value), str(exp_value)).ratio()
                field_accuracies[field] = similarity
            else:
                field_accuracies[field] = 1.0 if str(pred_value) == str(exp_value) else 0.0
    
    return field_accuracies

def analyze_evaluation_results(file_path: str) -> Dict[str, Any]:
    """Analyze the evaluation results and calculate accuracy metrics."""
    data = load_evaluation_results(file_path)
    
    if not data:
        return {"error": "Could not load evaluation data"}
    
    results = {
        "total_samples": 0,
        "field_accuracies": {},
        "overall_accuracy": 0.0,
        "perfect_matches": 0,
        "sample_analysis": []
    }
    
    # Check if data has the expected structure
    if "results" in data:
        samples = data["results"]
    elif isinstance(data, list):
        samples = data
    else:
        # Try to find samples in the data structure
        samples = []
        for key, value in data.items():
            if isinstance(value, list) and len(value) > 0:
                if isinstance(value[0], dict) and ("predicted" in value[0] or "expected" in value[0]):
                    samples = value
                    break
    
    if not samples:
        return {"error": "Could not find evaluation samples in the data structure"}
    
    results["total_samples"] = len(samples)
    field_accuracy_sums = {}
    field_counts = {}
    perfect_match_count = 0
    
    # Analyze each sample
    for i, sample in enumerate(samples):
        if i < 5:  # Store first 5 samples for detailed analysis
            results["sample_analysis"].append({
                "sample_index": i,
                "sample_data": sample
            })
        
        # Extract predicted and expected values
        predicted = {}
        expected = {}
        
        if "predicted" in sample and "expected" in sample:
            predicted = sample["predicted"] if isinstance(sample["predicted"], dict) else {}
            expected = sample["expected"] if isinstance(sample["expected"], dict) else {}
        elif "prediction" in sample and "ground_truth" in sample:
            predicted = sample["prediction"] if isinstance(sample["prediction"], dict) else {}
            expected = sample["ground_truth"] if isinstance(sample["ground_truth"], dict) else {}
        else:
            # Try to parse JSON strings if they exist
            for key in sample:
                if "predict" in key.lower() and isinstance(sample[key], str):
                    try:
                        predicted = json.loads(sample[key])
                    except:
                        predicted = {"raw_prediction": sample[key]}
                elif "expect" in key.lower() or "ground" in key.lower() or "truth" in key.lower():
                    if isinstance(sample[key], str):
                        try:
                            expected = json.loads(sample[key])
                        except:
                            expected = {"raw_expected": sample[key]}
                    elif isinstance(sample[key], dict):
                        expected = sample[key]
        
        if predicted and expected:
            # Calculate field accuracies for this sample
            field_accs = calculate_json_field_accuracy(predicted, expected)
            
            # Check if it's a perfect match
            if all(acc == 1.0 for acc in field_accs.values()):
                perfect_match_count += 1
            
            # Accumulate field accuracies
            for field, acc in field_accs.items():
                if field not in field_accuracy_sums:
                    field_accuracy_sums[field] = 0.0
                    field_counts[field] = 0
                field_accuracy_sums[field] += acc
                field_counts[field] += 1
    
    # Calculate average field accuracies
    for field in field_accuracy_sums:
        if field_counts[field] > 0:
            results["field_accuracies"][field] = field_accuracy_sums[field] / field_counts[field]
    
    # Calculate overall accuracy
    if results["field_accuracies"]:
        results["overall_accuracy"] = sum(results["field_accuracies"].values()) / len(results["field_accuracies"])
    
    results["perfect_matches"] = perfect_match_count
    results["perfect_match_rate"] = perfect_match_count / results["total_samples"] if results["total_samples"] > 0 else 0
    
    return results

def print_analysis_report(results: Dict[str, Any]):
    """Print a formatted analysis report."""
    if "error" in results:
        print(f"Error: {results['error']}")
        return
    
    print("=" * 60)
    print("EVALUATION RESULTS ACCURACY ANALYSIS")
    print("=" * 60)
    
    print(f"\nTotal Samples: {results['total_samples']}")
    print(f"Perfect Matches: {results['perfect_matches']} ({results['perfect_match_rate']:.2%})")
    print(f"Overall Accuracy: {results['overall_accuracy']:.4f} ({results['overall_accuracy']:.2%})")
    
    print("\nField-Level Accuracies:")
    print("-" * 40)
    for field, accuracy in sorted(results['field_accuracies'].items()):
        print(f"{field:30}: {accuracy:.4f} ({accuracy:.2%})")
    
    if results['sample_analysis']:
        print("\nSample Analysis (First 5 samples):")
        print("-" * 40)
        for sample in results['sample_analysis']:
            print(f"\nSample {sample['sample_index'] + 1}:")
            print(f"Data keys: {list(sample['sample_data'].keys())}")

if __name__ == "__main__":
    file_path = "evaluation_results_966_e_qwen-2.5-1.5I-15Inv_2025-07-05 (2).json"
    
    if not os.path.exists(file_path):
        print(f"File not found: {file_path}")
        exit(1)
    
    print(f"Analyzing file: {file_path}")
    print(f"File size: {os.path.getsize(file_path) / (1024*1024):.2f} MB")
    
    results = analyze_evaluation_results(file_path)
    print_analysis_report(results)
    
    # Save results to a separate file
    output_file = "accuracy_analysis_results.json"
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    
    print(f"\nDetailed results saved to: {output_file}")
