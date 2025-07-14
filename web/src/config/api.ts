// Enhanced environment-aware API configuration
const getApiBaseUrl = (): string => {
  // Priority: Environment variable > Development proxy > Production fallback
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }
  return "";
};

export const API_BASE_URL = getApiBaseUrl();

// Full API URL with /api suffix for services that need it
export const API_BASE_URL_WITH_API = `${API_BASE_URL}${API_BASE_URL.endsWith('/api') ? '' : '/api'}`;


export const API_ENDPOINTS = {
  // File management
  FILES: '/api/files',
  FILE_UPLOAD: '/api/files/upload',
  FILE_LIST: '/api/files',
  FILE_INFO: (fileId: string) => `/api/files/${fileId}`,
  FILE_PREVIEW: (fileId: string) => `/api/files/${fileId}/preview`,
  FILE_DOWNLOAD: (fileId: string) => `/api/files/${fileId}/download`,
  FILE_DELETE: (fileId: string) => `/api/files/${fileId}`,
  FILE_UPDATE: (fileId: string) => `/api/files/${fileId}`,
  FILE_REVALIDATE: (fileId: string) => `/api/files/${fileId}/revalidate`,
  FILE_STATS: '/api/files/stats',

  // Training
  FINETUNE: '/finetune',
  FINETUNE_WITH_FILE: '/finetune-with-file',
  JOBS: '/jobs',
  JOB_STATUS: (jobId: string) => `/jobs/${jobId}`,
  JOB_LOGS: (jobId: string) => `/logs/${jobId}`,

  // Models
  MODELS_AVAILABLE: '/models/available',
  MODELS_HUGGINGFACE: '/models/huggingface',
  MODELS_HUGGINGFACE_SEARCH: '/models/huggingface/search',
  MODELS_STATUS: '/models/status',
  MODELS_LOAD: '/models/load',
  MODELS_UNLOAD: '/models/unload',

  // Chat
  CHAT_SINGLE: '/chat/single',
  CHAT_CONVERSATION: '/chat/conversation',
  CHAT_QUICK: '/chat/quick',
  CHAT_STREAM: '/chat/stream',

  // Evaluation
  EVALUATE_PREDICT: '/evaluate/predict',
  EVALUATE_PREDICT_FILE: '/evaluate/predict-file',
  EVALUATE_STATUS: (jobId: string) => `/evaluate/status/${jobId}`,
  EVALUATE_RESULTS: (jobId: string) => `/evaluate/results/${jobId}`,
  EVALUATE_JOBS: '/evaluate/jobs',

  // Configuration
  CONFIGS_SAVE: '/api/configs/save',
  CONFIGS_LIST: '/api/configs/list',
  CONFIGS_LOAD: (configName: string) => `/api/configs/${configName}`,
  CONFIGS_DELETE: (configName: string) => `/api/configs/${configName}`,

  // Training sessions
  TRAINING_SESSIONS: '/api/training/sessions',
  TRAINING_SESSION_STATUS: (sessionId: string) => `/api/training/${sessionId}/status`,
  TRAINING_SESSION_LOGS: (sessionId: string) => `/api/training/${sessionId}/logs`,
  TRAINING_SESSION_METRICS: (sessionId: string) => `/api/training/${sessionId}/metrics`,
  TRAINING_SESSION_FILES: (sessionId: string) => `/api/training/${sessionId}/files`,
  TRAINING_SESSION_DELETE: (sessionId: string) => `/api/training/${sessionId}`,
  TRAINING_DASHBOARD_STATS: '/api/training/dashboard/stats',

  // Monitoring
  LOGS: '/api/logs',
  STATUS: '/api/status',
};

export const DEFAULT_REQUEST_OPTIONS: RequestInit = {
  headers: {
    'Content-Type': 'application/json',
    'Accept': '*/*',
  },
};

export const MULTIPART_REQUEST_OPTIONS: Omit<RequestInit, 'body'> = {
  headers: {
    'Accept': '*/*',
  },
};
