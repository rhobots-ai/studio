import { TrainingConfig } from '../config/training';
import { Model } from './chatApi';

export interface TrainingFile {
  name: string;
  size: number;
  recordCount?: number;
  type: string;
  fileId?: string; // For backend file management
}

export interface TrainingSession {
  id: string;
  status: 'not_started' | 'initializing' | 'training' | 'validating' | 'finalizing' | 'completed' | 'failed';
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  
  // Model Configuration
  selectedModel: Model;
  modelName: string;
  
  // Dataset Information
  files: TrainingFile[];
  totalExamples: number;
  totalSize: number;
  trainValidationSplit: number;
  
  // Training Configuration
  parameters: {
    epochs: number;
    learningRate: number;
    batchSize: number;
    maxSequenceLength: number;
    cutoff: number;
  };
  trainingConfig: TrainingConfig;
  
  // Progress Metrics
  progress: {
    currentEpoch: number;
    totalEpochs: number;
    currentStep: number;
    totalSteps: number;
    progressPercent: number;
    timeElapsed: number;
    timeRemaining: number;
  };
  
  // Training Metrics
  metrics: {
    trainingLoss?: number;
    validationLoss?: number;
    learningRate?: number;
    gradNorm?: number;
    stepTime?: number;
    avgStepTime?: number;
  };
  
  // Final Results
  finalMetrics?: {
    finalValidationLoss: number;
    improvementPercent: number;
    bestEpoch: number;
  };
}

class TrainingSessionService {
  private static instance: TrainingSessionService;
  private currentSession: TrainingSession | null = null;
  private readonly STORAGE_KEY = 'training_session';

  private constructor() {
    this.loadSessionFromStorage();
  }

  static getInstance(): TrainingSessionService {
    if (!TrainingSessionService.instance) {
      TrainingSessionService.instance = new TrainingSessionService();
    }
    return TrainingSessionService.instance;
  }

  createSession(
    selectedModel: Model,
    files: File[],
    parameters: TrainingSession['parameters'],
    trainingConfig: TrainingConfig,
    modelName: string
  ): TrainingSession {
    // Calculate dataset statistics
    const trainingFiles: TrainingFile[] = files.map(file => ({
      name: file.name,
      size: file.size,
      type: file.type || 'application/json',
      recordCount: this.estimateRecordCount(file)
    }));

    const totalSize = trainingFiles.reduce((sum, file) => sum + file.size, 0);
    const totalExamples = trainingFiles.reduce((sum, file) => sum + (file.recordCount || 0), 0);

    const session: TrainingSession = {
      id: this.generateSessionId(), // This will be updated with backend session ID
      status: 'not_started',
      createdAt: new Date().toISOString(),
      
      selectedModel,
      modelName,
      
      files: trainingFiles,
      totalExamples,
      totalSize,
      trainValidationSplit: parameters.cutoff,
      
      parameters,
      trainingConfig,
      
      progress: {
        currentEpoch: 0,
        totalEpochs: parameters.epochs,
        currentStep: 0,
        totalSteps: 0,
        progressPercent: 0,
        timeElapsed: 0,
        timeRemaining: 0
      },
      
      metrics: {}
    };

    this.currentSession = session;
    this.saveSessionToStorage();
    return session;
  }

  createSessionWithFileId(
    selectedModel: Model,
    fileId: string,
    fileMetadata: { name: string; size: number; recordCount: number; type: string },
    parameters: TrainingSession['parameters'],
    trainingConfig: TrainingConfig,
    modelName: string
  ): TrainingSession {
    // Create training file info from file metadata
    const trainingFiles: TrainingFile[] = [{
      name: fileMetadata.name,
      size: fileMetadata.size,
      type: fileMetadata.type,
      recordCount: fileMetadata.recordCount,
      fileId: fileId
    }];

    const session: TrainingSession = {
      id: this.generateSessionId(), // This will be updated with backend session ID
      status: 'not_started',
      createdAt: new Date().toISOString(),
      
      selectedModel,
      modelName,
      
      files: trainingFiles,
      totalExamples: fileMetadata.recordCount,
      totalSize: fileMetadata.size,
      trainValidationSplit: parameters.cutoff,
      
      parameters,
      trainingConfig,
      
      progress: {
        currentEpoch: 0,
        totalEpochs: parameters.epochs,
        currentStep: 0,
        totalSteps: 0,
        progressPercent: 0,
        timeElapsed: 0,
        timeRemaining: 0
      },
      
      metrics: {}
    };

    this.currentSession = session;
    this.saveSessionToStorage();
    return session;
  }

