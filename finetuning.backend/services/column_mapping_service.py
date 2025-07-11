"""
Enhanced column mapping service for manual column mapping and processing.
"""

import pandas as pd
import json
import numpy as np
from typing import Dict, List, Any, Optional, Union
from datetime import datetime
from models.file_models import (
    ColumnConfig, ColumnMapping, ColumnRole, ColumnFormat,
    TrainingExample
)


class ColumnMappingService:
    """Service for manual column mapping and data processing"""
    
    def __init__(self):
        pass
    
    def _convert_numpy_types(self, obj: Any) -> Any:
        """Convert numpy types to Python native types for JSON serialization"""
        import datetime
        
        if isinstance(obj, pd.DataFrame):
            # Convert DataFrame to dict of lists, but handle nested DataFrames
            try:
                return obj.to_dict('list')
            except (ValueError, TypeError):
                # If conversion fails, convert to string representation
                return str(obj)
        elif isinstance(obj, pd.Series):
            # Convert Series to list
            try:
                return obj.tolist()
            except (AttributeError, ValueError, TypeError):
                # If tolist() fails, iterate through values
                return [self._convert_numpy_types(val) for val in obj]
        elif isinstance(obj, (datetime.date, datetime.datetime)):
            # Convert date/datetime objects to ISO format strings
            return obj.isoformat()
        elif isinstance(obj, pd.Timestamp):
            # Convert pandas Timestamp to ISO format string
            return obj.isoformat()
        elif isinstance(obj, np.datetime64):
            # Convert numpy datetime64 to ISO format string
            return pd.Timestamp(obj).isoformat()
        elif isinstance(obj, datetime.time):
            # Convert time objects to string
            return obj.isoformat()
        elif isinstance(obj, np.integer):
            return int(obj)
        elif isinstance(obj, np.floating):
            return float(obj)
        elif isinstance(obj, np.bool_):
            return bool(obj)
        elif isinstance(obj, np.ndarray):
            return obj.tolist()
        elif isinstance(obj, (list, tuple)):
            return [self._convert_numpy_types(item) for item in obj]
        elif isinstance(obj, dict):
            return {key: self._convert_numpy_types(value) for key, value in obj.items()}
        elif pd.isna(obj):
            return None
        else:
            return obj
    
    def get_column_info(self, data: pd.DataFrame) -> Dict[str, Any]:
        """
        Get basic information about columns in the DataFrame
        
        Args:
            data: DataFrame to analyze
            
        Returns:
            Dictionary with column information
        """
        column_info = {}
        
        for col in data.columns:
            # Get sample values (non-null)
            try:
                sample_values = data[col].dropna().head(5).tolist()
            except AttributeError:
                # Handle case where column contains DataFrames or other complex objects
                sample_series = data[col].dropna().head(5)
                sample_values = [self._convert_numpy_types(val) for val in sample_series]
            else:
                sample_values = [self._convert_numpy_types(val) for val in sample_values]
            
            # Handle cases where column might contain DataFrames or other complex objects
            try:
                data_type = str(data[col].dtype)
                null_count = self._convert_numpy_types(data[col].isnull().sum())
                null_percentage = self._convert_numpy_types((data[col].isnull().sum() / len(data)) * 100)
                unique_count = self._convert_numpy_types(data[col].nunique())
            except (AttributeError, TypeError):
                # Handle case where column contains complex objects like DataFrames
                data_type = 'object'
                null_count = 0
                null_percentage = 0.0
                unique_count = len(data)  # Assume each row is unique for complex objects
            
            column_info[col] = {
                'name': col,
                'data_type': data_type,
                'null_count': null_count,
                'null_percentage': null_percentage,
                'unique_count': unique_count,
                'sample_values': sample_values,
                'total_rows': len(data)
            }
            
            # Add text-specific stats for string columns
            try:
                if data[col].dtype == 'object':
                    text_values = data[col].dropna().astype(str)
                    if len(text_values) > 0:
                        column_info[col].update({
                            'avg_length': self._convert_numpy_types(text_values.str.len().mean()),
                            'max_length': self._convert_numpy_types(text_values.str.len().max()),
                            'min_length': self._convert_numpy_types(text_values.str.len().min()),
                        })
            except (AttributeError, TypeError):
                # Skip text stats for complex objects
                pass
        
        return {
            'available_columns': list(data.columns),
            'column_info': column_info,
            'total_rows': len(data),
            'file_stats': {
                'total_columns': len(data.columns),
                'total_rows': len(data),
                'memory_usage': self._convert_numpy_types(data.memory_usage(deep=True).sum())
            }
        }
    
    def validate_mapping(self, data: pd.DataFrame, mapping: ColumnMapping) -> Dict[str, Any]:
        """
        Validate that a column mapping is valid for the given data
        
        Args:
            data: DataFrame to validate against
            mapping: Column mapping to validate
            
        Returns:
            Validation result with any issues found
        """
        issues = []
        warnings = []
        
        # Check that all mapped columns exist
        all_mapped_columns = set()
        
        # Collect all mapped columns
        for col_config in mapping.instruction_columns:
            all_mapped_columns.add(col_config.column_name)
        for col_config in mapping.input_columns:
            all_mapped_columns.add(col_config.column_name)
        for col_config in mapping.output_columns:
            all_mapped_columns.add(col_config.column_name)
        
        # Check for missing columns
        available_columns = set(data.columns)
        missing_columns = all_mapped_columns - available_columns
        if missing_columns:
            issues.append(f"Mapped columns not found in file: {list(missing_columns)}")
        
        # Check that at least output columns are specified
        if not mapping.output_columns:
            issues.append("At least one output column must be specified")
        
        # Check for empty instruction if no instruction columns
        if not mapping.instruction_columns and not mapping.static_instruction:
            warnings.append("No instruction columns or static instruction specified")
        
        # Check for duplicate column usage
        column_usage = {}
        for col_config in mapping.instruction_columns:
            column_usage[col_config.column_name] = column_usage.get(col_config.column_name, 0) + 1
        for col_config in mapping.input_columns:
            column_usage[col_config.column_name] = column_usage.get(col_config.column_name, 0) + 1
        for col_config in mapping.output_columns:
            column_usage[col_config.column_name] = column_usage.get(col_config.column_name, 0) + 1
        
        duplicate_columns = [col for col, count in column_usage.items() if count > 1]
        if duplicate_columns:
            warnings.append(f"Columns used in multiple mappings: {duplicate_columns}")
        
        return {
            'is_valid': len(issues) == 0,
            'issues': issues,
            'warnings': warnings,
            'mapped_columns': list(all_mapped_columns),
            'unused_columns': list(available_columns - all_mapped_columns)
        }
    
    def apply_mapping(self, data: pd.DataFrame, mapping: ColumnMapping) -> List[TrainingExample]:
        """
        Apply column mapping to data and return processed training examples
        
        Args:
            data: Source DataFrame
            mapping: Column mapping configuration
            
        Returns:
            List of training examples
        """
        processed_data = []
        
        for _, row in data.iterrows():
            try:
                # Build instruction
                instruction = self._build_instruction(mapping, row)
                
                # Build input (string or JSON object)
                input_data = self._build_input(mapping, row)
                
                # Build output (string or JSON object)
                output_data = self._build_output(mapping, row)
                
                # More lenient validation - only require valid output
                # Allow empty instructions if static instruction is provided
                has_valid_instruction = (
                    instruction.strip() or 
                    (mapping.static_instruction and mapping.static_instruction.strip())
                )
                
                has_valid_output = self._is_valid_output(output_data)
                
                if has_valid_output:
                    # Use static instruction if dynamic instruction is empty
                    final_instruction = instruction.strip() or (mapping.static_instruction or "").strip()
                    
                    processed_data.append(TrainingExample(
                        instruction=final_instruction,
                        input=input_data,
                        output=output_data
                    ))
                    
            except Exception as e:
                # Skip rows that can't be processed
                print(f"Warning: Could not process row: {e}")
                continue
        
        return processed_data
    
    def _build_instruction(self, mapping: ColumnMapping, row: pd.Series) -> str:
        """Build instruction string from mapping and row data"""
        instruction_parts = []
        
        # Add static instruction if provided
        if mapping.static_instruction and mapping.static_instruction.strip():
            instruction_parts.append(mapping.static_instruction.strip())
        
        # Add dynamic instruction from columns
        if mapping.instruction_columns:
            if mapping.instruction_template:
                # Use custom template
                dynamic_instruction = self._apply_template(
                    mapping.instruction_template, 
                    mapping.instruction_columns, 
                    row
                )
            else:
                # Default template: just concatenate column values
                dynamic_parts = []
                for col_config in mapping.instruction_columns:
                    col_name = col_config.column_name
                    if col_name in row.index:
                        value = str(row[col_name]) if pd.notna(row[col_name]) else ""
                        if value.strip():
                            dynamic_parts.append(value.strip())
                dynamic_instruction = "\n".join(dynamic_parts)
            
            if dynamic_instruction.strip():
                instruction_parts.append(dynamic_instruction.strip())
        
        return "\n".join(instruction_parts)
    
    def _build_input(self, mapping: ColumnMapping, row: pd.Series) -> Union[str, Dict[str, Any]]:
        """Build input data (string or JSON object) from mapping and row data"""
        if not mapping.input_columns:
            return ""
        
        if len(mapping.input_columns) == 1:
            # Single column -> return as string or parsed JSON
            col_config = mapping.input_columns[0]
            col_name = col_config.column_name
            if col_name in row.index:
                value = row[col_name]
                if pd.notna(value):
                    if col_config.parse_json:
                        try:
                            # Try to parse as JSON
                            return json.loads(str(value))
                        except (json.JSONDecodeError, TypeError):
                            # If parsing fails, return as string
                            return str(value)
                    else:
                        return str(value)
                return ""
            return ""
        else:
            # Multiple columns -> return as JSON object with field mapping
            input_obj = {}
            for col_config in mapping.input_columns:
                col_name = col_config.column_name
                target_field = col_config.get_target_field()
                
                if col_name in row.index:
                    value = row[col_name]
                    if pd.notna(value):
                        if col_config.parse_json:
                            try:
                                # Try to parse as JSON
                                parsed_value = json.loads(str(value))
                                input_obj[target_field] = parsed_value
                            except (json.JSONDecodeError, TypeError):
                                # If parsing fails, store as string
                                input_obj[target_field] = self._convert_numpy_types(value)
                        else:
                            input_obj[target_field] = self._convert_numpy_types(value)
                    else:
                        input_obj[target_field] = None
            return input_obj
    
    def _build_output(self, mapping: ColumnMapping, row: pd.Series) -> Union[str, Dict[str, Any]]:
        """Build output data (string or JSON object) from mapping and row data"""
        if not mapping.output_columns:
            return ""
        
        if len(mapping.output_columns) == 1:
            # Single column -> return as string or parsed JSON
            col_config = mapping.output_columns[0]
            col_name = col_config.column_name
            if col_name in row.index:
                value = row[col_name]
                if pd.notna(value):
                    if mapping.output_template:
                        # Apply custom template
                        return self._apply_template(mapping.output_template, [col_config], row)
                    elif col_config.parse_json:
                        try:
                            # Try to parse as JSON
                            return json.loads(str(value))
                        except (json.JSONDecodeError, TypeError):
                            # If parsing fails, return as string
                            return str(value)
                    else:
                        # Return raw value as string
                        return str(value)
                return ""
            return ""
        else:
            # Multiple columns -> return as JSON object with field mapping
            output_obj = {}
            for col_config in mapping.output_columns:
                col_name = col_config.column_name
                target_field = col_config.get_target_field()
                
                if col_name in row.index:
                    value = row[col_name]
                    if pd.notna(value):
                        if col_config.parse_json:
                            try:
                                # Try to parse as JSON
                                parsed_value = json.loads(str(value))
                                output_obj[target_field] = parsed_value
                            except (json.JSONDecodeError, TypeError):
                                # If parsing fails, store as string
                                output_obj[target_field] = self._convert_numpy_types(value)
                        else:
                            output_obj[target_field] = self._convert_numpy_types(value)
                    else:
                        output_obj[target_field] = None
            return output_obj
    
    def _apply_template(self, template: str, columns: List[ColumnConfig], row: pd.Series) -> str:
        """Apply template to a single row of data"""
        result = template
        
        for col_config in columns:
            col_name = col_config.column_name
            if col_name in row.index:
                value = str(row[col_name]) if pd.notna(row[col_name]) else ""
                
                # Apply formatting based on column configuration
                formatted_value = self._format_column_value(value, col_config)
                
                # Replace placeholder in template
                result = result.replace(f"{{{col_name}}}", formatted_value)
        
        return result.strip()
    
    def _format_column_value(self, value: str, col_config: ColumnConfig) -> str:
        """Format a column value based on its configuration"""
        if not value:
            return ""
        
        if col_config.format_type == ColumnFormat.JSON:
            try:
                # Try to parse and reformat as JSON
                parsed = json.loads(value)
                return json.dumps(parsed, indent=2)
            except:
                return value
        
        elif col_config.format_type == ColumnFormat.LIST:
            # Try to format as bullet list
            if ',' in value:
                items = [item.strip() for item in value.split(',')]
                return '\n'.join(f"• {item}" for item in items if item)
            return f"• {value}"
        
        elif col_config.format_type == ColumnFormat.TABLE:
            # Simple table formatting
            return f"| {value} |"
        
        else:  # TEXT format
            return value
    
    def _is_valid_output(self, output_data: Union[str, Dict[str, Any]]) -> bool:
        """Check if output data is valid (not empty)"""
        if output_data is None:
            return False
        elif isinstance(output_data, str):
            return bool(output_data.strip())
        elif isinstance(output_data, dict):
            # Check if dict has any non-null values
            return any(v is not None and str(v).strip() for v in output_data.values())
        elif isinstance(output_data, (list, tuple)):
            # Check if list/tuple has any non-null values
            return len(output_data) > 0 and any(v is not None for v in output_data)
        elif pd.isna(output_data):
            return False
        else:
            # For any other data type, convert to string and check if non-empty
            try:
                return bool(str(output_data).strip())
            except:
                return False
    
    def preview_mapping(
        self, 
        data: pd.DataFrame, 
        mapping: ColumnMapping, 
        limit: int = 10
    ) -> List[TrainingExample]:
        """
        Preview how the mapping would be applied to the data
        
        Args:
            data: Source DataFrame
            mapping: Column mapping to preview
            limit: Number of rows to preview
            
        Returns:
            List of preview examples
        """
        preview_data = data.head(limit)
        return self.apply_mapping(preview_data, mapping)
    
    def get_processing_stats(self, data: pd.DataFrame, mapping: ColumnMapping) -> Dict[str, Any]:
        """
        Get statistics about how the mapping would process the data
        
        Args:
            data: Source DataFrame
            mapping: Column mapping configuration
            
        Returns:
            Processing statistics
        """
        # Apply mapping to get processed examples
        processed_examples = self.apply_mapping(data, mapping)
        
        # Calculate statistics
        total_input_rows = len(data)
        valid_output_rows = len(processed_examples)
        skipped_rows = total_input_rows - valid_output_rows
        
        # Analyze instruction lengths
        instruction_lengths = [len(ex.instruction) for ex in processed_examples]
        
        # Analyze output types and sizes
        string_outputs = sum(1 for ex in processed_examples if isinstance(ex.output, str))
        json_outputs = sum(1 for ex in processed_examples if isinstance(ex.output, dict))
        
        return {
            'total_input_rows': total_input_rows,
            'valid_output_rows': valid_output_rows,
            'skipped_rows': skipped_rows,
            'success_rate': (valid_output_rows / total_input_rows * 100) if total_input_rows > 0 else 0,
            'instruction_stats': {
                'avg_length': sum(instruction_lengths) / len(instruction_lengths) if instruction_lengths else 0,
                'min_length': min(instruction_lengths) if instruction_lengths else 0,
                'max_length': max(instruction_lengths) if instruction_lengths else 0
            },
            'output_types': {
                'string_outputs': string_outputs,
                'json_outputs': json_outputs
            },
            'column_usage': {
                'instruction_columns': len(mapping.instruction_columns),
                'input_columns': len(mapping.input_columns),
                'output_columns': len(mapping.output_columns)
            }
        }


# Global instance
column_mapping_service = ColumnMappingService()
