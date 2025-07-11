import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Search, AlertCircle, Loader2 } from 'lucide-react';
import { chatApi, Model } from '../../services/chatApi';
import { AnimatedLoader } from '../../components/ui/AnimatedLoader';
import { useConfigureContext } from './ConfigureContext';
import { StepNavigation } from '../../components/ui/StepProgress';
import { ModelWarning } from '../../components/ui/ModelWarning';
import { isInstructionModel, getNonInstructWarningMessage, getInstructModelRecommendations } from '../../utils/modelUtils';

export default function SelectModel() {
  const navigate = useNavigate();
  const { state, dispatch, completeCurrentStep } = useConfigureContext();
  const { selectedBaseModel, activeModelTab } = state;

  // Local state for model management
  const [availableModels, setAvailableModels] = useState<Model[]>([]);
  const [huggingFaceModels, setHuggingFaceModels] = useState<Model[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Model[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingModels, setIsLoadingModels] = useState(true);
  const [isLoadingHFModels, setIsLoadingHFModels] = useState(false);
  const [modelError, setModelError] = useState<string | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Warning state for non-instruct models
  const [showWarning, setShowWarning] = useState(false);
  const [warningAcknowledged, setWarningAcknowledged] = useState(false);

  // Get current models list based on active tab
  const currentModels = activeModelTab === 'finetuned' ? availableModels : huggingFaceModels;

  // Load available fine-tuned models
  const loadFineTunedModels = async () => {
    try {
      setIsLoadingModels(true);
      setModelError(null);
      const models = await chatApi.fetchAvailableModels();
      setAvailableModels(models);
    } catch (error: any) {
      console.error('Failed to load fine-tuned models:', error);
      setModelError(error.message || 'Failed to load fine-tuned models');
    } finally {
      setIsLoadingModels(false);
    }
  };

  // Load Hugging Face models
  const loadHuggingFaceModels = async () => {
    try {
      setIsLoadingHFModels(true);
      setModelError(null);
      const models = await chatApi.fetchHuggingFaceModels();
      setHuggingFaceModels(models);
      
      // Set default selected model if none selected
      if (!selectedBaseModel && models.length > 0) {
        dispatch({ type: 'SET_SELECTED_MODEL', payload: models[0] });
      }
    } catch (error: any) {
      console.error('Failed to load Hugging Face models:', error);
      setModelError(error.message || 'Failed to load Hugging Face models');
    } finally {
      setIsLoadingHFModels(false);
    }
  };

  // Handle search for Hugging Face models
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    try {
      setIsSearching(true);
      setSearchError(null);
      const results = await chatApi.searchHuggingFaceModels(searchQuery.trim());
      setSearchResults(results);
      setHuggingFaceModels(results);
      
      // Set default selected model from search results
      if (results.length > 0) {
        dispatch({ type: 'SET_SELECTED_MODEL', payload: results[0] });
      }
    } catch (error: any) {
      console.error('Failed to search Hugging Face models:', error);
      setSearchError(error.message || 'Search failed. Please try again.');
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // Clear search and return to default models
  const handleClearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    setSearchError(null);
    loadHuggingFaceModels();
  };

  // Handle chip click to search for model family
  const handleChipClick = (modelFamily: string) => {
    setSearchQuery(modelFamily);
    // Automatically trigger search
    setTimeout(() => {
      handleSearchWithQuery(modelFamily);
    }, 100);
  };

  // Handle search with specific query
  const handleSearchWithQuery = async (query: string) => {
    if (!query.trim()) return;
    
    try {
      setIsSearching(true);
      setSearchError(null);
      const results = await chatApi.searchHuggingFaceModels(query.trim());
      setSearchResults(results);
      setHuggingFaceModels(results);
      
      // Set default selected model from search results
      if (results.length > 0) {
        dispatch({ type: 'SET_SELECTED_MODEL', payload: results[0] });
      }
    } catch (error: any) {
      console.error('Failed to search Hugging Face models:', error);
      setSearchError(error.message || 'Search failed. Please try again.');
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // Popular model families for quick search with company logos
  const modelFamilyChips = [
    { name: 'Phi', logo: 'https://img.shields.io/badge/Microsoft-0078D4?style=flat&logo=microsoft&logoColor=white', description: 'Microsoft Phi models' },
    { name: 'Qwen', logo: 'https://img.shields.io/badge/Qwen-FF6A00?style=flat&logo=alibaba&logoColor=white', description: 'Alibaba Qwen models' },
    { name: 'Mistral', logo: 'https://img.shields.io/badge/Mistral-FF7000?style=flat&logo=data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTEyIDJMMTMuMDkgOC4yNkwyMCA5TDEzLjA5IDE1Ljc0TDEyIDIyTDEwLjkxIDE1Ljc0TDQgOUwxMC45MSA4LjI2TDEyIDJaIiBmaWxsPSJ3aGl0ZSIvPgo8L3N2Zz4K&logoColor=white', description: 'Mistral AI models' },
    { name: 'Gemma', logo: 'https://img.shields.io/badge/Google-4285F4?style=flat&logo=google&logoColor=white', description: 'Google Gemma models' },
    { name: 'DeepSeek', logo: 'https://img.shields.io/badge/DeepSeek-000000?style=flat&logo=data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMTIiIGN5PSIxMiIgcj0iMTAiIGZpbGw9IndoaXRlIi8+CjxjaXJjbGUgY3g9IjEyIiBjeT0iMTIiIHI9IjMiIGZpbGw9ImJsYWNrIi8+Cjwvc3ZnPgo=&logoColor=white', description: 'DeepSeek models' },
    { name: 'Llama', logo: 'https://img.shields.io/badge/Meta-1877F2?style=flat&logo=meta&logoColor=white', description: 'Meta Llama models' },
    { name: 'CodeLlama', logo: 'https://img.shields.io/badge/Meta-1877F2?style=flat&logo=meta&logoColor=white', description: 'Meta CodeLlama models' },
    { name: 'Falcon', logo: 'https://img.shields.io/badge/TII-2E8B57?style=flat&logo=data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTEyIDJMMTggN0wxNSAxMkwxOCAxN0wxMiAyMkw2IDE3TDkgMTJMNiA3TDEyIDJaIiBmaWxsPSJ3aGl0ZSIvPgo8L3N2Zz4K&logoColor=white', description: 'TII Falcon models' },
  ];

  // Handle tab change
  const handleModelTabChange = (tab: 'finetuned' | 'huggingface') => {
    dispatch({ type: 'SET_ACTIVE_MODEL_TAB', payload: tab });
    dispatch({ type: 'SET_SELECTED_MODEL', payload: null });
    setModelError(null);
    setSearchError(null);
    
    if (tab === 'huggingface' && huggingFaceModels.length === 0) {
      loadHuggingFaceModels();
    } else if (tab === 'finetuned' && availableModels.length === 0) {
      loadFineTunedModels();
    }
    
    // Set default selected model for the tab
    const models = tab === 'finetuned' ? availableModels : huggingFaceModels;
    if (models.length > 0) {
      dispatch({ type: 'SET_SELECTED_MODEL', payload: models[0] });
    }
  };

  // Handle model selection
  const handleModelSelection = (modelId: string) => {
    const model = currentModels.find(m => m.id === modelId);
    if (model) {
      dispatch({ type: 'SET_SELECTED_MODEL', payload: model });
      // Reset warning state when selecting a new model
      setWarningAcknowledged(false);
    }
  };

  // Handle next step
  const handleNext = () => {
    if (selectedBaseModel) {
      completeCurrentStep();
      navigate('/configure/data');
    }
  };

  // Load models on component mount
  useEffect(() => {
    loadHuggingFaceModels(); // Start with HF models as default
  }, []);

  // Check for non-instruct models and show warning
  useEffect(() => {
    if (selectedBaseModel && !warningAcknowledged) {
      const modelName = selectedBaseModel.name || '';
      const modelId = selectedBaseModel.hf_model_id || selectedBaseModel.id || '';
      
      // Only check Hugging Face models for instruction tuning
      if (activeModelTab === 'huggingface') {
        const isInstruct = isInstructionModel(modelName, modelId);
        setShowWarning(!isInstruct);
      } else {
        // Fine-tuned models are assumed to be instruction-tuned
        setShowWarning(false);
      }
    } else {
      setShowWarning(false);
    }
  }, [selectedBaseModel, warningAcknowledged, activeModelTab]);

  // Warning handlers
  const handleWarningAcknowledge = () => {
    setWarningAcknowledged(true);
    setShowWarning(false);
  };

  const handleWarningDismiss = () => {
    setShowWarning(false);
    // Clear the selected model to force user to select a different one
    dispatch({ type: 'SET_SELECTED_MODEL', payload: null });
    setWarningAcknowledged(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Choose Your Base Model</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Select the foundation model that will be fine-tuned with your data
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Model Selection</CardTitle>
              <CardDescription>
                Choose from pre-trained Hugging Face models or your existing fine-tuned models
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
          {/* Tab Interface */}
          <div className="flex space-x-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
            <button
              onClick={() => handleModelTabChange('huggingface')}
              className={`flex-1 px-4 py-3 text-sm font-medium rounded-md transition-colors ${
                activeModelTab === 'huggingface'
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
              }`}
            >
              🤗 Hugging Face Models
            </button>
            <button
              onClick={() => handleModelTabChange('finetuned')}
              className={`flex-1 px-4 py-3 text-sm font-medium rounded-md transition-colors ${
                activeModelTab === 'finetuned'
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
              }`}
            >
              My Fine-tuned Models
            </button>
          </div>

          {/* Search Interface for Hugging Face Tab */}
          {activeModelTab === 'huggingface' && (
            <div className="space-y-3">
              <label className="block text-sm font-medium">
                🔍 Search Models
              </label>
              
              {/* Model Family Quick Search Chips */}
              <div className="space-y-2">
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Quick Search:
                </div>
                <div className="flex flex-wrap gap-2">
                  {modelFamilyChips.map((chip) => (
                    <button
                      key={chip.name}
                      onClick={() => handleChipClick(chip.name)}
                      disabled={isSearching}
                      className={`inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-full border transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed ${
                        searchQuery.toLowerCase() === chip.name.toLowerCase()
                          ? 'bg-primary-100 dark:bg-primary-900/30 border-primary-300 dark:border-primary-700 text-primary-700 dark:text-primary-300'
                          : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                      }`}
                      title={chip.description}
                    >
                      <img 
                        src={chip.logo} 
                        alt={`${chip.name} logo`}
                        className="h-4 w-auto"
                        onError={(e) => {
                          // Fallback to text if image fails to load
                          e.currentTarget.style.display = 'none';
                          e.currentTarget.nextElementSibling!.textContent = chip.name;
                        }}
                      />
                      <span>{chip.name}</span>
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="flex space-x-3">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleSearch();
                      }
                    }}
                    placeholder="Search for models (e.g., llama, microsoft, phi)..."
                    className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    disabled={isSearching}
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSearch}
                  disabled={isSearching || !searchQuery.trim()}
                  leftIcon={isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                >
                  Search
                </Button>
                {searchResults.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClearSearch}
                  >
                    Clear
                  </Button>
                )}
              </div>
              
              {/* Search Error */}
              {searchError && (
                <div className="flex items-center text-sm text-red-600">
                  <AlertCircle className="h-4 w-4 mr-2" />
                  {searchError}
                </div>
              )}
              
              {/* Search Results Info */}
              {searchResults.length > 0 && (
                <div className="text-xs text-gray-500">
                  Found {searchResults.length} verified models for "{searchQuery}"
                </div>
              )}
            </div>
          )}

          {/* Loading and Error States */}
          {(activeModelTab === 'finetuned' ? isLoadingModels : isLoadingHFModels) ? (
            <div className="flex items-center justify-center py-12">
              <AnimatedLoader 
                variant="brain" 
                size="md" 
                text={`Loading ${activeModelTab === 'finetuned' ? 'fine-tuned' : 'Hugging Face'} models...`} 
              />
            </div>
          ) : modelError ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <div className="flex items-center">
                <AlertCircle className="h-6 w-6 text-red-500" />
                <span className="ml-2 text-sm text-red-600">{modelError}</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={activeModelTab === 'finetuned' ? loadFineTunedModels : loadHuggingFaceModels}
                disabled={activeModelTab === 'finetuned' ? isLoadingModels : isLoadingHFModels}
              >
                Try Again
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <label className="block text-sm font-medium">
                Available Models
              </label>
              <select
                value={selectedBaseModel?.id || ''}
                onChange={(e) => handleModelSelection(e.target.value)}
                className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                disabled={currentModels.length === 0}
              >
                <option value="">Select a model...</option>
                {currentModels.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.name}
                    {activeModelTab === 'huggingface' && model.family && ` (${model.family})`}
                  </option>
                ))}
              </select>
              
              {/* Selected Model Info */}
              {selectedBaseModel && (
                <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {selectedBaseModel.name}
                      </h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {selectedBaseModel.description}
                      </p>
                      <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
                        <span>Size: {selectedBaseModel.size}</span>
                        <span>Architecture: {selectedBaseModel.architecture}</span>
                        {activeModelTab === 'huggingface' && selectedBaseModel.family && (
                          <Badge variant="outline" size="sm">{selectedBaseModel.family}</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Non-Instruct Model Warning */}
              {selectedBaseModel && showWarning && (
                <ModelWarning
                  modelName={selectedBaseModel.name}
                  message={getNonInstructWarningMessage(selectedBaseModel.name)}
                  recommendations={getInstructModelRecommendations()}
                  onAcknowledge={handleWarningAcknowledge}
                  onDismiss={handleWarningDismiss}
                  isVisible={showWarning}
                />
              )}
            </div>
          )}
            </CardContent>
          </Card>

          {/* Navigation */}
          <StepNavigation
            currentStep={1}
            totalSteps={3}
            onNext={handleNext}
            canProceed={!!selectedBaseModel && (!showWarning || warningAcknowledged)}
            nextLabel="Next: Upload Data"
          />
        </div>

        <div>
          <Card>
            <CardHeader>
              <CardTitle>Model Selection Guide</CardTitle>
              <CardDescription>
                Tips for choosing the right base model
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium mb-2">Model Types</h4>
                  <ul className="space-y-3 text-sm">
                    <li className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-primary-100 dark:bg-primary-900/20 flex items-center justify-center flex-shrink-0">
                        <span className="text-primary-600 dark:text-primary-400 text-xs">🤗</span>
                      </span>
                      <div>
                        <p className="font-medium">Hugging Face Models</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Pre-trained models from the community
                        </p>
                      </div>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-primary-100 dark:bg-primary-900/20 flex items-center justify-center flex-shrink-0">
                        <span className="text-primary-600 dark:text-primary-400 text-xs">⚡</span>
                      </span>
                      <div>
                        <p className="font-medium">Fine-tuned Models</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Your previously trained models
                        </p>
                      </div>
                    </li>
                  </ul>
                </div>

                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md">
                  <h4 className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
                    💡 Selection Tips
                  </h4>
                  <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-2 pl-4 list-disc">
                    <li>Choose models similar to your use case</li>
                    <li>Consider model size vs. performance trade-offs</li>
                    <li>Check model licensing for your needs</li>
                  </ul>
                </div>

                {selectedBaseModel && (
                  <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-md">
                    <h4 className="text-sm font-medium text-green-900 dark:text-green-100 mb-2">
                      ✅ Selected Model
                    </h4>
                    <p className="text-sm text-green-800 dark:text-green-200">
                      {selectedBaseModel.name}
                    </p>
                    <p className="text-xs text-green-700 dark:text-green-300 mt-1">
                      Size: {selectedBaseModel.size} • Architecture: {selectedBaseModel.architecture}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
