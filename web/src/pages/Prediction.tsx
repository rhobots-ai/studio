import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '../components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '../components/ui/Card';
import { 
  Upload, 
  Database, 
  Plus, 
  Search, 
  Download, 
  Eye, 
  FileText,
  Target,
  Settings,
  ChevronDown,
  ChevronUp,
  Play,
  AlertCircle,
  CheckCircle,
  Clock,
  BarChart3,
  ArrowRight,
  Brain,
  DownloadCloud,
  Loader2,
  AlertTriangle
} from 'lucide-react';
import { 
  fileService, 
  FileUploadResponse, 
  ColumnMapping, 
  ColumnInfo,
  TrainingExample
} from '../services/fileService';
import { predictionService } from '../services/predictionService';
import { chatApi, Model } from '../services/chatApi';
import { AnimatedLoader } from '../components/ui/AnimatedLoader';
import PredictionMappingInterface from '../components/ui/PredictionMappingInterface';

type PredictionMode = 'upload' | 'mapping' | 'predict' | 'results';

interface ModelInfo {
  model_id: string;
  name: string;
  description: string;
  input_schema: Record<string, any>;
  output_schema: Record<string, any>;
  created_at: string;
  accuracy?: number;
  status: 'ready' | 'loading' | 'error';
}

interface PredictionJob {
  job_id: string;
  model_id: string;
  file_id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  total_rows: number;
  processed_rows: number;
  results?: PredictionResult[];
  error_message?: string;
  created_at: string;
  completed_at?: string;
}

interface PredictionResult {
  row_index: number;
  input_data: Record<string, any>;
  prediction: any;
  confidence?: number;
  processing_time_ms?: number;
}

interface PredictionMapping {
  input_columns: Record<string, string>; // maps model input fields to file columns
  preprocessing_options: {
    normalize_text: boolean;
    handle_missing_values: 'skip' | 'default' | 'error';
    default_values: Record<string, any>;
  };
}

