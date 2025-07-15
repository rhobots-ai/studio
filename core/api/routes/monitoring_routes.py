from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException, Query
from typing import List, Optional
import asyncio
import json
import time
import logging

from services.monitoring_service import system_monitor, SystemMetrics
from services.alert_service import alert_manager
from core.websocket_manager import websocket_manager

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/monitoring", tags=["monitoring"])

@router.get("/metrics")
async def get_current_metrics():
    """Get current system metrics"""
    metrics = system_monitor.get_current_metrics()
    if not metrics:
        raise HTTPException(status_code=503, detail="Monitoring not available")
    
    return {
        "timestamp": metrics.timestamp,
        "cpu": {
            "percent": metrics.cpu_percent
        },
        "memory": {
            "percent": metrics.memory_percent,
            "used": metrics.memory_used,
            "total": metrics.memory_total,
            "used_gb": round(metrics.memory_used / (1024**3), 2),
            "total_gb": round(metrics.memory_total / (1024**3), 2)
        },
        "disk": {
            "percent": metrics.disk_percent,
            "used": metrics.disk_used,
            "total": metrics.disk_total,
            "used_gb": round(metrics.disk_used / (1024**3), 2),
            "total_gb": round(metrics.disk_total / (1024**3), 2)
        },
        "network": {
            "bytes_sent": metrics.network_sent,
            "bytes_recv": metrics.network_recv,
            "sent_mb": round(metrics.network_sent / (1024**2), 2),
            "recv_mb": round(metrics.network_recv / (1024**2), 2)
        },
        "gpu": {
            "percent": metrics.gpu_percent,
            "memory_used": metrics.gpu_memory_used,
            "memory_total": metrics.gpu_memory_total,
            "memory_used_gb": round(metrics.gpu_memory_used / 1024, 2) if metrics.gpu_memory_used else None,
            "memory_total_gb": round(metrics.gpu_memory_total / 1024, 2) if metrics.gpu_memory_total else None
        } if metrics.gpu_percent is not None else None
    }

@router.get("/metrics/history")
async def get_metrics_history(limit: int = Query(100, ge=1, le=1000)):
    """Get historical metrics"""
    history = system_monitor.get_metrics_history(limit)
    return {
        "count": len(history),
        "metrics": [
            {
                "timestamp": m.timestamp,
                "cpu_percent": m.cpu_percent,
                "memory_percent": m.memory_percent,
                "disk_percent": m.disk_percent,
                "gpu_percent": m.gpu_percent,
                "network_sent": m.network_sent,
                "network_recv": m.network_recv
            }
            for m in history
        ]
    }

@router.get("/health")
async def get_system_health():
    """Get system health status"""
    metrics = system_monitor.get_current_metrics()
    if not metrics:
        return {"status": "unknown", "message": "Monitoring not available"}
    
    # Determine health status based on metrics
    status = "healthy"
    issues = []
    warnings = []
    
    # CPU checks
    if metrics.cpu_percent > 95:
        status = "critical"
        issues.append(f"Critical CPU usage: {metrics.cpu_percent:.1f}%")
    elif metrics.cpu_percent > 80:
        if status == "healthy":
            status = "warning"
        warnings.append(f"High CPU usage: {metrics.cpu_percent:.1f}%")
    
    # Memory checks
    if metrics.memory_percent > 95:
        status = "critical"
        issues.append(f"Critical memory usage: {metrics.memory_percent:.1f}%")
    elif metrics.memory_percent > 85:
        if status == "healthy":
            status = "warning"
        warnings.append(f"High memory usage: {metrics.memory_percent:.1f}%")
    
    # Disk checks
    if metrics.disk_percent > 98:
        status = "critical"
        issues.append(f"Critical disk usage: {metrics.disk_percent:.1f}%")
    elif metrics.disk_percent > 90:
        if status == "healthy":
            status = "warning"
        warnings.append(f"Low disk space: {metrics.disk_percent:.1f}%")
    
    # GPU checks (if available)
    if metrics.gpu_percent and metrics.gpu_percent > 95:
        if status == "healthy":
            status = "warning"
        warnings.append(f"High GPU usage: {metrics.gpu_percent:.1f}%")
    
    return {
        "status": status,
        "timestamp": metrics.timestamp,
        "issues": issues,
        "warnings": warnings,
        "uptime": system_monitor.get_uptime(),
        "system_info": system_monitor.get_system_info()
    }

