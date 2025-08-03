"""
Simple OCR Service using Tesseract as fallback
This is a temporary solution while PaddleOCR is being set up
"""

import os
import tempfile
import uuid
from typing import Tuple, Optional, List, Dict, Any
from PIL import Image
from pdf2image import convert_from_path
import logging
import json
import re

logger = logging.getLogger(__name__)

# Try to import Tesseract
try:
    import pytesseract
    TESSERACT_AVAILABLE = True
    logger.info("Tesseract OCR available")
except ImportError:
    TESSERACT_AVAILABLE = False
    logger.warning("Tesseract OCR not available")

class SimpleOCRService:
    def __init__(self):
        """Initialize simple OCR service with Tesseract"""
        if not TESSERACT_AVAILABLE:
            raise ImportError("Tesseract is not available. Please install: pip install pytesseract")
        
        logger.info("Simple OCR service initialized with Tesseract")
    
    def extract_text_from_file(self, file_path: str, file_type: str) -> Tuple[bool, str, str]:
        """
        Extract text from uploaded file using Tesseract
        
        Args:
            file_path: Path to the uploaded file
            file_type: Type of file (pdf, jpg, png, etc.)
            
        Returns:
            Tuple of (success, extracted_text, error_message)
        """
        try:
            if file_type.lower() == 'pdf':
                return self._extract_from_pdf(file_path)
            elif file_type.lower() in ['jpg', 'jpeg', 'png']:
                return self._extract_from_image(file_path)
            else:
                return False, "", f"Unsupported file type: {file_type}"
                
        except Exception as e:
            logger.error(f"OCR extraction failed: {str(e)}")
            return False, "", f"OCR processing failed: {str(e)}"
    
    def extract_structured_data(self, file_path: str, file_type: str) -> Tuple[bool, Dict[str, Any], str]:
        """
        Extract basic structured data (simplified version)
        """
        try:
            success, text, error = self.extract_text_from_file(file_path, file_type)
            if not success:
                return False, {}, error
            
            # Create basic structured data
            lines = text.split('\n')
            text_blocks = []
            
            for i, line in enumerate(lines):
                if line.strip():
                    text_blocks.append({
                        "text": line.strip(),
                        "confidence": 0.85,  # Default confidence
                        "bbox": {
                            "top_left": [0, i * 20],
                            "top_right": [100, i * 20],
                            "bottom_right": [100, (i + 1) * 20],
                            "bottom_left": [0, (i + 1) * 20]
                        },
                        "center": {"x": 50, "y": i * 20 + 10}
                    })
            
            structured_data = {
                "page_number": 1,
                "text": text,
                "text_blocks": text_blocks,
                "total_blocks": len(text_blocks)
            }
            
            return True, structured_data, ""
            
        except Exception as e:
            logger.error(f"Structured OCR extraction failed: {str(e)}")
            return False, {}, f"Structured OCR processing failed: {str(e)}"
    
    def extract_invoice_fields(self, file_path: str, file_type: str) -> Tuple[bool, Dict[str, Any], str]:
        """
        Extract common invoice fields using regex patterns
        """
        try:
            success, structured_data, error = self.extract_structured_data(file_path, file_type)
            if not success:
                return False, {}, error
            
            # Extract invoice fields from text
            invoice_fields = self._parse_invoice_fields(structured_data)
            
            return True, invoice_fields, ""
            
        except Exception as e:
            logger.error(f"Invoice field extraction failed: {str(e)}")
            return False, {}, f"Invoice field extraction failed: {str(e)}"
    
    def _extract_from_pdf(self, pdf_path: str) -> Tuple[bool, str, str]:
        """Extract text from PDF file using Tesseract"""
        try:
            images = convert_from_path(pdf_path, dpi=300)
            
            extracted_texts = []
            for i, image in enumerate(images):
                # Extract text using Tesseract
                text = pytesseract.image_to_string(image)
                
                if text.strip():
                    extracted_texts.append(f"--- Page {i+1} ---\n{text.strip()}")
            
            if extracted_texts:
                full_text = "\n\n".join(extracted_texts)
                return True, full_text, ""
            else:
                return False, "", "No text could be extracted from the PDF"
                
        except Exception as e:
            logger.error(f"PDF OCR failed: {str(e)}")
            return False, "", f"PDF processing failed: {str(e)}"
    
    def _extract_from_image(self, image_path: str) -> Tuple[bool, str, str]:
        """Extract text from image file using Tesseract"""
        try:
            # Extract text using Tesseract
            text = pytesseract.image_to_string(Image.open(image_path))
            
            if text.strip():
                return True, text.strip(), ""
            else:
                return False, "", "No text could be extracted from the image"
                
        except Exception as e:
            logger.error(f"Image OCR failed: {str(e)}")
            return False, "", f"Image processing failed: {str(e)}"
    
    def _parse_invoice_fields(self, structured_data: Dict[str, Any]) -> Dict[str, Any]:
        """Parse common invoice fields from text"""
        invoice_fields = {
            "invoice_no": None,
            "invoice_date": None,
            "buyer_gstin": None,
            "seller_gstin": None,
            "amount": None,
            "total_amount": None,
            "tax_amount": None,
            "raw_fields": []
        }
        
        # Get all text
        text = structured_data.get("text", "").lower()
        text_blocks = structured_data.get("text_blocks", [])
        
        # Define patterns for common invoice fields
        patterns = {
            "invoice_no": [
                r"invoice\s*(?:no|number|#)\s*:?\s*([A-Z0-9\-/]+)",
                r"bill\s*(?:no|number|#)\s*:?\s*([A-Z0-9\-/]+)",
                r"inv\s*(?:no|#)\s*:?\s*([A-Z0-9\-/]+)"
            ],
            "invoice_date": [
                r"(?:invoice\s*)?date\s*:?\s*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})",
                r"(?:bill\s*)?date\s*:?\s*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})",
                r"dated?\s*:?\s*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})"
            ],
            "buyer_gstin": [
                r"buyer\s*gstin\s*:?\s*([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}[Z]{1}[0-9A-Z]{1})",
                r"gstin\s*(?:of\s*buyer)?\s*:?\s*([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}[Z]{1}[0-9A-Z]{1})"
            ],
            "seller_gstin": [
                r"seller\s*gstin\s*:?\s*([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}[Z]{1}[0-9A-Z]{1})",
                r"our\s*gstin\s*:?\s*([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}[Z]{1}[0-9A-Z]{1})"
            ],
            "amount": [
                r"(?:total\s*)?amount\s*:?\s*₹?\s*([0-9,]+\.?[0-9]*)",
                r"(?:grand\s*)?total\s*:?\s*₹?\s*([0-9,]+\.?[0-9]*)",
                r"net\s*amount\s*:?\s*₹?\s*([0-9,]+\.?[0-9]*)"
            ]
        }
        
        # Search for patterns in text
        for field_name, field_patterns in patterns.items():
            for pattern in field_patterns:
                match = re.search(pattern, text, re.IGNORECASE)
                if match:
                    invoice_fields[field_name] = {
                        "value": match.group(1),
                        "confidence": 0.85,
                        "bbox": {"top_left": [0, 0], "top_right": [100, 0], "bottom_right": [100, 20], "bottom_left": [0, 20]},
                        "raw_text": match.group(0)
                    }
                    break
        
        # Store all fields for reference
        for block in text_blocks:
            invoice_fields["raw_fields"].append({
                "text": block["text"],
                "confidence": block["confidence"],
                "bbox": block["bbox"]
            })
        
        return invoice_fields
    
    def validate_file(self, file_path: str, max_size_mb: int = 10) -> Tuple[bool, str]:
        """Validate uploaded file"""
        try:
            if not os.path.exists(file_path):
                return False, "File not found"
            
            file_size = os.path.getsize(file_path)
            if file_size > max_size_mb * 1024 * 1024:
                return False, f"File size exceeds {max_size_mb}MB limit"
            
            file_ext = os.path.splitext(file_path)[1].lower()
            allowed_extensions = ['.pdf', '.jpg', '.jpeg', '.png']
            
            if file_ext not in allowed_extensions:
                return False, f"Unsupported file type. Allowed: {', '.join(allowed_extensions)}"
            
            return True, ""
            
        except Exception as e:
            return False, f"File validation failed: {str(e)}"
    
    def get_file_info(self, file_path: str) -> dict:
        """Get basic information about the uploaded file"""
        try:
            file_size = os.path.getsize(file_path)
            file_ext = os.path.splitext(file_path)[1].lower()
            
            info = {
                'size_bytes': file_size,
                'size_mb': round(file_size / (1024 * 1024), 2),
                'extension': file_ext,
                'type': 'pdf' if file_ext == '.pdf' else 'image'
            }
            
            if file_ext in ['.jpg', '.jpeg', '.png']:
                try:
                    with Image.open(file_path) as img:
                        info['width'] = img.width
                        info['height'] = img.height
                        info['format'] = img.format
                except Exception:
                    pass
            
            return info
            
        except Exception as e:
            logger.error(f"Failed to get file info: {str(e)}")
            return {}

# Create fallback service instance
try:
    simple_ocr_service = SimpleOCRService()
    logger.info("Simple OCR service created successfully")
except Exception as e:
    logger.error(f"Failed to create simple OCR service: {e}")
    simple_ocr_service = None
