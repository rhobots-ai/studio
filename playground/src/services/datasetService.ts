import { API_BASE_URL_WITH_API } from '../config/api';
import { ColumnMapping, TrainingExample } from './fileService';

export interface ProcessingStats {
  total_input_rows: number;
  valid_output_rows: number;
  skipped_rows: number;
  success_rate: number;
  instruction_stats: {
    avg_length: number;
    min_length: number;
    max_length: number;
  };
  output_types: {
    string_outputs: number;
    json_outputs: number;
  };
  column_usage: {
    instruction_columns: number;
    input_columns: number;
    output_columns: number;
  };
}

export interface ProcessedDataset {
  dataset_id: string;
  name: string;
  description: string;
  source_file_id: string;
  source_filename: string;
  column_mapping: ColumnMapping;
  total_examples: number;
  processing_stats: ProcessingStats;
  file_path: string;
  file_size: number;
  created_at: string;
  last_modified: string;
  created_by?: string;
  tags: string[];
  usage_count: number;
  last_used?: string;
}

export interface DatasetCreateRequest {
  name: string;
  description?: string;
  source_file_id: string;
  column_mapping: ColumnMapping;
  tags?: string[];
}

export interface DatasetUpdateRequest {
  name?: string;
  description?: string;
  tags?: string[];
}

export interface DatasetCreateResponse {
  success: boolean;
  dataset_id?: string;
  message: string;
  dataset?: ProcessedDataset;
}

export interface DatasetListResponse {
  datasets: ProcessedDataset[];
  total: number;
  storage_stats: {
    total_datasets: number;
    total_examples: number;
    total_size_bytes: number;
    total_size_mb: number;
    avg_examples_per_dataset: number;
  };
}

export interface DatasetPreviewResponse {
  success: boolean;
  dataset_id: string;
  preview_data: TrainingExample[];
  total_examples: number;
  showing_examples: number;
}

export interface DatasetOverview {
  total_datasets: number;
  storage_stats: {
    total_datasets: number;
    total_examples: number;
    total_size_bytes: number;
    total_size_mb: number;
    avg_examples_per_dataset: number;
  };
  recent_datasets: ProcessedDataset[];
  popular_datasets: ProcessedDataset[];
  popular_tags: [string, number][];
}

class DatasetService {
  private baseUrl = `${API_BASE_URL_WITH_API}/datasets`;

