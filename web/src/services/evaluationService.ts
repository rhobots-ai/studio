// Use proxy in development, direct URL in production
import { API_BASE_URL } from "../config/api";

export interface EvaluationJob {
  id: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  model_path: string;
  total_rows: number;
  completed_rows: number;
  progress_percentage: number;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  error?: string;
}

export interface EvaluationProgress {
  completed_rows: number;
  total_rows: number;
  progress_percentage: number;
  estimated_completion_time?: number;
  avg_time_per_example?: number;
  processing_speed?: number;
}

export interface EvaluationResult {
  instruction: string;
  input?: string;
  output: string;
  predict: string;
}

export interface EvaluationMapping {
  input_columns: Record<string, string>; // maps model input fields to file columns
  output_column?: string; // Legacy: which column contains the expected/ground truth output
  output_columns?: Record<string, string>; // New: maps JSON fields to CSV columns
  // Dynamic instruction configuration
  instruction_source?: 'static' | 'column' | 'file'; // Source of instructions
  instruction_column?: string; // Column name for instructions (when source is 'column')
  instruction_file_content?: string; // Base64 encoded instruction file (when source is 'file')
  instruction_file_type?: 'json' | 'csv' | 'jsonl'; // Type of instruction file
  instruction_file_mapping?: Record<string, string>; // How to map instruction file to dataset
  static_instruction?: string; // Fallback static instruction
  preprocessing_options: {
    normalize_text: boolean;
    handle_missing_values: 'skip' | 'default' | 'error';
    default_values: Record<string, any>;
    batch_size?: number;
  };
}

export interface AccuracyMetrics {
  overall_accuracy: number;
  field_accuracies: Record<string, number | {
    exact_accuracy: number;
    fuzzy_accuracy: number;
    prediction_coverage: number;
    total_attempts: number;
  }>;
  field_details: Record<string, {
    correct: number;
    total: number;
    missing: number;
    incorrect: number;
    fuzzy_matches?: number;
  }>;
  perfect_extractions: number;
  total_records: number;
  records_with_predictions?: number;
  empty_predictions_excluded?: number;
  json_parsing_success?: number;
  json_parsing_success_rate?: number;
  exclude_empty_predictions?: boolean;
  evaluated_fields: string[];
}

export interface AccuracyMetricsResponse {
  status: string;
  job_id: string;
  metrics: AccuracyMetrics;
}

export interface EvaluationResponse {
  job_id: string;
  status: string;
  message: string;
  total_rows: number;
}

export interface EvaluationStatusResponse {
  job_id: string;
  status: string;
  progress: EvaluationProgress;
  error?: string;
}

export interface EvaluationResultsResponse {
  job_id: string;
  status: string;
  total_results: number;
  results: EvaluationResult[];
}

