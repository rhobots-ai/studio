import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Progress } from '../components/ui/Progress';
import { AnimatedLoader } from '../components/ui/AnimatedLoader';
import { API_BASE_URL_WITH_API } from '../config/api';
import { Server, RefreshCw, Play, XCircle, Pause, Terminal, Settings, Download, ChevronDown, Clock, Search } from 'lucide-react';
import { DeploymentCard } from '../components/deployment/DeploymentCard';
import deploymentService, { DeploymentConfig } from '../services/deploymentService';

interface Deployment {
  deployment_id: string;
  model_path: string;
  status: string;
  endpoint: string;
  created_at: string;
  started_at?: string;
  error_message?: string;
  resource_usage?: {
    cpu_percent: number;
    memory_mb: number;
    status: string;
  };
  config: DeploymentConfig;
}

interface DeploymentStats {
  total_deployments: number;
  running_deployments: number;
  failed_deployments: number;
  stopped_deployments: number;
  available_ports: number;
}

export default function Deploy() {
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [stats, setStats] = useState<DeploymentStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedModel, setSelectedModel] = useState('');
  const [selectedModelId, setSelectedModelId] = useState('');
  const [availableModels, setAvailableModels] = useState<any[]>([]);
  const [modelSource, setModelSource] = useState<'fine-tuned' | 'huggingface'>('fine-tuned');
  const [searchTerm, setSearchTerm] = useState('');
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(256);
  const [systemPrompt, setSystemPrompt] = useState('');
  const [showSystemPrompt, setShowSystemPrompt] = useState(false);
  const [selectedModelInfo, setSelectedModelInfo] = useState<any>(null);
  const [isDeploying, setIsDeploying] = useState(false);
  const [deploymentConfig, setDeploymentConfig] = useState<DeploymentConfig>({
    gpu_memory_utilization: 0.8,
    max_model_len: 4096,
    tensor_parallel_size: 1,
    dtype: 'auto',
    trust_remote_code: false,
    enforce_eager: false,
    disable_log_stats: true
  });
  const [testMessage, setTestMessage] = useState('Hello, how are you?');
  const [testingDeploymentId, setTestingDeploymentId] = useState<string | null>(null);
  const [testResponse, setTestResponse] = useState<string | null>(null);
  const [testLatency, setTestLatency] = useState<number | null>(null);
  const [refreshInterval, setRefreshInterval] = useState<number>(10000); // 10 seconds
  const [showCurlExamples, setShowCurlExamples] = useState<string | null>(null);

  // Fetch deployments and stats
  const fetchDeployments = async () => {
    try {
      const response = await fetch(`${API_BASE_URL_WITH_API}/deploy`);
      if (response.ok) {
        const data = await response.json();
        setDeployments(data.deployments);
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Failed to fetch deployments:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch available models
  const fetchAvailableModels = async () => {
    try {
      // Fetch local trained models
      const localResponse = await fetch(`${API_BASE_URL_WITH_API}/models/available`);
      const localData = await localResponse.json();
      
      // Fetch HuggingFace models
      const hfResponse = await fetch(`${API_BASE_URL_WITH_API}/models/huggingface`);
      const hfData = await hfResponse.json();
      
      // Process models
      const localModelInfos = localData.models.map((model: any) => ({
        ...model,
        id: model.path || model.id,
        name: model.name,
        description: model.description || `Local model at ${model.path}`,
        size: model.size || 'Unknown',
        architecture: model.architecture || 'Custom',
        creationDate: model.created_at,
        type: 'fine-tuned',
        path: model.path
      }));
      
      const hfModelInfos = hfData.models.map((model: any) => ({
        ...model,
        id: model.id,
        name: model.name,
        description: model.description || model.name,
        size: model.size || 'Unknown',
        architecture: model.architecture || 'HuggingFace',
        type: 'huggingface',
        path: model.hf_model_id
      }));
      
      // Combine models
      const combinedModels = [...localModelInfos, ...hfModelInfos];
      setAvailableModels(combinedModels);
      
      // Set default model if none selected
      if (!selectedModel && localModelInfos.length > 0) {
        setSelectedModel(localModelInfos[0].path);
        setSelectedModelId(localModelInfos[0].id);
        setSelectedModelInfo(localModelInfos[0]);
      }
    } catch (error) {
      console.error('Failed to fetch models:', error);
    }
  };

  // Load a model
  const loadModel = () => {
    if (!selectedModel) {
      alert('Please select a model to load');
      return;
    }
    
    // Find the selected model info
    const modelInfo = availableModels.find(model => model.path === selectedModel);
    if (modelInfo) {
      setSelectedModelInfo(modelInfo);
    }
  };
  
  // Deploy a model
  const deployModel = async () => {
    if (!selectedModel) {
      alert('Please select a model to deploy');
      return;
    }
    
    setIsDeploying(true);
    
    try {
      const response = await fetch(`${API_BASE_URL_WITH_API}/deploy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model_path: selectedModel,
          config: {
            ...deploymentConfig,
            temperature: temperature,
            max_tokens: maxTokens,
            system_prompt: systemPrompt
          }
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('Deployment started:', data);
        fetchDeployments();
      } else {
        const error = await response.json();
        alert(`Deployment failed: ${error.detail || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error deploying model:', error);
      alert('Failed to deploy model. See console for details.');
    } finally {
      setIsDeploying(false);
    }
  };

  // Stop a deployment
  const stopDeployment = async (deploymentId: string) => {
    try {
      const response = await fetch(`${API_BASE_URL_WITH_API}/deploy/${deploymentId}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        fetchDeployments();
      } else {
        const error = await response.json();
        alert(`Failed to stop deployment: ${error.detail || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error stopping deployment:', error);
    }
  };

  // Delete a deployment
  const deleteDeployment = async (deploymentId: string) => {
    try {
      const response = await fetch(`${API_BASE_URL_WITH_API}/deploy/${deploymentId}/delete`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        fetchDeployments();
      } else {
        const error = await response.json();
        alert(`Failed to delete deployment: ${error.detail || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error deleting deployment:', error);
    }
  };

  // Test a deployment
  const testDeployment = async (deploymentId: string) => {
    setTestingDeploymentId(deploymentId);
    setTestResponse(null);
    setTestLatency(null);
    
    try {
      const response = await fetch(`${API_BASE_URL_WITH_API}/deploy/${deploymentId}/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: testMessage,
          max_tokens: 100,
          temperature: 0.7
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        setTestResponse(data.response);
        setTestLatency(data.latency_ms);
      } else {
        const error = await response.json();
        setTestResponse(`Error: ${error.detail || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error testing deployment:', error);
      setTestResponse('Failed to test deployment. See console for details.');
    } finally {
      // Keep the testing deployment ID to show the response
    }
  };

  // Get curl examples for a deployment
  const getCurlExamples = async (deploymentId: string) => {
    try {
      const response = await fetch(`${API_BASE_URL_WITH_API}/deploy/${deploymentId}/curl`);
      
      if (response.ok) {
        const data = await response.json();
        setShowCurlExamples(deploymentId);
        // The examples are in data.examples
      } else {
        const error = await response.json();
        alert(`Failed to get curl examples: ${error.detail || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error getting curl examples:', error);
    }
  };

  // Copy endpoint URL to clipboard
  const copyEndpoint = (endpoint: string) => {
    navigator.clipboard.writeText(endpoint);
    alert('Endpoint URL copied to clipboard!');
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };


  // Initial data fetch
  useEffect(() => {
    fetchDeployments();
    fetchAvailableModels();
  }, []);

  // Set up polling for updates
  useEffect(() => {
    const interval = setInterval(() => {
      fetchDeployments();
    }, refreshInterval);
    
    return () => clearInterval(interval);
  }, [refreshInterval]);

  return (
    <div className="space-y-8 p-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Model Deployment</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Deploy models with vLLM and serve them with OpenAI-compatible endpoints
          </p>
        </div>
        <Button 
          onClick={() => fetchDeployments()}
          leftIcon={<RefreshCw className="h-4 w-4" />}
          variant="outline"
        >
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card variant="outline">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    Total Deployments
                  </p>
                  <h3 className="text-2xl font-bold mt-1">
                    {isLoading ? <AnimatedLoader variant="pulse" size="sm" /> : stats.total_deployments}
                  </h3>
                </div>
                <div className="p-3 rounded-full bg-primary-100 dark:bg-primary-900/20">
                  <Server className="h-5 w-5 text-primary-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card variant="outline">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    Running
                  </p>
                  <h3 className="text-2xl font-bold mt-1">
                    {isLoading ? <AnimatedLoader variant="pulse" size="sm" /> : stats.running_deployments}
                  </h3>
                </div>
                <div className="p-3 rounded-full bg-success-100 dark:bg-success-900/20">
                  <Play className="h-5 w-5 text-success-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card variant="outline">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    Failed
                  </p>
                  <h3 className="text-2xl font-bold mt-1">
                    {isLoading ? <AnimatedLoader variant="pulse" size="sm" /> : stats.failed_deployments}
                  </h3>
                </div>
                <div className="p-3 rounded-full bg-error-100 dark:bg-error-900/20">
                  <XCircle className="h-5 w-5 text-error-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card variant="outline">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    Stopped
                  </p>
                  <h3 className="text-2xl font-bold mt-1">
                    {isLoading ? <AnimatedLoader variant="pulse" size="sm" /> : stats.stopped_deployments}
                  </h3>
                </div>
                <div className="p-3 rounded-full bg-secondary-100 dark:bg-secondary-900/20">
                  <Pause className="h-5 w-5 text-secondary-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card variant="outline">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    Available Ports
                  </p>
                  <h3 className="text-2xl font-bold mt-1">
                    {isLoading ? <AnimatedLoader variant="pulse" size="sm" /> : stats.available_ports}
                  </h3>
                </div>
                <div className="p-3 rounded-full bg-warning-100 dark:bg-warning-900/20">
                  <Terminal className="h-5 w-5 text-warning-500" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Deploy New Model Card */}
      <Card className="max-w-md shadow-md">
        <CardHeader className="pb-3">
          <CardTitle className="text-xl">Deploy New Model</CardTitle>
          <CardDescription>
            Select a model and configure deployment settings
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="mb-6">
            <div className="flex w-full rounded-md overflow-hidden border border-gray-200 dark:border-gray-700 mb-6">
              <button 
                className={`flex-1 py-2 px-4 text-center text-sm font-medium ${modelSource === 'fine-tuned' ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300' : 'bg-white dark:bg-gray-800'}`}
                onClick={() => setModelSource('fine-tuned')}
              >
                Fine-tuned Models
              </button>
              <button 
                className={`flex-1 py-2 px-4 text-center text-sm font-medium ${modelSource === 'huggingface' ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300' : 'bg-white dark:bg-gray-800'}`}
                onClick={() => setModelSource('huggingface')}
              >
                🤗 Hugging Face
              </button>
            </div>
            
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-medium mb-2">Primary Model</h3>
                <div className="relative">
                  <select
                    value={selectedModel}
                    onChange={(e) => {
                      setSelectedModel(e.target.value);
                      const model = availableModels.find(m => m.path === e.target.value);
                      if (model) {
                        setSelectedModelId(model.id);
                        setSelectedModelInfo(model);
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 appearance-none"
                  >
                    <option value="">-- Select a model --</option>
                    {availableModels
                      .filter(model => model.type === modelSource)
                      .map(model => (
                        <option key={model.path} value={model.path}>
                          {model.name}
                        </option>
                      ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-2.5 h-4 w-4 text-gray-500 pointer-events-none" />
                </div>
                
                <Button
                  variant="primary"
                  className="w-full mt-4"
                  onClick={loadModel}
                  disabled={!selectedModel}
                >
                  Load Model
                </Button>
                
                <div className="flex items-center gap-2 mt-3 text-xs text-gray-500">
                  <Clock className="h-3.5 w-3.5" />
                  <span>{selectedModelInfo ? 'Model loaded' : 'No model loaded'}</span>
                </div>
              </div>
              
              <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                <h3 className="text-sm font-medium mb-4">Parameters</h3>
                
                <div className="space-y-5">
                  <div>
                    <div className="flex justify-between mb-1.5">
                      <span className="text-xs">Temperature</span>
                      <span className="text-xs font-medium">{temperature.toFixed(1)}</span>
                    </div>
                    <div className="relative">
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.1"
                        value={temperature}
                        onChange={(e) => setTemperature(parseFloat(e.target.value))}
                        className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                      />
                      <div className="flex justify-between text-xs text-gray-500 mt-1">
                        <span>Precise</span>
                        <span>Creative</span>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <div className="flex justify-between mb-1.5">
                      <span className="text-xs">Max Tokens</span>
                      <span className="text-xs font-medium">{maxTokens}</span>
                    </div>
                    <div className="relative">
                      <input
                        type="range"
                        min="16"
                        max="4096"
                        step="16"
                        value={maxTokens}
                        onChange={(e) => setMaxTokens(parseInt(e.target.value))}
                        className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                      />
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                <button 
                  className="flex items-center justify-between w-full text-left text-sm font-medium py-1"
                  onClick={() => setShowSystemPrompt(!showSystemPrompt)}
                >
                  <div className="flex items-center gap-2">
                    <Settings className="h-4 w-4" />
                    <span>System Prompt</span>
                  </div>
                  <ChevronDown className={`h-4 w-4 transition-transform ${showSystemPrompt ? 'rotate-180' : ''}`} />
                </button>
                
                {showSystemPrompt && (
                  <textarea
                    value={systemPrompt}
                    onChange={(e) => setSystemPrompt(e.target.value)}
                    placeholder="Enter a system prompt..."
                    className="w-full mt-2 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500 min-h-[80px]"
                  />
                )}
              </div>
              
              {selectedModelInfo && (
                <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                  <h3 className="text-sm font-medium mb-2">Selected Model Info</h3>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-gray-500">Size:</span> {selectedModelInfo.size}
                    </div>
                    <div>
                      <span className="text-gray-500">Type:</span> {selectedModelInfo.type === 'fine-tuned' ? 'Fine-tuned' : 'Base Model'}
                    </div>
                  </div>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full mt-3"
                    leftIcon={<Download className="h-3.5 w-3.5" />}
                  >
                    Download Model
                  </Button>
                </div>
              )}
              
              <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                <Button
                  variant="primary"
                  className="w-full"
                  onClick={deployModel}
                  disabled={isDeploying || !selectedModelInfo}
                >
                  {isDeploying ? (
                    <>
                      <AnimatedLoader variant="dots" size="sm" />
                      Deploying...
                    </>
                  ) : (
                    <>Deploy Model</>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Active Deployments */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Active Deployments</h2>
        
        {isLoading ? (
          <Card>
            <CardContent className="p-8 text-center">
              <AnimatedLoader variant="dots" size="md" text="Loading deployments..." />
            </CardContent>
          </Card>
        ) : deployments.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Server className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                No active deployments
              </h3>
              <p className="text-gray-500 dark:text-gray-400 mb-4">
                Deploy a model to get started
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {deployments.map((deployment) => (
              <DeploymentCard
                key={deployment.deployment_id}
                deployment={deployment}
                onCopyEndpoint={copyEndpoint}
                onGetCurlExamples={getCurlExamples}
                onTestDeployment={testDeployment}
                onStopDeployment={stopDeployment}
                onDeleteDeployment={deleteDeployment}
                testingDeploymentId={testingDeploymentId}
                testMessage={testMessage}
                onTestMessageChange={setTestMessage}
                testResponse={testResponse}
                testLatency={testLatency}
                showCurlExamples={showCurlExamples}
                onCloseCurlExamples={() => setShowCurlExamples(null)}
                formatDate={formatDate}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
