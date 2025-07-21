import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Progress } from '../components/ui/Progress';
import { AnimatedLoader } from '../components/ui/AnimatedLoader';
import { API_BASE_URL_WITH_API } from '../config/api';
import { Server, RefreshCw, Play, XCircle, Pause, Terminal } from 'lucide-react';
import { DeployModelsGrid, DeployModelInfo } from '../components/deployment/DeployModelsGrid';
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
  const [availableModels, setAvailableModels] = useState<DeployModelInfo[]>([]);
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
      
      // Convert to DeployModelInfo format
      const localModelInfos: DeployModelInfo[] = localData.models.map((model: any) => ({
        id: model.path || model.id,
        name: model.name,
        description: model.description || `Local model at ${model.path}`,
        size: model.size || 'Unknown',
        architecture: model.architecture || 'Custom',
        creationDate: model.created_at,
        isBase: false,
        path: model.path
      }));
      
      const hfModelInfos: DeployModelInfo[] = hfData.models.map((model: any) => ({
        id: model.id,
        name: model.name,
        description: model.description || model.name,
        size: model.size || 'Unknown',
        architecture: model.architecture || 'HuggingFace',
        isBase: true,
        path: model.hf_model_id
      }));
      
      // Combine models
      const combinedModels = [...localModelInfos, ...hfModelInfos];
      setAvailableModels(combinedModels);
      
      // Set default model if none selected
      if (!selectedModel && combinedModels.length > 0) {
        setSelectedModel(combinedModels[0].path);
        setSelectedModelId(combinedModels[0].id);
      }
    } catch (error) {
      console.error('Failed to fetch models:', error);
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
          config: deploymentConfig
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

      {/* Deploy New Model */}
      <Card>
        <CardHeader>
          <CardTitle>Deploy New Model</CardTitle>
          <CardDescription>
            Select a model and configure deployment settings
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">
                Select Model
              </h3>
              
              <DeployModelsGrid 
                models={availableModels}
                onSelectModel={(model) => {
                  setSelectedModel(model.path);
                  setSelectedModelId(model.id);
                }}
                selectedModelId={selectedModelId}
              />
              
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Custom Model Path (optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g., microsoft/phi-3-mini-4k-instruct"
                  value={selectedModel}
                  onChange={(e) => {
                    setSelectedModel(e.target.value);
                    setSelectedModelId('');
                  }}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Enter a HuggingFace model ID or local path
                </p>
              </div>
            </div>
            
            <div>
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Deployment Configuration
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    GPU Memory Utilization (0.1-1.0)
                  </label>
                  <input
                    type="number"
                    min="0.1"
                    max="1.0"
                    step="0.1"
                    value={deploymentConfig.gpu_memory_utilization}
                    onChange={(e) => setDeploymentConfig({
                      ...deploymentConfig,
                      gpu_memory_utilization: parseFloat(e.target.value)
                    })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                
                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    Max Model Length
                  </label>
                  <input
                    type="number"
                    min="512"
                    step="512"
                    value={deploymentConfig.max_model_len}
                    onChange={(e) => setDeploymentConfig({
                      ...deploymentConfig,
                      max_model_len: parseInt(e.target.value)
                    })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                
                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    Tensor Parallel Size
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={deploymentConfig.tensor_parallel_size}
                    onChange={(e) => setDeploymentConfig({
                      ...deploymentConfig,
                      tensor_parallel_size: parseInt(e.target.value)
                    })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                
                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    Data Type
                  </label>
                  <select
                    value={deploymentConfig.dtype}
                    onChange={(e) => setDeploymentConfig({
                      ...deploymentConfig,
                      dtype: e.target.value
                    })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="auto">auto</option>
                    <option value="half">half (fp16)</option>
                    <option value="float16">float16</option>
                    <option value="bfloat16">bfloat16</option>
                    <option value="float">float (fp32)</option>
                  </select>
                </div>
                
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="trust_remote_code"
                    checked={deploymentConfig.trust_remote_code}
                    onChange={(e) => setDeploymentConfig({
                      ...deploymentConfig,
                      trust_remote_code: e.target.checked
                    })}
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  />
                  <label htmlFor="trust_remote_code" className="ml-2 block text-xs text-gray-500">
                    Trust Remote Code
                  </label>
                </div>
              </div>
            </div>
          </div>
          
          <div className="mt-6 flex justify-end">
            <Button
              variant="primary"
              onClick={deployModel}
              disabled={isDeploying || !selectedModel}
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
