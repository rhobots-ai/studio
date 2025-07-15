#!/usr/bin/env python3
"""
Example usage of the AccuracyChecker class
"""

from accuracy_checker import AccuracyChecker
import json

def example_basic_usage():
    """Basic usage example"""
    print("=== Basic Usage Example ===")
    
    # Create checker instance
    checker = AccuracyChecker("predict.json")
    
    # Run analysis on first 500 records
    report = checker.run_analysis(max_records=500, save_results=False)
    
    print(report)
    
    # Access specific metrics
    results = checker.results
    print(f"\nJSON Parsing Success Rate: {results['json_parsing_success']/results['total_records']*100:.1f}%")
    
    return checker

def example_custom_analysis():
    """Example of custom analysis"""
    print("\n=== Custom Analysis Example ===")
    
    checker = AccuracyChecker("predict.json")
    
    # Load data
    if not checker.load_data():
        return None
    
    # Process just 100 records for quick analysis
    checker.process_records(max_records=100)
    
    # Custom reporting
    results = checker.results
    print(f"Processed {results['total_records']} records")
    print(f"Perfect matches: {results['exact_matches']}")
    
    # Field-specific analysis
    for field, stats in results['field_accuracies'].items():
        print(f"{field}: {stats['exact_accuracy']*100:.1f}% accuracy")
    
    return checker

def example_error_analysis():
    """Example of error analysis"""
    print("\n=== Error Analysis Example ===")
    
    checker = AccuracyChecker("predict.json")
    checker.run_analysis(max_records=200, save_results=False)
    
    results = checker.results
    
    # Analyze sample errors
    print(f"Found {len(results['sample_errors'])} sample errors:")
    
    for i, error in enumerate(results['sample_errors'][:3]):
        print(f"\nError {i+1}:")
        print(f"  Record: {error['record_index']}")
        
        # Show field mismatches
        for field, result in error['field_results'].items():
            if not result['exact_match']:
                expected = result['expected']
                predicted = result['predicted']
                print(f"  {field}: '{expected}' vs '{predicted}'")
    
    return checker

def example_batch_processing():
    """Example of processing in batches"""
    print("\n=== Batch Processing Example ===")
    
    checker = AccuracyChecker("predict.json")
    
    if not checker.load_data():
        return None
    
    total_records = len(checker.data)
    batch_size = 1000
    
    print(f"Processing {total_records} records in batches of {batch_size}")
    
    # Process in batches (simulated - actual implementation would need modification)
    for start in range(0, min(3000, total_records), batch_size):
        end = min(start + batch_size, total_records)
        print(f"Processing records {start}-{end}...")
        
        # For demonstration, just process a small subset
        checker.process_records(max_records=batch_size)
        break  # Just show one batch for example
    
    return checker

def main():
    """Run all examples"""
    print("AccuracyChecker Usage Examples")
    print("=" * 50)
    
    try:
        # Basic usage
        checker1 = example_basic_usage()
        
        # Custom analysis
        checker2 = example_custom_analysis()
        
        # Error analysis
        checker3 = example_error_analysis()
        
        # Batch processing
        checker4 = example_batch_processing()
        
        print("\n" + "=" * 50)
        print("All examples completed successfully!")
        
    except FileNotFoundError:
        print("Error: predict.json file not found.")
        print("Make sure you're running this from the finetuning.backend directory.")
    except Exception as e:
        print(f"Error running examples: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()
