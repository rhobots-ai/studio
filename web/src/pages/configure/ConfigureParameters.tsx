import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { RotateCcw, Settings, ChevronDown, ChevronUp, AlertCircle, Check, Upload, Download, Plus, X, Copy, FileText, HelpCircle, Edit } from 'lucide-react';
import { createTrainingConfig } from '../../config/training';
import { useConfigureContext } from './ConfigureContext';
import { StepNavigation } from '../../components/ui/StepProgress';
import { ConfigurationManager } from '../../components/ui/ConfigurationManager';
import { ConfigurationReviewModal } from '../../components/ui/ConfigurationReviewModal';
import { JsonEditorModal } from '../../components/ui/JsonEditorModal';
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
  const [showCustomTrainerParams, setShowCustomTrainerParams] = useState(true);
  const [showCustomTrainingParams, setShowCustomTrainingParams] = useState(true);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [currentConfigName, setCurrentConfigName] = useState('Default Settings');
  
  // JSON Editor Modal state
  const [isTrainerJsonModalOpen, setIsTrainerJsonModalOpen] = useState(false);
  const [isTrainingArgsJsonModalOpen, setIsTrainingArgsJsonModalOpen] = useState(false);
  
  // Custom parameters state - separate for trainer and training arguments
  const [customTrainerParameters, setCustomTrainerParameters] = useState<Array<{id: string, key: string, value: string, type: 'string' | 'number' | 'boolean'}>>([]);
  const [customTrainingArguments, setCustomTrainingArguments] = useState<Array<{id: string, key: string, value: string, type: 'string' | 'number' | 'boolean'}>>([]);
  
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

  // JSON Editor Modal handlers
  const handleTrainerJsonApply = (config: any) => {
    // Apply trainer-specific configuration
    if (config.quantization) {
      handleTrainingConfigChange('quantization', config.quantization);
    }
    if (config.max_seq_length || config.maxSequenceLength) {
      handleParameterChange('maxSequenceLength', config.max_seq_length || config.maxSequenceLength);
    }
    if (config.dataloader_num_workers !== undefined) {
      handleTrainingConfigChange('dataloader_num_workers', config.dataloader_num_workers);
    }
    if (config.dataloader_pin_memory !== undefined) {
      handleTrainingConfigChange('dataloader_pin_memory', config.dataloader_pin_memory);
    }
    if (config.gradient_checkpointing !== undefined) {
      handleTrainingConfigChange('gradient_checkpointing', config.gradient_checkpointing);
    }
    if (config.fp16 !== undefined) {
      handleTrainingConfigChange('fp16', config.fp16);
    }
    if (config.bf16 !== undefined) {
      handleTrainingConfigChange('bf16', config.bf16);
    }
    
    // Handle custom trainer parameters
    if (config.custom_trainer_parameters) {
      const loadedCustomTrainerParams = Object.entries(config.custom_trainer_parameters).map(([key, value], index) => ({
        id: `loaded_trainer_${Date.now()}_${index}`,
        key,
        value: String(value),
        type: detectParameterType(String(value))
      }));
      setCustomTrainerParameters(loadedCustomTrainerParams);
    }
    
    toast.success('Trainer configuration applied successfully!');
  };

  const handleTrainingArgsJsonApply = (config: any) => {
    // Apply training arguments configuration
    if (config.epochs || config.num_train_epochs) {
      handleParameterChange('epochs', config.epochs || config.num_train_epochs);
    }
    if (config.learning_rate) {
      handleParameterChange('learningRate', config.learning_rate);
    }
    if (config.per_device_train_batch_size || config.batchSize) {
      handleParameterChange('batchSize', config.per_device_train_batch_size || config.batchSize);
    }
    if (config.logging_steps || config.loggingSteps) {
      handleParameterChange('loggingSteps', config.logging_steps || config.loggingSteps);
    }
    
    // LoRA Configuration
    if (config.lora_r || config.lora_rank) {
      handleTrainingConfigChange('lora_rank', config.lora_r || config.lora_rank);
    }
    if (config.lora_alpha) {
      handleTrainingConfigChange('lora_alpha', config.lora_alpha);
    }
    if (config.lora_dropout) {
      handleTrainingConfigChange('lora_dropout', config.lora_dropout);
    }
    
    // Optimization Parameters
    if (config.warmup_steps) {
      handleTrainingConfigChange('warmup_steps', config.warmup_steps);
    }
    if (config.adam_beta1) {
      handleTrainingConfigChange('adam_beta1', config.adam_beta1);
    }
    if (config.adam_beta2) {
      handleTrainingConfigChange('adam_beta2', config.adam_beta2);
    }
    if (config.max_grad_norm) {
      handleTrainingConfigChange('max_grad_norm', config.max_grad_norm);
    }
    if (config.gradient_accumulation_steps) {
      handleTrainingConfigChange('gradient_accumulation_steps', config.gradient_accumulation_steps);
    }
    
    // Training Stability
    if (config.weight_decay) {
      handleTrainingConfigChange('weight_decay', config.weight_decay);
    }
    if (config.dropout_rate) {
      handleTrainingConfigChange('dropout_rate', config.dropout_rate);
    }
    if (config.attention_dropout) {
      handleTrainingConfigChange('attention_dropout', config.attention_dropout);
    }
    if (config.label_smoothing_factor) {
      handleTrainingConfigChange('label_smoothing_factor', config.label_smoothing_factor);
    }
    
    // Handle custom training arguments
    if (config.custom_training_arguments) {
      const loadedCustomTrainingArgs = Object.entries(config.custom_training_arguments).map(([key, value], index) => ({
        id: `loaded_training_${Date.now()}_${index}`,
        key,
        value: String(value),
        type: detectParameterType(String(value))
      }));
      setCustomTrainingArguments(loadedCustomTrainingArgs);
    }
    
    toast.success('Training arguments configuration applied successfully!');
  };

  // Get trainer-specific configuration
  const getTrainerConfig = () => {
    return {
      quantization: trainingConfig.quantization,
      maxSequenceLength: parameters.maxSequenceLength,
      dataloader_num_workers: trainingConfig.dataloader_num_workers,
      dataloader_pin_memory: trainingConfig.dataloader_pin_memory,
      gradient_checkpointing: trainingConfig.gradient_checkpointing,
      fp16: trainingConfig.fp16,
      bf16: trainingConfig.bf16,
      custom_trainer_parameters: customTrainerParameters.reduce((acc: Record<string, any>, param) => {
        let value: any = param.value;
        if (param.type === 'number') {
          value = parseFloat(param.value);
        } else if (param.type === 'boolean') {
          value = param.value === 'true';
        }
        acc[param.key] = value;
        return acc;
      }, {} as Record<string, any>)
    };
  };

  // Get training arguments configuration
  const getTrainingArgsConfig = () => {
    return {
      epochs: parameters.epochs,
      learning_rate: parameters.learningRate,
      per_device_train_batch_size: parameters.batchSize,
      logging_steps: parameters.loggingSteps,
      lora_rank: trainingConfig.lora_rank,
      lora_alpha: trainingConfig.lora_alpha,
      lora_dropout: trainingConfig.lora_dropout,
      warmup_steps: trainingConfig.warmup_steps,
      adam_beta1: trainingConfig.adam_beta1,
      adam_beta2: trainingConfig.adam_beta2,
      max_grad_norm: trainingConfig.max_grad_norm,
      gradient_accumulation_steps: trainingConfig.gradient_accumulation_steps,
      weight_decay: trainingConfig.weight_decay,
      dropout_rate: trainingConfig.dropout_rate,
      attention_dropout: trainingConfig.attention_dropout,
      label_smoothing_factor: trainingConfig.label_smoothing_factor,
      custom_training_arguments: customTrainingArguments.reduce((acc: Record<string, any>, param) => {
        let value: any = param.value;
        if (param.type === 'number') {
          value = parseFloat(param.value);
        } else if (param.type === 'boolean') {
          value = param.value === 'true';
        }
        acc[param.key] = value;
        return acc;
      }, {} as Record<string, any>)
    };
  };

  // Custom trainer parameters functions
  const addCustomTrainerParameter = () => {
    const newParam = {
      id: Date.now().toString(),
      key: '',
      value: '',
      type: 'string' as const
    };
    setCustomTrainerParameters([...customTrainerParameters, newParam]);
  };

  const updateCustomTrainerParameter = (id: string, field: 'key' | 'value' | 'type', value: string) => {
    setCustomTrainerParameters((params: any[]) => 
      params.map((param: any) => 
        param.id === id ? { ...param, [field]: value } : param
      )
    );
  };

  const removeCustomTrainerParameter = (id: string) => {
    setCustomTrainerParameters((params: any[]) => params.filter((param: any) => param.id !== id));
  };

  // Custom training arguments functions
  const addCustomTrainingArgument = () => {
    const newParam = {
      id: Date.now().toString(),
      key: '',
      value: '',
      type: 'string' as const
    };
    setCustomTrainingArguments([...customTrainingArguments, newParam]);
  };

  const updateCustomTrainingArgument = (id: string, field: 'key' | 'value' | 'type', value: string) => {
    setCustomTrainingArguments((params: any[]) => 
      params.map((param: any) => 
        param.id === id ? { ...param, [field]: value } : param
      )
    );
  };

  const removeCustomTrainingArgument = (id: string) => {
    setCustomTrainingArguments((params: any[]) => params.filter((param: any) => param.id !== id));
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

    // Load custom parameters if they exist
    if (config.custom_trainer_parameters) {
      const loadedCustomTrainerParams = Object.entries(config.custom_trainer_parameters).map(([key, value], index) => ({
        id: `loaded_trainer_${Date.now()}_${index}`,
        key,
        value: String(value),
        type: detectParameterType(String(value))
      }));
      setCustomTrainerParameters(loadedCustomTrainerParams);
    }

    if (config.custom_training_arguments) {
      const loadedCustomTrainingArgs = Object.entries(config.custom_training_arguments).map(([key, value], index) => ({
        id: `loaded_training_${Date.now()}_${index}`,
        key,
        value: String(value),
        type: detectParameterType(String(value))
      }));
      setCustomTrainingArguments(loadedCustomTrainingArgs);
    }

    // Legacy support for old custom_parameters format
    if (config.custom_parameters) {
      const loadedCustomParams = Object.entries(config.custom_parameters).map(([key, value], index) => ({
        id: `loaded_legacy_${Date.now()}_${index}`,
        key,
        value: String(value),
        type: detectParameterType(String(value))
      }));
      setCustomTrainerParameters(loadedCustomParams);
    }

    setCurrentConfigName(config.metadata?.name || 'Loaded Configuration');
  };

  // Get current configuration for saving
  const getCurrentConfig = () => {
    return {
      basic_parameters: parameters,
      advanced_parameters: trainingConfig,
      custom_trainer_parameters: customTrainerParameters.reduce((acc: Record<string, any>, param) => {
        let value: any = param.value;
        if (param.type === 'number') {
          value = parseFloat(param.value);
        } else if (param.type === 'boolean') {
          value = param.value === 'true';
        }
        acc[param.key] = value;
        return acc;
      }, {} as Record<string, any>),
      custom_training_arguments: customTrainingArguments.reduce((acc: Record<string, any>, param) => {
        let value: any = param.value;
        if (param.type === 'number') {
          value = parseFloat(param.value);
        } else if (param.type === 'boolean') {
          value = param.value === 'true';
        }
        acc[param.key] = value;
        return acc;
      }, {} as Record<string, any>)
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
    
    // Process custom parameters - combine both trainer and training arguments
    const processedCustomParams = [...customTrainerParameters, ...customTrainingArguments].reduce((acc: Record<string, any>, param) => {
      if (param.key && param.value) {
        let value: any = param.value;
        if (param.type === 'number') {
          value = parseFloat(param.value);
        } else if (param.type === 'boolean') {
          value = param.value === 'true';
        }
        acc[param.key] = value;
      }
      return acc;
    }, {} as Record<string, any>);

    // Prepare the structured request payload for the enhanced API
    const payload = {
      trainer_config: {
        model_name: modelIdentifier,
        push_to_hub: trainingConfig.push_to_hub,
        hub_model_id: trainingConfig.hub_model_id,
        quantization: trainingConfig.quantization,
        max_seq_length: parameters.maxSequenceLength,
        dataloader_num_workers: trainingConfig.dataloader_num_workers,
        dataloader_pin_memory: trainingConfig.dataloader_pin_memory,
        gradient_checkpointing: trainingConfig.gradient_checkpointing,
        fp16: trainingConfig.fp16,
        bf16: trainingConfig.bf16,
        custom_trainer_parameters: customTrainerParameters.reduce((acc: Record<string, any>, param) => {
          if (param.key && param.value) {
            let value: any = param.value;
            if (param.type === 'number') {
              value = parseFloat(param.value);
            } else if (param.type === 'boolean') {
              value = param.value === 'true';
            }
            acc[param.key] = value;
          }
          return acc;
        }, {} as Record<string, any>)
      },
      training_args_config: {
        num_train_epochs: parameters.epochs,
        learning_rate: parameters.learningRate,
        per_device_train_batch_size: parameters.batchSize,
        logging_steps: parameters.loggingSteps,
        lora_r: trainingConfig.lora_rank,
        lora_alpha: trainingConfig.lora_alpha,
        lora_dropout: trainingConfig.lora_dropout,
        lr_scheduler_type: trainingConfig.lr_scheduler_type,
        warmup_steps: trainingConfig.warmup_steps,
        adam_beta1: trainingConfig.adam_beta1,
        adam_beta2: trainingConfig.adam_beta2,
        adam_epsilon: trainingConfig.adam_epsilon,
        max_grad_norm: trainingConfig.max_grad_norm,
        gradient_accumulation_steps: trainingConfig.gradient_accumulation_steps,
        weight_decay: trainingConfig.weight_decay,
        dropout_rate: trainingConfig.dropout_rate,
        attention_dropout: trainingConfig.attention_dropout,
        label_smoothing_factor: trainingConfig.label_smoothing_factor,
        save_steps: trainingConfig.save_steps,
        seed: trainingConfig.seed,
        remove_unused_columns: trainingConfig.remove_unused_columns,
        report_to: trainingConfig.report_to,
        output_dir: `./results/${parameters.modelName}`,
        custom_training_arguments: customTrainingArguments.reduce((acc: Record<string, any>, param) => {
          if (param.key && param.value) {
            let value: any = param.value;
            if (param.type === 'number') {
              value = parseFloat(param.value);
            } else if (param.type === 'boolean') {
              value = param.value === 'true';
            }
            acc[param.key] = value;
          }
          return acc;
        }, {} as Record<string, any>)
      }
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


          {/* Model Name and Description */}
          <Card>
            <CardHeader>
              <CardTitle>Model Name and Description</CardTitle>
              <CardDescription>
                Set how your fine-tuned model will be identified
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="modelName" className="block text-sm font-medium">
                  Model Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="modelName"
                  value={parameters.modelName}
                  onChange={(e) => handleParameterChange('modelName', e.target.value)}
                  placeholder="Enter a name for your fine-tuned model"
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
                {!parameters.modelName && (
                  <p className="text-red-500 text-xs">Model name is required</p>
                )}
              </div>

              {/* Push to Hugging Face Hub */}
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
                <div className="space-y-2 ml-7">
                  <label htmlFor="hubModelId" className="block text-sm font-medium">
                    Repository ID
                  </label>
                  <input
                    type="text"
                    id="hubModelId"
                    value={trainingConfig.hub_model_id}
                    onChange={(e) => handleTrainingConfigChange('hub_model_id', e.target.value)}
                    placeholder="username/repository-name"
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    <p><strong>Format:</strong> username/repository-name</p>
                    <p><strong>Example:</strong> myusername/my-fine-tuned-model</p>
                  </div>
                  {trainingConfig.hub_model_id && !validateHubModelId(trainingConfig.hub_model_id).isValid && (
                    <p className="text-red-500 text-xs">
                      {validateHubModelId(trainingConfig.hub_model_id).error}
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Trainer Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Trainer</span>
                <div className="flex items-center space-x-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    leftIcon={<Edit className="h-4 w-4" />}
                    onClick={() => setIsTrainerJsonModalOpen(true)}
                    className="text-blue-600 border-blue-300 hover:bg-blue-50 hover:border-blue-400 dark:text-blue-400 dark:border-blue-600 dark:hover:bg-blue-900/20 dark:hover:border-blue-500"
                  >
                    Open in Editor
                  </Button>
                  {/* <Button 
                    variant="ghost" 
                    size="sm"
                    leftIcon={<RotateCcw className="h-4 w-4" />}
                    onClick={resetToDefaults}
                  >
                    Reset to defaults
                  </Button> */}
                </div>
              </CardTitle>
              <CardDescription>
                Configure trainer infrastructure, model setup, and system-level settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
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
                    <div className="space-y-2">
                      <label htmlFor="quantization" className="block text-sm font-medium">
                        Quantization Method
                      </label>
                      <p className="text-xs text-gray-500 dark:text-gray-400 -mt-1 mb-2">
                        Quantization reduces memory usage by using lower precision weights. Choose based on your hardware constraints and accuracy requirements.
                      </p>
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
                        <label htmlFor="dataloaderWorkers" className="block text-sm font-medium">
                          Dataloader Workers
                        </label>
                        <p className="text-xs text-gray-500 dark:text-gray-400 -mt-1 mb-2">
                          Number of parallel workers for data loading.
                        </p>
                        <input
                          type="number"
                          id="dataloaderWorkers"
                          min="0"
                          max="8"
                          step="1"
                          value={displayValues.dataloaderWorkers}
                          onChange={(e) => handleTrainingConfigNumberChange('dataloader_num_workers', 'dataloaderWorkers', e.target.value, 0, 8, true)}
                          onBlur={(e) => handleTrainingConfigInputBlur('dataloader_num_workers', 'dataloaderWorkers', e.target.value, 0, 8, 4, true)}
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

              {/* Custom Trainer Parameters */}
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 pb-2">
                  <div className="flex items-center space-x-2">
                    <Plus className="h-4 w-4" />
                    <div>
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Custom Trainer Parameters</h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Add custom trainer-specific parameters</p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowCustomTrainerParams(!showCustomTrainerParams)}
                    leftIcon={showCustomTrainerParams ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    className="text-xs"
                  >
                    {showCustomTrainerParams ? 'Hide' : 'Show'}
                  </Button>
                </div>
                {showCustomTrainerParams && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-4"
                  >
                    {customTrainerParameters.length === 0 ? (
                      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                        <Plus className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No custom trainer parameters added yet</p>
                        <p className="text-xs">Click "Add Parameter" to add custom trainer parameters</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {customTrainerParameters.map((param) => (
                          <div key={param.id} className="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                            <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3">
                              <div>
                                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                  Parameter Name
                                </label>
                                <input
                                  type="text"
                                  value={param.key}
                                  onChange={(e) => updateCustomTrainerParameter(param.id, 'key', e.target.value)}
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
                                    updateCustomTrainerParameter(param.id, 'value', e.target.value);
                                    const detectedType = detectParameterType(e.target.value);
                                    if (detectedType !== param.type) {
                                      updateCustomTrainerParameter(param.id, 'type', detectedType);
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
                                  onChange={(e) => updateCustomTrainerParameter(param.id, 'type', e.target.value)}
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
                              onClick={() => removeCustomTrainerParameter(param.id)}
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
                        onClick={addCustomTrainerParameter}
                        leftIcon={<Plus className="h-4 w-4" />}
                      >
                        Add Custom Trainer Parameter
                      </Button>
                    </div>
                    
                    {customTrainerParameters.length > 0 && (
                      <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                        <p className="text-xs text-blue-800 dark:text-blue-200">
                          <strong>Note:</strong> Custom trainer parameters will be passed to the trainer configuration. 
                          Make sure parameter names and values are valid for your training framework.
                        </p>
                      </div>
                    )}
                  </motion.div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Training Arguments Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Training Arguments</span>
                <Button 
                  variant="outline" 
                  size="sm"
                  leftIcon={<Edit className="h-4 w-4" />}
                  onClick={() => setIsTrainingArgsJsonModalOpen(true)}
                  className="text-blue-600 border-blue-300 hover:bg-blue-50 hover:border-blue-400 dark:text-blue-400 dark:border-blue-600 dark:hover:bg-blue-900/20 dark:hover:border-blue-500"
                >
                  Open in Editor
                </Button>
              </CardTitle>
              <CardDescription>
                Configure hyperparameters and training process settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Basic Parameters */}
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
                  
                  {/* Logging Steps */}
                  <div className="space-y-2">
                    <label htmlFor="loggingSteps" className="block text-sm font-medium">
                      Logging Steps
                    </label>
                    <p className="text-xs text-gray-500 dark:text-gray-400 -mt-1 mb-2">
                      How often to log training metrics
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
                </div>
              </div>

              {/* LoRA Configuration */}
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 pb-2">
                  <div>
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">LoRA Configuration</h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Configure Low-Rank Adaptation parameters for efficient fine-tuning</p>
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
                      <label htmlFor="loraRank" className="block text-sm font-medium">
                        LoRA Rank (r)
                      </label>
                      <p className="text-xs text-gray-500 dark:text-gray-400 -mt-1 mb-2">
                        Rank of the low-rank adaptation. Higher values = more parameters but better adaptation.
                      </p>
                      <input
                        type="number"
                        id="loraRank"
                        min="1"
                        max="256"
                        step="1"
                        value={displayValues.loraRank}
                        onChange={(e) => handleTrainingConfigNumberChange('lora_rank', 'loraRank', e.target.value, 1, 256, true)}
                        onBlur={(e) => handleTrainingConfigInputBlur('lora_rank', 'loraRank', e.target.value, 1, 256, 16, true)}
                        onFocus={handleInputFocus}
                        placeholder="16 (recommended)"
                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Typical range: 1-256
                      </p>
                    </div>

                    <div className="space-y-2">
                      <label htmlFor="loraAlpha" className="block text-sm font-medium">
                        LoRA Alpha
                      </label>
                      <p className="text-xs text-gray-500 dark:text-gray-400 -mt-1 mb-2">
                        Scaling parameter for LoRA. Usually set to rank or 2*rank.
                      </p>
                      <input
                        type="number"
                        id="loraAlpha"
                        min="1"
                        max="512"
                        step="1"
                        value={displayValues.loraAlpha}
                        onChange={(e) => handleTrainingConfigNumberChange('lora_alpha', 'loraAlpha', e.target.value, 1, 512, true)}
                        onBlur={(e) => handleTrainingConfigInputBlur('lora_alpha', 'loraAlpha', e.target.value, 1, 512, 32, true)}
                        onFocus={handleInputFocus}
                        placeholder="32 (recommended)"
                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Typical range: 1-512
                      </p>
                    </div>

                    <div className="space-y-2">
                      <label htmlFor="loraDropout" className="block text-sm font-medium">
                        LoRA Dropout
                      </label>
                      <p className="text-xs text-gray-500 dark:text-gray-400 -mt-1 mb-2">
                        Dropout rate for LoRA layers to prevent overfitting.
                      </p>
                      <input
                        type="number"
                        id="loraDropout"
                        min="0"
                        max="0.5"
                        step="0.01"
                        value={displayValues.loraDropout}
                        onChange={(e) => handleTrainingConfigNumberChange('lora_dropout', 'loraDropout', e.target.value, 0, 0.5, false)}
                        onBlur={(e) => handleTrainingConfigInputBlur('lora_dropout', 'loraDropout', e.target.value, 0, 0.5, 0.1, false)}
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
                      <label htmlFor="warmupSteps" className="block text-sm font-medium">
                        Warmup Steps
                      </label>
                      <p className="text-xs text-gray-500 dark:text-gray-400 -mt-1 mb-2">
                        Number of steps to gradually increase learning rate from 0.
                      </p>
                      <input
                        type="number"
                        id="warmupSteps"
                        min="0"
                        max="1000"
                        step="10"
                        value={displayValues.warmupSteps}
                        onChange={(e) => handleTrainingConfigNumberChange('warmup_steps', 'warmupSteps', e.target.value, 0, 1000, true)}
                        onBlur={(e) => handleTrainingConfigInputBlur('warmup_steps', 'warmupSteps', e.target.value, 0, 1000, 100, true)}
                        onFocus={handleInputFocus}
                        placeholder="100 (recommended)"
                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Typical range: 0-1000 steps
                      </p>
                    </div>

                    <div className="space-y-2">
                      <label htmlFor="adamBeta1" className="block text-sm font-medium">
                        Adam Beta1
                      </label>
                      <p className="text-xs text-gray-500 dark:text-gray-400 -mt-1 mb-2">
                        Exponential decay rate for first moment estimates.
                      </p>
                      <input
                        type="number"
                        id="adamBeta1"
                        min="0.8"
                        max="0.999"
                        step="0.001"
                        value={displayValues.adamBeta1}
                        onChange={(e) => handleTrainingConfigNumberChange('adam_beta1', 'adamBeta1', e.target.value, 0.8, 0.999, false)}
                        onBlur={(e) => handleTrainingConfigInputBlur('adam_beta1', 'adamBeta1', e.target.value, 0.8, 0.999, 0.9, false)}
                        onFocus={handleInputFocus}
                        placeholder="0.9 (recommended)"
                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Typical range: 0.8-0.999
                      </p>
                    </div>

                    <div className="space-y-2">
                      <label htmlFor="adamBeta2" className="block text-sm font-medium">
                        Adam Beta2
                      </label>
                      <p className="text-xs text-gray-500 dark:text-gray-400 -mt-1 mb-2">
                        Exponential decay rate for second moment estimates.
                      </p>
                      <input
                        type="number"
                        id="adamBeta2"
                        min="0.9"
                        max="0.9999"
                        step="0.0001"
                        value={displayValues.adamBeta2}
                        onChange={(e) => handleTrainingConfigNumberChange('adam_beta2', 'adamBeta2', e.target.value, 0.9, 0.9999, false)}
                        onBlur={(e) => handleTrainingConfigInputBlur('adam_beta2', 'adamBeta2', e.target.value, 0.9, 0.9999, 0.999, false)}
                        onFocus={handleInputFocus}
                        placeholder="0.999 (recommended)"
                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Typical range: 0.9-0.9999
                      </p>
                    </div>

                    <div className="space-y-2">
                      <label htmlFor="maxGradNorm" className="block text-sm font-medium">
                        Max Gradient Norm
                      </label>
                      <p className="text-xs text-gray-500 dark:text-gray-400 -mt-1 mb-2">
                        Maximum norm for gradient clipping to prevent exploding gradients.
                      </p>
                      <input
                        type="number"
                        id="maxGradNorm"
                        min="0.1"
                        max="10"
                        step="0.1"
                        value={displayValues.maxGradNorm}
                        onChange={(e) => handleTrainingConfigNumberChange('max_grad_norm', 'maxGradNorm', e.target.value, 0.1, 10, false)}
                        onBlur={(e) => handleTrainingConfigInputBlur('max_grad_norm', 'maxGradNorm', e.target.value, 0.1, 10, 1.0, false)}
                        onFocus={handleInputFocus}
                        placeholder="1.0 (recommended)"
                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Typical range: 0.1-10
                      </p>
                    </div>

                    <div className="space-y-2">
                      <label htmlFor="gradAccumSteps" className="block text-sm font-medium">
                        Gradient Accumulation Steps
                      </label>
                      <p className="text-xs text-gray-500 dark:text-gray-400 -mt-1 mb-2">
                        Number of steps to accumulate gradients before updating model weights.
                      </p>
                      <input
                        type="number"
                        id="gradAccumSteps"
                        min="1"
                        max="32"
                        step="1"
                        value={displayValues.gradAccumSteps}
                        onChange={(e) => handleTrainingConfigNumberChange('gradient_accumulation_steps', 'gradAccumSteps', e.target.value, 1, 32, true)}
                        onBlur={(e) => handleTrainingConfigInputBlur('gradient_accumulation_steps', 'gradAccumSteps', e.target.value, 1, 32, 1, true)}
                        onFocus={handleInputFocus}
                        placeholder="1 (recommended)"
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
                      <label htmlFor="weightDecay" className="block text-sm font-medium">
                        Weight Decay
                      </label>
                      <p className="text-xs text-gray-500 dark:text-gray-400 -mt-1 mb-2">
                        L2 regularization parameter to prevent overfitting.
                      </p>
                      <input
                        type="number"
                        id="weightDecay"
                        min="0"
                        max="0.1"
                        step="0.001"
                        value={displayValues.weightDecay}
                        onChange={(e) => handleTrainingConfigNumberChange('weight_decay', 'weightDecay', e.target.value, 0, 0.1, false)}
                        onBlur={(e) => handleTrainingConfigInputBlur('weight_decay', 'weightDecay', e.target.value, 0, 0.1, 0.01, false)}
                        onFocus={handleInputFocus}
                        placeholder="0.01 (recommended)"
                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Typical range: 0-0.1
                      </p>
                    </div>

                    <div className="space-y-2">
                      <label htmlFor="dropoutRate" className="block text-sm font-medium">
                        Dropout Rate
                      </label>
                      <p className="text-xs text-gray-500 dark:text-gray-400 -mt-1 mb-2">
                        Probability of randomly setting input units to 0 during training.
                      </p>
                      <input
                        type="number"
                        id="dropoutRate"
                        min="0"
                        max="0.5"
                        step="0.01"
                        value={displayValues.dropoutRate}
                        onChange={(e) => handleTrainingConfigNumberChange('dropout_rate', 'dropoutRate', e.target.value, 0, 0.5, false)}
                        onBlur={(e) => handleTrainingConfigInputBlur('dropout_rate', 'dropoutRate', e.target.value, 0, 0.5, 0.1, false)}
                        onFocus={handleInputFocus}
                        placeholder="0.1 (recommended)"
                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Typical range: 0-0.5
                      </p>
                    </div>

                    <div className="space-y-2">
                      <label htmlFor="attentionDropout" className="block text-sm font-medium">
                        Attention Dropout
                      </label>
                      <p className="text-xs text-gray-500 dark:text-gray-400 -mt-1 mb-2">
                        Dropout rate specifically applied to attention layers.
                      </p>
                      <input
                        type="number"
                        id="attentionDropout"
                        min="0"
                        max="0.5"
                        step="0.01"
                        value={displayValues.attentionDropout}
                        onChange={(e) => handleTrainingConfigNumberChange('attention_dropout', 'attentionDropout', e.target.value, 0, 0.5, false)}
                        onBlur={(e) => handleTrainingConfigInputBlur('attention_dropout', 'attentionDropout', e.target.value, 0, 0.5, 0.1, false)}
                        onFocus={handleInputFocus}
                        placeholder="0.1 (recommended)"
                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Typical range: 0-0.5
                      </p>
                    </div>

                    <div className="space-y-2">
                      <label htmlFor="labelSmoothing" className="block text-sm font-medium">
                        Label Smoothing
                      </label>
                      <p className="text-xs text-gray-500 dark:text-gray-400 -mt-1 mb-2">
                        Smooths target labels to prevent overconfident predictions.
                      </p>
                      <input
                        type="number"
                        id="labelSmoothing"
                        min="0"
                        max="0.3"
                        step="0.01"
                        value={displayValues.labelSmoothing}
                        onChange={(e) => handleTrainingConfigNumberChange('label_smoothing_factor', 'labelSmoothing', e.target.value, 0, 0.3, false)}
                        onBlur={(e) => handleTrainingConfigInputBlur('label_smoothing_factor', 'labelSmoothing', e.target.value, 0, 0.3, 0, false)}
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

              {/* Custom Training Arguments */}
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 pb-2">
                  <div className="flex items-center space-x-2">
                    <Plus className="h-4 w-4" />
                    <div>
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Custom Training Arguments</h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Add custom training argument parameters</p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowCustomTrainingParams(!showCustomTrainingParams)}
                    leftIcon={showCustomTrainingParams ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    className="text-xs"
                  >
                    {showCustomTrainingParams ? 'Hide' : 'Show'}
                  </Button>
                </div>
                {showCustomTrainingParams && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-4"
                  >
                    {customTrainingArguments.length === 0 ? (
                      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                        <Plus className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No custom training arguments added yet</p>
                        <p className="text-xs">Click "Add Parameter" to add custom training arguments</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {customTrainingArguments.map((param) => (
                          <div key={param.id} className="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                            <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3">
                              <div>
                                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                  Parameter Name
                                </label>
                                <input
                                  type="text"
                                  value={param.key}
                                  onChange={(e) => updateCustomTrainingArgument(param.id, 'key', e.target.value)}
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
                                    updateCustomTrainingArgument(param.id, 'value', e.target.value);
                                    const detectedType = detectParameterType(e.target.value);
                                    if (detectedType !== param.type) {
                                      updateCustomTrainingArgument(param.id, 'type', detectedType);
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
                                  onChange={(e) => updateCustomTrainingArgument(param.id, 'type', e.target.value)}
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
                              onClick={() => removeCustomTrainingArgument(param.id)}
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
                        onClick={addCustomTrainingArgument}
                        leftIcon={<Plus className="h-4 w-4" />}
                      >
                        Add Custom Training Argument
                      </Button>
                    </div>
                    
                    {customTrainingArguments.length > 0 && (
                      <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                        <p className="text-xs text-blue-800 dark:text-blue-200">
                          <strong>Note:</strong> Custom training arguments will be passed to the training process. 
                          Make sure parameter names and values are valid for your training framework.
                        </p>
                      </div>
                    )}
                  </motion.div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Sidebar */}
        <div className="space-y-6">
          {/* Configuration Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Settings className="h-5 w-5" />
                <span>Configuration Summary</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Model:</span>
                  <span className="font-medium">{selectedBaseModel?.name || 'Not selected'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Epochs:</span>
                  <span className="font-medium">{parameters.epochs}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Learning Rate:</span>
                  <span className="font-medium">{parameters.learningRate}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Batch Size:</span>
                  <span className="font-medium">{parameters.batchSize}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Max Sequence:</span>
                  <span className="font-medium">{parameters.maxSequenceLength}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Quantization:</span>
                  <span className="font-medium capitalize">{trainingConfig.quantization}</span>
                </div>
              </div>

              <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Est. Time:</span>
                  <span className="font-medium">{estimatedTime()} min</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Est. Cost:</span>
                  <span className="font-medium">${estimatedCost()}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Data Information */}
          {(selectedFileMetadata || selectedDatasetMetadata) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <FileText className="h-5 w-5" />
                  <span>Training Data</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {selectedFileMetadata && (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">File:</span>
                      <span className="font-medium text-right max-w-32 truncate" title={selectedFileMetadata.original_filename}>
                        {selectedFileMetadata.original_filename}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">Rows:</span>
                      <span className="font-medium">{selectedFileMetadata.validation_details.total_rows.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">Size:</span>
                      <span className="font-medium">{(selectedFileMetadata.file_size / 1024 / 1024).toFixed(2)} MB</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">Status:</span>
                      <span className={`font-medium ${selectedFileMetadata.validation_status === 'valid' ? 'text-green-600' : 'text-red-600'}`}>
                        {selectedFileMetadata.validation_status === 'valid' ? 'Valid' : 'Invalid'}
                      </span>
                    </div>
                  </>
                )}
                {selectedDatasetMetadata && (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">Dataset:</span>
                      <span className="font-medium text-right max-w-32 truncate" title={selectedDatasetMetadata.name}>
                        {selectedDatasetMetadata.name}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">Rows:</span>
                      <span className="font-medium">N/A</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">Size:</span>
                      <span className="font-medium">{(selectedDatasetMetadata.file_size / 1024 / 1024).toFixed(2)} MB</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">Status:</span>
                      <span className="font-medium text-green-600">Ready</span>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {/* Configuration Manager - Temporarily disabled due to prop mismatch */}
          {/* <ConfigurationManager
            currentConfig={getCurrentConfig()}
            onLoadConfig={handleLoadConfig}
            currentConfigName={currentConfigName}
            onConfigNameChange={setCurrentConfigName}
          /> */}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-between pt-6">
        <Button
          variant="outline"
          onClick={handlePrevious}
        >
          Previous
        </Button>
        <div className="flex space-x-3">
          <Button
            variant="outline"
            onClick={() => setIsReviewModalOpen(true)}
          >
            Review Configuration
          </Button>
          <Button
            onClick={handleStartFineTuning}
            disabled={!parameters.modelName || !selectedBaseModel || !selectedFileId}
          >
            Start Fine-Tuning
          </Button>
        </div>
      </div>

      {/* JSON Editor Modals */}
      <JsonEditorModal
        isOpen={isTrainerJsonModalOpen}
        onClose={() => setIsTrainerJsonModalOpen(false)}
        title="Trainer Configuration Editor"
        description="Edit trainer-specific parameters in JSON format"
        currentConfig={getTrainerConfig()}
        onApply={handleTrainerJsonApply}
        placeholder="Paste your trainer configuration JSON here..."
      />

      <JsonEditorModal
        isOpen={isTrainingArgsJsonModalOpen}
        onClose={() => setIsTrainingArgsJsonModalOpen(false)}
        title="Training Arguments Configuration Editor"
        description="Edit training arguments parameters in JSON format"
        currentConfig={getTrainingArgsConfig()}
        onApply={handleTrainingArgsJsonApply}
        placeholder="Paste your training arguments configuration JSON here..."
      />

      {/* Configuration Review Modal */}
      <ConfigurationReviewModal
        isOpen={isReviewModalOpen}
        onClose={() => setIsReviewModalOpen(false)}
        configuration={{
          selectedBaseModel,
          files,
          validationStatus: selectedFileMetadata?.validation_status || 'unknown',
          parameters,
          trainingConfig,
          estimatedTime: estimatedTime(),
          estimatedCost: estimatedCost()
        }}
        onStartTraining={handleStartFineTuning}
      />
    </div>
  );
}
