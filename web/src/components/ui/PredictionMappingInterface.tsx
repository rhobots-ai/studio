import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from './Button';
import { Card, CardHeader, CardTitle, CardContent } from './Card';
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
  Play
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

interface PredictionMapping {
  input_columns: Record<string, string>; // maps model input fields to file columns
  preprocessing_options: {
    normalize_text: boolean;
    handle_missing_values: 'skip' | 'default' | 'error';
    default_values: Record<string, any>;
    batch_size?: number;
  };
}

interface PredictionMappingInterfaceProps {
  fileId: string;
  availableColumns: string[];
  columnInfo: Record<string, ColumnInfo>;
  selectedModel: ModelInfo;
  onMappingComplete: (mapping: PredictionMapping) => void;
  onCancel: () => void;
  initialMapping?: PredictionMapping;
}

export const PredictionMappingInterface: React.FC<PredictionMappingInterfaceProps> = ({
  fileId,
  availableColumns,
  columnInfo,
  selectedModel,
  onMappingComplete,
  onCancel,
  initialMapping
}) => {
  const [mapping, setMapping] = useState<PredictionMapping>(
    initialMapping || {
      input_columns: {},
      preprocessing_options: {
        normalize_text: true,
        handle_missing_values: 'default',
        default_values: {},
        batch_size: 32
      }
    }
  );

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationResult, setValidationResult] = useState<any>(null);

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

  const validateMapping = async () => {
    try {
      setError(null);
      
      // Check if all required model inputs are mapped
      const requiredFields = Object.keys(selectedModel.input_schema);
      const mappedFields = Object.keys(mapping.input_columns);
      const missingFields = requiredFields.filter(field => !mapping.input_columns[field]);
      
      if (missingFields.length > 0) {
        setValidationResult({
          is_valid: false,
          issues: [`Missing mappings for required fields: ${missingFields.join(', ')}`],
          warnings: []
        });
        return false;
      }
      
      // Check if mapped columns exist in file
      const invalidMappings = Object.entries(mapping.input_columns)
        .filter(([_, fileColumn]) => !availableColumns.includes(fileColumn));
      
      if (invalidMappings.length > 0) {
        setValidationResult({
          is_valid: false,
          issues: [`Invalid column mappings: ${invalidMappings.map(([field, col]) => `${field} -> ${col}`).join(', ')}`],
          warnings: []
        });
        return false;
      }
      
      setValidationResult({
        is_valid: true,
        issues: [],
        warnings: []
      });
      return true;
      
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

  const handleSaveMapping = async () => {
    try {
      setError(null);
      
      // Validate mapping first
      const isValid = await validateMapping();
      if (!isValid) {
        return;
      }

      // Pass the validated mapping to parent component
      onMappingComplete(mapping);
      
    } catch (err: any) {
      setError(err.message || 'Failed to validate mapping');
    }
  };

  const canSave = Object.keys(selectedModel.input_schema).every(field => 
    mapping.input_columns[field]
  );

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
          Map Your Data to Model Schema
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Configure how your file columns map to the model's expected input format
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

      {/* Three Panel Layout - Similar to your diagram */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Panel - Instruction */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <FileText className="h-5 w-5 mr-2 text-blue-500" />
              Instruction
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
              <div className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
                Static Instruction Text:
              </div>
              <div className="text-sm text-blue-700 dark:text-blue-300 italic">
                "{getStaticInstruction()}"
              </div>
            </div>
            <div className="mt-3 text-xs text-gray-500 dark:text-gray-400">
              This instruction will be used for all predictions with this model.
            </div>
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
                    {availableColumns.map((column) => (
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

        {/* Right Panel - Output Schema */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Target className="h-5 w-5 mr-2 text-orange-500" />
              Output
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="text-sm font-medium text-orange-800 dark:text-orange-200 mb-2">
                Expected Output Fields:
              </div>
              {Object.entries(selectedModel.output_schema).map(([field, type]) => (
                <div key={field} className="bg-orange-50 dark:bg-orange-900/20 p-3 rounded">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{field}</span>
                    <span className="text-xs px-2 py-1 bg-orange-100 dark:bg-orange-800 text-orange-800 dark:text-orange-200 rounded">
                      {type as string}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 text-xs text-gray-500 dark:text-gray-400">
              These fields will be generated by the model for each prediction.
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
          Start Prediction
        </Button>
      </div>
    </div>
  );
};

export default PredictionMappingInterface;
