import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Progress } from '../../components/ui/Progress';
import { cn } from '../../utils/cn';
import { Upload, FileText, AlertTriangle, ArrowRight, CheckCircle, ArrowLeft } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { evaluationService, EvaluationMapping } from '../../services/evaluationService';
import { useEvaluateContext } from './EvaluateContext';
import { StepProgress } from '../../components/ui/StepProgress';
import EvaluationMappingInterface from '../../components/ui/EvaluationMappingInterface';

const steps = [
  { id: 1, title: 'Select Model', description: 'Choose evaluation model' },
  { id: 2, title: 'Upload Data', description: 'Upload test dataset' },
  { id: 3, title: 'Configure Parameters', description: 'Set evaluation parameters' },
  { id: 4, title: 'Evaluation Progress', description: 'Monitor evaluation' },
];

export default function UploadData() {
  const navigate = useNavigate();
  const { state, dispatch } = useEvaluateContext();
  
  // Local state
  const [error, setError] = useState<string | null>(null);
  const [validationResult, setValidationResult] = useState<any>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'processing' | 'complete' | 'error'>('idle');
  const [uploadedFileName, setUploadedFileName] = useState<string>('');
  const [showMappingInterface, setShowMappingInterface] = useState(false);
  const [isAnalyzingFile, setIsAnalyzingFile] = useState(false);

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
      dispatch({ type: 'SET_UPLOADED_FILE', payload: uploadedFile });
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

          dispatch({ type: 'SET_FILE_TYPE', payload: fileType });

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
                setValidationResult({
                  ...validation,
                  totalRows: data.length,
                  fileType: 'JSON'
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

  const handleAnalyzeFile = async () => {
    if (!state.uploadedFile || !state.fileType) return;
    
    dispatch({ type: 'SET_LOADING', payload: true });
    setError(null);
    setUploadProgress(0);
    setUploadStatus('uploading');
    setUploadedFileName(state.uploadedFile.name);

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
      const content = await readFileContent(state.uploadedFile);
      
      // Clear the progress interval
      clearInterval(progressInterval);
      
      setUploadProgress(95);
      setUploadStatus('processing');
      
      // Store file content
      dispatch({ type: 'SET_FILE_CONTENT', payload: content });
      
      // Analyze file columns
      setIsAnalyzingFile(true);
      const analysis = await evaluationService.analyzeFileColumns(content, state.fileType);
      dispatch({ type: 'SET_AVAILABLE_COLUMNS', payload: analysis.columns });
      dispatch({ type: 'SET_COLUMN_INFO', payload: analysis.columnInfo });
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
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  const handleMappingComplete = async (mapping: EvaluationMapping) => {
    dispatch({ type: 'SET_MAPPING', payload: mapping });
    // Navigate to next step
    navigate('/evaluate/parameters');
  };

  const handleMappingCancel = () => {
    setShowMappingInterface(false);
    dispatch({ type: 'SET_FILE_CONTENT', payload: '' });
    dispatch({ type: 'SET_AVAILABLE_COLUMNS', payload: [] });
    dispatch({ type: 'SET_COLUMN_INFO', payload: {} });
  };

  const handleBack = () => {
    navigate('/evaluate/model');
  };

  // Convert Model to ModelInfo for the mapping interface
  const convertModelToModelInfo = (model: any) => {
    return {
      model_id: model.id,
      name: model.name,
      description: model.description || '',
      input_schema: model.input_schema || {},
      output_schema: model.output_schema || {},
      created_at: model.created_at || new Date().toISOString(),
      accuracy: model.accuracy,
      status: 'ready' as const,
      training_session_id: model.training_session_id,
      model_type: model.model_type,
      version: model.version,
      metadata: model.metadata || {}
    };
  };

  // Show mapping interface if needed
  if (showMappingInterface && state.selectedModel && state.fileContent && state.fileType) {
    return (
      <EvaluationMappingInterface
        fileId="temp-file-id"
        availableColumns={state.availableColumns}
        columnInfo={state.columnInfo}
        selectedModel={convertModelToModelInfo(state.selectedModel)}
        onMappingComplete={handleMappingComplete}
        onCancel={handleMappingCancel}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Upload Test Data</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Upload your test dataset and configure column mapping
        </p>
      </div>


      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Selected Model</CardTitle>
              <CardDescription>
                Model for evaluation
              </CardDescription>
            </CardHeader>
            <CardContent>
              {state.selectedModel ? (
                <div className="space-y-3">
                  <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span className="text-sm font-medium text-green-800 dark:text-green-200">
                        {state.selectedModel.name}
                      </span>
                    </div>
                  </div>
                  
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    <p className="font-medium mb-1">Input Schema</p>
                    <div className="bg-gray-50 dark:bg-gray-800 p-2 rounded text-xs">
                      {state.selectedModel.input_schema ? (
                        Object.keys(state.selectedModel.input_schema).map((key) => (
                          <div key={key} className="text-blue-600 dark:text-blue-400">
                            • {key}
                          </div>
                        ))
                      ) : (
                        <span className="text-gray-500">No schema available</span>
                      )}
                    </div>
                  </div>

                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    <p className="font-medium mb-1">Output Schema</p>
                    <div className="bg-gray-50 dark:bg-gray-800 p-2 rounded text-xs">
                      {state.selectedModel.output_schema ? (
                        Object.keys(state.selectedModel.output_schema).map((key) => (
                          <div key={key} className="text-green-600 dark:text-green-400">
                            • {key}
                          </div>
                        ))
                      ) : (
                        <span className="text-gray-500">No schema available</span>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-sm text-gray-500">No model selected</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleBack}
                    className="mt-2"
                  >
                    Select Model
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        
        <div className="lg:col-span-3 h-full flex flex-col">
          <Card className="flex-1 flex flex-col h-full min-h-[600px]">
            <CardHeader className="border-b flex-shrink-0">
              <div className="flex items-center space-x-3">
                <Upload className="h-5 w-5 text-primary-500" />
                <div>
                  <CardTitle>Upload Test Dataset</CardTitle>
                  <CardDescription>
                    Upload your test data and configure column mapping
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
                {state.uploadedFile && (
                  <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <FileText className="h-5 w-5 text-gray-500 mr-3" />
                        <div>
                          <p className="text-sm font-medium">{state.uploadedFile.name}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {(state.uploadedFile.size / 1024).toFixed(2)} KB
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          dispatch({ type: 'SET_UPLOADED_FILE', payload: null });
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

                {/* Data Upload Guidelines */}
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
                    💡 Data Upload Guidelines
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
              <div className="w-full flex justify-between">
                <Button
                  variant="outline"
                  size="lg"
                  leftIcon={<ArrowLeft className="h-5 w-5" />}
                  onClick={handleBack}
                  className="px-8"
                >
                  Back to Model Selection
                </Button>
                <Button
                  variant="primary"
                  size="lg"
                  rightIcon={<ArrowRight className="h-5 w-5" />}
                  disabled={!state.uploadedFile || !validationResult?.isValid || state.isLoading}
                  onClick={handleAnalyzeFile}
                  isLoading={state.isLoading}
                  className="px-8"
                >
                  {state.isLoading ? 'Analyzing File...' : 'Analyze & Configure Mapping'}
                </Button>
              </div>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}
