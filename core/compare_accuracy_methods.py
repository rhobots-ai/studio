#!/usr/bin/env python3
"""
Compare accuracy between original method and filtered method
"""

from accuracy_checker import AccuracyChecker
from accuracy_checker_filtered import FilteredAccuracyChecker

def compare_methods(max_records=5000):
    """Compare original vs filtered accuracy methods."""
    
    print("=" * 80)
    print("ACCURACY COMPARISON: ORIGINAL vs FILTERED (EXCLUDING EMPTY PREDICTIONS)")
    print("=" * 80)
    
    # Original method
    print("\n🔍 Running ORIGINAL analysis (includes empty predictions)...")
    original_checker = AccuracyChecker("predict.json")
    original_checker.run_analysis(max_records=max_records, save_results=False)
    
    # Filtered method
    print("\n🔍 Running FILTERED analysis (excludes empty predictions)...")
    filtered_checker = FilteredAccuracyChecker("predict.json")
    filtered_checker.run_analysis(max_records=max_records, save_results=False)
    
    # Generate comparison
    print("\n" + "=" * 80)
    print("📊 ACCURACY COMPARISON RESULTS")
    print("=" * 80)
    
    # Overall stats
    orig_total = original_checker.results['total_records']
    filt_total = filtered_checker.results['total_records']
    filt_attempts = filtered_checker.results['records_with_predictions']
    filt_excluded = filtered_checker.results['empty_predictions_excluded']
    
    print(f"\n📈 OVERALL STATISTICS:")
    print(f"Total Records Analyzed: {orig_total:,}")
    print(f"Records with Predictions: {filt_attempts:,} ({filt_attempts/filt_total*100:.1f}%)")
    print(f"Empty Predictions Excluded: {filt_excluded:,} ({filt_excluded/filt_total*100:.1f}%)")
    
    # Perfect matches comparison
    orig_perfect = original_checker.results['exact_matches']
    filt_perfect = filtered_checker.results['exact_matches']
    
    print(f"\n🎯 PERFECT RECORD MATCHES:")
    print(f"Original Method: {orig_perfect:,} ({orig_perfect/orig_total*100:.1f}% of all records)")
    print(f"Filtered Method: {filt_perfect:,} ({filt_perfect/filt_attempts*100:.1f}% of attempts)")
    print(f"Improvement: {(filt_perfect/filt_attempts - orig_perfect/orig_total)*100:.1f} percentage points")
    
    # Field-by-field comparison
    print(f"\n📋 FIELD-LEVEL ACCURACY COMPARISON:")
    print("-" * 60)
    print(f"{'Field':<15} {'Original':<12} {'Filtered':<12} {'Improvement':<12}")
    print("-" * 60)
    
    for field in ['invoice_no', 'invoice_date', 'amount', 'buyer_gstin', 'seller_gstin']:
        orig_acc = original_checker.results['field_accuracies'].get(field, {}).get('exact_accuracy', 0) * 100
        filt_acc = filtered_checker.results['field_accuracies'].get(field, {}).get('exact_accuracy', 0) * 100
        improvement = filt_acc - orig_acc
        
        print(f"{field.replace('_', ' ').title():<15} {orig_acc:<11.1f}% {filt_acc:<11.1f}% +{improvement:<10.1f}%")
    
    # JSON parsing success
    orig_json = original_checker.results['json_parsing_success']
    filt_json = filtered_checker.results['json_parsing_success']
    
    print(f"\n🔧 JSON PARSING SUCCESS:")
    print(f"Original Method: {orig_json:,} ({orig_json/orig_total*100:.1f}% of all records)")
    print(f"Filtered Method: {filt_json:,} ({filt_json/filt_attempts*100:.1f}% of attempts)")
    print(f"Improvement: {(filt_json/filt_attempts - orig_json/orig_total)*100:.1f} percentage points")
    
    # Summary
    print(f"\n" + "=" * 60)
    print("🚀 KEY IMPROVEMENTS BY EXCLUDING EMPTY PREDICTIONS:")
    print("=" * 60)
    
    avg_orig = sum(original_checker.results['field_accuracies'][f]['exact_accuracy'] for f in original_checker.results['field_accuracies']) / 5 * 100
    avg_filt = sum(filtered_checker.results['field_accuracies'][f]['exact_accuracy'] for f in filtered_checker.results['field_accuracies']) / 5 * 100
    
    print(f"✅ Average Field Accuracy: {avg_orig:.1f}% → {avg_filt:.1f}% (+{avg_filt-avg_orig:.1f}%)")
    print(f"✅ Perfect Record Matches: {orig_perfect/orig_total*100:.1f}% → {filt_perfect/filt_attempts*100:.1f}% (+{(filt_perfect/filt_attempts - orig_perfect/orig_total)*100:.1f}%)")
    print(f"✅ JSON Parsing Success: {orig_json/orig_total*100:.1f}% → {filt_json/filt_attempts*100:.1f}% (+{(filt_json/filt_attempts - orig_json/orig_total)*100:.1f}%)")
    print(f"✅ More realistic metrics based on {filt_attempts:,} actual prediction attempts")
    
    print(f"\n💡 RECOMMENDATION:")
    print(f"Use the filtered method for more accurate assessment of your model's")
    print(f"performance on cases where it actually attempts to make predictions.")

if __name__ == "__main__":
    import sys
    
    
    max_records = 5000
    if len(sys.argv) > 1:
        try:
            max_records = int(sys.argv[1])
        except ValueError:
            print("Invalid number of records. Using default 5000.")
    
    compare_methods(max_records)
