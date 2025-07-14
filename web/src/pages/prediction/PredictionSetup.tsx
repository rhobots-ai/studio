import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { ArrowRight, AlertTriangle, Upload, CheckCircle, DownloadCloud, Loader2, BarChart3 } from 'lucide-react';
import { motion } from 'framer-motion';
import { chatApi, Model } from '../../services/chatApi';
import { predictionService } from '../../services/predictionService';
import { fileService } from '../../services/fileService';
import { AnimatedLoader } from '../../components/ui/AnimatedLoader';
import { PredictionMappingInterface } from '../../components/ui/PredictionMappingInterface';

export default function PredictionSetup() {
  const navigate = useNavigate();
  
  // Model selection state
  const [activeTab, setActiveTab] = useState<'finetuned' | 'huggingface'>('finetuned');
  const [availableModels, setAvailableModels] = useState<any[]>([]);
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
  
  // File upload state
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationResult, setValidationResult] = useState<any>(null);
  
  // Column mapping state
  const [showMapping, setShowMapping] = useState(false);
  const [fileId, setFileId] = useState<string | null>(null);
  const [availableColumns, setAvailableColumns] = useState<string[]>([]);
  const [columnInfo, setColumnInfo] = useState<Record<string, any>>({});

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
      setAvailableModels(models);
      
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
      setSelectedModelId(tab === 'finetuned' ? models[0].model_id : models[0].id);
    }
  };

  // Handle model selection change
  const handleModelSelection = (modelId: string) => {
    setSelectedModelId(modelId);
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

  const getFileType = (filename: string): string | null => {
    const extension = filename.toLowerCase().split('.').pop();
    if (['csv', 'json', 'jsonl'].includes(extension || '')) {
      return extension || null;
    }
    return null;
  };

  const handleFileUpload = async (uploadedFile: File) => {
    setFile(uploadedFile);
    setError(null);
    setValidationResult(null);
    setIsLoading(true);

    try {
      // Validate file format
      const fileType = getFileType(uploadedFile.name);
      if (!fileType) {
        setError('Unsupported file format. Please upload CSV, JSON, or JSONL files.');
        setIsLoading(false);
        return;
      }

      // Upload file to get file ID and column information
      const uploadResult = await fileService.uploadFile(uploadedFile, uploadedFile.name);
      
      if (!uploadResult.success || !uploadResult.file_id) {
        throw new Error(uploadResult.message || 'Failed to upload file');
      }

      // Set file ID for mapping interface
      setFileId(uploadResult.file_id);

      // For small files, analyze content to get column information
      if (uploadedFile.size < 1024 * 1024) { // Less than 1MB
        const text = await uploadedFile.text();
        let columns: string[] = [];
        let mockColumnInfo: Record<string, any> = {};

        if (fileType === 'csv') {
          const lines = text.split('\n').filter(line => line.trim());
          if (lines.length < 2) {
            setError('CSV file must have at least a header row and one data row.');
            setIsLoading(false);
            return;
          }
          
          // Extract column names from CSV header
          columns = lines[0].split(',').map(col => col.trim().replace(/"/g, ''));
          
          // Create mock column info for CSV
          columns.forEach(col => {
            mockColumnInfo[col] = {
              name: col,
              data_type: 'string',
              null_count: 0,
              null_percentage: 0,
              unique_count: lines.length - 1,
              sample_values: lines.slice(1, 4).map(line => {
                const values = line.split(',');
                const colIndex = columns.indexOf(col);
                return colIndex >= 0 ? values[colIndex]?.trim().replace(/"/g, '') : '';
              }).filter((v: any) => v),
              total_rows: lines.length - 1
            };
          });

          setValidationResult({ 
            isValid: true, 
            totalRows: lines.length - 1,
            fileType: 'CSV'
          });
        } else if (fileType === 'json') {
          try {
            let data = JSON.parse(text);
            if (!Array.isArray(data)) {
              data = [data]; // Convert single object to array
            }
            
            // Extract column names from JSON objects
            if (data.length > 0) {
              columns = Object.keys(data[0]);
              
              // Create mock column info for JSON
              columns.forEach(col => {
                const values = data.map((item: any) => item[col]).filter((v: any) => v !== undefined && v !== null);
                mockColumnInfo[col] = {
                  name: col,
                  data_type: typeof data[0][col] === 'number' ? 'number' : 'string',
                  null_count: data.length - values.length,
                  null_percentage: ((data.length - values.length) / data.length) * 100,
                  unique_count: new Set(values).size,
                  sample_values: values.slice(0, 3),
                  total_rows: data.length
                };
              });
            }

            setValidationResult({
              isValid: true,
              totalRows: data.length,
              fileType: 'JSON'
            });
          } catch (e) {
            setError('Invalid JSON format. Please check your file.');
            setIsLoading(false);
            return;
          }
        } else if (fileType === 'jsonl') {
          try {
            const lines = text.split('\n').filter(line => line.trim());
            const data = lines.map(line => JSON.parse(line));
            
            // Extract column names from JSONL objects
            if (data.length > 0) {
              columns = Object.keys(data[0]);
              
              // Create mock column info for JSONL
              columns.forEach(col => {
                const values = data.map((item: any) => item[col]).filter(v => v !== undefined && v !== null);
                mockColumnInfo[col] = {
                  name: col,
                  data_type: typeof data[0][col] === 'number' ? 'number' : 'string',
                  null_count: data.length - values.length,
                  null_percentage: ((data.length - values.length) / data.length) * 100,
                  unique_count: new Set(values).size,
                  sample_values: values.slice(0, 3),
                  total_rows: data.length
                };
              });
            }

            setValidationResult({
              isValid: true,
              totalRows: lines.length,
              fileType: 'JSONL'
            });
          } catch (e) {
            setError('Invalid JSONL format. Each line must be valid JSON.');
            setIsLoading(false);
            return;
          }
        }

        // Set column information and show mapping interface
        setAvailableColumns(columns);
        setColumnInfo(mockColumnInfo);
        setShowMapping(true);
      } else {
        // For large files, just show basic info and proceed to mapping
        setValidationResult({
          isValid: true,
          totalRows: 'Large file - will validate during upload',
          fileType: fileType.toUpperCase()
        });
        
        // For large files, we'll need to get column info from the backend
        // For now, show mapping with empty columns (this should be enhanced)
        setAvailableColumns([]);
        setColumnInfo({});
        setShowMapping(true);
      }
    } catch (e) {
      setError('Error processing file. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle mapping completion
  const handleMappingComplete = async (mapping: any) => {
    if (!selectedModel || !fileId) return;
    
    setIsLoading(true);
    setError(null);

    try {
      // Get model ID - for HF models use the name directly, for local models use model_id
      const modelId = activeTab === 'huggingface' 
        ? selectedModel.name  // Use HF model name directly
        : selectedModel.model_id; // Use local model ID

      // Start prediction job with the provided mapping
      const response = await predictionService.startPrediction({
        file_id: fileId,
        model_id: modelId,
        mapping: {
          ...mapping,
          preprocessing_options: {
            ...mapping.preprocessing_options,
            batch_size: batchSize
          }
        }
      });

      // Store job info and navigate to progress page
      localStorage.setItem('predictionJobId', response.job_id);
      localStorage.setItem('predictionModel', JSON.stringify(selectedModel));
      
      navigate('/prediction/progress');
    } catch (error: any) {
      setError(error.message || 'Failed to start prediction. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle mapping cancellation
  const handleMappingCancel = () => {
    setShowMapping(false);
    setFile(null);
    setFileId(null);
    setAvailableColumns([]);
    setColumnInfo({});
    setValidationResult(null);
    setError(null);
  };

  const handleStartPrediction = async () => {
    if (!selectedModel || !file) return;
    
    setIsLoading(true);
    setError(null);

    try {
      // Upload file first
      const uploadResult = await fileService.uploadFile(file, file.name);
      
      if (!uploadResult.success || !uploadResult.file_id) {
        throw new Error(uploadResult.message || 'Failed to upload file');
      }

      // Get model ID - for HF models use the name directly, for local models use model_id
      const modelId = activeTab === 'huggingface' 
        ? selectedModel.name  // Use HF model name directly
        : selectedModel.model_id; // Use local model ID
      
      // Create proper input column mapping based on model schema
      const inputColumns: Record<string, string> = {};
      
      // For fine-tuned models, use the input schema to create mapping
      if (activeTab === 'finetuned' && selectedModel.input_schema) {
        // Map each model input field to itself (assuming file has matching columns)
        Object.keys(selectedModel.input_schema).forEach(field => {
          inputColumns[field] = field; // Map model field to file column with same name
        });
      } else {
        // For HuggingFace models, use common default mappings
        inputColumns['input'] = 'input'; // Default mapping
        inputColumns['instruction'] = 'instruction'; // Common instruction field
      }

      // Start prediction job
      const response = await predictionService.startPrediction({
        file_id: uploadResult.file_id,
        model_id: modelId,
        mapping: {
          input_columns: inputColumns,
          preprocessing_options: {
            normalize_text: true,
            handle_missing_values: 'default',
            default_values: {},
            batch_size: batchSize
          }
        }
      });

      // Store job info and navigate to progress page
      localStorage.setItem('predictionJobId', response.job_id);
      localStorage.setItem('predictionModel', JSON.stringify(selectedModel));
      
      navigate('/prediction/progress');
    } catch (error: any) {
      setError(error.message || 'Failed to start prediction. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Show mapping interface if file is uploaded and mapping is needed
  if (showMapping && selectedModel && fileId) {
    return (
      <PredictionMappingInterface
        fileId={fileId}
        availableColumns={availableColumns}
        columnInfo={columnInfo}
        selectedModel={selectedModel}
        onMappingComplete={handleMappingComplete}
        onCancel={handleMappingCancel}
      />
    );
  }

  return (
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
                      <div>Created: <span className="text-gray-700 dark:text-gray-300">{new Date(selectedModel.created_at).toLocaleDateString()}</span></div>
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
                        const uploadedFile = e.target.files?.[0];
                        if (uploadedFile) {
                          handleFileUpload(uploadedFile);
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
                          {isLoading ? 'Processing...' : 'Drag & drop your data file here or click to browse'}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {!selectedModel ? 'Select a model first' : 'Supports CSV, JSON, and JSONL files up to 50MB'}
                        </p>
                      </div>
                    </label>
                  </div>
                </div>

                {file && validationResult && (
                  <div className="p-4 bg-success-50 dark:bg-success-900/20 rounded-lg border border-success-200 dark:border-success-800">
                    <div className="flex items-start gap-2">
                      <CheckCircle className="h-5 w-5 text-success-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-success-800 dark:text-success-200">
                          File Validated Successfully
                        </p>
                        <p className="text-sm text-success-700 dark:text-success-300 mt-1">
                          {file.name} ({validationResult.fileType}) - {validationResult.totalRows} rows ready for prediction
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {error && (
                  <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-red-800 dark:text-red-200">
                          Error
                        </p>
                        <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                          {error}
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
                  disabled={!selectedModel || !file || isLoading || !!error}
                  onClick={handleStartPrediction}
                  className="px-8"
                >
                  {isLoading ? 'Starting Prediction...' : 'Start Prediction'}
                </Button>
              </div>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}
