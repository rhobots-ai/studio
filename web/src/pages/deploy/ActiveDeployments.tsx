import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '../../components/ui/Card';
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
  Search,
  Plus,
  BarChart3,
  Activity,
  MoreVertical,
  Copy,
  TestTube,
  Trash2,
  ChevronUp,
  Cpu,
  HardDrive,
  Clock,
  Zap
} from 'lucide-react';
import { DeploymentConfig } from '../../services/deploymentService';
import { motion, AnimatePresence } from 'framer-motion';

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
  total_requests?: number;
  avg_response_time?: number;
  uptime_percentage?: number;
}

export default function ActiveDeployments() {
  // State
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [stats, setStats] = useState<DeploymentStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  
  // Test interface state
  const [testingDeploymentId, setTestingDeploymentId] = useState<string | null>(null);
  const [testMessage, setTestMessage] = useState('Hello, how are you?');
  const [testResponse, setTestResponse] = useState<string | null>(null);
  const [testLatency, setTestLatency] = useState<number | null>(null);

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

  // Deployment management functions
  const stopDeployment = async (deploymentId: string) => {
    try {
      const response = await fetch(`${API_BASE_URL_WITH_API}/deploy/${deploymentId}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        fetchDeployments();
        setActiveDropdown(null);
      } else {
        const error = await response.json();
        alert(`Failed to stop deployment: ${error.detail || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error stopping deployment:', error);
    }
  };

  const deleteDeployment = async (deploymentId: string) => {
    try {
      const response = await fetch(`${API_BASE_URL_WITH_API}/deploy/${deploymentId}/delete`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        fetchDeployments();
        setActiveDropdown(null);
      } else {
        const error = await response.json();
        alert(`Failed to delete deployment: ${error.detail || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error deleting deployment:', error);
    }
  };

  const testDeployment = async (deploymentId: string) => {
    setTestingDeploymentId(deploymentId);
    setTestResponse(null);
    setTestLatency(null);
    setActiveDropdown(null);
    
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
    }
  };

  const copyEndpoint = (endpoint: string) => {
    navigator.clipboard.writeText(endpoint);
    setActiveDropdown(null);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Get status styling
  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'running':
        return {
          variant: 'success' as const,
          icon: <Play className="h-3 w-3" />,
          bgColor: 'bg-success-50 dark:bg-success-900/10',
          borderColor: 'border-success-200 dark:border-success-800'
        };
      case 'starting':
        return {
          variant: 'primary' as const,
          icon: <Clock className="h-3 w-3" />,
          bgColor: 'bg-primary-50 dark:bg-primary-900/10',
          borderColor: 'border-primary-200 dark:border-primary-800'
        };
      case 'failed':
        return {
          variant: 'error' as const,
          icon: <XCircle className="h-3 w-3" />,
          bgColor: 'bg-error-50 dark:bg-error-900/10',
          borderColor: 'border-error-200 dark:border-error-800'
        };
      case 'stopped':
        return {
          variant: 'secondary' as const,
          icon: <Pause className="h-3 w-3" />,
          bgColor: 'bg-gray-50 dark:bg-gray-800/50',
          borderColor: 'border-gray-200 dark:border-gray-700'
        };
      default:
        return {
          variant: 'secondary' as const,
          icon: <Clock className="h-3 w-3" />,
          bgColor: 'bg-gray-50 dark:bg-gray-800/50',
          borderColor: 'border-gray-200 dark:border-gray-700'
        };
    }
  };

  // Filter deployments
  const filteredDeployments = deployments.filter(deployment => {
    const matchesSearch = deployment.model_path.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         deployment.deployment_id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || deployment.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Initial data fetch
  useEffect(() => {
    fetchDeployments();
  }, []);

  // Set up polling for updates
  useEffect(() => {
    const interval = setInterval(() => {
      fetchDeployments();
    }, 10000);
    
    return () => clearInterval(interval);
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setActiveDropdown(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Active Deployments</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Manage and monitor your deployed models
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/deploy/new">
            <Button 
              leftIcon={<Plus className="h-4 w-4" />}
              variant="primary"
            >
              Deploy New Model
            </Button>
          </Link>
          <Button 
            onClick={() => fetchDeployments()}
            leftIcon={<RefreshCw className="h-4 w-4" />}
            variant="outline"
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Card variant="outline">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                      Total
                    </p>
                    <h3 className="text-xl font-bold mt-1">
                      {isLoading ? <AnimatedLoader variant="pulse" size="sm" /> : stats.total_deployments}
                    </h3>
                  </div>
                  <Server className="h-4 w-4 text-primary-500" />
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
          >
            <Card variant="outline">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                      Running
                    </p>
                    <h3 className="text-xl font-bold mt-1">
                      {isLoading ? <AnimatedLoader variant="pulse" size="sm" /> : stats.running_deployments}
                    </h3>
                  </div>
                  <Play className="h-4 w-4 text-success-500" />
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.2 }}
          >
            <Card variant="outline">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                      Failed
                    </p>
                    <h3 className="text-xl font-bold mt-1">
                      {isLoading ? <AnimatedLoader variant="pulse" size="sm" /> : stats.failed_deployments}
                    </h3>
                  </div>
                  <XCircle className="h-4 w-4 text-error-500" />
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.3 }}
          >
            <Card variant="outline">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                      Stopped
                    </p>
                    <h3 className="text-xl font-bold mt-1">
                      {isLoading ? <AnimatedLoader variant="pulse" size="sm" /> : stats.stopped_deployments}
                    </h3>
                  </div>
                  <Pause className="h-4 w-4 text-secondary-500" />
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.4 }}
          >
            <Card variant="outline">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                      Ports
                    </p>
                    <h3 className="text-xl font-bold mt-1">
                      {isLoading ? <AnimatedLoader variant="pulse" size="sm" /> : stats.available_ports}
                    </h3>
                  </div>
                  <Terminal className="h-4 w-4 text-warning-500" />
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.5 }}
          >
            <Card variant="outline">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                      Uptime
                    </p>
                    <h3 className="text-xl font-bold mt-1">
                      {isLoading ? <AnimatedLoader variant="pulse" size="sm" /> : `${stats.uptime_percentage || 98}%`}
                    </h3>
                  </div>
                  <Activity className="h-4 w-4 text-info-500" />
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      )}

      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Server className="h-5 w-5 text-gray-500" />
          Deployments
        </h2>
        
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search deployments..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 w-64"
            />
          </div>
          
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="all">All Status</option>
            <option value="running">Running</option>
            <option value="starting">Starting</option>
            <option value="failed">Failed</option>
            <option value="stopped">Stopped</option>
          </select>
        </div>
      </div>

      {/* Deployments Grid */}
      <div className="space-y-4">
        {isLoading ? (
          <Card>
            <CardContent className="p-8 text-center">
              <AnimatedLoader variant="dots" size="md" text="Loading deployments..." />
            </CardContent>
          </Card>
        ) : filteredDeployments.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Server className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                {searchTerm || statusFilter !== 'all' ? 'No deployments match your filters' : 'No active deployments'}
              </h3>
              <p className="text-gray-500 dark:text-gray-400 mb-4">
                {searchTerm || statusFilter !== 'all' 
                  ? 'Try adjusting your search or filter criteria.'
                  : 'Deploy a model to get started'
                }
              </p>
              {!searchTerm && statusFilter === 'all' && (
                <Link to="/deploy/new">
                  <Button leftIcon={<Plus className="h-4 w-4" />}>
                    Deploy Your First Model
                  </Button>
                </Link>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {filteredDeployments.map((deployment, index) => {
              const statusConfig = getStatusConfig(deployment.status);
              const isExpanded = expandedCard === deployment.deployment_id;
              const isDropdownOpen = activeDropdown === deployment.deployment_id;
              
              return (
                <motion.div
                  key={deployment.deployment_id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.1 }}
                >
                  <Card className={`${statusConfig.borderColor} ${statusConfig.bgColor} hover:shadow-md transition-all duration-200`}>
                    <CardContent className="p-6">
                      {/* Main Content */}
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-4">
                          <Badge variant={statusConfig.variant} className="flex items-center gap-1">
                            {statusConfig.icon}
                            {deployment.status.charAt(0).toUpperCase() + deployment.status.slice(1)}
                          </Badge>
                          <div>
                            <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                              {deployment.model_path.split('/').pop() || deployment.model_path}
                            </h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400 font-mono">
                              {deployment.deployment_id.substring(0, 12)}...
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          {deployment.status === 'running' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => testDeployment(deployment.deployment_id)}
                              leftIcon={<TestTube className="h-3 w-3" />}
                            >
                              Test
                            </Button>
                          )}
                          
                          <div className="relative">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveDropdown(isDropdownOpen ? null : deployment.deployment_id);
                              }}
                              leftIcon={<MoreVertical className="h-3 w-3" />}
                            />
                            
                            <AnimatePresence>
                              {isDropdownOpen && (
                                <motion.div
                                  initial={{ opacity: 0, scale: 0.95, y: -10 }}
                                  animate={{ opacity: 1, scale: 1, y: 0 }}
                                  exit={{ opacity: 0, scale: 0.95, y: -10 }}
                                  transition={{ duration: 0.1 }}
                                  className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg z-10"
                                >
                                  <div className="py-1">
                                    {deployment.status === 'running' && (
                                      <>
                                        <button
                                          onClick={() => copyEndpoint(deployment.endpoint)}
                                          className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                                        >
                                          <Copy className="h-3 w-3" />
                                          Copy Endpoint
                                        </button>
                                        <button
                                          onClick={() => setExpandedCard(isExpanded ? null : deployment.deployment_id)}
                                          className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                                        >
                                          <Terminal className="h-3 w-3" />
                                          API Examples
                                        </button>
                                        <button
                                          onClick={() => stopDeployment(deployment.deployment_id)}
                                          className="flex items-center gap-2 w-full px-3 py-2 text-sm text-error-600 dark:text-error-400 hover:bg-error-50 dark:hover:bg-error-900/20"
                                        >
                                          <Pause className="h-3 w-3" />
                                          Stop Deployment
                                        </button>
                                      </>
                                    )}
                                    {deployment.status !== 'running' && deployment.status !== 'starting' && (
                                      <button
                                        onClick={() => deleteDeployment(deployment.deployment_id)}
                                        className="flex items-center gap-2 w-full px-3 py-2 text-sm text-error-600 dark:text-error-400 hover:bg-error-50 dark:hover:bg-error-900/20"
                                      >
                                        <Trash2 className="h-3 w-3" />
                                        Delete Deployment
                                      </button>
                                    )}
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        </div>
                      </div>

                      {/* Key Information */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Endpoint</p>
                          <p className="text-sm font-mono text-gray-900 dark:text-gray-100 truncate">
                            {deployment.endpoint}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Created</p>
                          <p className="text-sm text-gray-900 dark:text-gray-100">
                            {formatDate(deployment.created_at)}
                          </p>
                        </div>
                        {deployment.resource_usage && (
                          <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Resources</p>
                            <div className="flex items-center gap-3 text-sm">
                              <span className="flex items-center gap-1">
                                <Cpu className="h-3 w-3 text-gray-400" />
                                {deployment.resource_usage.cpu_percent.toFixed(0)}%
                              </span>
                              <span className="flex items-center gap-1">
                                <HardDrive className="h-3 w-3 text-gray-400" />
                                {Math.round(deployment.resource_usage.memory_mb)}MB
                              </span>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Error Message */}
                      {deployment.error_message && (
                        <div className="mb-4 p-3 bg-error-50 dark:bg-error-900/20 text-error-700 dark:text-error-300 rounded-md">
                          <p className="text-sm font-medium mb-1">Error:</p>
                          <p className="text-xs font-mono">{deployment.error_message}</p>
                        </div>
                      )}

                      {/* Test Interface */}
                      <AnimatePresence>
                        {testingDeploymentId === deployment.deployment_id && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4"
                          >
                            <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                              <TestTube className="h-4 w-4" />
                              Test Deployment
                            </h4>
                            
                            <div className="flex gap-2 mb-3">
                              <input
                                type="text"
                                value={testMessage}
                                onChange={(e) => setTestMessage(e.target.value)}
                                placeholder="Enter a message to test"
                                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                              />
                              <Button
                                variant="primary"
                                size="sm"
                                onClick={() => testDeployment(deployment.deployment_id)}
                                leftIcon={<Zap className="h-3 w-3" />}
                              >
                                Send
                              </Button>
                            </div>
                            
                            {testResponse && (
                              <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-md">
                                <p className="text-sm whitespace-pre-wrap text-gray-900 dark:text-gray-100">
                                  {testResponse}
                                </p>
                                {testLatency && (
                                  <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    Response time: {testLatency.toFixed(0)} ms
                                  </p>
                                )}
                              </div>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* API Examples */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4"
                          >
                            <div className="flex items-center justify-between mb-3">
                              <h4 className="text-sm font-semibold flex items-center gap-2">
                                <Terminal className="h-4 w-4" />
                                API Usage Examples
                              </h4>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setExpandedCard(null)}
                                leftIcon={<ChevronUp className="h-3 w-3" />}
                              >
                                Close
                              </Button>
                            </div>
                            
                            <div className="space-y-4">
                              <div>
                                <h5 className="text-xs font-medium mb-2 text-gray-700 dark:text-gray-300">Python (OpenAI Client)</h5>
                                <pre className="bg-gray-900 text-gray-100 p-3 rounded-md text-xs overflow-x-auto">
{`import openai

client = openai.OpenAI(
    base_url="${deployment.endpoint}/v1",
    api_key="not-needed"
)

response = client.chat.completions.create(
    model="${deployment.model_path}",
    messages=[{"role": "user", "content": "Hello!"}],
    max_tokens=100,
    temperature=0.7
)

print(response.choices[0].message.content)`}
                                </pre>
                              </div>
                              
                              <div>
                                <h5 className="text-xs font-medium mb-2 text-gray-700 dark:text-gray-300">cURL</h5>
                                <pre className="bg-gray-900 text-gray-100 p-3 rounded-md text-xs overflow-x-auto">
{`curl -X POST ${deployment.endpoint}/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "${deployment.model_path}",
    "messages": [{"role": "user", "content": "Hello!"}],
    "max_tokens": 100,
    "temperature": 0.7
  }'`}
                                </pre>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Quick Actions Footer */}
      {filteredDeployments.length > 0 && (
        <Card variant="outline">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Showing {filteredDeployments.length} of {deployments.length} deployments
              </div>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => {
                    const runningDeployments = filteredDeployments.filter(d => d.status === 'running');
                    if (runningDeployments.length === 0) {
                      alert('No running deployments to test');
                      return;
                    }
                    runningDeployments.forEach(d => testDeployment(d.deployment_id));
                  }}
                >
                  Test All Running
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  leftIcon={<BarChart3 className="h-4 w-4" />}
                >
                  Export Report
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
