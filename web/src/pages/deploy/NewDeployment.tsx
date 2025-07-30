import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { AnimatedLoader } from '../../components/ui/AnimatedLoader';
import { API_BASE_URL_WITH_API } from '../../config/api';
import { 
  Server, 
  RefreshCw, 
  Play, 
  XCircle, 
  Pause, 
  Terminal, 
  Rocket,
  Cpu,
  Zap,
  ExternalLink
} from 'lucide-react';
import { DeployModelsGrid } from '../../components/deployment/DeployModelsGrid';
import { DeploymentConfig } from '../../services/deploymentService';
import { motion } from 'framer-motion';

interface DeploymentStats {
  total_deployments: number;
  running_deployments: number;
  failed_deployments: number;
  stopped_deployments: number;
  available_ports: number;
}

interface ModelInfo {
  id: string;
  name: string;
  description: string;
  size: string;
  architecture: string;
  creationDate?: string;
  isBase?: boolean;
  baseModelId?: string;
  path: string;
  type: 'fine-tuned' | 'huggingface';
}

export default function NewDeployment() {
  // State
  const [stats, setStats] = useState<DeploymentStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedModel, setSelectedModel] = useState<ModelInfo | null>(null);
  const [availableModels, setAvailableModels] = useState<ModelInfo[]>([]);
  const [modelSource, setModelSource] = useState<'fine-tuned' | 'huggingface'>('fine-tuned');
  const [isDeploying, setIsDeploying] = useState(false);
  
  // Configuration state
  const [deploymentConfig, setDeploymentConfig] = useState<DeploymentConfig>({
    gpu_memory_utilization: 0.8,
    max_model_len: 4096,
    tensor_parallel_size: 1,
    dtype: 'auto',
    trust_remote_code: false,
    enforce_eager: false,
    disable_log_stats: true
  });
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(256);
  const [systemPrompt, setSystemPrompt] = useState('');

  // Fetch deployment stats
  const fetchStats = async () => {
    try {
      const response = await fetch(`${API_BASE_URL_WITH_API}/deploy`);
      if (response.ok) {
        const data = await response.json();
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Failed to fetch deployment stats:', error);
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
        type: 'fine-tuned' as const,
        path: model.path,
        isBase: false
      }));
      
      const hfModelInfos = hfData.models.map((model: any) => ({
        ...model,
        id: model.id,
        name: model.name,
        description: model.description || model.name,
        size: model.size || 'Unknown',
        architecture: model.architecture || 'HuggingFace',
        type: 'huggingface' as const,
        path: model.hf_model_id,
        isBase: true
      }));
      
      // Combine models
      const combinedModels = [...localModelInfos, ...hfModelInfos];
      setAvailableModels(combinedModels);
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
          model_path: selectedModel.path,
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
        fetchStats();
        // Reset form
        setSelectedModel(null);
        // Show success message
        alert('Model deployment started successfully! Check the Active Deployments page to monitor progress.');
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

  // Initial data fetch
  useEffect(() => {
    fetchStats();
    fetchAvailableModels();
  }, []);

  return (
    <div className="space-y-8 p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Deploy New Model</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Deploy models with vLLM and serve them with OpenAI-compatible endpoints
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/deploy/active">
            <Button 
              leftIcon={<ExternalLink className="h-4 w-4" />}
              variant="outline"
            >
              View Active Deployments
            </Button>
          </Link>
          <Button 
            onClick={() => fetchStats()}
            leftIcon={<RefreshCw className="h-4 w-4" />}
            variant="outline"
          >
            Refresh
          </Button>
        </div>
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

      {/* Deploy New Model Section */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Model Selection */}
        <div className="xl:col-span-2 space-y-6">
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Rocket className="h-6 w-6 text-primary-500" />
                Select Model to Deploy
              </CardTitle>
              <CardDescription>
                Choose from your fine-tuned models or browse HuggingFace models
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex justify-center">
                <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <button 
                    className={`px-6 py-3 text-sm font-medium transition-colors ${
                      modelSource === 'fine-tuned' 
                        ? 'bg-primary-500 text-white' 
                        : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                    onClick={() => setModelSource('fine-tuned')}
                  >
                    Fine-tuned Models
                  </button>
                  <button 
                    className={`px-6 py-3 text-sm font-medium transition-colors ${
                      modelSource === 'huggingface' 
                        ? 'bg-primary-500 text-white' 
                        : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                    onClick={() => setModelSource('huggingface')}
                  >
                    🤗 HuggingFace
                  </button>
                </div>
              </div>

              <DeployModelsGrid
                models={availableModels.filter(model => model.type === modelSource)}
                onSelectModel={(model) => setSelectedModel(model as ModelInfo)}
                selectedModelId={selectedModel?.id}
              />
            </CardContent>
          </Card>
        </div>

        {/* Configuration Panel */}
        <div className="space-y-6">
          {/* Selected Model Info */}
          {selectedModel && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Rocket className="h-5 w-5 text-primary-500" />
                  Selected Model
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold text-lg">{selectedModel.name}</h3>
                    <p className="text-gray-500 dark:text-gray-400 text-sm">
                      {selectedModel.description}
                    </p>
                  </div>
                  
                  <div className="grid grid-cols-1 gap-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500 dark:text-gray-400">Size:</span>
                      <span className="font-medium">{selectedModel.size}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500 dark:text-gray-400">Type:</span>
                      <span className="font-medium">
                        {selectedModel.type === 'fine-tuned' ? 'Fine-tuned' : 'Base Model'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500 dark:text-gray-400">Architecture:</span>
                      <span className="font-medium">{selectedModel.architecture}</span>
                    </div>
                    {selectedModel.creationDate && (
                      <div className="flex justify-between">
                        <span className="text-gray-500 dark:text-gray-400">Created:</span>
                        <span className="font-medium">
                          {new Date(selectedModel.creationDate).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Resource Configuration */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Cpu className="h-5 w-5 text-primary-500" />
                Resource Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm font-medium">GPU Memory</span>
                  <span className="text-sm text-gray-500">{(deploymentConfig.gpu_memory_utilization * 100).toFixed(0)}%</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="1"
                  step="0.1"
                  value={deploymentConfig.gpu_memory_utilization}
                  onChange={(e) => setDeploymentConfig(prev => ({
                    ...prev,
                    gpu_memory_utilization: parseFloat(e.target.value)
                  }))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Max Model Length</label>
                <select
                  value={deploymentConfig.max_model_len}
                  onChange={(e) => setDeploymentConfig(prev => ({
                    ...prev,
                    max_model_len: parseInt(e.target.value)
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value={2048}>2048 tokens</option>
                  <option value={4096}>4096 tokens</option>
                  <option value={8192}>8192 tokens</option>
                  <option value={16384}>16384 tokens</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Tensor Parallel Size</label>
                <select
                  value={deploymentConfig.tensor_parallel_size}
                  onChange={(e) => setDeploymentConfig(prev => ({
                    ...prev,
                    tensor_parallel_size: parseInt(e.target.value)
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value={1}>1 GPU</option>
                  <option value={2}>2 GPUs</option>
                  <option value={4}>4 GPUs</option>
                  <option value={8}>8 GPUs</option>
                </select>
              </div>
            </CardContent>
          </Card>

          {/* Advanced Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-primary-500" />
                Advanced Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Trust Remote Code</span>
                <input
                  type="checkbox"
                  checked={deploymentConfig.trust_remote_code}
                  onChange={(e) => setDeploymentConfig(prev => ({
                    ...prev,
                    trust_remote_code: e.target.checked
                  }))}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Enforce Eager Mode</span>
                <input
                  type="checkbox"
                  checked={deploymentConfig.enforce_eager}
                  onChange={(e) => setDeploymentConfig(prev => ({
                    ...prev,
                    enforce_eager: e.target.checked
                  }))}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Disable Log Stats</span>
                <input
                  type="checkbox"
                  checked={deploymentConfig.disable_log_stats}
                  onChange={(e) => setDeploymentConfig(prev => ({
                    ...prev,
                    disable_log_stats: e.target.checked
                  }))}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Data Type</label>
                <select
                  value={deploymentConfig.dtype}
                  onChange={(e) => setDeploymentConfig(prev => ({
                    ...prev,
                    dtype: e.target.value
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="auto">Auto</option>
                  <option value="float16">Float16</option>
                  <option value="bfloat16">BFloat16</option>
                  <option value="float32">Float32</option>
                </select>
              </div>
            </CardContent>
          </Card>

          {/* Deploy Button */}
          <Button
            variant="primary"
            onClick={deployModel}
            disabled={isDeploying || !selectedModel}
            className="w-full"
            leftIcon={isDeploying ? <AnimatedLoader variant="dots" size="sm" /> : <Rocket className="h-4 w-4" />}
          >
            {isDeploying ? 'Deploying...' : 'Deploy Model'}
          </Button>
        </div>
      </div>
    </div>
  );
}
