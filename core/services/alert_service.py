from enum import Enum
from dataclasses import dataclass, asdict
from typing import List, Callable, Dict, Optional
import time
import logging
from .monitoring_service import SystemMetrics

logger = logging.getLogger(__name__)

class AlertLevel(Enum):
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"

@dataclass
class Alert:
    id: str
    level: AlertLevel
    title: str
    message: str
    timestamp: float
    metric_name: str
    current_value: float
    threshold: float
    is_resolved: bool = False
    
    def to_dict(self) -> dict:
        """Convert to dictionary for JSON serialization"""
        data = asdict(self)
        data['level'] = self.level.value
        return data

@dataclass
class AlertRule:
    metric_name: str
    threshold: float
    comparison: str  # 'gt', 'lt', 'eq'
    level: AlertLevel
    title: str
    message_template: str
    enabled: bool = True
    cooldown_seconds: int = 300  # 5 minutes default cooldown

class AlertManager:
    def __init__(self):
        self.rules: List[AlertRule] = []
        self.active_alerts: Dict[str, Alert] = {}
        self.alert_history: List[Alert] = []
        self.callbacks: List[Callable[[Alert], None]] = []
        self.last_alert_times: Dict[str, float] = {}
        self.max_history = 1000
        
    def add_rule(self, rule: AlertRule):
        """Add an alert rule"""
        self.rules.append(rule)
        logger.info(f"Added alert rule: {rule.title}")
    
    def remove_rule(self, metric_name: str, threshold: float, comparison: str):
        """Remove an alert rule"""
        self.rules = [
            rule for rule in self.rules 
            if not (rule.metric_name == metric_name and 
                   rule.threshold == threshold and 
                   rule.comparison == comparison)
        ]
    
    def add_callback(self, callback: Callable[[Alert], None]):
        """Add callback for when alerts are triggered"""
        self.callbacks.append(callback)
    
    def check_metrics(self, metrics: SystemMetrics):
        """Check metrics against alert rules"""
        if not metrics:
            return
            
        metric_values = {
            'cpu_percent': metrics.cpu_percent,
            'memory_percent': metrics.memory_percent,
            'disk_percent': metrics.disk_percent,
            'gpu_percent': metrics.gpu_percent or 0
        }
        
        current_time = time.time()
        
        for rule in self.rules:
            if not rule.enabled or rule.metric_name not in metric_values:
                continue
                
            current_value = metric_values[rule.metric_name]
            should_alert = self._evaluate_condition(
                current_value, rule.threshold, rule.comparison
            )
            
            alert_key = f"{rule.metric_name}_{rule.comparison}_{rule.threshold}"
            
            # Check cooldown period
            last_alert_time = self.last_alert_times.get(alert_key, 0)
            if current_time - last_alert_time < rule.cooldown_seconds:
                continue
            
            if should_alert and alert_key not in self.active_alerts:
                # Create new alert
                alert = Alert(
                    id=f"alert_{int(current_time)}_{alert_key}",
                    level=rule.level,
                    title=rule.title,
                    message=rule.message_template.format(
                        value=current_value,
                        threshold=rule.threshold
                    ),
                    timestamp=current_time,
                    metric_name=rule.metric_name,
                    current_value=current_value,
                    threshold=rule.threshold
                )
                
                self.active_alerts[alert_key] = alert
                self.alert_history.append(alert)
                self.last_alert_times[alert_key] = current_time
                
                # Limit history size
                if len(self.alert_history) > self.max_history:
                    self.alert_history.pop(0)
                
                logger.warning(f"Alert triggered: {alert.title}")
                
                # Trigger callbacks
                for callback in self.callbacks:
                    try:
                        callback(alert)
                    except Exception as e:
                        logger.error(f"Error in alert callback: {e}")
            
            elif not should_alert and alert_key in self.active_alerts:
                # Resolve alert
                alert = self.active_alerts[alert_key]
                alert.is_resolved = True
                del self.active_alerts[alert_key]
                
                logger.info(f"Alert resolved: {alert.title}")
    
    def _evaluate_condition(self, value: float, threshold: float, comparison: str) -> bool:
        """Evaluate alert condition"""
        if comparison == 'gt':
            return value > threshold
        elif comparison == 'lt':
            return value < threshold
        elif comparison == 'eq':
            return abs(value - threshold) < 0.01
        elif comparison == 'gte':
            return value >= threshold
        elif comparison == 'lte':
            return value <= threshold
        return False
    
    def get_active_alerts(self) -> List[Alert]:
        """Get all active alerts"""
        return list(self.active_alerts.values())
    
    def get_alert_history(self, limit: int = 50) -> List[Alert]:
        """Get recent alert history"""
        return self.alert_history[-limit:]
    
    def resolve_alert(self, alert_id: str) -> bool:
        """Manually resolve an alert"""
        for alert_key, alert in self.active_alerts.items():
            if alert.id == alert_id:
                alert.is_resolved = True
                del self.active_alerts[alert_key]
                logger.info(f"Alert manually resolved: {alert.title}")
                return True
        return False
    
    def get_alert_summary(self) -> dict:
        """Get summary of alert status"""
        active_by_level = {}
        for alert in self.active_alerts.values():
            level = alert.level.value
            active_by_level[level] = active_by_level.get(level, 0) + 1
        
        return {
            "total_active": len(self.active_alerts),
            "by_level": active_by_level,
            "total_history": len(self.alert_history),
            "rules_count": len(self.rules)
        }

