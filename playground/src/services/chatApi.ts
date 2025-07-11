// Use proxy in development, direct URL in production
import {API_BASE_URL, API_BASE_URL_WITH_API} from '../config/api'

export interface Model {
  id: string;
  name: string;
  description: string;
  size: string;
  architecture: string;
  creationDate?: string;
  isBase: boolean;
  baseModelId?: string;
  family?: string;
  hf_model_id?: string;
}

export interface ModelStatus {
  loaded: boolean;
  modelId?: string;
  modelName?: string;
}

export interface ChatParams {
  message: string;
  max_tokens?: number;
  temperature?: number;
  system_prompt?: string;
}

export interface StreamChunk {
  content: string;
  done: boolean;
}

export interface ApiError {
  message: string;
  status?: number;
  type: 'network' | 'server' | 'cors' | 'timeout' | 'unknown';
}

class ChatApiService {
  private modelsData: any[] = []; // Store original model data for path mapping

  private async makeRequest(endpoint: string, options: RequestInit = {}, retries = 3): Promise<Response> {
    const url = `${API_BASE_URL_WITH_API}${endpoint}`;
    
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
        
        const response = await fetch(url, {
          ...options,
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
            'Accept': '*/*',
            ...options.headers,
          },
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorType = this.getErrorType(response.status);
          throw new Error(`API Error: ${response.status} ${response.statusText} (${errorType})`);
        }

        return response;
      } catch (error: any) {
        console.error(`Attempt ${attempt + 1} failed:`, error);
        
        if (attempt === retries) {
          // Last attempt failed, throw enhanced error
          const apiError: ApiError = {
            message: error.message || 'Unknown error occurred',
            status: error.status,
            type: this.categorizeError(error),
          };
          throw apiError;
        }
        
        // Wait before retrying (exponential backoff)
        await this.delay(Math.pow(2, attempt) * 1000);
      }
    }
    
    throw new Error('All retry attempts failed');
  }

  private getErrorType(status: number): string {
    if (status >= 500) return 'server';
    if (status === 404) return 'not_found';
    if (status === 403 || status === 401) return 'auth';
    if (status === 429) return 'rate_limit';
    return 'client';
  }

  private categorizeError(error: any): ApiError['type'] {
    if (error.name === 'AbortError') return 'timeout';
    if (error.message?.includes('CORS')) return 'cors';
    if (error.message?.includes('fetch')) return 'network';
    if (error.status >= 500) return 'server';
    return 'unknown';
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Helper method to get model path from model name (for fine-tuned models only)
  getModelPath(modelName: string): string {
    const modelData = this.modelsData.find(model => model.name === modelName);
    return modelData?.path || `./results/${modelName}`;
  }

  // Helper method to load model by name or HF model ID
  async loadModelByName(modelIdentifier: string, maxSeqLength: number = 2048): Promise<void> {
    // For HF models, use the identifier directly
    // For local models, get the path
    return this.loadModel(modelIdentifier, maxSeqLength);
  }

  // Helper method to load model with proper identifier (HF ID or local path)
  async loadModelByIdentifier(modelIdentifier: string, maxSeqLength: number = 2048): Promise<void> {
    return this.loadModel(modelIdentifier, maxSeqLength);
  }

  async fetchAvailableModels(): Promise<Model[]> {
    try {
      const response = await this.makeRequest('/models/available');
      const data = await response.json();
      
      // Handle the specific API response format
      if (data.status === 'success' && data.models && Array.isArray(data.models)) {
        const models = data.models;
        
        if (models.length === 0) {
          // Return mock data for development if no models are available
          if (import.meta.env.DEV) {
            console.warn('No models returned from API, using mock data for development');
            return this.getMockModels();
          }
          throw new Error('No models available from the API');
        }
        
        // Store original model data for path mapping
        this.modelsData = models;
        
        // Transform API response to match our Model interface
        return models.map((model: any, index: number) => ({
          id: model.name || `model_${index}`,
          name: model.name || 'Unknown Model',
          description: `Fine-tuned model (${(model.size_mb || 0).toFixed(1)} MB)`,
          size: model.size_mb ? `${(model.size_mb / 1024).toFixed(1)}GB` : 'Unknown',
          architecture: model.training_config?.model_type || 'LoRA',
          creationDate: model.created_at,
          isBase: false, // These are all fine-tuned models
          baseModelId: model.training_config?.base_model,
        }));
      } else {
        // Fallback for other response formats
        const models = Array.isArray(data) ? data : data.models || [];
        
        if (models.length === 0) {
          if (import.meta.env.DEV) {
            console.warn('No models returned from API, using mock data for development');
            return this.getMockModels();
          }
          throw new Error('No models available from the API');
        }
        
        return models.map((model: any) => ({
          id: model.id || model.model_id || `model_${Date.now()}`,
          name: model.name || model.model_name || 'Unknown Model',
          description: model.description || `${model.architecture || 'Unknown'} model`,
          size: model.size || model.parameters || 'Unknown',
          architecture: model.architecture || 'Unknown',
          creationDate: model.created_at || model.creation_date,
          isBase: model.is_base || false,
          baseModelId: model.base_model_id,
        }));
      }
    } catch (error: any) {
      console.error('Failed to fetch available models:', error);
      
      // Provide helpful error messages based on error type
      if (error.type === 'cors') {
        throw new Error('CORS error: Unable to connect to the API. Please check if the server is running and CORS is configured properly.');
      } else if (error.type === 'network') {
        throw new Error('Network error: Unable to reach the API server. Please check your internet connection.');
      } else if (error.type === 'timeout') {
        throw new Error('Request timeout: The API server is taking too long to respond. Please try again.');
      } else if (error.type === 'server') {
        throw new Error('Server error: The API server is experiencing issues. Please try again later.');
      }
      
      throw new Error(error.message || 'Failed to load available models. Please try again.');
    }
  }

  async fetchHuggingFaceModels(): Promise<Model[]> {
    try {
      const response = await this.makeRequest('/models/huggingface');
      const data = await response.json();
      
      if (data.status === 'success' && data.models && Array.isArray(data.models)) {
        const models = data.models;
        
        // Transform HF models to match our Model interface
        return models.map((model: any) => ({
          id: model.id,
          name: model.name,
          description: model.description,
          size: model.size,
          architecture: model.architecture,
          creationDate: new Date().toISOString(),
          isBase: model.isBase,
          baseModelId: model.hf_model_id,
          family: model.family,
          hf_model_id: model.hf_model_id,
        }));
      } else {
        throw new Error('Invalid response format from Hugging Face models API');
      }
    } catch (error: any) {
      console.error('Failed to fetch Hugging Face models:', error);
      
      // Provide helpful error messages based on error type
      if (error.type === 'cors') {
        throw new Error('CORS error: Unable to connect to the API. Please check if the server is running and CORS is configured properly.');
      } else if (error.type === 'network') {
        throw new Error('Network error: Unable to reach the API server. Please check your internet connection.');
      } else if (error.type === 'timeout') {
        throw new Error('Request timeout: The API server is taking too long to respond. Please try again.');
      } else if (error.type === 'server') {
        throw new Error('Server error: The API server is experiencing issues. Please try again later.');
      }
      
      throw new Error(error.message || 'Failed to load Hugging Face models. Please try again.');
    }
  }

  async searchHuggingFaceModels(query: string, limit: number = 50): Promise<Model[]> {
    try {
      const response = await this.makeRequest(`/models/huggingface/search?query=${encodeURIComponent(query)}&limit=${limit}`);
      const data = await response.json();
      
      if (data.status === 'success' && data.models && Array.isArray(data.models)) {
        const models = data.models;
        
        // Transform search results to match our Model interface
        return models.map((model: any) => ({
          id: model.id,
          name: model.name,
          description: model.description,
          size: model.size,
          architecture: model.architecture,
          creationDate: new Date().toISOString(),
          isBase: model.isBase,
          baseModelId: model.hf_model_id,
          family: model.family,
          hf_model_id: model.hf_model_id,
          downloads: model.downloads,
        }));
      } else if (data.status === 'error') {
        throw new Error(data.message || 'Search failed');
      } else {
        throw new Error('Invalid response format from Hugging Face search API');
      }
    } catch (error: any) {
      console.error('Failed to search Hugging Face models:', error);
      
      // Provide helpful error messages based on error type
      if (error.type === 'cors') {
        throw new Error('CORS error: Unable to connect to the API. Please check if the server is running and CORS is configured properly.');
      } else if (error.type === 'network') {
        throw new Error('Network error: Unable to reach the API server. Please check your internet connection.');
      } else if (error.type === 'timeout') {
        throw new Error('Request timeout: The API server is taking too long to respond. Please try again.');
      } else if (error.type === 'server') {
        throw new Error('Server error: The API server is experiencing issues. Please try again later.');
      }
      
      throw new Error(error.message || 'Failed to search Hugging Face models. Please try again.');
    }
  }

  private getMockModels(): Model[] {
    return [
      {
        id: 'mistral-7b-v0.1',
        name: 'Mistral-7B-v0.1',
        description: 'A strong 7B language model that demonstrates strong performance across a range of tasks.',
        size: '7B',
        architecture: 'Mistral',
        isBase: true,
        creationDate: new Date().toISOString(),
      },
      {
        id: 'tinyllama-1.1b',
        name: 'TinyLlama-1.1B',
        description: 'Lightweight 1.1B parameters language model trained on diverse internet text corpus.',
        size: '1.1B',
        architecture: 'TinyLlama',
        isBase: true,
        creationDate: new Date().toISOString(),
      },
    ];
  }

  async getModelStatus(): Promise<ModelStatus> {
    try {
      const response = await this.makeRequest('/models/status');
      const data = await response.json();
      
      return {
        loaded: data.loaded || false,
        modelId: data.model_id,
        modelName: data.model_name,
      };
    } catch (error) {
      console.error('Failed to get model status:', error);
      throw error;
    }
  }

  async loadModel(modelPath: string, maxSeqLength: number = 2048): Promise<void> {
    try {
      await this.makeRequest('/models/load', {
        method: 'POST',
        body: JSON.stringify({ 
          model_path: modelPath,
          max_seq_length: maxSeqLength 
        }),
      });
    } catch (error) {
      console.error('Failed to load model:', error);
      throw error;
    }
  }

  async unloadModel(): Promise<void> {
    try {
      await this.makeRequest('/models/unload', {
        method: 'POST',
      });
    } catch (error) {
      console.error('Failed to unload model:', error);
      throw error;
    }
  }

  async sendSingleMessage(message: string, params: Partial<ChatParams> = {}): Promise<string> {
    try {
      const requestPayload: any = {
        message,
        max_tokens: params.max_tokens || 256,
        temperature: params.temperature || 0.7,
      };

      // Add system prompt if provided
      if (params.system_prompt && params.system_prompt.trim()) {
        requestPayload.system_prompt = params.system_prompt.trim();
      }

      const response = await this.makeRequest('/chat/single', {
        method: 'POST',
        body: JSON.stringify(requestPayload),
      });
      
      const data = await response.json();
      return data.response || data.message || '';
    } catch (error) {
      console.error('Failed to send single message:', error);
      throw error;
    }
  }

  async sendConversation(messages: Array<{role: string; content: string}>, params: Partial<ChatParams> = {}): Promise<string> {
    try {
      const response = await this.makeRequest('/chat/conversation', {
        method: 'POST',
        body: JSON.stringify({
          messages,
          max_tokens: params.max_tokens || 256,
          temperature: params.temperature || 0.7,
        }),
      });
      
      const data = await response.json();
      return data.response || data.message || '';
    } catch (error) {
      console.error('Failed to send conversation:', error);
      throw error;
    }
  }

  async quickChat(query: string, params: Partial<ChatParams> = {}): Promise<string> {
    try {
      const queryParams = new URLSearchParams({
        q: query,
        max_tokens: (params.max_tokens || 256).toString(),
        temperature: (params.temperature || 0.7).toString(),
      });

      const response = await this.makeRequest(`/chat/quick?${queryParams}`);
      const data = await response.json();
      return data.response || data.message || '';
    } catch (error) {
      console.error('Failed to send quick chat:', error);
      throw error;
    }
  }

  async streamChat(
    message: string, 
    params: Partial<ChatParams> = {},
    onChunk: (chunk: string) => void,
    onComplete: () => void,
    onError: (error: Error) => void
  ): Promise<void> {
    try {
      // Create request payload matching your API format exactly
      const requestPayload: any = {
        message,
        max_tokens: params.max_tokens || 150,
        temperature: params.temperature || 0.7,
      };

      // Add system prompt if provided
      if (params.system_prompt && params.system_prompt.trim()) {
        requestPayload.system_prompt = params.system_prompt.trim();
      }

      console.log('Sending chat request:', requestPayload);

      const response = await fetch(`${API_BASE_URL}/chat/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': '*/*',
        },
        body: JSON.stringify(requestPayload),
      });

      if (!response.ok) {
        throw new Error(`Stream API Error: ${response.status} ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Failed to get response reader');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) {
            onComplete();
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.trim()) {
              try {
                // Handle Server-Sent Events format
                if (line.startsWith('data: ')) {
                  const data = line.slice(6);
                  if (data === '[DONE]') {
                    onComplete();
                    return;
                  }
                  // Try to parse as JSON first
                  try {
                    const parsed = JSON.parse(data);
                    
                    // Handle your specific API format
                    if (parsed.token) {
                      onChunk(parsed.token);
                    }
                    
                    // Check for completion
                    if (parsed.done === true || parsed.status === 'completed') {
                      onComplete();
                      return;
                    }
                  } catch (jsonError) {
                    // If not JSON, treat as plain text
                    onChunk(data);
                  }
                } else {
                  // Direct text streaming - treat each line as content
                  onChunk(line);
                }
              } catch (parseError) {
                console.warn('Error parsing streaming line:', parseError);
                // If all parsing fails, treat as plain text
                onChunk(line);
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    } catch (error) {
      console.error('Stream chat error:', error);
      onError(error as Error);
    }
  }
}

export const chatApi = new ChatApiService();
