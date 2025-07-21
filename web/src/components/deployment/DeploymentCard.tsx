import { Card, CardContent } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Server, Cpu, HardDrive, Clock, Play, Pause, CheckCircle2, XCircle, Copy, Terminal, Trash2 } from 'lucide-react';
import { DeploymentConfig } from '../../services/deploymentService';

interface DeploymentCardProps {
  deployment: {
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
  };
  onCopyEndpoint: (endpoint: string) => void;
  onGetCurlExamples: (deploymentId: string) => void;
  onTestDeployment: (deploymentId: string) => void;
  onStopDeployment: (deploymentId: string) => void;
  onDeleteDeployment: (deploymentId: string) => void;
  testingDeploymentId: string | null;
  testMessage: string;
  onTestMessageChange: (message: string) => void;
  testResponse: string | null;
  testLatency: number | null;
  showCurlExamples: string | null;
  onCloseCurlExamples: () => void;
  formatDate: (dateString: string) => string;
}

export function DeploymentCard({
  deployment,
  onCopyEndpoint,
  onGetCurlExamples,
  onTestDeployment,
  onStopDeployment,
  onDeleteDeployment,
  testingDeploymentId,
  testMessage,
  onTestMessageChange,
  testResponse,
  testLatency,
  showCurlExamples,
  onCloseCurlExamples,
  formatDate
}: DeploymentCardProps) {
  // Get status badge variant
  const getStatusVariant = (status: string): 'primary' | 'secondary' | 'success' | 'error' => {
    switch (status) {
      case 'running':
        return 'success';
      case 'starting':
        return 'primary';
      case 'failed':
        return 'error';
      default:
        return 'secondary';
    }
  };

  // Get status icon
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <Play className="h-4 w-4" />;
      case 'starting':
        return <Clock className="h-4 w-4" />;
      case 'failed':
        return <XCircle className="h-4 w-4" />;
      case 'stopped':
        return <Pause className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  return (
    <Card className={
      deployment.status === 'running' 
        ? 'border-success-200 dark:border-success-800' 
        : deployment.status === 'failed'
          ? 'border-error-200 dark:border-error-800'
          : ''
    }>
      <CardContent className="p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Badge variant={getStatusVariant(deployment.status)} className="flex items-center gap-1">
              {getStatusIcon(deployment.status)}
              {deployment.status.charAt(0).toUpperCase() + deployment.status.slice(1)}
            </Badge>
            <span className="font-mono text-sm text-gray-600 dark:text-gray-400">
              {deployment.deployment_id.substring(0, 8)}...
            </span>
          </div>
          <div className="flex items-center gap-2 mt-2 md:mt-0">
            {deployment.status === 'running' && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onCopyEndpoint(deployment.endpoint)}
                  leftIcon={<Copy className="h-3 w-3" />}
                >
                  Copy URL
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onGetCurlExamples(deployment.deployment_id)}
                  leftIcon={<Terminal className="h-3 w-3" />}
                >
                  API Examples
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onTestDeployment(deployment.deployment_id)}
                  leftIcon={<Play className="h-3 w-3" />}
                >
                  Test
                </Button>
              </>
            )}
            {deployment.status === 'running' && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => onStopDeployment(deployment.deployment_id)}
                leftIcon={<Pause className="h-3 w-3" />}
              >
                Stop
              </Button>
            )}
            {deployment.status !== 'running' && deployment.status !== 'starting' && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => onDeleteDeployment(deployment.deployment_id)}
                leftIcon={<Trash2 className="h-3 w-3" />}
              >
                Delete
              </Button>
            )}
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Model</p>
            <p className="font-medium">{deployment.model_path}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Endpoint</p>
            <p className="font-medium font-mono text-sm">
              {deployment.endpoint}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Created</p>
            <p className="font-medium">
              {formatDate(deployment.created_at)}
            </p>
          </div>
        </div>
        
        {deployment.resource_usage && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 bg-gray-50 dark:bg-gray-800/50 p-3 rounded-md">
            <div className="flex items-center gap-2">
              <Cpu className="h-4 w-4 text-gray-500" />
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">CPU</p>
                <p className="font-medium">{deployment.resource_usage.cpu_percent.toFixed(1)}%</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <HardDrive className="h-4 w-4 text-gray-500" />
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Memory</p>
                <p className="font-medium">{deployment.resource_usage.memory_mb.toFixed(0)} MB</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Server className="h-4 w-4 text-gray-500" />
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Process</p>
                <p className="font-medium">{deployment.resource_usage.status}</p>
              </div>
            </div>
          </div>
        )}
        
        {deployment.error_message && (
          <div className="mt-2 p-3 bg-error-50 dark:bg-error-900/20 text-error-700 dark:text-error-300 rounded-md text-sm">
            <p className="font-semibold">Error:</p>
            <p className="font-mono text-xs mt-1">{deployment.error_message}</p>
          </div>
        )}
        
        {/* Test Interface */}
        {testingDeploymentId === deployment.deployment_id && (
          <div className="mt-4 border-t border-gray-200 dark:border-gray-700 pt-4">
            <h3 className="text-sm font-semibold mb-2">Test Deployment</h3>
            
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                value={testMessage}
                onChange={(e) => onTestMessageChange(e.target.value)}
                placeholder="Enter a message to test"
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <Button
                variant="primary"
                size="sm"
                onClick={() => onTestDeployment(deployment.deployment_id)}
              >
                Send
              </Button>
            </div>
            
            {testResponse && (
              <div className="mt-2">
                <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-md">
                  <p className="text-sm whitespace-pre-wrap">{testResponse}</p>
                  {testLatency && (
                    <p className="text-xs text-gray-500 mt-2">
                      Response time: {testLatency.toFixed(0)} ms
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
        
        {/* API Examples */}
        {showCurlExamples === deployment.deployment_id && (
          <div className="mt-4 border-t border-gray-200 dark:border-gray-700 pt-4">
            <h3 className="text-sm font-semibold mb-2">API Usage Examples</h3>
            
            <div className="space-y-4">
              <div>
                <h4 className="text-xs font-medium mb-1">Python (OpenAI Client)</h4>
                <pre className="bg-gray-50 dark:bg-gray-800 p-3 rounded-md text-xs overflow-x-auto">
{`import openai

client = openai.OpenAI(
    base_url="${deployment.endpoint}/v1",
    api_key="not-needed"  # API key is not needed for local deployments
)

response = client.chat.completions.create(
    model="${deployment.model_path}",
    messages=[
        {"role": "user", "content": "Hello, how are you?"}
    ],
    max_tokens=100,
    temperature=0.7
)

print(response.choices[0].message.content)`}
                </pre>
              </div>
              
              <div>
                <h4 className="text-xs font-medium mb-1">cURL (Chat Completions)</h4>
                <pre className="bg-gray-50 dark:bg-gray-800 p-3 rounded-md text-xs overflow-x-auto">
{`curl -X POST \\
  ${deployment.endpoint}/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "${deployment.model_path}",
    "messages": [
      {
        "role": "user",
        "content": "Hello, how are you?"
      }
    ],
    "max_tokens": 100,
    "temperature": 0.7
  }'`}
                </pre>
              </div>
            </div>
            
            <Button
              size="sm"
              variant="outline"
              onClick={onCloseCurlExamples}
              className="mt-3"
            >
              Close Examples
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
