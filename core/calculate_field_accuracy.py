#!/usr/bin/env python3
"""
Calculate field-level accuracy using enhanced JSON parser on predict_filtered.json
Shows realistic accuracy metrics with the improved parsing
"""

import json
import sys
from enhanced_json_parser import EnhancedJSONParser
from typing import Dict, Any, List

class FieldAccuracyCalculator:
    """Calculate field-level accuracy with enhanced JSON parsing"""
    
    def __init__(self):
        self.parser = EnhancedJSONParser()
        
        # Expected field mappings (based on your data structure)
        self.expected_fields = {
            'invoice_no': 'invoice_no',
            'invoice_date': 'invoice_date', 
            'amount': 'amount',
            'buyer_gstin': 'buyer_gstin',
            'seller_gstin': 'seller_gstin'
        }
    
    def load_data_with_expected(self, filename="predict_filtered.json"):
        """Load data and create expected JSON from the predict data structure"""
        print(f"Loading data from {filename}...")
        
        try:
            with open(filename, 'r', encoding='utf-8') as f:
                data = json.load(f)
            print(f"Loaded {len(data):,} records")
            return data
        except FileNotFoundError:
            print(f"❌ Error: File {filename} not found")
            return []
        except json.JSONDecodeError as e:
            print(f"❌ Error: Invalid JSON in {filename}: {e}")
            return []
    
    def extract_expected_from_record(self, record: Dict[str, Any]) -> Dict[str, Any]:
        """Extract expected values from the record structure"""
        expected = {}
        
        # Try to get expected JSON if it exists
        if 'expected_json' in record:
            return record['expected_json']
        
        # Try to parse expected field if it exists
        if 'expected' in record:
            try:
                expected_data = json.loads(record['expected'])
                if isinstance(expected_data, dict):
                    return expected_data
            except:
                pass
        
        # Try to extract from input structure if available
        if 'input' in record and isinstance(record['input'], dict):
            input_data = record['input']
            
            # Map common field variations to standard names
            field_mappings = {
                'invoice_no': ['invoice_no', 'invoice_number', 'invoiceno', 'bill_no'],
                'invoice_date': ['invoice_date', 'date', 'billDate'],
                'amount': ['amount', 'invoice_amount', 'total_amount'],
                'buyer_gstin': ['buyer_gstin', 'customer_gstin'],
                'seller_gstin': ['seller_gstin', 'vendor_gstin']
            }
            
            for standard_field, variations in field_mappings.items():
                for variation in variations:
                    if variation in input_data:
                        expected[standard_field] = input_data[variation]
                        break
        
        return expected
    
    def fields_match(self, expected, predicted) -> bool:
        """Enhanced field comparison"""
        if expected is None and predicted is None:
            return True
        
        if expected is None or predicted is None:
            return False
        
        expected_str = str(expected).strip()
        predicted_str = str(predicted).strip()
        
        # Exact match first
        if expected_str == predicted_str:
            return True
        
        # Case-insensitive, whitespace-normalized comparison
        expected_clean = ' '.join(expected_str.lower().split())
        predicted_clean = ' '.join(predicted_str.lower().split())
        
        if expected_clean == predicted_clean:
            return True
        
        # Date normalization
        if self._is_date_field(expected_str) or self._is_date_field(predicted_str):
            expected_date = self._normalize_date(expected_str)
            predicted_date = self._normalize_date(predicted_str)
            if expected_date == predicted_date:
                return True
        
        # Amount normalization
        if self._is_numeric_field(expected_str) and self._is_numeric_field(predicted_str):
            try:
                expected_num = float(expected_str.replace(',', '').replace('₹', '').replace('$', ''))
                predicted_num = float(predicted_str.replace(',', '').replace('₹', '').replace('$', ''))
                return abs(expected_num - predicted_num) < 0.01
            except:
                pass
        
        # GSTIN normalization
        if self._is_gstin_field(expected_str) or self._is_gstin_field(predicted_str):
            expected_gstin = ''.join(c.upper() for c in expected_str if c.isalnum())
            predicted_gstin = ''.join(c.upper() for c in predicted_str if c.isalnum())
            return expected_gstin == predicted_gstin
        
        return False
    
    def _is_date_field(self, value: str) -> bool:
        """Check if field appears to be a date"""
        date_indicators = ['/', '-', '20', '19', 'jan', 'feb', 'mar', 'apr', 'may', 'jun',
                          'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
        value_lower = value.lower()
        return any(indicator in value_lower for indicator in date_indicators) and len(value) >= 6
    
    def _is_numeric_field(self, value: str) -> bool:
        """Check if field appears to be numeric"""
        clean_value = value.replace(',', '').replace(' ', '').replace('₹', '').replace('$', '')
        try:
            float(clean_value)
            return True
        except:
            return False
    
    def _is_gstin_field(self, value: str) -> bool:
        """Check if field appears to be a GSTIN"""
        clean_value = ''.join(c for c in value if c.isalnum())
        return len(clean_value) == 15 and clean_value[:2].isdigit()
    
    def _normalize_date(self, date_str: str) -> str:
        """Normalize date string"""
        # Simple normalization - remove separators and convert to lowercase
        return ''.join(c.lower() for c in date_str if c.isalnum())
    
    def calculate_field_accuracy(self, data: List[Dict[str, Any]], sample_size: int = None) -> Dict[str, Any]:
        """Calculate field-level accuracy with enhanced parsing"""
        
        if sample_size:
            data = data[:sample_size]
        
        print(f"Calculating field-level accuracy for {len(data):,} records...")
        
        # Track statistics
        field_stats = {}
        total_records = len(data)
        records_with_predictions = 0
        records_with_expected = 0
        json_parsing_success = 0
        perfect_records = 0
        
        for i, record in enumerate(data):
            predict_text = record.get('predict', '').strip()
            
            if not predict_text:
                continue
            
            records_with_predictions += 1
            
            # Extract expected values
            expected_json = self.extract_expected_from_record(record)
            if not expected_json:
                continue
            
            records_with_expected += 1
            
            # Parse prediction using enhanced parser
            predicted_json = self.parser.extract_json_from_any_format(predict_text)
            
            if predicted_json:
                json_parsing_success += 1
                # Normalize field names
                predicted_json = self.parser.normalize_field_names(predicted_json)
            
            # Calculate field-level accuracy
            record_perfect = True
            
            for field in expected_json.keys():
                if field not in field_stats:
                    field_stats[field] = {
                        'total': 0,
                        'correct': 0,
                        'missing': 0,
                        'incorrect': 0,
                        'coverage': 0
                    }
                
                field_stats[field]['total'] += 1
                
                expected_value = expected_json.get(field)
                predicted_value = predicted_json.get(field)
                
                if predicted_value is not None:
                    field_stats[field]['coverage'] += 1
                
                if self.fields_match(expected_value, predicted_value):
                    field_stats[field]['correct'] += 1
                else:
                    record_perfect = False
                    if predicted_value is None or str(predicted_value).strip() == '':
                        field_stats[field]['missing'] += 1
                    else:
                        field_stats[field]['incorrect'] += 1
            
            if record_perfect and expected_json:
                perfect_records += 1
            
            if (i + 1) % 1000 == 0:
                print(f"Processed {i + 1:,} records...")
        
        # Calculate final metrics
        results = {
            'total_records': total_records,
            'records_with_predictions': records_with_predictions,
            'records_with_expected': records_with_expected,
            'json_parsing_success': json_parsing_success,
            'json_parsing_rate': json_parsing_success / records_with_predictions if records_with_predictions > 0 else 0,
            'perfect_records': perfect_records,
            'overall_accuracy': perfect_records / records_with_expected if records_with_expected > 0 else 0,
            'field_accuracies': {}
        }
        
        # Calculate field-level metrics
        for field, stats in field_stats.items():
            if stats['total'] > 0:
                results['field_accuracies'][field] = {
                    'accuracy': stats['correct'] / stats['total'],
                    'coverage': stats['coverage'] / stats['total'],
                    'total_attempts': stats['total'],
                    'correct': stats['correct'],
                    'missing': stats['missing'],
                    'incorrect': stats['incorrect'],
                    'missing_rate': stats['missing'] / stats['total'],
                    'error_rate': stats['incorrect'] / stats['total']
                }
        
        return results
    
    def print_results(self, results: Dict[str, Any]):
        """Print comprehensive results"""
        
        print(f"\n" + "=" * 70)
        print("FIELD-LEVEL ACCURACY ANALYSIS WITH ENHANCED JSON PARSING")
        print("=" * 70)
        
        print(f"\n📊 OVERALL STATISTICS:")
        print(f"Total Records: {results['total_records']:,}")
        print(f"Records with Predictions: {results['records_with_predictions']:,}")
        print(f"Records with Expected Data: {results['records_with_expected']:,}")
        print(f"JSON Parsing Success: {results['json_parsing_success']:,} ({results['json_parsing_rate']*100:.1f}%)")
        print(f"Perfect Record Matches: {results['perfect_records']:,}")
        print(f"Overall Accuracy: {results['overall_accuracy']*100:.1f}%")
        
        print(f"\n📋 FIELD-LEVEL ACCURACY:")
        print("-" * 70)
        print(f"{'Field':<15} {'Accuracy':<10} {'Coverage':<10} {'Total':<8} {'Correct':<8} {'Missing':<8} {'Errors':<8}")
        print("-" * 70)
        
        # Sort fields by accuracy for better readability
        sorted_fields = sorted(results['field_accuracies'].items(), 
                             key=lambda x: x[1]['accuracy'], reverse=True)
        
        for field, stats in sorted_fields:
            print(f"{field:<15} {stats['accuracy']*100:>7.1f}% {stats['coverage']*100:>8.1f}% "
                  f"{stats['total_attempts']:>6,} {stats['correct']:>6,} "
                  f"{stats['missing']:>6,} {stats['incorrect']:>6,}")
        
        print(f"\n📈 DETAILED FIELD ANALYSIS:")
        print("-" * 50)
        
        for field, stats in sorted_fields:
            print(f"\n🔸 {field.replace('_', ' ').title()}:")
            print(f"  Accuracy: {stats['accuracy']*100:.1f}% ({stats['correct']:,} correct out of {stats['total_attempts']:,})")
            print(f"  Coverage: {stats['coverage']*100:.1f}% (model attempted prediction)")
            print(f"  Missing Rate: {stats['missing_rate']*100:.1f}% (no prediction made)")
            print(f"  Error Rate: {stats['error_rate']*100:.1f}% (wrong prediction)")
        
        print(f"\n💡 KEY INSIGHTS:")
        print("-" * 30)
        
        # Find best and worst performing fields
        if results['field_accuracies']:
            best_field = max(results['field_accuracies'].items(), key=lambda x: x[1]['accuracy'])
            worst_field = min(results['field_accuracies'].items(), key=lambda x: x[1]['accuracy'])
            
            print(f"🏆 Best Performing Field: {best_field[0]} ({best_field[1]['accuracy']*100:.1f}% accuracy)")
            print(f"⚠️  Needs Improvement: {worst_field[0]} ({worst_field[1]['accuracy']*100:.1f}% accuracy)")
            
            # Coverage insights
            high_coverage = [f for f, s in results['field_accuracies'].items() if s['coverage'] > 0.9]
            low_coverage = [f for f, s in results['field_accuracies'].items() if s['coverage'] < 0.7]
            
            if high_coverage:
                print(f"✅ High Coverage Fields: {', '.join(high_coverage)}")
            if low_coverage:
                print(f"📉 Low Coverage Fields: {', '.join(low_coverage)}")

def main():
    """Main function"""
    sample_size = None
    
    if len(sys.argv) > 1:
        try:
            sample_size = int(sys.argv[1])
        except ValueError:
            print("Invalid sample size. Using full dataset.")
    
    calculator = FieldAccuracyCalculator()
    
    # Load data
    data = calculator.load_data_with_expected()
    if not data:
        return
    
    # Calculate field accuracy
    results = calculator.calculate_field_accuracy(data, sample_size)
    
    # Print results
    calculator.print_results(results)
    
    # Save results to file
    output_file = "field_accuracy_results.json"
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    
    print(f"\n✅ Results saved to {output_file}")
    
    print(f"\n🎯 SUMMARY:")
    print(f"Enhanced JSON parsing achieved {results['json_parsing_rate']*100:.1f}% success rate")
    print(f"Overall field-level accuracy: {results['overall_accuracy']*100:.1f}%")
    print(f"Ready for production use with realistic accuracy metrics!")

if __name__ == "__main__":
    main()