export const Prediction: React.FC = () => {
  const [currentMode, setCurrentMode] = useState<PredictionMode>('upload');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Upload state
  const [uploadedFile, setUploadedFile] = useState<FileUploadResponse | null>(null);
  const [columnInfo, setColumnInfo] = useState<Record<string, ColumnInfo>>({});
  const [availableColumns, setAvailableColumns] = useState<string[]>([]);
  
  // Model selection state
  const [activeTab, setActiveTab] = useState<'finetuned' | 'huggingface'>('finetuned');
  const [availableModels, setAvailableModels] = useState<Model[]>([]);
  const [huggingFaceModels, setHuggingFaceModels] = useState<Model[]>([]);
  const [searchResults, setSearchResults] = useState<Model[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selectedModelId, setSelectedModelId] = useState('');
  const [isLoadingModels, setIsLoadingModels] = useState(true);
  const [isLoadingHFModels, setIsLoadingHFModels] = useState(true);
  const [modelError, setModelError] = useState<string | null>(null);
  const [hfModelError, setHFModelError] = useState<string | null>(null);
  
  // Prediction parameters
  const [batchSize, setBatchSize] = useState(50);
  const [maxTokens, setMaxTokens] = useState(150);
  const [temperature, setTemperature] = useState(0.7);
  
  // Mapping state
  const [predictionMapping, setPredictionMapping] = useState<PredictionMapping>({
    input_columns: {},
    preprocessing_options: {
      normalize_text: true,
      handle_missing_values: 'default',
      default_values: {}
    }
  });
  
  // Prediction state
  const [currentJob, setCurrentJob] = useState<PredictionJob | null>(null);
  const [predictionResults, setPredictionResults] = useState<PredictionResult[]>([]);

  // Get current models list based on active tab
  const currentModels = activeTab === 'finetuned' ? availableModels : huggingFaceModels;
  
  // Get selected model info - handle different model types
  const selectedModel = activeTab === 'finetuned' 
    ? currentModels.find((m: any) => m.model_id === selectedModelId)
    : currentModels.find((m: any) => m.id === selectedModelId);

  // Popular model families for quick search with company logos
  const modelFamilyChips = [
    { name: 'Phi', logo: 'https://img.shields.io/badge/Microsoft-0078D4?style=flat&logo=microsoft&logoColor=white', description: 'Microsoft Phi models' },
    { name: 'Qwen', logo: 'https://img.shields.io/badge/Qwen-FF6A00?style=flat&logo=alibaba&logoColor=white', description: 'Alibaba Qwen models' },
    { name: 'Mistral', logo: 'https://img.shields.io/badge/Mistral-FF7000?style=flat&logo=data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTEyIDJMMTMuMDkgOC4yNkwyMCA5TDEzLjA5IDE1Ljc0TDEyIDIyTDEwLjkxIDE1Ljc0TDQgOUwxMC45MSA4LjI2TDEyIDJaIiBmaWxsPSJ3aGl0ZSIvPgo8L3N2Zz4K&logoColor=white', description: 'Mistral AI models' },
    { name: 'Gemma', logo: 'https://img.shields.io/badge/Google-4285F4?style=flat&logo=google&logoColor=white', description: 'Google Gemma models' },
    { name: 'DeepSeek', logo: 'https://img.shields.io/badge/DeepSeek-000000?style=flat&logo=data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMTIiIGN5PSIxMiIgcj0iMTAiIGZpbGw9IndoaXRlIi8+CjxjaXJjbGUgY3g9IjEyIiBjeT0iMTIiIHI9IjMiIGZpbGw9ImJsYWNrIi8+Cjwvc3ZnPgo=&logoColor=white', description: 'DeepSeek models' },
    { name: 'Llama', logo: 'https://img.shields.io/badge/Meta-1877F2?style=flat&logo=meta&logoColor=white', description: 'Meta Llama models' },
    { name: 'CodeLlama', logo: 'https://img.shields.io/badge/Meta-1877F2?style=flat&logo=meta&logoColor=white', description: 'Meta CodeLlama models' },
    { name: 'Falcon', logo: 'https://img.shields.io/badge/TII-2E8B57?style=flat&logo=data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTEyIDJMMTggN0wxNSAxMkwxOCAxN0wxMiAyMkw2IDE3TDkgMTJMNiA3TDEyIDJaIiBmaWxsPSJ3aGl0ZSIvPgo8L3N2Zz4K&logoColor=white', description: 'TII Falcon models' },
  ];

  useEffect(() => {
    loadModels();
  }, []);

  // Load available models function
  const loadModels = async () => {
    try {
      setIsLoadingModels(true);
      setModelError(null);
      // Use prediction service to get detailed model info for fine-tuned models
      const models = await predictionService.getAvailableModels();
      setAvailableModels(models as any); // Type assertion for compatibility
      
      // Set default selected models
      if (models.length > 0) {
        setSelectedModelId(models[0].model_id);
      }
    } catch (error: any) {
      console.error('Failed to load models:', error);
      setModelError(error.message || 'Failed to load available models. Please try again.');
    } finally {
      setIsLoadingModels(false);
    }
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
    
    // Load models for the selected tab if not already loaded
    if (tab === 'huggingface' && huggingFaceModels.length === 0) {
      loadHuggingFaceModels();
    }
    
    // Set default selected model for the tab
    const models = tab === 'finetuned' ? availableModels : huggingFaceModels;
    if (models.length > 0) {
      setSelectedModelId(models[0].id);
    }
  };

  // Handle model selection change
  const handleModelSelection = (modelId: string) => {
    setSelectedModelId(modelId);
    // Reset mapping when model changes
    setPredictionMapping({
      input_columns: {},
      preprocessing_options: {
        normalize_text: true,
        handle_missing_values: 'default',
        default_values: {}
      }
    });
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
      } else {
        setSelectedModelId('');
      }
    } catch (error: any) {
      console.error('Failed to search Hugging Face models:', error);
      setSearchError(error.message || 'Search failed. Please try again.');
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
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
      } else {
        setSelectedModelId('');
      }
    } catch (error: any) {
      console.error('Failed to search Hugging Face models:', error);
      setSearchError(error.message || 'Search failed. Please try again.');
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleFileUpload = async (file: File) => {
    try {
      setIsLoading(true);
      setError(null);
      
      const result = await fileService.uploadFile(file, file.name);
      
      if (result.success && result.file_id) {
        setUploadedFile(result);
        
        // Get column information
        const columnInfoResult = await fileService.getColumnInfo(result.file_id);
        setColumnInfo(columnInfoResult.column_info);
        setAvailableColumns(columnInfoResult.available_columns);
        
        setCurrentMode('mapping');
      } else {
        throw new Error(result.message || 'Upload failed');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to upload file');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartPrediction = async () => {
    if (!uploadedFile || !selectedModel) return;
    
    try {
      setIsLoading(true);
      setError(null);
      
      // Get model path - for HF models use the name directly, for local models use name
      const modelPath = activeTab === 'huggingface' 
        ? selectedModel.name  // Use HF model name directly
        : selectedModel.name; // Use local model name
      
      const job = await predictionService.startPrediction({
        file_id: uploadedFile.file_id!,
        model_id: modelPath,
        mapping: predictionMapping
      });
      
      setCurrentJob(job);
      setCurrentMode('predict');
      
      // Start polling for progress
      pollPredictionProgress(job.job_id);
      
    } catch (err: any) {
      setError(err.message || 'Failed to start prediction');
    } finally {
      setIsLoading(false);
    }
  };

  const pollPredictionProgress = async (jobId: string) => {
    const interval = setInterval(async () => {
      try {
        const updatedJob = await predictionService.getPredictionStatus(jobId);
        setCurrentJob(updatedJob);
        
        if (updatedJob.status === 'completed') {
          // Load results
          const results = await predictionService.getPredictionResults(jobId);
          setPredictionResults(results.results);
          setCurrentMode('results');
          clearInterval(interval);
        } else if (updatedJob.status === 'failed') {
          setError(updatedJob.error_message || 'Prediction failed');
          clearInterval(interval);
        }
      } catch (err: any) {
        console.error('Error polling prediction progress:', err);
        // Continue polling unless it's a critical error
      }
    }, 2000); // Poll every 2 seconds
    
    // Clean up interval after 10 minutes to prevent infinite polling
    setTimeout(() => {
      clearInterval(interval);
    }, 10 * 60 * 1000);
  };

  const simulatePredictionProgress = (job: PredictionJob) => {
    const interval = setInterval(() => {
      setCurrentJob(prev => {
        if (!prev || prev.status === 'completed') {
          clearInterval(interval);
          return prev;
        }
        
        const newProcessed = Math.min(prev.processed_rows + 10, prev.total_rows);
        const newProgress = (newProcessed / prev.total_rows) * 100;
        
        if (newProcessed >= prev.total_rows) {
          // Generate mock results
          const mockResults: PredictionResult[] = Array.from({ length: 5 }, (_, i) => ({
            row_index: i,
            input_data: {
              message: `Sample message ${i + 1}`,
              customer_type: 'premium'
            },
            prediction: {
              category: ['billing', 'technical', 'general'][i % 3],
              confidence: 0.85 + Math.random() * 0.1
            },
            confidence: 0.85 + Math.random() * 0.1,
            processing_time_ms: 50 + Math.random() * 100
          }));
          
          setPredictionResults(mockResults);
          setCurrentMode('results');
          clearInterval(interval);
          
          return {
            ...prev,
            status: 'completed',
            progress: 100,
            processed_rows: prev.total_rows,
            results: mockResults,
            completed_at: new Date().toISOString()
          };
        }
        
        return {
          ...prev,
          progress: newProgress,
          processed_rows: newProcessed
        };
      });
    }, 500);
  };

  const canProceedToMapping = uploadedFile && selectedModel;

  const UploadView = () => (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Generate Predictions</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Select a model and upload data to generate predictions
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Select Models</CardTitle>
              <CardDescription>
                Choose which model to use for predictions
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
                    <AlertTriangle className="h-6 w-6 text-red-500" />
                    <span className="ml-2 text-sm text-red-600">{activeTab === 'finetuned' ? modelError : hfModelError}</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={activeTab === 'finetuned' ? loadModels : loadHuggingFaceModels}
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
                          <AlertTriangle className="h-4 w-4 mr-2" />
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
                      disabled={currentModels.length === 0}
                    >
                      {currentModels.length === 0 ? (
                        <option value="">No models available</option>
                      ) : (
                        currentModels.map((model: any) => (
                          <option key={activeTab === 'finetuned' ? model.model_id : model.id} value={activeTab === 'finetuned' ? model.model_id : model.id}>
                            {model.name}
                            {activeTab === 'huggingface' && model.family && ` (${model.family})`}
                          </option>
                        ))
                      )}
                    </select>
                  </div>
                </>
              )}
              
              <div className="pt-4">
                <h4 className="text-sm font-medium mb-3">Parameters</h4>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label htmlFor="batchSize" className="text-xs font-medium">
                        Batch Size
                      </label>
                      <span className="text-xs">{batchSize}</span>
                    </div>
                    <input
                      type="range"
                      id="batchSize"
                      min="10"
                      max="100"
                      step="10"
                      value={batchSize}
                      onChange={(e) => setBatchSize(parseInt(e.target.value))}
                      className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-primary-600"
                    />
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>Small</span>
                      <span>Large</span>
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
                      min="50"
                      max="500"
                      step="25"
                      value={maxTokens}
                      onChange={(e) => setMaxTokens(parseInt(e.target.value))}
                      className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-primary-600"
                    />
                  </div>
                  
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
                </div>
              </div>
            </CardContent>
            <CardFooter className="border-t flex-col space-y-3 items-start">
              {selectedModel && activeTab === 'finetuned' ? (
                // Detailed info for fine-tuned models
                <div className="w-full space-y-4">
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    <p className="font-medium mb-2">Model Details</p>
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                        <div>Type: <span className="text-gray-700 dark:text-gray-300">Fine-tuned</span></div>
                        <div>Status: <span className="text-green-600 dark:text-green-400">{(selectedModel as any).status || 'Ready'}</span></div>
                        <div>Base Model: <span className="text-gray-700 dark:text-gray-300">{(selectedModel as any).base_model || 'N/A'}</span></div>
                        <div>Version: <span className="text-gray-700 dark:text-gray-300">{(selectedModel as any).version || '1.0'}</span></div>
                      </div>
                      {(selectedModel as any).accuracy && (
                        <div className="mt-2 p-2 bg-green-50 dark:bg-green-900/20 rounded">
                          <div className="text-green-800 dark:text-green-200 font-medium">
                            Accuracy: {((selectedModel as any).accuracy * 100).toFixed(1)}%
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    <p className="font-medium mb-2">Training Information</p>
                    <div className="space-y-1">
                      <div>Created: <span className="text-gray-700 dark:text-gray-300">{new Date((selectedModel as any).created_at).toLocaleDateString()}</span></div>
                      {(selectedModel as any).training_session_id && (
                        <div>Session: <span className="text-gray-700 dark:text-gray-300">{(selectedModel as any).training_session_id}</span></div>
                      )}
                      {(selectedModel as any).model_type && (
                        <div>Type: <span className="text-gray-700 dark:text-gray-300">{(selectedModel as any).model_type}</span></div>
                      )}
                    </div>
                  </div>

                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    <p className="font-medium mb-2">Input Schema</p>
                    <div className="bg-gray-50 dark:bg-gray-800 p-2 rounded text-xs">
                      {(selectedModel as any).input_schema ? (
                        Object.entries((selectedModel as any).input_schema).map(([key, type]) => (
                          <div key={key} className="flex justify-between">
                            <span className="text-gray-700 dark:text-gray-300">{key}:</span>
                            <span className="text-blue-600 dark:text-blue-400">{type as string}</span>
                          </div>
                        ))
                      ) : (
                        <span className="text-gray-500">No schema available</span>
                      )}
                    </div>
                  </div>

                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    <p className="font-medium mb-2">Output Schema</p>
                    <div className="bg-gray-50 dark:bg-gray-800 p-2 rounded text-xs">
                      {(selectedModel as any).output_schema ? (
                        Object.entries((selectedModel as any).output_schema).map(([key, type]) => (
                          <div key={key} className="flex justify-between">
                            <span className="text-gray-700 dark:text-gray-300">{key}:</span>
                            <span className="text-green-600 dark:text-green-400">{type as string}</span>
                          </div>
                        ))
                      ) : (
                        <span className="text-gray-500">No schema available</span>
                      )}
                    </div>
                  </div>
                </div>
              ) : selectedModel && activeTab === 'huggingface' ? (
                // Basic info for Hugging Face models
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  <p className="font-medium mb-1">Selected Model Info</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                    <div>Size: <span className="text-gray-700 dark:text-gray-300">{(selectedModel as any).size || 'N/A'}</span></div>
                    <div>Type: <span className="text-gray-700 dark:text-gray-300">{(selectedModel as any).isBase ? 'Base' : 'Pre-trained'}</span></div>
                    {(selectedModel as any).family && (
                      <div className="col-span-2">Family: <span className="text-gray-700 dark:text-gray-300">{(selectedModel as any).family}</span></div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  <p>Select a model to view details</p>
                </div>
              )}
              
              <Button
                variant="outline"
                size="sm"
                leftIcon={<DownloadCloud className="h-4 w-4" />}
                className="w-full"
                disabled
              >
                Download Model
              </Button>
            </CardFooter>
          </Card>
        </div>
        
        <div className="lg:col-span-3 h-full flex flex-col">
          <Card className="flex-1 flex flex-col h-full min-h-[600px]">
            <CardHeader className="border-b flex-shrink-0">
              <div className="flex items-center space-x-3">
                <BarChart3 className="h-5 w-5 text-primary-500" />
                <div>
                  <CardTitle>Model Prediction</CardTitle>
                  <CardDescription>
                    Upload data to generate predictions with your selected model
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex-1 p-6">
              <div className="space-y-6">
                {/* File Upload Area */}
                <div>
                  <h3 className="text-lg font-medium mb-4">Upload Data File</h3>
                  <div className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg p-8 text-center">
                    <input
                      type="file"
                      accept=".csv,.json,.jsonl"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          handleFileUpload(file);
                        }
                      }}
                      className="hidden"
                      id="prediction-file-upload"
                      disabled={isLoading || !selectedModel}
                    />
                    <label
                      htmlFor="prediction-file-upload"
                      className={`cursor-pointer flex flex-col items-center ${
                        isLoading || !selectedModel ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                    >
                      <div className="p-4 rounded-full bg-primary-100 dark:bg-primary-900/20">
                        <Upload className="h-8 w-8 text-primary-600 dark:text-primary-400" />
                      </div>
                      <div className="space-y-2 mt-3">
                        <p className="text-lg font-medium">
                          {isLoading ? 'Uploading...' : 'Drag & drop your data file here or click to browse'}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {!selectedModel ? 'Select a model first' : 'Supports CSV, JSON, and JSONL files up to 50MB'}
                        </p>
                      </div>
                    </label>
                  </div>
                </div>

                {uploadedFile && (
                  <div className="p-4 bg-success-50 dark:bg-success-900/20 rounded-lg border border-success-200 dark:border-success-800">
                    <div className="flex items-start gap-2">
                      <CheckCircle className="h-5 w-5 text-success-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-success-800 dark:text-success-200">
                          File Uploaded Successfully
                        </p>
                        <p className="text-sm text-success-700 dark:text-success-300 mt-1">
                          {uploadedFile.metadata?.original_filename} ready for prediction
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Prediction Guidelines */}
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
                    💡 Prediction Guidelines
                  </h4>
                  <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
                    <li>• Ensure your data format matches the model's expected input</li>
                    <li>• Include all required fields for accurate predictions</li>
                    <li>• Larger batch sizes process faster but use more memory</li>
                    <li>• Adjust temperature for more creative (higher) or precise (lower) outputs</li>
                  </ul>
                </div>
              </div>
            </CardContent>
            <CardFooter className="border-t p-6">
              <div className="w-full flex justify-end">
                <Button
                  variant="primary"
                  size="lg"
                  rightIcon={<ArrowRight className="h-5 w-5" />}
                  disabled={!selectedModel || !uploadedFile || isLoading}
                  onClick={() => setCurrentMode('mapping')}
                  className="px-8"
                >
                  {isLoading ? 'Processing...' : 'Next: Map Columns'}
                </Button>
              </div>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );

  const MappingView = () => {
    if (!uploadedFile || !selectedModel) {
      return (
        <div className="text-center py-8">
          <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
            Missing Requirements
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            Please upload a file and select a model first
          </p>
          <Button 
            variant="outline" 
            onClick={() => setCurrentMode('upload')}
            className="mt-4"
          >
            Back to Upload
          </Button>
        </div>
      );
    }

    const handleMappingComplete = async (mapping: PredictionMapping) => {
      setPredictionMapping(mapping);
      
      // Start prediction immediately after mapping is complete
      try {
        setIsLoading(true);
        setError(null);
        
        const job = await predictionService.startPrediction({
          file_id: uploadedFile.file_id!,
          model_id: selectedModel.name, // Use model name instead of model_id
          mapping: mapping
        });
        
        setCurrentJob(job);
        setCurrentMode('predict');
        
        // Start polling for progress
        pollPredictionProgress(job.job_id);
        
      } catch (err: any) {
        setError(err.message || 'Failed to start prediction');
      } finally {
        setIsLoading(false);
      }
    };

    return (
      <PredictionMappingInterface
        fileId={uploadedFile.file_id!}
        availableColumns={availableColumns}
        columnInfo={columnInfo}
        selectedModel={selectedModel as any} // Type assertion to handle Model vs ModelInfo mismatch
        onMappingComplete={handleMappingComplete}
        onCancel={() => setCurrentMode('upload')}
        initialMapping={predictionMapping}
      />
    );
  };

  const PredictView = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          Generating Predictions
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Please wait while we process your data...
        </p>
      </div>

      {currentJob && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Clock className="h-5 w-5 mr-2" />
              Prediction Progress
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Processing {currentJob.processed_rows} of {currentJob.total_rows} rows
              </span>
              <span className="text-sm font-medium">
                {currentJob.progress.toFixed(1)}%
              </span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${currentJob.progress}%` }}
              />
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Status: {currentJob.status}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );

  const ResultsView = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Prediction Results
        </h2>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setCurrentMode('upload')}>
            New Prediction
          </Button>
          <Button>
            <Download className="h-4 w-4 mr-2" />
            Export Results
          </Button>
        </div>
      </div>

      {currentJob && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <CheckCircle className="h-5 w-5 mr-2 text-green-500" />
              Prediction Completed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {currentJob.total_rows}
                </div>
                <div className="text-sm text-green-800 dark:text-green-200">
                  Rows Processed
                </div>
              </div>
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {selectedModel?.name}
                </div>
                <div className="text-sm text-blue-800 dark:text-blue-200">
                  Model Used
                </div>
              </div>
              <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
                <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                  {currentJob.completed_at && currentJob.created_at ? 
                    Math.round((new Date(currentJob.completed_at).getTime() - new Date(currentJob.created_at).getTime()) / 1000) : 0}s
                </div>
                <div className="text-sm text-purple-800 dark:text-purple-200">
                  Processing Time
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <BarChart3 className="h-5 w-5 mr-2" />
            Sample Results
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {predictionResults.slice(0, 10).map((result, index) => (
              <div key={index} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-medium text-sm text-gray-600 dark:text-gray-400 mb-2">
                      Input Data:
                    </h4>
                    <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded text-sm">
                      {JSON.stringify(result.input_data, null, 2)}
                    </div>
                  </div>
                  <div>
                    <h4 className="font-medium text-sm text-gray-600 dark:text-gray-400 mb-2">
                      Prediction:
                    </h4>
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded text-sm">
                      {JSON.stringify(result.prediction, null, 2)}
                    </div>
                    {result.confidence && (
                      <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                        Confidence: {(result.confidence * 100).toFixed(1)}%
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Error Display */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
            <span className="text-red-700 dark:text-red-300">{error}</span>
          </div>
        </div>
      )}

      <AnimatePresence mode="wait">
        <motion.div
          key={currentMode}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
        >
          {currentMode === 'upload' && <UploadView />}
          {currentMode === 'mapping' && <MappingView />}
          {currentMode === 'predict' && <PredictView />}
          {currentMode === 'results' && <ResultsView />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default Prediction;
