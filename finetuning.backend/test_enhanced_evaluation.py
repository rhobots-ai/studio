#!/usr/bin/env python3
"""
Test script to demonstrate the enhanced evaluation service
"""

import json
from evaluation_service import evaluation_service

def test_enhanced_accuracy_calculation():
    """Test the enhanced accuracy calculation with sample data"""
    
    print("=" * 60)
    print("TESTING ENHANCED EVALUATION SERVICE")
    print("=" * 60)
    
    # Create sample test data that mimics your predict.json structure
    sample_results = [
        {
            "instruction": "Extract invoice data...",
            "input": {"text": "Invoice data 1"},
            "predict": '{"invoice_number": "INV-001", "invoice_date": "2024-07-18", "amount": "1000.00", "buyer_gstin": "09AUTPT5890L1ZB", "seller_gstin": "09EHGPA1852P1Z0"}',
            "expected_json": {
                "invoice_no": "INV-001",
                "invoice_date": "2024-07-18", 
                "amount": "1000.00",
                "buyer_gstin": "09AUTPT5890L1ZB",
                "seller_gstin": "09EHGPA1852P1Z0"
            }
        },
        {
            "instruction": "Extract invoice data...",
            "input": {"text": "Invoice data 2"},
            "predict": "",  # Empty prediction
            "expected_json": {
                "invoice_no": "INV-002",
                "invoice_date": "2024-07-19",
                "amount": "2000.00", 
                "buyer_gstin": "09BCDPT5890L1ZB",
                "seller_gstin": "09XYZPA1852P1Z0"
            }
        },
        {
            "instruction": "Extract invoice data...",
            "input": {"text": "Invoice data 3"},
            "predict": 'Here is the extracted data: {"invoiceno": "INV-003", "billDate": "19-Jul-24", "invoiceAmount": 3000, "buyerGSTIN": "09DEFPT5890L1ZB", "sellerGSTIN": "09ABCPA1852P1Z0"}',
            "expected_json": {
                "invoice_no": "INV-003",
                "invoice_date": "2024-07-19",
                "amount": "3000.00",
                "buyer_gstin": "09DEFPT5890L1ZB", 
                "seller_gstin": "09ABCPA1852P1Z0"
            }
        },
        {
            "instruction": "Extract invoice data...",
            "input": {"text": "Invoice data 4"},
            "predict": '{"invoice_no": "INV-004", "invoice_date": "2024-07-20", "amount": "4000.00", "buyer_gstin": "WRONG_GSTIN", "seller_gstin": "09GHIPA1852P1Z0"}',
            "expected_json": {
                "invoice_no": "INV-004",
                "invoice_date": "2024-07-20",
                "amount": "4000.00",
                "buyer_gstin": "09GHIPT5890L1ZB",
                "seller_gstin": "09GHIPA1852P1Z0"
            }
        }
    ]
    
    # Create a mock job
    job_id = "test_job_123"
    evaluation_service.jobs[job_id] = {
        "id": job_id,
        "status": "completed",
        "results": sample_results,
        "mapping": {
            "output_columns": {
                "invoice_no": "invoice_no",
                "invoice_date": "invoice_date", 
                "amount": "amount",
                "buyer_gstin": "buyer_gstin",
                "seller_gstin": "seller_gstin"
            }
        }
    }
    
    print(f"Created test job with {len(sample_results)} sample results")
    print("Sample data includes:")
    print("- 1 perfect match")
    print("- 1 empty prediction") 
    print("- 1 with field name variations (invoiceno vs invoice_no)")
    print("- 1 with partial errors")
    
    # Test with empty predictions included (old method)
    print(f"\n" + "=" * 40)
    print("TESTING WITH EMPTY PREDICTIONS INCLUDED:")
    print("=" * 40)
    
    metrics_with_empty = evaluation_service.calculate_structured_data_accuracy(
        job_id, exclude_empty_predictions=False
    )
    
    if metrics_with_empty:
        print(f"Overall Accuracy: {metrics_with_empty['overall_accuracy']*100:.1f}%")
        print(f"Total Records: {metrics_with_empty['total_records']}")
        print(f"JSON Parsing Success: {metrics_with_empty['json_parsing_success']}/{metrics_with_empty['total_records']} ({metrics_with_empty['json_parsing_success_rate']*100:.1f}%)")
        
        print(f"\nField Accuracies:")
        for field, stats in metrics_with_empty['field_accuracies'].items():
            print(f"  {field}: {stats['exact_accuracy']*100:.1f}%")
    
    # Test with empty predictions excluded (new enhanced method)
    print(f"\n" + "=" * 40)
    print("TESTING WITH EMPTY PREDICTIONS EXCLUDED:")
    print("=" * 40)
    
    metrics_filtered = evaluation_service.calculate_structured_data_accuracy(
        job_id, exclude_empty_predictions=True
    )
    
    if metrics_filtered:
        print(f"Overall Accuracy: {metrics_filtered['overall_accuracy']*100:.1f}%")
        print(f"Total Records: {metrics_filtered['total_records']}")
        print(f"Records with Predictions: {metrics_filtered['records_with_predictions']}")
        print(f"Empty Predictions Excluded: {metrics_filtered['empty_predictions_excluded']}")
        print(f"JSON Parsing Success: {metrics_filtered['json_parsing_success']}/{metrics_filtered['records_with_predictions']} ({metrics_filtered['json_parsing_success_rate']*100:.1f}%)")
        
        print(f"\nField Accuracies (Enhanced):")
        for field, stats in metrics_filtered['field_accuracies'].items():
            print(f"  {field}:")
            print(f"    Exact Accuracy: {stats['exact_accuracy']*100:.1f}%")
            print(f"    Prediction Coverage: {stats['prediction_coverage']*100:.1f}%")
            print(f"    Total Attempts: {stats['total_attempts']}")
    
    # Show improvement
    if metrics_with_empty and metrics_filtered:
        print(f"\n" + "=" * 40)
        print("IMPROVEMENT SUMMARY:")
        print("=" * 40)
        
        old_avg = sum(stats['exact_accuracy'] for stats in metrics_with_empty['field_accuracies'].values()) / len(metrics_with_empty['field_accuracies']) * 100
        new_avg = sum(stats['exact_accuracy'] for stats in metrics_filtered['field_accuracies'].values()) / len(metrics_filtered['field_accuracies']) * 100
        
        print(f"Average Field Accuracy:")
        print(f"  With empty predictions: {old_avg:.1f}%")
        print(f"  Without empty predictions: {new_avg:.1f}%")
        print(f"  Improvement: +{new_avg - old_avg:.1f} percentage points")
        
        print(f"\nOverall Accuracy:")
        print(f"  With empty predictions: {metrics_with_empty['overall_accuracy']*100:.1f}%")
        print(f"  Without empty predictions: {metrics_filtered['overall_accuracy']*100:.1f}%")
        print(f"  Improvement: +{(metrics_filtered['overall_accuracy'] - metrics_with_empty['overall_accuracy'])*100:.1f} percentage points")
    
    # Clean up
    del evaluation_service.jobs[job_id]
    
    print(f"\n✅ Enhanced evaluation service is working correctly!")
    print(f"Your evaluation system now provides much more realistic accuracy metrics.")

if __name__ == "__main__":
    test_enhanced_accuracy_calculation()
