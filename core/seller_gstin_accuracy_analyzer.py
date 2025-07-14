import json
import os
from typing import Dict, Any, List, Tuple
import difflib
from collections import defaultdict
import re

def parse_json_string(json_str: str) -> Dict[str, Any]:
    """Safely parse a JSON string, handling various formats."""
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

def calculate_field_accuracy(predicted: Dict[str, Any], expected: Dict[str, Any]) -> Dict[str, float]:
    """Calculate field-level accuracy between predicted and expected JSON."""
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
                # Use similarity ratio for partial matches
                similarity = difflib.SequenceMatcher(None, pred_str, exp_str).ratio()
                field_accuracies[field] = similarity
    
    return field_accuracies

def categorize_gstin(gstin: str) -> str:
    """Categorize GSTIN based on entity type."""
    if not gstin or len(gstin) != 15:
        return "Invalid"
    
    # GSTIN format: SSPPPPPPPPPTXZ
    # Position 12 (T) indicates entity type
    entity_type_code = gstin[12] if len(gstin) > 12 else ""
    
    entity_types = {
        '1': 'Company',
        '2': 'Partnership',
        '3': 'LLP',
        '4': 'Individual',
        '5': 'HUF',
        '6': 'AOP',
        '7': 'BOI',
        '8': 'Local Authority',
        '9': 'Others',
        'A': 'Government',
        'B': 'UN Body',
        'C': 'Embassy'
    }
    
    return entity_types.get(entity_type_code, f"Unknown ({entity_type_code})")

def analyze_seller_gstin_accuracy(file_path: str) -> Dict[str, Any]:
    """Analyze evaluation results grouped by seller GSTIN."""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except Exception as e:
        return {"error": f"Could not load file: {e}"}
    
    if isinstance(data, list):
        samples = data
    else:
        return {"error": "Expected data to be a list of samples"}
    
    # Filter out samples with empty predictions
    filtered_samples = []
    empty_predictions = 0
    
    for sample in samples:
        predict_value = sample.get("predict", "")
        if predict_value and predict_value.strip():
            filtered_samples.append(sample)
        else:
            empty_predictions += 1
    
    # Group samples by seller GSTIN
    seller_groups = defaultdict(list)
    parsing_errors = 0
    
    for sample in filtered_samples:
        # Parse expected JSON to get seller GSTIN
        expected_raw = sample.get("expected", "")
        expected_json = parse_json_string(expected_raw)
        
        # Handle nested structure
        if "invoice_date" in expected_json and isinstance(expected_json["invoice_date"], str):
            inner_expected = parse_json_string(expected_json["invoice_date"])
            if inner_expected and "raw_data" not in inner_expected:
                expected_json = inner_expected
        
        seller_gstin = expected_json.get("seller_gstin", "Unknown")
        
        # Parse predicted JSON
        predicted_json = parse_json_string(sample.get("predict", ""))
        
        if isinstance(predicted_json, dict) and "raw_data" not in predicted_json:
            seller_groups[seller_gstin].append({
                "predicted": predicted_json,
                "expected": expected_json,
                "sample": sample
            })
        else:
            parsing_errors += 1
    
    # Analyze each seller group
    seller_analysis = {}
    overall_stats = {
        "total_sellers": len(seller_groups),
        "total_samples": len(filtered_samples),
        "empty_predictions": empty_predictions,
        "parsing_errors": parsing_errors,
        "seller_categories": defaultdict(int),
        "field_accuracies_by_category": defaultdict(lambda: defaultdict(list))
    }
    
    for seller_gstin, seller_samples in seller_groups.items():
        seller_category = categorize_gstin(seller_gstin)
        overall_stats["seller_categories"][seller_category] += 1
        
        # Calculate field accuracies for this seller
        field_accuracy_sums = defaultdict(float)
        field_counts = defaultdict(int)
        perfect_matches = 0
        
        sample_details = []
        
        for i, sample_data in enumerate(seller_samples):
            predicted = sample_data["predicted"]
            expected = sample_data["expected"]
            
            # Calculate field accuracies for this sample
            field_accs = calculate_field_accuracy(predicted, expected)
            
            # Check for perfect match
            if all(acc == 1.0 for acc in field_accs.values()) and len(field_accs) > 0:
                perfect_matches += 1
            
            # Accumulate field accuracies
            for field, acc in field_accs.items():
                field_accuracy_sums[field] += acc
                field_counts[field] += 1
                overall_stats["field_accuracies_by_category"][seller_category][field].append(acc)
            
            # Store sample details (first 3 samples per seller)
            if i < 3:
                sample_details.append({
                    "predicted": predicted,
                    "expected": expected,
                    "field_accuracies": field_accs
                })
        
        # Calculate average field accuracies for this seller
        seller_field_accuracies = {}
        for field in field_accuracy_sums:
            if field_counts[field] > 0:
                seller_field_accuracies[field] = field_accuracy_sums[field] / field_counts[field]
        
        # Calculate overall accuracy for this seller
        overall_accuracy = sum(seller_field_accuracies.values()) / len(seller_field_accuracies) if seller_field_accuracies else 0
        
        seller_analysis[seller_gstin] = {
            "seller_category": seller_category,
            "sample_count": len(seller_samples),
            "field_accuracies": seller_field_accuracies,
            "overall_accuracy": overall_accuracy,
            "perfect_matches": perfect_matches,
            "perfect_match_rate": perfect_matches / len(seller_samples) if seller_samples else 0,
            "sample_details": sample_details
        }
    
    # Calculate category-wise statistics
    category_stats = {}
    for category, field_data in overall_stats["field_accuracies_by_category"].items():
        category_field_accuracies = {}
        for field, accuracies in field_data.items():
            if accuracies:
                category_field_accuracies[field] = sum(accuracies) / len(accuracies)
        
        category_overall_accuracy = sum(category_field_accuracies.values()) / len(category_field_accuracies) if category_field_accuracies else 0
        
        category_stats[category] = {
            "seller_count": overall_stats["seller_categories"][category],
            "field_accuracies": category_field_accuracies,
            "overall_accuracy": category_overall_accuracy
        }
    
    return {
        "overall_stats": dict(overall_stats),
        "seller_analysis": seller_analysis,
        "category_stats": category_stats
    }

