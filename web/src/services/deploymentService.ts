import { API_BASE_URL_WITH_API } from '../config/api';

export interface DeploymentConfig {
  gpu_memory_utilization: number;
  max_model_len: number;
  tensor_parallel_size: number;
  dtype: string;
  trust_remote_code: boolean;
  enforce_eager: boolean;
  disable_log_stats: boolean;
}

export interface Deployment {
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

export interface DeploymentStats {
  total_deployments: number;
  running_deployments: number;
  failed_deployments: number;
  stopped_deployments: number;
  available_ports: number;
}

export interface DeploymentResponse {
  deployment_id: string;
  status: string;
  endpoint?: string;
  message: string;
}

export interface DeploymentListResponse {
  deployments: Deployment[];
  total: number;
  stats: DeploymentStats;
}

export interface TestRequest {
  message: string;
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
}

export interface TestResponse {
  deployment_id: string;
  message: string;
  response: string;
  endpoint: string;
  latency_ms: number;
}

export interface CurlExamplesResponse {
  deployment_id: string;
  endpoint: string;
  examples: {
    curl_chat: string;
    curl_completions: string;
    python: string;
  };
}

class DeploymentService {
  /**
   * Deploy a model with vLLM
   */
  async deployModel(modelPath: string, config: DeploymentConfig): Promise<DeploymentResponse> {
    try {
      const response = await fetch(`${API_BASE_URL_WITH_API}/deploy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model_path: modelPath,
          config
        })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to deploy model');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error deploying model:', error);
      throw error;
    }
  }
  
  /**
   * Get all deployments
   */
  async getDeployments(): Promise<DeploymentListResponse> {
    try {
      const response = await fetch(`${API_BASE_URL_WITH_API}/deploy`);
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to get deployments');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error getting deployments:', error);
      throw error;
    }
  }
  
  /**
   * Get a specific deployment
   */
  async getDeployment(deploymentId: string): Promise<Deployment> {
    try {
      const response = await fetch(`${API_BASE_URL_WITH_API}/deploy/${deploymentId}`);
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to get deployment');
      }
      
      return await response.json();
    } catch (error) {
      console.error(`Error getting deployment ${deploymentId}:`, error);
      throw error;
    }
  }
  
  /**
   * Stop a deployment
   */
  async stopDeployment(deploymentId: string): Promise<DeploymentResponse> {
    try {
      const response = await fetch(`${API_BASE_URL_WITH_API}/deploy/${deploymentId}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to stop deployment');
      }
      
      return await response.json();
    } catch (error) {
      console.error(`Error stopping deployment ${deploymentId}:`, error);
      throw error;
    }
  }
  
  /**
   * Delete a deployment
   */
  async deleteDeployment(deploymentId: string): Promise<DeploymentResponse> {
    try {
      const response = await fetch(`${API_BASE_URL_WITH_API}/deploy/${deploymentId}/delete`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to delete deployment');
      }
      
      return await response.json();
    } catch (error) {
      console.error(`Error deleting deployment ${deploymentId}:`, error);
      throw error;
    }
  }
  
  /**
   * Test a deployment
   */
  async testDeployment(deploymentId: string, request: TestRequest): Promise<TestResponse> {
    try {
      const response = await fetch(`${API_BASE_URL_WITH_API}/deploy/${deploymentId}/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(request)
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to test deployment');
      }
      
      return await response.json();
    } catch (error) {
      console.error(`Error testing deployment ${deploymentId}:`, error);
      throw error;
    }
  }
  
  /**
   * Get curl examples for a deployment
   */
  async getCurlExamples(deploymentId: string): Promise<CurlExamplesResponse> {
    try {
      const response = await fetch(`${API_BASE_URL_WITH_API}/deploy/${deploymentId}/curl`);
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to get curl examples');
      }
      
      return await response.json();
    } catch (error) {
      console.error(`Error getting curl examples for deployment ${deploymentId}:`, error);
      throw error;
    }
  }
}

export const deploymentService = new DeploymentService();
export default deploymentService;
