"""
Enhanced OCR Service using PaddleOCR
Supports PDF, JPG, PNG files with superior accuracy and no system dependencies
"""

import os
import tempfile
import uuid
from typing import Tuple, Optional, List, Dict, Any
from PIL import Image
from pdf2image import convert_from_path
import logging
import json

# Import PaddleOCR
try:
    from paddleocr import PaddleOCR
    PADDLEOCR_AVAILABLE = True
except ImportError as e:
    PADDLEOCR_AVAILABLE = False
    PaddleOCR = None
    logging.error(f"PaddleOCR not available: {e}. Please install: pip install paddlepaddle paddleocr")

logger = logging.getLogger(__name__)

class PaddleOCRService:
    def __init__(self):
        """Initialize PaddleOCR service"""
        if not PADDLEOCR_AVAILABLE:
            raise ImportError("PaddleOCR is not available. Please install: pip install paddlepaddle paddleocr")
        
        # Initialize PaddleOCR with English language
        # use_angle_cls=True enables text angle classification for better accuracy
        self.ocr = PaddleOCR(use_angle_cls=True, lang='en', show_log=False)
        logger.info("PaddleOCR service initialized successfully")
    
    def extract_text_from_file(self, file_path: str, file_type: str) -> Tuple[bool, str, str]:
        """
        Extract text from uploaded file using PaddleOCR
        
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
        Extract structured data with bounding boxes and confidence scores
        
        Args:
            file_path: Path to the uploaded file
            file_type: Type of file (pdf, jpg, png, etc.)
            
        Returns:
            Tuple of (success, structured_data, error_message)
        """
        try:
            if file_type.lower() == 'pdf':
                return self._extract_structured_from_pdf(file_path)
            elif file_type.lower() in ['jpg', 'jpeg', 'png']:
                return self._extract_structured_from_image(file_path)
            else:
                return False, {}, f"Unsupported file type: {file_type}"
                
        except Exception as e:
            logger.error(f"Structured OCR extraction failed: {str(e)}")
            return False, {}, f"Structured OCR processing failed: {str(e)}"
    
    def extract_invoice_fields(self, file_path: str, file_type: str) -> Tuple[bool, Dict[str, Any], str]:
        """
        Extract common invoice fields using intelligent text analysis
        
        Args:
            file_path: Path to the uploaded file
            file_type: Type of file (pdf, jpg, png, etc.)
            
        Returns:
            Tuple of (success, invoice_data, error_message)
        """
        try:
            # First get structured data
            success, structured_data, error = self.extract_structured_data(file_path, file_type)
            if not success:
                return False, {}, error
            
            # Extract invoice fields from structured data
            invoice_fields = self._parse_invoice_fields(structured_data)
            
            return True, invoice_fields, ""
            
        except Exception as e:
            logger.error(f"Invoice field extraction failed: {str(e)}")
            return False, {}, f"Invoice field extraction failed: {str(e)}"
    
    def _extract_from_pdf(self, pdf_path: str) -> Tuple[bool, str, str]:
        """Extract text from PDF file using PaddleOCR"""
        try:
            # Convert PDF to images
            images = convert_from_path(pdf_path, dpi=300)
            
            extracted_texts = []
            for i, image in enumerate(images):
                # Save image temporarily for PaddleOCR
                with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as temp_img:
                    image.save(temp_img.name, 'PNG')
                    
                    # Extract text using PaddleOCR
                    result = self.ocr.ocr(temp_img.name, cls=True)
                    
                    # Clean up temp file
                    os.unlink(temp_img.name)
                    
                    # Process OCR results
                    page_text = self._process_ocr_result(result)
                    
                    if page_text.strip():
                        extracted_texts.append(f"--- Page {i+1} ---\n{page_text.strip()}")
            
            if extracted_texts:
                full_text = "\n\n".join(extracted_texts)
                return True, full_text, ""
            else:
                return False, "", "No text could be extracted from the PDF"
                
        except Exception as e:
            logger.error(f"PDF OCR failed: {str(e)}")
            return False, "", f"PDF processing failed: {str(e)}"
    
    def _extract_from_image(self, image_path: str) -> Tuple[bool, str, str]:
        """Extract text from image file using PaddleOCR"""
        try:
            # Extract text using PaddleOCR
            result = self.ocr.ocr(image_path, cls=True)
            
            # Process OCR results
            text = self._process_ocr_result(result)
            
            if text.strip():
                return True, text.strip(), ""
            else:
                return False, "", "No text could be extracted from the image"
                
        except Exception as e:
            logger.error(f"Image OCR failed: {str(e)}")
            return False, "", f"Image processing failed: {str(e)}"
    
    def _extract_structured_from_pdf(self, pdf_path: str) -> Tuple[bool, Dict[str, Any], str]:
        """Extract structured data from PDF file"""
        try:
            images = convert_from_path(pdf_path, dpi=300)
            
            all_pages_data = []
            for i, image in enumerate(images):
                with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as temp_img:
                    image.save(temp_img.name, 'PNG')
                    
                    result = self.ocr.ocr(temp_img.name, cls=True)
                    os.unlink(temp_img.name)
                    
                    page_data = self._process_structured_result(result, page_number=i+1)
                    all_pages_data.append(page_data)
            
            structured_data = {
                "total_pages": len(all_pages_data),
                "pages": all_pages_data,
                "combined_text": "\n\n".join([page["text"] for page in all_pages_data if page["text"]])
            }
            
            return True, structured_data, ""
            
        except Exception as e:
            logger.error(f"Structured PDF OCR failed: {str(e)}")
            return False, {}, f"Structured PDF processing failed: {str(e)}"
    
    def _extract_structured_from_image(self, image_path: str) -> Tuple[bool, Dict[str, Any], str]:
        """Extract structured data from image file"""
        try:
            result = self.ocr.ocr(image_path, cls=True)
            structured_data = self._process_structured_result(result, page_number=1)
            
            return True, structured_data, ""
            
        except Exception as e:
            logger.error(f"Structured image OCR failed: {str(e)}")
            return False, {}, f"Structured image processing failed: {str(e)}"
    
    def _process_ocr_result(self, result: List) -> str:
        """Process PaddleOCR result to extract plain text"""
        if not result or not result[0]:
            return ""
        
        text_lines = []
        for line in result[0]:
            if len(line) >= 2:
                text = line[1][0]  # Extract text from [bbox, (text, confidence)]
                text_lines.append(text)
        
        return "\n".join(text_lines)
    
    def _process_structured_result(self, result: List, page_number: int = 1) -> Dict[str, Any]:
        """Process PaddleOCR result to extract structured data with bounding boxes"""
        if not result or not result[0]:
            return {
                "page_number": page_number,
                "text": "",
                "text_blocks": [],
                "total_blocks": 0
            }
        
        text_blocks = []
        text_lines = []
        
        for line in result[0]:
            if len(line) >= 2:
                bbox = line[0]  # Bounding box coordinates
                text_info = line[1]  # (text, confidence)
                text = text_info[0]
                confidence = text_info[1]
                
                # Create structured text block
                text_block = {
                    "text": text,
                    "confidence": round(confidence, 3),
                    "bbox": {
                        "top_left": bbox[0],
                        "top_right": bbox[1],
                        "bottom_right": bbox[2],
                        "bottom_left": bbox[3]
                    },
                    "center": {
                        "x": (bbox[0][0] + bbox[2][0]) / 2,
                        "y": (bbox[0][1] + bbox[2][1]) / 2
                    }
                }
                
                text_blocks.append(text_block)
                text_lines.append(text)
        
        return {
            "page_number": page_number,
            "text": "\n".join(text_lines),
            "text_blocks": text_blocks,
            "total_blocks": len(text_blocks)
        }
    
    def _parse_invoice_fields(self, structured_data: Dict[str, Any]) -> Dict[str, Any]:
        """Parse common invoice fields from structured OCR data"""
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
        
        # Get all text blocks
        all_blocks = []
        if "pages" in structured_data:
            for page in structured_data["pages"]:
                all_blocks.extend(page.get("text_blocks", []))
        else:
            all_blocks = structured_data.get("text_blocks", [])
        
        # Define patterns for common invoice fields
        import re
        
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
        
        # Search for patterns in text blocks
        for block in all_blocks:
            text = block["text"].lower()
            
            for field_name, field_patterns in patterns.items():
                if invoice_fields[field_name] is None:  # Only set if not already found
                    for pattern in field_patterns:
                        match = re.search(pattern, text, re.IGNORECASE)
                        if match:
                            invoice_fields[field_name] = {
                                "value": match.group(1),
                                "confidence": block["confidence"],
                                "bbox": block["bbox"],
                                "raw_text": block["text"]
                            }
                            break
            
            # Store all fields for reference
            invoice_fields["raw_fields"].append({
                "text": block["text"],
                "confidence": block["confidence"],
                "bbox": block["bbox"]
            })
        
        return invoice_fields
    
    def validate_file(self, file_path: str, max_size_mb: int = 10) -> Tuple[bool, str]:
        """
        Validate uploaded file
        
        Args:
            file_path: Path to the file
            max_size_mb: Maximum file size in MB
            
        Returns:
            Tuple of (is_valid, error_message)
        """
        try:
            # Check if file exists
            if not os.path.exists(file_path):
                return False, "File not found"
            
            # Check file size
            file_size = os.path.getsize(file_path)
            if file_size > max_size_mb * 1024 * 1024:
                return False, f"File size exceeds {max_size_mb}MB limit"
            
            # Check file extension
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
            
            # For images, get dimensions
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

# Create service instance with error handling
try:
    ocr_service = PaddleOCRService()
    logger.info("PaddleOCR service created successfully")
except Exception as e:
    logger.error(f"Failed to create PaddleOCR service: {e}")
    # Create a dummy service that will raise errors when used
    class DummyOCRService:
        def __init__(self):
            self.error_message = str(e)
        
        def extract_text_from_file(self, *args, **kwargs):
            return False, "", f"OCR service not available: {self.error_message}"
        
        def extract_structured_data(self, *args, **kwargs):
            return False, {}, f"OCR service not available: {self.error_message}"
        
        def extract_invoice_fields(self, *args, **kwargs):
            return False, {}, f"OCR service not available: {self.error_message}"
        
        def validate_file(self, *args, **kwargs):
            return False, f"OCR service not available: {self.error_message}"
        
        def get_file_info(self, *args, **kwargs):
            return {}
    
    ocr_service = DummyOCRService()
