import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { ArrowUpRight, Download, FileText, AlertTriangle } from 'lucide-react';
import { motion } from 'framer-motion';
import { ModelInfo } from '../../components/models/ModelCard';
import { evaluationService } from '../../services/evaluationService';

export default function Compare() {
  const [selectedMetric, setSelectedMetric] = useState('accuracy');
  const [comparisonData, setComparisonData] = useState<any>(null);
  const [selectedModel, setSelectedModel] = useState<ModelInfo | null>(null);
  const [evaluationJobId, setEvaluationJobId] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  useEffect(() => {
    const modelData = localStorage.getItem('evaluationModel');
    if (modelData) {
      const model = JSON.parse(modelData);
      setSelectedModel(model);
    }
    
    const jobId = localStorage.getItem('evaluationJobId');
    if (jobId) {
      setEvaluationJobId(jobId);
    }
  }, []);

  useEffect(() => {
    // Simulate loading comparison data
    setTimeout(() => {
      setComparisonData({
        baseModel: {
          name: 'Mistral-7B-v0.1',
          metrics: {
            accuracy: 0.82,
            f1Score: 0.81,
            precision: 0.80,
            recall: 0.83,
            latency: 150,
          }
        },
        fineTuned: {
          name: 'My-Fine-Tuned-Model',
          metrics: {
            accuracy: 0.89,
            f1Score: 0.87,
            precision: 0.85,
            recall: 0.88,
            latency: 120,
          }
        },
        improvements: {
          accuracy: '+8.5%',
          f1Score: '+7.4%',
          precision: '+6.3%',
          recall: '+6.0%',
          latency: '-20%',
        }
      });
    }, 1000);
  }, []);

  const handleDownloadJSON = async () => {
    if (!evaluationJobId) {
      setDownloadError('No evaluation job ID found. Please run an evaluation first.');
      return;
    }

    setIsDownloading(true);
    setDownloadError(null);

    try {
      const filename = `comparison_results_${selectedModel?.name || 'model'}_${new Date().toISOString().split('T')[0]}.json`;
      await evaluationService.downloadResults(evaluationJobId, filename);
    } catch (error: any) {
      setDownloadError(error.message || 'Failed to download results');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDownloadCSV = async () => {
    if (!evaluationJobId) {
      setDownloadError('No evaluation job ID found. Please run an evaluation first.');
      return;
    }

    setIsDownloading(true);
    setDownloadError(null);

    try {
      const filename = `comparison_results_${selectedModel?.name || 'model'}_${new Date().toISOString().split('T')[0]}.csv`;
      await evaluationService.downloadResultsAsCSV(evaluationJobId, filename);
    } catch (error: any) {
      setDownloadError(error.message || 'Failed to download results');
    } finally {
      setIsDownloading(false);
    }
  };

  const metrics = [
    { key: 'accuracy', label: 'Accuracy' },
    { key: 'f1Score', label: 'F1 Score' },
    { key: 'precision', label: 'Precision' },
    { key: 'recall', label: 'Recall' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Model Comparison</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          {selectedModel ? `Comparing ${selectedModel.name} with base model` : 'Loading model...'}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {!comparisonData ? (
            <Card className="h-64">
              <CardContent className="h-full flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                  <div className="w-10 h-10 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
                  <p className="text-sm text-gray-500">Loading comparison data...</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <Card>
                <CardHeader>
                  <CardTitle>Performance Comparison</CardTitle>
                  <CardDescription>
                    Side-by-side comparison of key metrics
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <div className="flex gap-2">
                      {metrics.map(metric => (
                        <Button
                          key={metric.key}
                          variant={selectedMetric === metric.key ? 'primary' : 'outline'}
                          onClick={() => setSelectedMetric(metric.key)}
                        >
                          {metric.label}
                        </Button>
                      ))}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <div className="flex items-center justify-between mb-4">
                          <Badge variant="outline">Base Model</Badge>
                          <span className="text-sm text-gray-500">{comparisonData.baseModel.name}</span>
                        </div>
                        <p className="text-3xl font-semibold">
                          {(comparisonData.baseModel.metrics[selectedMetric] * 100).toFixed(1)}%
                        </p>
                      </div>
                      
                      <div className="p-4 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
                        <div className="flex items-center justify-between mb-4">
                          <Badge variant="primary">Fine-tuned Model</Badge>
                          <span className="text-sm text-gray-500">{comparisonData.fineTuned.name}</span>
                        </div>
                        <p className="text-3xl font-semibold text-primary-600 dark:text-primary-400">
                          {(comparisonData.fineTuned.metrics[selectedMetric] * 100).toFixed(1)}%
                        </p>
                      </div>
                    </div>

                    <div className="p-4 bg-success-50 dark:bg-success-900/20 rounded-lg">
                      <div className="flex items-center gap-2">
                        <ArrowUpRight className="h-5 w-5 text-success-500" />
                        <p className="text-success-700 dark:text-success-300 font-medium">
                          {comparisonData.improvements[selectedMetric]} improvement in {selectedMetric}
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Detailed Analysis</CardTitle>
                  <CardDescription>
                    Comprehensive comparison across all metrics
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-200 dark:border-gray-700">
                            <th className="text-left py-2 font-medium">Metric</th>
                            <th className="text-right py-2 font-medium">Base Model</th>
                            <th className="text-right py-2 font-medium">Fine-tuned</th>
                            <th className="text-right py-2 font-medium">Improvement</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(comparisonData.baseModel.metrics).map(([key, value]) => (
                            <tr key={key} className="border-b border-gray-200 dark:border-gray-700">
                              <td className="py-2 capitalize">{key}</td>
                              <td className="text-right py-2">
                                {key === 'latency' ? `${value}ms` : `${(Number(value) * 100).toFixed(1)}%`}
                              </td>
                              <td className="text-right py-2">
                                {key === 'latency' 
                                  ? `${comparisonData.fineTuned.metrics[key]}ms`
                                  : `${(comparisonData.fineTuned.metrics[key] * 100).toFixed(1)}%`}
                              </td>
                              <td className="text-right py-2 text-success-600  dark:text-success-400">
                                {comparisonData.improvements[key]}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {downloadError && (
                      <div className="p-3 bg-error-50 dark:bg-error-900/20 rounded-lg border border-error-200 dark:border-error-800 mb-4">
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="h-4 w-4 text-error-500 flex-shrink-0 mt-0.5" />
                          <p className="text-sm text-error-700 dark:text-error-300">{downloadError}</p>
                        </div>
                      </div>
                    )}

                    <div className="flex justify-end gap-3">
                      <Button
                        variant="outline"
                        leftIcon={<Download className="h-4 w-4" />}
                        onClick={handleDownloadJSON}
                        disabled={isDownloading || !evaluationJobId}
                        isLoading={isDownloading}
                      >
                        {isDownloading ? 'Downloading...' : 'Download JSON'}
                      </Button>
                      <Button
                        variant="outline"
                        leftIcon={<FileText className="h-4 w-4" />}
                        onClick={handleDownloadCSV}
                        disabled={isDownloading || !evaluationJobId}
                        isLoading={isDownloading}
                      >
                        {isDownloading ? 'Downloading...' : 'Download CSV'}
                      </Button>
                    </div>
                    
                    {!evaluationJobId && (
                      <div className="text-xs text-warning-600 dark:text-warning-400 text-center mt-2">
                        ⚠️ No evaluation job found. Please run an evaluation first to download results.
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </div>

        <div>
          <Card>
            <CardHeader>
              <CardTitle>Improvement Analysis</CardTitle>
              <CardDescription>
                Understanding the comparison results
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium mb-2">Key Findings</h4>
                  <ul className="space-y-3 text-sm">
                    <li className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-success-100 dark:bg-success-900/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <ArrowUpRight className="h-3 w-3 text-success-500" />
                      </span>
                      <div>
                        <p className="font-medium">Improved Accuracy</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          8.5% increase in overall accuracy
                        </p>
                      </div>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-success-100 dark:bg-success-900/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <ArrowUpRight className="h-3 w-3 text-success-500" />
                      </span>
                      <div>
                        <p className="font-medium">Better F1 Score</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          7.4% improvement in balanced performance
                        </p>
                      </div>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-success-100 dark:bg-success-900/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <ArrowUpRight className="h-3 w-3 text-success-500" />
                      </span>
                      <div>
                        <p className="font-medium">Reduced Latency</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          20% faster response times
                        </p>
                      </div>
                    </li>
                  </ul>
                </div>

                <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <h4 className="text-sm font-medium mb-2">Recommendations</h4>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-start gap-2">
                      <span className="w-2 h-2 rounded-full bg-primary-500 mt-1.5" />
                      <span>Model is ready for production use</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-2 h-2 rounded-full bg-primary-500 mt-1.5" />
                      <span>Consider A/B testing with base model</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-2 h-2 rounded-full bg-primary-500 mt-1.5" />
                      <span>Monitor performance in production</span>
                    </li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
