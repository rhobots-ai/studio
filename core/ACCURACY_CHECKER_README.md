# Invoice Prediction Accuracy Checker

This tool analyzes the accuracy between expected and predicted values from the `predict.json` file, providing comprehensive metrics and error analysis for invoice parsing model evaluation.

## Features

- **Multi-level Accuracy Analysis**: Exact match, fuzzy match, and field-level accuracy
- **Robust JSON Parsing**: Handles malformed predictions and various JSON formats
- **Field Name Normalization**: Maps different field naming conventions
- **Data Type Normalization**: Standardizes dates, amounts, and other field types
- **Comprehensive Reporting**: Detailed statistics, error analysis, and sample errors
- **Flexible Processing**: Process all records or specify a subset
- **Export Options**: Save detailed results to JSON and text reports

## Quick Start

### Option 1: Interactive Script
```bash
cd finetuning.backend
python3 run_accuracy_check.py
```

### Option 2: Command Line
```bash
cd finetuning.backend
python3 accuracy_checker.py --max-records 1000
```

### Option 3: Full Analysis
```bash
cd finetuning.backend
python3 accuracy_checker.py
```

## Command Line Options

```bash
python3 accuracy_checker.py [OPTIONS]

Options:
  -f, --file FILE           Path to prediction JSON file (default: predict.json)
  -m, --max-records NUM     Maximum number of records to process
  -o, --output FILE         Output file for detailed results (default: accuracy_results.json)
  --no-save                 Don't save detailed results to file
  -h, --help               Show help message
```

## Examples

### Quick Analysis (1000 records)
```bash
python3 accuracy_checker.py --max-records 1000
```

### Custom File Analysis
```bash
python3 accuracy_checker.py --file my_predictions.json --max-records 5000
```

### Full Analysis with Custom Output
```bash
python3 accuracy_checker.py --output my_results.json
```

## Data Structure Requirements

The input JSON file should contain an array of prediction records with the following structure:

```json
[
  {
    "expected_json": {
      "invoice_no": "INV-001",
      "invoice_date": "2024-07-18",
      "amount": "1000.00",
      "buyer_gstin": "09AUTPT5890L1ZB",
      "seller_gstin": "09EHGPA1852P1Z0"
    },
    "predict": "Here is the JSON response: {\"invoice_number\": \"INV-001\", ...}",
    "expected": "{\"invoice_no\": \"INV-001\", ...}",
    "instruction": "...",
    "input": {...}
  }
]
```

## Accuracy Metrics

### Overall Metrics
- **Total Records**: Number of records processed
- **JSON Parsing Success Rate**: Percentage of predictions with valid JSON
- **Perfect Record Matches**: Records where all fields match exactly

### Field-Level Metrics
For each field (invoice_no, invoice_date, amount, buyer_gstin, seller_gstin):
- **Exact Match Accuracy**: Percentage of exact field matches
- **Fuzzy Match Accuracy**: Percentage including case-insensitive matches
- **Prediction Coverage**: Percentage of records with predictions for this field

## Field Normalization

### Supported Field Name Variations
- **invoice_no**: invoice_no, invoice_number, invoiceno, invoice_num, bill_no
- **invoice_date**: invoice_date, billDate, bill_date, date
- **amount**: amount, invoice_amount, invoiceAmount, total_amount, total
- **buyer_gstin**: buyer_gstin, buyerGSTIN, buyer_gst, customer_gstin
- **seller_gstin**: seller_gstin, sellerGSTIN, seller_gst, vendor_gstin

### Data Normalization
- **Dates**: Converted to YYYY-MM-DD format
- **Amounts**: Standardized to decimal format (e.g., "1000.00")
- **Strings**: Trimmed and case-normalized for fuzzy matching

## Output Files

### Console Report
Displays summary statistics, field accuracies, and sample errors.

### Detailed JSON Results (`accuracy_results.json`)
Contains complete analysis data including:
- All metrics and statistics
- Individual record results
- Error analysis and categorization
- Processing errors and debugging information

### Text Report (Optional)
Human-readable report that can be saved for documentation.

## Error Handling

The tool gracefully handles:
- **Malformed JSON**: Uses regex patterns to extract key-value pairs
- **Missing Fields**: Tracks coverage and handles null values
- **Data Type Mismatches**: Normalizes different data representations
- **Processing Errors**: Logs errors without stopping analysis

## Performance

- **Memory Efficient**: Processes records incrementally
- **Progress Tracking**: Shows progress for large datasets
- **Configurable Limits**: Process subsets for quick analysis

## Sample Output

```
============================================================
INVOICE PREDICTION ACCURACY REPORT
============================================================

OVERALL STATISTICS:
Total Records: 25,998
JSON Parsing Success: 12,450 (47.9%)
Perfect Record Matches: 3,247 (12.5%)

FIELD-LEVEL ACCURACIES:
----------------------------------------

INVOICE NO:
  Exact Match: 78.5%
  Fuzzy Match: 2.1%
  Prediction Coverage: 89.3%

INVOICE DATE:
  Exact Match: 65.2%
  Fuzzy Match: 8.7%
  Prediction Coverage: 87.1%

AMOUNT:
  Exact Match: 72.3%
  Fuzzy Match: 5.4%
  Prediction Coverage: 85.6%

BUYER GSTIN:
  Exact Match: 81.2%
  Fuzzy Match: 1.8%
  Prediction Coverage: 88.9%

SELLER GSTIN:
  Exact Match: 79.8%
  Fuzzy Match: 2.3%
  Prediction Coverage: 87.4%
```

## Troubleshooting

### Common Issues

1. **File Not Found**
   ```
   Error: File predict.json not found.
   ```
   Solution: Ensure the file exists in the current directory or specify the correct path.

2. **Memory Issues with Large Files**
   ```
   MemoryError: Unable to load large file
   ```
   Solution: Use `--max-records` to process a subset of records.

3. **Low JSON Parsing Success**
   - Check if predictions contain valid JSON
   - Review sample errors for common formatting issues
   - Consider updating regex patterns in `extract_json_from_prediction()`

### Performance Tips

- Use `--max-records` for quick testing
- Run full analysis during off-peak hours for large datasets
- Monitor memory usage with system tools if processing very large files

## Extending the Tool

### Adding New Fields
1. Update `field_mappings` dictionary in `AccuracyChecker` class
2. Add field-specific normalization in `normalize_field_value()`

### Custom Accuracy Metrics
1. Extend `calculate_field_accuracy()` method
2. Add new metrics to results structure
3. Update report generation

### Different Input Formats
1. Modify `load_data()` method for different file formats
2. Update field extraction logic as needed

## Dependencies

- Python 3.6+
- Standard library modules: json, re, argparse, collections, datetime

No external dependencies required!
