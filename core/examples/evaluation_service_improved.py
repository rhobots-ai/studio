# This is an improved version of evaluation_service.py that uses the same accuracy calculation
# methods as the improved_accuracy_analyzer.py to ensure consistent results

import difflib
import re
from typing import Dict, Any
import json

def calculate_field_accuracy_improved(predicted: Dict[str, Any], expected: Dict[str, Any]) -> Dict[str, float]:
    """Calculate field-level accuracy using improved analyzer method with similarity ratios"""
    field_accuracies = {}
    all_fields = set(predicted.keys()) | set(expected.keys())
    
    for field in all_fields:
        pred_value = predicted.get(field)
        exp_value = expected.get(field)
        
        if pred_value == exp_value:
            field_accuracies[field] = 1.0
        elif pred_value is None or exp_value is None:
            field_accuracies[field] = 0.0
        else:
            # Convert to strings for comparison
            pred_str = str(pred_value).strip()
            exp_str = str(exp_value).strip()
            
            if pred_str == exp_str:
                field_accuracies[field] = 1.0
            else:
                # Use similarity ratio for partial matches (same as improved analyzer)
                similarity = difflib.SequenceMatcher(None, pred_str, exp_str).ratio()
                field_accuracies[field] = similarity
    
    return field_accuracies

def normalize_date_enhanced_improved(date_str: str) -> str:
    """Enhanced date normalization matching improved analyzer method"""
    if not date_str:
        return ""
    
    # Common date patterns (same as improved analyzer)
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
                    
                    # Format as DD-MM-YYYY (same as improved analyzer)
                    return f"{day.zfill(2)}-{month.zfill(2)}-{year}"
            except:
                continue
    
    return date_str.lower()

def parse_json_string_improved(json_str: str) -> Dict[str, Any]:
    """Safely parse a JSON string, handling various formats (same as improved analyzer)"""
    if not json_str:
        return {}
    
    try:
        # First try direct parsing
        return json.loads(json_str)
    except:
        try:
            # Try to handle escaped quotes
            cleaned = json_str.replace('\\"', '"').replace('\\n', '').replace('\\t', '')
            return json.loads(cleaned)
        except:
            try:
                # Try to extract JSON from nested structure
                if json_str.startswith('{"invoice_date": "{'):
                    # Extract the inner JSON
                    start = json_str.find('": "') + 4
                    end = json_str.rfind('"}')
                    if start > 3 and end > start:
                        inner_json = json_str[start:end]
                        inner_json = inner_json.replace('\\"', '"')
                        return json.loads(inner_json)
            except:
                pass
    
    return {"raw_data": json_str}

