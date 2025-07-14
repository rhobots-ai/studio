#!/usr/bin/env python3
"""
Analyze JSON parsing failures in predict_filtered.json to understand why 20% of parsing fails
"""

import json
import re
import sys
from typing import Dict, List, Any, Tuple
from collections import defaultdict

class JSONFailureAnalyzer:
    def __init__(self, input_file="predict_filtered.json"):
        self.input_file = input_file
        self.data = []
        self.failure_categories = defaultdict(list)
        self.success_count = 0
        self.failure_count = 0
        
    def load_data(self):
        """Load the filtered prediction data"""
        print(f"Loading data from {self.input_file}...")
        try:
            with open(self.input_file, 'r', encoding='utf-8') as f:
                self.data = json.load(f)
            print(f"Loaded {len(self.data):,} records")
            return True
        except FileNotFoundError:
            print(f"❌ Error: File {self.input_file} not found")
            return False
        except json.JSONDecodeError as e:
            print(f"❌ Error: Invalid JSON in {self.input_file}: {e}")
            return False
    
    def extract_json_from_prediction(self, predict_text: str) -> Tuple[Dict[str, Any], str]:
        """
        Try to extract JSON from prediction text using the same logic as the accuracy checker
        Returns: (parsed_json, failure_reason)
        """
        if not predict_text or not predict_text.strip():
            return {}, "empty_prediction"
        
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
                        return parsed, "success"
                except json.JSONDecodeError as e:
                    # Record the specific JSON error
                    return {}, f"malformed_json: {str(e)}"
        
        # Strategy 2: Try to extract key-value pairs manually
        extracted_pairs = self.extract_key_value_pairs(predict_text)
        if extracted_pairs:
            return extracted_pairs, "recovered_from_text"
        
        # Check if there's any JSON-like structure at all
        if '{' in predict_text and '}' in predict_text:
            return {}, "json_structure_found_but_unparseable"
        
        return {}, "no_json_structure_found"
    
    def clean_json_string(self, json_str: str) -> str:
        """Clean and fix common JSON formatting issues"""
        json_str = json_str.strip()
        json_str = re.sub(r',\s*}', '}', json_str)  # Remove trailing commas
        json_str = re.sub(r',\s*]', ']', json_str)  # Remove trailing commas in arrays
        return json_str
    
    def extract_key_value_pairs(self, text: str) -> Dict[str, Any]:
        """Extract key-value pairs using regex patterns"""
        result = {}
        
        patterns = [
            r'"([^"]+)":\s*"([^"]*)"',  # "key": "value"
            r'"([^"]+)":\s*([^,}\s]+)',  # "key": value
            r'(\w+):\s*"([^"]*)"',      # key: "value"
            r'(\w+):\s*([^,}\s]+)',     # key: value
        ]
        
        for pattern in patterns:
            matches = re.findall(pattern, text)
            for key, value in matches:
                key = key.strip().lower()
                value = str(value).strip().strip('"').strip("'")
                
                if key and value and value != 'null':
                    result[key] = value
        
        return result if result else {}
    
    def analyze_failures(self):
        """Analyze all records and categorize JSON parsing failures"""
        print("\nAnalyzing JSON parsing failures...")
        
        for i, record in enumerate(self.data):
            predict_text = record.get('predict', '').strip()
            
            if not predict_text:
                continue  # Skip empty predictions (already filtered)
            
            parsed_json, failure_reason = self.extract_json_from_prediction(predict_text)
            
            if failure_reason == "success":
                self.success_count += 1
            else:
                self.failure_count += 1
                
                # Store detailed failure information
                failure_info = {
                    "record_index": i,
                    "failure_reason": failure_reason,
                    "raw_prediction": predict_text,
                    "prediction_length": len(predict_text),
                    "has_braces": '{' in predict_text and '}' in predict_text,
                    "recovered_data": parsed_json,
                    "expected_fields": list(record.get('expected_json', {}).keys()) if 'expected_json' in record else [],
                    "sample_text": predict_text[:200] + "..." if len(predict_text) > 200 else predict_text
                }
                
                # Categorize the failure
                main_category = failure_reason.split(':')[0]
                self.failure_categories[main_category].append(failure_info)
            
            if (i + 1) % 1000 == 0:
                print(f"Processed {i + 1:,} records...")
    
    def generate_report(self):
        """Generate comprehensive analysis report"""
        total_records = len(self.data)
        success_rate = (self.success_count / total_records) * 100 if total_records > 0 else 0
        failure_rate = (self.failure_count / total_records) * 100 if total_records > 0 else 0
        
        print(f"\n" + "=" * 60)
        print("JSON PARSING FAILURE ANALYSIS REPORT")
        print("=" * 60)
        
        print(f"\n📊 OVERALL STATISTICS:")
        print(f"Total Records Analyzed: {total_records:,}")
        print(f"Successful JSON Parsing: {self.success_count:,} ({success_rate:.1f}%)")
        print(f"Failed JSON Parsing: {self.failure_count:,} ({failure_rate:.1f}%)")
        
        print(f"\n🔍 FAILURE BREAKDOWN BY CATEGORY:")
        print("-" * 50)
        
        for category, failures in sorted(self.failure_categories.items(), key=lambda x: len(x[1]), reverse=True):
            count = len(failures)
            percentage = (count / self.failure_count) * 100 if self.failure_count > 0 else 0
            print(f"{category.replace('_', ' ').title():<35} {count:>6,} ({percentage:>5.1f}%)")
        
        print(f"\n📝 SAMPLE FAILURES BY CATEGORY:")
        print("-" * 50)
        
        for category, failures in self.failure_categories.items():
            print(f"\n🔸 {category.replace('_', ' ').title()} (Sample):")
            
            # Show first few examples
            for i, failure in enumerate(failures[:3]):
                print(f"  Example {i+1}:")
                print(f"    Record Index: {failure['record_index']}")
                print(f"    Reason: {failure['failure_reason']}")
                print(f"    Sample Text: {failure['sample_text']}")
                if failure['recovered_data']:
                    print(f"    Recovered: {failure['recovered_data']}")
                print()
    
    def save_detailed_results(self):
        """Save detailed results to files for further analysis"""
        
        # Save all failures with full details
        failures_output = {
            "analysis_summary": {
                "total_records": len(self.data),
                "successful_parsing": self.success_count,
                "failed_parsing": self.failure_count,
                "success_rate": (self.success_count / len(self.data)) * 100 if self.data else 0,
                "failure_rate": (self.failure_count / len(self.data)) * 100 if self.data else 0
            },
            "failure_categories": {
                category: {
                    "count": len(failures),
                    "percentage": (len(failures) / self.failure_count) * 100 if self.failure_count > 0 else 0,
                    "samples": failures[:10]  # First 10 samples per category
                }
                for category, failures in self.failure_categories.items()
            },
            "all_failures": dict(self.failure_categories)
        }
        
        with open("json_parsing_failures.json", 'w', encoding='utf-8') as f:
            json.dump(failures_output, f, indent=2, ensure_ascii=False)
        
        print(f"✅ Detailed results saved to json_parsing_failures.json")
        
        # Save representative samples for quick review
        samples = {}
        for category, failures in self.failure_categories.items():
            samples[category] = failures[:5]  # Top 5 examples per category
        
        with open("json_failure_samples.json", 'w', encoding='utf-8') as f:
            json.dump(samples, f, indent=2, ensure_ascii=False)
        
        print(f"✅ Sample failures saved to json_failure_samples.json")
        
        # Save raw examples for debugging
        with open("malformed_json_examples.txt", 'w', encoding='utf-8') as f:
            f.write("MALFORMED JSON EXAMPLES FOR DEBUGGING\n")
            f.write("=" * 50 + "\n\n")
            
            for category, failures in self.failure_categories.items():
                f.write(f"\n--- {category.upper().replace('_', ' ')} ---\n\n")
                
                for i, failure in enumerate(failures[:10]):
                    f.write(f"Example {i+1} (Record {failure['record_index']}):\n")
                    f.write(f"Reason: {failure['failure_reason']}\n")
                    f.write(f"Raw Prediction:\n{failure['raw_prediction']}\n")
                    f.write("-" * 30 + "\n\n")
        
        print(f"✅ Raw examples saved to malformed_json_examples.txt")

def main():
    """Main function"""
    input_file = "predict_filtered.json"
    
    if len(sys.argv) > 1:
        input_file = sys.argv[1]
    
    analyzer = JSONFailureAnalyzer(input_file)
    
    if not analyzer.load_data():
        return
    
    analyzer.analyze_failures()
    analyzer.generate_report()
    analyzer.save_detailed_results()
    
    print(f"\n🎯 NEXT STEPS:")
    print(f"1. Review json_failure_samples.json for quick overview")
    print(f"2. Check malformed_json_examples.txt for raw examples")
    print(f"3. Use insights to improve model prompts/training")
    print(f"4. Focus on the most common failure categories first")

if __name__ == "__main__":
    main()
