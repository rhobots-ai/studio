import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card'; 
import { Button } from '../components/ui/Button';
import { Progress } from '../components/ui/Progress';
import { Badge } from '../components/ui/Badge';
import { Timer, CheckCircle2, ChevronDown, Play, Pause, FileDown, ArrowUpRight, Share2, Copy, Cpu, HardDrive, Activity, Zap, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import TrainingLossChart from '../components/training/TrainingLossChart';
import MetricCard from '../components/monitoring/MetricCard';
import LiveChart from '../components/monitoring/LiveChart';
import trainingSessionService from '../services/trainingSessionService';
import { monitoringService, PerformanceMetrics } from '../services/monitoringService';
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

type TrainingStatus = 'not_started' | 'initializing' | 'training' | 'validating' | 'finalizing' | 'completed';

export default function TuningProgress() {
  const navigate = useNavigate();
  const [currentStatus, setCurrentStatus] = useState<TrainingStatus>('not_started');
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(1800); // 30 minutes in seconds
  const [showDetails, setShowDetails] = useState(false);
  const [showSystemCharts, setShowSystemCharts] = useState(false);
  
  // System monitoring state
  const [systemMetrics, setSystemMetrics] = useState<PerformanceMetrics | null>(null);
  const [systemAlerts, setSystemAlerts] = useState<string[]>([]);

  // Get current training session
  const currentSession = trainingSessionService.getCurrentSession();

  // Function to fetch logs from the API (session-specific)
  const fetchLogsFromAPI = async (): Promise<LogEntry[]> => {
    const sessionId = currentSession?.id;
    
    try {
      // If we have a session ID, use session-specific endpoint
      if (sessionId) {
        console.log(`Fetching logs for session: ${sessionId}`);
        const response = await fetch(`${API_BASE_URL_WITH_API}/training/${sessionId}/logs`);
        
        if (response.ok) {
          const data = await response.json();
          console.log(`Fetched ${data.logs?.length || 0} session-specific logs`);
          return data.logs || [];
        } else {
          console.warn(`Session-specific logs failed (${response.status}), falling back to global logs`);
        }
      } else {
        console.warn('No session ID available, using global logs');
      }
      
      // Fallback to global logs
      const response = await fetch(`${API_BASE_URL_WITH_API}/logs`);
      if (!response.ok) {
        throw new Error(`Error fetching logs: ${response.statusText}`);
      }
      const data = await response.json();
      console.log(`Fetched ${data.logs?.length || 0} global logs as fallback`);
      return data.logs || [];
    } catch (error) {
      console.error('Failed to fetch logs:', error);
      return [] as LogEntry[];
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
    const totalEpochs = latestEpochBegin?.total_epochs || 3;
    
    return {
      current: Math.floor(currentEpoch),
      total: totalEpochs,
      display: `${Math.floor(currentEpoch)}/${totalEpochs}`
    };
  };

  // System monitoring useEffect
  useEffect(() => {
    if (currentStatus === 'not_started' || currentStatus === 'completed') return;

    // Set up monitoring service listeners
    const handleMetrics = (metrics: PerformanceMetrics) => {
      setSystemMetrics(metrics);
      
      // Generate alerts based on system health
      const alerts: string[] = [];
      
      if (metrics.systemHealth.cpu > 90) {
        alerts.push('High CPU usage detected - may impact training performance');
      }
      if (metrics.systemHealth.memory > 90) {
        alerts.push('High memory usage detected - risk of out-of-memory errors');
      }
      if (metrics.systemHealth.gpu > 95) {
        alerts.push('GPU utilization at maximum - optimal for training');
      }
      if (metrics.systemHealth.gpuMemory > 90) {
        alerts.push('GPU memory near capacity - monitor for memory errors');
      }
      if (metrics.systemHealth.status === 'critical') {
        alerts.push('Critical system health - consider pausing training');
      }
      
      setSystemAlerts(alerts);
    };

    monitoringService.on('metrics', handleMetrics);

    return () => {
      monitoringService.off('metrics', handleMetrics);
    };
  }, [currentStatus]);

  useEffect(() => {
    if (isPaused || currentStatus === 'completed') return;

    const interval = setInterval(async () => {
      const fetchedLogs = await fetchLogsFromAPI();
      setLogs(fetchedLogs);
      
      // Debug: Log the fetched data to console
      console.log('Fetched logs:', fetchedLogs.length, 'entries');
      
      // Debug: Check for metrics logs specifically
      const metricsLogs = fetchedLogs.filter(log => log.type === 'metrics');
      console.log('Metrics logs found:', metricsLogs.length);
      if (metricsLogs.length > 0) {
        console.log('Latest metrics log:', metricsLogs[metricsLogs.length - 1]);
      }
      
      // Debug: Check for training_step logs
      const trainingStepLogs = fetchedLogs.filter(log => log.type === 'training_step');
      console.log('Training step logs found:', trainingStepLogs.length);
      if (trainingStepLogs.length > 0) {
        console.log('Latest training step log:', trainingStepLogs[trainingStepLogs.length - 1]);
      }
      
      // Check if any training logs exist to determine if training has started
      const hasTrainingLogs = fetchedLogs.length > 0 && 
        fetchedLogs.some(log => ['training_step', 'epoch_begin', 'epoch_end'].includes(log.type));
      
      if (!hasTrainingLogs) {
        // No training has started yet
        setCurrentStatus('not_started');
        setProgress(0);
        setTimeElapsed(0);
        setTimeRemaining(0);
        return;
      }

      // Training has started, increment time and update progress
      setTimeElapsed(prev => prev + 2);
      
      // Get actual progress from training_step logs
      const currentProgress = getProgressFromLogs(fetchedLogs);
      setProgress(currentProgress);

      // Calculate estimated remaining time from logs
      const estimatedRemaining = calculateEstimatedRemainingTime(fetchedLogs);
      setTimeRemaining(estimatedRemaining);

      // Update status based on progress
      if (currentProgress === 0) {
        setCurrentStatus('initializing');
      } else if (currentProgress < 10) {
        setCurrentStatus('initializing');
      } else if (currentProgress < 80) {
        setCurrentStatus('training');
      } else if (currentProgress < 90) {
        setCurrentStatus('validating');
      } else if (currentProgress < 100) {
        setCurrentStatus('finalizing');
      } else {
        setCurrentStatus('completed');
        setTimeRemaining(0);
      }
    }, 1000); // Reduced from 2000ms to 1000ms for more responsive updates

    return () => clearInterval(interval);
  }, [isPaused, currentStatus]);

  // Helper to format time (seconds to hr:mm:ss)
  const formatTime = (timeInSeconds: number) => {
    const hours = Math.floor(timeInSeconds / 3600);
    const minutes = Math.floor((timeInSeconds % 3600) / 60);
    const seconds = timeInSeconds % 60;
    return `${hours}:${minutes < 10 ? '0' : ''}${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  const getStatusVariant = (status: TrainingStatus): 'primary' | 'secondary' | 'success' => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'training':
      case 'validating':
        return 'primary';
      default:
        return 'secondary';
    }
  };

  const getStatusLabel = (status: TrainingStatus): string => {
    switch (status) {
      case 'not_started':
        return 'Not Started';
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
      default:
        return 'Unknown';
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Fine-Tuning Progress</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Monitor your model training in real-time
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Fine-Tuning Status</CardTitle>
                <Badge variant={getStatusVariant(currentStatus)}>
                  {getStatusLabel(currentStatus)}
                </Badge>
              </div>
              <CardDescription>
                {currentStatus === 'not_started'
                  ? 'No training job is currently active. Start a fine-tuning job to see progress here.'
                  : currentStatus === 'completed'
                  ? 'Your model has been successfully fine-tuned and is ready for use'
                  : 'Your model is currently being fine-tuned'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <Progress
                value={progress}
                size="lg"
                variant={
                  currentStatus === 'completed' ? 'success' :
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

                {currentStatus === 'not_started' ? (
                  <div className="text-gray-500 dark:text-gray-400">
                    Waiting for training to start...
                  </div>
                ) : timeRemaining > 0 ? (
                  <div className="text-gray-700 dark:text-gray-300">
                    Estimated remaining: <span className="font-medium">{formatTime(timeRemaining)}</span>
                  </div>
                ) : currentStatus === 'completed' ? (
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
                              {`[${formatTime(index * 2)}]`}
                            </span>{' '}
                            <span>{log.message}</span>
                          </div>
                        ))}
                        {currentStatus !== 'completed' && !isPaused && logs.length > 0 && (
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

              {currentStatus !== 'completed' && currentStatus !== 'not_started' && (
                <div className="flex justify-center pt-2">
                  <Button
                    variant={isPaused ? 'primary' : 'outline'}
                    onClick={() => setIsPaused(!isPaused)}
                    leftIcon={isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                  >
                    {isPaused ? 'Resume Training' : 'Pause Training'}
                  </Button>
                </div>
              )}

              {/* Show unique training URL when session is active */}
              {currentSession && currentStatus !== 'not_started' && (
                <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-1">
                          Unique Training URL
                        </h4>
                        <p className="text-xs text-blue-700 dark:text-blue-400 mb-3">
                          Share this URL to let others track this training session in real-time
                        </p>
                        <div className="bg-white dark:bg-gray-800 rounded border border-blue-200 dark:border-blue-700 p-2 font-mono text-xs break-all">
                          {trainingSessionService.getShareableUrl()}
                        </div>
                      </div>
                      <div className="flex gap-2 ml-4">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => navigator.clipboard.writeText(trainingSessionService.getShareableUrl())}
                          leftIcon={<Copy className="h-3 w-3" />}
                        >
                          Copy
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => navigate(trainingSessionService.getTrainingUrl())}
                          leftIcon={<Share2 className="h-3 w-3" />}
                        >
                          View
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Training Loss Chart - Show when training has started */}
          {currentStatus !== 'not_started' && logs.length > 0 && (
            <TrainingLossChart logs={logs} height={350} />
          )}

          {/* System Health Section - Show when training is active */}
          {currentStatus !== 'not_started' && currentStatus !== 'completed' && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-primary-600 dark:text-primary-400" />
                    <CardTitle>System Health</CardTitle>
                  </div>
                  <div className="flex items-center gap-2">
                    {systemAlerts.length > 0 && (
                      <Badge variant="warning" className="flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        {systemAlerts.length} Alert{systemAlerts.length > 1 ? 's' : ''}
                      </Badge>
                    )}
                    <Badge variant={systemMetrics?.systemHealth.status === 'healthy' ? 'success' : 
                                   systemMetrics?.systemHealth.status === 'warning' ? 'warning' : 'error'}>
                      {systemMetrics?.systemHealth.status === 'healthy' ? 'Healthy' :
                       systemMetrics?.systemHealth.status === 'warning' ? 'Warning' : 'Critical'}
                    </Badge>
                  </div>
                </div>
                <CardDescription>
                  Real-time system resource monitoring during training
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* System Alerts */}
                {systemAlerts.length > 0 && (
                  <div className="bg-warning-50 dark:bg-warning-900/20 border border-warning-200 dark:border-warning-800 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="h-5 w-5 text-warning-600 dark:text-warning-400 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <h4 className="text-sm font-medium text-warning-800 dark:text-warning-300 mb-2">
                          System Alerts
                        </h4>
                        <ul className="space-y-1">
                          {systemAlerts.map((alert, index) => (
                            <li key={index} className="text-sm text-warning-700 dark:text-warning-400">
                              • {alert}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}

                {/* Resource Metrics Grid */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <MetricCard
                    title="CPU Usage"
                    value={systemMetrics?.systemHealth.cpu || 0}
                    unit="%"
                    icon={<Cpu />}
                    color={
                      (systemMetrics?.systemHealth.cpu || 0) > 90 ? 'error' :
                      (systemMetrics?.systemHealth.cpu || 0) > 70 ? 'warning' : 'primary'
                    }
                    trend={{
                      direction: 'up',
                      percentage: 5.2,
                      isGood: (systemMetrics?.systemHealth.cpu || 0) < 80
                    }}
                  />
                  
                  <MetricCard
                    title="Memory"
                    value={systemMetrics?.systemHealth.memory || 0}
                    unit="%"
                    icon={<HardDrive />}
                    color={
                      (systemMetrics?.systemHealth.memory || 0) > 90 ? 'error' :
                      (systemMetrics?.systemHealth.memory || 0) > 70 ? 'warning' : 'success'
                    }
                    trend={{
                      direction: 'up',
                      percentage: 3.1,
                      isGood: (systemMetrics?.systemHealth.memory || 0) < 85
                    }}
                  />
                  
                  <MetricCard
                    title="GPU Usage"
                    value={systemMetrics?.systemHealth.gpu || 0}
                    unit="%"
                    icon={<Zap />}
                    color={
                      (systemMetrics?.systemHealth.gpu || 0) > 95 ? 'success' :
                      (systemMetrics?.systemHealth.gpu || 0) > 70 ? 'primary' : 'warning'
                    }
                    trend={{
                      direction: 'up',
                      percentage: 12.5,
                      isGood: (systemMetrics?.systemHealth.gpu || 0) > 70
                    }}
                    subtitle="Utilization"
                  />
                  
                  <MetricCard
                    title="GPU Memory"
                    value={systemMetrics?.systemHealth.gpuMemory || 0}
                    unit="%"
                    icon={<Activity />}
                    color={
                      (systemMetrics?.systemHealth.gpuMemory || 0) > 90 ? 'warning' :
                      (systemMetrics?.systemHealth.gpuMemory || 0) > 70 ? 'primary' : 'success'
                    }
                    trend={{
                      direction: 'up',
                      percentage: 8.3,
                      isGood: (systemMetrics?.systemHealth.gpuMemory || 0) < 85
                    }}
                    subtitle={systemMetrics?.systemHealth.gpuMemoryUsed && systemMetrics?.systemHealth.gpuMemoryTotal 
                      ? `${(systemMetrics.systemHealth.gpuMemoryUsed / 1024 / 1024 / 1024).toFixed(1)}GB / ${(systemMetrics.systemHealth.gpuMemoryTotal / 1024 / 1024 / 1024).toFixed(1)}GB`
                      : undefined
                    }
                  />
                </div>

                {/* Resource Trends Charts */}
                <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                  <button
                    onClick={() => setShowSystemCharts(!showSystemCharts)}
                    className="flex items-center text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors mb-4"
                  >
                    <span>{showSystemCharts ? 'Hide' : 'Show'} resource trends</span>
                    <ChevronDown className={`h-4 w-4 ml-1 transform transition-transform ${showSystemCharts ? 'rotate-180' : ''}`} />
                  </button>

                  <AnimatePresence>
                    {showSystemCharts && systemMetrics && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="overflow-hidden"
                      >
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4">
                            <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
                              CPU & Memory Usage
                            </h4>
                            <LiveChart
                              data={[
                                { timestamp: Date.now() - 60000, value: systemMetrics.systemHealth.cpu - 5 },
                                { timestamp: Date.now() - 30000, value: systemMetrics.systemHealth.cpu - 2 },
                                { timestamp: Date.now(), value: systemMetrics.systemHealth.cpu }
                              ]}
                              title="CPU Usage"
                              color="#6366f1"
                              height={200}
                              unit="%"
                            />
                          </div>
                          
                          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4">
                            <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
                              GPU Utilization
                            </h4>
                            <LiveChart
                              data={[
                                { timestamp: Date.now() - 60000, value: systemMetrics.systemHealth.gpu - 8 },
                                { timestamp: Date.now() - 30000, value: systemMetrics.systemHealth.gpu - 3 },
                                { timestamp: Date.now(), value: systemMetrics.systemHealth.gpu }
                              ]}
                              title="GPU Usage"
                              color="#10b981"
                              height={200}
                              unit="%"
                            />
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </CardContent>
            </Card>
          )}

          {currentStatus === 'not_started' && (
            <Card className="bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800">
              <CardContent className="p-6">
                <div className="text-center">
                  <div className="bg-blue-100 dark:bg-blue-900/20 rounded-full p-3 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                    <Timer className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                  </div>
                  <h3 className="font-semibold text-lg text-blue-800 dark:text-blue-300 mb-2">
                    No Training Job Active
                  </h3>
                  <p className="text-blue-700 dark:text-blue-400 mb-4">
                    Start a fine-tuning job to monitor its progress here. You can configure and start training from the tuning configuration page.
                  </p>
                  <Button variant="primary" onClick={() => navigate('/configure')}>
                    Start Fine-Tuning
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {currentStatus === 'completed' && (
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
                        Fine-Tuning Completed Successfully!
                      </h3>
                      <p className="text-success-700 dark:text-success-400 mb-4">
                        Your model "{currentSession?.modelName || 'My-Fine-Tuned-Model'}" is now ready to use. You can start testing it or download it for offline usage.
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
              <CardTitle>Training Details</CardTitle>
              <CardDescription>Information about your fine-tuning job</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div>
                <p className="text-sm font-medium mb-1">Model Configuration</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">Base Model</p>
                    <p className="text-gray-700 dark:text-gray-300">
                      {currentSession?.selectedModel?.name || 'No model selected'}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">Training Method</p>
                    <p className="text-gray-700 dark:text-gray-300">
                      {trainingSessionService.getTrainingMethodLabel()}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">Epochs</p>
                    <p className="text-gray-700 dark:text-gray-300">
                      {currentSession?.parameters?.epochs || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">Batch Size</p>
                    <p className="text-gray-700 dark:text-gray-300">
                      {currentSession?.parameters?.batchSize || 'N/A'}
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
                      {currentSession?.totalExamples?.toLocaleString() || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">Size</p>
                    <p className="text-gray-700 dark:text-gray-300">
                      {currentSession?.totalSize ? trainingSessionService.formatFileSize(currentSession.totalSize) : 'N/A'}
                    </p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-gray-500 dark:text-gray-400">Split</p>
                    <p className="text-gray-700 dark:text-gray-300">
                      {currentSession?.trainValidationSplit ? trainingSessionService.formatTrainValidationSplit(currentSession.trainValidationSplit) : 'N/A'}
                    </p>
                  </div>
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

              {currentStatus === 'completed' && (
                <div className="p-3 bg-success-50 dark:bg-success-900/20 rounded-md text-success-800 dark:text-success-200 text-sm">
                  <p className="font-medium">Training Successfully Completed</p>
                  <p className="mt-1 text-success-700 dark:text-success-300 text-xs">
                    Final validation loss: 0.762 (40.2% improvement from base model)
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
