import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../../components/ui/Card';
import { Progress } from '../../components/ui/Progress';
import { cn } from '../../utils/cn';
import { Button } from '../../components/ui/Button';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, AlertTriangle, ArrowRight, Brain, CheckCircle, DownloadCloud, Loader2, BarChart3 } from 'lucide-react';
import { evaluationService, EvaluationMapping } from '../../services/evaluationService';
import { AnimatedLoader } from '../../components/ui/AnimatedLoader';
import EvaluationMappingInterface from '../../components/ui/EvaluationMappingInterface';

// Define Model type for evaluation
interface Model {
  id: string;
  name: string;
  description?: string;
  size?: string;
  family?: string;
  isBase?: boolean;
  input_schema?: Record<string, any>;
  output_schema?: Record<string, any>;
  metadata?: Record<string, any>;
  // Additional fields from API response
  created_at?: string;
  accuracy?: number;
  status?: string;
  training_session_id?: string;
  model_type?: string;
  version?: string;
  model_path?: string;
  base_model?: string;
}

export default function TestData() {
  const navigate = useNavigate();
  
  // Model selection state
  const [activeTab, setActiveTab] = useState<'finetuned' | 'huggingface'>('finetuned');
  const [availableModels, setAvailableModels] = useState<Model[]>([]);
  const [huggingFaceModels, setHuggingFaceModels] = useState<Model[]>([]);
  const [searchResults, setSearchResults] = useState<Model[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selectedModelId, setSelectedModelId] = useState('');
  const [compareModelId, setCompareModelId] = useState('');
  const [showCompare, setShowCompare] = useState(false);
  const [isLoadingModels, setIsLoadingModels] = useState(true);
  const [isLoadingHFModels, setIsLoadingHFModels] = useState(true);
  const [modelError, setModelError] = useState<string | null>(null);
  const [hfModelError, setHFModelError] = useState<string | null>(null);
  
  // Evaluation parameters
  const [batchSize, setBatchSize] = useState(50);
  const [maxTokens, setMaxTokens] = useState(150);
  const [temperature, setTemperature] = useState(0.7);
  
  // File upload state
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationResult, setValidationResult] = useState<any>(null);
  
  // Upload progress state
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'processing' | 'complete' | 'error'>('idle');
  const [uploadedFileName, setUploadedFileName] = useState<string>('');
  
  // Mapping interface state
  const [showMappingInterface, setShowMappingInterface] = useState(false);
  const [fileContent, setFileContent] = useState<string>('');
  const [fileType, setFileType] = useState<'csv' | 'json' | 'jsonl' | 'pkl' | 'pickle' | null>(null);
  const [availableColumns, setAvailableColumns] = useState<string[]>([]);
  const [columnInfo, setColumnInfo] = useState<Record<string, any>>({});
  const [isAnalyzingFile, setIsAnalyzingFile] = useState(false);

  // Get current models list based on active tab
  const currentModels = activeTab === 'finetuned' ? availableModels : huggingFaceModels;
  
  // Get selected model info
  const selectedModel = currentModels.find((m: Model) => m.id === selectedModelId);
  const compareModel = currentModels.find((m: Model) => m.id === compareModelId);

  // Debug logging to see what's in the selected model
  useEffect(() => {
    if (selectedModel) {
      console.log('Selected model debug info:', {
        id: selectedModel.id,
        name: selectedModel.name,
        input_schema: selectedModel.input_schema,
        output_schema: selectedModel.output_schema,
        hasInputSchema: !!selectedModel.input_schema,
        hasOutputSchema: !!selectedModel.output_schema,
        inputSchemaKeys: Object.keys(selectedModel.input_schema || {}),
        outputSchemaKeys: Object.keys(selectedModel.output_schema || {}),
        inputSchemaLength: Object.keys(selectedModel.input_schema || {}).length,
        outputSchemaLength: Object.keys(selectedModel.output_schema || {}).length
      });
    }
  }, [selectedModel]);

  // Load available models function
  const loadModels = async () => {
    try {
      setIsLoadingModels(true);
      setModelError(null);
      const models = await evaluationService.getAvailableModels();
      console.log('Raw models from evaluation service:', models);
      
      // Transform models to match our interface
      const transformedModels = models.map(model => ({
        id: model.model_id,  // Use model_id as id
        name: model.name,
        description: model.description,
        input_schema: model.input_schema,
        output_schema: model.output_schema,
        metadata: model.metadata,
        // Add other fields from the API response
        created_at: model.created_at,
        accuracy: model.accuracy,
        status: model.status,
        training_session_id: model.training_session_id,
        model_type: model.model_type,
        version: model.version,
        model_path: model.model_path,
        base_model: model.base_model
      }));
      
      console.log('Transformed models:', transformedModels);
      setAvailableModels(transformedModels);
      
      // Set default selected models
      if (transformedModels.length > 0) {
        setSelectedModelId(transformedModels[0].id);
        if (transformedModels.length > 1) {
          setCompareModelId(transformedModels[1].id);
        }
      }
    } catch (error: any) {
      console.error('Failed to load models:', error);
      setModelError(error.message || 'Failed to load available models. Please try again.');
    } finally {
      setIsLoadingModels(false);
    }
  };

  // Load Hugging Face models function - for now, use same models as finetuned
  const loadHuggingFaceModels = async () => {
    try {
      setIsLoadingHFModels(true);
      setHFModelError(null);
      // For now, use the same models from evaluation service
      // In the future, this could be extended to support HF models specifically
      const models = await evaluationService.getAvailableModels();
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

  // Handle model selection change
  const handleModelSelection = (modelId: string) => {
    setSelectedModelId(modelId);
  };

  // Handle search for Hugging Face models - disabled for now since we're using prediction service models
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    setSearchError('Search functionality will be available when HuggingFace models are integrated with the prediction service.');
  };

  // Handle chip click to search for model family
  const handleChipClick = (modelFamily: string) => {
    setSearchQuery(modelFamily);
    setSearchError('Search functionality will be available when HuggingFace models are integrated with the prediction service.');
  };

  // Handle search with specific query
  const handleSearchWithQuery = async (query: string) => {
    if (!query.trim()) return;
    
    setSearchError('Search functionality will be available when HuggingFace models are integrated with the prediction service.');
  };

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

  // File upload handling
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'text/csv': ['.csv'],
      'application/json': ['.json'],
      'application/jsonl': ['.jsonl'],
      'application/octet-stream': ['.pkl', '.pickle']
    },
    maxFiles: 1,
    onDrop: async (acceptedFiles) => {
      const uploadedFile = acceptedFiles[0];
      setFile(uploadedFile);
      setError(null);
      setValidationResult(null);

      // Validate file format
      if (uploadedFile) {
        try {
          const fileType = evaluationService.getFileType(uploadedFile.name);
          if (!fileType) {
            setError('Unsupported file format. Please upload CSV, JSON, JSONL, or Pickle files.');
            return;
          }

          // For small files, validate the content
          if (uploadedFile.size < 1024 * 1024) { // Less than 1MB
            const text = await uploadedFile.text();
            let data: any[];

            if (fileType === 'csv') {
              // Basic CSV validation - just check if it has headers
              const lines = text.split('\n').filter(line => line.trim());
              if (lines.length < 2) {
                setError('CSV file must have at least a header row and one data row.');
                return;
              }
              setValidationResult({ 
                isValid: true, 
                totalRows: lines.length - 1,
                fileType: 'CSV'
              });
            } else if (fileType === 'json') {
              try {
                data = JSON.parse(text);
                if (!Array.isArray(data)) {
                  data = [data]; // Convert single object to array
                }
                const validation = evaluationService.validateTestData(data);
                console.log(validation, "data")
                setValidationResult({
                  ...validation,
                  totalRows: data.length,
                  fileType: 'json'
                });
                if (!validation.isValid) {
                  setError(`Validation errors: ${validation.errors.join(', ')}`);
                }
              } catch (e) {
                setError('Invalid JSON format. Please check your file.');
              }
            } else if (fileType === 'jsonl') {
              try {
                const lines = text.split('\n').filter(line => line.trim());
                data = lines.map(line => JSON.parse(line));
                const validation = evaluationService.validateTestData(data);
                setValidationResult({
                  ...validation,
                  totalRows: data.length,
                  fileType: 'JSONL'
                });
                if (!validation.isValid) {
                  setError(`Validation errors: ${validation.errors.join(', ')}`);
                }
              } catch (e) {
                setError('Invalid JSONL format. Each line must be valid JSON.');
              }
            }
          } else {
            // For large files, just show basic info
            setValidationResult({
              isValid: true,
              totalRows: 'Large file - will validate during upload',
              fileType: fileType.toUpperCase()
            });
          }
        } catch (e) {
          setError('Error validating file. Please try again.');
        }
      }
    }
  });

  // Convert file to base64 (same pattern as training module)
  const readFileContent = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        // Convert to base64 and remove data URL prefix
        const base64String = reader.result as string;
        const base64Content = base64String.split(',')[1];
        resolve(base64Content);
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  };

  const handleStartEvaluation = async () => {
    if (!selectedModel || !file) return;
    
    setIsLoading(true);
    setError(null);
    setUploadProgress(0);
    setUploadStatus('uploading');
    setUploadedFileName(file.name);

    try {
      // Simulate upload progress since the current backend doesn't support streaming
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90; // Stop at 90% until actual upload completes
          }
          return prev + Math.random() * 15;
        });
      }, 200);

      // Convert file to base64 and get file type
      const content = await readFileContent(file);
      const type = evaluationService.getFileType(file.name);
      
      // Clear the progress interval
      clearInterval(progressInterval);
      
      if (!type) {
        throw new Error('Unsupported file format');
      }
      
      setUploadProgress(95);
      setUploadStatus('processing');
      
      // Store file content and type for mapping interface
      setFileContent(content);
      setFileType(type);
      
      // Analyze file columns
      setIsAnalyzingFile(true);
      const analysis = await evaluationService.analyzeFileColumns(content, type);
      setAvailableColumns(analysis.columns);
      setColumnInfo(analysis.columnInfo);
      setIsAnalyzingFile(false);
      
      setUploadProgress(100);
      setUploadStatus('complete');
      
      // Small delay to show completion
      setTimeout(() => {
        // Show mapping interface
        setShowMappingInterface(true);
        // Reset upload state
        setUploadProgress(0);
        setUploadStatus('idle');
        setUploadedFileName('');
      }, 1000);
      
    } catch (error: any) {
      setError(error.message || 'Failed to analyze file. Please try again.');
      setUploadStatus('error');
      setUploadProgress(0);
      setIsAnalyzingFile(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMappingComplete = async (mapping: EvaluationMapping) => {
    if (!selectedModel || !fileContent || !fileType) return;
    
    setIsLoading(true);
    setError(null);

    try {
      // Get model path - for HF models use the name directly, for local models use name
      const modelPath = activeTab === 'huggingface' 
        ? selectedModel.name  // Use HF model name directly
        : selectedModel.name; // Use local model name
      
      // Start prediction job with mapping
      const response = await evaluationService.startPredictionJobWithMapping(
        modelPath,
        fileContent,
        fileType,
        mapping,
        batchSize
      );

      // Store job info and navigate to metrics page
      localStorage.setItem('evaluationJobId', response.job_id);
      localStorage.setItem('evaluationModel', JSON.stringify(selectedModel));
      
      navigate('/evaluate/metrics');
    } catch (error: any) {
      setError(error.message || 'Failed to start evaluation. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleMappingCancel = () => {
    setShowMappingInterface(false);
    setFileContent('');
    setFileType(null);
    setAvailableColumns([]);
    setColumnInfo({});
  };

  // Load available models on component mount
  useEffect(() => {
    loadModels();
  }, []);

  // Convert Model to ModelInfo for the mapping interface
  const convertModelToModelInfo = (model: Model) => {
    return {
      model_id: model.id,
      name: model.name,
      description: model.description || '',
      input_schema: model.input_schema || {},
      output_schema: model.output_schema || {},
      created_at: (model as any).created_at || new Date().toISOString(),
      accuracy: (model as any).accuracy,
      status: 'ready' as const,
      training_session_id: (model as any).training_session_id,
      model_type: (model as any).model_type,
      version: (model as any).version,
      metadata: model.metadata || {}
    };
  };

  // Show mapping interface if needed
  if (showMappingInterface && selectedModel && fileContent && fileType) {
    return (
      <EvaluationMappingInterface
        fileId="temp-file-id"
        availableColumns={availableColumns}
        columnInfo={columnInfo}
        selectedModel={convertModelToModelInfo(selectedModel)}
        onMappingComplete={handleMappingComplete}
        onCancel={handleMappingCancel}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Evaluate Model</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Select a model and upload test data to evaluate its performance
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Select Models</CardTitle>
              <CardDescription>
                Choose which models to evaluate
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
                        currentModels.map((model) => (
                          <option key={model.id} value={model.id}>
                            {model.name}
                            {activeTab === 'huggingface' && model.family && ` (${model.family})`}
                          </option>
                        ))
                      )}
                    </select>
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
                        <div>Status: <span className="text-green-600 dark:text-green-400">{selectedModel.status || 'Ready'}</span></div>
                        <div>Base Model: <span className="text-gray-700 dark:text-gray-300">{selectedModel.base_model || 'N/A'}</span></div>
                        <div>Version: <span className="text-gray-700 dark:text-gray-300">{selectedModel.version || '1.0'}</span></div>
                      </div>
                      {selectedModel.accuracy && (
                        <div className="mt-2 p-2 bg-green-50 dark:bg-green-900/20 rounded">
                          <div className="text-green-800 dark:text-green-200 font-medium">
                            Accuracy: {(selectedModel.accuracy * 100).toFixed(1)}%
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    <p className="font-medium mb-2">Training Information</p>
                    <div className="space-y-1">
                      <div>Created: <span className="text-gray-700 dark:text-gray-300">{new Date(selectedModel.created_at || Date.now()).toLocaleDateString()}</span></div>
                      {selectedModel.training_session_id && (
                        <div>Session: <span className="text-gray-700 dark:text-gray-300">{selectedModel.training_session_id}</span></div>
                      )}
                      {selectedModel.model_type && (
                        <div>Type: <span className="text-gray-700 dark:text-gray-300">{selectedModel.model_type}</span></div>
                      )}
                    </div>
                  </div>

                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    <p className="font-medium mb-2">Input Schema</p>
                    <div className="bg-gray-50 dark:bg-gray-800 p-2 rounded text-xs">
                      {selectedModel.input_schema ? (
                        Object.entries(selectedModel.input_schema).map(([key, type]) => (
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
                      {selectedModel.output_schema ? (
                        Object.entries(selectedModel.output_schema).map(([key, type]) => (
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
                  <CardTitle>Model Evaluation</CardTitle>
                  <CardDescription>
                    Upload test data to evaluate your selected model
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex-1 p-6">
              <div className="space-y-6">
                {/* File Upload Area */}
                <div>
                  <h3 className="text-lg font-medium mb-4">Upload Test Dataset</h3>
                  <div 
                    {...getRootProps()} 
                    className={cn(
                      "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
                      isDragActive 
                        ? "border-primary-500 bg-primary-50 dark:bg-primary-900/10" 
                        : "border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600"
                    )}
                  >
                    <input {...getInputProps()} />
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <div className="p-4 rounded-full bg-primary-100 dark:bg-primary-900/20">
                        <Upload className="h-8 w-8 text-primary-600 dark:text-primary-400" />
                      </div>
                      <div className="space-y-2">
                        <p className="text-lg font-medium">
                          {isDragActive ? "Drop the file here" : "Drag & drop your test file here or click to browse"}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          Supports CSV, JSON, JSONL, and Pickle files up to 50MB
                        </p>
                        <p className="text-xs text-gray-400">
                          Required fields: instruction, output | Optional: input
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Validation Results */}
                {error && (
                  <div className="p-4 bg-error-50 dark:bg-error-900/20 rounded-lg border border-error-200 dark:border-error-800">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-5 w-5 text-error-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-error-800 dark:text-error-200">
                          Validation Error
                        </p>
                        <p className="text-sm text-error-700 dark:text-error-300 mt-1">
                          {error}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {validationResult && validationResult.isValid && (
                  <div className="p-4 bg-success-50 dark:bg-success-900/20 rounded-lg border border-success-200 dark:border-success-800">
                    <div className="flex items-start gap-2">
                      <CheckCircle className="h-5 w-5 text-success-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-success-800 dark:text-success-200">
                          File Validated Successfully
                        </p>
                        <p className="text-sm text-success-700 dark:text-success-300 mt-1">
                          {validationResult.fileType} file with {validationResult.totalRows} rows ready for evaluation
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* File Info */}
                {file && (
                  <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <FileText className="h-5 w-5 text-gray-500 mr-3" />
                        <div>
                          <p className="text-sm font-medium">{file.name}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {(file.size / 1024).toFixed(2)} KB
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setFile(null);
                          setValidationResult(null);
                          setError(null);
                        }}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                )}

                {/* Upload Progress */}
                {uploadStatus !== 'idle' && (
                  <Card className="bg-gray-50 dark:bg-gray-800">
                    <CardContent className="p-4">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            {uploadedFileName}
                          </span>
                          <span className="text-sm text-gray-500 dark:text-gray-400">
                            {uploadStatus === 'uploading' ? 'Uploading' :
                             uploadStatus === 'processing' ? 'Processing' :
                             uploadStatus === 'complete' ? 'Complete' :
                             uploadStatus === 'error' ? 'Failed' : ''}
                          </span>
                        </div>
                        
                        <Progress
                          value={uploadProgress}
                          max={100}
                          variant={
                            uploadStatus === 'complete' ? 'success' :
                            uploadStatus === 'error' ? 'error' :
                            'primary'
                          }
                          showValue={true}
                          formatValue={(value, max) => `${Math.round(value)}%`}
                        />
                        
                        <div className="flex items-center text-sm">
                          {uploadStatus === 'uploading' && (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                              <span className="text-blue-600 dark:text-blue-400">Uploading test data...</span>
                            </>
                          )}
                          {uploadStatus === 'processing' && (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-600 mr-2"></div>
                              <span className="text-purple-600 dark:text-purple-400">Analyzing file structure...</span>
                            </>
                          )}
                          {uploadStatus === 'complete' && (
                            <>
                              <CheckCircle className="h-4 w-4 text-green-600 mr-2" />
                              <span className="text-green-600 dark:text-green-400">Upload completed successfully!</span>
                            </>
                          )}
                          {uploadStatus === 'error' && (
                            <>
                              <AlertTriangle className="h-4 w-4 text-red-600 mr-2" />
                              <span className="text-red-600 dark:text-red-400">Upload failed. Please try again.</span>
                            </>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Evaluation Guidelines */}
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
                    💡 Evaluation Guidelines
                  </h4>
                  <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
                    <li>• Test data should be different from training data</li>
                    <li>• Include diverse test cases and edge cases</li>
                    <li>• Aim for at least 100 test examples for reliable metrics</li>
                    <li>• Ensure consistent formatting with your training data</li>
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
                  disabled={(() => {
                    const hasModel = !!selectedModel;
                    const hasFile = !!file;
                    const notLoading = !isLoading;
                    const validFile = !validationResult || validationResult.isValid;
                    const hasInputSchema = selectedModel && !!selectedModel.input_schema;
                    const hasOutputSchema = selectedModel && !!selectedModel.output_schema;
                    const inputSchemaHasFields = selectedModel && Object.keys(selectedModel.input_schema || {}).length > 0;
                    const outputSchemaHasFields = selectedModel && Object.keys(selectedModel.output_schema || {}).length > 0;
                    
                    const shouldEnable = hasModel && hasFile && notLoading && validFile && hasInputSchema && hasOutputSchema && inputSchemaHasFields && outputSchemaHasFields;
                    
                    console.log('Button validation debug:', {
                      hasModel,
                      hasFile,
                      notLoading,
                      validFile,
                      hasInputSchema,
                      hasOutputSchema,
                      inputSchemaHasFields,
                      outputSchemaHasFields,
                      shouldEnable,
                      selectedModelId,
                      selectedModelName: selectedModel?.name,
                      inputSchemaKeys: selectedModel ? Object.keys(selectedModel.input_schema || {}) : [],
                      outputSchemaKeys: selectedModel ? Object.keys(selectedModel.output_schema || {}) : []
                    });
                    
                    return !shouldEnable;
                  })()}
                  onClick={handleStartEvaluation}
                  isLoading={isLoading}
                  className="px-8"
                >
                  {isLoading ? 'Starting Evaluation...' : 'Start Evaluation'}
                </Button>
              </div>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}