  /**
   * Create a new processed dataset
   */
  async createDataset(request: DatasetCreateRequest): Promise<DatasetCreateResponse> {
    const response = await fetch(`${this.baseUrl}/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to create dataset');
    }

    return response.json();
  }

  /**
   * List all datasets with optional filtering and sorting
   */
  async listDatasets(
    sortBy: string = 'created_at',
    sortDesc: boolean = true,
    filterTags?: string[]
  ): Promise<DatasetListResponse> {
    const params = new URLSearchParams({
      sort_by: sortBy,
      sort_desc: sortDesc.toString(),
    });

    if (filterTags && filterTags.length > 0) {
      params.append('filter_tags', filterTags.join(','));
    }

    const response = await fetch(`${this.baseUrl}?${params}`);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to list datasets');
    }

    return response.json();
  }

  /**
   * Get detailed information about a specific dataset
   */
  async getDataset(datasetId: string): Promise<{ success: boolean; dataset: ProcessedDataset }> {
    const response = await fetch(`${this.baseUrl}/${datasetId}`);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to get dataset');
    }

    return response.json();
  }

  /**
   * Get a preview of dataset training examples
   */
  async previewDataset(datasetId: string, limit: number = 10): Promise<DatasetPreviewResponse> {
    const response = await fetch(`${this.baseUrl}/${datasetId}/preview?limit=${limit}`);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to preview dataset');
    }

    return response.json();
  }

  /**
   * Get the complete training data for a dataset
   */
  async getDatasetData(datasetId: string): Promise<{
    success: boolean;
    dataset_id: string;
    data: TrainingExample[];
    total_examples: number;
  }> {
    const response = await fetch(`${this.baseUrl}/${datasetId}/data`);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to get dataset data');
    }

    return response.json();
  }

  /**
   * Update dataset metadata
   */
  async updateDataset(
    datasetId: string,
    updates: DatasetUpdateRequest
  ): Promise<{ success: boolean; message: string; dataset: ProcessedDataset }> {
    const response = await fetch(`${this.baseUrl}/${datasetId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to update dataset');
    }

    return response.json();
  }

  /**
   * Delete a dataset and its data
   */
  async deleteDataset(datasetId: string): Promise<{
    success: boolean;
    message: string;
    dataset_id: string;
  }> {
    const response = await fetch(`${this.baseUrl}/${datasetId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to delete dataset');
    }

    return response.json();
  }

  /**
   * Download a dataset as JSON file
   */
  async downloadDataset(datasetId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/${datasetId}/download`);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to download dataset');
    }

    // Get filename from response headers or use default
    const contentDisposition = response.headers.get('content-disposition');
    let filename = 'dataset.json';
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
   * Track dataset usage (called when dataset is used for training)
   */
  async trackUsage(datasetId: string): Promise<{
    success: boolean;
    dataset_id: string;
    usage_count: number;
    last_used: string;
  }> {
    const response = await fetch(`${this.baseUrl}/${datasetId}/use`, {
      method: 'POST',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to track usage');
    }

    return response.json();
  }

  /**
   * Duplicate an existing dataset
   */
  async duplicateDataset(datasetId: string, newName: string): Promise<{
    success: boolean;
    message: string;
    original_dataset_id: string;
    new_dataset_id: string;
    new_dataset: ProcessedDataset;
  }> {
    const response = await fetch(`${this.baseUrl}/${datasetId}/duplicate?new_name=${encodeURIComponent(newName)}`, {
      method: 'POST',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to duplicate dataset');
    }

    return response.json();
  }

  /**
   * Get overview statistics for all datasets
   */
  async getOverview(): Promise<{ success: boolean; overview: DatasetOverview }> {
    const response = await fetch(`${this.baseUrl}/stats/overview`);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to get overview');
    }

    return response.json();
  }

  /**
   * Format file size in human readable format
   */
  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Format date in human readable format
   */
  formatDate(dateString: string): string {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
    } catch {
      return dateString;
    }
  }

  /**
   * Format relative time (e.g., "2 hours ago")
   */
  formatRelativeTime(dateString: string): string {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      
      if (diffMinutes < 1) return 'Just now';
      if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;
      if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
      if (diffDays < 30) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
      
      return this.formatDate(dateString);
    } catch {
      return dateString;
    }
  }

  /**
   * Get dataset status color based on usage
   */
  getDatasetStatusColor(dataset: ProcessedDataset): string {
    if (dataset.usage_count === 0) return 'text-gray-500';
    if (dataset.usage_count < 5) return 'text-blue-500';
    if (dataset.usage_count < 10) return 'text-green-500';
    return 'text-purple-500';
  }

  /**
   * Get dataset status label
   */
  getDatasetStatusLabel(dataset: ProcessedDataset): string {
    if (dataset.usage_count === 0) return 'Unused';
    if (dataset.usage_count < 5) return 'Lightly used';
    if (dataset.usage_count < 10) return 'Frequently used';
    return 'Heavily used';
  }

  /**
   * Validate dataset name
   */
  validateDatasetName(name: string): { isValid: boolean; error?: string } {
    if (!name || name.trim().length === 0) {
      return { isValid: false, error: 'Dataset name is required' };
    }
    
    if (name.length > 100) {
      return { isValid: false, error: 'Dataset name must be less than 100 characters' };
    }
    
    // Check for invalid characters
    const invalidChars = /[<>:"/\\|?*]/;
    if (invalidChars.test(name)) {
      return { isValid: false, error: 'Dataset name contains invalid characters' };
    }
    
    return { isValid: true };
  }

  /**
   * Generate suggested dataset name based on source file
   */
  generateDatasetName(sourceFilename: string, columnMapping: ColumnMapping): string {
    const baseName = sourceFilename.replace(/\.[^/.]+$/, ''); // Remove extension
    const instructionCount = columnMapping.instruction_columns.length;
    const outputCount = columnMapping.output_columns.length;
    
    return `${baseName}_${instructionCount}inst_${outputCount}out`;
  }
}

export const datasetService = new DatasetService();
export default datasetService;