def print_seller_gstin_report(results: Dict[str, Any]):
    """Print a comprehensive seller GSTIN analysis report."""
    if "error" in results:
        print(f"Error: {results['error']}")
        return
    
    overall_stats = results["overall_stats"]
    seller_analysis = results["seller_analysis"]
    category_stats = results["category_stats"]
    
    print("=" * 100)
    print("SELLER GSTIN LEVEL ACCURACY ANALYSIS")
    print("=" * 100)
    
    print(f"\n📊 OVERALL STATISTICS:")
    print(f"   Total Unique Sellers: {overall_stats['total_sellers']:,}")
    print(f"   Total Samples Analyzed: {overall_stats['total_samples']:,}")
    print(f"   Empty Predictions: {overall_stats['empty_predictions']:,}")
    print(f"   Parsing Errors: {overall_stats['parsing_errors']:,}")
    
    print(f"\n🏢 SELLER CATEGORIES:")
    for category, count in overall_stats['seller_categories'].items():
        percentage = (count / overall_stats['total_sellers'] * 100) if overall_stats['total_sellers'] > 0 else 0
        print(f"   {category:15}: {count:4} sellers ({percentage:5.1f}%)")
    
    print(f"\n📈 CATEGORY-WISE PERFORMANCE:")
    print("-" * 80)
    for category, stats in sorted(category_stats.items(), key=lambda x: x[1]['overall_accuracy'], reverse=True):
        print(f"\n🔹 {category} ({stats['seller_count']} sellers)")
        print(f"   Overall Accuracy: {stats['overall_accuracy']:.4f} ({stats['overall_accuracy']:.2%})")
        print(f"   Field Accuracies:")
        for field, accuracy in sorted(stats['field_accuracies'].items(), key=lambda x: x[1], reverse=True):
            print(f"     {field:15}: {accuracy:.4f} ({accuracy:.2%})")
    
    print(f"\n🎯 TOP PERFORMING INDIVIDUAL SELLERS:")
    print("-" * 80)
    top_sellers = sorted(seller_analysis.items(), key=lambda x: x[1]['overall_accuracy'], reverse=True)[:10]
    
    for i, (seller_gstin, stats) in enumerate(top_sellers, 1):
        print(f"\n{i:2}. {seller_gstin} ({stats['seller_category']})")
        print(f"    Samples: {stats['sample_count']:3} | Overall: {stats['overall_accuracy']:.4f} ({stats['overall_accuracy']:.2%}) | Perfect: {stats['perfect_match_rate']:.2%}")
        print(f"    Field Accuracies: ", end="")
        field_str = " | ".join([f"{field}: {acc:.2%}" for field, acc in sorted(stats['field_accuracies'].items(), key=lambda x: x[1], reverse=True)])
        print(field_str)
    
    print(f"\n⚠️  WORST PERFORMING INDIVIDUAL SELLERS:")
    print("-" * 80)
    worst_sellers = sorted(seller_analysis.items(), key=lambda x: x[1]['overall_accuracy'])[:10]
    
    for i, (seller_gstin, stats) in enumerate(worst_sellers, 1):
        print(f"\n{i:2}. {seller_gstin} ({stats['seller_category']})")
        print(f"    Samples: {stats['sample_count']:3} | Overall: {stats['overall_accuracy']:.4f} ({stats['overall_accuracy']:.2%}) | Perfect: {stats['perfect_match_rate']:.2%}")
        print(f"    Field Accuracies: ", end="")
        field_str = " | ".join([f"{field}: {acc:.2%}" for field, acc in sorted(stats['field_accuracies'].items(), key=lambda x: x[1], reverse=True)])
        print(field_str)
    
    print(f"\n🔍 INDIVIDUAL SELLER INSIGHTS:")
    print("-" * 80)
    individual_sellers = {k: v for k, v in seller_analysis.items() if v['seller_category'] == 'Individual'}
    
    if individual_sellers:
        print(f"Individual Sellers Found: {len(individual_sellers)}")
        individual_performance = sorted(individual_sellers.items(), key=lambda x: x[1]['overall_accuracy'], reverse=True)
        
        print(f"\nTop 5 Individual Sellers:")
        for i, (seller_gstin, stats) in enumerate(individual_performance[:5], 1):
            print(f"{i}. {seller_gstin}: {stats['overall_accuracy']:.2%} overall ({stats['sample_count']} samples)")
            for field, acc in sorted(stats['field_accuracies'].items(), key=lambda x: x[1], reverse=True):
                print(f"   {field}: {acc:.2%}")
    else:
        print("No Individual sellers found in the dataset.")

