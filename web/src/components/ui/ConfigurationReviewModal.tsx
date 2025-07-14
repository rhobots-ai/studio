import { useState, useEffect } from 'react';
import { Button } from './Button';
import { SaveConfigModal } from './SaveConfigModal';
import { configService } from '../../services/configService';
import { X, Check, AlertTriangle, ChevronDown, ChevronUp, Settings, Database, Zap, Clock, DollarSign } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Badge } from './Badge';
import { fileService, FileMetadata } from '../../services/fileService';
import { datasetService, ProcessedDataset } from '../../services/datasetService';
import { useConfigureContext } from '../../pages/configure/ConfigureContext';

interface ConfigurationReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartTraining: () => void;
  configuration: {
    selectedBaseModel: any;
    files: any[];
    validationStatus: string;
    parameters: any;
    trainingConfig: any;
    estimatedTime: number;
    estimatedCost: string;
  };
}

export function ConfigurationReviewModal({ 
  isOpen, 
  onClose, 
  onStartTraining, 
  configuration 
}: ConfigurationReviewModalProps) {
  const { state } = useConfigureContext();
  const { selectedFileId } = state;
  
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  
  // Selected file/dataset metadata state
  const [selectedFileMetadata, setSelectedFileMetadata] = useState<FileMetadata | null>(null);
  const [selectedDatasetMetadata, setSelectedDatasetMetadata] = useState<ProcessedDataset | null>(null);
  const [isLoadingFileMetadata, setIsLoadingFileMetadata] = useState(false);
  const [isDatasetSelected, setIsDatasetSelected] = useState(false);
  
  // Expandable sections state
  const [expandedSections, setExpandedSections] = useState({
    lora: true,
    optimization: false,
    stability: false,
    memory: false,
    monitoring: false
  });

  // Load selected file/dataset metadata when modal opens or selectedFileId changes
  useEffect(() => {
    const loadSelectedMetadata = async () => {
      if (isOpen && selectedFileId) {
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
  }, [isOpen, selectedFileId]);

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const handleSaveConfig = async (name: string, description: string) => {
    try {
      setIsSaving(true);
      setSaveError(null);
      
      await configService.saveConfiguration({
        name,
        description,
        basic_parameters: configuration.parameters,
        advanced_parameters: configuration.trainingConfig,
      });

      setSaveSuccess(`Configuration "${name}" saved successfully!`);
      setIsSaveModalOpen(false);
      
      // Clear success message after 3 seconds
      setTimeout(() => setSaveSuccess(null), 3000);
    } catch (err: any) {
      setSaveError(err.message || 'Failed to save configuration');
    } finally {
      setIsSaving(false);
    }
  };

  const getValidationIcon = () => {
    if (configuration.validationStatus === 'valid') {
      return <Check className="h-4 w-4 text-green-500" />;
    } else if (configuration.validationStatus === 'invalid') {
      return <AlertTriangle className="h-4 w-4 text-red-500" />;
    }
    return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
  };

  const getValidationText = () => {
    if (configuration.validationStatus === 'valid') {
      return 'Validated';
    } else if (configuration.validationStatus === 'invalid') {
      return 'Validation Issues';
    }
    return 'Not Validated';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black bg-opacity-50"
        onClick={onClose}
      />
      
      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              Review Training Configuration
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Please review all settings before starting fine-tuning
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="p-1"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Success Message */}
        <AnimatePresence>
          {saveSuccess && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mx-6 mt-4 p-3 bg-green-100 dark:bg-green-900 border border-green-200 dark:border-green-700 rounded-md text-sm text-green-800 dark:text-green-200"
            >
              {saveSuccess}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error Message */}
        <AnimatePresence>
          {saveError && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mx-6 mt-4 p-3 bg-red-100 dark:bg-red-900 border border-red-200 dark:border-red-700 rounded-md text-sm text-red-800 dark:text-red-200"
            >
              {saveError}
              <button
                onClick={() => setSaveError(null)}
                className="ml-2 text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200"
              >
                ×
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          <div className="space-y-6">
            {/* Base Model Section */}
            <div className="flex items-start space-x-3 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <Check className="h-5 w-5 text-green-500 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-medium text-gray-900 dark:text-gray-100">Base Model</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {configuration.selectedBaseModel ? configuration.selectedBaseModel.name : 'No model selected'}
                </p>
                {configuration.selectedBaseModel && (
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="outline" size="sm">{configuration.selectedBaseModel.size}</Badge>
                    <Badge variant="outline" size="sm">{configuration.selectedBaseModel.architecture}</Badge>
                    {configuration.selectedBaseModel.family && (
                      <Badge variant="outline" size="sm">{configuration.selectedBaseModel.family}</Badge>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Training Data Section */}
            <div className="flex items-start space-x-3 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              {selectedDatasetMetadata || selectedFileMetadata ? <Check className="h-4 w-4 text-green-500 mt-0.5" /> : getValidationIcon()}
              <div className="flex-1">
                <h3 className="font-medium text-gray-900 dark:text-gray-100">Training Data</h3>
                {isLoadingFileMetadata ? (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Loading data information...</p>
                ) : selectedDatasetMetadata ? (
                  <div className="mt-1">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {selectedDatasetMetadata.name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {datasetService.formatFileSize(selectedDatasetMetadata.file_size)} • {selectedDatasetMetadata.total_examples} examples • Dataset Library
                    </p>
                  </div>
                ) : selectedFileMetadata ? (
                  <div className="mt-1">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {selectedFileMetadata.display_name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {fileService.formatFileSize(selectedFileMetadata.file_size)} • {selectedFileMetadata.validation_details.total_rows} rows • {selectedFileMetadata.file_type.toUpperCase()}
                    </p>
                  </div>
                ) : selectedFileId ? (
                  <p className="text-sm text-red-600 dark:text-red-400 mt-1">Failed to load data information</p>
                ) : (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">No data selected</p>
                )}
                <div className="flex items-center gap-2 mt-2">
                  <Badge 
                    variant={selectedDatasetMetadata || selectedFileMetadata?.validation_status === 'valid' ? 'default' : 'outline'} 
                    size="sm"
                  >
                    {selectedDatasetMetadata ? (
                      <>✓ Ready for training</>
                    ) : selectedFileMetadata ? (
                      <>
                        {fileService.getValidationStatusIcon(selectedFileMetadata.validation_status)} {selectedFileMetadata.validation_status}
                      </>
                    ) : (
                      getValidationText()
                    )}
                  </Badge>
                  {selectedDatasetMetadata && (
                    <Badge variant="outline" size="sm">
                      Dataset Library
                    </Badge>
                  )}
                  {selectedFileMetadata && (
                    <Badge variant="outline" size="sm">
                      {selectedFileMetadata.file_type.toUpperCase()}
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            {/* Basic Parameters */}
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Database className="h-5 w-5 text-blue-500" />
                <h3 className="font-medium text-gray-900 dark:text-gray-100">Basic Parameters</h3>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Epochs</p>
                  <p className="font-medium text-gray-900 dark:text-gray-100">{configuration.parameters.epochs}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Learning Rate</p>
                  <p className="font-medium text-gray-900 dark:text-gray-100">{configuration.parameters.learningRate.toExponential(2)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Batch Size</p>
                  <p className="font-medium text-gray-900 dark:text-gray-100">{configuration.parameters.batchSize}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Max Sequence</p>
                  <p className="font-medium text-gray-900 dark:text-gray-100">{configuration.parameters.maxSequenceLength}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Model Name</p>
                  <p className="font-medium text-gray-900 dark:text-gray-100">{configuration.parameters.modelName}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Train/Val Split</p>
                  <p className="font-medium text-gray-900 dark:text-gray-100">{Math.round(configuration.parameters.cutoff * 100)}%</p>
                </div>
              </div>
            </div>

            {/* Advanced Parameters */}
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Settings className="h-5 w-5 text-purple-500" />
                <h3 className="font-medium text-gray-900 dark:text-gray-100">Advanced Parameters</h3>
              </div>

              {/* LoRA Configuration */}
              <div className="border border-gray-200 dark:border-gray-600 rounded-lg">
                <button
                  onClick={() => toggleSection('lora')}
                  className="w-full flex items-center justify-between p-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <span className="font-medium text-gray-900 dark:text-gray-100">LoRA Configuration</span>
                  {expandedSections.lora ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
                <AnimatePresence>
                  {expandedSections.lora && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="border-t border-gray-200 dark:border-gray-600 p-3 bg-gray-50 dark:bg-gray-700"
                    >
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <p className="text-gray-500 dark:text-gray-400">Rank</p>
                          <p className="font-medium">{configuration.trainingConfig.lora_rank}</p>
                        </div>
                        <div>
                          <p className="text-gray-500 dark:text-gray-400">Alpha</p>
                          <p className="font-medium">{configuration.trainingConfig.lora_alpha}</p>
                        </div>
                        <div>
                          <p className="text-gray-500 dark:text-gray-400">Dropout</p>
                          <p className="font-medium">{configuration.trainingConfig.lora_dropout}</p>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Optimization */}
              <div className="border border-gray-200 dark:border-gray-600 rounded-lg">
                <button
                  onClick={() => toggleSection('optimization')}
                  className="w-full flex items-center justify-between p-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <span className="font-medium text-gray-900 dark:text-gray-100">Optimization</span>
                  {expandedSections.optimization ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
                <AnimatePresence>
                  {expandedSections.optimization && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="border-t border-gray-200 dark:border-gray-600 p-3 bg-gray-50 dark:bg-gray-700"
                    >
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-gray-500 dark:text-gray-400">LR Scheduler</p>
                          <p className="font-medium">{configuration.trainingConfig.lr_scheduler_type}</p>
                        </div>
                        <div>
                          <p className="text-gray-500 dark:text-gray-400">Warmup Steps</p>
                          <p className="font-medium">{configuration.trainingConfig.warmup_steps}</p>
                        </div>
                        <div>
                          <p className="text-gray-500 dark:text-gray-400">Max Grad Norm</p>
                          <p className="font-medium">{configuration.trainingConfig.max_grad_norm}</p>
                        </div>
                        <div>
                          <p className="text-gray-500 dark:text-gray-400">Grad Accumulation</p>
                          <p className="font-medium">{configuration.trainingConfig.gradient_accumulation_steps}</p>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Memory & Performance */}
              <div className="border border-gray-200 dark:border-gray-600 rounded-lg">
                <button
                  onClick={() => toggleSection('memory')}
                  className="w-full flex items-center justify-between p-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <span className="font-medium text-gray-900 dark:text-gray-100">Memory & Performance</span>
                  {expandedSections.memory ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
                <AnimatePresence>
                  {expandedSections.memory && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="border-t border-gray-200 dark:border-gray-600 p-3 bg-gray-50 dark:bg-gray-700"
                    >
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-500 dark:text-gray-400">FP16 Mixed Precision</span>
                          <span className="font-medium">{configuration.trainingConfig.fp16 ? 'Enabled' : 'Disabled'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500 dark:text-gray-400">Gradient Checkpointing</span>
                          <span className="font-medium">{configuration.trainingConfig.gradient_checkpointing ? 'Enabled' : 'Disabled'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500 dark:text-gray-400">Dataloader Workers</span>
                          <span className="font-medium">{configuration.trainingConfig.dataloader_num_workers}</span>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Estimates */}
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Zap className="h-5 w-5 text-yellow-500" />
                <h3 className="font-medium text-gray-900 dark:text-gray-100">Training Estimates</h3>
              </div>
              <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="flex items-center space-x-3">
                  <Clock className="h-5 w-5 text-blue-500" />
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Estimated Time</p>
                    <p className="font-medium text-gray-900 dark:text-gray-100">~{configuration.estimatedTime} minutes</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <DollarSign className="h-5 w-5 text-green-500" />
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Estimated Cost</p>
                    <p className="font-medium text-gray-900 dark:text-gray-100">${configuration.estimatedCost}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700">
          <Button
            variant="outline"
            onClick={onClose}
          >
            Back to Edit
          </Button>
          
          <div className="flex space-x-3">
            <Button
              variant="outline"
              onClick={() => setIsSaveModalOpen(true)}
              disabled={isSaving}
            >
              Save Configuration
            </Button>
            <Button
              variant="primary"
              onClick={onStartTraining}
              leftIcon={<Zap className="h-4 w-4" />}
            >
              Start Fine-Tuning
            </Button>
          </div>
        </div>

        {/* Save Configuration Modal */}
        <SaveConfigModal
          isOpen={isSaveModalOpen}
          onClose={() => setIsSaveModalOpen(false)}
          onSave={handleSaveConfig}
          isLoading={isSaving}
        />
      </motion.div>
    </div>
  );
}
