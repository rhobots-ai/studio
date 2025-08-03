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

from services.ocr_service import ocr_service
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

@router.get("/documents")
async def list_uploaded_documents():
    """
    List all uploaded documents
    """
    documents = []
    for file_id, doc_info in uploaded_documents.items():
        documents.append({
            'file_id': file_id,
            'filename': doc_info['original_filename'],
            'file_type': doc_info['file_type'],
            'upload_time': doc_info['upload_time'],
            'text_length': len(doc_info['ocr_text']),
            'file_info': doc_info['file_info']
        })
    
    return {
        'success': True,
        'documents': documents,
        'total': len(documents)
    }
