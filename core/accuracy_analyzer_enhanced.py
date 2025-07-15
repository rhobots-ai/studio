#!/usr/bin/env python3
"""
Enhanced Accuracy Analyzer with Improvement Suggestions
======================================================

This enhanced version provides detailed analysis and actionable insights
to help improve your model's accuracy.
"""

from accuracy_checker import AccuracyChecker
import json
import re
from collections import Counter, defaultdict
from typing import Dict, List, Tuple

class EnhancedAccuracyAnalyzer(AccuracyChecker):
    """Enhanced analyzer with improvement suggestions."""
    
    def __init__(self, data_file: str = "predict.json"):
        super().__init__(data_file)
        self.improvement_insights = {
            'json_parsing_issues': [],
            'field_extraction_patterns': {},
            'common_mistakes': {},
            'data_quality_issues': [],
            'improvement_suggestions': []
        }
    
    def analyze_json_parsing_failures(self, max_samples: int = 100):
        """Analyze why JSON parsing fails and suggest improvements."""
        print("Analyzing JSON parsing failures...")
        
        parsing_issues = {
            'no_json_found': 0,
            'malformed_json': 0,
            'incomplete_json': 0,
            'wrong_format': 0
        }
        
        sample_failures = []
        
        for i, record in enumerate(self.data[:max_samples]):
            predict_text = record.get('predict', '')
            
            if not predict_text:
                parsing_issues['no_json_found'] += 1
                continue
            
            # Try to find JSON patterns
            json_match = re.search(r'\{.*\}', predict_text, re.DOTALL)
            
            if not json_match:
                parsing_issues['no_json_found'] += 1
                if len(sample_failures) < 5:
                    sample_failures.append({
                        'index': i,
                        'issue': 'no_json_pattern',
                        'text_sample': predict_text[:200]
                    })
            else:
                try:
                    json.loads(json_match.group())
                except json.JSONDecodeError as e:
                    parsing_issues['malformed_json'] += 1
                    if len(sample_failures) < 5:
                        sample_failures.append({
                            'index': i,
                            'issue': 'malformed_json',
                            'error': str(e),
                            'json_sample': json_match.group()[:200]
                        })
        
        self.improvement_insights['json_parsing_issues'] = {
            'statistics': parsing_issues,
            'sample_failures': sample_failures
        }
    
    def analyze_field_extraction_patterns(self):
        """Analyze patterns in successful vs failed extractions."""
        print("Analyzing field extraction patterns...")
        
        field_patterns = {}
        
        for field in self.field_mappings.keys():
            field_patterns[field] = {
                'successful_extractions': [],
                'failed_extractions': [],
                'common_variations': Counter(),
                'value_patterns': Counter()
            }
        
        # Analyze first 1000 records for patterns
        for i, record in enumerate(self.data[:1000]):
            expected_data = record.get('expected_json', {})
            predict_text = record.get('predict', '')
            
            predicted_json = self.extract_json_from_prediction(predict_text)
            
            if predicted_json:
                predicted_data = self.normalize_predicted_data(predicted_json)
                
                for field in self.field_mappings.keys():
                    expected_val = expected_data.get(field, "")
                    predicted_val = predicted_data.get(field, "")
                    
                    if expected_val == predicted_val and predicted_val:
                        field_patterns[field]['successful_extractions'].append({
                            'expected': expected_val,
                            'predicted': predicted_val,
                            'record_index': i
                        })
                    elif expected_val and not predicted_val:
                        field_patterns[field]['failed_extractions'].append({
                            'expected': expected_val,
                            'record_index': i,
                            'full_prediction': predict_text[:300]
                        })
                    
                    # Track field name variations used in predictions
                    for key in predicted_json.keys():
                        if self.normalize_field_name(key) == field:
                            field_patterns[field]['common_variations'][key] += 1
                    
                    # Track value patterns
                    if predicted_val:
                        if field == 'invoice_date':
                            # Extract date format pattern
                            date_pattern = re.sub(r'\d', 'X', predicted_val)
                            field_patterns[field]['value_patterns'][date_pattern] += 1
                        elif field == 'amount':
                            # Extract amount format pattern
                            amount_pattern = re.sub(r'\d', 'X', predicted_val)
                            field_patterns[field]['value_patterns'][amount_pattern] += 1
        
        self.improvement_insights['field_extraction_patterns'] = field_patterns
    
    def analyze_common_mistakes(self):
        """Identify common mistake patterns."""
        print("Analyzing common mistake patterns...")
        
        mistake_patterns = {
            'gstin_swapped': 0,
            'date_format_wrong': 0,
            'amount_format_wrong': 0,
            'partial_extraction': 0,
            'field_name_mismatch': 0
        }
        
        sample_mistakes = []
        
        for i, record in enumerate(self.data[:1000]):
            expected_data = record.get('expected_json', {})
            predict_text = record.get('predict', '')
            
            predicted_json = self.extract_json_from_prediction(predict_text)
            
            if predicted_json:
                predicted_data = self.normalize_predicted_data(predicted_json)
                
                # Check for GSTIN swapping
                expected_buyer = expected_data.get('buyer_gstin', '')
                expected_seller = expected_data.get('seller_gstin', '')
                predicted_buyer = predicted_data.get('buyer_gstin', '')
                predicted_seller = predicted_data.get('seller_gstin', '')
                
                if (expected_buyer == predicted_seller and 
                    expected_seller == predicted_buyer and 
                    expected_buyer and expected_seller):
                    mistake_patterns['gstin_swapped'] += 1
                    if len(sample_mistakes) < 3:
                        sample_mistakes.append({
                            'type': 'gstin_swapped',
                            'record_index': i,
                            'details': f"Expected buyer: {expected_buyer}, got: {predicted_buyer}"
                        })
                
                # Check date format issues
                expected_date = expected_data.get('invoice_date', '')
                predicted_date = predicted_data.get('invoice_date', '')
                if expected_date and predicted_date and expected_date != predicted_date:
                    # Check if it's just a format issue
                    if self.normalize_date(predicted_date) == expected_date:
                        mistake_patterns['date_format_wrong'] += 1
                
                # Check amount format issues
                expected_amount = expected_data.get('amount', '')
                predicted_amount = predicted_data.get('amount', '')
                if expected_amount and predicted_amount and expected_amount != predicted_amount:
                    if self.normalize_amount(predicted_amount) == expected_amount:
                        mistake_patterns['amount_format_wrong'] += 1
        
        self.improvement_insights['common_mistakes'] = {
            'patterns': mistake_patterns,
            'samples': sample_mistakes
        }
    
    def generate_improvement_suggestions(self):
        """Generate actionable improvement suggestions."""
        suggestions = []
        
        # JSON parsing improvements
        json_issues = self.improvement_insights.get('json_parsing_issues', {})
        if json_issues:
            stats = json_issues.get('statistics', {})
            if stats.get('no_json_found', 0) > stats.get('malformed_json', 0):
                suggestions.append({
                    'category': 'Output Format',
                    'priority': 'HIGH',
                    'issue': f"{stats.get('no_json_found', 0)} predictions contain no JSON',
                    'suggestion': 'Improve model prompting to always output JSON format. Add explicit JSON formatting instructions.',
                    'implementation': 'Update your prompt template to include: "Always respond with valid JSON in the format: {field1: value1, field2: value2}"'
                })
        
        # Field extraction improvements
        field_patterns = self.improvement_insights.get('field_extraction_patterns', {})
        for field, patterns in field_patterns.items():
            failed_count = len(patterns.get('failed_extractions', []))
            if failed_count > 10:  # Significant failure rate
                suggestions.append({
                    'category': 'Field Extraction',
                    'priority': 'MEDIUM',
                    'issue': f"{field} has {failed_count} extraction failures",
                    'suggestion': f'Add more training examples for {field} extraction. Review field naming consistency.',
                    'implementation': f'Ensure training data uses consistent field names for {field}'
                })
        
        # Common mistake fixes
        mistakes = self.improvement_insights.get('common_mistakes', {})
        if mistakes:
            patterns = mistakes.get('patterns', {})
            if patterns.get('gstin_swapped', 0) > 5:
                suggestions.append({
                    'category': 'Logic Error',
                    'priority': 'HIGH',
                    'issue': f"{patterns['gstin_swapped']} cases of buyer/seller GSTIN swapping",
                    'suggestion': 'Add explicit instructions to distinguish buyer vs seller GSTIN in prompts',
                    'implementation': 'Update prompt: "buyer_gstin is the GSTIN of the customer/buyer, seller_gstin is the GSTIN of the vendor/seller"'
                })
        
        # Coverage improvements
        if hasattr(self, 'results') and self.results.get('field_accuracies'):
            for field, stats in self.results['field_accuracies'].items():
                coverage = stats.get('prediction_coverage', 0)
                if coverage < 0.5:  # Less than 50% coverage
                    suggestions.append({
                        'category': 'Coverage',
                        'priority': 'HIGH',
                        'issue': f"{field} only has {coverage*100:.1f}% prediction coverage",
                        'suggestion': f'Model fails to extract {field} from many invoices. Add more diverse training examples.',
                        'implementation': f'Collect more training data with varied {field} formats and positions'
                    })
        
        self.improvement_insights['improvement_suggestions'] = suggestions
        return suggestions
    
    def run_enhanced_analysis(self, max_records: int = 1000):
        """Run comprehensive analysis with improvement insights."""
        print("Running enhanced accuracy analysis...")
        
        # Run basic accuracy analysis
        if not self.load_data():
            return "Failed to load data."
        
        self.process_records(max_records)
        
        # Run enhanced analyses
        self.analyze_json_parsing_failures(max_records)
        self.analyze_field_extraction_patterns()
        self.analyze_common_mistakes()
        suggestions = self.generate_improvement_suggestions()
        
        return self.generate_enhanced_report()
    
    def generate_enhanced_report(self):
        """Generate enhanced report with improvement suggestions."""
        report = []
        report.append("=" * 70)
        report.append("ENHANCED ACCURACY ANALYSIS WITH IMPROVEMENT SUGGESTIONS")
        report.append("=" * 70)
        
        # Basic accuracy report
        basic_report = self.generate_report()
        report.append(basic_report)
        
        # JSON Parsing Analysis
        json_issues = self.improvement_insights.get('json_parsing_issues', {})
        if json_issues:
            report.append("\n" + "=" * 50)
            report.append("JSON PARSING FAILURE ANALYSIS")
            report.append("=" * 50)
            
            stats = json_issues.get('statistics', {})
            for issue_type, count in stats.items():
                report.append(f"{issue_type.replace('_', ' ').title()}: {count}")
        
        # Common Mistakes
        mistakes = self.improvement_insights.get('common_mistakes', {})
        if mistakes:
            report.append("\n" + "=" * 50)
            report.append("COMMON MISTAKE PATTERNS")
            report.append("=" * 50)
            
            patterns = mistakes.get('patterns', {})
            for mistake_type, count in patterns.items():
                if count > 0:
                    report.append(f"{mistake_type.replace('_', ' ').title()}: {count} cases")
        
        # Improvement Suggestions
        suggestions = self.improvement_insights.get('improvement_suggestions', [])
        if suggestions:
            report.append("\n" + "=" * 50)
            report.append("🚀 IMPROVEMENT SUGGESTIONS (PRIORITIZED)")
            report.append("=" * 50)
            
            # Sort by priority
            priority_order = {'HIGH': 1, 'MEDIUM': 2, 'LOW': 3}
            suggestions.sort(key=lambda x: priority_order.get(x['priority'], 3))
            
            for i, suggestion in enumerate(suggestions, 1):
                report.append(f"\n{i}. [{suggestion['priority']}] {suggestion['category']}")
                report.append(f"   Issue: {suggestion['issue']}")
                report.append(f"   Solution: {suggestion['suggestion']}")
                report.append(f"   Implementation: {suggestion['implementation']}")
        
        return "\n".join(report)

def main():
    """Main function for enhanced analysis."""
    print("Enhanced Accuracy Analyzer")
    print("=" * 50)
    
    analyzer = EnhancedAccuracyAnalyzer("predict.json")
    
    # Ask for analysis scope
    print("\nSelect analysis scope:")
    print("1. Quick analysis (500 records)")
    print("2. Medium analysis (2000 records)")
    print("3. Comprehensive analysis (5000 records)")
    
    choice = input("Enter choice (1-3): ").strip()
    
    max_records = 500
    if choice == "2":
        max_records = 2000
    elif choice == "3":
        max_records = 5000
    
    # Run analysis
    report = analyzer.run_enhanced_analysis(max_records)
    print("\n" + report)
    
    # Save enhanced results
    with open("enhanced_accuracy_analysis.json", 'w') as f:
        json.dump(analyzer.improvement_insights, f, indent=2, default=str)
    
    print(f"\nDetailed insights saved to enhanced_accuracy_analysis.json")

if __name__ == "__main__":
    main()
