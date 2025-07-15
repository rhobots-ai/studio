import { useState, useEffect } from 'react';
import { Clock, Zap, AlertTriangle, DollarSign, Activity, Cpu, HardDrive, Settings, RefreshCw, MemoryStick } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import MetricCard from '../../components/monitoring/MetricCard';
import LiveChart from '../../components/monitoring/LiveChart';
import { monitoringService, PerformanceMetrics, Alert } from '../../services/monitoringService';
import { motion, AnimatePresence } from 'framer-motion';

export default function MonitoringDashboard() {
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'1h' | '6h' | '24h' | '7d'>('1h');
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  useEffect(() => {
    // Listen for real-time metrics
    const handleMetrics = (newMetrics: PerformanceMetrics) => {
      setMetrics(newMetrics);
      setIsLoading(false);
      setLastUpdated(new Date());
    };

    const handleAlert = (newAlert: Alert) => {
      setAlerts(prev => [newAlert, ...prev.slice(0, 4)]); // Keep only 5 most recent
    };

    monitoringService.on('metrics', handleMetrics);
    monitoringService.on('alert', handleAlert);

    // Load initial data from API
    const loadInitialData = async () => {
      try {
        // Load current metrics
        const currentMetrics = await monitoringService.getCurrentMetrics();
        if (currentMetrics) {
          setMetrics(currentMetrics);
          setIsLoading(false);
        }

        // Load alerts
        const alertsData = await monitoringService.getAlerts();
        setAlerts(alertsData.active);
      } catch (error) {
        console.error('Error loading initial monitoring data:', error);
        setIsLoading(false);
      }
    };

    loadInitialData();

    // Cleanup
    return () => {
      monitoringService.off('metrics', handleMetrics);
      monitoringService.off('alert', handleAlert);
    };
  }, []);

  const handleTimeRangeChange = async (newRange: '1h' | '6h' | '24h' | '7d') => {
    setTimeRange(newRange);
    setIsLoading(true);
    try {
      const historicalMetrics = await monitoringService.getHistoricalMetrics(newRange);
      setMetrics(historicalMetrics);
    } catch (error) {
      console.error('Failed to load historical metrics:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getSystemHealthColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'success';
      case 'warning': return 'warning';
      case 'critical': return 'error';
      default: return 'secondary';
    }
  };

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'error': return '🚨';
      case 'warning': return '⚠️';
      case 'success': return '✅';
      default: return 'ℹ️';
    }
  };

  const formatCurrency = (value: number) => `$${value.toFixed(2)}`;
  const formatPercentage = (value: number) => `${value.toFixed(1)}%`;
  const formatTime = (value: number) => `${value}ms`;

  return (
    <div className="space-y-6 p-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
            Performance Dashboard
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Real-time monitoring and analytics for your LLM infrastructure
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <RefreshCw className="h-4 w-4" />
            <span>Last updated: {lastUpdated.toLocaleTimeString()}</span>
          </div>
          
          <div className="flex items-center gap-1 bg-white dark:bg-gray-800 rounded-lg p-1 border border-gray-200 dark:border-gray-700">
            {(['1h', '6h', '24h', '7d'] as const).map((range) => (
              <button
                key={range}
                onClick={() => handleTimeRangeChange(range)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  timeRange === range
                    ? 'bg-primary-500 text-white'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                {range}
              </button>
            ))}
          </div>
          
          <Button variant="outline" size="sm" leftIcon={<Settings className="h-4 w-4" />}>
            Configure
          </Button>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Response Time"
          value={metrics?.responseTime.current || 0}
          unit="ms"
          icon={<Clock className="h-5 w-5" />}
          color="primary"
          isLoading={isLoading}
          trend={{
            direction: 'down',
            percentage: 12,
            isGood: true,
          }}
        />
        
        <MetricCard
          title="Throughput"
          value={metrics?.throughput.current || 0}
          unit="/sec"
          icon={<Zap className="h-5 w-5" />}
          color="success"
          isLoading={isLoading}
          trend={{
            direction: 'up',
            percentage: 8,
            isGood: true,
          }}
        />
        
        <MetricCard
          title="Error Rate"
          value={metrics?.errorRate.current || 0}
          unit="%"
          icon={<AlertTriangle className="h-5 w-5" />}
          color="warning"
          isLoading={isLoading}
          trend={{
            direction: 'down',
            percentage: 5,
            isGood: true,
          }}
        />
        
        <MetricCard
          title="Cost"
          value={formatCurrency(metrics?.cost.current || 0)}
          unit="/hour"
          icon={<DollarSign className="h-5 w-5" />}
          color="secondary"
          isLoading={isLoading}
          subtitle={`$${metrics?.cost.daily.toFixed(2) || '0.00'}/day`}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Performance Charts */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Response Time Trends</CardTitle>
              <CardDescription>
                Real-time response time monitoring across all models
              </CardDescription>
            </CardHeader>
            <CardContent>
              {metrics?.responseTime.trend && (
                <LiveChart
                  data={metrics.responseTime.trend}
                  title="Response Time"
                  color="#6366f1"
                  height={250}
                  formatValue={formatTime}
                  unit="ms"
                />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Throughput & Error Rate</CardTitle>
              <CardDescription>
                Request throughput and error rate over time
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    Throughput (req/sec)
                  </h4>
                  {metrics?.throughput.trend && (
                    <LiveChart
                      data={metrics.throughput.trend}
                      title="Throughput"
                      color="#22c55e"
                      height={180}
                      unit="/sec"
                    />
                  )}
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    Error Rate (%)
                  </h4>
                  {metrics?.errorRate.trend && (
                    <LiveChart
                      data={metrics.errorRate.trend}
                      title="Error Rate"
                      color="#f59e0b"
                      height={180}
                      formatValue={formatPercentage}
                      unit="%"
                    />
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* System Health */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>System Health</CardTitle>
                <Badge variant={getSystemHealthColor(metrics?.systemHealth.status || 'healthy')}>
                  {metrics?.systemHealth.status || 'Loading...'}
                </Badge>
              </div>
              <CardDescription>
                Resource utilization and system status
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Cpu className="h-4 w-4 text-gray-500" />
                    <span className="text-sm font-medium">CPU</span>
                  </div>
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {metrics?.systemHealth.cpu || 0}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div 
                    className="bg-primary-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${metrics?.systemHealth.cpu || 0}%` }}
                  />
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <HardDrive className="h-4 w-4 text-gray-500" />
                    <span className="text-sm font-medium">CPU Memory</span>
                  </div>
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {metrics?.systemHealth.memory || 0}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div 
                    className="bg-success-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${metrics?.systemHealth.memory || 0}%` }}
                  />
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-gray-500" />
                    <span className="text-sm font-medium">GPU</span>
                  </div>
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {metrics?.systemHealth.gpu || 0}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div 
                    className="bg-warning-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${metrics?.systemHealth.gpu || 0}%` }}
                  />
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MemoryStick className="h-4 w-4 text-gray-500" />
                    <span className="text-sm font-medium">GPU Memory</span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {metrics?.systemHealth.gpuMemory || 0}%
                    </span>
                    {metrics?.systemHealth.gpuMemoryUsed && metrics?.systemHealth.gpuMemoryTotal && (
                      <span className="text-xs text-gray-500 dark:text-gray-500">
                        {(metrics.systemHealth.gpuMemoryUsed / 1024).toFixed(1)}GB / {(metrics.systemHealth.gpuMemoryTotal / 1024).toFixed(1)}GB
                      </span>
                    )}
                  </div>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div 
                    className="bg-purple-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${metrics?.systemHealth.gpuMemory || 0}%` }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Recent Alerts */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Alerts</CardTitle>
              <CardDescription>
                Latest system notifications and alerts
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <AnimatePresence>
                  {alerts.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                      <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No recent alerts</p>
                    </div>
                  ) : (
                    alerts.map((alert) => (
                      <motion.div
                        key={alert.id}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
                      >
                        <span className="text-lg">{getAlertIcon(alert.type)}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                            {alert.title}
                          </p>
                          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                            {alert.message}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                            {new Date(alert.timestamp).toLocaleTimeString()}
                          </p>
                        </div>
                      </motion.div>
                    ))
                  )}
                </AnimatePresence>
              </div>
            </CardContent>
          </Card>

          {/* Cost Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Cost Summary</CardTitle>
              <CardDescription>
                Current usage and cost breakdown
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Current Hour</span>
                  <span className="font-medium">{formatCurrency(metrics?.cost.current || 0)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Today</span>
                  <span className="font-medium">{formatCurrency(metrics?.cost.daily || 0)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600 dark:text-gray-400">This Month</span>
                  <span className="font-medium">{formatCurrency(metrics?.cost.monthly || 0)}</span>
                </div>
                <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
                  {metrics?.cost.trend && (
                    <LiveChart
                      data={metrics.cost.trend}
                      title="Cost Trend"
                      color="#64748b"
                      height={100}
                      formatValue={formatCurrency}
                      showGrid={false}
                    />
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
