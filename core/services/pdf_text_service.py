"""
PDF Text Extraction Service using PyMuPDF
Simple, fast, and accurate text extraction from PDF files
"""

import os
import tempfile
import uuid
from typing import Tuple, Optional, List, Dict, Any
from PIL import Image
import logging
import json
import fitz  # PyMuPDF

logger = logging.getLogger(__name__)

class PDFTextService:
    def __init__(self):
        """Initialize PDF text extraction service"""
        logger.info("PDF text extraction service initialized with PyMuPDF")
    
    def extract_text_from_file(self, file_path: str, file_type: str) -> Tuple[bool, str, str]:
        """
        Extract text from uploaded file using PyMuPDF for PDFs
        
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
            logger.error(f"Text extraction failed: {str(e)}")
            return False, "", f"Text extraction failed: {str(e)}"
    
    def extract_structured_data(self, file_path: str, file_type: str) -> Tuple[bool, Dict[str, Any], str]:
        """
        Extract structured data with basic text blocks
        
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
            logger.error(f"Structured text extraction failed: {str(e)}")
            return False, {}, f"Structured text extraction failed: {str(e)}"
    
    def extract_invoice_fields(self, file_path: str, file_type: str) -> Tuple[bool, Dict[str, Any], str]:
        """
        Extract common invoice fields using basic text analysis
        
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
        """Extract text from PDF file using PyMuPDF"""
        try:
            logger.info(f"Extracting text from PDF: {pdf_path}")
            
            # Open PDF with PyMuPDF
            doc = fitz.open(pdf_path)
            
            extracted_texts = []
            for page_num in range(len(doc)):
                page = doc.load_page(page_num)
                
                # Extract text from page
                page_text = page.get_text()
                
                logger.info(f"Page {page_num + 1} extracted {len(page_text)} characters")
                
                if page_text.strip():
                    extracted_texts.append(f"--- Page {page_num + 1} ---\n{page_text.strip()}")
                else:
                    logger.warning(f"No text found on page {page_num + 1}")
            
            doc.close()
            
            if extracted_texts:
                full_text = "\n\n".join(extracted_texts)
                logger.info(f"Total extracted text length: {len(full_text)} characters")
                return True, full_text, ""
            else:
                return False, "", "No text could be extracted from the PDF"
                
        except Exception as e:
            logger.error(f"PDF text extraction failed: {str(e)}")
            return False, "", f"PDF processing failed: {str(e)}"
    
    def _extract_from_image(self, image_path: str) -> Tuple[bool, str, str]:
        """Extract text from image file - basic implementation"""
        try:
            # For now, we don't support image text extraction without OCR
            # You could add basic PIL text detection here if needed
            return False, "", "Image text extraction not supported without OCR. Please use PDF files."
                
        except Exception as e:
            logger.error(f"Image text extraction failed: {str(e)}")
            return False, "", f"Image processing failed: {str(e)}"
    
    def _extract_structured_from_pdf(self, pdf_path: str) -> Tuple[bool, Dict[str, Any], str]:
        """Extract structured data from PDF file"""
        try:
            doc = fitz.open(pdf_path)
            
            all_pages_data = []
            for page_num in range(len(doc)):
                page = doc.load_page(page_num)
                page_text = page.get_text()
                
                # Create basic structured data
                text_blocks = []
                if page_text.strip():
                    # Split text into lines for basic structure
                    lines = page_text.strip().split('\n')
                    for i, line in enumerate(lines):
                        if line.strip():
                            text_blocks.append({
                                "text": line.strip(),
                                "confidence": 1.0,  # PyMuPDF gives us actual text, so confidence is 100%
                                "line_number": i + 1
                            })
                
                page_data = {
                    "page_number": page_num + 1,
                    "text": page_text.strip(),
                    "text_blocks": text_blocks,
                    "total_blocks": len(text_blocks)
                }
                all_pages_data.append(page_data)
            
            doc.close()
            
            structured_data = {
                "total_pages": len(all_pages_data),
                "pages": all_pages_data,
                "combined_text": "\n\n".join([page["text"] for page in all_pages_data if page["text"]])
            }
            
            return True, structured_data, ""
            
        except Exception as e:
            logger.error(f"Structured PDF extraction failed: {str(e)}")
            return False, {}, f"Structured PDF processing failed: {str(e)}"
    
    def _extract_structured_from_image(self, image_path: str) -> Tuple[bool, Dict[str, Any], str]:
        """Extract structured data from image file"""
        try:
            # For now, we don't support image text extraction
            return False, {}, "Image text extraction not supported without OCR. Please use PDF files."
            
        except Exception as e:
            logger.error(f"Structured image extraction failed: {str(e)}")
            return False, {}, f"Structured image processing failed: {str(e)}"
    
    def _parse_invoice_fields(self, structured_data: Dict[str, Any]) -> Dict[str, Any]:
        """Parse common invoice fields from structured text data"""
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
                                "confidence": block.get("confidence", 1.0),
                                "raw_text": block["text"]
                            }
                            break
            
            # Store all fields for reference
            invoice_fields["raw_fields"].append({
                "text": block["text"],
                "confidence": block.get("confidence", 1.0)
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

# Create service instance
try:
    text_service = PDFTextService()
    logger.info("PDF text service created successfully")
except Exception as e:
    logger.error(f"Failed to create PDF text service: {e}")
    
    # Create a dummy service that will raise errors when used
    class DummyTextService:
        def __init__(self):
            self.error_message = f"PDF text service failed: {str(e)}"
        
        def extract_text_from_file(self, *args, **kwargs):
            return False, "", f"Text service not available: {self.error_message}"
        
        def extract_structured_data(self, *args, **kwargs):
            return False, {}, f"Text service not available: {self.error_message}"
        
        def extract_invoice_fields(self, *args, **kwargs):
            return False, {}, f"Text service not available: {self.error_message}"
        
        def validate_file(self, *args, **kwargs):
            return False, f"Text service not available: {self.error_message}"
        
        def get_file_info(self, *args, **kwargs):
            return {}
    
    text_service = DummyTextService()

# For backward compatibility, create an alias
ocr_service = text_service
