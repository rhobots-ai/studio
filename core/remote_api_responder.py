import json
import requests
import time
from typing import List, Dict, Any, Optional
from concurrent.futures import ThreadPoolExecutor, as_completed
import threading
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

class RemoteAPIResponder:
    """
    Remote API responder that uses the working API endpoint pattern
    Replaces local vLLM with remote API calls for reliable predictions
    """
    
    def __init__(self, model_path: str, api_url: str = "https://finvix.deepcite.in/v1/chat/completions"):
        self.model_path = model_path
        self.api_url = api_url
        self.session = self._create_session()
        
    def _create_session(self) -> requests.Session:
        """Create a requests session with retry strategy and connection pooling"""
        session = requests.Session()
        
        # Configure retry strategy
        retry_strategy = Retry(
            total=3,
            backoff_factor=1,
            status_forcelist=[429, 500, 502, 503, 504],
        )
        
        adapter = HTTPAdapter(max_retries=retry_strategy, pool_connections=10, pool_maxsize=20)
        session.mount("http://", adapter)
        session.mount("https://", adapter)
        
        return session
    
    def generate_response_using_batch(self, prompts: List[str], max_tokens: int = 150, temperature: float = 0.4, do_sample: bool = True) -> List[str]:
        """
        Generate responses for a batch of prompts using the remote API
        Uses parallel requests for efficiency
        """
        if not prompts:
            return []
        
        print(f"Processing batch of {len(prompts)} prompts using remote API")
        
        # For small batches, use sequential processing to avoid overwhelming the API
        if len(prompts) <= 5:
            return self._process_sequential(prompts, max_tokens, temperature)
        else:
            return self._process_parallel(prompts, max_tokens, temperature)
    
    def _process_sequential(self, prompts: List[str], max_tokens: int, temperature: float) -> List[str]:
        """Process prompts sequentially for small batches"""
        results = []
        
        for i, prompt in enumerate(prompts):
            try:
                print(f"Processing prompt {i+1}/{len(prompts)}")
                response = self._make_api_call(prompt, max_tokens, temperature)
                results.append(response)
                
                # Small delay to be respectful to the API
                if i < len(prompts) - 1:
                    time.sleep(0.1)
                    
            except Exception as e:
                print(f"Error processing prompt {i+1}: {str(e)}")
                results.append(f"[ERROR: {str(e)}]")
        
        return results
    
    def _process_parallel(self, prompts: List[str], max_tokens: int, temperature: float) -> List[str]:
        """Process prompts in parallel for larger batches"""
        results = [None] * len(prompts)
        
        # Use ThreadPoolExecutor for parallel API calls
        with ThreadPoolExecutor(max_workers=5) as executor:
            # Submit all tasks
            future_to_index = {
                executor.submit(self._make_api_call, prompt, max_tokens, temperature): i
                for i, prompt in enumerate(prompts)
            }
            
            # Collect results as they complete
            for future in as_completed(future_to_index):
                index = future_to_index[future]
                try:
                    result = future.result()
                    results[index] = result
                    print(f"Completed prompt {index+1}/{len(prompts)}")
                except Exception as e:
                    print(f"Error processing prompt {index+1}: {str(e)}")
                    results[index] = f"[ERROR: {str(e)}]"
        
        return results
    
    def _make_api_call(self, prompt: str, max_tokens: int, temperature: float) -> str:
        """
        Make a single API call using the exact pattern from the working code
        """
        # Extract instruction from the prompt format
        instruction = self._extract_instruction_from_prompt(prompt)
        input_text = self._extract_input_from_prompt(prompt)
        
        # Use the exact payload structure from the working code
        payload = json.dumps({
            "model": self.model_path,
            "temperature": temperature,
            "messages": [
                {"role": "system", "content": instruction},
                {"role": "user", "content": input_text}
            ]
        })
        
        headers = {
            'Content-Type': 'application/json',
        }
        
        try:
            response = self.session.post(
                self.api_url, 
                headers=headers, 
                data=payload,
                timeout=30  # 30 second timeout
            )
            
            response.raise_for_status()  # Raise an exception for bad status codes
            
            # Parse the response
            response_data = response.json()
            
            # Extract content from OpenAI-compatible response format
            if "choices" in response_data and len(response_data["choices"]) > 0:
                choice = response_data["choices"][0]
                if "message" in choice and "content" in choice["message"]:
                    content = choice["message"]["content"]
                    return content.strip() if content else ""
            
            # Fallback: try to extract any text content
            if "content" in response_data:
                return str(response_data["content"]).strip()
            
            # If no content found, return the raw response as string
            return str(response_data)
            
        except requests.exceptions.RequestException as e:
            raise Exception(f"API request failed: {str(e)}")
        except json.JSONDecodeError as e:
            raise Exception(f"Failed to parse API response: {str(e)}")
        except Exception as e:
            raise Exception(f"Unexpected error: {str(e)}")
    
    def _extract_instruction_from_prompt(self, prompt: str) -> str:
        """
        Extract instruction from the formatted prompt
        Handles the format: ### Instruction:\n{instruction}\n\n### Input:\n{input}\n\n### Response:\n
        """
        try:
            # Look for instruction section
            if "### Instruction:" in prompt:
                start = prompt.find("### Instruction:") + len("### Instruction:")
                
                # Find the end of instruction (next ### section or end)
                end_markers = ["### Input:", "### Response:", "###"]
                end = len(prompt)
                
                for marker in end_markers:
                    marker_pos = prompt.find(marker, start)
                    if marker_pos != -1:
                        end = min(end, marker_pos)
                
                instruction = prompt[start:end].strip()
                return instruction if instruction else "Extract the required information from the following data."
            
            # Fallback: use the entire prompt as instruction
            return prompt.strip()
            
        except Exception:
            return "Extract the required information from the following data."
    
    def _extract_input_from_prompt(self, prompt: str) -> str:
        """
        Extract input text from the formatted prompt
        """
        try:
            # Look for input section
            if "### Input:" in prompt:
                start = prompt.find("### Input:") + len("### Input:")
                
                # Find the end of input (next ### section or end)
                end_markers = ["### Response:", "###"]
                end = len(prompt)
                
                for marker in end_markers:
                    marker_pos = prompt.find(marker, start)
                    if marker_pos != -1:
                        end = min(end, marker_pos)
                
                input_text = prompt[start:end].strip()
                return input_text if input_text else ""
            
            # If no input section, look for content after instruction
            if "### Instruction:" in prompt:
                # Everything after instruction but before response
                start = prompt.find("### Instruction:")
                if "### Response:" in prompt:
                    end = prompt.find("### Response:")
                    content = prompt[start:end]
                    # Remove the instruction part
                    if "### Instruction:" in content:
                        content = content[content.find("### Instruction:") + len("### Instruction:"):]
                    return content.strip()
            
            # Fallback: return empty string
            return ""
            
        except Exception:
            return ""
    
    def stop_engine(self):
        """
        Clean up resources (close session)
        """
        if hasattr(self, 'session'):
            self.session.close()
        print("Remote API responder stopped")
    
    def __del__(self):
        """Ensure session is closed when object is destroyed"""
        try:
            self.stop_engine()
        except:
            pass
