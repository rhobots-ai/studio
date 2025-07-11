import { API_BASE_URL, API_BASE_URL_WITH_API } from '../config/api';

export interface ColumnConfig {
  column_name: string;
  role: 'primary' | 'context' | 'metadata';
  weight?: number;
  format_type?: 'text' | 'json' | 'list' | 'table';
  custom_template?: string;
}


export interface ColumnMapping {
  static_instruction?: string;
  instruction_columns: ColumnConfig[];
  instruction_template: string;
  input_columns: ColumnConfig[];
  output_columns: ColumnConfig[];
  output_template: string;
  ignored_columns?: string[];
  mapping_name?: string;
  description?: string;
  created_at?: string;
}

export interface ColumnInfo {
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
}

export interface TrainingExample {
  instruction: string;
  input: string | Record<string, any>;
  output: string | Record<string, any>;
}

export interface FileMetadata {
  file_id: string;
  display_name: string;
  original_filename: string;
  stored_filename: string;
  file_type: string;
  file_size: number;
  upload_date: string;
  last_used: string | null;
  usage_count: number;
  validation_status: 'valid' | 'invalid' | 'pending';
  validation_details: {
    status: string;
    total_rows: number;
    columns: string[];
    file_type: string;
    sample_data: any[];
    null_counts: Record<string, number>;
    issues: string[];
    column_types?: Record<string, string>;
    column_stats?: Record<string, ColumnInfo>;
  };
  tags: string[];
  used_in_sessions: string[];
  column_mapping?: ColumnMapping;
  has_mapping?: boolean;
}

export interface FileUploadResponse {
  success: boolean;
  file_id?: string;
  message: string;
  metadata?: FileMetadata;
}

export interface FileListResponse {
  files: FileMetadata[];
  total: number;
  storage_stats: {
    total_files: number;
    total_size_bytes: number;
    total_size_mb: number;
    type_counts: Record<string, number>;
    status_counts: Record<string, number>;
  };
}

export interface FilePreviewResponse {
  success: boolean;
  file_id: string;
  preview_data: any[];
  total_rows: number;
  showing_rows: number;
  columns: string[];
}

export interface ColumnInfoResponse {
  success: boolean;
  file_id: string;
  available_columns: string[];
  column_info: Record<string, ColumnInfo>;
  total_rows: number;
  file_stats: {
    total_columns: number;
    total_rows: number;
    memory_usage: number;
  };
}

export interface ValidationResult {
  is_valid: boolean;
  issues: string[];
  warnings: string[];
  mapped_columns: string[];
  unused_columns: string[];
}

export interface MappedPreviewResponse {
  success: boolean;
  file_id: string;
  preview_data: TrainingExample[];
  total_rows: number;
  showing_rows: number;
  mapping_applied: ColumnMapping;
}

export interface ProcessedFileResponse {
  success: boolean;
  file_id: string;
  processed_data: TrainingExample[];
  total_examples: number;
  processing_stats: {
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
  };
}

class FileService {
  private baseUrl = `${API_BASE_URL_WITH_API}/files`;

  /**
   * Upload a file using multipart form data
   */
  async uploadFile(file: File, displayName?: string): Promise<FileUploadResponse> {
    const formData = new FormData();
    formData.append('file', file);
    if (displayName) {
      formData.append('display_name', displayName);
    }

    const uploadUrl = `${this.baseUrl}/upload`;
    console.log('FileService: Uploading to URL:', uploadUrl);
    console.log('FileService: Base URL:', this.baseUrl);
    console.log('FileService: FormData contents:', {
      file: file.name,
      size: file.size,
      type: file.type,
      displayName
    });

    try {
      const response = await fetch(uploadUrl, {
        method: 'POST',
        body: formData,
      });

      console.log('FileService: Response status:', response.status);
      console.log('FileService: Response headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        let errorText;
        try {
          const error = await response.json();
          errorText = error.detail || error.message || 'Failed to upload file';
          console.error('FileService: Error response JSON:', error);
        } catch (jsonError) {
          errorText = await response.text();
          console.error('FileService: Error response text:', errorText);
        }
        throw new Error(`Upload failed (${response.status}): ${errorText}`);
      }

      const result = await response.json();
      console.log('FileService: Success response:', result);
      return result;
    } catch (error) {
      console.error('FileService: Network or parsing error:', error);
      throw error;
    }
  }