# Global alert manager
alert_manager = AlertManager()

# Default alert rules
default_rules = [
    AlertRule(
        metric_name="cpu_percent", 
        threshold=80.0, 
        comparison="gt", 
        level=AlertLevel.WARNING,
        title="High CPU Usage", 
        message_template="CPU usage is {value:.1f}%, exceeding threshold of {threshold}%",
        cooldown_seconds=300
    ),
    AlertRule(
        metric_name="cpu_percent", 
        threshold=95.0, 
        comparison="gt", 
        level=AlertLevel.CRITICAL,
        title="Critical CPU Usage", 
        message_template="CPU usage is critically high at {value:.1f}%",
        cooldown_seconds=180
    ),
    AlertRule(
        metric_name="memory_percent", 
        threshold=85.0, 
        comparison="gt", 
        level=AlertLevel.WARNING,
        title="High Memory Usage", 
        message_template="Memory usage is {value:.1f}%, exceeding threshold of {threshold}%",
        cooldown_seconds=300
    ),
    AlertRule(
        metric_name="memory_percent", 
        threshold=95.0, 
        comparison="gt", 
        level=AlertLevel.CRITICAL,
        title="Critical Memory Usage", 
        message_template="Memory usage is critically high at {value:.1f}%",
        cooldown_seconds=180
    ),
    AlertRule(
        metric_name="disk_percent", 
        threshold=90.0, 
        comparison="gt", 
        level=AlertLevel.ERROR,
        title="Low Disk Space", 
        message_template="Disk usage is {value:.1f}%, exceeding threshold of {threshold}%",
        cooldown_seconds=600
    ),
    AlertRule(
        metric_name="disk_percent", 
        threshold=98.0, 
        comparison="gt", 
        level=AlertLevel.CRITICAL,
        title="Critical Disk Space", 
        message_template="Disk space is critically low at {value:.1f}%",
        cooldown_seconds=300
    ),
    AlertRule(
        metric_name="gpu_percent", 
        threshold=95.0, 
        comparison="gt", 
        level=AlertLevel.WARNING,
        title="High GPU Usage", 
        message_template="GPU usage is {value:.1f}%, exceeding threshold of {threshold}%",
        cooldown_seconds=300
    )
]

# Initialize default rules
for rule in default_rules:
    alert_manager.add_rule(rule)

logger.info(f"Initialized alert manager with {len(default_rules)} default rules")
