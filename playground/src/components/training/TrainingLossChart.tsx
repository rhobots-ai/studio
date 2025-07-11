import { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine } from 'recharts';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../ui/Card';
import { TrendingDown, TrendingUp, Minus } from 'lucide-react';

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

interface TrainingLossChartProps {
  logs: LogEntry[];
  height?: number;
}

interface LossDataPoint {
  timestamp: number;
  time: string;
  step: number;
  epoch?: number;
  trainingLoss?: number;
  validationLoss?: number;
}

export default function TrainingLossChart({ logs, height = 400 }: TrainingLossChartProps) {
  // Custom formatter for Y-axis ticks to handle small numbers
  const formatYAxisTick = (value: number) => {
    if (value === 0) return '0';
    
    // For very small numbers (< 0.001), use scientific notation
    if (Math.abs(value) < 0.001) {
      return value.toExponential(1);
    }
    
    // For small numbers (< 0.1), show 3 decimal places
    if (Math.abs(value) < 0.1) {
      return value.toFixed(3);
    }
    
    // For larger numbers, show 2 decimal places
    if (Math.abs(value) < 10) {
      return value.toFixed(2);
    }
    
    // For very large numbers, use scientific notation
    if (Math.abs(value) >= 1000) {
      return value.toExponential(1);
    }
    
    return value.toFixed(1);
  };

  // Calculate optimal step interval for X-axis
  const calculateOptimalStepInterval = (chartData: LossDataPoint[]) => {
    if (chartData.length === 0) return 'preserveStartEnd';
    
    const steps = chartData.map(point => point.step).sort((a, b) => a - b);
    const minStep = steps[0];
    const maxStep = steps[steps.length - 1];
    const totalSteps = maxStep - minStep + 1;
    
    // Determine optimal interval based on total steps
    if (totalSteps <= 10) {
      // Show all steps for small datasets
      return 'preserveStartEnd';
    } else if (totalSteps <= 50) {
      return Math.max(1, Math.floor(totalSteps / 10));
    } else if (totalSteps <= 100) {
      return Math.max(1, Math.floor(totalSteps / 8));
    } else if (totalSteps <= 500) {
      return Math.max(1, Math.floor(totalSteps / 10));
    } else if (totalSteps <= 1000) {
      return Math.max(1, Math.floor(totalSteps / 10));
    } else {
      return Math.max(1, Math.floor(totalSteps / 12));
    }
  };

  // Calculate loss statistics and trends
  const lossAnalysis = useMemo(() => {
    const trainingLosses = logs
      .filter(log => log.type === 'metrics' && log.metrics?.loss !== undefined)
      .map(log => log.metrics!.loss as number)
      .sort((a, b) => a - b);

    if (trainingLosses.length === 0) {
      return { min: 0, max: 0, improvement: 0, trend: 'stable' as const };
    }

    const firstLoss = trainingLosses[0];
    const lastLoss = trainingLosses[trainingLosses.length - 1];
    const minLoss = Math.min(...trainingLosses);
    const maxLoss = Math.max(...trainingLosses);
    
    const improvement = firstLoss > 0 ? ((firstLoss - lastLoss) / firstLoss) * 100 : 0;
    const trend = improvement > 5 ? 'improving' : improvement < -5 ? 'degrading' : 'stable';

    return { min: minLoss, max: maxLoss, improvement, trend };
  }, [logs]);

  const chartData = useMemo(() => {
    // Debug: Log what we're working with
    console.log('TrainingLossChart received logs:', logs.length);
    
    // Extract training loss data from both metrics and training_step logs
    const metricsSteps = logs
      .filter(log => log.type === 'metrics' && log.metrics?.loss !== undefined && log.step !== undefined)
      .map(log => ({
        timestamp: new Date(log.timestamp).getTime(),
        step: log.step!,
        loss: log.metrics!.loss as number,
        type: 'training' as const
      }));

    const trainingStepLogs = logs
      .filter(log => log.type === 'training_step' && log.loss !== undefined && log.step !== undefined)
      .map(log => ({
        timestamp: new Date(log.timestamp).getTime(),
        step: log.step!,
        loss: log.loss!,
        type: 'training' as const
      }));

    // Combine and deduplicate by step (prefer metrics logs if both exist for same step)
    const stepToLossMap = new Map<number, { timestamp: number; step: number; loss: number; type: 'training' }>();
    
    // Add training_step logs first
    trainingStepLogs.forEach(log => stepToLossMap.set(log.step, log));
    
    // Add metrics logs (will override training_step logs for same step)
    metricsSteps.forEach(log => stepToLossMap.set(log.step, log));
    
    const trainingSteps = Array.from(stepToLossMap.values()).sort((a, b) => a.step - b.step);
    
    // Debug: Log filtered training steps
    console.log('TrainingLossChart filtered training steps:', trainingSteps.length);
    if (trainingSteps.length > 0) {
      console.log('Sample training step:', trainingSteps[0]);
    }

    // Extract validation loss data from epoch_end logs
    const validationSteps = logs
      .filter(log => log.type === 'epoch_end' && log.eval_loss !== undefined && log.epoch !== undefined)
      .map(log => ({
        timestamp: new Date(log.timestamp).getTime(),
        epoch: log.epoch!,
        loss: log.eval_loss!,
        type: 'validation' as const
      }))
      .sort((a, b) => a.epoch - b.epoch);

    if (trainingSteps.length === 0) {
      return [];
    }

    // Create a step-based chart data structure
    const stepToDataMap = new Map<number, LossDataPoint>();
    
    // Add training data points
    trainingSteps.forEach(point => {
      const time = new Date(point.timestamp).toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });

      stepToDataMap.set(point.step, {
        timestamp: point.timestamp,
        time,
        step: point.step,
        trainingLoss: point.loss,
        validationLoss: undefined
      });
    });

    // Add validation data points at appropriate steps
    validationSteps.forEach(valPoint => {
      // Find the closest training step for this validation point
      const closestTrainingStep = trainingSteps.reduce((closest, trainStep) => {
        const valTime = valPoint.timestamp;
        const trainTime = trainStep.timestamp;
        const closestTime = closest ? closest.timestamp : 0;
        
        return Math.abs(trainTime - valTime) < Math.abs(closestTime - valTime) ? trainStep : closest;
      }, null as typeof trainingSteps[0] | null);

      if (closestTrainingStep) {
        const existingPoint = stepToDataMap.get(closestTrainingStep.step);
        if (existingPoint) {
          existingPoint.validationLoss = valPoint.loss;
          existingPoint.epoch = valPoint.epoch;
        }
      }
    });

    // Convert map to sorted array
    const chartPoints = Array.from(stepToDataMap.values())
      .sort((a, b) => a.step - b.step);

    return chartPoints;
  }, [logs]);

  // Calculate optimal step display interval
  const stepInterval = useMemo(() => {
    return calculateOptimalStepInterval(chartData);
  }, [chartData]);

  const hasTrainingData = chartData.some(point => point.trainingLoss !== undefined);
  const hasValidationData = chartData.some(point => point.validationLoss !== undefined);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      
      // Format loss values for better readability
      const formatLossValue = (value: number) => {
        if (Math.abs(value) < 0.0001) {
          return value.toExponential(3);
        }
        if (Math.abs(value) < 0.01) {
          return value.toFixed(6);
        }
        return value.toFixed(4);
      };
      
      return (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
            Step {label}
          </p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center gap-2 text-sm">
              <div 
                className="w-3 h-3 rounded-full" 
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-gray-600 dark:text-gray-400">
                {entry.dataKey === 'trainingLoss' ? 'Training Loss' : 'Validation Loss'}:
              </span>
              <span className="font-medium text-gray-900 dark:text-gray-100">
                {formatLossValue(entry.value)}
              </span>
            </div>
          ))}
          {data.time && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Time: {data.time}
            </p>
          )}
          {data.epoch && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Epoch: {data.epoch}
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Training Loss</CardTitle>
          <CardDescription>Loss progression during model training</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64 text-gray-500 dark:text-gray-400">
            <div className="text-center">
              <div className="text-lg mb-2">📊</div>
              <p className="text-sm">No training loss data available yet</p>
              <p className="text-xs mt-1">Loss metrics will appear once training begins</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <CardTitle>Training Loss</CardTitle>
              {lossAnalysis.trend === 'improving' && (
                <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
                  <TrendingDown className="h-4 w-4" />
                  <span className="text-xs font-medium">Improving</span>
                </div>
              )}
              {lossAnalysis.trend === 'degrading' && (
                <div className="flex items-center gap-1 text-red-600 dark:text-red-400">
                  <TrendingUp className="h-4 w-4" />
                  <span className="text-xs font-medium">Degrading</span>
                </div>
              )}
              {lossAnalysis.trend === 'stable' && (
                <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
                  <Minus className="h-4 w-4" />
                  <span className="text-xs font-medium">Stable</span>
                </div>
              )}
            </div>
            <CardDescription>
              Loss progression during model training
              {lossAnalysis.improvement !== 0 && (
                <span className={`ml-2 font-medium ${lossAnalysis.improvement > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  ({lossAnalysis.improvement > 0 ? '-' : '+'}{Math.abs(lossAnalysis.improvement).toFixed(1)}%)
                </span>
              )}
            </CardDescription>
          </div>
          <div className="flex items-center gap-4 text-xs">
            {hasTrainingData && (
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <span className="text-gray-600 dark:text-gray-400">Training</span>
              </div>
            )}
            {hasValidationData && (
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-blue-500" />
                <span className="text-gray-600 dark:text-gray-400">Validation</span>
              </div>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={height}>
          <LineChart
            data={chartData}
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid 
              strokeDasharray="3 3" 
              stroke="#e5e7eb" 
              className="dark:stroke-gray-700"
            />
            <XAxis 
              dataKey="step" 
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: '#6b7280' }}
              interval={stepInterval}
              label={{ value: 'Training Step', position: 'insideBottom', offset: -5, style: { textAnchor: 'middle', fontSize: '12px', fill: '#6b7280' } }}
            />
            <YAxis 
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: '#6b7280' }}
              width={80}
              domain={['dataMin * 0.95', 'dataMax * 1.05']}
              tickFormatter={formatYAxisTick}
              label={{ value: 'Loss', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fontSize: '12px', fill: '#6b7280' } }}
            />
            <Tooltip content={<CustomTooltip />} />
            
            {/* Reference line for best loss achieved */}
            {lossAnalysis.min > 0 && (
              <ReferenceLine 
                y={lossAnalysis.min} 
                stroke="#10b981" 
                strokeDasharray="5 5" 
                strokeWidth={1}
                label={{ value: `Best: ${formatYAxisTick(lossAnalysis.min)}`, position: "top", fontSize: 10 }}
              />
            )}
            
            {hasTrainingData && (
              <Line
                type="linear"
                dataKey="trainingLoss"
                stroke="#ef4444"
                strokeWidth={2}
                dot={false}
                activeDot={{ 
                  r: 4, 
                  stroke: '#ef4444', 
                  strokeWidth: 2, 
                  fill: '#ffffff' 
                }}
                connectNulls={false}
              />
            )}
            {hasValidationData && (
              <Line
                type="linear"
                dataKey="validationLoss"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={false}
                activeDot={{ 
                  r: 4, 
                  stroke: '#3b82f6', 
                  strokeWidth: 2, 
                  fill: '#ffffff' 
                }}
                connectNulls={false}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
        
        {chartData.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="grid grid-cols-4 gap-4 text-sm">
              {hasTrainingData && (
                <>
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">Current Loss</p>
                    <p className="font-semibold text-gray-900 dark:text-gray-100">
                      {(() => {
                        const latestLoss = chartData
                          .filter(point => point.trainingLoss !== undefined)
                          .pop()?.trainingLoss;
                        if (!latestLoss) return 'N/A';
                        if (Math.abs(latestLoss) < 0.0001) return latestLoss.toExponential(3);
                        if (Math.abs(latestLoss) < 0.01) return latestLoss.toFixed(6);
                        return latestLoss.toFixed(4);
                      })()}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">Best Loss</p>
                    <p className="font-semibold text-green-600 dark:text-green-400">
                      {lossAnalysis.min > 0 ? formatYAxisTick(lossAnalysis.min) : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">Loss Range</p>
                    <p className="font-semibold text-gray-900 dark:text-gray-100">
                      {lossAnalysis.max > 0 && lossAnalysis.min > 0 
                        ? `${formatYAxisTick(lossAnalysis.min)} - ${formatYAxisTick(lossAnalysis.max)}`
                        : 'N/A'
                      }
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">Improvement</p>
                    <p className={`font-semibold ${lossAnalysis.improvement > 0 ? 'text-green-600 dark:text-green-400' : lossAnalysis.improvement < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-400'}`}>
                      {lossAnalysis.improvement !== 0 
                        ? `${lossAnalysis.improvement > 0 ? '-' : '+'}${Math.abs(lossAnalysis.improvement).toFixed(1)}%`
                        : 'No change'
                      }
                    </p>
                  </div>
                </>
              )}
              {hasValidationData && !hasTrainingData && (
                <div className="col-span-4">
                  <p className="text-gray-500 dark:text-gray-400">Latest Validation Loss</p>
                  <p className="font-semibold text-gray-900 dark:text-gray-100">
                    {(() => {
                      const latestLoss = chartData
                        .filter(point => point.validationLoss !== undefined)
                        .pop()?.validationLoss;
                      if (!latestLoss) return 'N/A';
                      if (Math.abs(latestLoss) < 0.0001) return latestLoss.toExponential(3);
                      if (Math.abs(latestLoss) < 0.01) return latestLoss.toFixed(6);
                      return latestLoss.toFixed(4);
                    })()}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
