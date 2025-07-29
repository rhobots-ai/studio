import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { cn } from '../../utils/cn';
import { Settings, ArrowRight, ArrowLeft, CheckCircle, AlertTriangle, Upload, Download, Plus, X, FileText, ChevronDown, ChevronUp, Edit } from 'lucide-react';
import { useEvaluateContext } from './EvaluateContext';
import { evaluationService } from '../../services/evaluationService';
import { JsonEditorModal } from '../../components/ui/JsonEditorModal';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';

export default function ConfigureParameters() {
  const navigate = useNavigate();
  const { state, dispatch } = useEvaluateContext();
  
  // Local state
  const [isStartingEvaluation, setIsStartingEvaluation] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // JSON Import/Export state
  const [jsonImportText, setJsonImportText] = useState('');
  const [showJsonImport, setShowJsonImport] = useState(false);
  const [jsonImportError, setJsonImportError] = useState<string | null>(null);
  
  // Custom parameters state
  const [customParameters, setCustomParameters] = useState<Array<{id: string, key: string, value: string, type: 'string' | 'number' | 'boolean'}>>([]);
  
  // Section visibility state
  const [showBasicParams, setShowBasicParams] = useState(true);
  const [showModelParams, setShowModelParams] = useState(true);
  const [showCustomParams, setShowCustomParams] = useState(true);
  
  // JSON Editor Modal state
  const [isJsonEditorModalOpen, setIsJsonEditorModalOpen] = useState(false);

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
      if (config.evaluation_parameters) {
        // Our internal format
        if (config.evaluation_parameters.batchSize) dispatch({ type: 'SET_BATCH_SIZE', payload: config.evaluation_parameters.batchSize });
        if (config.evaluation_parameters.maxTokens) dispatch({ type: 'SET_MAX_TOKENS', payload: config.evaluation_parameters.maxTokens });
        if (config.evaluation_parameters.temperature) dispatch({ type: 'SET_TEMPERATURE', payload: config.evaluation_parameters.temperature });
      } else {
        // Direct parameters format
        if (config.batch_size) dispatch({ type: 'SET_BATCH_SIZE', payload: config.batch_size });
        if (config.max_tokens) dispatch({ type: 'SET_MAX_TOKENS', payload: config.max_tokens });
        if (config.temperature) dispatch({ type: 'SET_TEMPERATURE', payload: config.temperature });
      }

      // Load custom parameters if they exist
      if (config.custom_parameters) {
        const loadedCustomParams = Object.entries(config.custom_parameters).map(([key, value], index) => ({
          id: `loaded_${Date.now()}_${index}`,
          key,
          value: String(value),
          type: detectParameterType(String(value))
        }));
        setCustomParameters(loadedCustomParams);
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
      evaluation_parameters: {
        batchSize: state.batchSize,
        maxTokens: state.maxTokens,
        temperature: state.temperature
      },
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
        name: 'Evaluation Configuration',
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

  // JSON Editor Modal handlers
  const handleJsonEditorApply = (config: any) => {
    try {
      // Apply evaluation parameters
      if (config.evaluation_parameters) {
        if (config.evaluation_parameters.batchSize) dispatch({ type: 'SET_BATCH_SIZE', payload: config.evaluation_parameters.batchSize });
        if (config.evaluation_parameters.maxTokens) dispatch({ type: 'SET_MAX_TOKENS', payload: config.evaluation_parameters.maxTokens });
        if (config.evaluation_parameters.temperature) dispatch({ type: 'SET_TEMPERATURE', payload: config.evaluation_parameters.temperature });
      } else {
        // Direct parameters format
        if (config.batchSize || config.batch_size) dispatch({ type: 'SET_BATCH_SIZE', payload: config.batchSize || config.batch_size });
        if (config.maxTokens || config.max_tokens) dispatch({ type: 'SET_MAX_TOKENS', payload: config.maxTokens || config.max_tokens });
        if (config.temperature) dispatch({ type: 'SET_TEMPERATURE', payload: config.temperature });
      }

      // Handle custom parameters
      if (config.custom_parameters) {
        const loadedCustomParams = Object.entries(config.custom_parameters).map(([key, value], index) => ({
          id: `editor_${Date.now()}_${index}`,
          key,
          value: String(value),
          type: detectParameterType(String(value))
        }));
        setCustomParameters(loadedCustomParams);
      }

      toast.success('Configuration applied successfully!');
    } catch (error: any) {
      toast.error('Failed to apply configuration: ' + error.message);
    }
  };

  // Get current configuration for JSON editor
  const getCurrentConfig = () => {
    return {
      evaluation_parameters: {
        batchSize: state.batchSize,
        maxTokens: state.maxTokens,
        temperature: state.temperature
      },
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
        name: 'Evaluation Configuration',
        version: '1.0'
      }
    };
  };

  const handleBack = () => {
    navigate('/evaluate/data');
  };

  const handleStartEvaluation = async () => {
    if (!state.selectedModel || !state.fileContent || !state.fileType || !state.mapping) {
      setError('Missing required data. Please go back and complete previous steps.');
      return;
    }

    setIsStartingEvaluation(true);
    setError(null);

    try {
      // Get model path - for HF models use the name directly, for local models use name
      const modelPath = state.activeTab === 'huggingface' 
        ? state.selectedModel.name  // Use HF model name directly
        : state.selectedModel.name; // Use local model name
      
      // Process custom parameters
      const processedCustomParams = customParameters.reduce((acc, param) => {
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

      // Start prediction job with mapping and custom parameters
      const response = await evaluationService.startPredictionJobWithMapping(
        modelPath,
        state.fileContent,
        state.fileType,
        state.mapping,
        state.batchSize
      );

      // Store job info and navigate to progress page
      dispatch({ type: 'SET_EVALUATION_JOB_ID', payload: response.job_id });
      
      navigate('/evaluate/progress');
    } catch (error: any) {
      setError(error.message || 'Failed to start evaluation. Please try again.');
    } finally {
      setIsStartingEvaluation(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configure Evaluation Parameters</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Set evaluation parameters and review your configuration
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Configuration Summary</CardTitle>
              <CardDescription>
                Review your evaluation setup
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Model Info */}
              <div>
                <h4 className="text-sm font-medium mb-2">Selected Model</h4>
                {state.selectedModel ? (
                  <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span className="text-sm font-medium text-green-800 dark:text-green-200">
                        {state.selectedModel.name}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-red-500" />
                      <span className="text-sm text-red-800 dark:text-red-200">
                        No model selected
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Data Info */}
              <div>
                <h4 className="text-sm font-medium mb-2">Test Data</h4>
                {state.uploadedFile ? (
                  <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span className="text-sm font-medium text-green-800 dark:text-green-200">
                        {state.uploadedFile.name}
                      </span>
                    </div>
                    <div className="text-xs text-green-600 dark:text-green-400 mt-1">
                      {state.fileType?.toUpperCase()} • {(state.uploadedFile.size / 1024).toFixed(2)} KB
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-red-500" />
                      <span className="text-sm text-red-800 dark:text-red-200">
                        No data uploaded
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Mapping Info */}
              <div>
                <h4 className="text-sm font-medium mb-2">Column Mapping</h4>
                {state.mapping ? (
                  <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span className="text-sm font-medium text-green-800 dark:text-green-200">
                        Mapping configured
                      </span>
                    </div>
                    <div className="text-xs text-green-600 dark:text-green-400 mt-1">
                      {Object.keys(state.mapping.input_columns || {}).length} input mappings
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-red-500" />
                      <span className="text-sm text-red-800 dark:text-red-200">
                        No mapping configured
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Parameter Summary */}
              <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                <h4 className="text-sm font-medium mb-2">Current Parameters</h4>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Batch Size:</span>
                    <span className="font-medium">{state.batchSize}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Max Tokens:</span>
                    <span className="font-medium">{state.maxTokens}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Temperature:</span>
                    <span className="font-medium">{state.temperature}</span>
                  </div>
                  {customParameters.length > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Custom Params:</span>
                      <span className="font-medium">{customParameters.length}</span>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        
        <div className="lg:col-span-3 h-full flex flex-col">
          <div className="space-y-6">
            {/* Parameters Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Settings className="h-5 w-5" />
                    <span>Evaluation Parameters</span>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm"
                    leftIcon={<Edit className="h-4 w-4" />}
                    onClick={() => setIsJsonEditorModalOpen(true)}
                    className="text-blue-600 border-blue-300 hover:bg-blue-50 hover:border-blue-400 dark:text-blue-400 dark:border-blue-600 dark:hover:bg-blue-900/20 dark:hover:border-blue-500"
                  >
                    Open in Editor
                  </Button>
                </CardTitle>
                <CardDescription>
                  Configure evaluation settings and parameters
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-8">
                {/* Error Display */}
                {error && (
                  <div className="p-4 bg-error-50 dark:bg-error-900/20 rounded-lg border border-error-200 dark:border-error-800">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-5 w-5 text-error-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-error-800 dark:text-error-200">
                          Configuration Error
                        </p>
                        <p className="text-sm text-error-700 dark:text-error-300 mt-1">
                          {error}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Basic Parameters Section */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 pb-2">
                    <div>
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Processing Parameters</h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Configure how the evaluation will be processed</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowBasicParams(!showBasicParams)}
                      leftIcon={showBasicParams ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      className="text-xs"
                    >
                      {showBasicParams ? 'Hide' : 'Show'}
                    </Button>
                  </div>
                  {showBasicParams && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="grid grid-cols-1 md:grid-cols-2 gap-6"
                    >
                      {/* Batch Size */}
                      <div className="space-y-2">
                        <label htmlFor="batchSize" className="block text-sm font-medium">
                          Batch Size
                        </label>
                        <p className="text-xs text-gray-500 dark:text-gray-400 -mt-1 mb-2">
                          Number of examples processed together. Larger values are faster but use more memory.
                        </p>
                        <input
                          type="number"
                          id="batchSize"
                          min="10"
                          max="100"
                          step="10"
                          value={state.batchSize}
                          onChange={(e) => dispatch({ type: 'SET_BATCH_SIZE', payload: parseInt(e.target.value) || 50 })}
                          onFocus={handleInputFocus}
                          placeholder="50 (recommended)"
                          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        />
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Typical range: 10-100
                        </p>
                      </div>
                    </motion.div>
                  )}
                </div>

                {/* Model Parameters Section */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 pb-2">
                    <div>
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Model Parameters</h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Configure model inference settings</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowModelParams(!showModelParams)}
                      leftIcon={showModelParams ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      className="text-xs"
                    >
                      {showModelParams ? 'Hide' : 'Show'}
                    </Button>
                  </div>
                  {showModelParams && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="grid grid-cols-1 md:grid-cols-2 gap-6"
                    >
                      {/* Max Tokens */}
                      <div className="space-y-2">
                        <label htmlFor="maxTokens" className="block text-sm font-medium">
                          Max Tokens
                        </label>
                        <p className="text-xs text-gray-500 dark:text-gray-400 -mt-1 mb-2">
                          Maximum number of tokens the model can generate per response.
                        </p>
                        <input
                          type="number"
                          id="maxTokens"
                          min="50"
                          max="500"
                          step="25"
                          value={state.maxTokens}
                          onChange={(e) => dispatch({ type: 'SET_MAX_TOKENS', payload: parseInt(e.target.value) || 150 })}
                          onFocus={handleInputFocus}
                          placeholder="150 (recommended)"
                          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        />
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Typical range: 50-500
                        </p>
                      </div>
                      
                      {/* Temperature */}
                      <div className="space-y-2">
                        <label htmlFor="temperature" className="block text-sm font-medium">
                          Temperature
                        </label>
                        <p className="text-xs text-gray-500 dark:text-gray-400 -mt-1 mb-2">
                          Controls randomness in model outputs. Lower values are more deterministic.
                        </p>
                        <input
                          type="number"
                          id="temperature"
                          min="0"
                          max="2"
                          step="0.1"
                          value={state.temperature}
                          onChange={(e) => dispatch({ type: 'SET_TEMPERATURE', payload: parseFloat(e.target.value) || 0.7 })}
                          onFocus={handleInputFocus}
                          placeholder="0.7 (recommended)"
                          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        />
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Typical range: 0.0-2.0
                        </p>
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
                        <p className="text-xs text-gray-500 dark:text-gray-400">Add custom evaluation parameters not covered above</p>
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
                          <p className="text-xs">Click "Add Parameter" to add custom evaluation parameters</p>
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
                            <strong>Note:</strong> Custom parameters will be passed directly to the evaluation script. 
                            Make sure parameter names and values are valid for your evaluation framework.
                          </p>
                        </div>
                      )}
                    </motion.div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Evaluation Tips */}
            <Card>
              <CardHeader>
                <CardTitle>💡 Evaluation Tips</CardTitle>
                <CardDescription>
                  Best practices for model evaluation
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-sm">
                  <div className="flex items-start space-x-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                    <p>Use a diverse test dataset that represents real-world scenarios</p>
                  </div>
                  <div className="flex items-start space-x-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                    <p>Start with smaller batch sizes if you encounter memory issues</p>
                  </div>
                  <div className="flex items-start space-x-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                    <p>Lower temperature values (0.1-0.3) for more consistent outputs</p>
                  </div>
                  <div className="flex items-start space-x-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                    <p>Monitor evaluation progress and check for any errors or warnings</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Footer with navigation buttons */}
          <Card className="mt-6">
            <CardFooter className="p-6">
              <div className="w-full flex justify-between">
                <Button
                  variant="outline"
                  size="lg"
                  leftIcon={<ArrowLeft className="h-5 w-5" />}
                  onClick={handleBack}
                  className="px-8"
                >
                  Back to Data Upload
                </Button>
                <Button
                  variant="primary"
                  size="lg"
                  rightIcon={<ArrowRight className="h-5 w-5" />}
                  disabled={!state.selectedModel || !state.fileContent || !state.mapping || isStartingEvaluation}
                  onClick={handleStartEvaluation}
                  isLoading={isStartingEvaluation}
                  className="px-8"
                >
                  {isStartingEvaluation ? 'Starting Evaluation...' : 'Start Evaluation'}
                </Button>
              </div>
            </CardFooter>
          </Card>
        </div>
      </div>

      {/* JSON Editor Modal */}
      <JsonEditorModal
        isOpen={isJsonEditorModalOpen}
        onClose={() => setIsJsonEditorModalOpen(false)}
        title="Evaluation Configuration Editor"
        description="Edit evaluation parameters in JSON format"
        currentConfig={getCurrentConfig()}
        onApply={handleJsonEditorApply}
        placeholder="Paste your evaluation configuration JSON here..."
      />
    </div>
  );
}