@router.get("/alerts")
async def get_alerts():
    """Get current alerts"""
    active_alerts = alert_manager.get_active_alerts()
    alert_history = alert_manager.get_alert_history()
    
    return {
        "active": [alert.to_dict() for alert in active_alerts],
        "history": [alert.to_dict() for alert in alert_history],
        "summary": alert_manager.get_alert_summary()
    }

@router.post("/alerts/{alert_id}/resolve")
async def resolve_alert(alert_id: str):
    """Manually resolve an alert"""
    success = alert_manager.resolve_alert(alert_id)
    if not success:
        raise HTTPException(status_code=404, detail="Alert not found")
    
    return {"message": "Alert resolved successfully", "alert_id": alert_id}

@router.get("/system/info")
async def get_system_info():
    """Get detailed system information"""
    return {
        "monitoring": {
            "uptime": system_monitor.get_uptime(),
            "is_running": system_monitor.is_running,
            "metrics_count": len(system_monitor.metrics_history)
        },
        "system": system_monitor.get_system_info(),
        "websocket": websocket_manager.get_connection_info(),
        "alerts": alert_manager.get_alert_summary()
    }

@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, client_id: Optional[str] = None):
    """WebSocket endpoint for real-time monitoring"""
    await websocket_manager.connect(websocket, client_id)
    
    try:
        while True:
            # Wait for client message with timeout
            try:
                data = await asyncio.wait_for(websocket.receive_text(), timeout=1.0)
                await websocket_manager.handle_client_message(websocket, data)
                
            except asyncio.TimeoutError:
                # No message received, continue
                pass
            except WebSocketDisconnect:
                break
            except Exception as e:
                logger.error(f"Error in WebSocket loop: {e}")
                break
            
            await asyncio.sleep(0.1)  # Small delay to prevent busy waiting
            
    except WebSocketDisconnect:
        pass
    finally:
        websocket_manager.disconnect(websocket)

# Background task to broadcast metrics
async def broadcast_metrics():
    """Background task to broadcast metrics to WebSocket clients"""
    logger.info("Starting metrics broadcast task")
    
    while True:
        try:
            if websocket_manager.get_connection_count() > 0:
                metrics = system_monitor.get_current_metrics()
                if metrics:
                    # Broadcast current metrics
                    message = {
                        "type": "metrics",
                        "data": {
                            "timestamp": metrics.timestamp,
                            "cpu_percent": metrics.cpu_percent,
                            "memory_percent": metrics.memory_percent,
                            "disk_percent": metrics.disk_percent,
                            "gpu_percent": metrics.gpu_percent,
                            "gpu_memory_used": metrics.gpu_memory_used,
                            "gpu_memory_total": metrics.gpu_memory_total,
                            "network_sent": metrics.network_sent,
                            "network_recv": metrics.network_recv,
                            "memory_used_gb": round(metrics.memory_used / (1024**3), 2),
                            "memory_total_gb": round(metrics.memory_total / (1024**3), 2),
                            "disk_used_gb": round(metrics.disk_used / (1024**3), 2),
                            "disk_total_gb": round(metrics.disk_total / (1024**3), 2)
                        }
                    }
                    await websocket_manager.broadcast(message)
                    
                    # Check for alerts and broadcast them
                    alert_manager.check_metrics(metrics)
                    active_alerts = alert_manager.get_active_alerts()
                    
                    if active_alerts:
                        alert_message = {
                            "type": "alerts",
                            "data": {
                                "active": [alert.to_dict() for alert in active_alerts],
                                "count": len(active_alerts)
                            }
                        }
                        await websocket_manager.broadcast(alert_message)
            
            await asyncio.sleep(2.0)  # Broadcast every 2 seconds
            
        except Exception as e:
            logger.error(f"Error broadcasting metrics: {e}")
            await asyncio.sleep(5.0)  # Wait longer on error

# Background task to broadcast alerts
async def broadcast_alerts():
    """Background task to broadcast new alerts"""
    logger.info("Starting alerts broadcast task")
    
    def alert_callback(alert):
        """Callback for new alerts"""
        asyncio.create_task(websocket_manager.broadcast({
            "type": "new_alert",
            "data": alert.to_dict()
        }))
    
    # Add callback to alert manager
    alert_manager.add_callback(alert_callback)
    
    # Keep the task running
    while True:
        await asyncio.sleep(60)  # Check every minute for cleanup
