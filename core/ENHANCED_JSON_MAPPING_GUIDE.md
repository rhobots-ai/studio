# Enhanced JSON Structure Support Guide

This guide explains how to use the enhanced data preparation features that support complex JSON structures for both input and output in training data.

## Overview

The enhanced system now supports:
- **Field Mapping**: Map source column names to different target field names in JSON output
- **JSON Parsing**: Automatically parse JSON strings in columns to create nested JSON objects
- **Complex Input/Output**: Support for both simple strings and complex JSON objects
- **Flexible Structure**: Handle the structure you described with nested input and output objects

## Supported Data Structure

The system now fully supports your desired training data structure:

```json
{
  "instruction": "You're an invoice assistant",
  "input": {
    "raw_text": "something",
    "invoice_nu": "abc"
  },
  "output": {
    "invoice_number": "123",
    "invoice_amount": "5432",
    "invoice_date": "dd"
  }
}
```

## Key Features

### 1. Field Mapping

You can now map source column names to different target field names:

- **Source Column**: `invoice_nu` 
- **Target Field**: `invoice_number`

This allows you to rename fields during the mapping process, so your source data column `invoice_nu` becomes `invoice_number` in the final JSON output.

### 2. JSON Parsing

If your source data contains JSON strings, you can enable JSON parsing:

- **Raw JSON String**: `"{\"name\": \"John\", \"email\": \"john@example.com\"}"`
- **Parsed JSON Object**: `{"name": "John", "email": "john@example.com"}`

### 3. Flexible Input/Output Types

The system automatically determines the output format based on your column mapping:

- **Single Column**: Results in a string value
- **Multiple Columns**: Results in a JSON object with field mapping

## How to Use

### Step 1: Upload Your Data

Upload a CSV, JSON, or JSONL file containing your source data. For example:

```csv
instruction,raw_text,invoice_nu,document_type,language,source,invoice_number,invoice_amount,invoice_date
"You're an invoice assistant","Invoice #INV-001...","INV-001","PDF","EN","email","INV-001","1500.00","2024-01-15"
```

### Step 2: Configure Column Mapping

1. **Static Instruction**: Set a static instruction that applies to all examples
2. **Instruction Columns**: Map columns that form the instruction text
3. **Input Columns**: Map columns that form the input context
4. **Output Columns**: Map columns that form the expected output

### Step 3: Configure Field Mapping

For each input/output column, you can:

1. **Set Target Field Name**: Change the field name in the final JSON
   - Source: `invoice_nu` → Target: `invoice_number`
   
2. **Enable JSON Parsing**: If the column contains JSON strings
   - Check "Parse as JSON" to convert strings to JSON objects

### Step 4: Preview and Validate

The system provides a live preview showing exactly how your data will be transformed:

```json
{
  "instruction": "You're an invoice assistant",
  "input": {
    "raw_text": "Invoice #INV-001 dated 2024-01-15...",
    "invoice_number": "INV-001"  // Mapped from invoice_nu
  },
  "output": {
    "invoice_number": "INV-001",
    "invoice_amount": "1500.00",
    "invoice_date": "2024-01-15"
  }
}
```

## Example Configurations

### Example 1: Invoice Processing

**Source Data Columns:**
- `instruction`: "You're an invoice assistant"
- `raw_text`: "Invoice #INV-001..."
- `invoice_nu`: "INV-001"
- `invoice_number`: "INV-001"
- `invoice_amount`: "1500.00"
- `invoice_date`: "2024-01-15"

**Column Mapping:**
- **Static Instruction**: "You're an invoice assistant"
- **Input Columns**: 
  - `raw_text` → `raw_text`
  - `invoice_nu` → `invoice_number` (field mapping)
- **Output Columns**:
  - `invoice_number` → `invoice_number`
  - `invoice_amount` → `invoice_amount`
  - `invoice_date` → `invoice_date`

### Example 2: Customer Data with JSON Parsing

**Source Data:**
```csv
instruction,customer_data,metadata,customer_name,customer_email
"Extract customer info","{\"name\":\"John\",\"email\":\"john@example.com\"}","priority","John","john@example.com"
```

**Column Mapping:**
- **Input Columns**:
  - `customer_data` → `customer_info` (with JSON parsing enabled)
  - `metadata` → `priority_level`
- **Output Columns**:
  - `customer_name` → `name`
  - `customer_email` → `email`

**Result:**
```json
{
  "instruction": "Extract customer info",
  "input": {
    "customer_info": {"name": "John", "email": "john@example.com"},
    "priority_level": "priority"
  },
  "output": {
    "name": "John",
    "email": "john@example.com"
  }
}
```

## Advanced Features

### Template System

You can use advanced templates for custom formatting:

**Instruction Template:**
```
{static_instruction}

Process the following data: {raw_text}
```

**Output Template:**
```
{
  "invoice_number": "{invoice_number}",
  "amount": "{invoice_amount}",
  "date": "{invoice_date}"
}
```

### Validation

The system validates your mapping configuration and provides:
- **Error Detection**: Missing columns, invalid mappings
- **Warnings**: Potential issues like duplicate column usage
- **Success Rate**: Percentage of rows that will be successfully processed

## Backend Implementation

### Enhanced Models

The `ColumnConfig` model now includes:
```python
class ColumnConfig(BaseModel):
    column_name: str
    target_field: Optional[str] = None  # Field mapping
    parse_json: bool = False           # JSON parsing
    # ... other fields
```

### Processing Logic

The column mapping service handles:
1. **Field Mapping**: Uses `get_target_field()` method
2. **JSON Parsing**: Attempts to parse JSON strings when enabled
3. **Fallback Handling**: Falls back to string if JSON parsing fails
4. **Type Conversion**: Proper handling of numpy types for JSON serialization

## Best Practices

1. **Field Naming**: Use clear, consistent field names in your target mapping
2. **JSON Validation**: Test JSON parsing with sample data first
3. **Preview Testing**: Always review the preview before creating the dataset
4. **Error Handling**: Check validation results and fix any issues
5. **Documentation**: Document your field mappings for team reference

## Troubleshooting

### Common Issues

1. **JSON Parsing Fails**: 
   - Check if the source data contains valid JSON
   - Disable JSON parsing if the data is meant to be a string

2. **Field Mapping Not Working**:
   - Ensure target field names are valid
   - Check for typos in field names

3. **Empty Output**:
   - Verify that output columns are mapped correctly
   - Check that source data contains the expected columns

### Error Messages

- `"Mapped columns not found in file"`: Source columns don't exist
- `"At least one output column must be specified"`: No output mapping defined
- `"No valid training examples generated"`: All rows failed processing

## Migration from Simple Structure

If you're migrating from the simple structure:

**Old Format:**
```json
{
  "instruction": "Extract invoice details",
  "input": "Invoice text here",
  "output": "JSON string here"
}
```

**New Format:**
```json
{
  "instruction": "Extract invoice details", 
  "input": {
    "raw_text": "Invoice text here",
    "document_type": "PDF"
  },
  "output": {
    "invoice_number": "INV-001",
    "amount": "1500.00"
  }
}
```

The system maintains backward compatibility while supporting the enhanced structure.