  updateSessionId(backendSessionId: string): void {
    if (!this.currentSession) {
      console.warn('No current session to update with backend session ID');
      return;
    }
    
    console.log(`Updating session ID from ${this.currentSession.id} to ${backendSessionId}`);
    this.currentSession.id = backendSessionId;
    this.saveSessionToStorage();
  }

  // Get the unique training URL for a session
  getTrainingUrl(sessionId?: string): string {
    const id = sessionId || this.currentSession?.id;
    if (!id) return '/progress';
    return `/training/${id}`;
  }

  // Get the full shareable URL for a session
  getShareableUrl(sessionId?: string): string {
    const id = sessionId || this.currentSession?.id;
    if (!id) return window.location.origin + '/progress';
    return window.location.origin + `/training/${id}`;
  }

  getCurrentSession(): TrainingSession | null {
    return this.currentSession;
  }

  updateSessionStatus(status: TrainingSession['status']): void {
    if (!this.currentSession) return;
    
    this.currentSession.status = status;
    
    if (status === 'training' && !this.currentSession.startedAt) {
      this.currentSession.startedAt = new Date().toISOString();
    }
    
    if (status === 'completed' || status === 'failed') {
      this.currentSession.completedAt = new Date().toISOString();
    }
    
    this.saveSessionToStorage();
  }

  updateProgress(progress: Partial<TrainingSession['progress']>): void {
    if (!this.currentSession) return;
    
    this.currentSession.progress = {
      ...this.currentSession.progress,
      ...progress
    };
    
    this.saveSessionToStorage();
  }

  updateMetrics(metrics: Partial<TrainingSession['metrics']>): void {
    if (!this.currentSession) return;
    
    this.currentSession.metrics = {
      ...this.currentSession.metrics,
      ...metrics
    };
    
    this.saveSessionToStorage();
  }

  setFinalMetrics(finalMetrics: TrainingSession['finalMetrics']): void {
    if (!this.currentSession) return;
    
    this.currentSession.finalMetrics = finalMetrics;
    this.saveSessionToStorage();
  }

  clearSession(): void {
    this.currentSession = null;
    localStorage.removeItem(this.STORAGE_KEY);
  }

  // Helper methods
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private estimateRecordCount(file: File): number {
    // For JSON files, try to get a better estimate
    if (file.type === 'application/json' || file.name.endsWith('.json')) {
      // Estimate based on typical training data structure
      // Assume each record is around 150-300 bytes on average
      const avgRecordSize = 250;
      return Math.floor(file.size / avgRecordSize);
    }
    
    // For JSONL files (one JSON object per line)
    if (file.name.endsWith('.jsonl')) {
      // Estimate based on file size and typical line length
      const avgLineSize = 200;
      return Math.floor(file.size / avgLineSize);
    }
    
    // Default fallback
    return Math.floor(file.size / 200);
  }

  private saveSessionToStorage(): void {
    if (this.currentSession) {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.currentSession));
    }
  }

  private loadSessionFromStorage(): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        this.currentSession = JSON.parse(stored);
      }
    } catch (error) {
      console.error('Failed to load training session from storage:', error);
      this.currentSession = null;
    }
  }

  // Utility methods for formatting
  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  formatTrainValidationSplit(cutoff: number): string {
    const trainPercent = Math.round(cutoff * 100);
    const validationPercent = 100 - trainPercent;
    return `${trainPercent}% training, ${validationPercent}% validation`;
  }

  getTrainingMethodLabel(): string {
    // For now, we're using LoRA as the primary method
    // This could be made configurable in the future
    return 'LoRA';
  }
}

export default TrainingSessionService.getInstance();
