import { API_BASE_URL_WITH_API } from '../config/api';

// Configuration management service
export interface ConfigMetadata {
  name: string;
  description: string;
  created_at: string;
  version: string;
  filename: string;
}

export interface SavedConfig {
  metadata: ConfigMetadata;
  basic_parameters: Record<string, any>;
  advanced_parameters: Record<string, any>;
}

export interface ConfigSaveRequest {
  name: string;
  description?: string;
  basic_parameters: Record<string, any>;
  advanced_parameters: Record<string, any>;
}

export interface ConfigResponse {
  status: string;
  message: string;
  config_name?: string;
}

export interface ConfigListResponse {
  status: string;
  configs: ConfigMetadata[];
  total: number;
}

export interface ConfigLoadResponse {
  status: string;
  message: string;
  config: SavedConfig;
}

class ConfigService {
  private get baseUrl() {
    return `${API_BASE_URL_WITH_API}/configs`;
  }

  async saveConfiguration(request: ConfigSaveRequest): Promise<ConfigResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/save`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error saving configuration:', error);
      throw error;
    }
  }

  async listConfigurations(): Promise<ConfigListResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/list`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error listing configurations:', error);
      throw error;
    }
  }

  async loadConfiguration(configName: string): Promise<ConfigLoadResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/${encodeURIComponent(configName)}`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error loading configuration:', error);
      throw error;
    }
  }

  async deleteConfiguration(configName: string): Promise<ConfigResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/${encodeURIComponent(configName)}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error deleting configuration:', error);
      throw error;
    }
  }
}

export const configService = new ConfigService();