  /**
   * Upload a file using base64 encoding
   */
  async uploadFileBase64(
    fileContent: string,
    originalFilename: string,
    displayName?: string
  ): Promise<FileUploadResponse> {
    const response = await fetch(`${this.baseUrl}/upload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        file_content: fileContent,
        original_filename: originalFilename,
        display_name: displayName,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to upload file');
    }

    return response.json();
  }

  /**
   * Get detailed column information for a file
   */
  async getColumnInfo(fileId: string): Promise<ColumnInfoResponse> {
    const response = await fetch(`${this.baseUrl}/${fileId}/column-info`);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to get column info');
    }

    return response.json();
  }

  /**
   * Validate a column mapping configuration
   */
  async validateMapping(fileId: string, columnMapping: ColumnMapping): Promise<{
    success: boolean;
    file_id: string;
    validation: ValidationResult;
  }> {
    const response = await fetch(`${this.baseUrl}/${fileId}/validate-mapping`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        file_id: fileId,
        column_mapping: columnMapping,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to validate mapping');
    }

    return response.json();
  }

  /**
   * Save column mapping configuration for a file
   */
  async saveColumnMapping(fileId: string, columnMapping: ColumnMapping): Promise<{
    success: boolean;
    message: string;
    file_id: string;
    validation_status?: string;
  }> {
    const response = await fetch(`${this.baseUrl}/${fileId}/map-columns`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        file_id: fileId,
        column_mapping: columnMapping,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to save column mapping');
    }

    return response.json();
  }

  /**
   * Preview how data will look with applied column mapping
   */
  async previewMappedData(fileId: string, columnMapping: ColumnMapping, limit: number = 10): Promise<MappedPreviewResponse> {
    const response = await fetch(`${this.baseUrl}/${fileId}/preview-mapped`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        file_id: fileId,
        column_mapping: columnMapping,
        limit,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to preview mapped data');
    }

    return response.json();
  }

  /**
   * Process the entire file with the given column mapping
   */
  async processCompleteFile(fileId: string, columnMapping: ColumnMapping): Promise<ProcessedFileResponse> {
    const response = await fetch(`${this.baseUrl}/${fileId}/process-complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        file_id: fileId,
        column_mapping: columnMapping,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to process file');
    }

    return response.json();
  }

  /**
   * Get current column mapping for a file
   */
  async getFileMapping(fileId: string): Promise<{
    success: boolean;
    file_id: string;
    column_mapping: ColumnMapping;
    has_mapping: boolean;
  }> {
    const response = await fetch(`${this.baseUrl}/${fileId}/mapping`);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to get file mapping');
    }

    return response.json();
  }

  /**
   * Remove column mapping from a file
   */
  async removeFileMapping(fileId: string): Promise<{
    success: boolean;
    message: string;
    file_id: string;
  }> {
    const response = await fetch(`${this.baseUrl}/${fileId}/mapping`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to remove file mapping');
    }

    return response.json();
  }

  /**
   * List all uploaded files with optional filtering and sorting
   */
  async listFiles(
    filterBy?: string,
    sortBy: string = 'upload_date',
    sortDesc: boolean = true
  ): Promise<FileListResponse> {
    const params = new URLSearchParams({
      sort_by: sortBy,
      sort_desc: sortDesc.toString(),
    });

    if (filterBy) {
      params.append('filter_by', filterBy);
    }

    const response = await fetch(`${this.baseUrl}?${params}`);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to list files');
    }

    return response.json();
  }

  /**
   * Get detailed information about a specific file
   */
  async getFileInfo(fileId: string): Promise<{ success: boolean; file_info: FileMetadata }> {
    const response = await fetch(`${this.baseUrl}/${fileId}`);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to get file info');
    }

    return response.json();
  }

  /**
   * Get preview data for a file
   */
  async getFilePreview(fileId: string, limit: number = 10): Promise<FilePreviewResponse> {
    const response = await fetch(`${this.baseUrl}/${fileId}/preview?limit=${limit}`);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to get file preview');
    }

    return response.json();
  }

  /**
   * Delete a file
   */
  async deleteFile(fileId: string): Promise<{ success: boolean; message: string; file_id: string }> {
    const response = await fetch(`${this.baseUrl}/${fileId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to delete file');
    }

    return response.json();
  }

  /**
   * Convert file to base64 string
   */
  fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Remove data URL prefix (e.g., "data:application/json;base64,")
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
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
   * Get file type icon
   */
  getFileTypeIcon(fileType: string): string {
    switch (fileType.toLowerCase()) {
      case 'json':
        return '📄';
      case 'csv':
        return '📊';
      case 'jsonl':
        return '📝';
      case 'excel':
        return '📈';
      case 'pickle':
        return '🥒';
      default:
        return '📁';
    }
  }

  /**
   * Get validation status color
   */
  getValidationStatusColor(status: string): string {
    switch (status) {
      case 'valid':
        return 'text-green-600';
      case 'invalid':
        return 'text-red-600';
      case 'pending':
        return 'text-yellow-600';
      default:
        return 'text-gray-600';
    }
  }

  /**
   * Get validation status icon
   */
  getValidationStatusIcon(status: string): string {
    switch (status) {
      case 'valid':
        return '✅';
      case 'invalid':
        return '❌';
      case 'pending':
        return '⏳';
      default:
        return '❓';
    }
  }

  /**
   * Download processed training data as JSON
   */
  downloadTrainingData(data: TrainingExample[], filename: string = 'training_data.json'): void {
    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
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
   * Export processing statistics as JSON
   */
  downloadProcessingStats(stats: any, filename: string = 'processing_stats.json'): void {
    const jsonString = JSON.stringify(stats, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
  }
}

export const fileService = new FileService();
export default fileService;
