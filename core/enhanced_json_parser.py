#!/usr/bin/env python3
"""
Enhanced JSON parser that treats every prediction as containing JSON data
Handles Python dict format, embedded JSON, malformed JSON, etc.
"""

import json
import re
from typing import Dict, Any, Optional, List

class EnhancedJSONParser:
    """
    Enhanced JSON parser that extracts JSON from any text format
    Assumes every prediction contains JSON data in some form
    """
    
    def __init__(self, field_mappings: Dict[str, List[str]] = None):
        # Field mapping for normalization - can be customized
        self.field_mappings = field_mappings or {
            'invoice_no': ['invoice_no', 'invoice_number', 'invoiceno', 'invoice_num', 'bill_no'],
            'invoice_date': ['invoice_date', 'billDate', 'bill_date', 'date'],
            'amount': ['amount', 'invoice_amount', 'invoiceAmount', 'total_amount', 'total'],
            'buyer_gstin': ['buyer_gstin', 'buyerGSTIN', 'buyer_gst', 'customer_gstin'],
            'seller_gstin': ['seller_gstin', 'sellerGSTIN', 'seller_gst', 'vendor_gstin']
        }
    
    def extract_json_from_any_format(self, predict_text: str) -> Dict[str, Any]:
        """
        Extract JSON from any format - treats every prediction as containing JSON
        """
        if not predict_text or not predict_text.strip():
            return {}
        
        # Strategy 1: Try direct JSON parsing
        result = self._try_direct_json_parsing(predict_text)
        if result:
            return result
        
        # Strategy 2: Fix Python dict format and parse
        result = self._try_python_dict_parsing(predict_text)
        if result:
            return result
        
        # Strategy 3: Extract JSON from embedded text
        result = self._try_embedded_json_extraction(predict_text)
        if result:
            return result
        
        # Strategy 4: Extract from malformed JSON with commas in numbers
        result = self._try_malformed_json_with_commas(predict_text)
        if result:
            return result
        
        # Strategy 5: Extract key-value pairs from any text
        result = self._extract_key_value_pairs_aggressive(predict_text)
        if result:
            return result
        
        # Strategy 6: Extract from OCR-like text
        result = self._extract_from_ocr_text(predict_text)
        if result:
            return result
        
        return {}
    
    def _try_direct_json_parsing(self, text: str) -> Optional[Dict[str, Any]]:
        """Try parsing as direct JSON"""
        try:
            # Clean up common issues first
            cleaned = self._clean_json_string(text)
            parsed = json.loads(cleaned)
            if isinstance(parsed, dict) and len(parsed) > 0:
                return parsed
        except:
            pass
        return None
    
    def _try_python_dict_parsing(self, text: str) -> Optional[Dict[str, Any]]:
        """Convert Python dict format to JSON and parse"""
        try:
            # Fix Python dict format
            fixed_text = self._fix_python_dict_format(text)
            parsed = json.loads(fixed_text)
            if isinstance(parsed, dict) and len(parsed) > 0:
                return parsed
        except:
            pass
        return None
    
    def _try_embedded_json_extraction(self, text: str) -> Optional[Dict[str, Any]]:
        """Extract JSON from text with explanatory content"""
        # Patterns to find JSON in explanatory text
        patterns = [
            r'(?:Here is|Here\'s|The|JSON|format|object|representation).*?(\{.*?\})',
            r'(?:extracted|data|information).*?(\{.*?\})',
            r'(?:json|JSON).*?(\{.*?\})',
            r'(\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\})',  # Any JSON-like structure
        ]
        
        for pattern in patterns:
            matches = re.findall(pattern, text, re.DOTALL | re.IGNORECASE)
            for match in matches:
                try:
                    # Try to parse the extracted JSON
                    cleaned = self._clean_json_string(match)
                    parsed = json.loads(cleaned)
                    if isinstance(parsed, dict) and len(parsed) > 0:
                        return parsed
                except:
                    # Try fixing Python dict format
                    try:
                        fixed = self._fix_python_dict_format(match)
                        parsed = json.loads(fixed)
                        if isinstance(parsed, dict) and len(parsed) > 0:
                            return parsed
                    except:
                        continue
        return None
    
    def _try_malformed_json_with_commas(self, text: str) -> Optional[Dict[str, Any]]:
        """Handle JSON with commas in numbers like 2,67,716.00"""
        try:
            # Find JSON-like structures
            json_pattern = r'\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}'
            matches = re.findall(json_pattern, text, re.DOTALL)
            
            for match in matches:
                # Fix commas in numbers - more comprehensive approach
                fixed = match
                
                # Pattern 1: Fix Indian number format (2,67,716.00)
                fixed = re.sub(r'(\d+),(\d{2}),(\d{3})\.(\d{2})', r'\1\2\3.\4', fixed)
                
                # Pattern 2: Fix standard comma-separated numbers
                fixed = re.sub(r'(\d+),(\d{3})', r'\1\2', fixed)
                
                # Pattern 3: Fix any remaining commas in numbers
                fixed = re.sub(r'(\d+),(\d+)', r'\1\2', fixed)
                
                # Fix Python dict format
                fixed = self._fix_python_dict_format(fixed)
                
                try:
                    parsed = json.loads(fixed)
                    if isinstance(parsed, dict) and len(parsed) > 0:
                        return parsed
                except:
                    continue
        except:
            pass
        return None
    
    def _extract_key_value_pairs_aggressive(self, text: str) -> Optional[Dict[str, Any]]:
        """Aggressively extract key-value pairs from any text format"""
        result = {}
        
        # Multiple patterns for different formats - improved to handle complex values
        patterns = [
            # Standard JSON format with quoted values
            r'"([^"]+)":\s*"([^"]*)"',
            # Standard JSON format with unquoted values (numbers, etc.)
            r'"([^"]+)":\s*([^,}\n]+?)(?=\s*[,}\n])',
            
            # Python dict format with quoted values
            r"'([^']+)':\s*'([^']*)'",
            # Python dict format with unquoted values
            r"'([^']+)':\s*([^,}\n]+?)(?=\s*[,}\n])",
            
            # Colon separated with quoted values
            r'(\w+):\s*"([^"]*)"',
            # Colon separated with unquoted values - more permissive
            r'(\w+):\s*([^,}\n]+?)(?=\s*[,}\n]|$)',
            
            # Invoice specific patterns - more permissive
            r'invoice[_\s]*(?:no|number)[_\s]*:?\s*([A-Z0-9\/\-\s]+?)(?=\s*[,}\n]|$)',
            r'invoice[_\s]*date[_\s]*:?\s*([0-9\-\/\s]+?)(?=\s*[,}\n]|$)',
            r'(?:amount|total)[_\s]*:?\s*([0-9,\.\s\/\-]+?)(?=\s*[,}\n]|$)',
            r'buyer[_\s]*gstin[_\s]*:?\s*([A-Z0-9]+)',
            r'seller[_\s]*gstin[_\s]*:?\s*([A-Z0-9]+)',
            
            # GSTIN patterns
            r'GSTIN[\/\s]*:?\s*([A-Z0-9]{15})',
            r'([A-Z0-9]{15})',  # Direct GSTIN pattern
        ]
        
        for pattern in patterns:
            matches = re.findall(pattern, text, re.IGNORECASE)
            for match in matches:
                if isinstance(match, tuple) and len(match) == 2:
                    key, value = match
                    key = key.strip().lower().replace(' ', '_')
                    value = str(value).strip().strip('"').strip("'").strip()
                    
                    # Clean up value - remove trailing punctuation and extra spaces
                    value = re.sub(r'[,\s]*$', '', value)
                    
                    if key and value and value != 'null' and len(value) > 0:
                        result[key] = value
                elif isinstance(match, str) and len(match) == 15 and match.isalnum():
                    # Likely a GSTIN
                    if 'buyer_gstin' not in result:
                        result['buyer_gstin'] = match
                    elif 'seller_gstin' not in result:
                        result['seller_gstin'] = match
        
        return result if result else None
    
    def _extract_from_ocr_text(self, text: str) -> Optional[Dict[str, Any]]:
        """Extract data from OCR-like text"""
        result = {}
        
        # Look for invoice numbers
        invoice_patterns = [
            r'Invoice\s+No\.?\s*:?\s*([A-Z0-9\/\-]+)',
            r'Bill\s+No\.?\s*:?\s*([A-Z0-9\/\-]+)',
            r'([A-Z]{2,}\/[0-9\-]+\/[0-9]+)',
        ]
        
        for pattern in invoice_patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                result['invoice_no'] = match.group(1)
                break
        
        # Look for dates
        date_patterns = [
            r'(\d{1,2}[-\/]\w{3}[-\/]\d{2,4})',
            r'(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})',
            r'(\d{4}[-\/]\d{1,2}[-\/]\d{1,2})',
        ]
        
        for pattern in date_patterns:
            match = re.search(pattern, text)
            if match:
                result['invoice_date'] = match.group(1)
                break
        
        # Look for amounts
        amount_patterns = [
            r'(?:Amount|Total|Rs\.?)\s*:?\s*([0-9,\.]+)',
            r'([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})?)',
        ]
        
        for pattern in amount_patterns:
            match = re.search(pattern, text)
            if match:
                amount = match.group(1).replace(',', '')
                try:
                    if float(amount) > 100:  # Reasonable invoice amount
                        result['amount'] = amount
                        break
                except (ValueError, TypeError):
                    continue  # Skip invalid amounts
        
        # Look for GSTINs
        gstin_pattern = r'([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9][A-Z][0-9])'
        gstins = re.findall(gstin_pattern, text)
        
        if len(gstins) >= 1:
            result['buyer_gstin'] = gstins[0]
        if len(gstins) >= 2:
            result['seller_gstin'] = gstins[1]
        
        return result if result else None
    
    def _fix_python_dict_format(self, text: str) -> str:
        """Convert Python dict format to valid JSON"""
        # Replace single quotes with double quotes for keys
        text = re.sub(r"'([^']*)':", r'"\1":', text)
        
        # Replace single quotes with double quotes for string values
        text = re.sub(r":\s*'([^']*)'", r': "\1"', text)
        
        # Fix boolean values
        text = re.sub(r'\bTrue\b', 'true', text)
        text = re.sub(r'\bFalse\b', 'false', text)
        text = re.sub(r'\bNone\b', 'null', text)
        
        # Remove commas in numbers
        text = re.sub(r'(\d+),(\d+)', r'\1\2', text)
        
        return text
    
    def _clean_json_string(self, json_str: str) -> str:
        """Clean and fix common JSON formatting issues"""
        json_str = json_str.strip()
        
        # Remove trailing commas
        json_str = re.sub(r',\s*}', '}', json_str)
        json_str = re.sub(r',\s*]', ']', json_str)
        
        # Fix unquoted keys (only if not already quoted)
        json_str = re.sub(r'(?<!")(\w+)(?!"):', r'"\1":', json_str)
        
        return json_str
    
    def normalize_field_names(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Normalize field names to standard format"""
        normalized = {}
        
        for key, value in data.items():
            standard_key = None
            key_lower = key.lower().strip()
            
            # Find matching standard field name
            for standard_name, variations in self.field_mappings.items():
                if key_lower in [v.lower() for v in variations]:
                    standard_key = standard_name
                    break
            
            if standard_key:
                normalized[standard_key] = value
            else:
                normalized[key] = value
        
        return normalized

def test_enhanced_parser():
    """Test the enhanced parser with sample data"""
    parser = EnhancedJSONParser()
    
    test_cases = [
        # Python dict format
        "{'amount': 31019.0, 'buyer_gstin': '37BGGPK4333P2ZX', 'invoice_date': '2024-07-15'}",
        
        # Embedded in text
        "Here is the JSON: {'invoice_no': 'INV-123', 'amount': '1000.00'}",
        
        # Malformed with commas
        '{"invoice_amount": 2,67,716.00, "invoice_date": "2024-07-04"}',
        
        # OCR-like text
        "Invoice No. PM/2024-25/0562 Date: 2024-07-29 Amount: 61,953.40 GSTIN: 08DHOPB5169M1ZQ",
        
        # Empty
        "{}",
        
        # Pure text
        "RAIN BORN 1200 2000 2000",
    ]
    
    print("Testing Enhanced JSON Parser:")
    print("=" * 50)
    
    for i, test_case in enumerate(test_cases, 1):
        print(f"\nTest {i}:")
        print(f"Input: {test_case[:100]}...")
        
        result = parser.extract_json_from_any_format(test_case)
        normalized = parser.normalize_field_names(result)
        
        print(f"Extracted: {result}")
        print(f"Normalized: {normalized}")

if __name__ == "__main__":
    test_enhanced_parser()
