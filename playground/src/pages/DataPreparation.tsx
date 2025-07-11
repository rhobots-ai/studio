import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '../components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import ColumnMappingInterface from '../components/ui/ColumnMappingInterface';
import { SaveDatasetModal } from '../components/ui/SaveDatasetModal';
import { 
  Upload, 
  Database, 
  Plus, 
  Search, 
  Filter, 
  Download, 
  Edit, 
  Trash2, 
  Copy, 
  Eye, 
  FileText,
  BarChart3,
  Tag,
  Calendar,
  Users,
  AlertCircle,
  CheckCircle,
  Settings,
  ChevronUp,
  ChevronDown,
  Target
} from 'lucide-react';
import { 
  fileService, 
  FileUploadResponse, 
  ColumnMapping, 
  ColumnInfo,
  TrainingExample
} from '../services/fileService';
import { 
  datasetService, 
  ProcessedDataset, 
  DatasetCreateRequest,
  DatasetListResponse
} from '../services/datasetService';

type ViewMode = 'list' | 'upload' | 'mapping' | 'preview';

export const DataPreparation: React.FC = () => {
  const [currentView, setCurrentView] = useState<ViewMode>('list');
  const [datasets, setDatasets] = useState<ProcessedDataset[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState('created_at');
  const [sortDesc, setSortDesc] = useState(true);
  
  // Upload and mapping state
  const [uploadedFile, setUploadedFile] = useState<FileUploadResponse | null>(null);
  const [columnInfo, setColumnInfo] = useState<Record<string, ColumnInfo>>({});
  const [availableColumns, setAvailableColumns] = useState<string[]>([]);
  const [previewDataset, setPreviewDataset] = useState<ProcessedDataset | null>(null);
  
  // Modal state
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [pendingMapping, setPendingMapping] = useState<ColumnMapping | null>(null);

  useEffect(() => {
    loadDatasets();
  }, [sortBy, sortDesc, selectedTags]);

  const loadDatasets = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const result = await datasetService.listDatasets(sortBy, sortDesc, selectedTags);
      setDatasets(result.datasets);
    } catch (err: any) {
      setError(err.message || 'Failed to load datasets');
    } finally {
      setIsLoading(false);
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
        
        setCurrentView('mapping');
      } else {
        throw new Error(result.message || 'Upload failed');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to upload file');
    } finally {
      setIsLoading(false);
    }
  };

  const handleMappingComplete = async (mapping: ColumnMapping, datasetName: string, description?: string, tags: string[] = []) => {
    try {
      setIsLoading(true);
      setError(null);
      
      if (!uploadedFile?.file_id) {
        throw new Error('No file uploaded');
      }
      
      const createRequest: DatasetCreateRequest = {
        name: datasetName,
        description: description || '',
        source_file_id: uploadedFile.file_id,
        column_mapping: mapping,
        tags: tags
      };
      
      const result = await datasetService.createDataset(createRequest);
      
      if (result.success && result.dataset) {
        // Refresh datasets list
        await loadDatasets();
        
        // Show preview of created dataset
        setPreviewDataset(result.dataset);
        setCurrentView('preview');
      } else {
        throw new Error(result.message || 'Failed to create dataset');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create dataset');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteDataset = async (datasetId: string) => {
    if (!confirm('Are you sure you want to delete this dataset? This action cannot be undone.')) {
      return;
    }
    
    try {
      await datasetService.deleteDataset(datasetId);
      await loadDatasets();
    } catch (err: any) {
      setError(err.message || 'Failed to delete dataset');
    }
  };

  const handleDownloadDataset = async (datasetId: string) => {
    try {
      await datasetService.downloadDataset(datasetId);
    } catch (err: any) {
      setError(err.message || 'Failed to download dataset');
    }
  };

  const handleDuplicateDataset = async (dataset: ProcessedDataset) => {
    const newName = prompt('Enter name for the duplicated dataset:', `${dataset.name} (Copy)`);
    if (!newName) return;
    
    try {
      await datasetService.duplicateDataset(dataset.dataset_id, newName);
      await loadDatasets();
    } catch (err: any) {
      setError(err.message || 'Failed to duplicate dataset');
    }
  };

  const handleModalSave = async (name: string, description: string, tags: string[]) => {
    if (pendingMapping) {
      setShowSaveModal(false);
      await handleMappingComplete(pendingMapping, name, description, tags);
      setPendingMapping(null);
    }
  };

  const handleModalClose = () => {
    setShowSaveModal(false);
    setPendingMapping(null);
  };

  const filteredDatasets = datasets.filter(dataset => {
    const matchesSearch = dataset.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         dataset.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         dataset.source_filename.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const getAllTags = () => {
    const allTags = new Set<string>();
    datasets.forEach(dataset => {
      dataset.tags.forEach(tag => allTags.add(tag));
    });
    return Array.from(allTags).sort();
  };

  const DatasetCard: React.FC<{ dataset: ProcessedDataset }> = ({ dataset }) => (
    <div className="cursor-pointer transition-all duration-200 hover:shadow-md p-4 rounded-lg border-2 border-gray-200 dark:border-gray-700 hover:border-blue-300">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {dataset.name}
            </h3>
            <div className="flex space-x-1">
              <button
                onClick={() => {
                  setPreviewDataset(dataset);
                  setCurrentView('preview');
                }}
                className="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <Eye className="h-4 w-4 text-gray-500" />
              </button>
              <button
                onClick={() => handleDownloadDataset(dataset.dataset_id)}
                className="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <Download className="h-4 w-4 text-gray-500" />
              </button>
              <button
                onClick={() => handleDuplicateDataset(dataset)}
                className="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <Copy className="h-4 w-4 text-gray-500" />
              </button>
              <button
                onClick={() => handleDeleteDataset(dataset.dataset_id)}
                className="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-red-600 hover:text-red-700"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
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
                <span className="text-gray-600 dark:text-gray-400">Size:</span>
                <span className="font-medium ml-2">{datasetService.formatFileSize(dataset.file_size)}</span>
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
  );

  const ListView = () => (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            Data Preparation
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Manage your training datasets and column mappings
          </p>
        </div>
        <Button
          onClick={() => setCurrentView('upload')}
          className="flex items-center"
        >
          <Plus className="h-4 w-4 mr-2" />
          Create Dataset
        </Button>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
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
            </div>
            
            <div className="flex gap-2">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              >
                <option value="created_at">Created Date</option>
                <option value="name">Name</option>
                <option value="usage_count">Usage Count</option>
                <option value="total_examples">Examples Count</option>
              </select>
              
              <Button
                variant="outline"
                onClick={() => setSortDesc(!sortDesc)}
                className="px-3"
              >
                {sortDesc ? '↓' : '↑'}
              </Button>
            </div>
          </div>
          
          {getAllTags().length > 0 && (
            <div className="mt-4">
              <div className="flex flex-wrap gap-2">
                <span className="text-sm text-gray-600 dark:text-gray-400 mr-2">Filter by tags:</span>
                {getAllTags().map(tag => (
                  <button
                    key={tag}
                    onClick={() => {
                      if (selectedTags.includes(tag)) {
                        setSelectedTags(selectedTags.filter(t => t !== tag));
                      } else {
                        setSelectedTags([...selectedTags, tag]);
                      }
                    }}
                    className={`inline-flex items-center px-2 py-1 rounded-full text-xs ${
                      selectedTags.includes(tag)
                        ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
                    }`}
                  >
                    <Tag className="h-3 w-3 mr-1" />
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
            <span className="text-red-700 dark:text-red-300">{error}</span>
          </div>
        </div>
      )}

      {/* Datasets Grid */}
      {isLoading ? (
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
              {searchTerm || selectedTags.length > 0 
                ? 'Try adjusting your search or filters'
                : 'Get started by creating your first dataset'
              }
            </p>
            {!searchTerm && selectedTags.length === 0 && (
              <Button
                onClick={() => setCurrentView('upload')}
                className="flex items-center mx-auto"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Dataset
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredDatasets.map(dataset => (
            <DatasetCard key={dataset.dataset_id} dataset={dataset} />
          ))}
        </div>
      )}
    </div>
  );

  const UploadView = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Upload Data File
        </h2>
        <Button variant="outline" onClick={() => setCurrentView('list')}>
          Back to Datasets
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Upload className="h-5 w-5 mr-2" />
            Upload Training Data
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center">
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Upload your training data file in any supported format
            </p>
            
            <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8">
            <input
              type="file"
              accept=".csv,.json,.jsonl,.xlsx,.xls,.pkl,.pickle"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  handleFileUpload(file);
                }
              }}
              className="hidden"
              id="file-upload"
              disabled={isLoading}
            />
              <label
                htmlFor="file-upload"
                className={`cursor-pointer flex flex-col items-center ${
                  isLoading ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                <Upload className="h-12 w-12 text-gray-400 mb-4" />
                <span className="text-lg font-medium text-gray-900 dark:text-gray-100">
                  {isLoading ? 'Uploading...' : 'Choose file to upload'}
                </span>
                <span className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                  Supports CSV, JSON, JSONL, Excel, and Pickle files
                </span>
              </label>
            </div>
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
              Supported File Formats:
            </h4>
            <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
              <li>• <strong>CSV:</strong> Comma-separated values with column headers</li>
              <li>• <strong>JSON:</strong> Array of objects or single object</li>
              <li>• <strong>JSONL:</strong> JSON Lines format (one JSON object per line)</li>
              <li>• <strong>Excel:</strong> .xlsx and .xls files (first sheet will be used)</li>
              <li>• <strong>Pickle:</strong> .pkl and .pickle files containing pandas DataFrames</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const MappingView = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Configure Column Mapping
        </h2>
        <Button variant="outline" onClick={() => setCurrentView('upload')}>
          Back to Upload
        </Button>
      </div>

      {uploadedFile && (
        <ColumnMappingInterface
          fileId={uploadedFile.file_id!}
          availableColumns={availableColumns}
          columnInfo={columnInfo}
          onMappingComplete={(mapping) => {
            setPendingMapping(mapping);
            setShowSaveModal(true);
          }}
          onCancel={() => setCurrentView('upload')}
        />
      )}
    </div>
  );

  const PreviewView = () => {
    const [previewData, setPreviewData] = useState<TrainingExample[]>([]);
    const [isLoadingPreview, setIsLoadingPreview] = useState(false);
    const [showMappingDetails, setShowMappingDetails] = useState(false);

    // Load preview data when component mounts or dataset changes
    useEffect(() => {
      if (previewDataset) {
        loadDatasetPreview();
      }
    }, [previewDataset]);

    const loadDatasetPreview = async () => {
      if (!previewDataset) return;
      
      try {
        setIsLoadingPreview(true);
        const result = await datasetService.previewDataset(previewDataset.dataset_id, 5);
        setPreviewData(result.preview_data || []);
      } catch (err: any) {
        console.error('Failed to load preview data:', err);
        setPreviewData([]);
      } finally {
        setIsLoadingPreview(false);
      }
    };

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Dataset Details
          </h2>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setCurrentView('list')}>
              Back to Datasets
            </Button>
            {previewDataset && (
              <Button onClick={() => handleDownloadDataset(previewDataset.dataset_id)}>
                <Download className="h-4 w-4 mr-2" />
                Download Dataset
              </Button>
            )}
          </div>
        </div>

        {previewDataset && (
          <>
            {/* Dataset Overview */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Database className="h-5 w-5 mr-2 text-blue-500" />
                  {previewDataset.name}
                </CardTitle>
                {previewDataset.description && (
                  <p className="text-gray-600 dark:text-gray-400 mt-2">
                    {previewDataset.description}
                  </p>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                      {previewDataset.total_examples.toLocaleString()}
                    </div>
                    <div className="text-sm text-green-800 dark:text-green-200">
                      Training Examples
                    </div>
                  </div>
                  
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      {previewDataset.processing_stats.success_rate.toFixed(1)}%
                    </div>
                    <div className="text-sm text-blue-800 dark:text-blue-200">
                      Success Rate
                    </div>
                  </div>
                  
                  <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                      {datasetService.formatFileSize(previewDataset.file_size)}
                    </div>
                    <div className="text-sm text-purple-800 dark:text-purple-200">
                      File Size
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                  <h4 className="font-medium mb-2">Processing Statistics:</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Input Rows:</span>
                      <span className="ml-2 font-medium">
                        {previewDataset.processing_stats.total_input_rows.toLocaleString()}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Valid Outputs:</span>
                      <span className="ml-2 font-medium">
                        {previewDataset.processing_stats.valid_output_rows.toLocaleString()}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Skipped Rows:</span>
                      <span className="ml-2 font-medium">
                        {previewDataset.processing_stats.skipped_rows.toLocaleString()}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Avg Instruction Length:</span>
                      <span className="ml-2 font-medium">
                        {Math.round(previewDataset.processing_stats.instruction_stats.avg_length)} chars
                      </span>
                    </div>
                  </div>
                </div>

                {previewDataset.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Tags:</span>
                    {previewDataset.tags.map((tag, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200"
                      >
                        <Tag className="h-3 w-3 mr-1" />
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Column Mapping Details */}
            <Card>
              <CardHeader>
                <CardTitle 
                  className="flex items-center justify-between cursor-pointer"
                  onClick={() => setShowMappingDetails(!showMappingDetails)}
                >
                  <div className="flex items-center">
                    <Settings className="h-5 w-5 mr-2" />
                    Column Mapping Configuration
                  </div>
                  {showMappingDetails ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                </CardTitle>
              </CardHeader>
              <AnimatePresence>
                {showMappingDetails && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <CardContent className="space-y-4">
                      {/* Source Information */}
                      <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                        <h4 className="font-medium mb-2">Source File:</h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {previewDataset.source_filename}
                        </p>
                      </div>

                      {/* Static Instruction */}
                      {previewDataset.column_mapping.static_instruction && (
                        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                          <h4 className="font-medium mb-2 text-blue-800 dark:text-blue-200">Static Instruction:</h4>
                          <p className="text-sm text-blue-700 dark:text-blue-300">
                            {previewDataset.column_mapping.static_instruction}
                          </p>
                        </div>
                      )}

                      {/* Column Mappings */}
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        {/* Instruction Columns */}
                        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                          <h4 className="font-medium mb-2 text-blue-800 dark:text-blue-200 flex items-center">
                            <FileText className="h-4 w-4 mr-2" />
                            Instruction Columns
                          </h4>
                          {previewDataset.column_mapping.instruction_columns.length > 0 ? (
                            <div className="space-y-2">
                              {previewDataset.column_mapping.instruction_columns.map((col, idx) => (
                                <div key={idx} className="text-sm">
                                  <span className="font-medium">{col.column_name}</span>
                                  <span className="text-blue-600 dark:text-blue-400 ml-2">
                                    ({col.role}, weight: {col.weight})
                                  </span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-blue-600 dark:text-blue-400 italic">No columns mapped</p>
                          )}
                        </div>

                        {/* Input Columns */}
                        <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                          <h4 className="font-medium mb-2 text-green-800 dark:text-green-200 flex items-center">
                            <Database className="h-4 w-4 mr-2" />
                            Input Columns
                          </h4>
                          {previewDataset.column_mapping.input_columns.length > 0 ? (
                            <div className="space-y-2">
                              {previewDataset.column_mapping.input_columns.map((col, idx) => (
                                <div key={idx} className="text-sm">
                                  <span className="font-medium">{col.column_name}</span>
                                  <span className="text-green-600 dark:text-green-400 ml-2">
                                    ({col.role}, {col.format_type})
                                  </span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-green-600 dark:text-green-400 italic">No columns mapped</p>
                          )}
                        </div>

                        {/* Output Columns */}
                        <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-lg">
                          <h4 className="font-medium mb-2 text-orange-800 dark:text-orange-200 flex items-center">
                            <Target className="h-4 w-4 mr-2" />
                            Output Columns
                          </h4>
                          {previewDataset.column_mapping.output_columns.length > 0 ? (
                            <div className="space-y-2">
                              {previewDataset.column_mapping.output_columns.map((col, idx) => (
                                <div key={idx} className="text-sm">
                                  <span className="font-medium">{col.column_name}</span>
                                  <span className="text-orange-600 dark:text-orange-400 ml-2">
                                    ({col.role}, {col.format_type})
                                  </span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-orange-600 dark:text-orange-400 italic">No columns mapped</p>
                          )}
                        </div>
                      </div>

                      {/* Templates */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {previewDataset.column_mapping.instruction_template && (
                          <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                            <h4 className="font-medium mb-2">Instruction Template:</h4>
                            <pre className="text-xs bg-white dark:bg-gray-900 p-2 rounded border overflow-x-auto">
                              {previewDataset.column_mapping.instruction_template}
                            </pre>
                          </div>
                        )}

                        {previewDataset.column_mapping.output_template && (
                          <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                            <h4 className="font-medium mb-2">Output Template:</h4>
                            <pre className="text-xs bg-white dark:bg-gray-900 p-2 rounded border overflow-x-auto">
                              {previewDataset.column_mapping.output_template}
                            </pre>
                          </div>
                        )}
                      </div>

                      {/* Ignored Columns */}
                      {previewDataset.column_mapping.ignored_columns && previewDataset.column_mapping.ignored_columns.length > 0 && (
                        <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg">
                          <h4 className="font-medium mb-2 text-red-800 dark:text-red-200">Ignored Columns:</h4>
                          <div className="flex flex-wrap gap-2">
                            {previewDataset.column_mapping.ignored_columns.map((col, idx) => (
                              <span key={idx} className="text-xs bg-red-100 dark:bg-red-800 text-red-800 dark:text-red-200 px-2 py-1 rounded">
                                {col}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </motion.div>
                )}
              </AnimatePresence>
            </Card>

            {/* Sample Data Preview */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Eye className="h-5 w-5 mr-2" />
                  Sample Training Data
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoadingPreview ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600 mr-2"></div>
                    <span className="text-gray-600 dark:text-gray-400">Loading sample data...</span>
                  </div>
                ) : previewData.length > 0 ? (
                  <div className="space-y-4">
                    {previewData.map((example, index) => (
                      <div key={index} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                          <div>
                            <h4 className="font-medium text-sm text-blue-600 dark:text-blue-400 mb-2">
                              Instruction:
                            </h4>
                            <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded text-sm max-h-32 overflow-y-auto">
                              {example.instruction}
                            </div>
                          </div>
                          <div>
                            <h4 className="font-medium text-sm text-green-600 dark:text-green-400 mb-2">
                              Input:
                            </h4>
                            <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded text-sm max-h-32 overflow-y-auto">
                              {typeof example.input === 'string' 
                                ? example.input || '(empty)'
                                : JSON.stringify(example.input, null, 2)
                              }
                            </div>
                          </div>
                          <div>
                            <h4 className="font-medium text-sm text-orange-600 dark:text-orange-400 mb-2">
                              Output:
                            </h4>
                            <div className="bg-orange-50 dark:bg-orange-900/20 p-3 rounded text-sm max-h-32 overflow-y-auto">
                              {typeof example.output === 'string' 
                                ? example.output
                                : JSON.stringify(example.output, null, 2)
                              }
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                    <div className="text-center text-sm text-gray-500 dark:text-gray-400">
                      Showing {previewData.length} of {previewDataset.total_examples.toLocaleString()} examples
                    </div>
                  </div>
                ) : (
                  <p className="text-gray-500 dark:text-gray-400 text-center py-8">
                    No sample data available
                  </p>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="max-w-4xl px-4 py-8">
      <AnimatePresence mode="wait">
        <motion.div
          key={currentView}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
        >
          {currentView === 'list' && <ListView />}
          {currentView === 'upload' && <UploadView />}
          {currentView === 'mapping' && <MappingView />}
          {currentView === 'preview' && <PreviewView />}
        </motion.div>
      </AnimatePresence>

      {/* Save Dataset Modal */}
      <SaveDatasetModal
        isOpen={showSaveModal}
        onClose={handleModalClose}
        onSave={handleModalSave}
        isLoading={isLoading}
        suggestedName={
          uploadedFile && pendingMapping
            ? datasetService.generateDatasetName(
                uploadedFile.metadata?.original_filename || 'dataset',
                pendingMapping
              )
            : ''
        }
        sourceFilename={uploadedFile?.metadata?.original_filename || ''}
      />
    </div>
  );
};

export default DataPreparation;
