import json
from typing import Dict, List, Any, Tuple
import re
from collections import defaultdict

class AGPredictionsAccuracyAnalyzer:
    def __init__(self, file_path: str):
        self.file_path = file_path
        self.data = None
        self.accuracy_results = {}
        
    def load_data(self):
        """Load the JSON data from file"""
        try:
            print(f"Loading data from {self.file_path}...")
            with open(self.file_path, 'r', encoding='utf-8') as f:
                self.data = json.load(f)
            print(f"Successfully loaded {len(self.data)} records")
            return True
        except Exception as e:
            print(f"Error loading data: {e}")
            return False
    
    def extract_json_from_response(self, model_response: Any) -> Dict:
        """Extract JSON from model response"""
        if not model_response:
            return {}
        
        # If model_response is already a dict and doesn't have error, return it
        if isinstance(model_response, dict):
            if 'error' not in model_response:
                return model_response
            
            # If there's an error, try to extract from raw_response
            if 'raw_response' in model_response:
                try:
                    raw_data = json.loads(model_response['raw_response'])
                    if 'choices' in raw_data and len(raw_data['choices']) > 0:
                        content = raw_data['choices'][0]['message']['content']
                        return self.parse_content_to_json(content)
                except:
                    pass
            return {}
        
        # If it's a string, try to parse it
        if isinstance(model_response, str):
            return self.parse_content_to_json(model_response)
        
        return {}
    
    def parse_content_to_json(self, content: str) -> Dict:
        """Parse content string to JSON"""
        if not content:
            return {}
        
        try:
            # Try direct JSON parsing first
            return json.loads(content)
        except:
            pass
        
        # Try to find JSON within the text
        json_patterns = [
            r'\{.*\}',  # Match anything between curly braces
            r'```json\s*(\{.*?\})\s*```',  # Match JSON in code blocks
            r'```\s*(\{.*?\})\s*```',  # Match JSON in generic code blocks
        ]
        
        for pattern in json_patterns:
            matches = re.findall(pattern, content, re.DOTALL)
            for match in matches:
                try:
                    return json.loads(match)
                except:
                    continue
        
        # Try to fix common JSON formatting issues
        try:
            # Fix unquoted keys
            fixed_content = re.sub(r'(\w+):', r'"\1":', content)
            return json.loads(fixed_content)
        except:
            pass
        
        return {}
    
    def normalize_value(self, value: Any) -> str:
        """Normalize values for comparison"""
        if value is None:
            return ""
        if isinstance(value, (int, float)):
            return str(value)
        if isinstance(value, str):
            return value.strip().lower()
        if isinstance(value, list):
            return str(sorted([self.normalize_value(v) for v in value]))
        if isinstance(value, dict):
            return str(sorted([(k, self.normalize_value(v)) for k, v in value.items()]))
        return str(value).strip().lower()
    
    def calculate_field_accuracy(self, expected: Dict, predicted: Dict) -> Dict:
        """Calculate accuracy for each field"""
        field_results = {}
        all_fields = set(expected.keys()) | set(predicted.keys())
        
        for field in all_fields:
            expected_val = expected.get(field)
            predicted_val = predicted.get(field)
            
            expected_norm = self.normalize_value(expected_val)
            predicted_norm = self.normalize_value(predicted_val)
            
            is_correct = expected_norm == predicted_norm
            
            field_results[field] = {
                'expected': expected_val,
                'predicted': predicted_val,
                'correct': is_correct,
                'expected_normalized': expected_norm,
                'predicted_normalized': predicted_norm
            }
        
        return field_results
    
    def analyze_accuracy(self):
        """Analyze accuracy between expected and model_response"""
        if not self.data:
            print("No data loaded. Please load data first.")
            return
        
        print("Analyzing accuracy...")
        
        total_records = len(self.data)
        field_accuracy = defaultdict(lambda: {'correct': 0, 'total': 0, 'errors': []})
        overall_correct = 0
        parsing_errors = 0
        detailed_results = []
        
        for i, record in enumerate(self.data):
            if i % 100 == 0:
                print(f"Processing record {i+1}/{total_records}")
            
            # Get expected and model response
            expected_raw = record.get('expected', {})
            model_response_raw = record.get('model_response', {})
            
            # Parse expected (it might be a JSON string)
            try:
                if isinstance(expected_raw, str):
                    expected = json.loads(expected_raw)
                elif isinstance(expected_raw, dict):
                    expected = expected_raw
                else:
                    expected = {}
            except:
                expected = {}
            
            # Parse model response
            try:
                model_response = self.extract_json_from_response(model_response_raw)
                if not model_response:
                    parsing_errors += 1
                    continue
            except Exception as e:
                parsing_errors += 1
                continue
            
            # Calculate field-level accuracy
            field_results = self.calculate_field_accuracy(expected, model_response)
            
            # Track overall accuracy
            record_correct = all(result['correct'] for result in field_results.values())
            if record_correct:
                overall_correct += 1
            
            # Track field-level accuracy
            for field, result in field_results.items():
                field_accuracy[field]['total'] += 1
                if result['correct']:
                    field_accuracy[field]['correct'] += 1
                else:
                    field_accuracy[field]['errors'].append({
                        'record_index': i,
                        'expected': result['expected'],
                        'predicted': result['predicted']
                    })
            
            # Store detailed results for first 10 records
            if i < 10:
                detailed_results.append({
                    'record_index': i,
                    'expected': expected,
                    'model_response_parsed': model_response,
                    'field_results': field_results,
                    'overall_correct': record_correct
                })
        
        # Calculate final accuracy metrics
        valid_records = total_records - parsing_errors
        overall_accuracy = (overall_correct / valid_records * 100) if valid_records > 0 else 0
        
        # Calculate field accuracies
        field_accuracy_summary = {}
        for field, stats in field_accuracy.items():
            accuracy = (stats['correct'] / stats['total'] * 100) if stats['total'] > 0 else 0
            field_accuracy_summary[field] = {
                'accuracy_percentage': round(accuracy, 2),
                'correct_count': stats['correct'],
                'total_count': stats['total'],
                'error_count': len(stats['errors']),
                'sample_errors': stats['errors'][:5]  # First 5 errors as samples
            }
        
        self.accuracy_results = {
            'summary': {
                'total_records': total_records,
                'valid_records': valid_records,
                'parsing_errors': parsing_errors,
                'overall_accuracy': round(overall_accuracy, 2),
                'overall_correct_count': overall_correct
            },
            'field_accuracy': field_accuracy_summary,
            'detailed_sample_results': detailed_results
        }
        
        return self.accuracy_results
    
    def print_results(self):
        """Print formatted accuracy results"""
        if not self.accuracy_results:
            print("No results available. Please run analyze_accuracy() first.")
            return
        
        results = self.accuracy_results
        
        print("\n" + "="*80)
        print("AG PREDICTIONS ACCURACY ANALYSIS RESULTS")
        print("="*80)
        
        # Summary
        summary = results['summary']
        print(f"\nOVERALL SUMMARY:")
        print(f"Total Records: {summary['total_records']}")
        print(f"Valid Records: {summary['valid_records']}")
        print(f"Parsing Errors: {summary['parsing_errors']}")
        print(f"Overall Accuracy: {summary['overall_accuracy']}%")
        print(f"Correct Predictions: {summary['overall_correct_count']}/{summary['valid_records']}")
        
        # Field-level accuracy
        print(f"\nFIELD-LEVEL ACCURACY:")
        print("-" * 60)
        field_acc = results['field_accuracy']
        
        # Sort fields by accuracy
        sorted_fields = sorted(field_acc.items(), key=lambda x: x[1]['accuracy_percentage'], reverse=True)
        
        for field, stats in sorted_fields:
            print(f"{field:30} | {stats['accuracy_percentage']:6.2f}% | {stats['correct_count']:4d}/{stats['total_count']:4d} | Errors: {stats['error_count']}")
        
        # Show sample errors for worst performing fields
        print(f"\nSAMPLE ERRORS (Top 3 worst performing fields):")
        print("-" * 60)
        worst_fields = sorted(field_acc.items(), key=lambda x: x[1]['accuracy_percentage'])[:3]
        
        for field, stats in worst_fields:
            if stats['sample_errors']:
                print(f"\n{field} (Accuracy: {stats['accuracy_percentage']}%):")
                for i, error in enumerate(stats['sample_errors'][:3]):
                    print(f"  Error {i+1}:")
                    print(f"    Expected: {error['expected']}")
                    print(f"    Predicted: {error['predicted']}")
        
        print("\n" + "="*80)
    
    def save_results(self, output_file: str = None):
        """Save results to JSON file"""
        if not self.accuracy_results:
            print("No results to save. Please run analyze_accuracy() first.")
            return
        
        if not output_file:
            output_file = self.file_path.replace('.json', '_accuracy_analysis.json')
        
        try:
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(self.accuracy_results, f, indent=2, ensure_ascii=False)
            print(f"Results saved to: {output_file}")
        except Exception as e:
            print(f"Error saving results: {e}")

def main():
    # Initialize analyzer
    file_path = "ag_with_predictions_with_finvix.json"
    analyzer = AGPredictionsAccuracyAnalyzer(file_path)
    
    # Load and analyze data
    if analyzer.load_data():
        results = analyzer.analyze_accuracy()
        analyzer.print_results()
        analyzer.save_results()
    else:
        print("Failed to load data. Please check the file path and format.")

if __name__ == "__main__":
    main()