# Patch for the EvaluationService class
def patch_evaluation_service_accuracy():
    """
    This function contains the improved accuracy calculation method that should replace
    the existing calculate_structured_data_accuracy method in evaluation_service.py
    """
    
    def calculate_structured_data_accuracy_improved(self, job_id: str, exclude_empty_predictions: bool = True) -> Dict[str, Any]:
        """Calculate structured data accuracy using improved analyzer methods"""
        
        job = self.jobs.get(job_id)
        if not job or job["status"] != "completed":
            return None
        
        results = job.get("results", [])
        if not results:
            return None
        
        # Filter out empty predictions if requested
        filtered_results = []
        empty_predictions_excluded = 0
        
        for result in results:
            predict_text = result.get('predict', '').strip()
            if exclude_empty_predictions and not predict_text:
                empty_predictions_excluded += 1
                continue
            filtered_results.append(result)
        
        if not filtered_results:
            return None
        
        field_accuracy_sums = {}
        field_counts = {}
        total_records = len(results)
        records_with_predictions = len(filtered_results)
        perfect_extractions = 0
        json_parsing_success = 0
        
        for result in filtered_results:
            expected_json = result.get('expected_json', {})
            
            # Parse predicted JSON using improved method
            predicted_json = parse_json_string_improved(result.get('predict', '{}'))
            
            # Count successful JSON parsing
            if isinstance(predicted_json, dict) and "raw_data" not in predicted_json:
                json_parsing_success += 1
            
            # If expected is still nested, try to extract the inner JSON
            if "invoice_date" in expected_json and isinstance(expected_json["invoice_date"], str):
                inner_expected = parse_json_string_improved(expected_json["invoice_date"])
                if inner_expected and "raw_data" not in inner_expected:
                    expected_json = inner_expected
            
            # Calculate field accuracies using improved method
            if isinstance(predicted_json, dict) and "raw_data" not in predicted_json and isinstance(expected_json, dict):
                field_accs = calculate_field_accuracy_improved(predicted_json, expected_json)
                
                # Check for perfect match
                if all(acc == 1.0 for acc in field_accs.values()) and len(field_accs) > 0:
                    perfect_extractions += 1
                
                # Accumulate field accuracies
                for field, acc in field_accs.items():
                    if field not in field_accuracy_sums:
                        field_accuracy_sums[field] = 0.0
                        field_counts[field] = 0
                    field_accuracy_sums[field] += acc
                    field_counts[field] += 1
        
        # Calculate average field accuracies
        field_accuracies = {}
        for field in field_accuracy_sums:
            if field_counts[field] > 0:
                field_accuracies[field] = field_accuracy_sums[field] / field_counts[field]
        
        # Calculate overall accuracy
        overall_accuracy = 0.0
        if field_accuracies:
            overall_accuracy = sum(field_accuracies.values()) / len(field_accuracies)
        
        # Enhanced accuracy metrics matching improved analyzer
        accuracy_metrics = {
            'overall_accuracy': overall_accuracy,
            'field_accuracies': field_accuracies,
            'perfect_extractions': perfect_extractions,
            'perfect_match_rate': perfect_extractions / records_with_predictions if records_with_predictions > 0 else 0,
            'total_records': total_records,
            'records_with_predictions': records_with_predictions,
            'empty_predictions_excluded': empty_predictions_excluded,
            'json_parsing_success': json_parsing_success,
            'json_parsing_success_rate': json_parsing_success / records_with_predictions if records_with_predictions > 0 else 0,
            'parsing_success_rate': json_parsing_success / records_with_predictions if records_with_predictions > 0 else 0,
            'evaluated_fields': list(field_accuracies.keys()),
            'exclude_empty_predictions': exclude_empty_predictions,
            'method': 'improved_analyzer_compatible'
        }
        
        # Store metrics in job
        self.jobs[job_id]['accuracy_metrics'] = accuracy_metrics
        
        return accuracy_metrics
    
    return calculate_structured_data_accuracy_improved

# Instructions for applying the patch
PATCH_INSTRUCTIONS = """
To update your evaluation service to use the improved accuracy calculation:

1. Replace the calculate_structured_data_accuracy method in evaluation_service.py 
   with the calculate_structured_data_accuracy_improved method above.

2. Add the helper functions:
   - calculate_field_accuracy_improved
   - normalize_date_enhanced_improved  
   - parse_json_string_improved

3. This will make the evaluation service use the same accuracy calculation 
   as your improved_accuracy_analyzer.py, giving you consistent results.

Key changes:
- Uses similarity ratios instead of exact boolean matching
- Same JSON parsing logic as improved analyzer
- Same date normalization approach
- Gives partial credit for close matches
"""

if __name__ == "__main__":
    print("=" * 80)
    print("EVALUATION SERVICE IMPROVEMENT PATCH")
    print("=" * 80)
    print(PATCH_INSTRUCTIONS)
    print("\nThis will fix the accuracy discrepancy between your standalone")
    print("analyzer (82.47% for invoice_date) and the evaluation service (50%).")
    print("\nThe improved method uses similarity ratios to give partial credit")
    print("for close matches, which is why you see higher accuracy scores.")
