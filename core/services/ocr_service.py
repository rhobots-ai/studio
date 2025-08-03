"""
OCR Service for document text extraction
Supports PDF, JPG, PNG files with Tesseract OCR
"""

import os
import tempfile
import uuid
from typing import Tuple, Optional
from PIL import Image
import pytesseract
import cv2
import numpy as np
from pdf2image import convert_from_path
import logging

logger = logging.getLogger(__name__)

class OCRService:
    def __init__(self):
        # Configure Tesseract path if needed (for Windows)
        # pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'
        pass
    
    def extract_text_from_file(self, file_path: str, file_type: str) -> Tuple[bool, str, str]:
        """
        Extract text from uploaded file using OCR
        
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
    
    def _extract_from_pdf(self, pdf_path: str) -> Tuple[bool, str, str]:
        """Extract text from PDF file"""
        try:
            # Convert PDF to images
            images = convert_from_path(pdf_path, dpi=300)
            
            extracted_texts = []
            for i, image in enumerate(images):
                # Preprocess image for better OCR
                processed_image = self._preprocess_image(np.array(image))
                
                # Extract text using Tesseract
                text = pytesseract.image_to_string(
                    processed_image, 
                    config='--oem 3 --psm 6'  # OCR Engine Mode 3, Page Segmentation Mode 6
                )
                
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
        """Extract text from image file"""
        try:
            # Load image
            image = cv2.imread(image_path)
            if image is None:
                return False, "", "Could not load image file"
            
            # Preprocess image for better OCR
            processed_image = self._preprocess_image(image)
            
            # Extract text using Tesseract
            text = pytesseract.image_to_string(
                processed_image, 
                config='--oem 3 --psm 6'
            )
            
            if text.strip():
                return True, text.strip(), ""
            else:
                return False, "", "No text could be extracted from the image"
                
        except Exception as e:
            logger.error(f"Image OCR failed: {str(e)}")
            return False, "", f"Image processing failed: {str(e)}"
    
    def _preprocess_image(self, image: np.ndarray) -> np.ndarray:
        """
        Preprocess image to improve OCR accuracy
        """
        try:
            # Convert to grayscale if needed
            if len(image.shape) == 3:
                gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
            else:
                gray = image
            
            # Apply denoising
            denoised = cv2.fastNlMeansDenoising(gray)
            
            # Apply adaptive thresholding to handle varying lighting
            thresh = cv2.adaptiveThreshold(
                denoised, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 11, 2
            )
            
            # Optional: Apply morphological operations to clean up the image
            kernel = np.ones((1, 1), np.uint8)
            processed = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel)
            
            return processed
            
        except Exception as e:
            logger.warning(f"Image preprocessing failed, using original: {str(e)}")
            return image
    
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

# Global OCR service instance
ocr_service = OCRService()
