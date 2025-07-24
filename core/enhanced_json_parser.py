import json
import re
from typing import Dict, Any, Optional, List

class EnhancedJSONParser:
    """
    Enhanced JSON parser that can extract JSON from various formats
    Handles malformed JSON, partial JSON, and text with embedded JSON
    """
    
    def __init__(self):
        # Common field mappings for normalization
        self.field_mappings = {
            'invoice_no': ['invoice_no', 'invoice_number', 'invoiceno', 'invoice_num', 'bill_no'],
            'invoice_date': ['invoice_date', 'billDate', 'bill_date', 'date'],
            'amount': ['amount', 'invoice_amount', 'invoiceAmount', 'total_amount', 'total'],
            'buyer_gstin': ['buyer_gstin', 'buyerGSTIN', 'buyer_gst', 'customer_gstin'],
            'seller_gstin': ['seller_gstin', 'sellerGSTIN', 'seller_gst', 'vendor_gstin']
        }
    
    def extract_json_from_any_format(self, text: str) -> Dict[str, Any]:
        """
        Extract JSON from any text format with multiple fallback strategies
        """
        if not text or not text.strip():
            return {}
        
        # Strategy 1: Try direct JSON parsing
        try:
            parsed = json.loads(text.strip())
            if isinstance(parsed, dict):
                return parsed
            elif isinstance(parsed, list) and len(parsed) > 0 and isinstance(parsed[0], dict):
                return parsed[0]
        except json.JSONDecodeError:
            pass
        
        # Strategy 2: Extract JSON blocks from text
        json_blocks = self._extract_json_blocks(text)
        for block in json_blocks:
            try:
                parsed = json.loads(block)
                if isinstance(parsed, dict) and len(parsed) > 0:
                    return parsed
            except json.JSONDecodeError:
                continue
        
        # Strategy 3: Fix common JSON issues and retry
        fixed_json = self._fix_common_json_issues(text)
        if fixed_json:
            try:
                parsed = json.loads(fixed_json)
                if isinstance(parsed, dict):
                    return parsed
            except json.JSONDecodeError:
                pass
        
        # Strategy 4: Extract key-value pairs using regex
        key_value_pairs = self._extract_key_value_pairs(text)
        if key_value_pairs:
            return key_value_pairs
        
        # Strategy 5: Parse structured text formats
        structured_data = self._parse_structured_text(text)
        if structured_data:
            return structured_data
        
        return {}
    
    def _extract_json_blocks(self, text: str) -> List[str]:
        """Extract potential JSON blocks from text"""
        json_blocks = []
        
        # Pattern 1: Complete JSON objects
        json_pattern = r'\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}'
        matches = re.findall(json_pattern, text, re.DOTALL)
        json_blocks.extend(matches)
        
        # Pattern 2: JSON-like structures with quotes
        quoted_json_pattern = r'```json\s*(\{.*?\})\s*```'
        matches = re.findall(quoted_json_pattern, text, re.DOTALL | re.IGNORECASE)
        json_blocks.extend(matches)
        
        # Pattern 3: JSON in code blocks
        code_block_pattern = r'```\s*(\{.*?\})\s*```'
        matches = re.findall(code_block_pattern, text, re.DOTALL)
        json_blocks.extend(matches)
        
        return json_blocks
    
    def _fix_common_json_issues(self, text: str) -> Optional[str]:
        """Fix common JSON formatting issues"""
        try:
            # Remove leading/trailing whitespace
            text = text.strip()
            
            # Find the first { and last }
            start = text.find('{')
            end = text.rfind('}')
            
            if start == -1 or end == -1 or start >= end:
                return None
            
            json_text = text[start:end+1]
            
            # Fix common issues
            json_text = re.sub(r',\s*}', '}', json_text)  # Remove trailing commas before }
            json_text = re.sub(r',\s*]', ']', json_text)  # Remove trailing commas before ]
            json_text = re.sub(r'([{,]\s*)(\w+):', r'\1"\2":', json_text)  # Quote unquoted keys
            json_text = re.sub(r':\s*([^",{\[\]}\s][^",}\]]*[^",}\]\s])\s*([,}])', r': "\1"\2', json_text)  # Quote unquoted string values
            
            return json_text
            
        except Exception:
            return None
    
    def _extract_key_value_pairs(self, text: str) -> Dict[str, Any]:
        """Extract key-value pairs using various regex patterns"""
        result = {}
        
        # Pattern 1: "key": "value" or "key": value
        pattern1 = r'"([^"]+)":\s*"([^"]*)"'
        matches = re.findall(pattern1, text)
        for key, value in matches:
            result[key.strip()] = value.strip()
        
        # Pattern 2: "key": unquoted_value
        pattern2 = r'"([^"]+)":\s*([^,}\s][^,}]*?)(?=[,}]|$)'
        matches = re.findall(pattern2, text)
        for key, value in matches:
            clean_value = value.strip().strip('"').strip("'")
            if clean_value and clean_value != 'null':
                result[key.strip()] = clean_value
        
        # Pattern 3: key: "value" (unquoted keys)
        pattern3 = r'(\w+):\s*"([^"]*)"'
        matches = re.findall(pattern3, text)
        for key, value in matches:
            result[key.strip()] = value.strip()
        
        # Pattern 4: key: value (both unquoted)
        pattern4 = r'(\w+):\s*([^,}\s][^,}]*?)(?=[,}]|$)'
        matches = re.findall(pattern4, text)
        for key, value in matches:
            clean_value = value.strip().strip('"').strip("'")
            if clean_value and clean_value != 'null' and key not in result:
                result[key.strip()] = clean_value
        
        return result
    
    def _parse_structured_text(self, text: str) -> Dict[str, Any]:
        """Parse structured text formats (line-by-line key-value pairs)"""
        result = {}
        
        lines = text.split('\n')
        for line in lines:
            line = line.strip()
            if not line:
                continue
            
            # Look for key-value patterns
            if ':' in line:
                parts = line.split(':', 1)
                if len(parts) == 2:
                    key = parts[0].strip().strip('"').strip("'")
                    value = parts[1].strip().strip('"').strip("'")
                    
                    if key and value and value.lower() not in ['null', 'none', '']:
                        result[key] = value
            
            # Look for = patterns
            elif '=' in line:
                parts = line.split('=', 1)
                if len(parts) == 2:
                    key = parts[0].strip().strip('"').strip("'")
                    value = parts[1].strip().strip('"').strip("'")
                    
                    if key and value and value.lower() not in ['null', 'none', '']:
                        result[key] = value
        
        return result
    
    def normalize_field_names(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Normalize field names to standard format"""
        if not data:
            return data
        
        normalized = {}
        
        for key, value in data.items():
            # Find the standard field name for this key
            standard_key = None
            key_lower = key.lower().strip()
            
            for standard_name, variations in self.field_mappings.items():
                if key_lower in [v.lower() for v in variations]:
                    standard_key = standard_name
                    break
            
            if standard_key:
                normalized[standard_key] = value
            else:
                # Keep original key if no mapping found
                normalized[key] = value
        
        return normalized
    
    def validate_extracted_data(self, data: Dict[str, Any], expected_fields: List[str] = None) -> Dict[str, Any]:
        """Validate and clean extracted data"""
        if not data:
            return {}
        
        cleaned = {}
        
        for key, value in data.items():
            # Skip empty or null values
            if value is None:
                continue
            
            value_str = str(value).strip()
            if not value_str or value_str.lower() in ['null', 'none', 'n/a', '']:
                continue
            
            # Clean the value
            cleaned_value = self._clean_field_value(key, value_str)
            if cleaned_value:
                cleaned[key] = cleaned_value
        
        return cleaned
    
    def _clean_field_value(self, field_name: str, value: str) -> Optional[str]:
        """Clean individual field values based on field type"""
        if not value or not value.strip():
            return None
        
        value = value.strip()
        field_lower = field_name.lower()
        
        # Date field cleaning
        if 'date' in field_lower:
            # Remove common prefixes/suffixes
            value = re.sub(r'^(date:|invoice date:|bill date:)\s*', '', value, flags=re.IGNORECASE)
            value = value.strip()
        
        # Amount field cleaning
        elif 'amount' in field_lower or 'total' in field_lower:
            # Remove currency symbols and clean
            value = re.sub(r'[₹$€£¥]', '', value)
            value = re.sub(r'[^\d.,]', '', value)
            value = value.strip()
        
        # GSTIN field cleaning
        elif 'gstin' in field_lower or 'gst' in field_lower:
            # Keep only alphanumeric characters
            value = re.sub(r'[^A-Za-z0-9]', '', value)
            value = value.upper()
        
        # Invoice number cleaning
        elif 'invoice' in field_lower and ('no' in field_lower or 'number' in field_lower):
            # Remove common prefixes
            value = re.sub(r'^(invoice no:|invoice number:|inv no:)\s*', '', value, flags=re.IGNORECASE)
            value = value.strip()
        
        return value if value else None
