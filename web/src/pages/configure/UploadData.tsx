import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import ColumnMappingInterface from '../../components/ui/ColumnMappingInterface';
import { useConfigureContext } from './ConfigureContext';
import { 
  Upload, 
  FileText, 
  CheckCircle, 
  AlertCircle, 
  ArrowRight,
  Download,
  BarChart3,
  Database,
  Search,
  Eye,
  Tag,
  ArrowLeft
} from 'lucide-react';
import { 
  fileService, 
  FileUploadResponse, 
  ColumnMapping, 
  ColumnInfo,
  ProcessedFileResponse
} from '../../services/fileService';
import { 
  datasetService, 
  ProcessedDataset
} from '../../services/datasetService';

type UploadStep = 'main' | 'mapping' | 'processing' | 'complete';

export const UploadData: React.FC = () => {
  const { state, dispatch, completeCurrentStep } = useConfigureContext();
  
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState<UploadStep>('main');
  const [uploadedFile, setUploadedFile] = useState<FileUploadResponse | null>(null);
  const [columnInfo, setColumnInfo] = useState<Record<string, ColumnInfo>>({});
  const [availableColumns, setAvailableColumns] = useState<string[]>([]);
  const [savedMapping, setSavedMapping] = useState<ColumnMapping | null>(null);
  const [processedData, setProcessedData] = useState<ProcessedFileResponse | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Dataset selection state
  const [datasets, setDatasets] = useState<ProcessedDataset[]>([]);
  const [selectedDataset, setSelectedDataset] = useState<ProcessedDataset | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoadingDatasets, setIsLoadingDatasets] = useState(false);

  useEffect(() => {
    loadDatasets();
  }, []);

  const loadDatasets = async () => {
    try {
      setIsLoadingDatasets(true);
      setError(null);
      
      const result = await datasetService.listDatasets('created_at', true);
      setDatasets(result.datasets);
    } catch (err: any) {
      setError(err.message || 'Failed to load datasets');
    } finally {
      setIsLoadingDatasets(false);
    }
  };

  const handleFileUpload = async (file: File) => {
    try {
      setIsUploading(true);
      setError(null);
      setSelectedDataset(null); // Clear dataset selection when uploading
      
      const result = await fileService.uploadFile(file, file.name);
      
      if (result.success && result.file_id) {
        setUploadedFile(result);
        
        // Get column information
        const columnInfoResult = await fileService.getColumnInfo(result.file_id);
        setColumnInfo(columnInfoResult.column_info);
        setAvailableColumns(columnInfoResult.available_columns);
        
        setCurrentStep('mapping');
      } else {
        throw new Error(result.message || 'Upload failed');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to upload file');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDatasetSelect = (dataset: ProcessedDataset) => {
    setSelectedDataset(dataset);
    setUploadedFile(null); // Clear file upload when selecting dataset
  };

  const handleMappingComplete = async (mapping: ColumnMapping) => {
    try {
      setSavedMapping(mapping);
      setCurrentStep('processing');
      setIsProcessing(true);
      setError(null);
      
      if (!uploadedFile?.file_id) {
        throw new Error('No file uploaded');
      }
      
      // Process the complete file
      const result = await fileService.processCompleteFile(uploadedFile.file_id, mapping);
      setProcessedData(result);
      
      // Save the processed data as a dataset in the library
      try {
        const datasetName = uploadedFile.metadata?.display_name?.replace(/\.[^/.]+$/, '') || 'Uploaded Dataset';
        const datasetDescription = `Dataset created from uploaded file: ${uploadedFile.metadata?.display_name}`;
        
        await datasetService.createDataset({
          name: datasetName,
          description: datasetDescription,
          source_file_id: uploadedFile.file_id,
          column_mapping: mapping,
          tags: ['uploaded', 'processed']
        });
        
        // Reload datasets to show the new one
        await loadDatasets();
      } catch (datasetError: any) {
        console.warn('Failed to save dataset to library:', datasetError);
        // Don't fail the entire process if dataset saving fails
      }
      
      setCurrentStep('complete');
      
    } catch (err: any) {
      setError(err.message || 'Failed to process file');
      setCurrentStep('mapping');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownloadData = () => {
    if (processedData) {
      fileService.downloadTrainingData(
        processedData.processed_data,
        `${uploadedFile?.metadata?.display_name || 'training_data'}.json`
      );
    }
  };

  const handleDownloadStats = () => {
    if (processedData) {
      fileService.downloadProcessingStats(
        processedData.processing_stats,
        `${uploadedFile?.metadata?.display_name || 'processing'}_stats.json`
      );
    }
  };

  const handleContinue = () => {
    if (uploadedFile?.file_id && savedMapping) {
      // Update context with file information
      dispatch({ type: 'SET_SELECTED_FILE_ID', payload: uploadedFile.file_id });
      completeCurrentStep();
      navigate('/configure/parameters');
    } else if (selectedDataset) {
      // Update context with dataset information
      dispatch({ type: 'SET_SELECTED_FILE_ID', payload: selectedDataset.dataset_id });
      completeCurrentStep();
      navigate('/configure/parameters');
    }
  };

  const handleBack = () => {
    if (currentStep === 'mapping') {
      setCurrentStep('main');
    } else {
      navigate('/configure/model');
    }
  };

  const filteredDatasets = datasets.filter(dataset => {
    const matchesSearch = dataset.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         dataset.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         dataset.source_filename.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const MainStep = () => (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Training Data Upload</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          We support JSON, CSV, Excel, Pickle, and text files containing instruction-response pairs for fine-tuning
        </p>
      </div>

      {/* Upload Section */}
      <Card>
        <CardHeader>
          <CardTitle>Training Data Files</CardTitle>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Upload JSON, CSV, Excel, Pickle, or text files containing instruction-response pairs
          </p>
        </CardHeader>
        <CardContent>
          <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center">
            <input
              type="file"
              accept=".csv,.json,.jsonl,.txt,.pkl,.pickle,.xlsx,.xls"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  handleFileUpload(file);
                }
              }}
              className="hidden"
              id="file-upload"
              disabled={isUploading}
            />
            <label
              htmlFor="file-upload"
              className={`cursor-pointer flex flex-col items-center ${
                isUploading ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              <div className="p-3 rounded-full bg-primary-100 dark:bg-primary-900/20 mb-4">
                <Upload className="h-6 w-6 text-primary-600 dark:text-primary-400" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium">
                  {isUploading ? 'Uploading...' : 'Drag & drop files here or click to browse'}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  JSON, CSV, Excel, Pickle, or TXT files, up to 50MB each (max 5 files)
                </p>
              </div>
            </label>
          </div>

          {/* Data Format Requirements */}
          <div className="mt-6 bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4">
            <h4 className="text-sm font-medium mb-3 flex items-center">
              <FileText className="h-4 w-4 mr-2" />
              Data Format Requirements
            </h4>
            <div className="space-y-3 text-sm">
              <div>
                <span className="font-medium text-blue-600 dark:text-blue-400">JSON:</span>
                <span className="ml-2 text-gray-600 dark:text-gray-400">Array of objects with "instruction" and "response" fields</span>
              </div>
              <div>
                <span className="font-medium text-green-600 dark:text-green-400">CSV:</span>
                <span className="ml-2 text-gray-600 dark:text-gray-400">Columns named "instruction" and "response"</span>
              </div>
              <div>
                <span className="font-medium text-orange-600 dark:text-orange-400">TXT:</span>
                <span className="ml-2 text-gray-600 dark:text-gray-400">Instruction and response pairs separated by delimiters</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dataset Library Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">Or Select from Dataset Library</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Choose from your previously prepared and validated datasets
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => navigate('/data-preparation')}
            className="text-sm"
          >
            Manage Datasets
          </Button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search datasets..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          />
        </div>

        {/* Datasets Grid */}
        {isLoadingDatasets ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mr-3"></div>
            <span className="text-gray-600 dark:text-gray-400">Loading datasets...</span>
          </div>
        ) : filteredDatasets.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <Database className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                No datasets found
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                {searchTerm 
                  ? 'Try adjusting your search terms'
                  : 'Create your first dataset in the Data Preparation tab'
                }
              </p>
              <Button
                onClick={() => navigate('/data-preparation')}
                className="flex items-center mx-auto"
              >
                <Database className="h-4 w-4 mr-2" />
                Go to Data Preparation
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredDatasets.map(dataset => (
              <div
                key={dataset.dataset_id}
                className={`cursor-pointer transition-all duration-200 hover:shadow-md p-4 rounded-lg border-2 ${
                  selectedDataset?.dataset_id === dataset.dataset_id 
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                    : 'border-gray-200 dark:border-gray-700 hover:border-blue-300'
                }`}
                onClick={() => handleDatasetSelect(dataset)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                        {dataset.name}
                      </h3>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          // TODO: Add preview functionality
                        }}
                        className="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
                      >
                        <Eye className="h-4 w-4 text-gray-500" />
                      </button>
                    </div>
                    
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                      {dataset.description || 'No description'}
                    </p>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-8">
                        <div className="text-center">
                          <div className="text-xl font-bold text-blue-600 dark:text-blue-400">
                            {dataset.total_examples.toLocaleString()}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">Examples</div>
                        </div>
                        <div className="text-center">
                          <div className="text-xl font-bold text-green-600 dark:text-green-400">
                            {dataset.processing_stats.success_rate.toFixed(1)}%
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">Success Rate</div>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-6 text-sm">
                        <div className="flex items-center">
                          <span className="text-gray-600 dark:text-gray-400">Source:</span>
                          <span className="font-medium ml-2 truncate max-w-48">{dataset.source_filename}</span>
                        </div>
                        <div className="flex items-center">
                          <span className="text-gray-600 dark:text-gray-400">Created:</span>
                          <span className="font-medium ml-2">{datasetService.formatRelativeTime(dataset.created_at)}</span>
                        </div>
                        <div className="flex items-center">
                          <span className="text-gray-600 dark:text-gray-400">Usage:</span>
                          <span className={`font-medium ml-2 ${datasetService.getDatasetStatusColor(dataset)}`}>
                            {dataset.usage_count} times
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    {dataset.tags.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1">
                        {dataset.tags.slice(0, 3).map((tag, index) => (
                          <span
                            key={index}
                            className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                          >
                            <Tag className="h-3 w-3 mr-1" />
                            {tag}
                          </span>
                        ))}
                        {dataset.tags.length > 3 && (
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            +{dataset.tags.length - 3} more
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Selected Dataset Summary */}
        {selectedDataset && (
          <Card className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
            <CardHeader>
              <CardTitle className="flex items-center text-green-800 dark:text-green-200">
                <CheckCircle className="h-5 w-5 mr-2" />
                Dataset Selected: {selectedDataset.name}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <span className="text-sm text-green-700 dark:text-green-300">Training Examples:</span>
                  <div className="text-lg font-bold text-green-800 dark:text-green-200">
                    {selectedDataset.total_examples.toLocaleString()}
                  </div>
                </div>
                <div>
                  <span className="text-sm text-green-700 dark:text-green-300">Success Rate:</span>
                  <div className="text-lg font-bold text-green-800 dark:text-green-200">
                    {selectedDataset.processing_stats.success_rate.toFixed(1)}%
                  </div>
                </div>
                <div>
                  <span className="text-sm text-green-700 dark:text-green-300">File Size:</span>
                  <div className="text-lg font-bold text-green-800 dark:text-green-200">
                    {datasetService.formatFileSize(selectedDataset.file_size)}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );

  const ProcessingStep = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <BarChart3 className="h-5 w-5 mr-2" />
          Processing File
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
            Processing your data...
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            Applying column mapping and generating training examples
          </p>
        </div>
      </CardContent>
    </Card>
  );

  const CompletionStep = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <CheckCircle className="h-5 w-5 mr-2 text-green-500" />
            Processing Complete
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {processedData && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {processedData.total_examples.toLocaleString()}
                  </div>
                  <div className="text-sm text-green-800 dark:text-green-200">
                    Training Examples
                  </div>
                </div>
                
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {processedData.processing_stats.success_rate.toFixed(1)}%
                  </div>
                  <div className="text-sm text-blue-800 dark:text-blue-200">
                    Success Rate
                  </div>
                </div>
                
                <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                    {processedData.processing_stats.output_types.json_outputs > 0 ? 'Mixed' : 'Text'}
                  </div>
                  <div className="text-sm text-purple-800 dark:text-purple-200">
                    Output Format
                  </div>
                </div>
              </div>

              <div className="flex gap-4">
                <Button
                  onClick={handleDownloadData}
                  className="flex items-center"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download Training Data
                </Button>
                
                <Button
                  variant="outline"
                  onClick={handleDownloadStats}
                  className="flex items-center"
                >
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Download Statistics
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );

  const getProgressSteps = () => {
    return [
      { step: 'main', label: 'Select Data', icon: Database },
      { step: 'mapping', label: 'Map Columns', icon: FileText },
      { step: 'processing', label: 'Process', icon: BarChart3 },
      { step: 'complete', label: 'Complete', icon: CheckCircle }
    ];
  };

  return (
    <div className="max-w-4xl space-y-6">
      {/* Progress Indicator - only show if not on main step */}
      {currentStep !== 'main' && (
        <div className="flex items-center justify-center space-x-4 mb-8">
          {getProgressSteps().map(({ step, label, icon: Icon }, index) => {
            const steps = getProgressSteps();
            const currentIndex = steps.findIndex(s => s.step === currentStep);
            const isActive = currentStep === step;
            const isCompleted = currentIndex > index;
            
            return (
              <React.Fragment key={step}>
                <div className={`flex items-center space-x-2 ${
                  isActive ? 'text-primary-600' : isCompleted ? 'text-green-600' : 'text-gray-400'
                }`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    isActive ? 'bg-primary-100 dark:bg-primary-900/20' : 
                    isCompleted ? 'bg-green-100 dark:bg-green-900/20' : 
                    'bg-gray-100 dark:bg-gray-800'
                  }`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <span className="text-sm font-medium">{label}</span>
                </div>
                {index < steps.length - 1 && (
                  <ArrowRight className={`h-4 w-4 ${
                    isCompleted ? 'text-green-600' : 'text-gray-400'
                  }`} />
                )}
              </React.Fragment>
            );
          })}
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
            <span className="text-red-700 dark:text-red-300">{error}</span>
          </div>
        </div>
      )}

      {/* Step Content */}
      <motion.div
        key={currentStep}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {currentStep === 'main' && <MainStep />}
        
        {currentStep === 'mapping' && uploadedFile && (
          <ColumnMappingInterface
            fileId={uploadedFile.file_id!}
            availableColumns={availableColumns}
            columnInfo={columnInfo}
            onMappingComplete={handleMappingComplete}
            onCancel={() => setCurrentStep('main')}
          />
        )}
        
        {currentStep === 'processing' && <ProcessingStep />}
        {currentStep === 'complete' && <CompletionStep />}
      </motion.div>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button 
          variant="outline" 
          onClick={handleBack}
          disabled={isUploading || isProcessing}
          className="flex items-center"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        
        {(currentStep === 'complete' || (currentStep === 'main' && selectedDataset)) && (
          <Button 
            onClick={handleContinue}
            className="flex items-center"
          >
            Continue to Parameters
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        )}
      </div>
    </div>
  );
};

export default UploadData;
