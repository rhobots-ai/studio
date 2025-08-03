"""
API routes for chat functionality with document upload and OCR support
"""

from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Request
from fastapi.responses import StreamingResponse
from typing import Optional
import tempfile
import os
import uuid
import json
from datetime import datetime
import asyncio
import logging

from services.pdf_text_service import text_service as ocr_service
from model_manager import model_manager

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/chat", tags=["chat"])

# Store uploaded documents temporarily (in production, use a proper database)
uploaded_documents = {}

@router.post("/upload-document")
async def upload_document_for_chat(file: UploadFile = File(...)):
    """
    Upload a document for chat context with OCR processing
    """
    try:
        # Validate file type
        allowed_types = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png']
        if file.content_type not in allowed_types:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file type: {file.content_type}. Allowed types: PDF, JPG, PNG"
            )
        
        # Generate unique file ID
        file_id = str(uuid.uuid4())
        
        # Create temporary file
        temp_dir = tempfile.mkdtemp()
        file_extension = os.path.splitext(file.filename)[1].lower()
        temp_file_path = os.path.join(temp_dir, f"{file_id}{file_extension}")
        
        # Save uploaded file
        with open(temp_file_path, "wb") as buffer:
            content = await file.read()
            buffer.write(content)
        
        # Validate file
        is_valid, validation_error = ocr_service.validate_file(temp_file_path)
        if not is_valid:
            # Clean up temp file
            if os.path.exists(temp_file_path):
                os.remove(temp_file_path)
            if os.path.exists(temp_dir):
                os.rmdir(temp_dir)
            
            raise HTTPException(status_code=400, detail=validation_error)
        
        # Get file info
        file_info = ocr_service.get_file_info(temp_file_path)
        
        # Extract file type for OCR
        file_type = file_extension[1:]  # Remove the dot
        
        # Perform OCR
        logger.info(f"Starting OCR processing for file: {file.filename}")
        success, extracted_text, error_message = ocr_service.extract_text_from_file(temp_file_path, file_type)
        
        # Clean up temp file
        if os.path.exists(temp_file_path):
            os.remove(temp_file_path)
        if os.path.exists(temp_dir):
            os.rmdir(temp_dir)
        
        if not success:
            raise HTTPException(status_code=500, detail=f"OCR processing failed: {error_message}")
        
        # Store document info (in production, use a proper database)
        document_info = {
            'file_id': file_id,
            'original_filename': file.filename,
            'file_type': file_type,
            'file_info': file_info,
            'ocr_text': extracted_text,
            'upload_time': datetime.now().isoformat(),
            'content_type': file.content_type
        }
        
        uploaded_documents[file_id] = document_info
        
        logger.info(f"OCR processing completed for file: {file.filename}, extracted {len(extracted_text)} characters")
        
        return {
            'success': True,
            'fileId': file_id,
            'file_id': file_id,  # Alternative key for compatibility
            'ocrText': extracted_text,
            'ocr_text': extracted_text,  # Alternative key for compatibility
            'message': f'Document "{file.filename}" processed successfully',
            'file_info': file_info,
            'text_length': len(extracted_text)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Document upload failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Document upload failed: {str(e)}")

@router.get("/document/{file_id}")
async def get_document_info(file_id: str):
    """
    Get information about an uploaded document
    """
    if file_id not in uploaded_documents:
        raise HTTPException(status_code=404, detail="Document not found")
    
    document_info = uploaded_documents[file_id]
    return {
        'success': True,
        'document': document_info
    }

@router.delete("/document/{file_id}")
async def delete_document(file_id: str):
    """
    Delete an uploaded document
    """
    if file_id not in uploaded_documents:
        raise HTTPException(status_code=404, detail="Document not found")
    
    del uploaded_documents[file_id]
    return {
        'success': True,
        'message': 'Document deleted successfully'
    }

@router.post("/single")
async def chat_single_message(request: Request):
    """
    Send a single message to the model
    """
    try:
        body = await request.json()
        message = body.get('message', '')
        max_tokens = body.get('max_tokens', 256)
        temperature = body.get('temperature', 0.7)
        system_prompt = body.get('system_prompt', '')
        
        if not message.strip():
            raise HTTPException(status_code=400, detail="Message cannot be empty")
        
        # Check if model is loaded
        if not model_manager.is_model_loaded():
            raise HTTPException(status_code=400, detail="No model is currently loaded")
        
        # Generate response
        response = await model_manager.generate_response_async(
            message=message,
            max_tokens=max_tokens,
            temperature=temperature,
            system_prompt=system_prompt if system_prompt.strip() else None
        )
        
        return {
            'success': True,
            'response': response.get('response', ''),
            'message': response.get('response', ''),  # Alternative key for compatibility
            'prompt': message,
            'parameters': {
                'max_tokens': max_tokens,
                'temperature': temperature,
                'system_prompt': system_prompt if system_prompt.strip() else None
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Single chat failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Chat failed: {str(e)}")

@router.post("/stream")
async def chat_stream(request: Request):
    """
    Stream chat responses from the model
    """
    try:
        body = await request.json()
        message = body.get('message', '')
        max_tokens = body.get('max_tokens', 256)
        temperature = body.get('temperature', 0.7)
        system_prompt = body.get('system_prompt', '')
        
        if not message.strip():
            raise HTTPException(status_code=400, detail="Message cannot be empty")
        
        # Check if model is loaded
        if not model_manager.is_model_loaded():
            raise HTTPException(status_code=400, detail="No model is currently loaded")
        
        async def generate_stream():
            try:
                # Generate streaming response
                async for chunk in model_manager.generate_streaming_response(
                    message=message,
                    max_tokens=max_tokens,
                    temperature=temperature,
                    system_prompt=system_prompt if system_prompt.strip() else None
                ):
                    # Send chunk as JSON
                    chunk_data = {
                        'token': chunk.get('token', ''),
                        'done': chunk.get('done', False),
                        'status': 'streaming' if not chunk.get('done', False) else 'completed'
                    }
                    yield f"data: {json.dumps(chunk_data)}\n\n"
                
                # Send completion signal
                yield f"data: {json.dumps({'token': '', 'done': True, 'status': 'completed'})}\n\n"
                yield "data: [DONE]\n\n"
                
            except Exception as e:
                logger.error(f"Streaming error: {str(e)}")
                error_data = {
                    'error': str(e),
                    'done': True,
                    'status': 'error'
                }
                yield f"data: {json.dumps(error_data)}\n\n"
        
        return StreamingResponse(
            generate_stream(),
            media_type="text/plain",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "Content-Type": "text/plain; charset=utf-8"
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Stream chat failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Stream chat failed: {str(e)}")

@router.post("/conversation")
async def chat_conversation(request: Request):
    """
    Send a conversation (multiple messages) to the model
    """
    try:
        body = await request.json()
        messages = body.get('messages', [])
        max_tokens = body.get('max_tokens', 256)
        temperature = body.get('temperature', 0.7)
        
        if not messages or not isinstance(messages, list):
            raise HTTPException(status_code=400, detail="Messages must be a non-empty list")
        
        # Check if model is loaded
        if not model_manager.is_model_loaded():
            raise HTTPException(status_code=400, detail="No model is currently loaded")
        
        # Format conversation into a single prompt
        conversation_text = ""
        for msg in messages:
            role = msg.get('role', 'user')
            content = msg.get('content', '')
            if role == 'system':
                conversation_text += f"System: {content}\n"
            elif role == 'user':
                conversation_text += f"User: {content}\n"
            elif role == 'assistant':
                conversation_text += f"Assistant: {content}\n"
        
        conversation_text += "Assistant: "
        
        # Generate response
        response = await model_manager.generate_response_async(
            message=conversation_text,
            max_tokens=max_tokens,
            temperature=temperature
        )
        
        return {
            'success': True,
            'response': response.get('response', ''),
            'message': response.get('response', ''),  # Alternative key for compatibility
            'conversation_length': len(messages)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Conversation chat failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Conversation chat failed: {str(e)}")

@router.get("/quick")
async def quick_chat(q: str, max_tokens: int = 256, temperature: float = 0.7):
    """
    Quick chat endpoint for simple queries
    """
    try:
        if not q.strip():
            raise HTTPException(status_code=400, detail="Query parameter 'q' cannot be empty")
        
        # Check if model is loaded
        if not model_manager.is_model_loaded():
            raise HTTPException(status_code=400, detail="No model is currently loaded")
        
        # Generate response
        response = await model_manager.generate_response_async(
            message=q,
            max_tokens=max_tokens,
            temperature=temperature
        )
        
        return {
            'success': True,
            'response': response.get('response', ''),
            'message': response.get('response', ''),  # Alternative key for compatibility
            'query': q
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Quick chat failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Quick chat failed: {str(e)}")

@router.post("/upload-document-structured")
async def upload_document_with_structured_extraction(file: UploadFile = File(...)):
    """
    Upload a document and extract structured data with bounding boxes and confidence scores
    """
    try:
        # Validate file type
        allowed_types = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png']
        if file.content_type not in allowed_types:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file type: {file.content_type}. Allowed types: PDF, JPG, PNG"
            )
        
        # Generate unique file ID
        file_id = str(uuid.uuid4())
        
        # Create temporary file
        temp_dir = tempfile.mkdtemp()
        file_extension = os.path.splitext(file.filename)[1].lower()
        temp_file_path = os.path.join(temp_dir, f"{file_id}{file_extension}")
        
        # Save uploaded file
        with open(temp_file_path, "wb") as buffer:
            content = await file.read()
            buffer.write(content)
        
        # Validate file
        is_valid, validation_error = ocr_service.validate_file(temp_file_path)
        if not is_valid:
            # Clean up temp file
            if os.path.exists(temp_file_path):
                os.remove(temp_file_path)
            if os.path.exists(temp_dir):
                os.rmdir(temp_dir)
            
            raise HTTPException(status_code=400, detail=validation_error)
        
        # Get file info
        file_info = ocr_service.get_file_info(temp_file_path)
        
        # Extract file type for OCR
        file_type = file_extension[1:]  # Remove the dot
        
        # Perform structured OCR
        logger.info(f"Starting structured OCR processing for file: {file.filename}")
        success, structured_data, error_message = ocr_service.extract_structured_data(temp_file_path, file_type)
        
        # Clean up temp file
        if os.path.exists(temp_file_path):
            os.remove(temp_file_path)
        if os.path.exists(temp_dir):
            os.rmdir(temp_dir)
        
        if not success:
            raise HTTPException(status_code=500, detail=f"Structured OCR processing failed: {error_message}")
        
        # Store document info with structured data
        document_info = {
            'file_id': file_id,
            'original_filename': file.filename,
            'file_type': file_type,
            'file_info': file_info,
            'structured_data': structured_data,
            'ocr_text': structured_data.get('combined_text', '') if 'combined_text' in structured_data else structured_data.get('text', ''),
            'upload_time': datetime.now().isoformat(),
            'content_type': file.content_type,
            'extraction_type': 'structured'
        }
        
        uploaded_documents[file_id] = document_info
        
        logger.info(f"Structured OCR processing completed for file: {file.filename}")
        
        return {
            'success': True,
            'fileId': file_id,
            'file_id': file_id,
            'structuredData': structured_data,
            'structured_data': structured_data,
            'message': f'Document "{file.filename}" processed with structured extraction',
            'file_info': file_info,
            'total_blocks': structured_data.get('total_blocks', 0) if 'total_blocks' in structured_data else sum(page.get('total_blocks', 0) for page in structured_data.get('pages', []))
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Structured document upload failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Structured document upload failed: {str(e)}")

@router.post("/extract-invoice-fields")
async def extract_invoice_fields_from_upload(file: UploadFile = File(...)):
    """
    Upload a document and extract common invoice fields (invoice_no, date, GSTIN, amount)
    """
    try:
        # Validate file type
        allowed_types = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png']
        if file.content_type not in allowed_types:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file type: {file.content_type}. Allowed types: PDF, JPG, PNG"
            )
        
        # Generate unique file ID
        file_id = str(uuid.uuid4())
        
        # Create temporary file
        temp_dir = tempfile.mkdtemp()
        file_extension = os.path.splitext(file.filename)[1].lower()
        temp_file_path = os.path.join(temp_dir, f"{file_id}{file_extension}")
        
        # Save uploaded file
        with open(temp_file_path, "wb") as buffer:
            content = await file.read()
            buffer.write(content)
        
        # Validate file
        is_valid, validation_error = ocr_service.validate_file(temp_file_path)
        if not is_valid:
            # Clean up temp file
            if os.path.exists(temp_file_path):
                os.remove(temp_file_path)
            if os.path.exists(temp_dir):
                os.rmdir(temp_dir)
            
            raise HTTPException(status_code=400, detail=validation_error)
        
        # Get file info
        file_info = ocr_service.get_file_info(temp_file_path)
        
        # Extract file type for OCR
        file_type = file_extension[1:]  # Remove the dot
        
        # Perform invoice field extraction
        logger.info(f"Starting invoice field extraction for file: {file.filename}")
        success, invoice_data, error_message = ocr_service.extract_invoice_fields(temp_file_path, file_type)
        
        # Clean up temp file
        if os.path.exists(temp_file_path):
            os.remove(temp_file_path)
        if os.path.exists(temp_dir):
            os.rmdir(temp_dir)
        
        if not success:
            raise HTTPException(status_code=500, detail=f"Invoice field extraction failed: {error_message}")
        
        # Store document info with invoice data
        document_info = {
            'file_id': file_id,
            'original_filename': file.filename,
            'file_type': file_type,
            'file_info': file_info,
            'invoice_data': invoice_data,
            'upload_time': datetime.now().isoformat(),
            'content_type': file.content_type,
            'extraction_type': 'invoice_fields'
        }
        
        uploaded_documents[file_id] = document_info
        
        logger.info(f"Invoice field extraction completed for file: {file.filename}")
        
        # Format extracted fields for easy access
        extracted_fields = {}
        for field_name, field_data in invoice_data.items():
            if field_data and field_name != 'raw_fields':
                if isinstance(field_data, dict) and 'value' in field_data:
                    extracted_fields[field_name] = field_data['value']
                else:
                    extracted_fields[field_name] = field_data
        
        return {
            'success': True,
            'fileId': file_id,
            'file_id': file_id,
            'invoiceData': invoice_data,
            'invoice_data': invoice_data,
            'extractedFields': extracted_fields,
            'extracted_fields': extracted_fields,
            'message': f'Invoice fields extracted from "{file.filename}"',
            'file_info': file_info,
            'fields_found': len([f for f in extracted_fields.values() if f is not None])
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Invoice field extraction failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Invoice field extraction failed: {str(e)}")

@router.post("/extract-invoice-with-model")
async def extract_invoice_with_trained_model(file: UploadFile = File(...)):
    """
    Upload a document and extract invoice fields using the trained model
    This endpoint uses OCR + your trained model with the exact instruction format
    """
    try:
        # Validate file type
        allowed_types = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png']
        if file.content_type not in allowed_types:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file type: {file.content_type}. Allowed types: PDF, JPG, PNG"
            )
        
        # Check if model is loaded
        if not model_manager.is_model_loaded():
            raise HTTPException(status_code=400, detail="No model is currently loaded. Please load a model first.")
        
        # Generate unique file ID
        file_id = str(uuid.uuid4())
        
        # Create temporary file
        temp_dir = tempfile.mkdtemp()
        file_extension = os.path.splitext(file.filename)[1].lower()
        temp_file_path = os.path.join(temp_dir, f"{file_id}{file_extension}")
        
        # Save uploaded file
        with open(temp_file_path, "wb") as buffer:
            content = await file.read()
            buffer.write(content)
        
        # Validate file
        is_valid, validation_error = ocr_service.validate_file(temp_file_path)
        if not is_valid:
            # Clean up temp file
            if os.path.exists(temp_file_path):
                os.remove(temp_file_path)
            if os.path.exists(temp_dir):
                os.rmdir(temp_dir)
            
            raise HTTPException(status_code=400, detail=validation_error)
        
        # Get file info
        file_info = ocr_service.get_file_info(temp_file_path)
        
        # Extract file type for OCR
        file_type = file_extension[1:]  # Remove the dot
        
        # Perform OCR to get raw text
        logger.info(f"Starting OCR processing for file: {file.filename}")
        success, extracted_text, error_message = ocr_service.extract_text_from_file(temp_file_path, file_type)
        
        # Clean up temp file
        if os.path.exists(temp_file_path):
            os.remove(temp_file_path)
        if os.path.exists(temp_dir):
            os.rmdir(temp_dir)
        
        if not success:
            raise HTTPException(status_code=500, detail=f"OCR processing failed: {error_message}")
        
        # Create the instruction-input format exactly as your training data
        instruction = "You are an accountant examining invoices. you need to extract the following values from the invoice.:\\n1) invoice_number: this is the invoice number also sometimes referred to as invoice no. or invoice serial number or e-Way Bill No or bill no or PO number or purchase order number or invoice sr. no or invoice serial no or invoice serial number. if not found please keep the field null. \\n2) invoice_date: invoice_date should be formatted as python date as YYYY-MM-DD. In case of ambiguous dates please assume that day date is always written before month. If the years don't include the 21st century, please add the 21st century.\\n3) invoice_amount: this is the invoice amount. response should be in float format. \\n4) buyer_gstin: gstin of the buyer or party to which the invoice was raise. buyer_gstin is always matching the regex: \\\\d{2}[A-Z]{5}\\\\d{4}[A-Z]{1}[A-Z\\\\d]{1}Z[A-Z\\\\d]{1}\\n5) seller_gstin: gstin of the seller or party which is is raising the invoice. seller_gstin is always matching the regex: \\\\d{2}[A-Z]{5}\\\\d{4}[A-Z]{1}[A-Z\\\\d]{1}Z[A-Z\\\\d]{1}\\n\\nPlease follow the provided instructions:\\na) maintain variable names exactly as written above\\nb) return the response as a json object\\nc) return only the json object and no other text.      \\nd) provide only the json object and nothing else."
        
        # Create the input with raw OCR text
        model_input = {
            "raw_text": extracted_text
        }
        
        # Format as proper JSON structure like your training data
        training_format = {
            "instruction": instruction,
            "input": model_input
        }
        
        # Convert to JSON string for the model
        formatted_message = json.dumps(training_format)
        
        logger.info(f"Sending OCR text to trained model for invoice field extraction")
        
        # Send to your trained model
        model_response = await model_manager.generate_response_async(
            message=formatted_message,
            max_tokens=512,  # Enough for JSON response
            temperature=0.1,  # Low temperature for consistent structured output
            do_sample=True
        )
        
        if model_response.get('status') != 'success':
            raise HTTPException(
                status_code=500, 
                detail=f"Model inference failed: {model_response.get('message', 'Unknown error')}"
            )
        
        # Get the model's response
        model_output = model_response.get('response', '')
        
        # Try to parse the JSON response from the model
        try:
            # The model should return pure JSON, but let's handle potential formatting issues
            model_output_clean = model_output.strip()
            
            # Remove any potential markdown formatting
            if model_output_clean.startswith('```json'):
                model_output_clean = model_output_clean[7:]
            if model_output_clean.endswith('```'):
                model_output_clean = model_output_clean[:-3]
            
            model_output_clean = model_output_clean.strip()
            
            # Parse the JSON
            extracted_fields = json.loads(model_output_clean)
            
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse model JSON response: {model_output}")
            # Return the raw response if JSON parsing fails
            extracted_fields = {
                "error": "Failed to parse model response as JSON",
                "raw_response": model_output,
                "parse_error": str(e)
            }
        
        # Store document info
        document_info = {
            'file_id': file_id,
            'original_filename': file.filename,
            'file_type': file_type,
            'file_info': file_info,
            'ocr_text': extracted_text,
            'model_response': model_output,
            'extracted_fields': extracted_fields,
            'upload_time': datetime.now().isoformat(),
            'content_type': file.content_type,
            'extraction_type': 'model_based',
            'instruction_used': instruction
        }
        
        uploaded_documents[file_id] = document_info
        
        logger.info(f"Model-based invoice field extraction completed for file: {file.filename}")
        
        return {
            'success': True,
            'fileId': file_id,
            'file_id': file_id,
            'extractedFields': extracted_fields,
            'extracted_fields': extracted_fields,
            'modelResponse': model_output,
            'model_response': model_output,
            'ocrText': extracted_text,
            'ocr_text': extracted_text,
            'message': f'Invoice fields extracted from "{file.filename}" using trained model',
            'file_info': file_info,
            'text_length': len(extracted_text),
            'extraction_method': 'trained_model'
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Model-based invoice extraction failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Model-based invoice extraction failed: {str(e)}")

@router.get("/documents")
async def list_uploaded_documents():
    """
    List all uploaded documents
    """
    documents = []
    for file_id, doc_info in uploaded_documents.items():
        document_summary = {
            'file_id': file_id,
            'filename': doc_info['original_filename'],
            'file_type': doc_info['file_type'],
            'upload_time': doc_info['upload_time'],
            'extraction_type': doc_info.get('extraction_type', 'basic'),
            'file_info': doc_info['file_info']
        }
        
        # Add type-specific information
        if doc_info.get('extraction_type') == 'structured':
            structured_data = doc_info.get('structured_data', {})
            document_summary['total_blocks'] = structured_data.get('total_blocks', 0) if 'total_blocks' in structured_data else sum(page.get('total_blocks', 0) for page in structured_data.get('pages', []))
            document_summary['text_length'] = len(structured_data.get('combined_text', '') if 'combined_text' in structured_data else structured_data.get('text', ''))
        elif doc_info.get('extraction_type') == 'invoice_fields':
            invoice_data = doc_info.get('invoice_data', {})
            extracted_fields = {k: v['value'] if isinstance(v, dict) and 'value' in v else v 
                              for k, v in invoice_data.items() 
                              if v and k != 'raw_fields'}
            document_summary['fields_extracted'] = len([f for f in extracted_fields.values() if f is not None])
            document_summary['extracted_fields'] = extracted_fields
        elif doc_info.get('extraction_type') == 'model_based':
            extracted_fields = doc_info.get('extracted_fields', {})
            document_summary['extracted_fields'] = extracted_fields
            document_summary['extraction_method'] = 'trained_model'
            document_summary['model_response_length'] = len(doc_info.get('model_response', ''))
        else:
            document_summary['text_length'] = len(doc_info.get('ocr_text', ''))
    
        documents.append(document_summary)
    
    return {
        'success': True,
        'documents': documents,
        'total': len(documents)
    }
