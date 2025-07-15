import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { cn } from '../../utils/cn';
import { Brain, AlertTriangle, ArrowRight, CheckCircle, DownloadCloud, Loader2 } from 'lucide-react';
import { evaluationService } from '../../services/evaluationService';
import { AnimatedLoader } from '../../components/ui/AnimatedLoader';
import { useEvaluateContext } from './EvaluateContext';
import { StepProgress } from '../../components/ui/StepProgress';

// Define Model type for evaluation
interface Model {
  id: string;
  name: string;
  description?: string;
  size?: string;
  family?: string;
  isBase?: boolean;
  input_schema?: Record<string, any>;
  output_schema?: Record<string, any>;
  metadata?: Record<string, any>;
  created_at?: string;
  accuracy?: number;
  status?: string;
  training_session_id?: string;
  model_type?: string;
  version?: string;
  model_path?: string;
  base_model?: string;
}

const steps = [
  { id: 1, title: 'Select Model', description: 'Choose evaluation model' },
  { id: 2, title: 'Upload Data', description: 'Upload test dataset' },
  { id: 3, title: 'Configure Parameters', description: 'Set evaluation parameters' },
  { id: 4, title: 'Evaluation Progress', description: 'Monitor evaluation' },
];

export default function SelectModel() {
  const navigate = useNavigate();
  const { state, dispatch } = useEvaluateContext();
  
  // Local state for model loading
  const [availableModels, setAvailableModels] = useState<Model[]>([]);
  const [huggingFaceModels, setHuggingFaceModels] = useState<Model[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(true);
  const [isLoadingHFModels, setIsLoadingHFModels] = useState(true);
  const [modelError, setModelError] = useState<string | null>(null);
  const [hfModelError, setHFModelError] = useState<string | null>(null);

  // Get current models list based on active tab
  const currentModels = state.activeTab === 'finetuned' ? availableModels : huggingFaceModels;

  // Load available models function
  const loadModels = async () => {
    try {
      setIsLoadingModels(true);
      setModelError(null);
      const models = await evaluationService.getAvailableModels();
      
      // Transform models to match our interface
      const transformedModels = models.map(model => ({
        id: model.model_id,  // Use model_id as id
        name: model.name,
        description: model.description,
        input_schema: model.input_schema,
        output_schema: model.output_schema,
        metadata: model.metadata,
        // Add other fields from the API response
        created_at: model.created_at,
        accuracy: model.accuracy,
        status: model.status,
        training_session_id: model.training_session_id,
        model_type: model.model_type,
        version: model.version,
        model_path: model.model_path,
        base_model: model.base_model
      }));
      
      setAvailableModels(transformedModels);
      
      // Set default selected models
      if (transformedModels.length > 0 && !state.selectedModel) {
        dispatch({ type: 'SET_SELECTED_MODEL', payload: transformedModels[0] });
      }
    } catch (error: any) {
      console.error('Failed to load models:', error);
      setModelError(error.message || 'Failed to load available models. Please try again.');
    } finally {
      setIsLoadingModels(false);
    }
  };

  // Load Hugging Face models function - for now, use same models as finetuned
  const loadHuggingFaceModels = async () => {
    try {
      setIsLoadingHFModels(true);
      setHFModelError(null);
      const models = await evaluationService.getAvailableModels();
      setHuggingFaceModels(models);
      
      if (state.activeTab === 'huggingface' && models.length > 0) {
        dispatch({ type: 'SET_SELECTED_MODEL', payload: models[0] });
      }
    } catch (error: any) {
      console.error('Failed to load Hugging Face models:', error);
      setHFModelError(error.message || 'Failed to load Hugging Face models. Please try again.');
    } finally {
      setIsLoadingHFModels(false);
    }
  };

  // Handle tab change
  const handleTabChange = (tab: 'finetuned' | 'huggingface') => {
    dispatch({ type: 'SET_ACTIVE_TAB', payload: tab });
    dispatch({ type: 'SET_SELECTED_MODEL', payload: null });
    
    // Load models for the selected tab if not already loaded
    if (tab === 'huggingface' && huggingFaceModels.length === 0) {
      loadHuggingFaceModels();
    }
    
    // Set default selected model for the tab
    const models = tab === 'finetuned' ? availableModels : huggingFaceModels;
    if (models.length > 0) {
      dispatch({ type: 'SET_SELECTED_MODEL', payload: models[0] });
    }
  };

  // Handle model selection change
  const handleModelSelection = (model: Model) => {
    dispatch({ type: 'SET_SELECTED_MODEL', payload: model });
  };

  // Handle continue to next step
  const handleContinue = () => {
    navigate('/evaluate/data');
  };

  // Load available models on component mount
  useEffect(() => {
    loadModels();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Evaluate Model</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Select a model to evaluate its performance on test data
        </p>
      </div>


      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Select Models</CardTitle>
              <CardDescription>
                Choose which models to evaluate
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Tab Interface */}
              <div className="flex space-x-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
                <button
                  onClick={() => handleTabChange('finetuned')}
                  className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                    state.activeTab === 'finetuned'
                      ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                  }`}
                >
                  Fine-tuned Models
                </button>
                <button
                  onClick={() => handleTabChange('huggingface')}
                  className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                    state.activeTab === 'huggingface'
                      ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                  }`}
                >
                  🤗 Hugging Face
                </button>
              </div>

              {/* Loading and Error States */}
              {(state.activeTab === 'finetuned' ? isLoadingModels : isLoadingHFModels) ? (
                <div className="flex items-center justify-center py-8">
                  <AnimatedLoader variant="brain" size="md" text={`Loading ${state.activeTab === 'finetuned' ? 'fine-tuned' : 'Hugging Face'} models...`} />
                </div>
              ) : (state.activeTab === 'finetuned' ? modelError : hfModelError) ? (
                <div className="flex flex-col items-center justify-center py-8 space-y-3">
                  <div className="flex items-center">
                    <AlertTriangle className="h-6 w-6 text-red-500" />
                    <span className="ml-2 text-sm text-red-600">{state.activeTab === 'finetuned' ? modelError : hfModelError}</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={state.activeTab === 'finetuned' ? loadModels : loadHuggingFaceModels}
                    disabled={state.activeTab === 'finetuned' ? isLoadingModels : isLoadingHFModels}
                  >
                    Try Again
                  </Button>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Primary Model
                  </label>
                  <select
                    value={state.selectedModel?.id || ''}
                    onChange={(e) => {
                      const model = currentModels.find(m => m.id === e.target.value);
                      if (model) handleModelSelection(model);
                    }}
                    className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    disabled={currentModels.length === 0}
                  >
                    {currentModels.length === 0 ? (
                      <option value="">No models available</option>
                    ) : (
                      currentModels.map((model) => (
                        <option key={model.id} value={model.id}>
                          {model.name}
                        </option>
                      ))
                    )}
                  </select>
                </div>
              )}
            </CardContent>
            <CardFooter className="border-t flex-col space-y-3 items-start">
              {state.selectedModel ? (
                <div className="w-full space-y-4">
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    <p className="font-medium mb-2">Model Details</p>
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                        <div>Type: <span className="text-gray-700 dark:text-gray-300">Fine-tuned</span></div>
                        <div>Status: <span className="text-green-600 dark:text-green-400">{state.selectedModel.status || 'Ready'}</span></div>
                      </div>
                      {state.selectedModel.accuracy && (
                        <div className="mt-2 p-2 bg-green-50 dark:bg-green-900/20 rounded">
                          <div className="text-green-800 dark:text-green-200 font-medium">
                            Accuracy: {(state.selectedModel.accuracy * 100).toFixed(1)}%
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    <p className="font-medium mb-2">Input Schema</p>
                    <div className="bg-gray-50 dark:bg-gray-800 p-2 rounded text-xs">
                      {state.selectedModel.input_schema ? (
                        Object.entries(state.selectedModel.input_schema).map(([key, type]) => (
                          <div key={key} className="flex justify-between">
                            <span className="text-gray-700 dark:text-gray-300">{key}:</span>
                            <span className="text-blue-600 dark:text-blue-400">{type as string}</span>
                          </div>
                        ))
                      ) : (
                        <span className="text-gray-500">No schema available</span>
                      )}
                    </div>
                  </div>

                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    <p className="font-medium mb-2">Output Schema</p>
                    <div className="bg-gray-50 dark:bg-gray-800 p-2 rounded text-xs">
                      {state.selectedModel.output_schema ? (
                        Object.entries(state.selectedModel.output_schema).map(([key, type]) => (
                          <div key={key} className="flex justify-between">
                            <span className="text-gray-700 dark:text-gray-300">{key}:</span>
                            <span className="text-green-600 dark:text-green-400">{type as string}</span>
                          </div>
                        ))
                      ) : (
                        <span className="text-gray-500">No schema available</span>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  <p>Select a model to view details</p>
                </div>
              )}
              
              <Button
                variant="outline"
                size="sm"
                leftIcon={<DownloadCloud className="h-4 w-4" />}
                className="w-full"
                disabled
              >
                Download Model
              </Button>
            </CardFooter>
          </Card>
        </div>
        
        <div className="lg:col-span-3 h-full flex flex-col">
          <Card className="flex-1 flex flex-col h-full min-h-[600px]">
            <CardHeader className="border-b flex-shrink-0">
              <div className="flex items-center space-x-3">
                <Brain className="h-5 w-5 text-primary-500" />
                <div>
                  <CardTitle>Model Selection</CardTitle>
                  <CardDescription>
                    Choose the model you want to evaluate
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex-1 p-6">
              <div className="space-y-6">
                {state.selectedModel ? (
                  <div className="p-6 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                    <div className="flex items-start gap-3">
                      <CheckCircle className="h-6 w-6 text-green-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-lg font-medium text-green-800 dark:text-green-200">
                          {state.selectedModel.name}
                        </p>
                        <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                          Model selected successfully. Ready to proceed with data upload.
                        </p>
                        {state.selectedModel.description && (
                          <p className="text-sm text-green-600 dark:text-green-400 mt-2">
                            {state.selectedModel.description}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Brain className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                      Select a Model
                    </h3>
                    <p className="text-gray-500 dark:text-gray-400">
                      Choose a model from the sidebar to begin the evaluation process
                    </p>
                  </div>
                )}

                {/* Model Requirements */}
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
                    💡 Model Selection Guidelines
                  </h4>
                  <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
                    <li>• Fine-tuned models provide better domain-specific performance</li>
                    <li>• Ensure the model has proper input/output schemas defined</li>
                    <li>• Check model compatibility with your test data format</li>
                    <li>• Consider model size and inference speed for your use case</li>
                  </ul>
                </div>
              </div>
            </CardContent>
            <CardFooter className="border-t p-6">
              <div className="w-full flex justify-end">
                <Button
                  variant="primary"
                  size="lg"
                  rightIcon={<ArrowRight className="h-5 w-5" />}
                  disabled={!state.selectedModel}
                  onClick={handleContinue}
                  className="px-8"
                >
                  Continue to Data Upload
                </Button>
              </div>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}
