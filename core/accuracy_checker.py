#!/usr/bin/env python3
"""
Accuracy Checker for Invoice Prediction Model
============================================

This script analyzes the accuracy between expected and predicted values
from the predict.json file, handling various data format challenges.
"""

import json
import re
import sys
from typing import Dict, List, Tuple, Optional, Any
from datetime import datetime
import argparse
from collections import defaultdict, Counter
import traceback


class AccuracyChecker:
    """Main class for checking prediction accuracy."""
    
    def __init__(self, data_file: str = "predict.json"):
        self.data_file = data_file
        self.data = []
        self.results = {
            'total_records': 0,
            'json_parsing_success': 0,
            'exact_matches': 0,
            'field_accuracies': {},
            'error_analysis': defaultdict(list),
            'sample_errors': [],
            'processing_errors': []
        }
        
        # Field mapping for different naming conventions
        self.field_mappings = {
            'invoice_no': ['invoice_no', 'invoice_number', 'invoiceno', 'invoice_num', 'bill_no'],
            'invoice_date': ['invoice_date', 'billDate', 'bill_date', 'date'],
            'amount': ['amount', 'invoice_amount', 'invoiceAmount', 'total_amount', 'total'],
            'buyer_gstin': ['buyer_gstin', 'buyerGSTIN', 'buyer_gst', 'customer_gstin'],
            'seller_gstin': ['seller_gstin', 'sellerGSTIN', 'seller_gst', 'vendor_gstin']
        }
    
    def load_data(self) -> bool:
        """Load data from JSON file."""
        try:
            print(f"Loading data from {self.data_file}...")
            with open(self.data_file, 'r', encoding='utf-8') as f:
                self.data = json.load(f)
            
            self.results['total_records'] = len(self.data)
            print(f"Loaded {len(self.data)} records successfully.")
            return True
            
        except FileNotFoundError:
            print(f"Error: File {self.data_file} not found.")
            return False
        except json.JSONDecodeError as e:
            print(f"Error: Invalid JSON in {self.data_file}: {e}")
            return False
        except Exception as e:
            print(f"Error loading data: {e}")
            return False
    
    def extract_json_from_prediction(self, predict_text: str) -> Optional[Dict]:
        """Extract JSON from prediction text using multiple strategies."""
        if not predict_text:
            return None
        
        # Strategy 1: Look for JSON block between curly braces
        json_patterns = [
            r'\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}',  # Nested braces
            r'\{.*?\}',  # Simple braces (non-greedy)
            r'\{.*\}',   # Simple braces (greedy)
        ]
        
        for pattern in json_patterns:
            matches = re.findall(pattern, predict_text, re.DOTALL)
            for match in matches:
                try:
                    # Clean up the JSON string
                    cleaned_json = self.clean_json_string(match)
                    parsed = json.loads(cleaned_json)
                    if isinstance(parsed, dict) and len(parsed) > 0:
                        return parsed
                except json.JSONDecodeError:
                    continue
        
        # Strategy 2: Try to extract key-value pairs manually
        return self.extract_key_value_pairs(predict_text)
    
    def clean_json_string(self, json_str: str) -> str:
        """Clean and fix common JSON formatting issues."""
        # Remove leading/trailing whitespace and newlines
        json_str = json_str.strip()
        
        # Fix common issues
        json_str = re.sub(r',\s*}', '}', json_str)  # Remove trailing commas
        json_str = re.sub(r',\s*]', ']', json_str)  # Remove trailing commas in arrays
        
        return json_str
    
    def extract_key_value_pairs(self, text: str) -> Optional[Dict]:
        """Extract key-value pairs using regex patterns."""
        result = {}
        
        # Common patterns for key-value extraction
        patterns = [
            r'"([^"]+)":\s*"([^"]*)"',  # "key": "value"
            r'"([^"]+)":\s*([^,}\s]+)',  # "key": value
            r'(\w+):\s*"([^"]*)"',      # key: "value"
            r'(\w+):\s*([^,}\s]+)',     # key: value
        ]
        
        for pattern in patterns:
            matches = re.findall(pattern, text)
            for key, value in matches:
                # Clean up key and value
                key = key.strip().lower()
                value = str(value).strip().strip('"').strip("'")
                
                if key and value and value != 'null':
                    result[key] = value
        
        return result if result else None
    
    def normalize_field_name(self, field_name: str) -> Optional[str]:
        """Normalize field names to standard format."""
        field_name = field_name.lower().strip()
        
        for standard_name, variations in self.field_mappings.items():
            if field_name in [v.lower() for v in variations]:
                return standard_name
        
        return None
    
    def normalize_predicted_data(self, predicted_data: Dict) -> Dict:
        """Normalize predicted data to match expected format."""
        normalized = {}
        
        for key, value in predicted_data.items():
            standard_key = self.normalize_field_name(key)
            if standard_key:
                normalized[standard_key] = self.normalize_field_value(standard_key, value)
        
        return normalized
    
    def normalize_field_value(self, field_name: str, value: Any) -> str:
        """Normalize field values for comparison."""
        if value is None:
            return ""
        
        value_str = str(value).strip()
        
        if field_name == 'invoice_date':
            return self.normalize_date(value_str)
        elif field_name == 'amount':
            return self.normalize_amount(value_str)
        else:
            return value_str
    
    def normalize_date(self, date_str: str) -> str:
        """Normalize date formats to YYYY-MM-DD."""
        if not date_str:
            return ""
        
        # Common date patterns
        date_patterns = [
            r'(\d{4})-(\d{1,2})-(\d{1,2})',  # YYYY-MM-DD
            r'(\d{1,2})-(\d{1,2})-(\d{4})',  # DD-MM-YYYY
            r'(\d{1,2})/(\d{1,2})/(\d{4})',  # DD/MM/YYYY
            r'(\d{4})/(\d{1,2})/(\d{1,2})',  # YYYY/MM/DD
            r'(\d{1,2})-([A-Za-z]{3})-(\d{2,4})',  # DD-MMM-YY/YYYY
        ]
        
        for pattern in date_patterns:
            match = re.search(pattern, date_str)
            if match:
                try:
                    groups = match.groups()
                    if len(groups) == 3:
                        if pattern.startswith(r'(\d{4})'):  # Year first
                            year, month, day = groups
                        elif pattern.endswith(r'(\d{4})'):  # Year last
                            day, month, year = groups
                        else:  # Month name pattern
                            day, month_name, year = groups
                            month_map = {
                                'jan': '01', 'feb': '02', 'mar': '03', 'apr': '04',
                                'may': '05', 'jun': '06', 'jul': '07', 'aug': '08',
                                'sep': '09', 'oct': '10', 'nov': '11', 'dec': '12'
                            }
                            month = month_map.get(month_name.lower()[:3], month_name)
                        
                        # Ensure 4-digit year
                        if len(year) == 2:
                            year = '20' + year if int(year) < 50 else '19' + year
                        
                        # Format as YYYY-MM-DD
                        return f"{year}-{month.zfill(2)}-{day.zfill(2)}"
                except:
                    continue
        
        return date_str
    
    def normalize_amount(self, amount_str: str) -> str:
        """Normalize amount values."""
        if not amount_str:
            return ""
        
        # Remove currency symbols and commas
        amount_str = re.sub(r'[₹$,\s]', '', amount_str)
        
        try:
            # Convert to float and back to string for consistency
            amount_float = float(amount_str)
            return f"{amount_float:.2f}"
        except ValueError:
            return amount_str
    
    def calculate_field_accuracy(self, expected: Dict, predicted: Dict) -> Dict:
        """Calculate accuracy for each field."""
        field_results = {}
        
        for field in self.field_mappings.keys():
            expected_val = expected.get(field, "")
            predicted_val = predicted.get(field, "")
            
            # Exact match
            exact_match = expected_val == predicted_val
            
            # Fuzzy match for strings (case-insensitive, whitespace-normalized)
            fuzzy_match = False
            if not exact_match and expected_val and predicted_val:
                exp_norm = str(expected_val).lower().strip()
                pred_norm = str(predicted_val).lower().strip()
                fuzzy_match = exp_norm == pred_norm
            
            field_results[field] = {
                'expected': expected_val,
                'predicted': predicted_val,
                'exact_match': exact_match,
                'fuzzy_match': fuzzy_match,
                'has_prediction': bool(predicted_val)
            }
        
        return field_results
    
    def process_records(self, max_records: Optional[int] = None) -> None:
        """Process all records and calculate accuracy metrics."""
        print("Processing records...")
        
        field_stats = {field: {'exact': 0, 'fuzzy': 0, 'total': 0, 'has_pred': 0} 
                      for field in self.field_mappings.keys()}
        
        records_to_process = min(len(self.data), max_records) if max_records else len(self.data)
        
        for i, record in enumerate(self.data[:records_to_process]):
            if i % 1000 == 0:
                print(f"Processed {i}/{records_to_process} records...")
            
            try:
                # Get expected data
                expected_data = record.get('expected_json', {})
                
                # Extract and normalize predicted data
                predict_text = record.get('predict', '')
                predicted_json = self.extract_json_from_prediction(predict_text)
                
                if predicted_json:
                    self.results['json_parsing_success'] += 1
                    predicted_data = self.normalize_predicted_data(predicted_json)
                else:
                    predicted_data = {}
                    self.results['error_analysis']['json_parsing_failed'].append(i)
                
                # Calculate field-level accuracy
                field_results = self.calculate_field_accuracy(expected_data, predicted_data)
                
                # Update statistics
                exact_match_count = 0
                for field, result in field_results.items():
                    field_stats[field]['total'] += 1
                    if result['exact_match']:
                        field_stats[field]['exact'] += 1
                        exact_match_count += 1
                    if result['fuzzy_match']:
                        field_stats[field]['fuzzy'] += 1
                    if result['has_prediction']:
                        field_stats[field]['has_pred'] += 1
                
                # Check for perfect record match
                if exact_match_count == len(self.field_mappings):
                    self.results['exact_matches'] += 1
                
                # Store sample errors
                if len(self.results['sample_errors']) < 10:
                    if exact_match_count < len(self.field_mappings):
                        self.results['sample_errors'].append({
                            'record_index': i,
                            'expected': expected_data,
                            'predicted': predicted_data,
                            'field_results': field_results
                        })
            
            except Exception as e:
                self.results['processing_errors'].append({
                    'record_index': i,
                    'error': str(e),
                    'traceback': traceback.format_exc()
                })
        
        # Calculate final field accuracies
        for field, stats in field_stats.items():
            if stats['total'] > 0:
                self.results['field_accuracies'][field] = {
                    'exact_accuracy': stats['exact'] / stats['total'],
                    'fuzzy_accuracy': stats['fuzzy'] / stats['total'],
                    'prediction_coverage': stats['has_pred'] / stats['total'],
                    'total_records': stats['total']
                }
    
    def generate_report(self) -> str:
        """Generate a comprehensive accuracy report."""
        report = []
        report.append("=" * 60)
        report.append("INVOICE PREDICTION ACCURACY REPORT")
        report.append("=" * 60)
        
        # Overall Statistics
        total = self.results['total_records']
        report.append(f"\nOVERALL STATISTICS:")
        report.append(f"Total Records: {total:,}")
        report.append(f"JSON Parsing Success: {self.results['json_parsing_success']:,} ({self.results['json_parsing_success']/total*100:.1f}%)")
        report.append(f"Perfect Record Matches: {self.results['exact_matches']:,} ({self.results['exact_matches']/total*100:.1f}%)")
        
        # Field-level Accuracies
        report.append(f"\nFIELD-LEVEL ACCURACIES:")
        report.append("-" * 40)
        
        for field, stats in self.results['field_accuracies'].items():
            report.append(f"\n{field.upper().replace('_', ' ')}:")
            report.append(f"  Exact Match: {stats['exact_accuracy']*100:.1f}%")
            report.append(f"  Fuzzy Match: {stats['fuzzy_accuracy']*100:.1f}%")
            report.append(f"  Prediction Coverage: {stats['prediction_coverage']*100:.1f}%")
        
        # Error Analysis
        if self.results['processing_errors']:
            report.append(f"\nPROCESSING ERRORS:")
            report.append(f"Total Processing Errors: {len(self.results['processing_errors'])}")
        
        # Sample Errors
        if self.results['sample_errors']:
            report.append(f"\nSAMPLE ERRORS (First 3):")
            report.append("-" * 40)
            
            for i, error in enumerate(self.results['sample_errors'][:3]):
                report.append(f"\nError {i+1} (Record {error['record_index']}):")
                for field, result in error['field_results'].items():
                    if not result['exact_match']:
                        report.append(f"  {field}: Expected='{result['expected']}', Got='{result['predicted']}'")
        
        return "\n".join(report)
    
    def save_detailed_results(self, output_file: str = "accuracy_results.json") -> None:
        """Save detailed results to JSON file."""
        try:
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(self.results, f, indent=2, ensure_ascii=False, default=str)
            print(f"Detailed results saved to {output_file}")
        except Exception as e:
            print(f"Error saving results: {e}")
    
    def run_analysis(self, max_records: Optional[int] = None, save_results: bool = True) -> str:
        """Run complete accuracy analysis."""
        if not self.load_data():
            return "Failed to load data."
        
        self.process_records(max_records)
        report = self.generate_report()
        
        if save_results:
            self.save_detailed_results()
        
        return report


def main():
    """Main function with command-line interface."""
    parser = argparse.ArgumentParser(description="Check accuracy of invoice predictions")
    parser.add_argument("--file", "-f", default="predict.json", 
                       help="Path to prediction JSON file")
    parser.add_argument("--max-records", "-m", type=int, 
                       help="Maximum number of records to process")
    parser.add_argument("--output", "-o", default="accuracy_results.json",
                       help="Output file for detailed results")
    parser.add_argument("--no-save", action="store_true",
                       help="Don't save detailed results to file")
    
    args = parser.parse_args()
    
    # Create and run accuracy checker
    checker = AccuracyChecker(args.file)
    report = checker.run_analysis(
        max_records=args.max_records,
        save_results=not args.no_save
    )
    
    print(report)


if __name__ == "__main__":
    main()
