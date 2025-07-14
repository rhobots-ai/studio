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
  Info
} from 'lucide-react';

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

interface ColumnConfig {
  column_name: string;
  target_field?: string;
  role: 'primary' | 'context' | 'metadata';
  weight: number;
  format_type: 'text' | 'json' | 'list' | 'table';
  custom_template?: string;
  parse_json: boolean;
}

interface ColumnMapping {
  static_instruction: string;
  instruction_columns: ColumnConfig[];
  instruction_template: string;
  input_columns: ColumnConfig[];
  output_columns: ColumnConfig[];
  output_template: string;
  ignored_columns: string[];
  mapping_name: string;
  description: string;
}

interface TrainingExample {
  instruction: string;
  input: string | Record<string, any>;
  output: string | Record<string, any>;
}

interface ColumnMappingInterfaceProps {
  fileId: string;
  availableColumns: string[];
  columnInfo: Record<string, ColumnInfo>;
  onMappingComplete: (mapping: ColumnMapping) => void;
  onCancel: () => void;
  initialMapping?: ColumnMapping;
}

export const ColumnMappingInterface: React.FC<ColumnMappingInterfaceProps> = ({
  fileId,
  availableColumns,
  columnInfo,
  onMappingComplete,
  onCancel,
  initialMapping
}) => {
  const [mapping, setMapping] = useState<ColumnMapping>(
    initialMapping || {
      static_instruction: '',
      instruction_columns: [],
      instruction_template: '',
      input_columns: [],
      output_columns: [],
      output_template: '',
      ignored_columns: [],
      mapping_name: 'Custom Mapping',
      description: 'User-defined column mapping'
    }
  );

  const [previewData, setPreviewData] = useState<TrainingExample[]>([]);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationResult, setValidationResult] = useState<any>(null);

  // Update preview when mapping changes
  useEffect(() => {
    if (mapping.output_columns.length > 0) {
      loadPreview();
    }
  }, [mapping]);

  const loadPreview = async () => {
    try {
      setIsLoadingPreview(true);
      setError(null);
      
      const response = await fetch(`/api/files/${fileId}/preview-mapped`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          file_id: fileId,
          column_mapping: mapping,
          limit: 5
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      setPreviewData(result.preview_data || []);
      
    } catch (err: any) {
      console.error('Preview error:', err);
      setPreviewData([]);
      setError(err.message || 'Failed to load preview');
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const validateMapping = async () => {
    try {
      const response = await fetch(`/api/files/${fileId}/validate-mapping`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          file_id: fileId,
          column_mapping: mapping
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      setValidationResult(result.validation);
      return result.validation.is_valid;
      
    } catch (err: any) {
      setError(err.message || 'Failed to validate mapping');
      return false;
    }
  };

  const addColumnToMapping = (columnName: string, type: 'instruction' | 'input' | 'output') => {
    const newColumn: ColumnConfig = {
      column_name: columnName,
      role: 'primary',
      weight: 1.0,
      format_type: 'text',
      parse_json: false
    };

    setMapping(prev => {
      const updated = { ...prev };
      
      if (type === 'instruction') {
        updated.instruction_columns = [...prev.instruction_columns, newColumn];
        // Update template if empty
        if (!updated.instruction_template) {
          updated.instruction_template = updated.instruction_columns
            .map(col => `{${col.column_name}}`)
            .join('\n');
        }
      } else if (type === 'input') {
        updated.input_columns = [...prev.input_columns, newColumn];
      } else if (type === 'output') {
        updated.output_columns = [...prev.output_columns, newColumn];
        // Update template if empty
        if (!updated.output_template) {
          updated.output_template = updated.output_columns
            .map(col => `{${col.column_name}}`)
            .join('\n');
        }
      }
      
      return updated;
    });
  };

  const removeColumnFromMapping = (columnName: string, type: 'instruction' | 'input' | 'output') => {
    setMapping(prev => {
      const updated = { ...prev };
      
      if (type === 'instruction') {
        updated.instruction_columns = prev.instruction_columns.filter(
          col => col.column_name !== columnName
        );
        // Update template
        updated.instruction_template = updated.instruction_columns
          .map(col => `{${col.column_name}}`)
          .join('\n');
      } else if (type === 'input') {
        updated.input_columns = prev.input_columns.filter(
          col => col.column_name !== columnName
        );
      } else if (type === 'output') {
        updated.output_columns = prev.output_columns.filter(
          col => col.column_name !== columnName
        );
        // Update template
        updated.output_template = updated.output_columns
          .map(col => `{${col.column_name}}`)
          .join('\n');
      }
      
      return updated;
    });
  };

  const updateTemplate = (template: string, type: 'instruction' | 'output') => {
    setMapping(prev => ({
      ...prev,
      [type === 'instruction' ? 'instruction_template' : 'output_template']: template
    }));
  };

  const updateStaticInstruction = (value: string) => {
    setMapping(prev => ({
      ...prev,
      static_instruction: value
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

  const getUsedColumns = () => {
    const used = new Set<string>();
    mapping.instruction_columns.forEach(col => used.add(col.column_name));
    mapping.input_columns.forEach(col => used.add(col.column_name));
    mapping.output_columns.forEach(col => used.add(col.column_name));
    return used;
  };

  const getAvailableColumns = () => {
    const used = getUsedColumns();
    return availableColumns.filter(col => !used.has(col));
  };

  const canSave = mapping.output_columns.length > 0;

  const ColumnCard: React.FC<{ 
    columnName: string; 
    info: ColumnInfo; 
    onAdd: (type: 'instruction' | 'input' | 'output') => void;
    disabled?: boolean;
  }> = ({ columnName, info, onAdd, disabled = false }) => (
    <div className={`border rounded-lg p-3 ${disabled ? 'opacity-50' : 'hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
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
      
      {!disabled && (
        <div className="flex gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onAdd('instruction')}
            className="flex-1 text-xs"
          >
            <FileText className="h-3 w-3 mr-1" />
            Instruction
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onAdd('input')}
            className="flex-1 text-xs"
          >
            <Database className="h-3 w-3 mr-1" />
            Input
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onAdd('output')}
            className="flex-1 text-xs"
          >
            <Target className="h-3 w-3 mr-1" />
            Output
          </Button>
        </div>
      )}
    </div>
  );

  const updateColumnConfig = (columnName: string, type: 'instruction' | 'input' | 'output', updates: Partial<ColumnConfig>) => {
    setMapping(prev => {
      const updated = { ...prev };
      
      if (type === 'instruction') {
        updated.instruction_columns = prev.instruction_columns.map(col =>
          col.column_name === columnName ? { ...col, ...updates } : col
        );
      } else if (type === 'input') {
        updated.input_columns = prev.input_columns.map(col =>
          col.column_name === columnName ? { ...col, ...updates } : col
        );
      } else if (type === 'output') {
        updated.output_columns = prev.output_columns.map(col =>
          col.column_name === columnName ? { ...col, ...updates } : col
        );
      }
      
      return updated;
    });
  };

  const MappedColumnsList: React.FC<{
    title: string;
    columns: ColumnConfig[];
    onRemove: (columnName: string) => void;
    onUpdate: (columnName: string, updates: Partial<ColumnConfig>) => void;
    icon: React.ReactNode;
    color: string;
    type: 'instruction' | 'input' | 'output';
  }> = ({ title, columns, onRemove, onUpdate, icon, color, type }) => (
    <div className="space-y-2">
      <h4 className="font-medium text-sm flex items-center">
        {icon}
        {title}
      </h4>
      {columns.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400 italic">
          No columns selected
        </p>
      ) : (
        <div className="space-y-2">
          {columns.map((col, index) => (
            <div key={index} className={`${color} p-3 rounded border`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">{col.column_name}</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onRemove(col.column_name)}
                  className="h-6 w-6 p-0"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
              
              {columnInfo[col.column_name] && (
                <div className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                  {columnInfo[col.column_name].data_type} • 
                  {columnInfo[col.column_name].sample_values.length > 0 && 
                    ` Sample: ${String(columnInfo[col.column_name].sample_values[0]).substring(0, 30)}...`
                  }
                </div>
              )}

              {/* Field mapping for input/output columns */}
              {(type === 'input' || type === 'output') && (
                <div className="space-y-2">
                  <div>
                    <label className="block text-xs font-medium mb-1">
                      Target Field Name:
                    </label>
                    <input
                      type="text"
                      value={col.target_field || col.column_name}
                      onChange={(e) => onUpdate(col.column_name, { target_field: e.target.value })}
                      className="w-full text-xs p-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800"
                      placeholder={col.column_name}
                    />
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id={`parse-json-${col.column_name}`}
                      checked={col.parse_json}
                      onChange={(e) => onUpdate(col.column_name, { parse_json: e.target.checked })}
                      className="h-3 w-3"
                    />
                    <label htmlFor={`parse-json-${col.column_name}`} className="text-xs">
                      Parse as JSON
                    </label>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Map Your Columns
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Configure how your data columns should be mapped to training format
        </p>
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

      {/* Static Instruction Field */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <FileText className="h-5 w-5 mr-2 text-blue-500" />
            Static Instruction (Optional)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <textarea
            value={mapping.static_instruction}
            onChange={(e) => updateStaticInstruction(e.target.value)}
            className="w-full h-20 p-3 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            placeholder="Enter static instruction text that will be added to every training example (e.g., 'Analyze this data:', 'Answer the following question:')"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            This text will be prepended to every instruction. Leave empty if not needed.
          </p>
        </CardContent>
      </Card>

      {/* Column Mapping Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Instruction Columns */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <FileText className="h-5 w-5 mr-2 text-blue-500" />
              Instructions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <MappedColumnsList
              title="Selected Columns:"
              columns={mapping.instruction_columns}
              onRemove={(col) => removeColumnFromMapping(col, 'instruction')}
              onUpdate={(col, updates) => updateColumnConfig(col, 'instruction', updates)}
              icon={<FileText className="h-4 w-4 mr-2 text-blue-500" />}
              color="bg-blue-50 dark:bg-blue-900/20"
              type="instruction"
            />
          </CardContent>
        </Card>

        {/* Input Columns */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Database className="h-5 w-5 mr-2 text-green-500" />
              Input Context
            </CardTitle>
          </CardHeader>
          <CardContent>
            <MappedColumnsList
              title="Selected Columns:"
              columns={mapping.input_columns}
              onRemove={(col) => removeColumnFromMapping(col, 'input')}
              onUpdate={(col, updates) => updateColumnConfig(col, 'input', updates)}
              icon={<Database className="h-4 w-4 mr-2 text-green-500" />}
              color="bg-green-50 dark:bg-green-900/20"
              type="input"
            />
            <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              {mapping.input_columns.length === 1 
                ? "Single column → String value"
                : mapping.input_columns.length > 1
                ? "Multiple columns → JSON object"
                : "No columns selected"
              }
            </div>
          </CardContent>
        </Card>

        {/* Output Columns */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Target className="h-5 w-5 mr-2 text-orange-500" />
              Expected Output
            </CardTitle>
          </CardHeader>
          <CardContent>
            <MappedColumnsList
              title="Selected Columns:"
              columns={mapping.output_columns}
              onRemove={(col) => removeColumnFromMapping(col, 'output')}
              onUpdate={(col, updates) => updateColumnConfig(col, 'output', updates)}
              icon={<Target className="h-4 w-4 mr-2 text-orange-500" />}
              color="bg-orange-50 dark:bg-orange-900/20"
              type="output"
            />
            <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              {mapping.output_columns.length === 1 
                ? "Single column → String value"
                : mapping.output_columns.length > 1
                ? "Multiple columns → JSON object"
                : "No columns selected (required)"
              }
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Available Columns */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Info className="h-5 w-5 mr-2" />
            Available Columns
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {getAvailableColumns().map((columnName) => (
              <ColumnCard
                key={columnName}
                columnName={columnName}
                info={columnInfo[columnName]}
                onAdd={(type) => addColumnToMapping(columnName, type)}
              />
            ))}
            {getUsedColumns().size > 0 && Array.from(getUsedColumns()).map((columnName) => (
              <ColumnCard
                key={`used-${columnName}`}
                columnName={columnName}
                info={columnInfo[columnName]}
                onAdd={() => {}}
                disabled={true}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Advanced Template Editor */}
      <Card>
        <CardHeader>
          <CardTitle 
            className="flex items-center justify-between cursor-pointer"
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            <div className="flex items-center">
              <Settings className="h-5 w-5 mr-2" />
              Advanced Template Editor
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
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Instruction Template:
                    </label>
                    <textarea
                      value={mapping.instruction_template}
                      onChange={(e) => updateTemplate(e.target.value, 'instruction')}
                      className="w-full h-24 p-3 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                      placeholder="Use {column_name} to insert column values"
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Use {`{column_name}`} to insert values from your columns
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Output Template:
                    </label>
                    <textarea
                      value={mapping.output_template}
                      onChange={(e) => updateTemplate(e.target.value, 'output')}
                      className="w-full h-24 p-3 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                      placeholder="Use {column_name} to insert column values"
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Use {`{column_name}`} to insert values from your columns
                    </p>
                  </div>
                </div>
              </CardContent>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>

      {/* Live Preview */}
      {canSave && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Eye className="h-5 w-5 mr-2" />
              Live Preview
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingPreview ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600 mr-2"></div>
                <span className="text-gray-600 dark:text-gray-400">Loading preview...</span>
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
                        <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded text-sm">
                          {example.instruction}
                        </div>
                      </div>
                      <div>
                        <h4 className="font-medium text-sm text-green-600 dark:text-green-400 mb-2">
                          Input:
                        </h4>
                        <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded text-sm">
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
                        <div className="bg-orange-50 dark:bg-orange-900/20 p-3 rounded text-sm">
                          {typeof example.output === 'string' 
                            ? example.output
                            : JSON.stringify(example.output, null, 2)
                          }
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 dark:text-gray-400 text-center py-8">
                No preview available. Please check your column mapping.
              </p>
            )}
          </CardContent>
        </Card>
      )}

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
          Save Mapping
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  );
};

export default ColumnMappingInterface;
