import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Progress } from '../../components/ui/Progress';
import { cn } from '../../utils/cn';
import { BarChart3, Download, RefreshCw, CheckCircle, AlertTriangle, Clock, TrendingUp, FileText, ArrowLeft } from 'lucide-react';
import { useEvaluateContext } from './EvaluateContext';
import { StepProgress } from '../../components/ui/StepProgress';
import { evaluationService, EvaluationProgress as EvalProgress, AccuracyMetrics } from '../../services/evaluationService';

const steps = [
  { id: 1, title: 'Select Model', description: 'Choose evaluation model' },
  { id: 2, title: 'Upload Data', description: 'Upload test dataset' },
  { id: 3, title: 'Configure Parameters', description: 'Set evaluation parameters' },
  { id: 4, title: 'Evaluation Progress', description: 'Monitor evaluation' },
];

export default function EvaluationProgress() {
  const navigate = useNavigate();
  const { state, dispatch } = useEvaluateContext();
  
  // Local state
  const [progress, setProgress] = useState<EvalProgress | null>(null);
  const [status, setStatus] = useState<'queued' | 'running' | 'completed' | 'failed'>('queued');
  const [error, setError] = useState<string | null>(null);
  const [accuracyMetrics, setAccuracyMetrics] = useState<AccuracyMetrics | null>(null);
  const [isPolling, setIsPolling] = useState(true);
  const [startTime, setStartTime] = useState<Date>(new Date());
  const [elapsedTime, setElapsedTime] = useState<string>('00:00');

  // Poll for job status
  useEffect(() => {
    if (!state.evaluationJobId || !isPolling) return;

    const pollInterval = setInterval(async () => {
      try {
        const statusResponse = await evaluationService.getJobStatus(state.evaluationJobId!);
        setStatus(statusResponse.status as any);
        setProgress(statusResponse.progress);
        
        if (statusResponse.error) {
          setError(statusResponse.error);
        }

        if (statusResponse.status === 'completed') {
          setIsPolling(false);
          // Fetch accuracy metrics
          try {
            const metricsResponse = await evaluationService.getJobAccuracyMetrics(state.evaluationJobId!);
            setAccuracyMetrics(metricsResponse.metrics);
          } catch (metricsError) {
            console.error('Failed to fetch accuracy metrics:', metricsError);
          }
        } else if (statusResponse.status === 'failed') {
          setIsPolling(false);
          setError(statusResponse.error || 'Evaluation failed');
        }
      } catch (error: any) {
        console.error('Failed to poll job status:', error);
        setError(error.message);
        setIsPolling(false);
      }
    }, 2000);

    return () => clearInterval(pollInterval);
  }, [state.evaluationJobId, isPolling]);

  // Update elapsed time
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      const diff = now.getTime() - startTime.getTime();
      const minutes = Math.floor(diff / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      setElapsedTime(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
    }, 1000);

    return () => clearInterval(timer);
  }, [startTime]);

  const handleDownloadResults = async () => {
    if (!state.evaluationJobId) return;
    
    try {
      await evaluationService.downloadResults(state.evaluationJobId);
    } catch (error: any) {
      setError(error.message || 'Failed to download results');
    }
  };

  const handleDownloadCSV = async () => {
    if (!state.evaluationJobId) return;
    
    try {
      await evaluationService.downloadResultsAsCSV(state.evaluationJobId);
    } catch (error: any) {
      setError(error.message || 'Failed to download CSV');
    }
  };

  const handleRetry = () => {
    setIsPolling(true);
    setError(null);
    setStatus('queued');
    setProgress(null);
    setStartTime(new Date());
  };

  const handleBack = () => {
    navigate('/evaluate/parameters');
  };

  const handleNewEvaluation = () => {
    dispatch({ type: 'RESET_STATE' });
    navigate('/evaluate/model');
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'queued':
        return <Clock className="h-5 w-5 text-yellow-500" />;
      case 'running':
        return <RefreshCw className="h-5 w-5 text-blue-500 animate-spin" />;
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'failed':
        return <AlertTriangle className="h-5 w-5 text-red-500" />;
      default:
        return <Clock className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'queued':
        return 'Queued for processing...';
      case 'running':
        return 'Evaluation in progress...';
      case 'completed':
        return 'Evaluation completed successfully!';
      case 'failed':
        return 'Evaluation failed';
      default:
        return 'Unknown status';
    }
  };

  const getProgressPercentage = () => {
    if (!progress) return 0;
    return progress.progress_percentage || 0;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Evaluation Progress</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Monitor your model evaluation progress and view results
        </p>
      </div>


      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Evaluation Status</CardTitle>
              <CardDescription>
                Current evaluation progress
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                {getStatusIcon()}
                <div>
                  <p className="text-sm font-medium">{getStatusText()}</p>
                  <p className="text-xs text-gray-500">Job ID: {state.evaluationJobId}</p>
                </div>
              </div>

              {progress && (
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Progress</span>
                      <span>{Math.round(getProgressPercentage())}%</span>
                    </div>
                    <Progress
                      value={getProgressPercentage()}
                      max={100}
                      variant={status === 'completed' ? 'success' : status === 'failed' ? 'error' : 'primary'}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-gray-500">Completed:</span>
                      <div className="font-medium">{progress.completed_rows || 0}</div>
                    </div>
                    <div>
                      <span className="text-gray-500">Total:</span>
                      <div className="font-medium">{progress.total_rows || 0}</div>
                    </div>
                  </div>

                  {progress.processing_speed && (
                    <div className="text-xs">
                      <span className="text-gray-500">Speed:</span>
                      <span className="font-medium ml-1">{progress.processing_speed.toFixed(2)} rows/sec</span>
                    </div>
                  )}

                  {progress.estimated_completion_time && (
                    <div className="text-xs">
                      <span className="text-gray-500">ETA:</span>
                      <span className="font-medium ml-1">{Math.round(progress.estimated_completion_time / 60)} min</span>
                    </div>
                  )}
                </div>
              )}

              <div className="pt-2 border-t">
                <div className="text-xs text-gray-500">
                  <div>Elapsed: <span className="font-medium">{elapsedTime}</span></div>
                  <div>Model: <span className="font-medium">{state.selectedModel?.name}</span></div>
                  <div>Data: <span className="font-medium">{state.uploadedFile?.name}</span></div>
                </div>
              </div>
            </CardContent>
          </Card>

          {accuracyMetrics && (
            <Card>
              <CardHeader>
                <CardTitle>Quick Metrics</CardTitle>
                <CardDescription>
                  Key evaluation results
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {(accuracyMetrics.overall_accuracy * 100).toFixed(1)}%
                  </div>
                  <div className="text-xs text-gray-500">Overall Accuracy</div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="text-center">
                    <div className="font-medium">{accuracyMetrics.perfect_extractions}</div>
                    <div className="text-gray-500">Perfect</div>
                  </div>
                  <div className="text-center">
                    <div className="font-medium">{accuracyMetrics.total_records}</div>
                    <div className="text-gray-500">Total</div>
                  </div>
                </div>

                {accuracyMetrics.json_parsing_success_rate && (
                  <div className="text-xs">
                    <span className="text-gray-500">JSON Success:</span>
                    <span className="font-medium ml-1">{(accuracyMetrics.json_parsing_success_rate * 100).toFixed(1)}%</span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
        
        <div className="lg:col-span-3 h-full flex flex-col">
          <Card className="flex-1 flex flex-col h-full min-h-[600px]">
            <CardHeader className="border-b flex-shrink-0">
              <div className="flex items-center space-x-3">
                <BarChart3 className="h-5 w-5 text-primary-500" />
                <div>
                  <CardTitle>Evaluation Results</CardTitle>
                  <CardDescription>
                    Detailed evaluation metrics and analysis
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex-1 p-6">
              <div className="space-y-6">
                {error && (
                  <div className="p-4 bg-error-50 dark:bg-error-900/20 rounded-lg border border-error-200 dark:border-error-800">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-5 w-5 text-error-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-error-800 dark:text-error-200">
                          Evaluation Error
                        </p>
                        <p className="text-sm text-error-700 dark:text-error-300 mt-1">
                          {error}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {status === 'running' && (
                  <div className="text-center py-12">
                    <RefreshCw className="h-12 w-12 text-blue-500 mx-auto mb-4 animate-spin" />
                    <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                      Evaluation in Progress
                    </h3>
                    <p className="text-gray-500 dark:text-gray-400">
                      Please wait while we evaluate your model on the test data...
                    </p>
                    {progress && (
                      <div className="mt-4 max-w-md mx-auto">
                        <div className="flex justify-between text-sm mb-2">
                          <span>Processing rows...</span>
                          <span>{progress.completed_rows} / {progress.total_rows}</span>
                        </div>
                        <Progress
                          value={getProgressPercentage()}
                          max={100}
                          variant="primary"
                          showValue={true}
                        />
                      </div>
                    )}
                  </div>
                )}

                {status === 'queued' && (
                  <div className="text-center py-12">
                    <Clock className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                      Evaluation Queued
                    </h3>
                    <p className="text-gray-500 dark:text-gray-400">
                      Your evaluation job is queued and will start processing shortly...
                    </p>
                  </div>
                )}

                {status === 'failed' && (
                  <div className="text-center py-12">
                    <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                      Evaluation Failed
                    </h3>
                    <p className="text-gray-500 dark:text-gray-400 mb-4">
                      The evaluation encountered an error and could not complete.
                    </p>
                    <Button onClick={handleRetry} variant="outline">
                      Retry Evaluation
                    </Button>
                  </div>
                )}

                {status === 'completed' && accuracyMetrics && (
                  <div className="space-y-6">
                    <div className="text-center">
                      <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                        Evaluation Completed!
                      </h3>
                      <p className="text-gray-500 dark:text-gray-400">
                        Your model evaluation has finished successfully.
                      </p>
                    </div>

                    {/* Accuracy Metrics */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg text-center">
                        <div className="text-2xl font-bold text-green-600">
                          {(accuracyMetrics.overall_accuracy * 100).toFixed(1)}%
                        </div>
                        <div className="text-sm text-green-800 dark:text-green-200">Overall Accuracy</div>
                      </div>
                      
                      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-center">
                        <div className="text-2xl font-bold text-blue-600">
                          {accuracyMetrics.perfect_extractions}
                        </div>
                        <div className="text-sm text-blue-800 dark:text-blue-200">Perfect Extractions</div>
                      </div>
                      
                      <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg text-center">
                        <div className="text-2xl font-bold text-purple-600">
                          {accuracyMetrics.total_records}
                        </div>
                        <div className="text-sm text-purple-800 dark:text-purple-200">Total Records</div>
                      </div>
                    </div>

                    {/* Field Accuracies */}
                    {Object.keys(accuracyMetrics.field_accuracies).length > 0 && (
                      <div>
                        <h4 className="text-lg font-medium mb-4">Field-Level Accuracy</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {Object.entries(accuracyMetrics.field_accuracies).map(([field, accuracy]) => (
                            <div key={field} className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                              <div className="flex justify-between items-center mb-2">
                                <span className="text-sm font-medium">{field}</span>
                                <span className="text-sm text-gray-500">
                                  {typeof accuracy === 'number' 
                                    ? `${(accuracy * 100).toFixed(1)}%`
                                    : `${(accuracy.exact_accuracy * 100).toFixed(1)}%`
                                  }
                                </span>
                              </div>
                              <Progress
                                value={typeof accuracy === 'number' ? accuracy * 100 : accuracy.exact_accuracy * 100}
                                max={100}
                                variant="primary"
                                className="h-2"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Download Options */}
                    <div className="flex gap-4 justify-center">
                      <Button
                        onClick={handleDownloadResults}
                        leftIcon={<Download className="h-4 w-4" />}
                        variant="outline"
                      >
                        Download JSON
                      </Button>
                      <Button
                        onClick={handleDownloadCSV}
                        leftIcon={<FileText className="h-4 w-4" />}
                        variant="outline"
                      >
                        Download CSV
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
            <CardFooter className="border-t p-6">
              <div className="w-full flex justify-between">
                <Button
                  variant="outline"
                  size="lg"
                  leftIcon={<ArrowLeft className="h-5 w-5" />}
                  onClick={handleBack}
                  className="px-8"
                >
                  Back to Parameters
                </Button>
                <Button
                  variant="primary"
                  size="lg"
                  rightIcon={<TrendingUp className="h-5 w-5" />}
                  onClick={handleNewEvaluation}
                  className="px-8"
                >
                  New Evaluation
                </Button>
              </div>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}
