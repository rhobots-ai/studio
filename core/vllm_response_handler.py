#!/usr/bin/env python3
"""
VLLM Response Handler for robust parsing of VLLM API responses
Handles malformed JSON responses and extracts content reliably
"""

import json
import re
from typing import Dict, Any, Optional, Tuple, List
from enhanced_json_parser import EnhancedJSONParser

class VLLMResponseHandler:
    """
    Handles VLLM API responses with robust error recovery
    Extracts model predictions even from malformed API responses
    """
    
    def __init__(self):
        self.json_parser = EnhancedJSONParser()
    
    def extract_prediction_from_response(self, response: Any) -> Tuple[str, str, Dict[str, Any]]:
        """
        Extract prediction from VLLM response with comprehensive error handling
        
        Returns:
            Tuple of (prediction_text, recovery_method, metadata)
        """
        
        # If response is already a string, treat it as the prediction
        if isinstance(response, str):
            return response, "direct_string", {}
        
        # Try to handle the response as a structured object
        try:
            # Case 1: Response is already a parsed dict/object
            if isinstance(response, dict):
                return self._extract_from_dict_response(response)
            
            # Case 2: Response is a list (batch response)
            elif isinstance(response, list) and len(response) > 0:
                # Take the first response for single prediction
                first_response = response[0]
                if isinstance(first_response, str):
                    return first_response, "list_string", {}
                elif isinstance(first_response, dict):
                    return self._extract_from_dict_response(first_response)
            
            # Case 3: Try to convert to string and parse
            response_str = str(response)
            return self._extract_from_string_response(response_str)
            
        except Exception as e:
            # Last resort: treat as string
            response_str = str(response)
            return self._extract_from_string_response(response_str)
    
    def _extract_from_dict_response(self, response_dict: Dict[str, Any]) -> Tuple[str, str, Dict[str, Any]]:
        """Extract prediction from dictionary response"""
        
        # Check for error responses with raw_response field (user's case)
        if "error" in response_dict and "raw_response" in response_dict:
            raw_response_str = response_dict["raw_response"]
            if raw_response_str:
                # Try to extract from the raw_response string
                try:
                    return self._extract_from_string_response(raw_response_str)
                except:
                    pass
        
        # Standard VLLM response structure
        if "choices" in response_dict and isinstance(response_dict["choices"], list):
            if len(response_dict["choices"]) > 0:
                choice = response_dict["choices"][0]
                if isinstance(choice, dict) and "message" in choice:
                    message = choice["message"]
                    if isinstance(message, dict) and "content" in message:
                        content = message["content"]
                        if content:
                            return str(content), "vllm_standard", {
                                "model": response_dict.get("model"),
                                "usage": response_dict.get("usage")
                            }
        
        # Alternative structures
        if "content" in response_dict:
            content = response_dict["content"]
            if content:
                return str(content), "direct_content", {}
        
        if "text" in response_dict:
            text = response_dict["text"]
            if text:
                return str(text), "direct_text", {}
        
        if "response" in response_dict:
            response_content = response_dict["response"]
            if response_content:
                return str(response_content), "direct_response", {}
        
        # If no standard fields found, convert entire dict to string
        return str(response_dict), "dict_fallback", {}
    
    def _extract_from_string_response(self, response_str: str) -> Tuple[str, str, Dict[str, Any]]:
        """Extract prediction from string response (potentially malformed JSON)"""
        
        # Try to parse as JSON first
        try:
            parsed = json.loads(response_str)
            if isinstance(parsed, dict):
                return self._extract_from_dict_response(parsed)
            else:
                return str(parsed), "json_parsed", {}
        except json.JSONDecodeError as e:
            # JSON parsing failed, try to extract content from malformed JSON
            return self._extract_from_malformed_json(response_str, str(e))
    
    def _extract_from_malformed_json(self, response_str: str, error_msg: str) -> Tuple[str, str, Dict[str, Any]]:
        """Extract content from malformed JSON response"""
        
        metadata = {"json_error": error_msg}
        
        # Pattern 1: Extract content field from malformed VLLM response
        content_patterns = [
            r'"content":\s*"([^"]*(?:\\.[^"]*)*)"',  # Standard content field
            r'"content":\s*"([^"]*)"',  # Simple content field
            r'"content":\s*([^,}]+)',  # Unquoted content
        ]
        
        for pattern in content_patterns:
            matches = re.findall(pattern, response_str, re.DOTALL)
            if matches:
                content = matches[0]
                # Unescape JSON escapes
                content = content.replace('\\"', '"').replace('\\n', '\n').replace('\\\\', '\\')
                if content.strip():
                    return content, "extracted_content", metadata
        
        # Pattern 2: Look for JSON-like structures in the response
        json_patterns = [
            r'\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}',  # Nested JSON structures
            r'\{[^}]+\}',  # Simple JSON structures
        ]
        
        for pattern in json_patterns:
            matches = re.findall(pattern, response_str, re.DOTALL)
            for match in matches:
                # Try to parse each potential JSON structure
                try:
                    parsed = json.loads(match)
                    if isinstance(parsed, dict) and len(parsed) > 0:
                        return json.dumps(parsed), "extracted_json", metadata
                except:
                    # Try with enhanced JSON parser
                    enhanced_result = self.json_parser.extract_json_from_any_format(match)
                    if enhanced_result:
                        return json.dumps(enhanced_result), "enhanced_extraction", metadata
        
        # Pattern 3: Extract any structured data using enhanced parser
        enhanced_result = self.json_parser.extract_json_from_any_format(response_str)
        if enhanced_result:
            return json.dumps(enhanced_result), "enhanced_full_extraction", metadata
        
        # Last resort: return the original string
        return response_str, "raw_fallback", metadata
    
    def parse_prediction_content(self, prediction_text: str) -> Dict[str, Any]:
        """
        Parse the extracted prediction text into structured data
        """
        if not prediction_text or not prediction_text.strip():
            return {}
        
        # Use the enhanced JSON parser to extract structured data
        return self.json_parser.extract_json_from_any_format(prediction_text)
    
    def get_prediction_quality_score(self, recovery_method: str, parsed_data: Dict[str, Any], expected_fields: List[str] = None) -> Tuple[str, float]:
        """
        Assess the quality of the recovered prediction
        
        Args:
            recovery_method: The method used to recover the prediction
            parsed_data: The parsed data dictionary
            expected_fields: Optional list of expected field names for domain-specific scoring
        
        Returns:
            Tuple of (quality_category, confidence_score)
        """
        
        # Quality categories based on recovery method
        quality_mapping = {
            "direct_string": ("high", 1.0),
            "vllm_standard": ("high", 1.0),
            "direct_content": ("high", 0.95),
            "direct_text": ("high", 0.95),
            "direct_response": ("high", 0.95),
            "json_parsed": ("high", 0.9),
            "extracted_content": ("medium", 0.8),
            "extracted_json": ("medium", 0.75),
            "enhanced_extraction": ("medium", 0.7),
            "enhanced_full_extraction": ("medium", 0.65),
            "dict_fallback": ("low", 0.5),
            "raw_fallback": ("low", 0.3),
            "list_string": ("high", 0.9),
        }
        
        base_quality, base_score = quality_mapping.get(recovery_method, ("low", 0.2))
        
        # Adjust score based on parsed data quality
        if parsed_data:
            # Domain-specific field bonus (if expected fields are provided)
            field_bonus = 0
            if expected_fields:
                found_fields = sum(1 for field in expected_fields if field in parsed_data)
                field_bonus = (found_fields / len(expected_fields)) * 0.2
            else:
                # Generic bonus based on having any structured data
                field_bonus = 0.1 if len(parsed_data) > 0 else 0
            
            # Check for non-empty values
            non_empty_values = sum(1 for v in parsed_data.values() if v and str(v).strip())
            if non_empty_values > 0:
                value_bonus = min(non_empty_values / len(parsed_data), 1.0) * 0.1
            else:
                value_bonus = 0
            
            final_score = min(base_score + field_bonus + value_bonus, 1.0)
        else:
            # No structured data found, reduce score
            final_score = base_score * 0.5
        
        # Determine final quality category
        if final_score >= 0.8:
            final_quality = "high"
        elif final_score >= 0.6:
            final_quality = "medium"
        else:
            final_quality = "low"
        
        return final_quality, final_score

# Global instance
vllm_response_handler = VLLMResponseHandler()