def save_detailed_seller_analysis(results: Dict[str, Any], output_file: str):
    """Save detailed seller analysis to JSON file."""
    # Convert defaultdict to regular dict for JSON serialization
    serializable_results = json.loads(json.dumps(results, default=str))
    
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(serializable_results, f, indent=2, ensure_ascii=False)

if __name__ == "__main__":
    file_path = "evaluation_results_966_e_qwen-2.5-1.5I-15Inv_2025-07-05 (5).json"
    
    if not os.path.exists(file_path):
        print(f"File not found: {file_path}")
        exit(1)
    
    print(f"Analyzing file: {file_path}")
    print(f"File size: {os.path.getsize(file_path) / (1024*1024):.2f} MB")
    print("Processing seller GSTIN level analysis...")
    
    results = analyze_seller_gstin_accuracy(file_path)
    print_seller_gstin_report(results)
    
    # Save detailed results
    output_file = "seller_gstin_accuracy_analysis.json"
    save_detailed_seller_analysis(results, output_file)
    
    print(f"\n💾 Detailed seller analysis saved to: {output_file}")
    
    # Generate summary report
    summary_file = "SELLER_GSTIN_ANALYSIS_SUMMARY.md"
    with open(summary_file, 'w', encoding='utf-8') as f:
        f.write("# Seller GSTIN Level Accuracy Analysis Summary\n\n")
        f.write(f"## Analysis Overview\n")
        f.write(f"- **File Analyzed**: {file_path}\n")
        f.write(f"- **Total Unique Sellers**: {results['overall_stats']['total_sellers']:,}\n")
        f.write(f"- **Total Samples**: {results['overall_stats']['total_samples']:,}\n\n")
        
        f.write("## Seller Categories\n")
        for category, count in results['overall_stats']['seller_categories'].items():
            percentage = (count / results['overall_stats']['total_sellers'] * 100) if results['overall_stats']['total_sellers'] > 0 else 0
            f.write(f"- **{category}**: {count} sellers ({percentage:.1f}%)\n")
        
        f.write("\n## Category Performance\n")
        for category, stats in sorted(results['category_stats'].items(), key=lambda x: x[1]['overall_accuracy'], reverse=True):
            f.write(f"\n### {category}\n")
            f.write(f"- Overall Accuracy: {stats['overall_accuracy']:.2%}\n")
            f.write(f"- Seller Count: {stats['seller_count']}\n")
            f.write("- Field Accuracies:\n")
            for field, accuracy in sorted(stats['field_accuracies'].items(), key=lambda x: x[1], reverse=True):
                f.write(f"  - {field}: {accuracy:.2%}\n")
    
    print(f"📄 Summary report saved to: {summary_file}")
