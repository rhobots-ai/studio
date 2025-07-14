import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { ArrowLeft, Download, CheckCircle, Clock, AlertTriangle, BarChart3, FileText, Brain } from 'lucide-react';
import { motion } from 'framer-motion';
import { predictionService } from '../../services/predictionService';
import { AnimatedLoader } from '../../components/ui/AnimatedLoader';

interface PredictionJob {
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
}

interface PredictionResult {
  row_index: number;
  input_data: Record<string, any>;
  prediction: any;
  confidence?: number;
  processing_time_ms?: number;
}

export default function PredictionProgress() {
  const navigate = useNavigate();
  const [job, setJob] = useState<PredictionJob | null>(null);
  const [model, setModel] = useState<any>(null);
  const [results, setResults] = useState<PredictionResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Get job ID and model from localStorage
    const jobId = localStorage.getItem('predictionJobId');
    const modelData = localStorage.getItem('predictionModel');

    if (!jobId) {
      navigate('/prediction/model-selection');
      return;
    }

    if (modelData) {
      try {
        setModel(JSON.parse(modelData));
      } catch (e) {
        console.error('Error parsing model data:', e);
      }
    }

    // Start polling for job status
    pollJobStatus(jobId);
  }, [navigate]);

  const pollJobStatus = async (jobId: string) => {
    try {
      setIsLoading(true);
      setError(null);

      const jobData = await predictionService.getPredictionStatus(jobId);
      setJob(jobData);

      if (jobData.status === 'completed') {
        // Load results
        const resultsData = await predictionService.getPredictionResults(jobId);
        setResults(resultsData.results || []);
        setIsLoading(false);
      } else if (jobData.status === 'failed') {
        setError(jobData.error_message || 'Prediction failed');
        setIsLoading(false);
      } else if (jobData.status === 'running' || jobData.status === 'pending') {
        // Continue polling
        setTimeout(() => pollJobStatus(jobId), 2000);
      }
    } catch (error: any) {
      console.error('Error polling job status:', error);
      setError(error.message || 'Failed to get prediction status');
      setIsLoading(false);
    }
  };

  const handleBackToSetup = () => {
    // Clear localStorage
    localStorage.removeItem('predictionJobId');
    localStorage.removeItem('predictionModel');
    navigate('/prediction/model-selection');
  };

  const handleExportResults = () => {
    if (!results.length) return;

    // Convert results to CSV
    const headers = ['Row Index', 'Input Data', 'Prediction', 'Confidence', 'Processing Time (ms)'];
    const csvContent = [
      headers.join(','),
      ...results.map(result => [
        result.row_index,
        `"${JSON.stringify(result.input_data).replace(/"/g, '""')}"`,
        `"${JSON.stringify(result.prediction).replace(/"/g, '""')}"`,
        result.confidence || '',
        result.processing_time_ms || ''
      ].join(','))
    ].join('\n');

    // Download CSV
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `prediction_results_${job?.job_id || 'export'}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const formatDuration = (startTime: string, endTime?: string) => {
    const start = new Date(startTime);
    const end = endTime ? new Date(endTime) : new Date();
    const duration = Math.round((end.getTime() - start.getTime()) / 1000);
    
    if (duration < 60) return `${duration}s`;
    if (duration < 3600) return `${Math.floor(duration / 60)}m ${duration % 60}s`;
    return `${Math.floor(duration / 3600)}h ${Math.floor((duration % 3600) / 60)}m`;
  };

  const getStatusIcon = () => {
    if (!job) return <Clock className="h-5 w-5 text-gray-400" />;
    
    switch (job.status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'failed':
        return <AlertTriangle className="h-5 w-5 text-red-500" />;
      case 'running':
        return <Brain className="h-5 w-5 text-blue-500 animate-pulse" />;
      default:
        return <Clock className="h-5 w-5 text-yellow-500" />;
    }
  };

  const getStatusColor = () => {
    if (!job) return 'text-gray-600';
    
    switch (job.status) {
      case 'completed':
        return 'text-green-600';
      case 'failed':
        return 'text-red-600';
      case 'running':
        return 'text-blue-600';
      default:
        return 'text-yellow-600';
    }
  };

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Prediction Progress</h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              Monitor your prediction job status
            </p>
          </div>
          <Button variant="outline" onClick={handleBackToSetup} leftIcon={<ArrowLeft className="h-4 w-4" />}>
            Back to Setup
          </Button>
        </div>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                  Prediction Failed
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  {error}
                </p>
                <Button onClick={handleBackToSetup}>
                  Start New Prediction
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Prediction Progress</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Monitor your prediction job status and view results
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleBackToSetup} leftIcon={<ArrowLeft className="h-4 w-4" />}>
            Back to Setup
          </Button>
          {job?.status === 'completed' && results.length > 0 && (
            <Button onClick={handleExportResults} leftIcon={<Download className="h-4 w-4" />}>
              Export Results
            </Button>
          )}
        </div>
      </div>

      {/* Job Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {getStatusIcon()}
            Prediction Job Status
          </CardTitle>
          <CardDescription>
            {job ? `Job ID: ${job.job_id}` : 'Loading job information...'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {job ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    {job.processed_rows}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    of {job.total_rows} rows processed
                  </div>
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                  <div className={`text-2xl font-bold ${getStatusColor()}`}>
                    {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
                  </div>
                  <div className="text-sm text-blue-600 dark:text-blue-400">
                    Current Status
                  </div>
                </div>
                <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {job.progress.toFixed(1)}%
                  </div>
                  <div className="text-sm text-green-600 dark:text-green-400">
                    Progress
                  </div>
                </div>
                <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                    {formatDuration(job.created_at, job.completed_at)}
                  </div>
                  <div className="text-sm text-purple-600 dark:text-purple-400">
                    {job.status === 'completed' ? 'Total Time' : 'Elapsed Time'}
                  </div>
                </div>
              </div>

              {/* Progress Bar */}
              {job.status === 'running' && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Processing...</span>
                    <span>{job.progress.toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <motion.div 
                      className="bg-blue-600 h-2 rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${job.progress}%` }}
                      transition={{ duration: 0.5 }}
                    />
                  </div>
                </div>
              )}

              {/* Model Information */}
              {model && (
                <div className="border-t pt-4">
                  <h4 className="font-medium mb-2">Model Information</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Model:</span>
                      <span className="ml-2 font-medium">{model.name}</span>
                    </div>
                    {model.base_model && (
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">Base Model:</span>
                        <span className="ml-2 font-medium">{model.base_model}</span>
                      </div>
                    )}
                    {model.accuracy && (
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">Accuracy:</span>
                        <span className="ml-2 font-medium">{(model.accuracy * 100).toFixed(1)}%</span>
                      </div>
                    )}
                    {model.version && (
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">Version:</span>
                        <span className="ml-2 font-medium">{model.version}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center py-8">
              <AnimatedLoader variant="brain" size="md" text="Loading job information..." />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results Card */}
      {job?.status === 'completed' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Prediction Results
            </CardTitle>
            <CardDescription>
              Sample results from your prediction job ({results.length} total results)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {results.length > 0 ? (
              <div className="space-y-4">
                {/* Results Summary */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      {results.length}
                    </div>
                    <div className="text-sm text-blue-600 dark:text-blue-400">
                      Total Predictions
                    </div>
                  </div>
                  <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                      {results.filter(r => r.confidence && r.confidence > 0.8).length}
                    </div>
                    <div className="text-sm text-green-600 dark:text-green-400">
                      High Confidence (&gt;80%)
                    </div>
                  </div>
                  <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                      {results.reduce((sum, r) => sum + (r.processing_time_ms || 0), 0) / results.length}ms
                    </div>
                    <div className="text-sm text-purple-600 dark:text-purple-400">
                      Avg Processing Time
                    </div>
                  </div>
                </div>

                {/* Sample Results */}
                <div className="space-y-4">
                  <h4 className="font-medium">Sample Results (First 10)</h4>
                  {results.slice(0, 10).map((result, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="border border-gray-200 dark:border-gray-700 rounded-lg p-4"
                    >
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div>
                          <h5 className="font-medium text-sm text-gray-600 dark:text-gray-400 mb-2">
                            Input Data (Row {result.row_index + 1}):
                          </h5>
                          <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded text-sm font-mono">
                            {JSON.stringify(result.input_data, null, 2)}
                          </div>
                        </div>
                        <div>
                          <h5 className="font-medium text-sm text-gray-600 dark:text-gray-400 mb-2">
                            Prediction:
                          </h5>
                          <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded text-sm font-mono">
                            {JSON.stringify(result.prediction, null, 2)}
                          </div>
                          <div className="flex justify-between items-center mt-2 text-xs text-gray-500">
                            {result.confidence && (
                              <span>Confidence: {(result.confidence * 100).toFixed(1)}%</span>
                            )}
                            {result.processing_time_ms && (
                              <span>Time: {result.processing_time_ms.toFixed(1)}ms</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>

                {results.length > 10 && (
                  <div className="text-center py-4">
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Showing 10 of {results.length} results. Export to view all results.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8">
                <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 dark:text-gray-400">
                  No results available yet.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Loading State */}
      {isLoading && job?.status === 'running' && (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <AnimatedLoader variant="brain" size="lg" text="Processing predictions..." />
                <p className="text-gray-600 dark:text-gray-400 mt-4">
                  This may take a few minutes depending on your data size and model complexity.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