class EvaluationService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = API_BASE_URL;
  }

  /**
   * Start a prediction job with test data array
   */
  async startPredictionJob(
    modelPath: string,
    testData: any[],
    batchSize: number = 50
  ): Promise<EvaluationResponse> {
    const response = await fetch(`${API_BASE_URL}/evaluate/predict`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model_path: modelPath,
        test_data: testData,
        batch_size: batchSize,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to start prediction job');
    }

    return response.json();
  }

  /**
   * Start a prediction job with file upload
   */
  async startPredictionJobWithFile(
    modelPath: string,
    file: File,
    batchSize: number = 50
  ): Promise<EvaluationResponse> {
    const formData = new FormData();
    formData.append('data_file', file);
    formData.append('model_path', modelPath);
    formData.append('batch_size', batchSize.toString());

    const response = await fetch(`${API_BASE_URL}/evaluate/predict-file`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to start prediction job with file');
    }

    return response.json();
  }

  /**
   * Start a prediction job with base64 encoded file content
   */
  async startPredictionJobWithBase64(
    modelPath: string,
    fileContent: string,
    fileType: 'csv' | 'json' | 'jsonl' | 'pkl' | 'pickle',
    batchSize: number = 50
  ): Promise<EvaluationResponse> {
    const response = await fetch(`${API_BASE_URL}/evaluate/predict-file`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model_path: modelPath,
        file_content: fileContent,
        file_type: fileType,
        batch_size: batchSize,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to start prediction job with base64');
    }

    return response.json();
  }

  /**
   * Start a prediction job with column mapping support
   */
  async startPredictionJobWithMapping(
    modelPath: string,
    fileContent: string,
    fileType: 'csv' | 'json' | 'jsonl' | 'pkl' | 'pickle',
    mapping: EvaluationMapping,
    batchSize: number = 50
  ): Promise<EvaluationResponse> {
    const response = await fetch(`${API_BASE_URL}/evaluate/predict-file`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model_path: modelPath,
        file_content: fileContent,
        file_type: fileType,
        batch_size: batchSize,
        mapping: mapping,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to start prediction job with mapping');
    }

    return response.json();
  }

  /**
   * Analyze file columns and get column information
   */
  async analyzeFileColumns(
    fileContent: string,
    fileType: 'csv' | 'json' | 'jsonl' | 'pkl' | 'pickle'
  ): Promise<{
    columns: string[];
    columnInfo: Record<string, {
      name: string;
      data_type: string;
      null_count: number;
      null_percentage: number;
      unique_count: number;
      sample_values: any[];
      total_rows: number;
      avg_length?: number;
      max_length?: number;
      min_length?: number;
    }>;
    totalRows: number;
  }> {
    const response = await fetch(`${API_BASE_URL}/evaluate/analyze-columns`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        file_content: fileContent,
        file_type: fileType,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to analyze file columns');
    }

    return response.json();
  }

  /**
   * Validate column mapping
   */
  async validateMapping(
    fileContent: string,
    fileType: 'csv' | 'json' | 'jsonl' | 'pkl' | 'pickle',
    mapping: EvaluationMapping,
    modelSchema: { input_schema: Record<string, any>; output_schema: Record<string, any> }
  ): Promise<{
    is_valid: boolean;
    issues: string[];
    warnings: string[];
  }> {
    const response = await fetch(`${API_BASE_URL}/evaluate/validate-mapping`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        file_content: fileContent,
        file_type: fileType,
        mapping: mapping,
        model_schema: modelSchema,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to validate mapping');
    }

    return response.json();
  }

  /**
   * Get status of an evaluation job
   */
  async getJobStatus(jobId: string): Promise<EvaluationStatusResponse> {
    const response = await fetch(`${API_BASE_URL}/evaluate/status/${jobId}`);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to get job status');
    }

    return response.json();
  }

  /**
   * Get results of a completed evaluation job
   */
  async getJobResults(jobId: string): Promise<EvaluationResultsResponse> {
    const response = await fetch(`${API_BASE_URL}/evaluate/results/${jobId}`);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to get job results');
    }

    return response.json();
  }

  /**
   * List all evaluation jobs
   */
  async listJobs(): Promise<{ jobs: EvaluationJob[]; total: number }> {
    const response = await fetch(`${API_BASE_URL}/evaluate/jobs`);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to list jobs');
    }

    return response.json();
  }

  /**
   * Delete an evaluation job
   */
  async deleteJob(jobId: string): Promise<{ job_id: string; status: string; message: string }> {
    const response = await fetch(`${API_BASE_URL}/evaluate/jobs/${jobId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to delete job');
    }

    return response.json();
  }

  /**
   * Poll job status until completion
   */
  async pollJobStatus(
    jobId: string,
    onProgress?: (progress: EvaluationProgress) => void,
    intervalMs: number = 2000
  ): Promise<EvaluationStatusResponse> {
    return new Promise((resolve, reject) => {
      const poll = async () => {
        try {
          const status = await this.getJobStatus(jobId);
          
          if (onProgress) {
            onProgress(status.progress);
          }

          if (status.status === 'completed') {
            resolve(status);
          } else if (status.status === 'failed') {
            reject(new Error(status.error || 'Job failed'));
          } else {
            // Continue polling
            setTimeout(poll, intervalMs);
          }
        } catch (error) {
          reject(error);
        }
      };

      poll();
    });
  }

  /**
   * Download results as JSON file
   */
  async downloadResults(jobId: string, filename?: string): Promise<void> {
    try {
      const results = await this.getJobResults(jobId);
      
      const blob = new Blob([JSON.stringify(results.results, null, 2)], {
        type: 'application/json',
      });
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename || `evaluation_results_${jobId}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      throw new Error(`Failed to download results: ${error}`);
    }
  }

  /**
   * Download results as CSV file
   */
  async downloadResultsAsCSV(jobId: string, filename?: string): Promise<void> {
    try {
      const results = await this.getJobResults(jobId);
      
      if (results.results.length === 0) {
        throw new Error('No results to download');
      }

      // Convert to CSV
      const headers = Object.keys(results.results[0]);
      const csvContent = [
        headers.join(','),
        ...results.results.map(row => 
          headers.map(header => {
            const value = row[header as keyof EvaluationResult] || '';
            // Escape quotes and wrap in quotes if contains comma or quote
            const escaped = String(value).replace(/"/g, '""');
            return escaped.includes(',') || escaped.includes('"') || escaped.includes('\n') 
              ? `"${escaped}"` 
              : escaped;
          }).join(',')
        )
      ].join('\n');
      
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename || `evaluation_results_${jobId}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      throw new Error(`Failed to download CSV: ${error}`);
    }
  }

  /**
   * Validate test data format
   */
  validateTestData(data: any[]): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!Array.isArray(data)) {
      errors.push('Test data must be an array');
      return { isValid: false, errors };
    }

    if (data.length === 0) {
      errors.push('Test data cannot be empty');
      return { isValid: false, errors };
    }

    // Check required fields
    const requiredFields = ['instruction', 'output'];
    // const optionalFields = ['input'];

    for (let i = 0; i < Math.min(data.length, 10); i++) {
      const row = data[i];
      
      if (typeof row !== 'object' || row === null) {
        errors.push(`Row ${i + 1}: Must be an object`);
        continue;
      }

      for (const field of requiredFields) {
        if (!(field in row) || !row[field]) {
          errors.push(`Row ${i + 1}: Missing required field '${field}'`);
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Convert file to base64
   */
  async fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Remove data URL prefix (e.g., "data:text/csv;base64,")
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  /**
   * Get file type from filename
   */
  getFileType(filename: string): 'csv' | 'json' | 'jsonl' | 'pkl' | 'pickle' | null {
    const extension = filename.toLowerCase().split('.').pop();
    
    switch (extension) {
      case 'csv':
        return 'csv';
      case 'json':
        return 'json';
      case 'jsonl':
        return 'jsonl';
      case 'pkl':
        return 'pkl';
      case 'pickle':
        return 'pickle';
      default:
        return null;
    }
  }

  /**
   * Get available models from prediction service
   */
  async getAvailableModels(): Promise<any[]> {
    const response = await fetch(`${API_BASE_URL}/evaluate/models`);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to get available models');
    }

    const data = await response.json();
    return data.models || [];
  }

  /**
   * Get model details
   */
  async getModelDetails(modelId: string): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/evaluate/models/${modelId}`);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to get model details');
    }

    const data = await response.json();
    return data.model;
  }

  /**
   * Get accuracy metrics for an evaluation job
   */
  async getJobAccuracyMetrics(jobId: string): Promise<AccuracyMetricsResponse> {
    const response = await fetch(`${API_BASE_URL}/evaluate/metrics/${jobId}`);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to get accuracy metrics');
    }

    return response.json();
  }
}

// Export singleton instance
export const evaluationService = new EvaluationService();
export default evaluationService;
