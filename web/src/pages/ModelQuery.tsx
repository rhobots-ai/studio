import { useState, useRef, useEffect } from 'react';
import { ArrowRight, CornerDownLeft, Copy, CheckCheck, MessageSquare, Scale, Send, DownloadCloud, AlertCircle, Loader2, Settings, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { motion } from 'framer-motion';
import { chatApi, Model } from '../services/chatApi';
import { AnimatedLoader } from '../components/ui/AnimatedLoader';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  model?: string;
}

export default function ModelQuery() {
  const [activeTab, setActiveTab] = useState<'finetuned' | 'huggingface'>('finetuned');
  const [availableModels, setAvailableModels] = useState<Model[]>([]);
  const [huggingFaceModels, setHuggingFaceModels] = useState<Model[]>([]);
  const [searchResults, setSearchResults] = useState<Model[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selectedModelId, setSelectedModelId] = useState('');
  const [compareModelId, setCompareModelId] = useState('');
  const [inputValue, setInputValue] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [showCompare, setShowCompare] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(true);
  const [isLoadingHFModels, setIsLoadingHFModels] = useState(true);
  const [modelError, setModelError] = useState<string | null>(null);
  const [hfModelError, setHFModelError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [currentLoadedModel, setCurrentLoadedModel] = useState<string | null>(null);
  const [isLoadingModel, setIsLoadingModel] = useState(false);
  const [modelLoadError, setModelLoadError] = useState<string | null>(null);
  const [modelLoadSuccess, setModelLoadSuccess] = useState(false);
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(256);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [copySuccess, setCopySuccess] = useState<{[key: string]: boolean}>({});
  
  // System Prompt state
  const [systemPrompt, setSystemPrompt] = useState('');
  const [systemPromptEnabled, setSystemPromptEnabled] = useState(false);
  const [showSystemPrompt, setShowSystemPrompt] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState('');

  // System Prompt Templates
  const systemPromptTemplates = [
    {
      id: 'default',
      name: 'Default Assistant',
      prompt: 'You are a helpful AI assistant. Provide accurate, concise, and helpful responses to user questions.'
    },
    {
      id: 'code_expert',
      name: 'Code Expert',
      prompt: 'You are an expert programmer and software engineer. Help users with coding questions, debugging, and best practices. Provide clear explanations and well-commented code examples.'
    },
    {
      id: 'customer_support',
      name: 'Customer Support',
      prompt: 'You are a friendly and professional customer support agent. Help customers with their inquiries, provide solutions to problems, and maintain a positive, helpful tone.'
    },
    {
      id: 'creative_writer',
      name: 'Creative Writer',
      prompt: 'You are a creative writing assistant. Help users with storytelling, creative writing, character development, and narrative techniques. Be imaginative and inspiring.'
    },
    {
      id: 'technical_analyst',
      name: 'Technical Analyst',
      prompt: 'You are a technical analyst and expert in data analysis. Provide detailed technical insights, explain complex concepts clearly, and help with data interpretation.'
    },
    {
      id: 'educator',
      name: 'Educator',
      prompt: 'You are an experienced educator and tutor. Explain concepts clearly, provide examples, and adapt your teaching style to help users learn effectively.'
    }
  ];
  
  // Get current models list based on active tab
  const currentModels = activeTab === 'finetuned' ? availableModels : huggingFaceModels;
  
  // Get selected model info
  const selectedModel = currentModels.find((m: Model) => m.id === selectedModelId);
  const compareModel = currentModels.find((m: Model) => m.id === compareModelId);
  
  // Load available models function
  const loadModels = async () => {
    try {
      setIsLoadingModels(true);
      setModelError(null);
      setRetryCount(prev => prev + 1);
      const models = await chatApi.fetchAvailableModels();
      setAvailableModels(models);
      
      // Set default selected models
      if (models.length > 0) {
        setSelectedModelId(models[0].id);
        if (models.length > 1) {
          setCompareModelId(models[1].id);
        }
      }
      setRetryCount(0); // Reset retry count on success
    } catch (error: any) {
      console.error('Failed to load models:', error);
      setModelError(error.message || 'Failed to load available models. Please try again.');
    } finally {
      setIsLoadingModels(false);
    }
  };

  // Retry loading models
  const handleRetryLoadModels = () => {
    loadModels();
  };

  // Load model function
  const loadSelectedModel = async (modelName: string, forceReload: boolean = false) => {
    if (!modelName) return;
    
    // Check if model is already loaded and not forcing reload
    if (modelName === currentLoadedModel && !forceReload) {
      setModelLoadSuccess(true);
      setTimeout(() => setModelLoadSuccess(false), 2000);
      return;
    }
    
    try {
      setIsLoadingModel(true);
      setModelLoadError(null);
      setModelLoadSuccess(false);
      console.log('Loading model:', modelName);
      
      await chatApi.loadModelByName(modelName);
      setCurrentLoadedModel(modelName);
      setModelLoadSuccess(true);
      console.log('Model loaded successfully:', modelName);
      
      // Clear success message after 3 seconds
      setTimeout(() => setModelLoadSuccess(false), 3000);
    } catch (error: any) {
      console.error('Failed to load model:', error);
      setModelLoadError(error.message || 'Failed to load model. Please try again.');
      setCurrentLoadedModel(null);
    } finally {
      setIsLoadingModel(false);
    }
  };

  // Handle model selection change (no auto-loading)
  const handleModelSelection = (modelId: string) => {
    setSelectedModelId(modelId);
    setModelLoadError(null);
    setModelLoadSuccess(false);
  };

  // Load Hugging Face models function
  const loadHuggingFaceModels = async () => {
    try {
      setIsLoadingHFModels(true);
      setHFModelError(null);
      const models = await chatApi.fetchHuggingFaceModels();
      setHuggingFaceModels(models);
      
      // Set default selected models if switching to HF tab
      if (activeTab === 'huggingface' && models.length > 0) {
        setSelectedModelId(models[0].id);
        if (models.length > 1) {
          setCompareModelId(models[1].id);
        }
      }
    } catch (error: any) {
      console.error('Failed to load Hugging Face models:', error);
      setHFModelError(error.message || 'Failed to load Hugging Face models. Please try again.');
    } finally {
      setIsLoadingHFModels(false);
    }
  };

  // Handle tab change
  const handleTabChange = (tab: 'finetuned' | 'huggingface') => {
    setActiveTab(tab);
    setSelectedModelId('');
    setCompareModelId('');
    setModelLoadError(null);
    setModelLoadSuccess(false);
    
    // Load models for the selected tab if not already loaded
    if (tab === 'huggingface' && huggingFaceModels.length === 0) {
      loadHuggingFaceModels();
    }
    
    // Set default selected model for the tab
    const models = tab === 'finetuned' ? availableModels : huggingFaceModels;
    if (models.length > 0) {
      setSelectedModelId(models[0].id);
      if (models.length > 1) {
        setCompareModelId(models[1].id);
      }
    }
  };

  // Handle manual model loading (updated for both types)
  const handleLoadModel = () => {
    const selectedModel = currentModels.find(m => m.id === selectedModelId);
    if (selectedModel) {
      // For HF models, use the hf_model_id directly (e.g., "Qwen/Qwen2.5-0.5B-Instruct")
      // For fine-tuned models, construct the full path (e.g., "./results/model_name")
      const modelIdentifier = activeTab === 'huggingface' 
        ? selectedModel.hf_model_id || selectedModel.name  // Use HF model ID directly
        : chatApi.getModelPath(selectedModel.name);  // Use chatApi to get full local path
      
      console.log(`Loading ${activeTab} model:`, modelIdentifier);
      loadSelectedModel(modelIdentifier);
    }
  };

  // Handle force reload (updated for both types)
  const handleForceReload = () => {
    const selectedModel = currentModels.find(m => m.id === selectedModelId);
    if (selectedModel) {
      const modelIdentifier = activeTab === 'huggingface' 
        ? selectedModel.hf_model_id || selectedModel.name  // Use HF model ID directly
        : chatApi.getModelPath(selectedModel.name);  // Use chatApi to get full local path
      
      console.log(`Force reloading ${activeTab} model:`, modelIdentifier);
      loadSelectedModel(modelIdentifier, true);
    }
  };

  // Handle search for Hugging Face models
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    try {
      setIsSearching(true);
      setSearchError(null);
      const results = await chatApi.searchHuggingFaceModels(searchQuery.trim());
      setSearchResults(results);
      
      // Update the current models list to show search results
      setHuggingFaceModels(results);
      
      // Set default selected model from search results
      if (results.length > 0) {
        setSelectedModelId(results[0].id);
        if (results.length > 1) {
          setCompareModelId(results[1].id);
        }
      } else {
        setSelectedModelId('');
        setCompareModelId('');
      }
    } catch (error: any) {
      console.error('Failed to search Hugging Face models:', error);
      setSearchError(error.message || 'Search failed. Please try again.');
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // Clear search and return to default models
  const handleClearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    setSearchError(null);
    loadHuggingFaceModels(); // Reload default models
  };

  // Handle chip click to search for model family
  const handleChipClick = (modelFamily: string) => {
    setSearchQuery(modelFamily);
    // Automatically trigger search
    setTimeout(() => {
      handleSearchWithQuery(modelFamily);
    }, 100);
  };

  // Handle search with specific query
  const handleSearchWithQuery = async (query: string) => {
    if (!query.trim()) return;
    
    try {
      setIsSearching(true);
      setSearchError(null);
      const results = await chatApi.searchHuggingFaceModels(query.trim());
      setSearchResults(results);
      
      // Update the current models list to show search results
      setHuggingFaceModels(results);
      
      // Set default selected model from search results
      if (results.length > 0) {
        setSelectedModelId(results[0].id);
        if (results.length > 1) {
          setCompareModelId(results[1].id);
        }
      } else {
        setSelectedModelId('');
        setCompareModelId('');
      }
    } catch (error: any) {
      console.error('Failed to search Hugging Face models:', error);
      setSearchError(error.message || 'Search failed. Please try again.');
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // Popular model families for quick search with company logos
  const modelFamilyChips = [
    { name: 'Phi', logo: 'https://img.shields.io/badge/Microsoft-0078D4?style=flat&logo=microsoft&logoColor=white', description: 'Microsoft Phi models' },
    { name: 'Qwen', logo: 'https://img.shields.io/badge/Qwen-FF6A00?style=flat&logo=alibaba&logoColor=white', description: 'Alibaba Qwen models' },
    { name: 'Mistral', logo: 'https://img.shields.io/badge/Mistral-FF7000?style=flat&logo=data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTEyIDJMMTMuMDkgOC4yNkwyMCA5TDEzLjA5IDE1Ljc0TDEyIDIyTDEwLjkxIDE1Ljc0TDQgOUwxMC45MSA8LjI2TDEyIDJaIiBmaWxsPSJ3aGl0ZSIvPgo8L3N2Zz4K&logoColor=white', description: 'Mistral AI models' },
    { name: 'Gemma', logo: 'https://img.shields.io/badge/Google-4285F4?style=flat&logo=google&logoColor=white', description: 'Google Gemma models' },
    { name: 'DeepSeek', logo: 'https://img.shields.io/badge/DeepSeek-000000?style=flat&logo=data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMTIiIGN5PSIxMiIgcj0iMTAiIGZpbGw9IndoaXRlIi8+CjxjaXJjbGUgY3g9IjEyIiBjeT0iMTIiIHI9IjMiIGZpbGw9ImJsYWNrIi8+Cjwvc3ZnPgo=&logoColor=white', description: 'DeepSeek models' },
    { name: 'Llama', logo: 'https://img.shields.io/badge/Meta-1877F2?style=flat&logo=meta&logoColor=white', description: 'Meta Llama models' },
    { name: 'CodeLlama', logo: 'https://img.shields.io/badge/Meta-1877F2?style=flat&logo=meta&logoColor=white', description: 'Meta CodeLlama models' },
    { name: 'Falcon', logo: 'https://img.shields.io/badge/TII-2E8B57?style=flat&logo=data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTEyIDJMMTggN0wxNSAxMkwxOCAxN0wxMiAyMkw2IDE3TDkgMTJMNiA3TDEyIDJaIiBmaWxsPSJ3aGl0ZSIvPgo8L3N2Zz4K&logoColor=white', description: 'TII Falcon models' },
  ];

  // System Prompt handlers
  const handleTemplateSelect = (templateId: string) => {
    const template = systemPromptTemplates.find(t => t.id === templateId);
    if (template) {
      setSystemPrompt(template.prompt);
      setSelectedTemplate(templateId);
      setSystemPromptEnabled(true);
    }
  };

  const handleSystemPromptClear = () => {
    setSystemPrompt('');
    setSelectedTemplate('');
  };

  const handleSystemPromptToggle = () => {
    setSystemPromptEnabled(!systemPromptEnabled);
  };

  // Load available models on component mount
  useEffect(() => {
    loadModels();
  }, []);


  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return;

    // Add user message
    const userMessage: ChatMessage = { role: 'user', content: inputValue };
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsGenerating(true);
    
    // Generate responses for both models
    await generateResponse(selectedModelId, inputValue);
    if (showCompare) {
      await generateResponse(compareModelId, inputValue, 50); // Slight delay for the comparison model
    }
    
    setIsGenerating(false);
  };

  const generateResponse = async (modelId: string, prompt: string, delay = 0) => {
    const model = currentModels.find(m => m.id === modelId);
    if (!model) return;

    // Add delay for comparison model
    if (delay > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    // Create initial empty message
    const newMessage: ChatMessage = { 
      role: 'assistant', 
      content: '',
      model: model.name
    };
    
    setMessages(prev => [...prev, newMessage]);
    const messageIndex = messages.length + 1; // +1 because we just added user message

    try {
      // Prepare chat parameters with system prompt if enabled
      const chatParams = {
        max_tokens: maxTokens,
        temperature: temperature,
        ...(systemPromptEnabled && systemPrompt.trim() && {
          system_prompt: systemPrompt.trim()
        })
      };

      // Use streaming chat API
      await chatApi.streamChat(
        prompt,
        chatParams,
        // onChunk callback - update message content as chunks arrive
        (chunk: string) => {
          setMessages(prev => 
            prev.map((msg, idx) => 
              idx === messageIndex ? { ...msg, content: msg.content + chunk } : msg
            )
          );
        },
        // onComplete callback
        () => {
          console.log('Streaming completed for model:', model.name);
        },
        // onError callback
        (error: Error) => {
          console.error('Streaming error for model:', model.name, error);
          setMessages(prev => 
            prev.map((msg, idx) => 
              idx === messageIndex ? { 
                ...msg, 
                content: msg.content + '\n\n[Error: Failed to get response from model. Please try again.]'
              } : msg
            )
          );
        }
      );
    } catch (error) {
      console.error('Failed to generate response:', error);
      setMessages(prev => 
        prev.map((msg, idx) => 
          idx === messageIndex ? { 
            ...msg, 
            content: '[Error: Failed to connect to the model. Please check your connection and try again.]'
          } : msg
        )
      );
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const copyToClipboard = (text: string, messageIndex: number) => {
    navigator.clipboard.writeText(text);
    setCopySuccess({...copySuccess, [messageIndex]: true});
    setTimeout(() => {
      setCopySuccess({...copySuccess, [messageIndex]: false});
    }, 2000);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Query Models</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Test and compare your fine-tuned models
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Select Models</CardTitle>
              <CardDescription>
                Choose which models to query
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Tab Interface */}
              <div className="flex space-x-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
                <button
                  onClick={() => handleTabChange('finetuned')}
                  className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                    activeTab === 'finetuned'
                      ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                  }`}
                >
                  Fine-tuned Models
                </button>
                <button
                  onClick={() => handleTabChange('huggingface')}
                  className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                    activeTab === 'huggingface'
                      ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                  }`}
                >
                  🤗 Hugging Face
                </button>
              </div>

              {/* Loading and Error States */}
              {(activeTab === 'finetuned' ? isLoadingModels : isLoadingHFModels) ? (
                <div className="flex items-center justify-center py-8">
                  <AnimatedLoader variant="brain" size="md" text={`Loading ${activeTab === 'finetuned' ? 'fine-tuned' : 'Hugging Face'} models...`} />
                </div>
              ) : (activeTab === 'finetuned' ? modelError : hfModelError) ? (
                <div className="flex flex-col items-center justify-center py-8 space-y-3">
                  <div className="flex items-center">
                    <AlertCircle className="h-6 w-6 text-red-500" />
                    <span className="ml-2 text-sm text-red-600">{activeTab === 'finetuned' ? modelError : hfModelError}</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={activeTab === 'finetuned' ? handleRetryLoadModels : loadHuggingFaceModels}
                    disabled={activeTab === 'finetuned' ? isLoadingModels : isLoadingHFModels}
                  >
                    Try Again
                  </Button>
                </div>
              ) : (
                <>
                  {/* Search Interface for Hugging Face Tab */}
                  {activeTab === 'huggingface' && (
                    <div className="mb-4">
                      <label className="block text-sm font-medium mb-2">
                        🔍 Search Models
                      </label>
                      
                      {/* Model Family Quick Search Chips */}
                      <div className="space-y-2 mb-3">
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          Quick Search:
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {modelFamilyChips.map((chip) => (
                            <button
                              key={chip.name}
                              onClick={() => handleChipClick(chip.name)}
                              disabled={isSearching}
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full border transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed ${
                                searchQuery.toLowerCase() === chip.name.toLowerCase()
                                  ? 'bg-primary-100 dark:bg-primary-900/30 border-primary-300 dark:border-primary-700 text-primary-700 dark:text-primary-300'
                                  : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                              }`}
                              title={chip.description}
                            >
                              <img 
                                src={chip.logo} 
                                alt={`${chip.name} logo`}
                                className="h-3 w-auto"
                                onError={(e) => {
                                  // Fallback to text if image fails to load
                                  e.currentTarget.style.display = 'none';
                                  e.currentTarget.nextElementSibling!.textContent = chip.name;
                                }}
                              />
                              <span>{chip.name}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                      
                      <div className="relative">
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleSearch();
                            }
                          }}
                          placeholder="Search for models (e.g., llama, microsoft, phi)..."
                          className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                          disabled={isSearching}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleSearch}
                          disabled={isSearching || !searchQuery.trim()}
                          className="absolute right-1 top-1 h-6 w-6 p-0"
                        >
                          {isSearching ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <ArrowRight className="h-3 w-3" />
                          )}
                        </Button>
                      </div>
                      
                      {/* Search Error */}
                      {searchError && (
                        <div className="mt-2 flex items-center text-sm text-red-600">
                          <AlertCircle className="h-4 w-4 mr-2" />
                          {searchError}
                        </div>
                      )}
                      
                      {/* Search Results Info */}
                      {searchResults.length > 0 && (
                        <div className="mt-2 text-xs text-gray-500">
                          Found {searchResults.length} verified models for "{searchQuery}"
                        </div>
                      )}
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Primary Model
                    </label>
                    <select
                      value={selectedModelId}
                      onChange={(e) => handleModelSelection(e.target.value)}
                      className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      disabled={currentModels.length === 0 || isLoadingModel}
                    >
                      {currentModels.length === 0 ? (
                        <option value="">No models available</option>
                      ) : (
                        currentModels.map((model) => (
                          <option key={model.id} value={model.id}>
                            {model.name}
                            {activeTab === 'huggingface' && model.family && ` (${model.family})`}
                          </option>
                        ))
                      )}
                    </select>
                    
                    {/* Load Model Button */}
                    <div className="mt-3">
                      <Button
                        variant={currentLoadedModel === selectedModel?.name ? "outline" : "primary"}
                        size="sm"
                        onClick={handleLoadModel}
                        disabled={!selectedModelId || isLoadingModel}
                        isLoading={isLoadingModel}
                        className="w-full"
                      >
                        {isLoadingModel ? (
                          "Loading Model..."
                        ) : currentLoadedModel === selectedModel?.name ? (
                          "Model Loaded"
                        ) : (
                          "Load Model"
                        )}
                      </Button>
                    </div>

                    {/* Model Status Display */}
                    <div className="mt-2 space-y-1">
                      {isLoadingModel && (
                        <motion.div 
                          className="flex items-center text-sm text-blue-600"
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.3 }}
                        >
                          <AnimatedLoader variant="neural" size="sm" />
                          <span className="ml-2">Loading "{selectedModel?.name}"...</span>
                        </motion.div>
                      )}
                      
                      {modelLoadSuccess && !isLoadingModel && (
                        <div className="flex items-center text-sm text-green-600">
                          <CheckCheck className="h-4 w-4 mr-2" />
                          Successfully loaded!
                        </div>
                      )}
                      
                      {currentLoadedModel && !isLoadingModel && !modelLoadSuccess && (
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center text-green-600">
                            <CheckCheck className="h-4 w-4 mr-2" />
                            <span>"{currentLoadedModel}" is loaded</span>
                          </div>
                          {currentLoadedModel === selectedModel?.name && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={handleForceReload}
                              className="text-xs px-2 py-1 h-auto"
                            >
                              Reload
                            </Button>
                          )}
                        </div>
                      )}
                      
                      {!currentLoadedModel && !isLoadingModel && !modelLoadError && selectedModelId && (
                        <div className="flex items-center text-sm text-gray-500">
                          <AlertCircle className="h-4 w-4 mr-2" />
                          No model loaded
                        </div>
                      )}
                      
                      {modelLoadError && (
                        <div className="space-y-2">
                          <div className="flex items-center text-sm text-red-600">
                            <AlertCircle className="h-4 w-4 mr-2" />
                            {modelLoadError}
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleLoadModel}
                            className="text-xs"
                          >
                            Retry Loading
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
              
              {/* <div className="flex items-center space-x-3 pt-1">
                <input
                  type="checkbox"
                  id="compareMode"
                  checked={showCompare}
                  onChange={() => setShowCompare(!showCompare)}
                  className="h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                />
                <label htmlFor="compareMode" className="text-sm">
                  Compare with base model
                </label>
              </div> */}
              
              {showCompare && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="pt-2">
                    <label className="block text-sm font-medium mb-1">
                      Comparison Model
                    </label>
                    <select
                      value={compareModelId}
                      onChange={(e) => setCompareModelId(e.target.value)}
                      className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    >
                      {currentModels
                        .filter((model) => model.id !== selectedModelId)
                        .map((model) => (
                          <option key={model.id} value={model.id}>
                            {model.name}
                            {activeTab === 'huggingface' && model.family && ` (${model.family})`}
                          </option>
                        ))}
                    </select>
                  </div>
                </motion.div>
              )}

              <div className="pt-4">
                <h4 className="text-sm font-medium mb-3">Parameters</h4>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label htmlFor="temperature" className="text-xs font-medium">
                        Temperature
                      </label>
                      <span className="text-xs">{temperature}</span>
                    </div>
                    <input
                      type="range"
                      id="temperature"
                      min="0"
                      max="2"
                      step="0.1"
                      value={temperature}
                      onChange={(e) => setTemperature(parseFloat(e.target.value))}
                      className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-primary-600"
                    />
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>Precise</span>
                      <span>Creative</span>
                    </div>
                  </div>
                  
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label htmlFor="maxTokens" className="text-xs font-medium">
                        Max Tokens
                      </label>
                      <span className="text-xs">{maxTokens}</span>
                    </div>
                    <input
                      type="range"
                      id="maxTokens"
                      min="32"
                      max="2048"
                      step="32"
                      value={maxTokens}
                      onChange={(e) => setMaxTokens(parseInt(e.target.value))}
                      className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-primary-600"
                    />
                  </div>
                  
                </div>
              </div>

              {/* System Prompt Section */}
              <div className="pt-4 border-t">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-medium flex items-center gap-2">
                    <Settings className="h-4 w-4" />
                    System Prompt
                  </h4>
                  <button
                    onClick={() => setShowSystemPrompt(!showSystemPrompt)}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  >
                    {showSystemPrompt ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </button>
                </div>

                {showSystemPrompt && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-3"
                  >
                    {/* Enable System Prompt Toggle */}
                    <div className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        id="systemPromptEnabled"
                        checked={systemPromptEnabled}
                        onChange={handleSystemPromptToggle}
                        className="h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                      />
                      <label htmlFor="systemPromptEnabled" className="text-sm">
                        Enable System Prompt
                      </label>
                      {systemPromptEnabled && (
                        <Badge variant="secondary" size="sm">
                          Active
                        </Badge>
                      )}
                    </div>

                    {systemPromptEnabled && (
                      <>
                        {/* Template Selector */}
                        <div>
                          <label className="block text-xs font-medium mb-1">
                            Quick Templates
                          </label>
                          <select
                            value={selectedTemplate}
                            onChange={(e) => handleTemplateSelect(e.target.value)}
                            className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                          >
                            <option value="">Select a template...</option>
                            {systemPromptTemplates.map((template) => (
                              <option key={template.id} value={template.id}>
                                {template.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* System Prompt Textarea */}
                        <div>
                          <label className="block text-xs font-medium mb-1">
                            Custom System Prompt
                          </label>
                          <textarea
                            value={systemPrompt}
                            onChange={(e) => setSystemPrompt(e.target.value)}
                            placeholder="Enter your system prompt here..."
                            rows={4}
                            className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                          />
                          <div className="flex justify-between items-center mt-1">
                            <span className="text-xs text-gray-500">
                              {systemPrompt.length} characters
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={handleSystemPromptClear}
                              className="text-xs px-2 py-1 h-auto"
                            >
                              Clear
                            </Button>
                          </div>
                        </div>
                      </>
                    )}
                  </motion.div>
                )}
              </div>
            </CardContent>
            <CardFooter className="border-t flex-col space-y-3 items-start">
              <div className="text-xs text-gray-500 dark:text-gray-400">
                <p className="font-medium mb-1">Selected Model Info</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                  <div>Size: <span className="text-gray-700 dark:text-gray-300">{selectedModel?.size}</span></div>
                  <div>Type: <span className="text-gray-700 dark:text-gray-300">{selectedModel?.isBase ? 'Base' : 'Fine-tuned'}</span></div>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                leftIcon={<DownloadCloud className="h-4 w-4" />}
                className="w-full"
              >
                Download Model
              </Button>
            </CardFooter>
          </Card>
        </div>
        
        <div className="lg:col-span-3 h-full flex flex-col">
          <Card className="flex-1 flex flex-col h-full min-h-[600px]">
            <CardHeader className="border-b flex-shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <MessageSquare className="h-5 w-5 text-primary-500" />
                  <div>
                    <CardTitle>Model Chat</CardTitle>
                    <CardDescription>
                      {showCompare ? 'Compare responses from different models' : 'Test your selected model'}
                    </CardDescription>
                  </div>
                </div>
                {systemPromptEnabled && systemPrompt.trim() && (
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" size="sm" className="flex items-center gap-1">
                      <Settings className="h-3 w-3" />
                      System Prompt Active
                    </Badge>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto p-4 max-h-[500px] min-h-[400px]">
              <div className="space-y-6">
                {messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-8">
                    <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded-full mb-4">
                      <MessageSquare className="h-6 w-6 text-gray-400" />
                    </div>
                    <h3 className="font-medium mb-1">No messages yet</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm">
                      Send a message to start chatting with the selected model
                    </p>
                    <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-2 w-full max-w-md">
                      <Button
                        variant="outline" 
                        size="sm"
                        className="justify-start text-left"
                        onClick={() => setInputValue("What's the difference between fine-tuning and prompt engineering?")}
                      >
                        Explain fine-tuning vs prompt engineering
                      </Button>
                      <Button
                        variant="outline" 
                        size="sm"
                        className="justify-start text-left"
                        onClick={() => setInputValue("My shipment is delayed. Can you help me?")}
                      >
                        Help with a delayed shipment
                      </Button>
                      <Button
                        variant="outline" 
                        size="sm"
                        className="justify-start text-left"
                        onClick={() => setInputValue("Write a function to check order status")}
                      >
                        Generate a status-checking function
                      </Button>
                      <Button
                        variant="outline" 
                        size="sm"
                        className="justify-start text-left"
                        onClick={() => setInputValue("Summarize the key benefits of small LLMs")}
                      >
                        Summarize small LLM benefits
                      </Button>
                    </div>
                  </div>
                ) : (
                  messages.map((message, index) => (
                    <div key={index} className="flex flex-col">
                      <div className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`
                          inline-block rounded-lg px-4 py-2 max-w-[85%] md:max-w-[75%] break-words
                          ${message.role === 'user' 
                            ? 'bg-primary-600 text-white' 
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100'}
                        `}>
                          {message.role === 'assistant' && message.model && (
                            <div className="mb-1 flex items-center gap-2">
                              <Badge variant={message.model.includes('fine-tuned') || !message.model.includes('v0.1') ? 'secondary' : 'outline'} size="sm">
                                {message.model}
                              </Badge>
                              <button
                                onClick={() => copyToClipboard(message.content, index)}
                                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                                aria-label="Copy text"
                              >
                                {copySuccess[index] ? (
                                  <CheckCheck className="h-3 w-3" />
                                ) : (
                                  <Copy className="h-3 w-3" />
                                )}
                              </button>
                            </div>
                          )}
                          <div className="text-sm whitespace-pre-line">
                            {message.content}
                            {message.role === 'assistant' && message.content === '' && isGenerating && (
                              <AnimatedLoader variant="typing" size="sm" />
                            )}
                          </div>
                        </div>
                      </div>

                      {message.role === 'assistant' && showCompare && message.model === compareModel?.name && (
                        <div className="mt-2 flex justify-center">
                          <div className="inline-flex items-center gap-2 px-3 py-1 bg-gray-100 dark:bg-gray-800/50 rounded-full">
                            <Scale className="h-3.5 w-3.5 text-gray-500" />
                            <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Compare the responses above</span>
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>
            </CardContent>
            <CardFooter className="border-t p-4">
              <div className="w-full relative">
                <textarea
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type your message..."
                  rows={3}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                  disabled={isGenerating}
                />
                <Button
                  variant="primary"
                  size="sm"
                  disabled={!inputValue.trim() || isGenerating}
                  isLoading={isGenerating}
                  onClick={handleSendMessage}
                  className="absolute bottom-3 right-3 w-8 h-8 p-0"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}
