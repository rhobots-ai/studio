import psutil
import time
import asyncio
from datetime import datetime
from typing import Dict, List, Optional
from dataclasses import dataclass, asdict
import json
import logging

logger = logging.getLogger(__name__)

@dataclass
class SystemMetrics:
    timestamp: float
    cpu_percent: float
    memory_percent: float
    memory_used: int
    memory_total: int
    disk_percent: float
    disk_used: int
    disk_total: int
    network_sent: int
    network_recv: int
    gpu_percent: Optional[float] = None
    gpu_memory_used: Optional[int] = None
    gpu_memory_total: Optional[int] = None
    
    def to_dict(self) -> dict:
        """Convert to dictionary for JSON serialization"""
        return asdict(self)

class SystemMonitor:
    def __init__(self):
        self.is_running = False
        self.metrics_history: List[SystemMetrics] = []
        self.max_history = 1000  # Keep last 1000 readings
        self.current_metrics: Optional[SystemMetrics] = None
        self.start_time = time.time()
        self._network_baseline = None
        
    def get_system_metrics(self) -> SystemMetrics:
        """Collect current system metrics"""
        try:
            # CPU metrics
            cpu_percent = psutil.cpu_percent(interval=0.1)
            
            # Memory metrics
            memory = psutil.virtual_memory()
            
            # Disk metrics (root partition)
            disk = psutil.disk_usage('/')
            
            # Network metrics
            network = psutil.net_io_counters()
            
            # Initialize network baseline on first run
            if self._network_baseline is None:
                self._network_baseline = {
                    'bytes_sent': network.bytes_sent,
                    'bytes_recv': network.bytes_recv
                }
            
            # GPU metrics (optional)
            gpu_percent = None
            gpu_memory_used = None
            gpu_memory_total = None
            
            try:
                import GPUtil
                gpus = GPUtil.getGPUs()
                if gpus:
                    gpu = gpus[0]  # First GPU
                    gpu_percent = gpu.load * 100
                    gpu_memory_used = gpu.memoryUsed
                    gpu_memory_total = gpu.memoryTotal
            except ImportError:
                logger.debug("GPUtil not available, skipping GPU monitoring")
            except Exception as e:
                logger.warning(f"Error getting GPU metrics: {e}")
            
            return SystemMetrics(
                timestamp=time.time(),
                cpu_percent=round(cpu_percent, 2),
                memory_percent=round(memory.percent, 2),
                memory_used=memory.used,
                memory_total=memory.total,
                disk_percent=round(disk.percent, 2),
                disk_used=disk.used,
                disk_total=disk.total,
                network_sent=network.bytes_sent,
                network_recv=network.bytes_recv,
                gpu_percent=round(gpu_percent, 2) if gpu_percent is not None else None,
                gpu_memory_used=gpu_memory_used,
                gpu_memory_total=gpu_memory_total
            )
            
        except Exception as e:
            logger.error(f"Error collecting system metrics: {e}")
            # Return default metrics on error
            return SystemMetrics(
                timestamp=time.time(),
                cpu_percent=0.0,
                memory_percent=0.0,
                memory_used=0,
                memory_total=0,
                disk_percent=0.0,
                disk_used=0,
                disk_total=0,
                network_sent=0,
                network_recv=0
            )
    
    async def start_monitoring(self, interval: float = 2.0):
        """Start continuous monitoring"""
        logger.info("Starting system monitoring...")
        self.is_running = True
        self.start_time = time.time()
        
        while self.is_running:
            try:
                metrics = self.get_system_metrics()
                self.current_metrics = metrics
                
                # Add to history
                self.metrics_history.append(metrics)
                if len(self.metrics_history) > self.max_history:
                    self.metrics_history.pop(0)
                
                logger.debug(f"Collected metrics: CPU {metrics.cpu_percent}%, Memory {metrics.memory_percent}%")
                
                await asyncio.sleep(interval)
                
            except Exception as e:
                logger.error(f"Error in monitoring loop: {e}")
                await asyncio.sleep(interval)
    
    def stop_monitoring(self):
        """Stop monitoring"""
        logger.info("Stopping system monitoring...")
        self.is_running = False
    
    def get_current_metrics(self) -> Optional[SystemMetrics]:
        """Get latest metrics"""
        return self.current_metrics
    
    def get_metrics_history(self, limit: int = 100) -> List[SystemMetrics]:
        """Get recent metrics history"""
        return self.metrics_history[-limit:]
    
    def get_uptime(self) -> float:
        """Get monitoring uptime in seconds"""
        return time.time() - self.start_time
    
    def get_system_info(self) -> dict:
        """Get static system information"""
        try:
            boot_time = psutil.boot_time()
            cpu_count = psutil.cpu_count()
            cpu_count_logical = psutil.cpu_count(logical=True)
            
            return {
                "boot_time": boot_time,
                "uptime": time.time() - boot_time,
                "cpu_count_physical": cpu_count,
                "cpu_count_logical": cpu_count_logical,
                "platform": psutil.WINDOWS if hasattr(psutil, 'WINDOWS') else "unix",
                "monitoring_uptime": self.get_uptime()
            }
        except Exception as e:
            logger.error(f"Error getting system info: {e}")
            return {}

# Global monitor instance
system_monitor = SystemMonitor()
