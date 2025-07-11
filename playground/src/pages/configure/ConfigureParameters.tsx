import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { RotateCcw, Settings, ChevronDown, ChevronUp, AlertCircle, Check, Upload, Download, Plus, X, Copy, FileText, HelpCircle } from 'lucide-react';
import { createTrainingConfig } from '../../config/training';
import { useConfigureContext } from './ConfigureContext';
import { StepNavigation } from '../../components/ui/StepProgress';
import { ConfigurationManager } from '../../components/ui/ConfigurationManager';
import { ConfigurationReviewModal } from '../../components/ui/ConfigurationReviewModal';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import trainingSessionService from '../../services/trainingSessionService';
import { fileService, FileMetadata } from '../../services/fileService';
import { datasetService, ProcessedDataset } from '../../services/datasetService';
import { API_BASE_URL, API_BASE_URL_WITH_API } from '../../config/api';

export default function ConfigureParameters() {
  const navigate = useNavigate();
  const { state, dispatch, completeCurrentStep } = useConfigureContext();
  const { parameters, trainingConfig, selectedBaseModel, files, validationStatus, activeModelTab, selectedFileId } = state;

  // Local state for UI
  const [showLoRAConfig, setShowLoRAConfig] = useState(true);
  const [showQuantizationConfig, setShowQuantizationConfig] = useState(true);
  const [showOptimization, setShowOptimization] = useState(true);
  const [showTrainingStability, setShowTrainingStability] = useState(true);
  const [showMemoryPerformance, setShowMemoryPerformance] = useState(true);
  const [showCustomParams, setShowCustomParams] = useState(true);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [currentConfigName, setCurrentConfigName] = useState('Default Settings');
  
  // JSON Import/Export state
  const [jsonImportText, setJsonImportText] = useState('');
  const [showJsonImport, setShowJsonImport] = useState(false);
  const [jsonImportError, setJsonImportError] = useState<string | null>(null);
  
  // Custom parameters state
  const [customParameters, setCustomParameters] = useState<Array<{id: string, key: string, value: string, type: 'string' | 'number' | 'boolean'}>>([]);
  
  // Display state for number inputs (what user sees while typing)
  const [displayValues, setDisplayValues] = useState<{
    epochs: string;
    learningRate: string;
    batchSize: string;
    maxSequenceLength: string;
    loggingSteps: string;
    cutoff: string;
    // Training config display values
    maxSampleSize: string;
    loraRank: string;
    loraAlpha: string;
    loraDropout: string;
    warmupSteps: string;
    adamBeta1: string;
    adamBeta2: string;
    maxGradNorm: string;
    gradAccumSteps: string;
    weightDecay: string;
    dropoutRate: string;
    attentionDropout: string;
    labelSmoothing: string;
    dataloaderWorkers: string;
  }>({
    epochs: '',
    learningRate: '',
    batchSize: '',
    maxSequenceLength: '',
    loggingSteps: '',
    cutoff: '',
    maxSampleSize: '',
    loraRank: '',
    loraAlpha: '',
    loraDropout: '',
    warmupSteps: '',
    adamBeta1: '',
    adamBeta2: '',
    maxGradNorm: '',
    gradAccumSteps: '',
    weightDecay: '',
    dropoutRate: '',
    attentionDropout: '',
    labelSmoothing: '',
    dataloaderWorkers: '',
  });
  
  // Selected file metadata state - can be either file metadata or dataset metadata
  const [selectedFileMetadata, setSelectedFileMetadata] = useState<FileMetadata | null>(null);
  const [selectedDatasetMetadata, setSelectedDatasetMetadata] = useState<ProcessedDataset | null>(null);
  const [isLoadingFileMetadata, setIsLoadingFileMetadata] = useState(false);
  const [isDatasetSelected, setIsDatasetSelected] = useState(false);

  // Initialize display values when parameters change
  useEffect(() => {
    setDisplayValues(prev => ({
      ...prev,
      epochs: parameters.epochs.toString(),
      learningRate: parameters.learningRate.toString(),
      batchSize: parameters.batchSize.toString(),
      maxSequenceLength: parameters.maxSequenceLength.toString(),
      loggingSteps: parameters.loggingSteps.toString(),
      cutoff: Math.round(parameters.cutoff * 100).toString(),
    }));
  }, [parameters]);

  // Initialize training config display values
  useEffect(() => {
    setDisplayValues(prev => ({
      ...prev,
      maxSampleSize: trainingConfig.max_sample_size?.toString() || '',
      loraRank: trainingConfig.lora_rank.toString(),
      loraAlpha: trainingConfig.lora_alpha.toString(),
      loraDropout: trainingConfig.lora_dropout.toString(),
      warmupSteps: trainingConfig.warmup_steps.toString(),
      adamBeta1: trainingConfig.adam_beta1.toString(),
      adamBeta2: trainingConfig.adam_beta2.toString(),
      maxGradNorm: trainingConfig.max_grad_norm.toString(),
      gradAccumSteps: trainingConfig.gradient_accumulation_steps.toString(),
      weightDecay: trainingConfig.weight_decay.toString(),
      dropoutRate: trainingConfig.dropout_rate.toString(),
      attentionDropout: trainingConfig.attention_dropout.toString(),
      labelSmoothing: trainingConfig.label_smoothing_factor.toString(),
      dataloaderWorkers: trainingConfig.dataloader_num_workers.toString(),
    }));
  }, [trainingConfig]);

  // Load selected file/dataset metadata when selectedFileId changes
  useEffect(() => {
    const loadSelectedMetadata = async () => {
      if (selectedFileId) {
        try {
          setIsLoadingFileMetadata(true);
          
          // Check if the ID starts with "dataset_" to determine if it's a dataset
          if (selectedFileId.startsWith('dataset_')) {
            // It's a dataset ID, use dataset service
            setIsDatasetSelected(true);
            const response = await datasetService.getDataset(selectedFileId);
            if (response.success) {
              setSelectedDatasetMetadata(response.dataset);
              setSelectedFileMetadata(null);
            }
          } else {
            // It's a file ID, use file service
            setIsDatasetSelected(false);
            const response = await fileService.getFileInfo(selectedFileId);
            if (response.success) {
              setSelectedFileMetadata(response.file_info);
              setSelectedDatasetMetadata(null);
            }
          }
        } catch (error) {
          console.error('Failed to load selected metadata:', error);
          setSelectedFileMetadata(null);
          setSelectedDatasetMetadata(null);
        } finally {
          setIsLoadingFileMetadata(false);
        }
      } else {
        setSelectedFileMetadata(null);
        setSelectedDatasetMetadata(null);
        setIsDatasetSelected(false);
      }
    };

    loadSelectedMetadata();
  }, [selectedFileId]);

  const handleParameterChange = (field: string, value: string | number) => {
    dispatch({ 
      type: 'SET_PARAMETERS', 
      payload: { [field]: value } 
    });
  };

  const handleTrainingConfigChange = (field: string, value: any) => {
    dispatch({ 
      type: 'SET_TRAINING_CONFIG', 
      payload: { [field]: value } 
    });
  };

  // New improved input handlers using display state
  const handleDisplayValueChange = (field: keyof typeof displayValues, value: string) => {
    setDisplayValues(prev => ({ ...prev, [field]: value }));
  };

  // Helper function to handle number input changes with real-time display updates
  const handleNumberInputChange = (field: string, displayField: keyof typeof displayValues, value: string, min: number, max: number, isInteger: boolean = true) => {
    // Always update display value immediately for real-time feedback
    handleDisplayValueChange(displayField, value);
    
    // Only update stored value if it's a valid number within range
    if (value !== '') {
      const numValue = isInteger ? parseInt(value) : parseFloat(value);
      if (!isNaN(numValue) && numValue >= min && numValue <= max) {
        handleParameterChange(field, numValue);
      }
    }
  };

  // Helper function for training config number inputs with real-time display updates
  const handleTrainingConfigNumberChange = (field: string, displayField: keyof typeof displayValues, value: string, min: number, max: number, isInteger: boolean = true) => {
    // Always update display value immediately for real-time feedback
    handleDisplayValueChange(displayField, value);
    
    // Only update stored value if it's a valid number within range
    if (value !== '') {
      const numValue = isInteger ? parseInt(value) : parseFloat(value);
      if (!isNaN(numValue) && numValue >= min && numValue <= max) {
        handleTrainingConfigChange(field, numValue);
      }
    }
  };

  // Helper function to handle input blur (when user finishes editing)
  const handleNumberInputBlur = (field: string, displayField: keyof typeof displayValues, value: string, min: number, max: number, defaultValue: number, isInteger: boolean = true) => {
    if (value === '' || isNaN(isInteger ? parseInt(value) : parseFloat(value))) {
      // Reset to default value
      handleParameterChange(field, defaultValue);
      handleDisplayValueChange(displayField, defaultValue.toString());
    } else {
      const numValue = isInteger ? parseInt(value) : parseFloat(value);
      if (numValue < min) {
        // Clamp to minimum value
        handleParameterChange(field, min);
        handleDisplayValueChange(displayField, min.toString());
      } else if (numValue > max) {
        // Clamp to maximum value
        handleParameterChange(field, max);
        handleDisplayValueChange(displayField, max.toString());
      } else {
        // Valid value, ensure it's stored
        handleParameterChange(field, numValue);
        handleDisplayValueChange(displayField, numValue.toString());
      }
    }
  };

  // Helper function for training config input blur
  const handleTrainingConfigInputBlur = (field: string, displayField: keyof typeof displayValues, value: string, min: number, max: number, defaultValue: number, isInteger: boolean = true) => {
    if (value === '' || isNaN(isInteger ? parseInt(value) : parseFloat(value))) {
      // Reset to default value
      handleTrainingConfigChange(field, defaultValue);
      handleDisplayValueChange(displayField, defaultValue.toString());
    } else {
      const numValue = isInteger ? parseInt(value) : parseFloat(value);
      if (numValue < min) {
        // Clamp to minimum value
        handleTrainingConfigChange(field, min);
        handleDisplayValueChange(displayField, min.toString());
      } else if (numValue > max) {
        // Clamp to maximum value
        handleTrainingConfigChange(field, max);
        handleDisplayValueChange(displayField, max.toString());
      } else {
        // Valid value, ensure it's stored
        handleTrainingConfigChange(field, numValue);
        handleDisplayValueChange(displayField, numValue.toString());
      }
    }
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

  // Helper function to handle input focus - select all text for easy replacement
  const handleInputFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.select();
  };

  // JSON Import/Export functions
  const handleJsonImport = () => {
    try {
      setJsonImportError(null);
      const config = JSON.parse(jsonImportText);
      
      // Support multiple JSON formats
      if (config.basic_parameters && config.advanced_parameters) {
        // Our internal format
        handleLoadConfig(config);
      } else if (config.epochs || config.learning_rate || config.num_train_epochs) {
        // Direct parameters format
        const basicParams: any = {};
        const advancedParams: any = {};
        
        // Map common parameter names
        if (config.epochs) basicParams.epochs = config.epochs;
        if (config.num_train_epochs) basicParams.epochs = config.num_train_epochs;
        if (config.learning_rate) basicParams.learningRate = config.learning_rate;
        if (config.per_device_train_batch_size) basicParams.batchSize = config.per_device_train_batch_size;
        if (config.max_seq_length) basicParams.maxSequenceLength = config.max_seq_length;
        if (config.logging_steps) basicParams.loggingSteps = config.logging_steps;
        if (config.model_name) basicParams.modelName = config.model_name;
        
        // Map advanced parameters
        Object.keys(config).forEach(key => {
          if (!['epochs', 'num_train_epochs', 'learning_rate', 'per_device_train_batch_size', 'max_seq_length', 'logging_steps', 'model_name'].includes(key)) {
            advancedParams[key] = config[key];
          }
        });
        
        handleLoadConfig({
          basic_parameters: basicParams,
          advanced_parameters: advancedParams
        });
      } else {
        // Assume it's all advanced parameters
        handleLoadConfig({
          basic_parameters: {},
          advanced_parameters: config
        });
      }
      
      setJsonImportText('');
      setShowJsonImport(false);
      toast.success('Configuration imported successfully!');
    } catch (error: any) {
      setJsonImportError('Invalid JSON format: ' + error.message);
    }
  };

  const handleJsonExport = () => {
    const config = {
      basic_parameters: parameters,
      advanced_parameters: trainingConfig,
      custom_parameters: customParameters.reduce((acc, param) => {
        let value: any = param.value;
        if (param.type === 'number') {
          value = parseFloat(param.value);
        } else if (param.type === 'boolean') {
          value = param.value === 'true';
        }
        acc[param.key] = value;
        return acc;
      }, {} as Record<string, any>),
      metadata: {
        name: currentConfigName,
        exported_at: new Date().toISOString(),
        version: '1.0'
      }
    };
    
    const jsonString = JSON.stringify(config, null, 2);
    navigator.clipboard.writeText(jsonString);
    toast.success('Configuration copied to clipboard!');
  };

  // Custom parameters functions
  const addCustomParameter = () => {
    const newParam = {
      id: Date.now().toString(),
      key: '',
      value: '',
      type: 'string' as const
    };
    setCustomParameters([...customParameters, newParam]);
  };

  const updateCustomParameter = (id: string, field: 'key' | 'value' | 'type', value: string) => {
    setCustomParameters(params => 
      params.map(param => 
        param.id === id ? { ...param, [field]: value } : param
      )
    );
  };

  const removeCustomParameter = (id: string) => {
    setCustomParameters(params => params.filter(param => param.id !== id));
  };

  const detectParameterType = (value: string): 'string' | 'number' | 'boolean' => {
    if (value === 'true' || value === 'false') return 'boolean';
    if (!isNaN(Number(value)) && value.trim() !== '') return 'number';
    return 'string';
  };

  const resetToDefaults = () => {
    dispatch({ 
      type: 'SET_PARAMETERS', 
      payload: {
        epochs: 3,
        learningRate: 0.0002,
        batchSize: 8,
        maxSequenceLength: 2048,
        modelName: '',
        cutoff: 0.8,
        loggingSteps: 10,
      }
    });
    dispatch({ 
      type: 'SET_TRAINING_CONFIG', 
      payload: createTrainingConfig({})
    });
  };

  // Calculate estimated time based on parameters (mock calculation)
  const estimatedTime = () => {
    const baseTime = 15; // minutes
    const epochFactor = parameters.epochs * 1.2;
    const batchFactor = 12 / parameters.batchSize;
    const sequenceFactor = parameters.maxSequenceLength / 256;
    
    return Math.round(baseTime * epochFactor * batchFactor * sequenceFactor);
  };

  // Calculate estimated cost (mock calculation)
  const estimatedCost = () => {
    const baseCost = 0.5; // dollars
    const epochFactor = parameters.epochs;
    const sizeFactor = 1.2;
    
    return (baseCost * epochFactor * sizeFactor).toFixed(2);
  };

  // Handle loading a configuration
  const handleLoadConfig = (config: any) => {
    if (config.basic_parameters) {
      dispatch({ 
        type: 'SET_PARAMETERS', 
        payload: config.basic_parameters 
      });
    }

    if (config.advanced_parameters) {
      dispatch({ 
        type: 'SET_TRAINING_CONFIG', 
        payload: config.advanced_parameters 
      });
    }

    setCurrentConfigName(config.metadata?.name || 'Loaded Configuration');
  };

  // Get current configuration for saving
  const getCurrentConfig = () => {
    return {
      basic_parameters: parameters,
      advanced_parameters: trainingConfig
    };
  };

  const handleStartFineTuning = async () => {
    // Validate model name is not empty
    if (!parameters.modelName || parameters.modelName.trim() === '') {
      toast.error('Please enter a model name before starting fine-tuning.');
      return;
    }

    // Check if a file is selected from the backend file manager
    if (!selectedFileId) {
      toast.error('No training file selected. Please select a file first.');
      return;
    }

    if (!selectedBaseModel) {
      toast.error('Please select a base model before starting fine-tuning.');
      return;
    }

    // Validate that the selected metadata is loaded
    if (!selectedFileMetadata && !selectedDatasetMetadata) {
      toast.error('Data information not loaded. Please try again.');
      return;
    }

    // Validate data status
    if (selectedFileMetadata && selectedFileMetadata.validation_status !== 'valid') {
      toast.error('Selected file is not valid for training. Please select a valid file.');
      return;
    }

    // Create training session before starting the API call
    try {
      // Create a mock File object for the session using selected metadata
      let mockFile: File;
      
      if (selectedFileMetadata) {
        // Using file metadata
        mockFile = new File([''], selectedFileMetadata.original_filename, { 
          type: selectedFileMetadata.file_type === 'json' ? 'application/json' : 'text/csv' 
        });
        Object.defineProperty(mockFile, 'size', { value: selectedFileMetadata.file_size, writable: false });
      } else if (selectedDatasetMetadata) {
        // Using dataset metadata
        mockFile = new File([''], selectedDatasetMetadata.source_filename, { 
          type: 'application/json' // Datasets are always stored as JSON
        });
        Object.defineProperty(mockFile, 'size', { value: selectedDatasetMetadata.file_size, writable: false });
      } else {
        // Fallback
        mockFile = new File([''], 'training_data.json', { type: 'application/json' });
      }

      // Create the training session
      const session = trainingSessionService.createSession(
        selectedBaseModel,
        [mockFile],
        parameters,
        trainingConfig,
        parameters.modelName
      );

      console.log('Created training session:', session);
    } catch (error) {
      console.error('Failed to create training session:', error);
      // Continue with the API call even if session creation fails
    }

    // Get the model identifier based on the type
    const modelIdentifier = activeModelTab === 'huggingface' 
      ? selectedBaseModel.hf_model_id || selectedBaseModel.name
      : selectedBaseModel.name;
    
    // Prepare the request payload for the new file-based API (without file_id)
    const payload = {
      model_name: modelIdentifier,
      max_seq_length: parameters.maxSequenceLength,
      num_train_epochs: parameters.epochs,
      per_device_train_batch_size: parameters.batchSize,
      gradient_accumulation_steps: trainingConfig.gradient_accumulation_steps,
      learning_rate: parameters.learningRate,
      warmup_steps: trainingConfig.warmup_steps,
      save_steps: trainingConfig.save_steps,
      logging_steps: parameters.loggingSteps,
      output_dir: `./results/${parameters.modelName}`,
      
      // Dataset Sampling
      max_sample_size: trainingConfig.max_sample_size,
      
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
      
      // Additional options
      seed: trainingConfig.seed,
      remove_unused_columns: trainingConfig.remove_unused_columns,
      push_to_hub: trainingConfig.push_to_hub,
      hub_model_id: trainingConfig.hub_model_id,
      report_to: trainingConfig.report_to
    };
    
    console.log('Training payload:', payload);
    console.log('File ID (query param):', selectedFileId);
    
    // Show loading toast
    toast.loading('Starting fine-tuning process...');
    
    // Make API call to the file-based endpoint with file_id as query parameter
    try {
      const response = await fetch(`${API_BASE_URL}/finetune-with-file?file_id=${encodeURIComponent(selectedFileId)}`, {
        method: 'POST', 
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail?.[0]?.msg || 'Fine-tuning request failed');
      }

      const data = await response.json();
      
      // Update session with the backend-returned session ID
      if (data.job_id) {
        console.log('Updating session with backend job_id:', data.job_id);
        trainingSessionService.updateSessionId(data.job_id);
      }
      
      // Update session status to indicate training has started
      trainingSessionService.updateSessionStatus('initializing');
      
      toast.dismiss();
      toast.success('Fine-tuning started successfully!');
      navigate('/progress');
    } catch (error: any) {
      toast.dismiss();
      toast.error('Failed to start fine-tuning: ' + error.message);
      
      // Update session status to failed if API call fails
      trainingSessionService.updateSessionStatus('failed');
    }
  };

  // Handle navigation
  const handlePrevious = () => {
    navigate('/configure/data');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configure Training Parameters</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Set up hyperparameters and advanced settings for your fine-tuning job
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">

          {/* Quick Configuration - JSON Import/Export */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <FileText className="h-5 w-5" />
                  <span>Quick Configuration</span>
                </div>
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowJsonImport(!showJsonImport)}
                    leftIcon={<Upload className="h-4 w-4" />}
                  >
                    Import JSON
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleJsonExport}
                    leftIcon={<Download className="h-4 w-4" />}
                  >
                    Export JSON
                  </Button>
                </div>
              </CardTitle>
              <CardDescription>
                Import configuration from JSON or export current settings
              </CardDescription>
            </CardHeader>
            {showJsonImport && (
              <CardContent>
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-4"
                >
                  <div>
                    <label htmlFor="jsonImport" className="block text-sm font-medium mb-2">
                      Paste Configuration JSON
                    </label>
                    <textarea
                      id="jsonImport"
                      value={jsonImportText}
                      onChange={(e) => setJsonImportText(e.target.value)}
                      className="w-full h-32 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder='{"basic_parameters": {...}, "advanced_parameters": {...}}'
                    />
                    {jsonImportError && (
                      <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                        {jsonImportError}
                      </p>
                    )}
                  </div>
                  <div className="flex space-x-3">
                    <Button
                      variant="primary"
                      onClick={handleJsonImport}
                      disabled={!jsonImportText.trim()}
                    >
                      Import & Apply
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setJsonImportText('');
                        setJsonImportError(null);
                        setShowJsonImport(false);
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </motion.div>
              </CardContent>
            )}
          </Card>

          {/* Model Name and Description */}
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
            Model Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="modelName"
            value={parameters.modelName}
            onChange={(e) => handleParameterChange('modelName', e.target.value)}
            className={`w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:border-transparent ${
              parameters.modelName.trim() === '' 
                ? 'border-red-300 dark:border-red-600 bg-red-50 dark:bg-red-900/20 focus:ring-red-500' 
                : 'border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 focus:ring-primary-500'
            }`}
            placeholder="Enter a name for your fine-tuned model"
            required
          />
          {parameters.modelName.trim() === '' && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">
              Model name is required
            </p>
          )}
        </div>

        {/* Hugging Face Hub Integration */}
        <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
          <div className="space-y-3">
            <div className="flex items-center space-x-3">
              <input
                type="checkbox"
                id="pushToHub"
                checked={trainingConfig.push_to_hub}
                onChange={(e) => handleTrainingConfigChange('push_to_hub', e.target.checked)}
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
                  onChange={(e) => handleTrainingConfigChange('hub_model_id', e.target.value)}
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

          {/* Parameters Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Parameters</span>
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
              
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
              {/* Basic Parameters Section */}
              <div className="space-y-4">
                <div className="border-b border-gray-200 dark:border-gray-700 pb-2">
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Basic Parameters</h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Configure the core hyperparameters for your fine-tuning job</p>
                </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Epochs */}
                <div className="space-y-2">
                  <label htmlFor="epochs" className="block text-sm font-medium">
                    Number of Epochs
                  </label>
                  <p className="text-xs text-gray-500 dark:text-gray-400 -mt-1 mb-2">
                    How many times to iterate through the training data
                  </p>
                  <input
                    type="number"
                    id="epochs"
                    min="1"
                    max="10"
                    step="1"
                    value={displayValues.epochs}
                    onChange={(e) => handleNumberInputChange('epochs', 'epochs', e.target.value, 1, 10, true)}
                    onBlur={(e) => handleNumberInputBlur('epochs', 'epochs', e.target.value, 1, 10, 3, true)}
                    onFocus={handleInputFocus}
                    placeholder="3 (recommended)"
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Typical range: 1-10 epochs
                  </p>
                </div>
                
                {/* Learning Rate */}
                <div className="space-y-2">
                  <label htmlFor="learningRate" className="block text-sm font-medium">
                    Learning Rate
                  </label>
                  <p className="text-xs text-gray-500 dark:text-gray-400 -mt-1 mb-2">
                    Controls how quickly the model adapts to new data
                  </p>
                  <input
                    type="number"
                    id="learningRate"
                    min="0.00001"
                    max="0.001"
                    step="0.00001"
                    value={displayValues.learningRate}
                    onChange={(e) => handleNumberInputChange('learningRate', 'learningRate', e.target.value, 0.00001, 0.001, false)}
                    onBlur={(e) => handleNumberInputBlur('learningRate', 'learningRate', e.target.value, 0.00001, 0.001, 0.0002, false)}
                    onFocus={handleInputFocus}
                    placeholder="0.0002 (recommended)"
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Typical range: 0.00001 - 0.001
                  </p>
                </div>
                
                {/* Batch Size */}
                <div className="space-y-2">
                  <label htmlFor="batchSize" className="block text-sm font-medium">
                    Batch Size
                  </label>
                  <p className="text-xs text-gray-500 dark:text-gray-400 -mt-1 mb-2">
                    Number of training examples used in one iteration
                  </p>
                  <input
                    type="number"
                    id="batchSize"
                    min="1"
                    max="32"
                    step="1"
                    value={displayValues.batchSize}
                    onChange={(e) => handleNumberInputChange('batchSize', 'batchSize', e.target.value, 1, 32, true)}
                    onBlur={(e) => handleNumberInputBlur('batchSize', 'batchSize', e.target.value, 1, 32, 8, true)}
                    onFocus={handleInputFocus}
                    placeholder="8 (recommended)"
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Typical range: 1-32
                  </p>
                </div>
                
                {/* Max Sequence Length */}
                <div className="space-y-2">
                  <label htmlFor="maxSequenceLength" className="block text-sm font-medium">
                    Max Sequence Length
                  </label>
                  <p className="text-xs text-gray-500 dark:text-gray-400 -mt-1 mb-2">
                    Maximum length of input text sequences
                  </p>
                  <input
                    type="number"
                    id="maxSequenceLength"
                    min="128"
                    max="4096"
                    step="128"
                    value={displayValues.maxSequenceLength}
                    onChange={(e) => handleNumberInputChange('maxSequenceLength', 'maxSequenceLength', e.target.value, 128, 4096, true)}
                    onBlur={(e) => handleNumberInputBlur('maxSequenceLength', 'maxSequenceLength', e.target.value, 128, 4096, 2048, true)}
                    onFocus={handleInputFocus}
                    placeholder="2048 (recommended)"
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Typical range: 128-4096
                  </p>
                </div>
                
                {/* Logging Steps */}
                <div className="space-y-2">
                  <label htmlFor="loggingSteps" className="block text-sm font-medium">
                    Logging Steps
                  </label>
                  <p className="text-xs text-gray-500 dark:text-gray-400 -mt-1 mb-2">
                    How often to log training metrics. Lower values provide more frequent updates but may slow training slightly.
                  </p>
                  <input
                    type="number"
                    id="loggingSteps"
                    min="1"
                    max="100"
                    step="1"
                    value={displayValues.loggingSteps}
                    onChange={(e) => handleNumberInputChange('loggingSteps', 'loggingSteps', e.target.value, 1, 100, true)}
                    onBlur={(e) => handleNumberInputBlur('loggingSteps', 'loggingSteps', e.target.value, 1, 100, 10, true)}
                    onFocus={handleInputFocus}
                    placeholder="10 (recommended)"
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Typical range: 1-100 steps
                  </p>
                </div>

                {/* Max Sample Size */}
                <div className="space-y-2">
                  <label htmlFor="maxSampleSize" className="block text-sm font-medium">
                    Max Sample Size
                  </label>
                  <p className="text-xs text-gray-500 dark:text-gray-400 -mt-1 mb-2">
                    Limit the number of training samples. Leave empty to use all available data. Useful for quick experiments with large datasets.
                  </p>
                  <div className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      id="enableMaxSampleSize"
                      checked={trainingConfig.max_sample_size !== null}
                      onChange={(e) => {
                        if (e.target.checked) {
                          handleTrainingConfigChange('max_sample_size', 1000);
                        } else {
                          handleTrainingConfigChange('max_sample_size', null);
                        }
                      }}
                      className="h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                    />
                    <label htmlFor="enableMaxSampleSize" className="text-sm">
                      Limit sample size
                    </label>
                  </div>
                  {trainingConfig.max_sample_size !== null && (
                    <div className="mt-2">
                      <input
                        type="number"
                        id="maxSampleSize"
                        min="10"
                        max="1000000"
                        step="10"
                        value={trainingConfig.max_sample_size || 1000}
                        onChange={(e) => handleTrainingConfigNumberChange('max_sample_size', 'maxSampleSize', e.target.value, 10, 1000000, true)}
                        onBlur={(e) => handleTrainingConfigInputBlur('max_sample_size', 'maxSampleSize', e.target.value, 10, 1000000, 1000, true)}
                        onFocus={handleInputFocus}
                        placeholder="1000 (recommended)"
                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      />
                    </div>
                  )}
                  {trainingConfig.max_sample_size !== null && selectedFileMetadata && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Using {Math.min(trainingConfig.max_sample_size, selectedFileMetadata.validation_details.total_rows).toLocaleString()} of {selectedFileMetadata.validation_details.total_rows.toLocaleString()} available samples 
                      ({((Math.min(trainingConfig.max_sample_size, selectedFileMetadata.validation_details.total_rows) / selectedFileMetadata.validation_details.total_rows) * 100).toFixed(1)}%)
                    </div>
                  )}
                  {trainingConfig.max_sample_size === null && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Will use all available data for training
                    </div>
                  )}
                </div>
                
                {/* Training/Validation Split */}
                <div className="space-y-2 md:col-span-2">
                  <div className=" items-center justify-between">
                    <label htmlFor="cutoff" className="block text-sm font-medium">
                      Training/Validation Split
                    </label>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Percentage of data used for training vs. validation.</p>
                    {/* <Tooltip content="Percentage of data used for training vs. validation">
                      <HelpCircle className="h-4 w-4 text-gray-400 cursor-help" />
                    </Tooltip> */}
                  </div>
                  <input
                    type="number"
                    id="cutoff"
                    min="50"
                    max="95"
                    step="5"
                    value={Math.round(parameters.cutoff * 100)}
                    onChange={(e) => handleParameterChange('cutoff', (parseInt(e.target.value) || 80) / 100)}
                    onFocus={handleInputFocus}
                    placeholder="80 (recommended)"
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Typical range: 50-95% for training
                  </p>
                </div>
                </div>
              </div>

              {/* Model Architecture & Configuration */}
              <div className="space-y-8">
                <div className="border-b border-gray-200 dark:border-gray-700 pb-2">
                  <div className="flex items-center space-x-2">
                    <Settings className="h-5 w-5" />
                    <div>
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Model Architecture & Configuration</h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Configure LoRA, quantization, optimization, and performance settings</p>
                    </div>
                  </div>
                </div>

                  {/* Quantization Configuration */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 pb-2">
                      <div>
                        <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Quantization Configuration</h4>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Configure model quantization for memory optimization</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowQuantizationConfig(!showQuantizationConfig)}
                        leftIcon={showQuantizationConfig ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                        className="text-xs"
                      >
                        {showQuantizationConfig ? 'Hide' : 'Show'}
                      </Button>
                    </div>
                    {showQuantizationConfig && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        className="space-y-4"
                      >
                        {/* Quantization Method */}
                        <div className="space-y-2">
                          <div className=" items-center justify-between">
                            <label htmlFor="quantization" className="block text-sm font-medium">
                              Quantization Method
                            </label>
                            <p className="text-xs text-gray-500 dark:text-gray-400 -mt-1 mb-2">
                            Quantization reduces memory usage by using lower precision weights. Choose based on your hardware constraints and accuracy requirements.
                            </p>
                            
                          </div>
                          <select
                            id="quantization"
                            value={trainingConfig.quantization}
                            onChange={(e) => handleTrainingConfigChange('quantization', e.target.value)}
                            className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                          >
                            <option value="4bit">4-bit Quantization (Maximum Memory Savings)</option>
                            <option value="8bit">8-bit Quantization (Balanced Memory/Accuracy)</option>
                            <option value="none">No Quantization (Full Precision)</option>
                          </select>
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {trainingConfig.quantization === '4bit' && (
                              <span>🔹 Recommended for limited GPU memory. Minimal accuracy loss with significant memory savings.</span>
                            )}
                            {trainingConfig.quantization === '8bit' && (
                              <span>🔸 Good balance between memory usage and model accuracy. Suitable for most use cases.</span>
                            )}
                            {trainingConfig.quantization === 'none' && (
                              <span>🔶 Full precision training. Requires more GPU memory but maintains maximum accuracy.</span>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </div>
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
                        {/* LoRA Rank */}
                        <div className="space-y-2">
                          <div className=" items-center justify-between">
                            <label htmlFor="loraRank" className="block text-sm font-medium">
                              LoRA Rank
                            </label>
                            <p className="text-xs text-gray-500 dark:text-gray-400 -mt-1 mb-2">
                            Rank of the low-rank adaptation matrices. Higher values allow more expressiveness but use more memory.
                            </p>
                            
                          </div>
                          <input
                            type="number"
                            id="loraRank"
                            min="1"
                            max="64"
                            step="1"
                            value={trainingConfig.lora_rank}
                            onChange={(e) => handleTrainingConfigChange('lora_rank', parseInt(e.target.value) || 1)}
                            onFocus={handleInputFocus}
                            placeholder="8 (recommended)"
                            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                          />
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            Typical range: 1-64
                          </p>
                        </div>

                        

                        {/* LoRA Alpha */}
                        <div className="space-y-2">
                          <div className=" items-center justify-between">
                            <label htmlFor="loraAlpha" className="block text-sm font-medium">
                              LoRA Alpha
                            </label>
                            <p className="text-xs text-gray-500 dark:text-gray-400 -mt-1 mb-2">
                            Scaling factor for LoRA. Typically set to 2x the rank value.
                            </p>
                          </div>
                          <input
                            type="number"
                            id="loraAlpha"
                            min="1"
                            max="128"
                            step="1"
                            value={trainingConfig.lora_alpha}
                            onChange={(e) => handleTrainingConfigChange('lora_alpha', parseInt(e.target.value) || 1)}
                            onFocus={handleInputFocus}
                            placeholder="16 (recommended)"
                            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                          />
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            Typical range: 1-128
                          </p>
                        </div>

                        {/* LoRA Dropout */}
                        <div className="space-y-2">
                          <div className=" items-center justify-between">
                            <label htmlFor="loraDropout" className="block text-sm font-medium">
                              LoRA Dropout
                            </label>
                            <p className="text-xs text-gray-500 dark:text-gray-400 -mt-1 mb-2">
                            Dropout rate applied to LoRA layers for regularization.
                            </p>
                            
                          </div>
                          <input
                            type="number"
                            id="loraDropout"
                            min="0"
                            max="0.5"
                            step="0.01"
                            value={trainingConfig.lora_dropout}
                            onChange={(e) => handleTrainingConfigChange('lora_dropout', parseFloat(e.target.value) || 0)}
                            onFocus={handleInputFocus}
                            placeholder="0.1 (recommended)"
                            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                          />
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            Typical range: 0-0.5
                          </p>
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
                          <div className=" items-center justify-between">
                            <label htmlFor="lrScheduler" className="block text-sm font-medium">
                              Learning Rate Scheduler
                            </label>
                            <p className="text-xs text-gray-500 dark:text-gray-400 -mt-1 mb-2">
                            Learning rate scheduling strategy during training.
                            </p>
                            
                          </div>
                          <select
                            id="lrScheduler"
                            value={trainingConfig.lr_scheduler_type}
                            onChange={(e) => handleTrainingConfigChange('lr_scheduler_type', e.target.value)}
                            className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                          >
                            <option value="linear">Linear</option>
                            <option value="cosine">Cosine</option>
                            <option value="polynomial">Polynomial</option>
                            <option value="constant">Constant</option>
                            <option value="constant_with_warmup">Constant with Warmup</option>
                          </select>
                        </div>

                        <div className="space-y-2">
                          <div className=" items-center justify-between">
                            <label htmlFor="warmupSteps" className="block text-sm font-medium">
                              Warmup Steps
                            </label>
                            <p className="text-xs text-gray-500 dark:text-gray-400 -mt-1 mb-2">
                            Number of steps to gradually increase learning rate from 0 to target value.
                            </p>
                          </div>
                          <input
                            type="number"
                            id="warmupSteps"
                            min="0"
                            max="1000"
                            step="10"
                            value={trainingConfig.warmup_steps}
                            onChange={(e) => handleTrainingConfigChange('warmup_steps', parseInt(e.target.value) || 0)}
                            onFocus={handleInputFocus}
                            placeholder="100 (recommended)"
                            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                          />
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            Typical range: 0-1000 steps
                          </p>
                        </div>

                        <div className="space-y-2">
                          <div className=" items-center justify-between">
                            <label htmlFor="adamBeta1" className="block text-sm font-medium">
                              Adam Beta1
                            </label>
                            <p className="text-xs text-gray-500 dark:text-gray-400 -mt-1 mb-2">
                            Exponential decay rate for first moment estimates in Adam optimizer.
                            </p>
                            
                          </div>
                          <input
                            type="number"
                            id="adamBeta1"
                            min="0.8"
                            max="0.99"
                            step="0.01"
                            value={trainingConfig.adam_beta1}
                            onChange={(e) => handleTrainingConfigChange('adam_beta1', parseFloat(e.target.value) || 0.9)}
                            onFocus={handleInputFocus}
                            placeholder="0.9 (recommended)"
                            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                          />
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            Typical range: 0.8-0.99
                          </p>
                        </div>

                        <div className="space-y-2">
                          <div className=" items-center justify-between">
                            <label htmlFor="adamBeta2" className="block text-sm font-medium">
                              Adam Beta2
                            </label>
                            <p className="text-xs text-gray-500 dark:text-gray-400 -mt-1 mb-2">
                            Exponential decay rate for second moment estimates in Adam optimizer.
                            </p>
                            
                          </div>
                          <input
                            type="number"
                            id="adamBeta2"
                            min="0.99"
                            max="0.9999"
                            step="0.0001"
                            value={trainingConfig.adam_beta2}
                            onChange={(e) => handleTrainingConfigChange('adam_beta2', parseFloat(e.target.value) || 0.999)}
                            onFocus={handleInputFocus}
                            placeholder="0.999 (recommended)"
                            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                          />
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            Typical range: 0.99-0.9999
                          </p>
                        </div>

                        <div className="space-y-2">
                          <div className=" items-center justify-between">
                            <label htmlFor="maxGradNorm" className="block text-sm font-medium">
                              Max Gradient Norm
                            </label>
                            <p className="text-xs text-gray-500 dark:text-gray-400 -mt-1 mb-2">
                            Maximum norm for gradient clipping to prevent exploding gradients.
                            </p>
                            
                          </div>
                          <input
                            type="number"
                            id="maxGradNorm"
                            min="0.1"
                            max="10"
                            step="0.1"
                            value={trainingConfig.max_grad_norm}
                            onChange={(e) => handleTrainingConfigChange('max_grad_norm', parseFloat(e.target.value) || 1.0)}
                            onFocus={handleInputFocus}
                            placeholder="1.0 (recommended)"
                            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                          />
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            Typical range: 0.1-10
                          </p>
                        </div>

                        <div className="space-y-2">
                          <div className=" items-center justify-between">
                            <label htmlFor="gradAccumSteps" className="block text-sm font-medium">
                              Gradient Accumulation Steps
                            </label>
                            <p className="text-xs text-gray-500 dark:text-gray-400 -mt-1 mb-2">
                            Number of steps to accumulate gradients before updating model weights.
                            </p>
                            
                          </div>
                          <input
                            type="number"
                            id="gradAccumSteps"
                            min="1"
                            max="32"
                            step="1"
                            value={trainingConfig.gradient_accumulation_steps}
                            onChange={(e) => handleTrainingConfigChange('gradient_accumulation_steps', parseInt(e.target.value) || 1)}
                            onFocus={handleInputFocus}
                            placeholder="4 (recommended)"
                            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                          />
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            Typical range: 1-32 steps
                          </p>
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
                          <div className=" items-center justify-between">
                            <label htmlFor="weightDecay" className="block text-sm font-medium">
                              Weight Decay
                            </label>
                            <p className="text-xs text-gray-500 dark:text-gray-400 -mt-1 mb-2">
                            L2 regularization parameter to prevent overfitting.
                            </p>
                            
                          </div>
                          <input
                            type="number"
                            id="weightDecay"
                            min="0"
                            max="0.1"
                            step="0.001"
                            value={trainingConfig.weight_decay}
                            onChange={(e) => handleTrainingConfigChange('weight_decay', parseFloat(e.target.value) || 0)}
                            onFocus={handleInputFocus}
                            placeholder="0.01 (recommended)"
                            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                          />
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            Typical range: 0-0.1
                          </p>
                        </div>

                        <div className="space-y-2">
                          <div className=" items-center justify-between">
                            <label htmlFor="dropoutRate" className="block text-sm font-medium">
                              Dropout Rate
                            </label>
                            <p className="text-xs text-gray-500 dark:text-gray-400 -mt-1 mb-2">
                            Probability of randomly setting input units to 0 during training.
                            </p>
                          </div>
                          <input
                            type="number"
                            id="dropoutRate"
                            min="0"
                            max="0.5"
                            step="0.01"
                            value={trainingConfig.dropout_rate}
                            onChange={(e) => handleTrainingConfigChange('dropout_rate', parseFloat(e.target.value) || 0)}
                            onFocus={handleInputFocus}
                            placeholder="0.1 (recommended)"
                            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                          />
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            Typical range: 0-0.5
                          </p>
                        </div>

                        <div className="space-y-2">
                          <div className=" items-center justify-between">
                            <label htmlFor="attentionDropout" className="block text-sm font-medium">
                              Attention Dropout
                            </label>
                            <p className="text-xs text-gray-500 dark:text-gray-400 -mt-1 mb-2">
                            Dropout rate specifically applied to attention layers.
                            </p>
                          </div>
                          <input
                            type="number"
                            id="attentionDropout"
                            min="0"
                            max="0.5"
                            step="0.01"
                            value={trainingConfig.attention_dropout}
                            onChange={(e) => handleTrainingConfigChange('attention_dropout', parseFloat(e.target.value) || 0)}
                            onFocus={handleInputFocus}
                            placeholder="0.1 (recommended)"
                            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                          />
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            Typical range: 0-0.5
                          </p>
                        </div>

                        <div className="space-y-2">
                          <div className=" items-center justify-between">
                            <label htmlFor="labelSmoothing" className="block text-sm font-medium">
                              Label Smoothing
                            </label>
                            <p className="text-xs text-gray-500 dark:text-gray-400 -mt-1 mb-2">
                            Smooths target labels to prevent overconfident predictions.
                            </p>
                          </div>
                          <input
                            type="number"
                            id="labelSmoothing"
                            min="0"
                            max="0.3"
                            step="0.01"
                            value={trainingConfig.label_smoothing_factor}
                            onChange={(e) => handleTrainingConfigChange('label_smoothing_factor', parseFloat(e.target.value) || 0)}
                            onFocus={handleInputFocus}
                            placeholder="0 (recommended)"
                            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                          />
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            Typical range: 0-0.3
                          </p>
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
                            <div className=" items-center justify-between">
                              <label htmlFor="dataloaderWorkers" className="block text-sm font-medium">
                                Dataloader Workers
                              </label>
                              <p className="text-xs text-gray-500 dark:text-gray-400 -mt-1 mb-2">
                              Number of parallel workers for data loading.
                            </p>
                              
                            </div>
                            <input
                              type="number"
                              id="dataloaderWorkers"
                              min="0"
                              max="8"
                              step="1"
                              value={trainingConfig.dataloader_num_workers}
                              onChange={(e) => handleTrainingConfigChange('dataloader_num_workers', parseInt(e.target.value) || 0)}
                              onFocus={handleInputFocus}
                              placeholder="4 (recommended)"
                              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                            />
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              Typical range: 0-8 workers
                            </p>
                          </div>

                        </div>

                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <input
                                type="checkbox"
                                id="pinMemory"
                                checked={trainingConfig.dataloader_pin_memory}
                                onChange={(e) => handleTrainingConfigChange('dataloader_pin_memory', e.target.checked)}
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
                            <p className="text-xs text-gray-500 dark:text-gray-400 -mt-1 mb-2">
                              Number of parallel workers for data loading.
                            </p>
                              
                            
                          </div>
                          
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <input
                                type="checkbox"
                                id="gradientCheckpointing"
                                checked={trainingConfig.gradient_checkpointing}
                                onChange={(e) => handleTrainingConfigChange('gradient_checkpointing', e.target.checked)}
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
                            
                          </div>
                          
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <input
                                type="checkbox"
                                id="fp16"
                                checked={trainingConfig.fp16}
                                onChange={(e) => handleTrainingConfigChange('fp16', e.target.checked)}
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
                         
                          </div>
                          
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <input
                                type="checkbox"
                                id="bf16"
                                checked={trainingConfig.bf16}
                                onChange={(e) => handleTrainingConfigChange('bf16', e.target.checked)}
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
                         
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </div>

                  {/* Custom Parameters */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 pb-2">
                      <div className="flex items-center space-x-2">
                        <Plus className="h-4 w-4" />
                        <div>
                          <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Custom Parameters</h4>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Add custom training parameters not covered above</p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowCustomParams(!showCustomParams)}
                        leftIcon={showCustomParams ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                        className="text-xs"
                      >
                        {showCustomParams ? 'Hide' : 'Show'}
                      </Button>
                    </div>
                    {showCustomParams && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        className="space-y-4"
                      >
                        {customParameters.length === 0 ? (
                          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                            <Plus className="h-8 w-8 mx-auto mb-2 opacity-50" />
                            <p className="text-sm">No custom parameters added yet</p>
                            <p className="text-xs">Click "Add Parameter" to add custom training parameters</p>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {customParameters.map((param) => (
                              <div key={param.id} className="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                                <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3">
                                  <div>
                                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                      Parameter Name
                                    </label>
                                    <input
                                      type="text"
                                      value={param.key}
                                      onChange={(e) => updateCustomParameter(param.id, 'key', e.target.value)}
                                      placeholder="parameter_name"
                                      className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                      Value
                                    </label>
                                    <input
                                      type="text"
                                      value={param.value}
                                      onChange={(e) => {
                                        updateCustomParameter(param.id, 'value', e.target.value);
                                        // Auto-detect type
                                        const detectedType = detectParameterType(e.target.value);
                                        if (detectedType !== param.type) {
                                          updateCustomParameter(param.id, 'type', detectedType);
                                        }
                                      }}
                                      placeholder="value"
                                      className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                      Type
                                    </label>
                                    <select
                                      value={param.type}
                                      onChange={(e) => updateCustomParameter(param.id, 'type', e.target.value)}
                                      className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                    >
                                      <option value="string">String</option>
                                      <option value="number">Number</option>
                                      <option value="boolean">Boolean</option>
                                    </select>
                                  </div>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeCustomParameter(param.id)}
                                  className="p-1 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                        
                        <div className="flex justify-center pt-4">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={addCustomParameter}
                            leftIcon={<Plus className="h-4 w-4" />}
                          >
                            Add Custom Parameter
                          </Button>
                        </div>
                        
                        {customParameters.length > 0 && (
                          <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                            <p className="text-xs text-blue-800 dark:text-blue-200">
                              <strong>Note:</strong> Custom parameters will be passed directly to the training script. 
                              Make sure parameter names and values are valid for your training framework.
                            </p>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </div>
              </div>
            </CardContent>
          </Card>



          {/* Final Review Button */}
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
        
        {/* Sidebar */}
        <div className="space-y-6">
          {/* Configuration Management */}
          <ConfigurationManager
            currentConfig={getCurrentConfig()}
            onLoadConfig={handleLoadConfig}
            currentConfigName={currentConfigName}
          />

          {/* Training Summary */}
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
              </div>
              
              <div className="space-y-1">
                <p className="text-sm font-medium">Dataset</p>
                {isLoadingFileMetadata ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400">Loading data information...</p>
                ) : selectedDatasetMetadata ? (
                  <div className="space-y-1">
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      {selectedDatasetMetadata.name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {datasetService.formatFileSize(selectedDatasetMetadata.file_size)} • {selectedDatasetMetadata.total_examples} examples • Dataset Library
                    </p>
                    <div className="flex items-center space-x-1">
                      <span className="text-xs text-green-600 dark:text-green-400">
                        ✓ Ready for training
                      </span>
                    </div>
                  </div>
                ) : selectedFileMetadata ? (
                  <div className="space-y-1">
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      {selectedFileMetadata.display_name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {fileService.formatFileSize(selectedFileMetadata.file_size)} • {selectedFileMetadata.validation_details.total_rows} rows • {selectedFileMetadata.file_type.toUpperCase()}
                    </p>
                    <div className="flex items-center space-x-1">
                      <span className={`text-xs ${fileService.getValidationStatusColor(selectedFileMetadata.validation_status)}`}>
                        {fileService.getValidationStatusIcon(selectedFileMetadata.validation_status)} {selectedFileMetadata.validation_status}
                      </span>
                    </div>
                  </div>
                ) : selectedFileId ? (
                  <p className="text-sm text-red-600 dark:text-red-400">Failed to load data information</p>
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400">No data selected</p>
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
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">Logging Steps</p>
                    <p className="text-gray-700 dark:text-gray-300">{parameters.loggingSteps}</p>
                  </div>
                </div>
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
          </Card>
        </div>
      </div>

      {/* Navigation */}
      <StepNavigation
        currentStep={3}
        totalSteps={3}
        onPrevious={handlePrevious}
        onComplete={() => setIsReviewModalOpen(true)}
        canProceed={true}
        completeLabel="Review & Start Training"
      />

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
