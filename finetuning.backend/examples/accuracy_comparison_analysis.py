import json
import difflib
from typing import Dict, Any
import re

def evaluation_service_normalize_date(date_str: str) -> str:
    """Date normalization from evaluation service"""
    try:
        # Remove extra spaces and common separators
        clean_date = date_str.strip().replace('/', '-').replace('.', '-')
        
        # Try to parse common date formats
        from datetime import datetime
        
        # Try different date formats
        formats = ['%d-%m-%Y', '%d-%m-%y', '%Y-%m-%d', '%m-%d-%Y', '%m-%d-%y']
        
        for fmt in formats:
            try:
                parsed_date = datetime.strptime(clean_date, fmt)
                # Convert 2-digit years to 4-digit (assume 21st century)
                if parsed_date.year < 100:
                    parsed_date = parsed_date.replace(year=parsed_date.year + 2000)
                return parsed_date.strftime('%Y-%m-%d')
            except ValueError:
                continue
        
        # If parsing fails, return cleaned string
        return clean_date.lower()
        
    except Exception:
        return date_str.lower()

def improved_analyzer_normalize_date(date_str: str) -> str:
    """Enhanced date normalization from improved analyzer"""
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
                    
                    # Format as DD-MM-YYYY (different from evaluation service!)
                    return f"{day.zfill(2)}-{month.zfill(2)}-{year}"
            except:
                continue
    
    return date_str.lower()

def evaluation_service_fields_match(expected, predicted) -> bool:
    """Field matching from evaluation service"""
    if expected is None and predicted is None:
        return True
    
    if expected is None or predicted is None:
        return False
    
    # Convert both to strings for comparison
    expected_str = str(expected).strip()
    predicted_str = str(predicted).strip()
    
    # Exact match first (fastest)
    if expected_str == predicted_str:
        return True
    
    # Handle date comparisons
    if _is_date_field(expected_str) or _is_date_field(predicted_str):
        normalized_expected = evaluation_service_normalize_date(expected_str)
        normalized_predicted = evaluation_service_normalize_date(predicted_str)
        if normalized_expected and normalized_predicted:
            return normalized_expected == normalized_predicted
    
    # Fuzzy string matching (case-insensitive, whitespace-normalized)
    expected_clean = ' '.join(expected_str.lower().split())
    predicted_clean = ' '.join(predicted_str.lower().split())
    
    return expected_clean == predicted_clean

def improved_analyzer_fields_match(expected, predicted) -> bool:
    """Field matching from improved analyzer using similarity ratio"""
    if expected == predicted:
        return True
    elif expected is None or predicted is None:
        return False
    else:
        # Convert to strings for comparison
        pred_str = str(predicted).strip()
        exp_str = str(expected).strip()
        
        if pred_str == exp_str:
            return True
        else:
            # Use similarity ratio for partial matches
            similarity = difflib.SequenceMatcher(None, pred_str, exp_str).ratio()
            return similarity  # Returns float, not boolean!

def _is_date_field(value: str) -> bool:
    """Check if a field appears to be a date"""
    date_indicators = ['/', '-', '20', '19', 'jan', 'feb', 'mar', 'apr', 'may', 'jun',
                      'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
    value_lower = value.lower()
    return any(indicator in value_lower for indicator in date_indicators) and len(value) >= 6

def compare_accuracy_methods():
    """Compare the two accuracy calculation methods"""
    
    # Test cases that show the differences
    test_cases = [
        {
            "field": "invoice_date",
            "expected": "26-07-2024",
            "predicted": "26-07-2024",
            "description": "Exact date match"
        },
        {
            "field": "invoice_date", 
            "expected": "26-07-2024",
            "predicted": "26/07/2024",
            "description": "Date format difference"
        },
        {
            "field": "invoice_no",
            "expected": "240727",
            "predicted": "26 JULY 2024",
            "description": "Invoice number vs date mismatch"
        },
        {
            "field": "amount",
            "expected": "540280",
            "predicted": "542184",
            "description": "Similar but different amounts"
        }
    ]
    
    print("=" * 80)
    print("ACCURACY METHOD COMPARISON")
    print("=" * 80)
    
    for i, test in enumerate(test_cases, 1):
        print(f"\nTest Case {i}: {test['description']}")
        print(f"Field: {test['field']}")
        print(f"Expected: '{test['expected']}'")
        print(f"Predicted: '{test['predicted']}'")
        print("-" * 40)
        
        # Evaluation service method
        eval_match = evaluation_service_fields_match(test['expected'], test['predicted'])
        print(f"Evaluation Service Match: {eval_match}")
        
        # Improved analyzer method
        improved_match = improved_analyzer_fields_match(test['expected'], test['predicted'])
        print(f"Improved Analyzer Similarity: {improved_match:.4f}")
        print(f"Improved Analyzer Match (>0.8): {improved_match > 0.8}")
        
        # Date normalization comparison for date fields
        if test['field'] == 'invoice_date':
            eval_norm_exp = evaluation_service_normalize_date(test['expected'])
            eval_norm_pred = evaluation_service_normalize_date(test['predicted'])
            improved_norm_exp = improved_analyzer_normalize_date(test['expected'])
            improved_norm_pred = improved_analyzer_normalize_date(test['predicted'])
            
            print(f"Eval Service Date Normalization:")
            print(f"  Expected: '{eval_norm_exp}' | Predicted: '{eval_norm_pred}'")
            print(f"Improved Analyzer Date Normalization:")
            print(f"  Expected: '{improved_norm_exp}' | Predicted: '{improved_norm_pred}'")

if __name__ == "__main__":
    compare_accuracy_methods()
    
    print("\n" + "=" * 80)
    print("KEY DIFFERENCES IDENTIFIED:")
    print("=" * 80)
    print("1. DATE NORMALIZATION:")
    print("   - Evaluation Service: Converts to YYYY-MM-DD format")
    print("   - Improved Analyzer: Converts to DD-MM-YYYY format")
    print()
    print("2. FIELD MATCHING:")
    print("   - Evaluation Service: Boolean exact/fuzzy match")
    print("   - Improved Analyzer: Similarity ratio (0.0 to 1.0)")
    print()
    print("3. ACCURACY CALCULATION:")
    print("   - Evaluation Service: Counts exact matches only")
    print("   - Improved Analyzer: Uses similarity scores for partial credit")
    print()
    print("RECOMMENDATION:")
    print("Update evaluation service to use improved analyzer's methods")
    print("for consistent accuracy calculations.")
