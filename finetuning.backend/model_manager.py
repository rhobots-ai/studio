import os
import json
import torch
import gc
from typing import Optional, Dict, Any, List
from datetime import datetime
from unsloth import FastLanguageModel
from transformers import TextStreamer, TextIteratorStreamer
import gc
from threading import Thread
from vllm import SamplingParams
from vllm import LLM

class ModelManager:
    """Manages loading, unloading, and inference with fine-tuned models"""
    
    def __init__(self):
        self.current_model = None
        self.current_tokenizer = None
        self.current_model_path = None
        self.model_metadata = {}
        self.is_huggingface_model = False
        
    def get_available_models(self) -> List[Dict[str, Any]]:
        """Scan for available trained models"""
        models = []
        
        # Check default results directory
        results_dir = "./results"
        if os.path.exists(results_dir):
            for item in os.listdir(results_dir):
                model_path = os.path.join(results_dir, item)
                if os.path.isdir(model_path):
                    # Check if it's a valid model directory
                    if self._is_valid_model_dir(model_path):
                        metadata = self._get_model_metadata(model_path)
                        models.append({
                            "name": item,
                            "path": model_path,
                            "size_mb": self._get_directory_size(model_path),
                            "created_at": metadata.get("created_at"),
                            "training_config": metadata.get("config", {})
                        })
        
        # Check for lora_model directory (common output)
        lora_model_path = "./lora_model"
        if os.path.exists(lora_model_path) and self._is_valid_model_dir(lora_model_path):
            metadata = self._get_model_metadata(lora_model_path)
            models.append({
                "name": "lora_model",
                "path": lora_model_path,
                "size_mb": self._get_directory_size(lora_model_path),
                "created_at": metadata.get("created_at"),
                "training_config": metadata.get("config", {})
            })
            
        return models
    
    def _is_valid_model_dir(self, path: str) -> bool:
        """Check if directory contains a valid model"""
        required_files = ["adapter_config.json", "adapter_model.safetensors"]
        return all(os.path.exists(os.path.join(path, f)) for f in required_files)
    
    def _get_model_metadata(self, model_path: str) -> Dict[str, Any]:
        """Extract metadata from model directory"""
        metadata = {}
        
        # Try to read adapter config
        config_path = os.path.join(model_path, "adapter_config.json")
        if os.path.exists(config_path):
            try:
                with open(config_path, 'r') as f:
                    adapter_config = json.load(f)
                    metadata["adapter_config"] = adapter_config
            except:
                pass
        
        # Get creation time
        try:
            stat = os.stat(model_path)
            metadata["created_at"] = datetime.fromtimestamp(stat.st_mtime).isoformat()
        except:
            pass
            
        return metadata
    
    def _get_directory_size(self, path: str) -> float:
        """Get directory size in MB"""
        total_size = 0
        try:
            for dirpath, dirnames, filenames in os.walk(path):
                for filename in filenames:
                    filepath = os.path.join(dirpath, filename)
                    if os.path.exists(filepath):
                        total_size += os.path.getsize(filepath)
            return round(total_size / (1024 * 1024), 2)  # Convert to MB
        except:
            return 0.0
    
    def _is_huggingface_model_id(self, model_path: str) -> bool:
        """Check if the model path is a Hugging Face model ID"""
        # HF model IDs contain '/' and don't start with './' or '/'
        return '/' in model_path and not model_path.startswith('./') and not model_path.startswith('/')

    def load_model(self, model_path: str, max_seq_length: int = 2048) -> Dict[str, Any]:
        """Load a model using unsloth (works for both local fine-tuned and Hugging Face models)"""
        try:
            # Unload current model first
            if self.current_model is not None:
                self.unload_model()
            
            # Determine if it's a Hugging Face model ID or local path
            is_hf_model = self._is_huggingface_model_id(model_path)
            
            # For local models, validate the path exists
            if not is_hf_model:
                if not os.path.exists(model_path):
                    raise ValueError(f"Model path does not exist: {model_path}")
                
                if not self._is_valid_model_dir(model_path):
                    raise ValueError(f"Invalid model directory: {model_path}")
            
            print(f"Loading {'Hugging Face' if is_hf_model else 'local'} model: {model_path}")
            
            # Use unsloth for both local and Hugging Face models
            model, tokenizer = FastLanguageModel.from_pretrained(
                model_name=model_path,  # Works for both "./results/model" and "microsoft/Phi-3-mini"
                max_seq_length=max_seq_length,
                dtype=None,
                load_in_4bit=True,
            )
            
            # Enable inference mode
            FastLanguageModel.for_inference(model)
            
            # Note: Unsloth automatically handles device placement for quantized models
            # Manual .cuda() calls are not needed and will cause errors with quantized models
            
            self.current_model = model
            self.current_tokenizer = tokenizer
            self.current_model_path = model_path
            self.is_huggingface_model = is_hf_model
            
            # Set metadata based on model type
            if is_hf_model:
                self.model_metadata = {
                    "model_type": "huggingface",
                    "model_id": model_path,
                    "loaded_at": datetime.now().isoformat()
                }
            else:
                self.model_metadata = self._get_model_metadata(model_path)
            
            model_type = "Hugging Face" if is_hf_model else "local"
            return {
                "status": "success",
                "message": f"{model_type} model loaded successfully: {model_path}",
                "model_path": model_path,
                "metadata": self.model_metadata
            }
            
        except Exception as e:
            return {
                "status": "error",
                "message": f"Failed to load model {model_path}: {str(e)}",
                "model_path": model_path
            }
    
    def unload_model(self) -> Dict[str, Any]:
        """Unload the current model to free memory"""
        try:
            if self.current_model is not None:
                del self.current_model
                del self.current_tokenizer
                self.current_model = None
                self.current_tokenizer = None
                self.current_model_path = None
                self.model_metadata = {}
                self.is_huggingface_model = False
                
                # Force garbage collection
                gc.collect()
                if torch.cuda.is_available():
                    torch.cuda.empty_cache()
                
                return {
                    "status": "success",
                    "message": "Model unloaded successfully"
                }
            else:
                return {
                    "status": "info",
                    "message": "No model currently loaded"
                }
                
        except Exception as e:
            return {
                "status": "error",
                "message": f"Error unloading model: {str(e)}"
            }
    
    def get_model_status(self) -> Dict[str, Any]:
        """Get current model status"""
        if self.current_model is None:
            return {
                "loaded": False,
                "model_path": None,
                "metadata": {}
            }
        else:
            return {
                "loaded": True,
                "model_path": self.current_model_path,
                "metadata": self.model_metadata
            }
    
    def _get_model_device(self) -> torch.device:
        """Get the device where the model is located"""
        if self.current_model is None:
            return torch.device("cpu")
        
        # Get the device of the first parameter
        try:
            return next(self.current_model.parameters()).device
        except StopIteration:
            return torch.device("cpu")
    
    def generate_response(self, 
                         message: str, 
                         max_tokens: int = 150, 
                         temperature: float = 0.7,
                         do_sample: bool = True) -> Dict[str, Any]:
        """Generate a response using the loaded model"""
        
        if self.current_model is None or self.current_tokenizer is None:
            return {
                "status": "error",
                "message": "No model currently loaded. Please load a model first.",
                "response": ""
            }
        
        try:
            # Format the prompt
            prompt = f"### Instruction:\n{message}\n\n### Response:\n"
            
            # Tokenize
            inputs = self.current_tokenizer(
                prompt, 
                return_tensors="pt",
                truncation=True,
                max_length=2048
            )
            
            # Get model device and move inputs to the same device
            model_device = self._get_model_device()
            inputs = {key: value.to(model_device) for key, value in inputs.items()}
            
            # Generate response
            with torch.no_grad():
                outputs = self.current_model.generate(
                    **inputs,
                    max_new_tokens=max_tokens,
                    temperature=temperature,
                    do_sample=do_sample,
                    pad_token_id=self.current_tokenizer.eos_token_id,
                    eos_token_id=self.current_tokenizer.eos_token_id,
                )
            
            # Decode response
            full_response = self.current_tokenizer.decode(outputs[0], skip_special_tokens=True)
            
            # Extract only the generated part (after "### Response:")
            response_start = full_response.find("### Response:")
            if response_start != -1:
                response = full_response[response_start + len("### Response:"):].strip()
            else:
                response = full_response.strip()
            
            return {
                "status": "success",
                "message": "Response generated successfully",
                "response": response,
                "prompt": prompt,
                "full_output": full_response
            }
            
        except Exception as e:
            return {
                "status": "error",
                "message": f"Error generating response: {str(e)}",
                "response": ""
            }
    
    def generate_response_stream(self, 
                               message: str, 
                               max_tokens: int = 150, 
                               temperature: float = 0.7,
                               do_sample: bool = True):
        """Generate a streaming response using the loaded model"""
        
        if self.current_model is None or self.current_tokenizer is None:
            yield json.dumps({
                "status": "error",
                "message": "No model currently loaded. Please load a model first.",
                "token": "",
                "done": True
            })
            return
        
        try:
            # Format the prompt
            prompt = f"### Instruction:\n{message}\n\n### Response:\n"
            
            # Tokenize
            inputs = self.current_tokenizer(
                prompt, 
                return_tensors="pt",
                truncation=True,
                max_length=2048
            )
            
            # Get model device and move inputs to the same device
            model_device = self._get_model_device()
            inputs = {key: value.to(model_device) for key, value in inputs.items()}
            
            # Create streamer
            streamer = TextIteratorStreamer(
                self.current_tokenizer, 
                timeout=10.0, 
                skip_prompt=True, 
                skip_special_tokens=True
            )
            
            # Generation parameters
            generation_kwargs = {
                **inputs,
                "max_new_tokens": max_tokens,
                "temperature": temperature,
                "do_sample": do_sample,
                "pad_token_id": self.current_tokenizer.eos_token_id,
                "eos_token_id": self.current_tokenizer.eos_token_id,
                "streamer": streamer
            }
            
            # Start generation in a separate thread
            thread = Thread(target=self.current_model.generate, kwargs=generation_kwargs)
            thread.start()
            
            # Stream tokens as they are generated
            generated_text = ""
            for new_text in streamer:
                if new_text:
                    generated_text += new_text
                    yield json.dumps({
                        "status": "streaming",
                        "token": new_text,
                        "generated_text": generated_text,
                        "done": False
                    })
            
            # Signal completion
            yield json.dumps({
                "status": "completed",
                "token": "",
                "generated_text": generated_text,
                "done": True
            })
            
        except Exception as e:
            yield json.dumps({
                "status": "error",
                "message": f"Error generating response: {str(e)}",
                "token": "",
                "done": True
            })

    def generate_conversation_response(self, 
                                     messages: List[Dict[str, str]], 
                                     max_tokens: int = 150, 
                                     temperature: float = 0.7) -> Dict[str, Any]:
        """Generate response for a conversation with multiple turns"""
        
        if self.current_model is None or self.current_tokenizer is None:
            return {
                "status": "error",
                "message": "No model currently loaded. Please load a model first.",
                "response": ""
            }
        
        try:
            # Build conversation prompt
            conversation_prompt = ""
            for msg in messages:
                role = msg.get("role", "user")
                content = msg.get("content", "")
                
                if role == "user":
                    conversation_prompt += f"### Instruction:\n{content}\n\n"
                elif role == "assistant":
                    conversation_prompt += f"### Response:\n{content}\n\n"
            
            # Add final response prompt
            conversation_prompt += "### Response:\n"
            
            # Generate response using the conversation context
            result = self.generate_response(
                conversation_prompt, 
                max_tokens=max_tokens, 
                temperature=temperature
            )
            
            if result["status"] == "success":
                result["conversation_prompt"] = conversation_prompt
            
            return result
            
        except Exception as e:
            return {
                "status": "error",
                "message": f"Error generating conversation response: {str(e)}",
                "response": ""
            }


    def generate_response_using_vllm(self, 
                        model_path:str,
                        message: str, 
                        max_tokens: int = 150, 
                        temperature: float = 0.7,
                        do_sample: bool = True
                        ) -> Dict[str, Any]:
        
        """Generate a response using vLLM"""
        vllm_engine = LLM(model="finvix/qwen-2.5-0.5B")  # or "auto" or "bfloat16"

        if vllm_engine is None:
            return {
                "status": "error",
                "message": "vLLM model is not initialized.",
                "response": ""
            }
        
        try:
            # Format the prompt (same format as before)
            prompt = f"### Instruction:\n{message}\n\n### Response:\n"
            
            # Set sampling params
            sampling_params = SamplingParams(
                max_tokens=max_tokens,
                temperature=temperature,
                top_p=0.95,
            )
            
            # Run inference
            outputs = vllm_engine.generate([prompt], sampling_params)
            
            # Decode output
            generated_text = outputs[0].outputs[0].text.strip()
            
            return {
                "status": "success",
                "message": "Response generated successfully",
                "response": generated_text,
                "prompt": prompt,
                "full_output": prompt + generated_text
            }
        
        except Exception as e:
            return {
                "status": "error",
                "message": f"Error generating response: {str(e)}",
                "response": ""
            }

# Global model manager instance
model_manager = ModelManager()

from vllm import LLM, SamplingParams

class VLLMResponder:
    def __init__(self, model_path):
        self.engine = LLM(model=model_path, gpu_memory_utilization=0.9)

    def generate_response_using_batch(self, prompts, max_tokens=150, temperature=0.4, do_sample=True):
        sampling_params = SamplingParams(
            max_tokens=max_tokens,
            temperature=temperature,
            top_p=0.95,
        )
        outputs = self.engine.generate(prompts, sampling_params)
        # print("this is output", outputs[0].text)
        results = [o.outputs[0].text.strip() for o in outputs]
        print(results)
        return results
    
    def stop_engine(self):
        del self.engine
        gc.collect()

        # Also clear CUDA cache
        torch.cuda.empty_cache()
