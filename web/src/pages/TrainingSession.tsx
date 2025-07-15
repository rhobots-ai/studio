import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card'; 
import { Button } from '../components/ui/Button';
import { Progress } from '../components/ui/Progress';
import { Badge } from '../components/ui/Badge';
import { Timer, CheckCircle2, ChevronDown, Play, Pause, FileDown, ArrowUpRight, Share2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import TrainingLossChart from '../components/training/TrainingLossChart';
import { API_BASE_URL_WITH_API } from '../config/api';

interface LogEntry {
  timestamp: string;
  type: string;
  level: string;
  message: string;
  step?: number;
  epoch?: number;
  step_time?: number;
  avg_step_time?: number;
  eta_minutes?: number;
  learning_rate?: number;
  loss?: number;
  grad_norm?: number;
  progress_percent?: number;
  remaining_steps?: number;
  train_loss?: number;
  eval_loss?: number;
  epoch_progress?: string;
  total_epochs?: number;
  metrics?: Record<string, unknown>;
  config?: Record<string, unknown>;
}

interface TrainingSessionData {
  session_id: string;
  status: string;
  config: Record<string, any>;
  dataset_info: Record<string, any>;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  progress?: Record<string, any>;
  logs: LogEntry[];
  error?: string;
}

export default function TrainingSession() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  
  const [sessionData, setSessionData] = useState<TrainingSessionData | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [progress, setProgress] = useState(0);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(0);

  // Function to fetch session data from the API
  const fetchSessionData = async (): Promise<void> => {
    if (!sessionId) return;
    
    try {
      const response = await fetch(`${API_BASE_URL_WITH_API}/training/${sessionId}/status`);
      if (!response.ok) {
        if (response.status === 404) {
          setError('Training session not found');
          return;
        }
        throw new Error(`Error fetching session data: ${response.statusText}`);
      }
      const data = await response.json();
      setSessionData(data);
      setError(null);
    } catch (error) {
      console.error('Failed to fetch session data:', error);
      setError('Failed to load training session data');
    }
  };

  // Function to fetch logs from the API
  const fetchLogsFromAPI = async (): Promise<LogEntry[]> => {
    if (!sessionId) return [];
    
    try {
      const response = await fetch(`${API_BASE_URL_WITH_API}/training/${sessionId}/logs`);
      if (!response.ok) {
        throw new Error(`Error fetching logs: ${response.statusText}`);
      }
      const data = await response.json();
      return data.logs || [];
    } catch (error) {
      console.error('Failed to fetch logs:', error);
      return [];
    }
  };

  // Function to extract progress from training_step logs
  const getProgressFromLogs = (logs: LogEntry[]): number => {
    const trainingStepLogs = logs.filter(log => log.type === 'training_step');
    if (trainingStepLogs.length === 0) return 0;
    
    // Get the latest training_step log's progress_percent
    const latestTrainingLog = trainingStepLogs[trainingStepLogs.length - 1];
    return latestTrainingLog.progress_percent || 0;
  };

  // Function to calculate estimated remaining time from logs
  const calculateEstimatedRemainingTime = (logs: LogEntry[]): number => {
    // Method 1: Use backend's ETA (most accurate)
    const latestTrainingStep = logs
      .filter(log => log.type === 'training_step')
      .pop();
    
    if (latestTrainingStep?.eta_minutes !== undefined) {
      return Math.round(latestTrainingStep.eta_minutes * 60); // Convert to seconds
    }
    
    // Method 2: Fallback to remaining_steps * avg_step_time
    if (latestTrainingStep?.remaining_steps && latestTrainingStep?.avg_step_time) {
      return Math.round(latestTrainingStep.remaining_steps * latestTrainingStep.avg_step_time);
    }
    
    // Method 3: Fallback to progress-based calculation
    const currentProgress = latestTrainingStep?.progress_percent || 0;
    if (currentProgress > 0) {
      const trainingSteps = logs.filter(log => log.type === 'training_step');
      if (trainingSteps.length >= 2) {
        const firstStep = trainingSteps[0];
        const lastStep = trainingSteps[trainingSteps.length - 1];
        const elapsedMs = new Date(lastStep.timestamp).getTime() - new Date(firstStep.timestamp).getTime();
        const timePerPercent = elapsedMs / currentProgress;
        const remainingPercent = 100 - currentProgress;
        return Math.round((timePerPercent * remainingPercent) / 1000);
      }
    }
    
    return 0;
  };

  // Function to get latest training metrics from logs
  const getLatestTrainingMetrics = (logs: LogEntry[]) => {
    // Get loss from metrics logs
    const latestMetricsLog = logs
      .filter(log => log.type === 'metrics' && log.metrics?.loss !== undefined)
      .pop();
    
    // Get other training info from training_step logs
    const latestTrainingStep = logs
      .filter(log => log.type === 'training_step')
      .pop();
    
    return {
      loss: latestMetricsLog?.metrics?.loss ? (latestMetricsLog.metrics.loss as number).toFixed(4) : 'N/A',
      learningRate: (latestMetricsLog?.metrics?.learning_rate as number)?.toExponential(2) || latestTrainingStep?.learning_rate?.toExponential(2) || 'N/A',
      step: latestTrainingStep?.step || latestMetricsLog?.step || 0,
      remainingSteps: latestTrainingStep?.remaining_steps || 0,
      gradNorm: (latestMetricsLog?.metrics?.grad_norm as number)?.toFixed(6) || latestTrainingStep?.grad_norm?.toFixed(6) || 'N/A',
      stepTime: latestTrainingStep?.step_time?.toFixed(3) || 'N/A',
      avgStepTime: latestTrainingStep?.avg_step_time?.toFixed(3) || 'N/A'
    };
  };

  // Function to get latest validation metrics from logs
  const getLatestValidationMetrics = (logs: LogEntry[]) => {
    const latestEpochEnd = logs
      .filter(log => log.type === 'epoch_end')
      .pop();
    
    return {
      evalLoss: latestEpochEnd?.eval_loss?.toFixed(4) || 'N/A',
      trainLoss: latestEpochEnd?.train_loss?.toFixed(4) || 'N/A'
    };
  };

  // Function to get current epoch information
  const getCurrentEpochInfo = (logs: LogEntry[]) => {
    const latestTrainingStep = logs
      .filter(log => log.type === 'training_step')
      .pop();
    
    const latestEpochBegin = logs
      .filter(log => log.type === 'epoch_begin')
      .pop();
    
    const currentEpoch = latestTrainingStep?.epoch || 0;
    const totalEpochs = latestEpochBegin?.total_epochs || sessionData?.config?.num_train_epochs || 3;
    
    return {
      current: Math.floor(currentEpoch),
      total: totalEpochs,
      display: `${Math.floor(currentEpoch)}/${totalEpochs}`
    };
  };

  // Function to copy URL to clipboard
  const copyTrainingUrl = async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      alert('Training URL copied to clipboard!');
    } catch (err) {
      console.error('Failed to copy URL:', err);
    }
  };

  // Calculate elapsed time
  useEffect(() => {
    if (sessionData?.started_at && sessionData.status !== 'completed') {
      const startTime = new Date(sessionData.started_at).getTime();
      const interval = setInterval(() => {
        const now = new Date().getTime();
        const elapsed = Math.floor((now - startTime) / 1000);
        setTimeElapsed(elapsed);
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [sessionData?.started_at, sessionData?.status]);

  // Main data fetching effect
  useEffect(() => {
    if (!sessionId) {
      setError('No session ID provided');
      setLoading(false);
      return;
    }

    // Initial fetch
    fetchSessionData().then(() => setLoading(false));

    if (isPaused) return;

    const interval = setInterval(async () => {
      await fetchSessionData();
      const fetchedLogs = await fetchLogsFromAPI();
      setLogs(fetchedLogs);
      
      // Update progress and time estimates
      const currentProgress = getProgressFromLogs(fetchedLogs);
      setProgress(currentProgress);

      const estimatedRemaining = calculateEstimatedRemainingTime(fetchedLogs);
      setTimeRemaining(estimatedRemaining);
    }, 3000); // Update every 3 seconds

    return () => clearInterval(interval);
  }, [sessionId, isPaused]);

  // Helper to format time (seconds to hr:mm:ss)
  const formatTime = (timeInSeconds: number) => {
    const hours = Math.floor(timeInSeconds / 3600);
    const minutes = Math.floor((timeInSeconds % 3600) / 60);
    const seconds = timeInSeconds % 60;
    return `${hours}:${minutes < 10 ? '0' : ''}${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  const getStatusVariant = (status: string): 'primary' | 'secondary' | 'success' | 'error' => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'training':
      case 'validating':
        return 'primary';
      case 'failed':
        return 'error';
      default:
        return 'secondary';
    }
  };

  const getStatusLabel = (status: string): string => {
    switch (status) {
      case 'queued':
        return 'Queued';
      case 'initializing':
        return 'Initializing';
      case 'training':
        return 'Training';
      case 'validating':
        return 'Validating';
      case 'finalizing':
        return 'Finalizing';
      case 'completed':
        return 'Completed';
      case 'failed':
        return 'Failed';
      default:
        return 'Unknown';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading training session...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="bg-red-100 dark:bg-red-900/20 rounded-full p-3 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
            <CheckCircle2 className="h-8 w-8 text-red-600 dark:text-red-400" />
          </div>
          <h3 className="font-semibold text-lg text-red-800 dark:text-red-300 mb-2">
            Error Loading Session
          </h3>
          <p className="text-red-700 dark:text-red-400 mb-4">{error}</p>
          <Button variant="outline" onClick={() => navigate('/progress')}>
            Back to Training Progress
          </Button>
        </div>
      </div>
    );
  }

  if (!sessionData) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <p className="text-gray-600 dark:text-gray-400">No session data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Training Session</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Session ID: {sessionId}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={copyTrainingUrl}
            leftIcon={<Share2 className="h-4 w-4" />}
          >
            Share Session
          </Button>
          <Badge variant={getStatusVariant(sessionData.status)}>
            {getStatusLabel(sessionData.status)}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Training Progress</CardTitle>
                <Badge variant={getStatusVariant(sessionData.status)}>
                  {getStatusLabel(sessionData.status)}
                </Badge>
              </div>
              <CardDescription>
                Real-time monitoring of your model training session
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <Progress
                value={progress}
                size="lg"
                variant={
                  sessionData.status === 'completed' ? 'success' :
                  progress >= 80 ? 'warning' :
                  progress >= 40 ? 'secondary' :
                  'primary'
                }
                showValue={true}
              />

              <div className="flex justify-between text-sm">
                <div className="flex items-center gap-1.5">
                  <Timer className="h-4 w-4 text-gray-500" />
                  <span className="text-gray-700 dark:text-gray-300">
                    Time elapsed: <span className="font-medium">{formatTime(timeElapsed)}</span>
                  </span>
                </div>

                {timeRemaining > 0 ? (
                  <div className="text-gray-700 dark:text-gray-300">
                    Estimated remaining: <span className="font-medium">{formatTime(timeRemaining)}</span>
                  </div>
                ) : sessionData.status === 'completed' ? (
                  <div className="flex items-center gap-1.5 text-success-600 dark:text-success-400">
                    <CheckCircle2 className="h-4 w-4" />
                    <span className="font-medium">Completed</span>
                  </div>
                ) : null}
              </div>

              <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => setShowDetails(!showDetails)}
                  className="flex items-center text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors"
                >
                  <span>{showDetails ? 'Hide' : 'Show'} training details</span>
                  <ChevronDown className={`h-4 w-4 ml-1 transform transition-transform ${showDetails ? 'rotate-180' : ''}`} />
                </button>

                <AnimatePresence>
                  {showDetails && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="mt-3 overflow-hidden"
                    >
                      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-md p-3 max-h-64 overflow-y-auto font-mono text-xs">
                        {logs.map((log: LogEntry, index: number) => (
                          <div key={index} className="py-1">
                            <span className="text-gray-500 dark:text-gray-400">
                              {`[${new Date(log.timestamp).toLocaleTimeString()}]`}
                            </span>{' '}
                            <span>{log.message}</span>
                          </div>
                        ))}
                        {sessionData.status !== 'completed' && !isPaused && logs.length > 0 && (
                          <div className="py-1 animate-pulse">
                            <span className="text-gray-500 dark:text-gray-400">[{formatTime(timeElapsed)}]</span>{' '}
                            <span>_</span>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {sessionData.status !== 'completed' && sessionData.status !== 'failed' && (
                <div className="flex justify-center pt-2">
                  <Button
                    variant={isPaused ? 'primary' : 'outline'}
                    onClick={() => setIsPaused(!isPaused)}
                    leftIcon={isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                  >
                    {isPaused ? 'Resume Monitoring' : 'Pause Monitoring'}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Training Loss Chart - Show when training has started */}
          {logs.length > 0 && (
            <TrainingLossChart logs={logs} height={350} />
          )}

          {sessionData.status === 'completed' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Card className="bg-success-50 dark:bg-success-900/10 border-success-200 dark:border-success-800">
                <CardContent className="p-6">
                  <div className="flex items-start space-x-4">
                    <div className="bg-white dark:bg-gray-800 rounded-full p-2">
                      <CheckCircle2 className="h-8 w-8 text-success-500" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg text-success-800 dark:text-success-300 mb-1">
                        Training Completed Successfully!
                      </h3>
                      <p className="text-success-700 dark:text-success-400 mb-4">
                        Your model is now ready to use. You can start testing it or download it for offline usage.
                      </p>
                      <div className="flex flex-wrap gap-3">
                        <Button variant="outline" leftIcon={<FileDown className="h-4 w-4" />}>
                          Download Model
                        </Button>
                        <Button variant="outline" leftIcon={<ArrowUpRight className="h-4 w-4" />}>
                          View Training Metrics
                        </Button>
                        <Button variant="primary" onClick={() => navigate('/query')}>
                          Test Your Model
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </div>

        <div className="space-y-6">
          <Card className="sticky top-20">
            <CardHeader>
              <CardTitle>Session Details</CardTitle>
              <CardDescription>Information about this training session</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div>
                <p className="text-sm font-medium mb-1">Model Configuration</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">Base Model</p>
                    <p className="text-gray-700 dark:text-gray-300">
                      {sessionData.config?.model_name || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">Training Method</p>
                    <p className="text-gray-700 dark:text-gray-300">LoRA</p>
                  </div>
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">Epochs</p>
                    <p className="text-gray-700 dark:text-gray-300">
                      {sessionData.config?.num_train_epochs || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">Batch Size</p>
                    <p className="text-gray-700 dark:text-gray-300">
                      {sessionData.config?.per_device_train_batch_size || 'N/A'}
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <p className="text-sm font-medium mb-1">Dataset</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">Examples</p>
                    <p className="text-gray-700 dark:text-gray-300">
                      {sessionData.dataset_info?.total_rows?.toLocaleString() || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">File Type</p>
                    <p className="text-gray-700 dark:text-gray-300">
                      {sessionData.dataset_info?.file_type || 'N/A'}
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <p className="text-sm font-medium mb-1">Timeline</p>
                <div className="space-y-2 text-sm">
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">Created</p>
                    <p className="text-gray-700 dark:text-gray-300">
                      {sessionData.created_at ? new Date(sessionData.created_at).toLocaleString() : 'N/A'}
                    </p>
                  </div>
                  {sessionData.started_at && (
                    <div>
                      <p className="text-gray-500 dark:text-gray-400">Started</p>
                      <p className="text-gray-700 dark:text-gray-300">
                        {new Date(sessionData.started_at).toLocaleString()}
                      </p>
                    </div>
                  )}
                  {sessionData.completed_at && (
                    <div>
                      <p className="text-gray-500 dark:text-gray-400">Completed</p>
                      <p className="text-gray-700 dark:text-gray-300">
                        {new Date(sessionData.completed_at).toLocaleString()}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Progress Metrics</h3>
                  <span className="text-xs text-gray-500 dark:text-gray-400">Real-time updates</span>
                </div>
                
                <div className="space-y-4">
                  {/* Primary Metrics */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Training Loss</span>
                      </div>
                      <div className="mt-1">
                        <span className="text-base font-semibold text-gray-900 dark:text-gray-100">
                          {getLatestTrainingMetrics(logs).loss}
                        </span>
                      </div>
                    </div>
                    
                    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Validation Loss</span>
                      </div>
                      <div className="mt-1">
                        <span className="text-base font-semibold text-gray-900 dark:text-gray-100">
                          {getLatestValidationMetrics(logs).evalLoss}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Secondary Metrics */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Current Epoch</span>
                      </div>
                      <div className="mt-1">
                        <span className="text-base font-semibold text-gray-900 dark:text-gray-100">
                          {getCurrentEpochInfo(logs).display}
                        </span>
                      </div>
                    </div>
                    
                    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Learning Rate</span>
                      </div>
                      <div className="mt-1">
                        <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                          {getLatestTrainingMetrics(logs).learningRate}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Tertiary Metrics */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Current Step</span>
                      </div>
                      <div className="mt-1">
                        <span className="text-base font-semibold text-gray-900 dark:text-gray-100">
                          {getLatestTrainingMetrics(logs).step}
                        </span>
                        <span className="text-sm text-gray-500 dark:text-gray-400 ml-1">
                          / {getLatestTrainingMetrics(logs).step + getLatestTrainingMetrics(logs).remainingSteps}
                        </span>
                      </div>
                    </div>
                    
                    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Avg Step Time</span>
                      </div>
                      <div className="mt-1">
                        <span className="text-base font-semibold text-gray-900 dark:text-gray-100">
                          {getLatestTrainingMetrics(logs).avgStepTime}
                        </span>
                        <span className="text-sm text-gray-500 dark:text-gray-400 ml-1">sec</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {sessionData.status === 'completed' && (
                <div className="p-3 bg-success-50 dark:bg-success-900/20 rounded-md text-success-800 dark:text-success-200 text-sm">
                  <p className="font-medium">Training Successfully Completed</p>
                  <p className="mt-1 text-success-700 dark:text-success-300 text-xs">
                    Final validation loss: {getLatestValidationMetrics(logs).evalLoss}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
