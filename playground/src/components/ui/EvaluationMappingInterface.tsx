import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from './Button';
import { Card, CardHeader, CardTitle, CardContent } from './Card';
import { Progress } from './Progress';
import DynamicInstructionInterface from './DynamicInstructionInterface';
import { 
  ArrowRight, 
  Eye, 
  Settings, 
  Plus, 
  X, 
  ChevronDown,
  ChevronUp,
  CheckCircle,
  AlertCircle,
  FileText,
  Database,
  Target,
  Info,
  Play,
  BarChart3
} from 'lucide-react';

interface ModelInfo {
  model_id: string;
  name: string;
  description: string;
  input_schema: Record<string, any>;
  output_schema: Record<string, any>;
  created_at: string;
  accuracy?: number;
  status: 'ready' | 'loading' | 'error';
  training_session_id?: string;
  model_type?: string;
  version?: string;
  metadata?: {
    training_config?: any;
    dataset_info?: {
      source: string;
      size: number;
    };
    static_instruction?: string;
  };
}

interface ColumnInfo {
  name: string;
  data_type: string;
  null_count: number;
  null_percentage: number;
  unique_count: number;
  sample_values: any[];
  total_rows: number;
  avg_length?: number;
  max_length?: number;
  min_length?: number;
}

interface OutputField {
  jsonField: string;
  csvColumn: string;
}

interface EvaluationMapping {
  input_columns: Record<string, string>; // maps model input fields to file columns
  output_columns: Record<string, string>; // maps JSON fields to CSV columns
  // Dynamic instruction configuration
  instruction_source?: 'static' | 'column' | 'file';
  instruction_column?: string;
  instruction_file_content?: string;
  instruction_file_type?: 'json' | 'csv' | 'jsonl';
  instruction_file_mapping?: Record<string, string>;
  static_instruction?: string;
  preprocessing_options: {
    normalize_text: boolean;
    handle_missing_values: 'skip' | 'default' | 'error';
    default_values: Record<string, any>;
    batch_size?: number;
  };
}

interface EvaluationMappingInterfaceProps {
  fileId: string;
  availableColumns: string[];
  columnInfo: Record<string, ColumnInfo>;
  selectedModel: ModelInfo;
  onMappingComplete: (mapping: EvaluationMapping) => void;
  onCancel: () => void;
  initialMapping?: EvaluationMapping;
}

