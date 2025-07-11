export interface MetricData {
  timestamp: number;
  value: number;
  label?: string;
}

export interface PerformanceMetrics {
  responseTime: {
    current: number;
    p50: number;
    p95: number;
    p99: number;
    trend: MetricData[];
  };
  throughput: {
    current: number;
    peak: number;
    trend: MetricData[];
  };
  errorRate: {
    current: number;
    trend: MetricData[];
  };
  cost: {
    current: number;
    daily: number;
    monthly: number;
    trend: MetricData[];
  };
  systemHealth: {
    cpu: number;
    memory: number;
    gpu: number;
    gpuMemory: number;
    gpuMemoryUsed?: number;
    gpuMemoryTotal?: number;
    status: 'healthy' | 'warning' | 'critical';
  };
}

export interface Alert {
  id: string;
  type: 'info' | 'warning' | 'error' | 'success';
  title: string;
  message: string;
  timestamp: number;
  isRead: boolean;
}

class MonitoringService {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private listeners: Map<string, Function[]> = new Map();
  private wsUrl: string;
  private baseUrl: string;
  private pollingInterval: NodeJS.Timeout | null = null;
  private isConnected = false;

  constructor() {
    // Get base URL from environment variables
    this.baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
    
    // Determine WebSocket URL based on base URL
    const wsProtocol = this.baseUrl.startsWith('https:') ? 'wss:' : 'ws:';
    const urlWithoutProtocol = this.baseUrl.replace(/^https?:\/\//, '');
    this.wsUrl = `${wsProtocol}//${urlWithoutProtocol}/api/monitoring/ws`;
    
    this.connect();
    
    // Start fallback polling mechanism
    this.startPolling();
  }

  private connect() {
    try {
      console.log('Connecting to monitoring WebSocket:', this.wsUrl);
      
      this.ws = new WebSocket(this.wsUrl);
      
      this.ws.onopen = () => this.onOpen();
      this.ws.onmessage = (event) => this.onMessage(event.data);
      this.ws.onclose = () => this.onClose();
      this.ws.onerror = (error) => this.onError(error);
      
    } catch (error) {
      console.error('Failed to connect to monitoring service:', error);
      this.scheduleReconnect();
    }
  }

  private onOpen() {
    console.log('Connected to monitoring service');
    this.reconnectAttempts = 0;
    this.isConnected = true;
    
    // Send ping to establish connection
    this.sendMessage({ type: 'ping' });
    
    // Set up periodic ping
    setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.sendMessage({ type: 'ping' });
      }
    }, 30000); // Ping every 30 seconds
  }

  private onMessage(data: any) {
    try {
      const event = JSON.parse(data);
      
      // Handle different message types
      switch (event.type) {
        case 'metrics':
          this.handleMetricsMessage(event.data);
          break;
        case 'alerts':
          this.emit('alerts', event.data);
          break;
        case 'new_alert':
          this.emit('alert', event.data);
          break;
        case 'pong':
          // Handle pong response
          break;
        case 'connection':
          console.log('Connection confirmed:', event);
          break;
        default:
          console.log('Unknown message type:', event.type);
      }
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
    }
  }

  private onClose() {
    console.log('Monitoring connection closed');
    this.isConnected = false;
    this.scheduleReconnect();
  }

  private onError(error: any) {
    console.error('Monitoring connection error:', error);
    this.isConnected = false;
    this.scheduleReconnect();
  }

  private scheduleReconnect() {
    this.isConnected = false;
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      setTimeout(() => {
        this.connect();
      }, this.reconnectDelay * this.reconnectAttempts);
    }
  }

  private sendMessage(message: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  private handleMetricsMessage(data: any) {
    // Convert backend metrics to frontend format
    const gpuMemoryPercent = data.gpu_memory_used && data.gpu_memory_total 
      ? (data.gpu_memory_used / data.gpu_memory_total) * 100 
      : 0;

    const metrics: PerformanceMetrics = {
      responseTime: {
        current: 0, // Will be calculated from API response times
        p50: 0,
        p95: 0,
        p99: 0,
        trend: this.generateTrendData(85, 20), // Fallback trend data
      },
      throughput: {
        current: 0, // Will be calculated from request counts
        peak: 0,
        trend: this.generateTrendData(1200, 20), // Fallback trend data
      },
      errorRate: {
        current: 0, // Will be calculated from error rates
        trend: this.generateTrendData(0.1, 20), // Fallback trend data
      },
      cost: {
        current: 0, // Will be calculated from usage
        daily: 0,
        monthly: 0,
        trend: this.generateTrendData(24, 20), // Fallback trend data
      },
      systemHealth: {
        cpu: data.cpu_percent || 0,
        memory: data.memory_percent || 0,
        gpu: data.gpu_percent || 0,
        gpuMemory: Math.round(gpuMemoryPercent),
        gpuMemoryUsed: data.gpu_memory_used,
        gpuMemoryTotal: data.gpu_memory_total,
        status: this.getHealthStatus(data.cpu_percent, data.memory_percent, data.disk_percent),
      },
    };

    this.emit('metrics', metrics);
  }

  private getHealthStatus(cpu: number, memory: number, disk: number): 'healthy' | 'warning' | 'critical' {
    if (cpu > 95 || memory > 95 || disk > 98) {
      return 'critical';
    } else if (cpu > 80 || memory > 85 || disk > 90) {
      return 'warning';
    }
    return 'healthy';
  }

  private emit(event: string, data: any) {
    const listeners = this.listeners.get(event) || [];
    listeners.forEach(listener => listener(data));
  }

  public on(event: string, callback: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  public off(event: string, callback: Function) {
    const listeners = this.listeners.get(event) || [];
    const index = listeners.indexOf(callback);
    if (index > -1) {
      listeners.splice(index, 1);
    }
  }

  private generateTrendData(baseValue: number, points: number): MetricData[] {
    const data: MetricData[] = [];
    const now = Date.now();
    
    for (let i = points - 1; i >= 0; i--) {
      const timestamp = now - (i * 30000); // 30 seconds apart
      const variation = (Math.random() - 0.5) * 0.3; // ±15% variation
      const value = baseValue * (1 + variation);
      data.push({
        timestamp,
        value: Number(value.toFixed(2)),
      });
    }
    
    return data;
  }

  public async getHistoricalMetrics(timeRange: '1h' | '6h' | '24h' | '7d'): Promise<PerformanceMetrics> {
    try {
      // Make API call to backend for historical data
      const response = await fetch(`${this.baseUrl}/api/monitoring/metrics/history?limit=${this.getPointsForTimeRange(timeRange)}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      
      // Convert backend data to frontend format
      return this.convertBackendMetricsToFrontend(data.metrics);
    } catch (error) {
      console.error('Error fetching historical metrics:', error);
      
      // Fallback to mock data if API fails
      const points = this.getPointsForTimeRange(timeRange);
      const baseResponseTime = 92;
      const baseThroughput = 1350;
      const baseErrorRate = 0.15;
      const baseCost = 28;

      return {
        responseTime: {
          current: baseResponseTime,
          p50: Math.round(baseResponseTime * 0.8),
          p95: Math.round(baseResponseTime * 1.5),
          p99: Math.round(baseResponseTime * 2.2),
          trend: this.generateTrendData(baseResponseTime, points),
        },
        throughput: {
          current: baseThroughput,
          peak: Math.round(baseThroughput * 1.3),
          trend: this.generateTrendData(baseThroughput, points),
        },
        errorRate: {
          current: baseErrorRate,
          trend: this.generateTrendData(baseErrorRate, points),
        },
        cost: {
          current: baseCost,
          daily: baseCost * 24,
          monthly: baseCost * 24 * 30,
          trend: this.generateTrendData(baseCost, points),
        },
        systemHealth: {
          cpu: 52,
          memory: 68,
          gpu: 75,
          gpuMemory: 45,
          status: 'healthy',
        },
      };
    }
  }

  private getPointsForTimeRange(timeRange: '1h' | '6h' | '24h' | '7d'): number {
    switch (timeRange) {
      case '1h': return 60;
      case '6h': return 72;
      case '24h': return 96;
      case '7d': return 168;
      default: return 60;
    }
  }

  private convertBackendMetricsToFrontend(backendMetrics: any[]): PerformanceMetrics {
    // Convert backend metrics array to frontend format
    const latest = backendMetrics[backendMetrics.length - 1] || {};
    
    return {
      responseTime: {
        current: 0, // Will be calculated from API response times
        p50: 0,
        p95: 0,
        p99: 0,
        trend: this.generateTrendData(85, 20), // Fallback trend data
      },
      throughput: {
        current: 0, // Will be calculated from request counts
        peak: 0,
        trend: this.generateTrendData(1200, 20), // Fallback trend data
      },
      errorRate: {
        current: 0, // Will be calculated from error rates
        trend: this.generateTrendData(0.1, 20), // Fallback trend data
      },
      cost: {
        current: 0, // Will be calculated from usage
        daily: 0,
        monthly: 0,
        trend: this.generateTrendData(24, 20), // Fallback trend data
      },
      systemHealth: {
        cpu: latest.cpu_percent || 0,
        memory: latest.memory_percent || 0,
        gpu: latest.gpu_percent || 0,
        gpuMemory: latest.gpu_memory_used && latest.gpu_memory_total 
          ? (latest.gpu_memory_used / latest.gpu_memory_total) * 100 
          : 0,
        gpuMemoryUsed: latest.gpu_memory_used,
        gpuMemoryTotal: latest.gpu_memory_total,
        status: this.getHealthStatus(latest.cpu_percent, latest.memory_percent, latest.disk_percent),
      },
    };
  }

  // Add method to fetch current metrics from API
  public async getCurrentMetrics(): Promise<PerformanceMetrics | null> {
    try {
      const response = await fetch(`${this.baseUrl}/api/monitoring/metrics`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      
      // Convert backend data to frontend format
      return {
        responseTime: {
          current: 0, // Will be calculated from API response times
          p50: 0,
          p95: 0,
          p99: 0,
          trend: this.generateTrendData(85, 20),
        },
        throughput: {
          current: 0, // Will be calculated from request counts
          peak: 0,
          trend: this.generateTrendData(1200, 20),
        },
        errorRate: {
          current: 0, // Will be calculated from error rates
          trend: this.generateTrendData(0.1, 20),
        },
        cost: {
          current: 0, // Will be calculated from usage
          daily: 0,
          monthly: 0,
          trend: this.generateTrendData(24, 20),
        },
        systemHealth: {
          cpu: data.cpu?.percent || 0,
          memory: data.memory?.percent || 0,
          gpu: data.gpu?.percent || 0,
          gpuMemory: data.gpu?.memory_used && data.gpu?.memory_total 
            ? (data.gpu.memory_used / data.gpu.memory_total) * 100 
            : 0,
          gpuMemoryUsed: data.gpu?.memory_used,
          gpuMemoryTotal: data.gpu?.memory_total,
          status: this.getHealthStatus(data.cpu?.percent, data.memory?.percent, data.disk?.percent),
        },
      };
    } catch (error) {
      console.error('Error fetching current metrics:', error);
      return null;
    }
  }

  // Add method to fetch alerts from API
  public async getAlerts(): Promise<{ active: Alert[], history: Alert[] }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/monitoring/alerts`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      
      return {
        active: data.active.map((alert: any) => ({
          id: alert.id,
          type: alert.level as 'info' | 'warning' | 'error' | 'success',
          title: alert.title,
          message: alert.message,
          timestamp: alert.timestamp * 1000, // Convert to milliseconds
          isRead: false
        })),
        history: data.history.map((alert: any) => ({
          id: alert.id,
          type: alert.level as 'info' | 'warning' | 'error' | 'success',
          title: alert.title,
          message: alert.message,
          timestamp: alert.timestamp * 1000, // Convert to milliseconds
          isRead: alert.is_resolved
        }))
      };
    } catch (error) {
      console.error('Error fetching alerts:', error);
      return { active: [], history: [] };
    }
  }

  private startPolling() {
    // Start polling every 3 seconds as fallback when WebSocket is not available
    this.pollingInterval = setInterval(async () => {
      if (!this.isConnected) {
        try {
          // Try to fetch current metrics via API
          const metrics = await this.getCurrentMetrics();
          if (metrics) {
            this.emit('metrics', metrics);
          } else {
            // If API fails, generate simulated data for demo
            this.generateSimulatedMetrics();
          }
        } catch (error) {
          // If everything fails, generate simulated data
          this.generateSimulatedMetrics();
        }
      }
    }, 3000);
  }

  private generateSimulatedMetrics() {
    const now = Date.now();
    const baseResponseTime = 85 + Math.random() * 30;
    const baseThroughput = 1200 + Math.random() * 400;
    const baseErrorRate = 0.1 + Math.random() * 0.3;
    const baseCost = 24 + Math.random() * 8;

    const metrics: PerformanceMetrics = {
      responseTime: {
        current: Math.round(baseResponseTime),
        p50: Math.round(baseResponseTime * 0.8),
        p95: Math.round(baseResponseTime * 1.5),
        p99: Math.round(baseResponseTime * 2.2),
        trend: this.generateTrendData(baseResponseTime, 20),
      },
      throughput: {
        current: Math.round(baseThroughput),
        peak: Math.round(baseThroughput * 1.3),
        trend: this.generateTrendData(baseThroughput, 20),
      },
      errorRate: {
        current: Number(baseErrorRate.toFixed(2)),
        trend: this.generateTrendData(baseErrorRate, 20),
      },
      cost: {
        current: Number(baseCost.toFixed(2)),
        daily: Number((baseCost * 24).toFixed(2)),
        monthly: Number((baseCost * 24 * 30).toFixed(2)),
        trend: this.generateTrendData(baseCost, 20),
      },
      systemHealth: {
        cpu: Math.round(45 + Math.random() * 30),
        memory: Math.round(60 + Math.random() * 25),
        gpu: Math.round(70 + Math.random() * 20),
        gpuMemory: Math.round(40 + Math.random() * 35),
        status: Math.random() > 0.8 ? 'warning' : 'healthy',
      },
    };

    this.emit('metrics', metrics);

    // Occasionally generate alerts
    if (Math.random() > 0.9) {
      this.generateSimulatedAlert();
    }
  }

  private generateSimulatedAlert() {
    const alertTypes = ['info', 'warning', 'error', 'success'] as const;
    const alertMessages = [
      { type: 'success', title: 'Model Deployed', message: 'Mistral-7B-custom successfully deployed to production' },
      { type: 'warning', title: 'High Response Time', message: 'Average response time exceeded 150ms threshold' },
      { type: 'info', title: 'Training Complete', message: 'Fine-tuning job #1234 completed successfully' },
      { type: 'error', title: 'API Error', message: 'Increased error rate detected in model inference' },
      { type: 'info', title: 'Cost Alert', message: 'Monthly usage approaching budget limit' },
    ];

    const randomAlert = alertMessages[Math.floor(Math.random() * alertMessages.length)];
    const alert: Alert = {
      id: `alert-${Date.now()}`,
      type: randomAlert.type as 'info' | 'warning' | 'error' | 'success',
      title: randomAlert.title,
      message: randomAlert.message,
      timestamp: Date.now(),
      isRead: false,
    };
    
    this.emit('alert', alert);
  }

  public disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }
}

export const monitoringService = new MonitoringService();
