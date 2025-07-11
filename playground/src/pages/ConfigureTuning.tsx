import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { ArrowLeft, ArrowRight, HelpCircle, RotateCcw, Zap, Search, AlertCircle, Loader2, Upload, FileText, AlertTriangle, Check, ChevronDown, ChevronUp, Settings } from 'lucide-react';
import { Tooltip } from '../components/ui/Tooltip';
import { TrainingConfig, createTrainingConfig } from '../config/training';
import { chatApi, Model } from '../services/chatApi';
import { AnimatedLoader } from '../components/ui/AnimatedLoader';
import { ConfigurationManager } from '../components/ui/ConfigurationManager';
import { ConfigurationReviewModal } from '../components/ui/ConfigurationReviewModal';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import { useDropzone } from 'react-dropzone';
import { API_BASE_URL } from '../config/api';

export default function ConfigureTuning() {
  const navigate = useNavigate();
  const [trainingConfig, setTrainingConfig] = useState<TrainingConfig>(() => createTrainingConfig({}));
  const [parameters, setParameters] = useState({
    epochs: 3,
    learningRate: 0.0002,
    batchSize: 8,
    maxSequenceLength: 2048,
    modelName: 'My-Fine-Tuned-Model',
    cutoff: 0.8, // Train/validation split
  });

  // Model selection state
  const [activeModelTab, setActiveModelTab] = useState<'finetuned' | 'huggingface'>('huggingface');
  const [availableModels, setAvailableModels] = useState<Model[]>([]);
  const [huggingFaceModels, setHuggingFaceModels] = useState<Model[]>([]);
  const [selectedBaseModel, setSelectedBaseModel] = useState<Model | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Model[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingModels, setIsLoadingModels] = useState(true);
  const [isLoadingHFModels, setIsLoadingHFModels] = useState(false);
  const [modelError, setModelError] = useState<string | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Data upload state
  interface FileWithPreview extends File {
    preview?: string;
  }
  const [files, setFiles] = useState<FileWithPreview[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [validationStatus, setValidationStatus] = useState<'idle' | 'validating' | 'valid' | 'invalid'>('idle');
  const [validationMessages, setValidationMessages] = useState<string[]>([]);
  const [showAdvancedParams, setShowAdvancedParams] = useState(false);

  // Advanced parameters subsection toggles
  const [showLoRAConfig, setShowLoRAConfig] = useState(true);
  const [showOptimization, setShowOptimization] = useState(false);
  const [showTrainingStability, setShowTrainingStability] = useState(false);
  const [showMemoryPerformance, setShowMemoryPerformance] = useState(false);
  const [showMonitoring, setShowMonitoring] = useState(false);
  const [showEarlyStopping, setShowEarlyStopping] = useState(false);

  const handleChange = (field: string, value: string | number) => {
    setParameters({ ...parameters, [field]: value });
  };

  // Validation function for Hub model ID
  const validateHubModelId = (id: string): { isValid: boolean; error?: string } => {
    if (!id.trim()) return { isValid: false, error: "Repository ID is required when push to hub is enabled" };
    
    const pattern = /^[a-zA-Z0-9]([a-zA-Z0-9._-]*[a-zA-Z0-9])?\/[a-zA-Z0-9]([a-zA-Z0-9._-]*[a-zA-Z0-9])?$/;
    if (!pattern.test(id)) {
      return { isValid: false, error: "Format should be: username/repository-name" };
    }
    
    return { isValid: true };
  };

  // Get current models list based on active tab
  const currentModels = activeModelTab === 'finetuned' ? availableModels : huggingFaceModels;

  // Load available fine-tuned models
  const loadFineTunedModels = async () => {
    try {
      setIsLoadingModels(true);
      setModelError(null);
      const models = await chatApi.fetchAvailableModels();
      setAvailableModels(models);
    } catch (error: any) {
      console.error('Failed to load fine-tuned models:', error);
      setModelError(error.message || 'Failed to load fine-tuned models');
    } finally {
      setIsLoadingModels(false);
    }
  };

  // Load Hugging Face models
  const loadHuggingFaceModels = async () => {
    try {
      setIsLoadingHFModels(true);
      setModelError(null);
      const models = await chatApi.fetchHuggingFaceModels();
      setHuggingFaceModels(models);
      
      // Set default selected model if none selected
      if (!selectedBaseModel && models.length > 0) {
        setSelectedBaseModel(models[0]);
      }
    } catch (error: any) {
      console.error('Failed to load Hugging Face models:', error);
      setModelError(error.message || 'Failed to load Hugging Face models');
    } finally {
      setIsLoadingHFModels(false);
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
      setHuggingFaceModels(results);
      
      // Set default selected model from search results
      if (results.length > 0) {
        setSelectedBaseModel(results[0]);
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
    loadHuggingFaceModels();
  };

  // Handle tab change
  const handleModelTabChange = (tab: 'finetuned' | 'huggingface') => {
    setActiveModelTab(tab);
    setSelectedBaseModel(null);
    setModelError(null);
    setSearchError(null);
    
    if (tab === 'huggingface' && huggingFaceModels.length === 0) {
      loadHuggingFaceModels();
    } else if (tab === 'finetuned' && availableModels.length === 0) {
      loadFineTunedModels();
    }
    
    // Set default selected model for the tab
    const models = tab === 'finetuned' ? availableModels : huggingFaceModels;
    if (models.length > 0) {
      setSelectedBaseModel(models[0]);
    }
  };

  // Handle model selection
  const handleModelSelection = (modelId: string) => {
    const model = currentModels.find(m => m.id === modelId);
    if (model) {
      setSelectedBaseModel(model);
    }
  };

  // Data upload functions
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

  const storeFile = async (file: File) => {
    try {
      const content = await readFileContent(file);
      
      const fileData = {
        name: file.name,
        type: file.type,
        size: file.size,
        lastModified: file.lastModified,
        content // This is now base64 encoded
      };
      
      localStorage.setItem('trainingFile', JSON.stringify(fileData));
    } catch (error) {
      console.error('Error reading file:', error);
      setValidationMessages(['Error reading file. Please try again.']);
      setValidationStatus('invalid');
    }
  };

  const removeFile = (name: string) => {
    setFiles(files.filter(file => file.name !== name));
    if (selectedFile?.name === name) {
      setSelectedFile(null);
      localStorage.removeItem('trainingFile');
    }
    // Reset validation if all files are removed
    if (files.length === 1) {
      setValidationStatus('idle');
      setValidationMessages([]);
    }
  };

  const simulateUpload = () => {
    setUploadProgress(0);
    const interval = setInterval(() => {
      setUploadProgress(prev => {
        const nextProgress = prev + 5;
        if (nextProgress >= 100) {
          clearInterval(interval);
          return 100;
        }
        return nextProgress;
      });
    }, 100);
    
    return () => clearInterval(interval);
  };

  const validateFiles = () => {
    if (files.length === 0) {
      setValidationMessages(['Please upload at least one file']);
      setValidationStatus('invalid');
      return;
    }

    setValidationStatus('validating');
    
    // Simulate validation process
    simulateUpload();
    
    setTimeout(() => {
      // For demo purposes, let's say JSON files are valid, others need warnings
      const hasNonJsonFiles = files.some(file => !file.name.endsWith('.json'));
      
      if (hasNonJsonFiles) {
        setValidationStatus('invalid');
        setValidationMessages([
          'Some files may need reformatting to match the required instruction → response format',
          'CSV files should have "instruction" and "response" columns',
          'Text files should have instruction/response pairs separated by delimiters'
        ]);
      } else {
        setValidationStatus('valid');
        setValidationMessages(['All files validated successfully']);
      }
    }, 2000);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'application/json': ['.json'],
      'text/csv': ['.csv'],
      'text/plain': ['.txt'],
    },
    maxFiles: 5,
    maxSize: 50 * 1024 * 1024, // 50MB
    onDrop: async (acceptedFiles, rejectedFiles) => {
      setFiles([...files, ...acceptedFiles]);

      // Store the first accepted file
      if (acceptedFiles.length > 0) {
        await storeFile(acceptedFiles[0]);
        setSelectedFile(acceptedFiles[0]);
      }

      // Reset validation state
      setValidationStatus('idle');
      setValidationMessages([]);
      
      if (rejectedFiles.length > 0) {
        const errorMessages = rejectedFiles.map(file => {
          if (file.errors[0].code === 'file-too-large') {
            return `${file.file.name} is too large (max 50MB)`;
          }
          if (file.errors[0].code === 'file-invalid-type') {
            return `${file.file.name} has an unsupported file type`;
          }
          return `${file.file.name} could not be uploaded`;
        });
        setValidationMessages(errorMessages);
      }
    },
  });

  // Load models on component mount
  useEffect(() => {
    loadHuggingFaceModels(); // Start with HF models as default
  }, []);

  const handleStartFineTuning = async () => {
    // Get the file from local storage
    const trainingFile = localStorage.getItem('trainingFile');
    
    if (!trainingFile) {
      toast.error('No training file found. Please upload data first.');
      return;
    }

    // Validate that a base model is selected
    if (!selectedBaseModel) {
      toast.error('Please select a base model before starting fine-tuning.');
      return;
    }

    // Parse the stored file data
    const { content, name, type } = JSON.parse(trainingFile);

    // Get the model identifier based on the type
    const modelIdentifier = activeModelTab === 'huggingface' 
      ? selectedBaseModel.hf_model_id || selectedBaseModel.name
      : selectedBaseModel.name;
    
    // Prepare the request payload
    const payload = {
      file_content: content,
      file_name: name,
      file_type: "json",
      model_name: modelIdentifier,
      max_seq_length: parameters.maxSequenceLength,
      num_train_epochs: parameters.epochs,
      per_device_train_batch_size: parameters.batchSize,
      gradient_accumulation_steps: trainingConfig.gradient_accumulation_steps,
      learning_rate: parameters.learningRate,
      warmup_steps: trainingConfig.warmup_steps,
      save_steps: trainingConfig.save_steps,
      logging_steps: trainingConfig.logging_steps,
      output_dir: `./results/${parameters.modelName}`,
      
      // LoRA Configuration
      lora_r: trainingConfig.lora_rank,
      lora_alpha: trainingConfig.lora_alpha,
      lora_dropout: trainingConfig.lora_dropout,
      
      // Optimization Parameters
      lr_scheduler_type: trainingConfig.lr_scheduler_type,
      adam_beta1: trainingConfig.adam_beta1,
      adam_beta2: trainingConfig.adam_beta2,
      adam_epsilon: trainingConfig.adam_epsilon,
      max_grad_norm: trainingConfig.max_grad_norm,
      
      // Training Stability
      weight_decay: trainingConfig.weight_decay,
      dropout_rate: trainingConfig.dropout_rate,
      attention_dropout: trainingConfig.attention_dropout,
      label_smoothing_factor: trainingConfig.label_smoothing_factor,
      
      // Memory & Performance
      dataloader_num_workers: trainingConfig.dataloader_num_workers,
      dataloader_pin_memory: trainingConfig.dataloader_pin_memory,
      gradient_checkpointing: trainingConfig.gradient_checkpointing,
      fp16: trainingConfig.fp16,
      bf16: trainingConfig.bf16,
      
      // Quantization
      quantization: trainingConfig.quantization,
      
      // Monitoring & Checkpointing
      save_strategy: trainingConfig.save_strategy,
      evaluation_strategy: trainingConfig.evaluation_strategy,
      eval_steps: trainingConfig.eval_steps,
      metric_for_best_model: trainingConfig.metric_for_best_model,
      load_best_model_at_end: trainingConfig.load_best_model_at_end,
      save_total_limit: trainingConfig.save_total_limit,
      
      // Early Stopping & Additional Options
      early_stopping_patience: trainingConfig.early_stopping_patience,
      early_stopping_threshold: trainingConfig.early_stopping_threshold,
      seed: trainingConfig.seed,
      remove_unused_columns: trainingConfig.remove_unused_columns,
      push_to_hub: trainingConfig.push_to_hub,
      hub_model_id: trainingConfig.hub_model_id,
      report_to: trainingConfig.report_to
    };
    
    console.log(payload)
    // Show loading toast
    toast.loading('Starting fine-tuning process...');
    
    // Make API call
    fetch(`${API_BASE_URL}/finetune`, {
      method: 'POST', 
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    })
    .then(response => {
      if (!response.ok) {
        return response.json().then(data => {
          throw new Error(data.detail?.[0]?.msg || 'Fine-tuning request failed');
        });
      }
      return response.json();
    })
    .then(data => {
      toast.dismiss();
      toast.success('Fine-tuning started successfully!');
      navigate('/progress');
    })
    .catch(error => {
      toast.dismiss();
      toast.error('Failed to start fine-tuning: ' + error.message);
    });
  };

  const resetToDefaults = () => {
    setParameters({
      epochs: 3,
      learningRate: 0.0002,
      batchSize: 8,
      maxSequenceLength: 512,
      modelName: 'My-Fine-Tuned-Model',
      cutoff: 0.8,
    });
    setTrainingConfig(createTrainingConfig({}));
  };

  // Calculate estimated time based on parameters (just a mock calculation)
  const estimatedTime = () => {
    const baseTime = 15; // minutes
    const epochFactor = parameters.epochs * 1.2;
    const batchFactor = 12 / parameters.batchSize;
    const sequenceFactor = parameters.maxSequenceLength / 256;
    
    return Math.round(baseTime * epochFactor * batchFactor * sequenceFactor);
  };

  // Calculate estimated cost (just a mock calculation)
  const estimatedCost = () => {
    const baseCost = 0.5; // dollars
    const epochFactor = parameters.epochs;
    const sizeFactor = 1.2;
    
    return (baseCost * epochFactor * sizeFactor).toFixed(2);
  };

  // Configuration management state
  const [currentConfigName, setCurrentConfigName] = useState('Default Settings');
  
  // Review modal state
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);

  // Handle loading a configuration
  const handleLoadConfig = (config: any) => {
    // Update basic parameters
    if (config.basic_parameters) {
      setParameters(prev => ({
        ...prev,
        ...config.basic_parameters
      }));
    }

    // Update advanced parameters
    if (config.advanced_parameters) {
      setTrainingConfig(prev => ({
        ...prev,
        ...config.advanced_parameters
      }));
    }

    // Update current config name
    setCurrentConfigName(config.metadata?.name || 'Loaded Configuration');
  };

  // Get current configuration for saving
  const getCurrentConfig = () => {
    return {
      basic_parameters: parameters,
      advanced_parameters: trainingConfig
    };
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configure Fine-Tuning</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Set hyperparameters and options for your fine-tuning job
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Base Model Selection */}
          <Card>
            <CardHeader>
              <CardTitle>Base Model Selection</CardTitle>
              <CardDescription>
                Choose the foundation model to fine-tune
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Tab Interface */}
              <div className="flex space-x-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
                <button
                  onClick={() => handleModelTabChange('huggingface')}
                  className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                    activeModelTab === 'huggingface'
                      ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                  }`}
                >
                  🤗 Hugging Face Models
                </button>
                <button
                  onClick={() => handleModelTabChange('finetuned')}
                  className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                    activeModelTab === 'finetuned'
                      ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                  }`}
                >
                  Fine-tuned Models
                </button>
              </div>

              {/* Search Interface for Hugging Face Tab */}
              {activeModelTab === 'huggingface' && (
                <div className="space-y-2">
                  <label className="block text-sm font-medium">
                    🔍 Search Models
                  </label>
                  <div className="flex space-x-2">
                    <div className="flex-1 relative">
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
                        className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        disabled={isSearching}
                      />
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleSearch}
                      disabled={isSearching || !searchQuery.trim()}
                      leftIcon={isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    >
                      Search
                    </Button>
                    {searchResults.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleClearSearch}
                      >
                        Clear
                      </Button>
                    )}
                  </div>
                  
                  {/* Search Error */}
                  {searchError && (
                    <div className="flex items-center text-sm text-red-600">
                      <AlertCircle className="h-4 w-4 mr-2" />
                      {searchError}
                    </div>
                  )}
                  
                  {/* Search Results Info */}
                  {searchResults.length > 0 && (
                    <div className="text-xs text-gray-500">
                      Found {searchResults.length} verified models for "{searchQuery}"
                    </div>
                  )}
                </div>
              )}

              {/* Loading and Error States */}
              {(activeModelTab === 'finetuned' ? isLoadingModels : isLoadingHFModels) ? (
                <div className="flex items-center justify-center py-8">
                  <AnimatedLoader variant="brain" size="md" text={`Loading ${activeModelTab === 'finetuned' ? 'fine-tuned' : 'Hugging Face'} models...`} />
                </div>
              ) : modelError ? (
                <div className="flex flex-col items-center justify-center py-8 space-y-3">
                  <div className="flex items-center">
                    <AlertCircle className="h-6 w-6 text-red-500" />
                    <span className="ml-2 text-sm text-red-600">{modelError}</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={activeModelTab === 'finetuned' ? loadFineTunedModels : loadHuggingFaceModels}
                    disabled={activeModelTab === 'finetuned' ? isLoadingModels : isLoadingHFModels}
                  >
                    Try Again
                  </Button>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Selected Base Model
                  </label>
                  <select
                    value={selectedBaseModel?.id || ''}
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
                          {activeModelTab === 'huggingface' && model.family && ` (${model.family})`}
                        </option>
                      ))
                    )}
                  </select>
                  
                  {/* Selected Model Info */}
                  {selectedBaseModel && (
                    <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-md">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                            {selectedBaseModel.name}
                          </h4>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {selectedBaseModel.description}
                          </p>
                          <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                            <span>Size: {selectedBaseModel.size}</span>
                            <span>Architecture: {selectedBaseModel.architecture}</span>
                            {activeModelTab === 'huggingface' && selectedBaseModel.family && (
                              <Badge variant="outline" size="sm">{selectedBaseModel.family}</Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Training Data Upload */}
          <Card>
            <CardHeader>
              <CardTitle>Training Data Upload</CardTitle>
              <CardDescription>
                Upload JSON, CSV, or text files containing instruction-response pairs
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div 
                {...getRootProps()} 
                className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                  isDragActive 
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/10' 
                    : 'border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600'
                }`}
              >
                <input {...getInputProps()} />
                <div className="flex flex-col items-center justify-center space-y-2">
                  <div className="p-3 rounded-full bg-primary-100 dark:bg-primary-900/20">
                    <Upload className="h-6 w-6 text-primary-600 dark:text-primary-400" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium">
                      {isDragActive ? 'Drop the files here' : 'Drag & drop files here or click to browse'}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      JSON, CSV, or TXT files, up to 50MB each
                    </p>
                  </div>
                </div>
              </div>

              {files.length > 0 && (
                <div className="mt-6">
                  <h4 className="text-sm font-medium mb-3">Uploaded Files</h4>
                  <ul className="space-y-3">
                    {files.map((file) => (
                      <motion.li 
                        key={file.name}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-md"
                      >
                        <div className="flex items-center">
                          <FileText className="h-5 w-5 mr-3 text-gray-500" />
                          <div>
                            <p className="text-sm font-medium">{file.name}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {(file.size / 1024).toFixed(2)} KB
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => removeFile(file.name)}
                          className="text-gray-500 hover:text-red-500 transition-colors"
                          aria-label="Remove file"
                        >
                          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </motion.li>
                    ))}
                  </ul>
                </div>
              )}

              {validationStatus === 'validating' && (
                <div className="mt-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Validating files...</span>
                    <span className="text-sm text-gray-500 dark:text-gray-400">{uploadProgress}%</span>
                  </div>
                  <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary-500 transition-all duration-300 ease-in-out"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {validationMessages.length > 0 && validationStatus !== 'validating' && (
                <div className={`mt-6 p-4 rounded-md ${validationStatus === 'valid' ? 'bg-success-50 dark:bg-success-900/20 text-success-800 dark:text-success-200' : 'bg-warning-50 dark:bg-warning-900/20 text-warning-800 dark:text-warning-200'}`}>
                  <div className="flex">
                    <div className="flex-shrink-0">
                      {validationStatus === 'valid' ? (
                        <Check className="h-5 w-5 text-success-500" />
                      ) : (
                        <AlertTriangle className="h-5 w-5 text-warning-500" />
                      )}
                    </div>
                    <div className="ml-3">
                      <h3 className="text-sm font-medium">
                        {validationStatus === 'valid' ? 'Validation Successful' : 'Validation Warnings'}
                      </h3>
                      <div className="mt-2 text-sm">
                        <ul className="list-disc pl-5 space-y-1">
                          {validationMessages.map((message, index) => (
                            <li key={index}>{message}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              <div className="mt-6 flex justify-end">
                <Button
                  variant="primary"
                  onClick={validateFiles}
                  disabled={files.length === 0 || validationStatus === 'validating'}
                  isLoading={validationStatus === 'validating'}
                >
                  Validate Files
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Model Name and Description</CardTitle>
              <CardDescription>
                Set how your fine-tuned model will be identified
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <label htmlFor="modelName" className="block text-sm font-medium mb-1">
                    Model Name
                  </label>
                  <input
                    type="text"
                    id="modelName"
                    value={parameters.modelName}
                    onChange={(e) => handleChange('modelName', e.target.value)}
                    className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="Enter a name for your fine-tuned model"
                  />
                </div>
                
                <div>
                  <label htmlFor="modelDescription" className="block text-sm font-medium mb-1">
                    Description (Optional)
                  </label>
                  <textarea
                    id="modelDescription"
                    rows={3}
                    className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="Add a description of your model's purpose and capabilities"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Tags (Optional)
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                      production
                    </Badge>
                    <Badge variant="outline" className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                      experimental
                    </Badge>
                    <Badge variant="outline" className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                      + Add Tag
                    </Badge>
                  </div>
                </div>

                {/* Hugging Face Hub Integration */}
                <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                  <div className="space-y-3">
                    <div className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        id="pushToHub"
                        checked={trainingConfig.push_to_hub}
                        onChange={(e) => setTrainingConfig(prev => ({ ...prev, push_to_hub: e.target.checked }))}
                        className="h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                      />
                      <div className="flex-1">
                        <label htmlFor="pushToHub" className="block text-sm font-medium">
                          🤗 Push to Hugging Face Hub
                        </label>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Automatically upload your fine-tuned model to Hugging Face Hub after training
                        </p>
                      </div>
                      <Tooltip content="Upload your trained model to Hugging Face Hub for easy sharing and deployment">
                        <HelpCircle className="h-4 w-4 text-gray-400 cursor-help" />
                      </Tooltip>
                    </div>

                    {trainingConfig.push_to_hub && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        className="space-y-2"
                      >
                        <label htmlFor="hubModelId" className="block text-sm font-medium">
                          Repository ID
                        </label>
                        <input
                          type="text"
                          id="hubModelId"
                          value={trainingConfig.hub_model_id}
                          onChange={(e) => setTrainingConfig(prev => ({ ...prev, hub_model_id: e.target.value }))}
                          className={`w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                            trainingConfig.hub_model_id && !validateHubModelId(trainingConfig.hub_model_id).isValid
                              ? 'border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20'
                              : 'border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800'
                          }`}
                          placeholder="username/repository-name"
                        />
                        <div className="space-y-1">
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            <strong>Format:</strong> username/repository-name
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            <strong>Example:</strong> myusername/my-fine-tuned-model
                          </p>
                          {trainingConfig.hub_model_id && !validateHubModelId(trainingConfig.hub_model_id).isValid && (
                            <p className="text-xs text-red-600 dark:text-red-400 flex items-center">
                              <AlertCircle className="h-3 w-3 mr-1" />
                              {validateHubModelId(trainingConfig.hub_model_id).error}
                            </p>
                          )}
                          {trainingConfig.hub_model_id && validateHubModelId(trainingConfig.hub_model_id).isValid && (
                            <p className="text-xs text-green-600 dark:text-green-400 flex items-center">
                              <Check className="h-3 w-3 mr-1" />
                              Valid repository ID format
                            </p>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Training Parameters</span>
                <Button 
                  variant="ghost" 
                  size="sm"
                  leftIcon={<RotateCcw className="h-4 w-4" />}
                  onClick={resetToDefaults}
                >
                  Reset to defaults
                </Button>
              </CardTitle>
              <CardDescription>
                Configure how your model will be trained
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label htmlFor="epochs" className="block text-sm font-medium">
                      Number of Epochs
                    </label>
                    <Tooltip content="How many times to iterate through the training data">
                      <HelpCircle className="h-4 w-4 text-gray-400 cursor-help" />
                    </Tooltip>
                  </div>
                  <div className="flex items-center space-x-3">
                    <input
                      type="range"
                      id="epochs"
                      min="1"
                      max="10"
                      step="1"
                      value={parameters.epochs}
                      onChange={(e) => handleChange('epochs', parseInt(e.target.value))}
                      className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-primary-600"
                    />
                    <div className="w-16">
                      <input
                        type="number"
                        min="1"
                        max="10"
                        step="1"
                        value={parameters.epochs}
                        onChange={(e) => handleChange('epochs', parseInt(e.target.value) || 1)}
                        className="w-full px-2 py-1 text-sm text-center border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>1</span>
                    <span>5</span>
                    <span>10</span>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label htmlFor="learningRate" className="block text-sm font-medium">
                      Learning Rate
                    </label>
                    <Tooltip content="Controls how quickly the model adapts to new data">
                      <HelpCircle className="h-4 w-4 text-gray-400 cursor-help" />
                    </Tooltip>
                  </div>
                  <div className="flex items-center space-x-3">
                    <input
                      type="range"
                      id="learningRate"
                      min="0.00001"
                      max="0.001"
                      step="0.00001"
                      value={parameters.learningRate}
                      onChange={(e) => handleChange('learningRate', parseFloat(e.target.value))}
                      className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-primary-600"
                    />
                    <div className="w-24">
                      <input
                        type="number"
                        min="0.00001"
                        max="0.001"
                        step="0.00001"
                        value={parameters.learningRate}
                        onChange={(e) => handleChange('learningRate', parseFloat(e.target.value) || 0.00001)}
                        className="w-full px-2 py-1 text-sm text-center border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>1e-5</span>
                    <span>5e-4</span>
                    <span>1e-3</span>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label htmlFor="batchSize" className="block text-sm font-medium">
                      Batch Size
                    </label>
                    <Tooltip content="Number of training examples used in one iteration">
                      <HelpCircle className="h-4 w-4 text-gray-400 cursor-help" />
                    </Tooltip>
                  </div>
                  <div className="flex items-center space-x-3">
                    <input
                      type="range"
                      id="batchSize"
                      min="1"
                      max="32"
                      step="1"
                      value={parameters.batchSize}
                      onChange={(e) => handleChange('batchSize', parseInt(e.target.value))}
                      className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-primary-600"
                    />
                    <div className="w-16">
                      <input
                        type="number"
                        min="1"
                        max="32"
                        step="1"
                        value={parameters.batchSize}
                        onChange={(e) => handleChange('batchSize', parseInt(e.target.value) || 1)}
                        className="w-full px-2 py-1 text-sm text-center border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>1</span>
                    <span>16</span>
                    <span>32</span>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label htmlFor="maxSequenceLength" className="block text-sm font-medium">
                      Max Sequence Length
                    </label>
                    <Tooltip content="Maximum length of input text sequences">
                      <HelpCircle className="h-4 w-4 text-gray-400 cursor-help" />
                    </Tooltip>
                  </div>
                  <div className="flex items-center space-x-3">
                    <input
                      type="range"
                      id="maxSequenceLength"
                      min="128"
                      max="2048"
                      step="128"
                      value={parameters.maxSequenceLength}
                      onChange={(e) => handleChange('maxSequenceLength', parseInt(e.target.value))}
                      className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-primary-600"
                    />
                    <div className="w-20">
                      <input
                        type="number"
                        min="128"
                        max="2048"
                        step="128"
                        value={parameters.maxSequenceLength}
                        onChange={(e) => handleChange('maxSequenceLength', parseInt(e.target.value) || 128)}
                        className="w-full px-2 py-1 text-sm text-center border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>128</span>
                    <span>1024</span>
                    <span>2048</span>
                  </div>
                </div>
                
                <div className="space-y-2 md:col-span-2">
                  <div className="flex items-center justify-between">
                    <label htmlFor="cutoff" className="block text-sm font-medium">
                      Training/Validation Split
                    </label>
                    <Tooltip content="Percentage of data used for training vs. validation">
                      <HelpCircle className="h-4 w-4 text-gray-400 cursor-help" />
                    </Tooltip>
                  </div>
                  <div className="flex items-center space-x-3">
                    <input
                      type="range"
                      id="cutoff"
                      min="0.5"
                      max="0.95"
                      step="0.05"
                      value={parameters.cutoff}
                      onChange={(e) => handleChange('cutoff', parseFloat(e.target.value))}
                      className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-primary-600"
                    />
                    <div className="w-20">
                      <input
                        type="number"
                        min="0.5"
                        max="0.95"
                        step="0.05"
                        value={Math.round(parameters.cutoff * 100)}
                        onChange={(e) => handleChange('cutoff', (parseInt(e.target.value) || 50) / 100)}
                        className="w-full px-2 py-1 text-sm text-center border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>50%</span>
                    <span>75%</span>
                    <span>95%</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>


          {/* Advanced Parameters Toggle */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Settings className="h-5 w-5" />
                  <span>Advanced Parameters</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAdvancedParams(!showAdvancedParams)}
                  leftIcon={showAdvancedParams ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                >
                  {showAdvancedParams ? 'Hide Advanced' : 'Show Advanced'}
                </Button>
              </CardTitle>
              <CardDescription>
                Fine-tune optimization, LoRA, memory settings, and monitoring options
              </CardDescription>
            </CardHeader>
            {showAdvancedParams && (
              <CardContent>
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-8"
                >
                  {/* LoRA Configuration */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 pb-2">
                      <div>
                        <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">LoRA Configuration</h4>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Low-Rank Adaptation parameters for efficient fine-tuning</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowLoRAConfig(!showLoRAConfig)}
                        leftIcon={showLoRAConfig ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                        className="text-xs"
                      >
                        {showLoRAConfig ? 'Hide' : 'Show'}
                      </Button>
                    </div>
                    {showLoRAConfig && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        className="grid grid-cols-1 md:grid-cols-2 gap-6"
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <label htmlFor="loraRank" className="block text-sm font-medium">
                              LoRA Rank
                            </label>
                            <Tooltip content="Rank of the low-rank adaptation matrices. Higher values allow more expressiveness but use more memory.">
                              <HelpCircle className="h-4 w-4 text-gray-400 cursor-help" />
                            </Tooltip>
                          </div>
                          <div className="flex items-center space-x-3">
                            <input
                              type="range"
                              id="loraRank"
                              min="1"
                              max="64"
                              step="1"
                              value={trainingConfig.lora_rank}
                              onChange={(e) => setTrainingConfig(prev => ({ ...prev, lora_rank: parseInt(e.target.value) }))}
                              className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-primary-600"
                            />
                            <div className="w-16">
                              <input
                                type="number"
                                min="1"
                                max="64"
                                step="1"
                                value={trainingConfig.lora_rank}
                                onChange={(e) => setTrainingConfig(prev => ({ ...prev, lora_rank: parseInt(e.target.value) || 1 }))}
                                className="w-full px-2 py-1 text-sm text-center border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                              />
                            </div>
                          </div>
                          <div className="flex justify-between text-xs text-gray-500">
                            <span>1</span>
                            <span>32</span>
                            <span>64</span>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <label htmlFor="loraAlpha" className="block text-sm font-medium">
                              LoRA Alpha
                            </label>
                            <Tooltip content="Scaling factor for LoRA. Typically set to 2x the rank value.">
                              <HelpCircle className="h-4 w-4 text-gray-400 cursor-help" />
                            </Tooltip>
                          </div>
                          <div className="flex items-center space-x-3">
                            <input
                              type="range"
                              id="loraAlpha"
                              min="1"
                              max="128"
                              step="1"
                              value={trainingConfig.lora_alpha}
                              onChange={(e) => setTrainingConfig(prev => ({ ...prev, lora_alpha: parseInt(e.target.value) }))}
                              className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-primary-600"
                            />
                            <div className="w-16">
                              <input
                                type="number"
                                min="1"
                                max="128"
                                step="1"
                                value={trainingConfig.lora_alpha}
                                onChange={(e) => setTrainingConfig(prev => ({ ...prev, lora_alpha: parseInt(e.target.value) || 1 }))}
                                className="w-full px-2 py-1 text-sm text-center border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                              />
                            </div>
                          </div>
                          <div className="flex justify-between text-xs text-gray-500">
                            <span>1</span>
                            <span>64</span>
                            <span>128</span>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <label htmlFor="loraDropout" className="block text-sm font-medium">
                              LoRA Dropout
                            </label>
                            <Tooltip content="Dropout rate applied to LoRA layers for regularization.">
                              <HelpCircle className="h-4 w-4 text-gray-400 cursor-help" />
                            </Tooltip>
                          </div>
                          <div className="flex items-center space-x-3">
                            <input
                              type="range"
                              id="loraDropout"
                              min="0"
                              max="0.5"
                              step="0.01"
                              value={trainingConfig.lora_dropout}
                              onChange={(e) => setTrainingConfig(prev => ({ ...prev, lora_dropout: parseFloat(e.target.value) }))}
                              className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-primary-600"
                            />
                            <div className="w-16">
                              <input
                                type="number"
                                min="0"
                                max="0.5"
                                step="0.01"
                                value={trainingConfig.lora_dropout}
                                onChange={(e) => setTrainingConfig(prev => ({ ...prev, lora_dropout: parseFloat(e.target.value) || 0 }))}
                                className="w-full px-2 py-1 text-sm text-center border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                              />
                            </div>
                          </div>
                          <div className="flex justify-between text-xs text-gray-500">
                            <span>0</span>
                            <span>0.25</span>
                            <span>0.5</span>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <label htmlFor="quantization" className="block text-sm font-medium">
                              Quantization Method
                            </label>
                            <Tooltip content="Quantization reduces memory usage by using lower precision weights.">
                              <HelpCircle className="h-4 w-4 text-gray-400 cursor-help" />
                            </Tooltip>
                          </div>
                          <select
                            id="quantization"
                            value={trainingConfig.quantization}
                            onChange={(e) => setTrainingConfig(prev => ({ ...prev, quantization: e.target.value as '4bit' | '8bit' | 'none' }))}
                            className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                          >
                            <option value="4bit">4-bit Quantization</option>
                            <option value="8bit">8-bit Quantization</option>
                            <option value="none">No Quantization</option>
                          </select>
                        </div>
                      </motion.div>
                    )}
                  </div>

                  {/* Optimization Parameters */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 pb-2">
                      <div>
                        <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Optimization Parameters</h4>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Configure optimizer and learning rate scheduling</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowOptimization(!showOptimization)}
                        leftIcon={showOptimization ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                        className="text-xs"
                      >
                        {showOptimization ? 'Hide' : 'Show'}
                      </Button>
                    </div>
                    {showOptimization && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        className="grid grid-cols-1 md:grid-cols-2 gap-6"
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <label htmlFor="lrScheduler" className="block text-sm font-medium">
                              Learning Rate Scheduler
                            </label>
                            <Tooltip content="Learning rate scheduling strategy during training.">
                              <HelpCircle className="h-4 w-4 text-gray-400 cursor-help" />
                            </Tooltip>
                          </div>
                          <select
                            id="lrScheduler"
                            value={trainingConfig.lr_scheduler_type}
                            onChange={(e) => setTrainingConfig(prev => ({ ...prev, lr_scheduler_type: e.target.value as any }))}
                            className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                          >
                            <option value="cosine">Cosine</option>
                            <option value="linear">Linear</option>
                            <option value="polynomial">Polynomial</option>
                            <option value="constant">Constant</option>
                            <option value="constant_with_warmup">Constant with Warmup</option>
                          </select>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <label htmlFor="warmupSteps" className="block text-sm font-medium">
                              Warmup Steps
                            </label>
                            <Tooltip content="Number of steps to gradually increase learning rate from 0 to target value.">
                              <HelpCircle className="h-4 w-4 text-gray-400 cursor-help" />
                            </Tooltip>
                          </div>
                          <div className="flex items-center space-x-3">
                            <input
                              type="range"
                              id="warmupSteps"
                              min="0"
                              max="1000"
                              step="10"
                              value={trainingConfig.warmup_steps}
                              onChange={(e) => setTrainingConfig(prev => ({ ...prev, warmup_steps: parseInt(e.target.value) }))}
                              className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-primary-600"
                            />
                            <div className="w-20">
                              <input
                                type="number"
                                min="0"
                                max="1000"
                                step="10"
                                value={trainingConfig.warmup_steps}
                                onChange={(e) => setTrainingConfig(prev => ({ ...prev, warmup_steps: parseInt(e.target.value) || 0 }))}
                                className="w-full px-2 py-1 text-sm text-center border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                              />
                            </div>
                          </div>
                          <div className="flex justify-between text-xs text-gray-500">
                            <span>0</span>
                            <span>500</span>
                            <span>1000</span>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <label htmlFor="adamBeta1" className="block text-sm font-medium">
                              Adam Beta1
                            </label>
                            <Tooltip content="Exponential decay rate for first moment estimates in Adam optimizer.">
                              <HelpCircle className="h-4 w-4 text-gray-400 cursor-help" />
                            </Tooltip>
                          </div>
                          <div className="flex items-center space-x-3">
                            <input
                              type="range"
                              id="adamBeta1"
                              min="0.8"
                              max="0.99"
                              step="0.01"
                              value={trainingConfig.adam_beta1}
                              onChange={(e) => setTrainingConfig(prev => ({ ...prev, adam_beta1: parseFloat(e.target.value) }))}
                              className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-primary-600"
                            />
                            <div className="w-16">
                              <input
                                type="number"
                                min="0.8"
                                max="0.99"
                                step="0.01"
                                value={trainingConfig.adam_beta1}
                                onChange={(e) => setTrainingConfig(prev => ({ ...prev, adam_beta1: parseFloat(e.target.value) || 0.9 }))}
                                className="w-full px-2 py-1 text-sm text-center border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                              />
                            </div>
                          </div>
                          <div className="flex justify-between text-xs text-gray-500">
                            <span>0.8</span>
                            <span>0.9</span>
                            <span>0.99</span>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <label htmlFor="adamBeta2" className="block text-sm font-medium">
                              Adam Beta2
                            </label>
                            <Tooltip content="Exponential decay rate for second moment estimates in Adam optimizer.">
                              <HelpCircle className="h-4 w-4 text-gray-400 cursor-help" />
                            </Tooltip>
                          </div>
                          <div className="flex items-center space-x-3">
                            <input
                              type="range"
                              id="adamBeta2"
                              min="0.99"
                              max="0.9999"
                              step="0.0001"
                              value={trainingConfig.adam_beta2}
                              onChange={(e) => setTrainingConfig(prev => ({ ...prev, adam_beta2: parseFloat(e.target.value) }))}
                              className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-primary-600"
                            />
                            <div className="w-20">
                              <input
                                type="number"
                                min="0.99"
                                max="0.9999"
                                step="0.0001"
                                value={trainingConfig.adam_beta2}
                                onChange={(e) => setTrainingConfig(prev => ({ ...prev, adam_beta2: parseFloat(e.target.value) || 0.999 }))}
                                className="w-full px-2 py-1 text-sm text-center border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                              />
                            </div>
                          </div>
                          <div className="flex justify-between text-xs text-gray-500">
                            <span>0.99</span>
                            <span>0.999</span>
                            <span>0.9999</span>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <label htmlFor="maxGradNorm" className="block text-sm font-medium">
                              Max Gradient Norm
                            </label>
                            <Tooltip content="Maximum norm for gradient clipping to prevent exploding gradients.">
                              <HelpCircle className="h-4 w-4 text-gray-400 cursor-help" />
                            </Tooltip>
                          </div>
                          <div className="flex items-center space-x-3">
                            <input
                              type="range"
                              id="maxGradNorm"
                              min="0.1"
                              max="10"
                              step="0.1"
                              value={trainingConfig.max_grad_norm}
                              onChange={(e) => setTrainingConfig(prev => ({ ...prev, max_grad_norm: parseFloat(e.target.value) }))}
                              className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-primary-600"
                            />
                            <div className="w-16">
                              <input
                                type="number"
                                min="0.1"
                                max="10"
                                step="0.1"
                                value={trainingConfig.max_grad_norm}
                                onChange={(e) => setTrainingConfig(prev => ({ ...prev, max_grad_norm: parseFloat(e.target.value) || 1.0 }))}
                                className="w-full px-2 py-1 text-sm text-center border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                              />
                            </div>
                          </div>
                          <div className="flex justify-between text-xs text-gray-500">
                            <span>0.1</span>
                            <span>1.0</span>
                            <span>10</span>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <label htmlFor="gradAccumSteps" className="block text-sm font-medium">
                              Gradient Accumulation Steps
                            </label>
                            <Tooltip content="Number of steps to accumulate gradients before updating model weights.">
                              <HelpCircle className="h-4 w-4 text-gray-400 cursor-help" />
                            </Tooltip>
                          </div>
                          <div className="flex items-center space-x-3">
                            <input
                              type="range"
                              id="gradAccumSteps"
                              min="1"
                              max="32"
                              step="1"
                              value={trainingConfig.gradient_accumulation_steps}
                              onChange={(e) => setTrainingConfig(prev => ({ ...prev, gradient_accumulation_steps: parseInt(e.target.value) }))}
                              className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-primary-600"
                            />
                            <div className="w-16">
                              <input
                                type="number"
                                min="1"
                                max="32"
                                step="1"
                                value={trainingConfig.gradient_accumulation_steps}
                                onChange={(e) => setTrainingConfig(prev => ({ ...prev, gradient_accumulation_steps: parseInt(e.target.value) || 1 }))}
                                className="w-full px-2 py-1 text-sm text-center border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                              />
                            </div>
                          </div>
                          <div className="flex justify-between text-xs text-gray-500">
                            <span>1</span>
                            <span>16</span>
                            <span>32</span>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </div>

                  {/* Training Stability */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 pb-2">
                      <div>
                        <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Training Stability</h4>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Regularization and stability parameters</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowTrainingStability(!showTrainingStability)}
                        leftIcon={showTrainingStability ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                        className="text-xs"
                      >
                        {showTrainingStability ? 'Hide' : 'Show'}
                      </Button>
                    </div>
                    {showTrainingStability && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        className="grid grid-cols-1 md:grid-cols-2 gap-6"
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <label htmlFor="weightDecay" className="block text-sm font-medium">
                              Weight Decay
                            </label>
                            <Tooltip content="L2 regularization parameter to prevent overfitting.">
                              <HelpCircle className="h-4 w-4 text-gray-400 cursor-help" />
                            </Tooltip>
                          </div>
                          <div className="flex items-center space-x-3">
                            <input
                              type="range"
                              id="weightDecay"
                              min="0"
                              max="0.1"
                              step="0.001"
                              value={trainingConfig.weight_decay}
                              onChange={(e) => setTrainingConfig(prev => ({ ...prev, weight_decay: parseFloat(e.target.value) }))}
                              className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-primary-600"
                            />
                            <div className="w-20">
                              <input
                                type="number"
                                min="0"
                                max="0.1"
                                step="0.001"
                                value={trainingConfig.weight_decay}
                                onChange={(e) => setTrainingConfig(prev => ({ ...prev, weight_decay: parseFloat(e.target.value) || 0 }))}
                                className="w-full px-2 py-1 text-sm text-center border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                              />
                            </div>
                          </div>
                          <div className="flex justify-between text-xs text-gray-500">
                            <span>0</span>
                            <span>0.01</span>
                            <span>0.1</span>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <label htmlFor="dropoutRate" className="block text-sm font-medium">
                              Dropout Rate
                            </label>
                            <Tooltip content="Probability of randomly setting input units to 0 during training.">
                              <HelpCircle className="h-4 w-4 text-gray-400 cursor-help" />
                            </Tooltip>
                          </div>
                          <div className="flex items-center space-x-3">
                            <input
                              type="range"
                              id="dropoutRate"
                              min="0"
                              max="0.5"
                              step="0.01"
                              value={trainingConfig.dropout_rate}
                              onChange={(e) => setTrainingConfig(prev => ({ ...prev, dropout_rate: parseFloat(e.target.value) }))}
                              className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-primary-600"
                            />
                            <div className="w-16">
                              <input
                                type="number"
                                min="0"
                                max="0.5"
                                step="0.01"
                                value={trainingConfig.dropout_rate}
                                onChange={(e) => setTrainingConfig(prev => ({ ...prev, dropout_rate: parseFloat(e.target.value) || 0 }))}
                                className="w-full px-2 py-1 text-sm text-center border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                              />
                            </div>
                          </div>
                          <div className="flex justify-between text-xs text-gray-500">
                            <span>0</span>
                            <span>0.1</span>
                            <span>0.5</span>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <label htmlFor="attentionDropout" className="block text-sm font-medium">
                              Attention Dropout
                            </label>
                            <Tooltip content="Dropout rate specifically applied to attention layers.">
                              <HelpCircle className="h-4 w-4 text-gray-400 cursor-help" />
                            </Tooltip>
                          </div>
                          <div className="flex items-center space-x-3">
                            <input
                              type="range"
                              id="attentionDropout"
                              min="0"
                              max="0.5"
                              step="0.01"
                              value={trainingConfig.attention_dropout}
                              onChange={(e) => setTrainingConfig(prev => ({ ...prev, attention_dropout: parseFloat(e.target.value) }))}
                              className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-primary-600"
                            />
                            <div className="w-16">
                              <input
                                type="number"
                                min="0"
                                max="0.5"
                                step="0.01"
                                value={trainingConfig.attention_dropout}
                                onChange={(e) => setTrainingConfig(prev => ({ ...prev, attention_dropout: parseFloat(e.target.value) || 0 }))}
                                className="w-full px-2 py-1 text-sm text-center border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                              />
                            </div>
                          </div>
                          <div className="flex justify-between text-xs text-gray-500">
                            <span>0</span>
                            <span>0.1</span>
                            <span>0.5</span>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <label htmlFor="labelSmoothing" className="block text-sm font-medium">
                              Label Smoothing
                            </label>
                            <Tooltip content="Smooths target labels to prevent overconfident predictions.">
                              <HelpCircle className="h-4 w-4 text-gray-400 cursor-help" />
                            </Tooltip>
                          </div>
                          <div className="flex items-center space-x-3">
                            <input
                              type="range"
                              id="labelSmoothing"
                              min="0"
                              max="0.3"
                              step="0.01"
                              value={trainingConfig.label_smoothing_factor}
                              onChange={(e) => setTrainingConfig(prev => ({ ...prev, label_smoothing_factor: parseFloat(e.target.value) }))}
                              className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-primary-600"
                            />
                            <div className="w-16">
                              <input
                                type="number"
                                min="0"
                                max="0.3"
                                step="0.01"
                                value={trainingConfig.label_smoothing_factor}
                                onChange={(e) => setTrainingConfig(prev => ({ ...prev, label_smoothing_factor: parseFloat(e.target.value) || 0 }))}
                                className="w-full px-2 py-1 text-sm text-center border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                              />
                            </div>
                          </div>
                          <div className="flex justify-between text-xs text-gray-500">
                            <span>0</span>
                            <span>0.1</span>
                            <span>0.3</span>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <label htmlFor="reportTo" className="block text-sm font-medium">
                              Experiment Tracking
                            </label>
                            <Tooltip content="Platform for tracking training metrics and experiments.">
                              <HelpCircle className="h-4 w-4 text-gray-400 cursor-help" />
                            </Tooltip>
                          </div>
                          <select
                            id="reportTo"
                            value={trainingConfig.report_to}
                            onChange={(e) => setTrainingConfig(prev => ({ ...prev, report_to: e.target.value as 'wandb' | 'tensorboard' | 'none' }))}
                            className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                          >
                            <option value="tensorboard">TensorBoard</option>
                            <option value="wandb">Weights & Biases</option>
                            <option value="none">No Tracking</option>
                          </select>
                        </div>
                      </motion.div>
                    )}
                  </div>

                  {/* Memory & Performance */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 pb-2">
                      <div>
                        <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Memory & Performance</h4>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Optimize memory usage and training performance</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowMemoryPerformance(!showMemoryPerformance)}
                        leftIcon={showMemoryPerformance ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                        className="text-xs"
                      >
                        {showMemoryPerformance ? 'Hide' : 'Show'}
                      </Button>
                    </div>
                    {showMemoryPerformance && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        className="space-y-6"
                      >
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <label htmlFor="dataloaderWorkers" className="block text-sm font-medium">
                                Dataloader Workers
                              </label>
                              <Tooltip content="Number of parallel workers for data loading.">
                                <HelpCircle className="h-4 w-4 text-gray-400 cursor-help" />
                              </Tooltip>
                            </div>
                            <div className="flex items-center space-x-3">
                              <input
                                type="range"
                                id="dataloaderWorkers"
                                min="0"
                                max="8"
                                step="1"
                                value={trainingConfig.dataloader_num_workers}
                                onChange={(e) => setTrainingConfig(prev => ({ ...prev, dataloader_num_workers: parseInt(e.target.value) }))}
                                className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-primary-600"
                              />
                              <div className="w-16">
                                <input
                                  type="number"
                                  min="0"
                                  max="8"
                                  step="1"
                                  value={trainingConfig.dataloader_num_workers}
                                  onChange={(e) => setTrainingConfig(prev => ({ ...prev, dataloader_num_workers: parseInt(e.target.value) || 0 }))}
                                  className="w-full px-2 py-1 text-sm text-center border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                />
                              </div>
                            </div>
                            <div className="flex justify-between text-xs text-gray-500">
                              <span>0</span>
                              <span>4</span>
                              <span>8</span>
                            </div>
                          </div>

                        </div>

                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <input
                                type="checkbox"
                                id="pinMemory"
                                checked={trainingConfig.dataloader_pin_memory}
                                onChange={(e) => setTrainingConfig(prev => ({ ...prev, dataloader_pin_memory: e.target.checked }))}
                                className="h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                              />
                              <div>
                                <label htmlFor="pinMemory" className="block text-sm font-medium">
                                  Pin Memory
                                </label>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                  Faster data transfer to GPU
                                </p>
                              </div>
                            </div>
                            <Tooltip content="Pins memory for faster GPU data transfer">
                              <HelpCircle className="h-4 w-4 text-gray-400 cursor-help" />
                            </Tooltip>
                          </div>
                          
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <input
                                type="checkbox"
                                id="gradientCheckpointing"
                                checked={trainingConfig.gradient_checkpointing}
                                onChange={(e) => setTrainingConfig(prev => ({ ...prev, gradient_checkpointing: e.target.checked }))}
                                className="h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                              />
                              <div>
                                <label htmlFor="gradientCheckpointing" className="block text-sm font-medium">
                                  Gradient Checkpointing
                                </label>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                  Trade compute for memory savings
                                </p>
                              </div>
                            </div>
                            <Tooltip content="Reduces memory usage at the cost of additional computation">
                              <HelpCircle className="h-4 w-4 text-gray-400 cursor-help" />
                            </Tooltip>
                          </div>
                          
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <input
                                type="checkbox"
                                id="fp16"
                                checked={trainingConfig.fp16}
                                onChange={(e) => setTrainingConfig(prev => ({ ...prev, fp16: e.target.checked }))}
                                className="h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                              />
                              <div>
                                <label htmlFor="fp16" className="block text-sm font-medium">
                                  FP16 Mixed Precision
                                </label>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                  Faster training with half precision
                                </p>
                              </div>
                            </div>
                            <Tooltip content="Uses 16-bit floating point for faster training">
                              <HelpCircle className="h-4 w-4 text-gray-400 cursor-help" />
                            </Tooltip>
                          </div>
                          
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <input
                                type="checkbox"
                                id="bf16"
                                checked={trainingConfig.bf16}
                                onChange={(e) => setTrainingConfig(prev => ({ ...prev, bf16: e.target.checked }))}
                                className="h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                              />
                              <div>
                                <label htmlFor="bf16" className="block text-sm font-medium">
                                  BF16 Mixed Precision
                                </label>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                  Better numerical stability than FP16
                                </p>
                              </div>
                            </div>
                            <Tooltip content="Brain floating point 16-bit with better numerical stability">
                              <HelpCircle className="h-4 w-4 text-gray-400 cursor-help" />
                            </Tooltip>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </div>
                </motion.div>
              </CardContent>
            )}
          </Card>

          


          {/* Final Review Configuration Button */}
          <div className="flex justify-center py-8 px-6">
            <Button
              variant="primary"
              size="lg"
              className="w-full max-w-md"
              leftIcon={<Settings className="h-5 w-5" />}
              onClick={() => setIsReviewModalOpen(true)}
            >
              Review Configuration
            </Button>
          </div>

        </div>
        
        <div className="space-y-6">
          {/* Configuration Management */}
          <ConfigurationManager
            currentConfig={getCurrentConfig()}
            onLoadConfig={handleLoadConfig}
            currentConfigName={currentConfigName}
          />

          <Card className="sticky top-20">
            <CardHeader>
              <CardTitle>Training Summary</CardTitle>
              <CardDescription>
                Review your configuration before starting
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <p className="text-sm font-medium">Base Model</p>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  {selectedBaseModel ? selectedBaseModel.name : 'No model selected'}
                </p>
                {selectedBaseModel && (
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" size="sm">{selectedBaseModel.size}</Badge>
                    <Badge variant="outline" size="sm">{selectedBaseModel.architecture}</Badge>
                    {activeModelTab === 'huggingface' && selectedBaseModel.family && (
                      <Badge variant="outline" size="sm">{selectedBaseModel.family}</Badge>
                    )}
                  </div>
                )}
              </div>
              
              <div className="space-y-1">
                <p className="text-sm font-medium">Dataset</p>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  {files.length > 0 
                    ? `${files.length} file${files.length > 1 ? 's' : ''} (${(files.reduce((total, file) => total + file.size, 0) / 1024 / 1024).toFixed(2)} MB total)`
                    : 'No files uploaded'
                  }
                </p>
                {validationStatus === 'valid' && (
                  <div className="flex items-center gap-1 mt-1">
                    <Check className="h-3 w-3 text-green-500" />
                    <span className="text-xs text-green-600 dark:text-green-400">Validated</span>
                  </div>
                )}
              </div>
              
              <div className="space-y-1">
                <p className="text-sm font-medium">Key Parameters</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">Epochs</p>
                    <p className="text-gray-700 dark:text-gray-300">{parameters.epochs}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">Batch Size</p>
                    <p className="text-gray-700 dark:text-gray-300">{parameters.batchSize}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">Learning Rate</p>
                    <p className="text-gray-700 dark:text-gray-300">{parameters.learningRate.toExponential(4)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">Max Sequence</p>
                    <p className="text-gray-700 dark:text-gray-300">{parameters.maxSequenceLength}</p>
                  </div>
                </div>
              </div>
              
              <div className="space-y-1">
                <p className="text-sm font-medium">Output</p>
                <p className="text-sm text-gray-700 dark:text-gray-300">{parameters.modelName}</p>
                {trainingConfig.push_to_hub && trainingConfig.hub_model_id && (
                  <div className="flex items-center gap-1 mt-1">
                    <span className="text-xs text-blue-600 dark:text-blue-400">🤗 Push to Hub:</span>
                    <span className="text-xs text-gray-600 dark:text-gray-400">{trainingConfig.hub_model_id}</span>
                  </div>
                )}
              </div>
              
              <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                <div className="flex justify-between items-center mb-1">
                  <p className="text-sm font-medium">Estimated Time</p>
                  <span className="text-sm font-medium">{estimatedTime()} min</span>
                </div>
                
                <div className="flex justify-between items-center">
                  <p className="text-sm font-medium">Estimated Cost</p>
                  <span className="text-sm font-medium">${estimatedCost()}</span>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex justify-center border-t">
              <Button
                variant="primary"
                size="lg"
                className="w-full"
                leftIcon={<Settings className="h-4 w-4" />}
                onClick={() => setIsReviewModalOpen(true)}
              >
                Review Configuration
              </Button>
            </CardFooter>
          </Card>

        </div>
      </div>

      {/* Configuration Review Modal */}
      <ConfigurationReviewModal
        isOpen={isReviewModalOpen}
        onClose={() => setIsReviewModalOpen(false)}
        onStartTraining={handleStartFineTuning}
        configuration={{
          selectedBaseModel,
          files,
          validationStatus,
          parameters,
          trainingConfig,
          estimatedTime: estimatedTime(),
          estimatedCost: estimatedCost()
        }}
      />
    </div>
  );
}