export const EvaluationMappingInterface: React.FC<EvaluationMappingInterfaceProps> = ({
  fileId,
  availableColumns,
  columnInfo,
  selectedModel,
  onMappingComplete,
  onCancel,
  initialMapping
}) => {
  const [mapping, setMapping] = useState<EvaluationMapping>(
    initialMapping || {
      input_columns: {},
      output_columns: {},
      preprocessing_options: {
        normalize_text: true,
        handle_missing_values: 'default',
        default_values: {},
        batch_size: 32
      }
    }
  );

  const [outputFields, setOutputFields] = useState<OutputField[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationResult, setValidationResult] = useState<any>(null);
  
  // Progress tracking state
  const [isStartingEvaluation, setIsStartingEvaluation] = useState(false);
  const [evaluationProgress, setEvaluationProgress] = useState(0);
  const [evaluationStatus, setEvaluationStatus] = useState<'idle' | 'validating' | 'starting' | 'complete' | 'error'>('idle');

  // Reset mapping when model changes
  useEffect(() => {
    setMapping({
      input_columns: {},
      output_columns: {},
      preprocessing_options: {
        normalize_text: true,
        handle_missing_values: 'default',
        default_values: {},
        batch_size: 32
      }
    });
    setValidationResult(null);
    setError(null);
  }, [selectedModel.model_id]);

  // Initialize output fields from model schema - only run when model changes
  useEffect(() => {
    // Initialize output fields based on model schema, not mapping
    const modelOutputFields = Object.keys(selectedModel.output_schema);
    if (modelOutputFields.length > 0) {
      const fields = modelOutputFields.map(field => ({
        jsonField: field,
        csvColumn: ''
      }));
      setOutputFields(fields);
    } else {
      setOutputFields([{ jsonField: '', csvColumn: '' }]);
    }
  }, [selectedModel.model_id]);

  const validateMapping = async () => {
    try {
      setError(null);
      
      // Check if all required model inputs are mapped
      const requiredFields = Object.keys(selectedModel.input_schema);
      const mappedFields = Object.keys(mapping.input_columns);
      const missingFields = requiredFields.filter(field => !mapping.input_columns[field]);
      
      const issues: string[] = [];
      const warnings: string[] = [];
      
      if (missingFields.length > 0) {
        issues.push(`Missing mappings for required input fields: ${missingFields.join(', ')}`);
      }
      
      // Check if at least one output field is mapped
      if (Object.keys(mapping.output_columns).length === 0) {
        issues.push('At least one output field must be mapped for evaluation');
      }
      
      // Check if mapped columns exist in file
      const invalidInputMappings = Object.entries(mapping.input_columns)
        .filter(([_, fileColumn]) => !availableColumns.includes(fileColumn));
      
      if (invalidInputMappings.length > 0) {
        issues.push(`Invalid input column mappings: ${invalidInputMappings.map(([field, col]) => `${field} -> ${col}`).join(', ')}`);
      }
      
      // Check if output columns exist
      const invalidOutputMappings = Object.entries(mapping.output_columns)
        .filter(([_, fileColumn]) => !availableColumns.includes(fileColumn));
      
      if (invalidOutputMappings.length > 0) {
        issues.push(`Invalid output column mappings: ${invalidOutputMappings.map(([field, col]) => `${field} -> ${col}`).join(', ')}`);
      }
      
      setValidationResult({
        is_valid: issues.length === 0,
        issues,
        warnings
      });
      
      return issues.length === 0;
      
    } catch (err: any) {
      setError(err.message || 'Failed to validate mapping');
      return false;
    }
  };

  const handleColumnMapping = (modelField: string, fileColumn: string) => {
    setMapping(prev => ({
      ...prev,
      input_columns: {
        ...prev.input_columns,
        [modelField]: fileColumn
      }
    }));
  };

  const handleOutputColumnMapping = (outputField: string, fileColumn: string) => {
    setMapping(prev => ({
      ...prev,
      output_columns: {
        ...prev.output_columns,
        [outputField]: fileColumn
      }
    }));
  };

  const addOutputField = () => {
    setOutputFields([...outputFields, { jsonField: '', csvColumn: '' }]);
  };

  const removeOutputField = (index: number) => {
    if (outputFields.length > 1) {
      setOutputFields(outputFields.filter((_, i) => i !== index));
    }
  };

  const updateOutputField = (index: number, key: keyof OutputField, value: string) => {
    const updated = [...outputFields];
    updated[index] = { ...updated[index], [key]: value };
    setOutputFields(updated);
  };

  const getAvailableCsvColumns = (currentIndex: number) => {
    const usedColumns = outputFields
      .map((field, index) => index !== currentIndex ? field.csvColumn : '')
      .filter(Boolean);
    
    return availableColumns.filter(col => !usedColumns.includes(col));
  };

  // Get all currently used columns across both input and output mappings
  const getAllUsedColumns = () => {
    const inputUsedColumns = Object.values(mapping.input_columns).filter(Boolean);
    const outputUsedColumns = Object.values(mapping.output_columns).filter(Boolean);
    return [...inputUsedColumns, ...outputUsedColumns];
  };

  // Get available columns for input field dropdown (excluding already used columns)
  const getAvailableInputColumns = (currentField: string) => {
    const usedColumns = getAllUsedColumns();
    const currentlySelected = mapping.input_columns[currentField];
    
    return availableColumns.filter(col => 
      !usedColumns.includes(col) || col === currentlySelected
    );
  };

  // Get available columns for output field dropdown (excluding already used columns)
  const getAvailableOutputColumns = (currentField: string) => {
    const usedColumns = getAllUsedColumns();
    const currentlySelected = mapping.output_columns[currentField];
    
    return availableColumns.filter(col => 
      !usedColumns.includes(col) || col === currentlySelected
    );
  };

  const handleSaveMapping = async () => {
    try {
      setError(null);
      setIsStartingEvaluation(true);
      setEvaluationProgress(0);
      setEvaluationStatus('validating');
      
      // Simulate validation progress
      const validationInterval = setInterval(() => {
        setEvaluationProgress(prev => {
          if (prev >= 30) {
            clearInterval(validationInterval);
            return 30;
          }
          return prev + Math.random() * 10;
        });
      }, 100);
      
      // Validate mapping first
      const isValid = await validateMapping();
      clearInterval(validationInterval);
      
      if (!isValid) {
        setEvaluationStatus('error');
        setEvaluationProgress(0);
        setIsStartingEvaluation(false);
        return;
      }

      setEvaluationProgress(50);
      setEvaluationStatus('starting');
      
      // Simulate starting evaluation progress
      const startingInterval = setInterval(() => {
        setEvaluationProgress(prev => {
          if (prev >= 90) {
            clearInterval(startingInterval);
            return 90;
          }
          return prev + Math.random() * 15;
        });
      }, 200);

      // Small delay to show progress
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      clearInterval(startingInterval);
      setEvaluationProgress(100);
      setEvaluationStatus('complete');
      
      // Small delay to show completion
      setTimeout(() => {
        // Pass the validated mapping to parent component
        onMappingComplete(mapping);
        // Reset progress state
        setEvaluationProgress(0);
        setEvaluationStatus('idle');
        setIsStartingEvaluation(false);
      }, 1000);
      
    } catch (err: any) {
      setError(err.message || 'Failed to validate mapping');
      setEvaluationStatus('error');
      setEvaluationProgress(0);
      setIsStartingEvaluation(false);
    }
  };

  // Extract static instruction from model metadata
  const getStaticInstruction = () => {
    // Try to get from model metadata first (stored during training)
    if (selectedModel.metadata?.static_instruction) {
      return selectedModel.metadata.static_instruction;
    }
    
    // Fallback: Try to infer from model metadata
    if (selectedModel.metadata?.dataset_info?.source) {
      const source = selectedModel.metadata.dataset_info.source;
      if (source.includes('invoice')) {
        return 'Extract invoice details from the following text';
      }
      if (source.includes('sentiment')) {
        return 'Analyze the sentiment of the following text';
      }
      if (source.includes('classification')) {
        return 'Classify the following text';
      }
    }
    
    // Fallback: Based on model name or description
    if (selectedModel.name.toLowerCase().includes('invoice')) {
      return 'Extract invoice details from the following text';
    }
    if (selectedModel.name.toLowerCase().includes('sentiment')) {
      return 'Analyze the sentiment of the following text';
    }
    if (selectedModel.description.toLowerCase().includes('classification')) {
      return 'Classify the following text';
    }
    
    // Generic default
    return 'Process the following data';
  };

  // More robust validation - using useMemo to prevent infinite loops
  const canSave = useMemo(() => {
    // Check if we have a valid model with schema
    if (!selectedModel || !selectedModel.input_schema || !selectedModel.output_schema) {
      return false;
    }
    
    // Check if all required input fields are mapped
    const inputFields = Object.keys(selectedModel.input_schema);
    const allInputsMapped = inputFields.length > 0 && inputFields.every(field => 
      mapping.input_columns[field] && mapping.input_columns[field].trim() !== ''
    );
    
    // Check if at least one output field is mapped
    const hasOutputMapping = Object.keys(mapping.output_columns).length > 0 &&
      Object.values(mapping.output_columns).some(column => column && column.trim() !== '');
    
    return allInputsMapped && hasOutputMapping;
  }, [selectedModel, mapping.input_columns, mapping.output_columns]);

  const ColumnCard: React.FC<{ 
    columnName: string; 
    info: ColumnInfo; 
  }> = ({ columnName, info }) => (
    <div className="border rounded-lg p-3 hover:bg-gray-50 dark:hover:bg-gray-800">
      <div className="flex justify-between items-start mb-2">
        <h4 className="font-medium text-sm">{columnName}</h4>
        <span className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded">
          {info.data_type}
        </span>
      </div>
      
      <div className="text-xs text-gray-600 dark:text-gray-400 mb-2">
        <div>Rows: {info.total_rows.toLocaleString()}</div>
        <div>Unique: {info.unique_count.toLocaleString()}</div>
        {info.null_percentage > 0 && (
          <div>Nulls: {info.null_percentage.toFixed(1)}%</div>
        )}
        {info.avg_length && (
          <div>Avg Length: {Math.round(info.avg_length)}</div>
        )}
      </div>
      
      <div className="mb-3">
        <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Sample values:</div>
        <div className="text-xs bg-gray-50 dark:bg-gray-800 p-2 rounded max-h-16 overflow-y-auto">
          {info.sample_values.slice(0, 3).map((value, idx) => (
            <div key={idx} className="truncate">
              {String(value)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Configure Evaluation Mapping
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Map your file columns to model inputs and expected output fields
        </p>
        <div className="mt-2 text-sm text-blue-600 dark:text-blue-400">
          Model: <span className="font-medium">{selectedModel.name}</span>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
            <span className="text-red-700 dark:text-red-300">{error}</span>
          </div>
        </div>
      )}

      {/* Validation Results */}
      {validationResult && (
        <div className={`border rounded-lg p-4 ${
          validationResult.is_valid 
            ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
            : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
        }`}>
          <div className="flex items-center mb-2">
            {validationResult.is_valid ? (
              <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
            ) : (
              <AlertCircle className="h-5 w-5 text-yellow-500 mr-2" />
            )}
            <span className="font-medium">
              {validationResult.is_valid ? 'Mapping Valid' : 'Validation Issues'}
            </span>
          </div>
          
          {validationResult.issues?.length > 0 && (
            <div className="mb-2">
              <div className="text-sm font-medium mb-1">Issues:</div>
              <ul className="text-sm list-disc list-inside">
                {validationResult.issues.map((issue: string, idx: number) => (
                  <li key={idx}>{issue}</li>
                ))}
              </ul>
            </div>
          )}
          
          {validationResult.warnings?.length > 0 && (
            <div>
              <div className="text-sm font-medium mb-1">Warnings:</div>
              <ul className="text-sm list-disc list-inside">
                {validationResult.warnings.map((warning: string, idx: number) => (
                  <li key={idx}>{warning}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Evaluation Progress */}
      {isStartingEvaluation && (
        <Card className="bg-gray-50 dark:bg-gray-800">
          <CardContent className="p-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Starting Evaluation
                </span>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {evaluationStatus === 'validating' ? 'Validating Mapping' :
                   evaluationStatus === 'starting' ? 'Initializing Evaluation' :
                   evaluationStatus === 'complete' ? 'Complete' :
                   evaluationStatus === 'error' ? 'Failed' : ''}
                </span>
              </div>
              
              <Progress
                value={evaluationProgress}
                max={100}
                variant={
                  evaluationStatus === 'complete' ? 'success' :
                  evaluationStatus === 'error' ? 'error' :
                  'primary'
                }
                showValue={true}
                formatValue={(value, max) => `${Math.round(value)}%`}
              />
              
              <div className="flex items-center text-sm">
                {evaluationStatus === 'validating' && (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                    <span className="text-blue-600 dark:text-blue-400">Validating column mappings...</span>
                  </>
                )}
                {evaluationStatus === 'starting' && (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-600 mr-2"></div>
                    <span className="text-purple-600 dark:text-purple-400">Initializing evaluation process...</span>
                  </>
                )}
                {evaluationStatus === 'complete' && (
                  <>
                    <CheckCircle className="h-4 w-4 text-green-600 mr-2" />
                    <span className="text-green-600 dark:text-green-400">Evaluation started successfully!</span>
                  </>
                )}
                {evaluationStatus === 'error' && (
                  <>
                    <AlertCircle className="h-4 w-4 text-red-600 mr-2" />
                    <span className="text-red-600 dark:text-red-400">Failed to start evaluation. Please try again.</span>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Three Panel Layout - Same as Prediction */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Panel - Dynamic Instructions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <FileText className="h-5 w-5 mr-2 text-blue-500" />
              Instructions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DynamicInstructionInterface
              availableColumns={availableColumns}
              instructionSource={mapping.instruction_source || 'static'}
              instructionColumn={mapping.instruction_column}
              staticInstruction={mapping.static_instruction || getStaticInstruction()}
              instructionFileMapping={mapping.instruction_file_mapping}
              onInstructionConfigChange={(config) => {
                setMapping(prev => ({
                  ...prev,
                  ...config
                }));
              }}
            />
          </CardContent>
        </Card>

        {/* Middle Panel - Input Mapping */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Database className="h-5 w-5 mr-2 text-green-500" />
              Input Fields ({Object.keys(selectedModel.input_schema).length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.keys(selectedModel.input_schema).length > 1 && (
                <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg mb-4">
                  <div className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-1">
                    Multiple Input Fields Detected
                  </div>
                  <div className="text-xs text-blue-700 dark:text-blue-300">
                    This model was trained with {Object.keys(selectedModel.input_schema).length} input fields. Map each field to a column from your evaluation file.
                  </div>
                </div>
              )}
              
              {Object.entries(selectedModel.input_schema).map(([field, type], index) => (
                <div key={field} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center">
                      <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-1 rounded mr-2">
                        {index + 1}
                      </span>
                      <label className="text-sm font-medium">
                        {field}
                      </label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs px-2 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded">
                        {type as string}
                      </span>
                      <span className={`text-xs px-2 py-1 rounded ${
                        mapping.input_columns[field] 
                          ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                          : 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
                      }`}>
                        {mapping.input_columns[field] ? 'Mapped' : 'Required'}
                      </span>
                    </div>
                  </div>
                  
                  <select
                    value={mapping.input_columns[field] || ''}
                    onChange={(e) => handleColumnMapping(field, e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm"
                  >
                    <option value="">Select column from your file...</option>
                    {getAvailableInputColumns(field).map((column) => (
                      <option key={column} value={column}>
                        {column}
                        {columnInfo[column] && ` (${columnInfo[column].data_type})`}
                      </option>
                    ))}
                  </select>
                  
                  {mapping.input_columns[field] && columnInfo[mapping.input_columns[field]] && (
                    <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-800 rounded text-xs">
                      <div className="text-gray-600 dark:text-gray-400 mb-1">Sample values from your file:</div>
                      <div className="text-gray-800 dark:text-gray-200">
                        {columnInfo[mapping.input_columns[field]].sample_values.slice(0, 2).map(v => String(v).substring(0, 50)).join(' • ')}
                        {columnInfo[mapping.input_columns[field]].sample_values.length > 2 && '...'}
                      </div>
                    </div>
                  )}
                  
                  {!mapping.input_columns[field] && (
                    <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                      This field is required for the model to work correctly.
                    </div>
                  )}
                </div>
              ))}
            </div>
            
            <div className="mt-4 text-xs text-gray-500 dark:text-gray-400">
              {Object.keys(selectedModel.input_schema).length === 1 
                ? "Single input field → Direct mapping"
                : `${Object.keys(selectedModel.input_schema).length} input fields → Each field maps to a column in your file`
              }
            </div>
          </CardContent>
        </Card>

        {/* Right Panel - Output Field Mapping */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Target className="h-5 w-5 mr-2 text-orange-500" />
              Output Fields ({Object.keys(selectedModel.output_schema).length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.keys(selectedModel.output_schema).length > 1 && (
                <div className="bg-orange-50 dark:bg-orange-900/20 p-3 rounded-lg mb-4">
                  <div className="text-sm font-medium text-orange-800 dark:text-orange-200 mb-1">
                    Multiple Output Fields Detected
                  </div>
                  <div className="text-xs text-orange-700 dark:text-orange-300">
                    This model outputs {Object.keys(selectedModel.output_schema).length} fields. Map each field to a column in your evaluation file for accuracy calculation.
                  </div>
                </div>
              )}
              
              {Object.entries(selectedModel.output_schema).map(([field, type], index) => (
                <div key={field} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center">
                      <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-1 rounded mr-2">
                        {index + 1}
                      </span>
                      <label className="text-sm font-medium">
                        {field}
                      </label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs px-2 py-1 bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200 rounded">
                        {type as string}
                      </span>
                      <span className={`text-xs px-2 py-1 rounded ${
                        mapping.output_columns[field] 
                          ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                          : 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200'
                      }`}>
                        {mapping.output_columns[field] ? 'Mapped' : 'Optional'}
                      </span>
                    </div>
                  </div>
                  
                  <select
                    value={mapping.output_columns[field] || ''}
                    onChange={(e) => handleOutputColumnMapping(field, e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm"
                  >
                    <option value="">Select column from your file...</option>
                    {getAvailableOutputColumns(field).map((column) => (
                      <option key={column} value={column}>
                        {column}
                        {columnInfo[column] && ` (${columnInfo[column].data_type})`}
                      </option>
                    ))}
                  </select>
                  
                  {mapping.output_columns[field] && columnInfo[mapping.output_columns[field]] && (
                    <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-800 rounded text-xs">
                      <div className="text-gray-600 dark:text-gray-400 mb-1">Sample values from your file:</div>
                      <div className="text-gray-800 dark:text-gray-200">
                        {columnInfo[mapping.output_columns[field]].sample_values.slice(0, 2).map(v => String(v).substring(0, 50)).join(' • ')}
                        {columnInfo[mapping.output_columns[field]].sample_values.length > 2 && '...'}
                      </div>
                    </div>
                  )}
                  
                  {!mapping.output_columns[field] && (
                    <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                      Map this field to enable accuracy calculation for this output.
                    </div>
                  )}
                </div>
              ))}
            </div>
            
            <div className="mt-4 text-xs text-gray-500 dark:text-gray-400">
              {Object.keys(selectedModel.output_schema).length === 1 
                ? "Single output field → Direct mapping for accuracy calculation"
                : `${Object.keys(selectedModel.output_schema).length} output fields → Map fields you want to evaluate for accuracy`
              }
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Available Columns Reference */}
      <Card>
        <CardHeader>
          <CardTitle 
            className="flex items-center justify-between cursor-pointer"
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            <div className="flex items-center">
              <Info className="h-5 w-5 mr-2" />
              Available File Columns
            </div>
            {showAdvanced ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
          </CardTitle>
        </CardHeader>
        <AnimatePresence>
          {showAdvanced && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {availableColumns.map((columnName) => (
                    <ColumnCard
                      key={columnName}
                      columnName={columnName}
                      info={columnInfo[columnName]}
                    />
                  ))}
                </div>
              </CardContent>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>

      {/* Preprocessing Options */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Settings className="h-5 w-5 mr-2" />
            Preprocessing Options
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={mapping.preprocessing_options.normalize_text}
                  onChange={(e) => setMapping(prev => ({
                    ...prev,
                    preprocessing_options: {
                      ...prev.preprocessing_options,
                      normalize_text: e.target.checked
                    }
                  }))}
                  className="mr-2"
                />
                <span className="text-sm">Normalize text (trim whitespace)</span>
              </label>
              
              <div>
                <label className="block text-sm font-medium mb-1">
                  Handle missing values:
                </label>
                <select
                  value={mapping.preprocessing_options.handle_missing_values}
                  onChange={(e) => setMapping(prev => ({
                    ...prev,
                    preprocessing_options: {
                      ...prev.preprocessing_options,
                      handle_missing_values: e.target.value as 'skip' | 'default' | 'error'
                    }
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm"
                >
                  <option value="default">Use default values</option>
                  <option value="skip">Skip rows with missing values</option>
                  <option value="error">Throw error on missing values</option>
                </select>
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">
                Batch size:
              </label>
              <input
                type="number"
                min="1"
                max="100"
                value={mapping.preprocessing_options.batch_size || 32}
                onChange={(e) => setMapping(prev => ({
                  ...prev,
                  preprocessing_options: {
                    ...prev.preprocessing_options,
                    batch_size: parseInt(e.target.value) || 32
                  }
                }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm"
              />
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Number of rows to process at once
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button 
          onClick={handleSaveMapping}
          disabled={!canSave}
          className="flex items-center"
        >
          <Play className="h-4 w-4 mr-2" />
          Start Evaluation
        </Button>
      </div>
    </div>
  );
};

export default EvaluationMappingInterface;
