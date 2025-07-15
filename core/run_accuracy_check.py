#!/usr/bin/env python3
"""
Simple script to run accuracy analysis on predict.json
"""

from accuracy_checker import AccuracyChecker
import sys
import time

def main():
    print("Invoice Prediction Accuracy Analysis")
    print("=" * 50)
    
    # Ask user for options
    print("\nOptions:")
    print("1. Quick analysis (1000 records)")
    print("2. Medium analysis (5000 records)")
    print("3. Full analysis (all records)")
    print("4. Custom number of records")
    
    choice = input("\nSelect option (1-4): ").strip()
    
    max_records = None
    if choice == "1":
        max_records = 1000
    elif choice == "2":
        max_records = 5000
    elif choice == "3":
        max_records = None  # All records
    elif choice == "4":
        try:
            max_records = int(input("Enter number of records: "))
        except ValueError:
            print("Invalid number. Using 1000 records.")
            max_records = 1000
    else:
        print("Invalid choice. Using quick analysis (1000 records).")
        max_records = 1000
    
    # Run analysis
    print(f"\nStarting analysis...")
    if max_records:
        print(f"Processing {max_records:,} records...")
    else:
        print("Processing all records...")
    
    start_time = time.time()
    
    try:
        checker = AccuracyChecker("predict.json")
        report = checker.run_analysis(max_records=max_records)
        
        end_time = time.time()
        duration = end_time - start_time
        
        print(f"\nAnalysis completed in {duration:.1f} seconds")
        print("\n" + report)
        
        # Ask if user wants to save report to file
        save_report = input("\nSave report to file? (y/n): ").strip().lower()
        if save_report in ['y', 'yes']:
            filename = f"accuracy_report_{int(time.time())}.txt"
            with open(filename, 'w') as f:
                f.write(f"Analysis completed in {duration:.1f} seconds\n")
                f.write(report)
            print(f"Report saved to {filename}")
        
    except KeyboardInterrupt:
        print("\nAnalysis interrupted by user.")
    except Exception as e:
        print(f"\nError during analysis: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()
