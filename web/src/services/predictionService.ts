import { API_BASE_URL_WITH_API,  } from '../config/api';

export interface ModelInfo {
  model_id: string;
  name: string;
  description: string;
  input_schema: Record<string, any>;
  output_schema: Record<string, any>;
  created_at: string;
  accuracy?: number;
  status: 'ready' | 'loading' | 'error';
  training_session_id?: string;
  model_type?: string;
  version?: string;
}

export interface PredictionJob {
  job_id: string;
  model_id: string;
  file_id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  total_rows: number;
  processed_rows: number;
  results?: PredictionResult[];
  error_message?: string;
  created_at: string;
  completed_at?: string;
  estimated_completion?: string;
}

export interface PredictionResult {
  row_index: number;
  input_data: Record<string, any>;
  prediction: any;
  confidence?: number;
  processing_time_ms?: number;
  model_version?: string;
}

export interface PredictionMapping {
  input_columns: Record<string, string>; // maps model input fields to file columns
  preprocessing_options: {
    normalize_text: boolean;
    handle_missing_values: 'skip' | 'default' | 'error';
    default_values: Record<string, any>;
    batch_size?: number;
  };
}

export interface StartPredictionRequest {
  file_id: string;
  model_id: string;
  mapping: PredictionMapping;
  job_name?: string;
  description?: string;
}

export interface PredictionJobResponse {
  success: boolean;
  job_id?: string;
  message: string;
  job?: PredictionJob;
}

export interface ModelListResponse {
  success: boolean;
  models: ModelInfo[];
  total: number;
}

export interface PredictionStatusResponse {
  success: boolean;
  job: PredictionJob;
}

export interface PredictionResultsResponse {
  success: boolean;
  job_id: string;
  results: PredictionResult[];
  total_results: number;
  page: number;
  page_size: number;
  has_more: boolean;
}

class PredictionService {
  private baseUrl = API_BASE_URL_WITH_API;

  /**
   * Get list of available trained models for prediction
   */
  async getAvailableModels(): Promise<ModelInfo[]> {
    const response = await fetch(`${this.baseUrl}/predictions/models`);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to get available models');
    }

    const result = await response.json();
    return result.models || [];
  }

  /**
   * Get details of a specific model
   */
  async getModel(modelId: string): Promise<ModelInfo> {
    const response = await fetch(`${this.baseUrl}/predictions/models/${modelId}`);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to get model details');
    }

    const result = await response.json();
    return result.model;
  }

  /**
   * Start a new prediction job
   */
  async startPrediction(request: StartPredictionRequest): Promise<PredictionJob> {
    const response = await fetch(`${this.baseUrl}/predictions/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to start prediction');
    }

    const result = await response.json();
    return result.job;
  }

  /**
   * Get status of a prediction job
   */
  async getPredictionStatus(jobId: string): Promise<PredictionJob> {
    const response = await fetch(`${this.baseUrl}/predictions/jobs/${jobId}/status`);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to get prediction status');
    }

    const result = await response.json();
    return result.job;
  }

  /**
   * Get results of a completed prediction job
   */
  async getPredictionResults(
    jobId: string, 
    page: number = 1, 
    pageSize: number = 50
  ): Promise<PredictionResultsResponse> {
    const response = await fetch(`${this.baseUrl}/predictions/jobs/${jobId}/results?page=${page}&page_size=${pageSize}`);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to get prediction results');
    }

    return response.json();
  }

  /**
   * Download prediction results as CSV
   */
  async downloadResults(jobId: string, format: 'csv' | 'json' = 'csv'): Promise<void> {
    const response = await fetch(`${this.baseUrl}/predictions/jobs/${jobId}/download?format=${format}`);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to download results');
    }

    // Get filename from response headers or use default
    const contentDisposition = response.headers.get('content-disposition');
    let filename = `prediction_results_${jobId}.${format}`;
    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename="(.+)"/);
      if (filenameMatch) {
        filename = filenameMatch[1];
      }
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
  }

  /**
   * Cancel a running prediction job
   */
  async cancelPrediction(jobId: string): Promise<{ success: boolean; message: string }> {
    const response = await fetch(`${this.baseUrl}/predictions/jobs/${jobId}/cancel`, {
      method: 'POST',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to cancel prediction');
    }

    return response.json();
  }

  /**
   * Delete a prediction job and its results
   */
  async deletePredictionJob(jobId: string): Promise<{ success: boolean; message: string }> {
    const response = await fetch(`${this.baseUrl}/predictions/jobs/${jobId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to delete prediction job');
    }

    return response.json();
  }

  /**
   * Get list of all prediction jobs
   */
  async getPredictionJobs(
    status?: string,
    modelId?: string,
    limit: number = 50
  ): Promise<{ jobs: PredictionJob[]; total: number }> {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    if (modelId) params.append('model_id', modelId);
    params.append('limit', limit.toString());

    const response = await fetch(`${this.baseUrl}/predictions/jobs?${params}`);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to get prediction jobs');
    }

    return response.json();
  }

  /**
   * Validate column mapping for a model
   */
  async validateMapping(
    modelId: string,
    fileId: string,
    mapping: PredictionMapping
  ): Promise<{
    is_valid: boolean;
    issues: string[];
    warnings: string[];
    sample_preview?: PredictionResult[];
  }> {
    const response = await fetch(`${this.baseUrl}/predictions/validate-mapping`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model_id: modelId,
        file_id: fileId,
        mapping: mapping,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to validate mapping');
    }

    return response.json();
  }

  /**
   * Get prediction statistics for a model
   */
  async getModelPredictionStats(modelId: string): Promise<{
    total_predictions: number;
    avg_confidence: number;
    avg_processing_time: number;
    success_rate: number;
    recent_jobs: PredictionJob[];
  }> {
    const response = await fetch(`${this.baseUrl}/predictions/models/${modelId}/stats`);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to get model prediction stats');
    }

    return response.json();
  }

  /**
   * Format prediction confidence as percentage
   */
  formatConfidence(confidence?: number): string {
    if (confidence === undefined) return 'N/A';
    return `${(confidence * 100).toFixed(1)}%`;
  }

  /**
   * Format processing time in human readable format
   */
  formatProcessingTime(timeMs?: number): string {
    if (timeMs === undefined) return 'N/A';
    if (timeMs < 1000) return `${timeMs.toFixed(0)}ms`;
    return `${(timeMs / 1000).toFixed(2)}s`;
  }

  /**
   * Get status color for prediction job
   */
  getJobStatusColor(status: string): string {
    switch (status) {
      case 'completed': return 'text-green-600';
      case 'running': return 'text-blue-600';
      case 'pending': return 'text-yellow-600';
      case 'failed': return 'text-red-600';
      default: return 'text-gray-600';
    }
  }

  /**
   * Get status icon for prediction job
   */
  getJobStatusIcon(status: string): string {
    switch (status) {
      case 'completed': return '✓';
      case 'running': return '⟳';
      case 'pending': return '⏳';
      case 'failed': return '✗';
      default: return '?';
    }
  }
}

export const predictionService = new PredictionService();
export default predictionService;
