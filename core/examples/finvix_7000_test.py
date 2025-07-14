#!/usr/bin/env python3
"""
Finvix 7000 Test - Model Response Evaluation

This script processes the finvix_7000.json file and only performs evaluation/matching 
when the `model_response` key is available.
"""

import json
import pandas as pd
from typing import Dict, Any, List, Optional
import numpy as np


def load_finvix_data(file_path: str) -> List[Dict[str, Any]]:
    """
    Load the finvix JSON data from file
    """
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    return data


def filter_records_with_model_response(data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Filter records that contain the 'model_response' key
    """
    filtered_data = []
    for record in data:
        if 'model_response' in record and record['model_response'] is not None:
            filtered_data.append(record)
    return filtered_data


def parse_ground_truth(ground_truth_str: str) -> Dict[str, Any]:
    """
    Parse the ground truth JSON string
    """
    try:
        return json.loads(ground_truth_str)
    except json.JSONDecodeError:
        return {}


def calculate_field_accuracy(evaluation_data: List[Dict[str, Any]]) -> Dict[str, Dict[str, float]]:
    """
    Calculate field-level accuracy between ground truth and model response
    """
    field_stats = {}
    
    for record in evaluation_data:
        ground_truth = record['ground_truth']
        model_response = record['model_response']
        
        # Get all unique fields from both ground truth and model response
        all_fields = set(ground_truth.keys()) | set(model_response.keys())
        
        for field in all_fields:
            if field not in field_stats:
                field_stats[field] = {
                    'total': 0,
                    'correct': 0,
                    'ground_truth_present': 0,
                    'model_response_present': 0
                }
            
            field_stats[field]['total'] += 1
            
            # Check if field is present in ground truth
            if field in ground_truth:
                field_stats[field]['ground_truth_present'] += 1
            
            # Check if field is present in model response
            if field in model_response:
                field_stats[field]['model_response_present'] += 1
            
            # Check if values match (only if both are present)
            if field in ground_truth and field in model_response:
                gt_value = str(ground_truth[field]).strip().lower() if ground_truth[field] is not None else ''
                mr_value = str(model_response[field]).strip().lower() if model_response[field] is not None else ''
                
                if gt_value == mr_value:
                    field_stats[field]['correct'] += 1
    
    # Calculate accuracy percentages
    field_accuracy = {}
    for field, stats in field_stats.items():
        total_comparisons = min(stats['ground_truth_present'], stats['model_response_present'])
        accuracy = (stats['correct'] / total_comparisons * 100) if total_comparisons > 0 else 0
        
        field_accuracy[field] = {
            'accuracy': accuracy,
            'correct': stats['correct'],
            'total_comparisons': total_comparisons,
            'ground_truth_present': stats['ground_truth_present'],
            'model_response_present': stats['model_response_present']
        }
    
    return field_accuracy


def analyze_field_performance(evaluation_data: List[Dict[str, Any]], field_name: str) -> Dict[str, Any]:
    """
    Analyze performance for a specific field
    """
    matches = []
    mismatches = []
    missing_in_gt = []
    missing_in_mr = []
    
    for i, record in enumerate(evaluation_data):
        gt = record['ground_truth']
        mr = record['model_response']
        
        if field_name in gt and field_name in mr:
            gt_val = str(gt[field_name]).strip().lower() if gt[field_name] is not None else ''
            mr_val = str(mr[field_name]).strip().lower() if mr[field_name] is not None else ''
            
            if gt_val == mr_val:
                matches.append({
                    'index': i,
                    'ground_truth': gt[field_name],
                    'model_response': mr[field_name]
                })
            else:
                mismatches.append({
                    'index': i,
                    'ground_truth': gt[field_name],
                    'model_response': mr[field_name]
                })
        elif field_name in gt and field_name not in mr:
            missing_in_mr.append({
                'index': i,
                'ground_truth': gt[field_name]
            })
        elif field_name not in gt and field_name in mr:
            missing_in_gt.append({
                'index': i,
                'model_response': mr[field_name]
            })
    
    return {
        'matches': matches,
        'mismatches': mismatches,
        'missing_in_ground_truth': missing_in_gt,
        'missing_in_model_response': missing_in_mr
    }


def main():
    """
    Main function to run the evaluation
    """
    print("🚀 Starting Finvix 7000 Model Response Evaluation")
    print("=" * 60)
    
    # Load data
    print("📂 Loading finvix_7000.json...")
    finvix_data = load_finvix_data('finvix_7000.json')
    print(f"Total records loaded: {len(finvix_data)}")
    
    # Filter records with model_response
    print("\n🔍 Filtering records with model_response...")
    filtered_data = filter_records_with_model_response(finvix_data)
    print(f"Records with model_response: {len(filtered_data)}")
    print(f"Records without model_response: {len(finvix_data) - len(filtered_data)}")
    
    if len(filtered_data) == 0:
        print("❌ No records found with model_response key. Exiting.")
        return
    
    # Process filtered data for evaluation
    print("\n⚙️  Processing data for evaluation...")
    evaluation_data = []
    for record in filtered_data:
        ground_truth = parse_ground_truth(record.get('final_ground_truth', '{}'))
        model_response = record.get('model_response', {})
        
        evaluation_record = {
            'ground_truth': ground_truth,
            'model_response': model_response,
            'instructions': record.get('final_instructions', ''),
            'input': record.get('final_input', '')
        }
        evaluation_data.append(evaluation_record)
    
    print(f"Prepared {len(evaluation_data)} records for evaluation")
    
    # Calculate field accuracy
    print("\n📊 Calculating field-level accuracy...")
    field_accuracy = calculate_field_accuracy(evaluation_data)
    
    # Display results
    print("\n" + "=" * 80)
    print("FIELD-LEVEL ACCURACY RESULTS")
    print("=" * 80)
    
    # Create DataFrame for better visualization
    accuracy_df = pd.DataFrame.from_dict(field_accuracy, orient='index')
    accuracy_df = accuracy_df.sort_values('accuracy', ascending=False)
    
    print(f"\n📊 Field-Level Result Table:")
    print(f"{'Field':<15} {'GT Present':<12} {'MR Present':<12} {'Matches':<10} {'Total Comp':<12} {'Accuracy':<10}")
    print("-" * 80)
    
    for field, stats in accuracy_df.iterrows():
        print(f"{field:<15} {stats['ground_truth_present']:<12} {stats['model_response_present']:<12} "
              f"{stats['correct']:<10} {stats['total_comparisons']:<12} {stats['accuracy']:<10.2f}%")
    
    # Overall statistics
    total_records = len(evaluation_data)
    avg_accuracy = accuracy_df['accuracy'].mean()
    
    print(f"\n📈 Summary Statistics:")
    print(f"Total records with model_response: {total_records}")
    print(f"Average field accuracy: {avg_accuracy:.2f}%")
    print(f"Fields evaluated: {len(field_accuracy)}")
    
    # Detailed analysis for specific fields
    fields_to_analyze = ['invoice_date', 'invoice_no', 'amount', 'buyer_gstin', 'seller_gstin']
    
    print(f"\n🔍 Detailed Field Analysis:")
    print("-" * 50)
    
    for field in fields_to_analyze:
        if field in field_accuracy:
            print(f"\n🔍 Detailed Analysis for '{field}':")
            analysis = analyze_field_performance(evaluation_data, field)
            
            print(f"  ✅ Matches: {len(analysis['matches'])}")
            print(f"  ❌ Mismatches: {len(analysis['mismatches'])}")
            print(f"  🔍 Missing in Model Response: {len(analysis['missing_in_model_response'])}")
            print(f"  🔍 Missing in Ground Truth: {len(analysis['missing_in_ground_truth'])}")
            
            # Show first few mismatches as examples
            if analysis['mismatches']:
                print(f"  📝 Sample Mismatches (first 3):")
                for i, mismatch in enumerate(analysis['mismatches'][:3]):
                    print(f"    {i+1}. GT: '{mismatch['ground_truth']}' vs MR: '{mismatch['model_response']}'")
        else:
            print(f"\n⚠️  Field '{field}' not found in the data")
    
    # Save results to JSON file
    print(f"\n💾 Saving results...")
    results = {
        'summary': {
            'total_records_in_file': len(finvix_data),
            'records_with_model_response': len(filtered_data),
            'records_without_model_response': len(finvix_data) - len(filtered_data),
            'average_field_accuracy': float(avg_accuracy),
            'fields_evaluated': len(field_accuracy)
        },
        'field_accuracy': {field: {
            'accuracy': float(stats['accuracy']),
            'correct': int(stats['correct']),
            'total_comparisons': int(stats['total_comparisons']),
            'ground_truth_present': int(stats['ground_truth_present']),
            'model_response_present': int(stats['model_response_present'])
        } for field, stats in field_accuracy.items()}
    }
    
    # Save to file
    output_file = 'finvix_7000_evaluation_results.json'
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    
    print(f"💾 Results saved to: {output_file}")
    print(f"\n✅ Evaluation completed successfully!")
    print(f"   - Only processed records with 'model_response' key")
    print(f"   - {len(filtered_data)} out of {len(finvix_data)} records were evaluated")
    print(f"   - Average accuracy across all fields: {avg_accuracy:.2f}%")


if __name__ == "__main__":
    main()
