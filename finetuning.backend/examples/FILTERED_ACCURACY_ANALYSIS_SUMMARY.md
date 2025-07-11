# Filtered Evaluation Results Accuracy Analysis Summary

## File Analyzed
- **File**: `evaluation_results_966_e_qwen-2.5-1.5I-15Inv_2025-07-05 (5).json`
- **Size**: 77.22 MB
- **Analysis Type**: Filtered (Only non-empty predictions)

## Filtering Results

### 📊 Data Filtering Statistics
- **Original Total Samples**: 7,399
- **Empty Predictions**: 4,639 (62.70%)
- **Filtered Samples (Non-empty)**: 2,760 (37.30%)
- **Filter Rate**: 37.30% of samples had valid predictions

## Performance Metrics (Filtered Data)

### 📊 Overall Performance
- **Parsing Success Rate**: 63.37% (1,749 successful / 1,011 failed)
- **Perfect Matches**: 78 (2.83%)
- **Overall Accuracy**: 56.35%

### 📋 Field-Level Accuracy Results

| Field Name | Accuracy | Percentage | Performance Level |
|------------|----------|------------|-------------------|
| **tax** | 1.0000 | **100.00%** | ⭐ Excellent |
| **invoice_date** | 0.8247 | **82.47%** | ⭐ Very Good |
| **amount** | 0.8100 | **81.00%** | ⭐ Very Good |
| **invoice_no** | 0.5909 | **59.09%** | ⚠️ Moderate |
| **buyer_gstin** | 0.0891 | **8.91%** | ❌ Poor |
| **seller_gstin** | 0.0661 | **6.61%** | ❌ Poor |

## Key Findings

### ✅ Significant Improvements (vs. Unfiltered Analysis)
1. **Overall Accuracy**: Improved from 35.55% to **56.35%** (+20.8 percentage points)
2. **Perfect Matches**: Increased from 0% to **2.83%** (78 perfect matches)
3. **Tax Field**: Perfect 100% accuracy when predictions are present
4. **Core Fields Performance**: All core fields (date, amount, number) show good performance

### 🎯 Strong Performance Areas
1. **Tax Extraction**: 100% accuracy - Perfect performance when tax data is present
2. **Invoice Date**: 82.47% accuracy - Consistent date extraction and formatting
3. **Amount Extraction**: 81.00% accuracy - Reliable monetary value extraction
4. **Invoice Number**: 59.09% accuracy - Moderate but acceptable performance

### ⚠️ Areas Requiring Attention
1. **GSTIN Fields**: Still very low accuracy (8.91% and 6.61%)
2. **Field Coverage**: Model inconsistently predicts all required fields
3. **Parsing Issues**: 36.63% parsing failure rate indicates format inconsistencies

### 🔍 Data Quality Insights
1. **Empty Predictions**: 62.70% of samples had empty predictions, indicating:
   - Model failure to generate responses
   - Input processing issues
   - Training data quality problems
2. **Partial Predictions**: Many samples only predict 1-3 fields instead of all 5 required fields

## Comparison: Filtered vs. Unfiltered Analysis

| Metric | Unfiltered | Filtered | Improvement |
|--------|------------|----------|-------------|
| Overall Accuracy | 35.55% | 56.35% | +20.8% |
| Perfect Matches | 0.00% | 2.83% | +2.83% |
| Invoice Date | 84.96% | 82.47% | -2.49% |
| Amount | 78.15% | 81.00% | +2.85% |
| Invoice No | 71.28% | 59.09% | -12.19% |
| Tax | 50.00% | 100.00% | +50.00% |

## Recommendations

### 🎯 Immediate Actions
1. **Address Empty Predictions**: Investigate why 62.70% of samples produce no output
2. **Improve Field Coverage**: Train model to consistently predict all required fields
3. **GSTIN Enhancement**: Focus training on tax identification number extraction

### 📈 Model Improvement Strategies
1. **Training Data Quality**: 
   - Remove samples that consistently produce empty predictions
   - Ensure balanced representation of all fields
   - Add more GSTIN examples to training data

2. **Model Architecture**:
   - Implement field-specific validation
   - Add structured output constraints
   - Improve JSON formatting consistency

3. **Evaluation Process**:
   - Separate analysis for different field types
   - Implement progressive evaluation (basic fields first, then advanced)
   - Add confidence scoring for predictions

### 🔧 Technical Enhancements
1. **Robust Output Generation**: Ensure model always produces some output
2. **Field Validation**: Implement field-specific validation rules
3. **Error Recovery**: Add fallback mechanisms for failed predictions

## Performance Summary

The filtered analysis reveals **significantly better performance** when focusing only on samples with non-empty predictions:

### Key Achievements:
- **56.35% overall accuracy** (vs. 35.55% unfiltered)
- **Perfect tax field extraction** (100% accuracy)
- **Strong core field performance** (80%+ for date and amount)
- **78 perfect matches** achieved

### Critical Issues:
- **62.70% empty prediction rate** - Major model reliability issue
- **GSTIN extraction failure** - Specialized field training needed
- **Inconsistent field coverage** - Model doesn't always predict all fields

### Priority Actions:
1. **Fix Empty Predictions** (Critical)
2. **Improve GSTIN Extraction** (High)
3. **Ensure Complete Field Coverage** (High)
4. **Maintain Core Field Performance** (Medium)

---
*Analysis generated on: 2025-07-05*
*Filtered samples analyzed: 2,760 (out of 7,399 total)*
*Analysis tool: filtered_accuracy_analyzer.py*
