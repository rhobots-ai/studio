import asyncio
import json
from typing import Set, Dict, Any, Optional
from fastapi import WebSocket, WebSocketDisconnect
import logging
import time

logger = logging.getLogger(__name__)

class WebSocketManager:
    def __init__(self):
        self.active_connections: Set[WebSocket] = set()
        self.connection_info: Dict[WebSocket, Dict[str, Any]] = {}
        self._broadcast_lock = asyncio.Lock()
        
    async def connect(self, websocket: WebSocket, client_id: Optional[str] = None):
        """Accept WebSocket connection"""
        try:
            await websocket.accept()
            self.active_connections.add(websocket)
            self.connection_info[websocket] = {
                'client_id': client_id or f"client_{int(time.time())}",
                'connected_at': time.time(),
                'last_ping': time.time()
            }
            logger.info(f"WebSocket connected: {self.connection_info[websocket]['client_id']}")
            
            # Send welcome message
            await self.send_personal_message({
                "type": "connection",
                "status": "connected",
                "client_id": self.connection_info[websocket]['client_id'],
                "timestamp": time.time()
            }, websocket)
            
        except Exception as e:
            logger.error(f"Error accepting WebSocket connection: {e}")
            raise
    
    def disconnect(self, websocket: WebSocket):
        """Remove WebSocket connection"""
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            client_info = self.connection_info.pop(websocket, {})
            logger.info(f"WebSocket disconnected: {client_info.get('client_id', 'unknown')}")
    
    async def send_personal_message(self, message: dict, websocket: WebSocket):
        """Send message to specific WebSocket"""
        try:
            if websocket in self.active_connections:
                await websocket.send_text(json.dumps(message, default=str))
        except Exception as e:
            logger.error(f"Error sending personal message: {e}")
            self.disconnect(websocket)
    
    async def broadcast(self, message: dict):
        """Broadcast message to all connected WebSockets"""
        if not self.active_connections:
            return
        
        async with self._broadcast_lock:
            disconnected = set()
            message_str = json.dumps(message, default=str)
            
            for connection in self.active_connections.copy():
                try:
                    await connection.send_text(message_str)
                except Exception as e:
                    logger.error(f"Error broadcasting to connection: {e}")
                    disconnected.add(connection)
            
            # Clean up disconnected connections
            for connection in disconnected:
                self.disconnect(connection)
    
    async def handle_client_message(self, websocket: WebSocket, message: str):
        """Handle incoming message from client"""
        try:
            data = json.loads(message)
            message_type = data.get("type")
            
            if message_type == "ping":
                # Update last ping time
                if websocket in self.connection_info:
                    self.connection_info[websocket]['last_ping'] = time.time()
                
                # Send pong response
                await self.send_personal_message({
                    "type": "pong",
                    "timestamp": time.time()
                }, websocket)
                
            elif message_type == "subscribe":
                # Handle subscription requests
                topics = data.get("topics", [])
                if websocket in self.connection_info:
                    self.connection_info[websocket]['subscriptions'] = topics
                
                await self.send_personal_message({
                    "type": "subscription_confirmed",
                    "topics": topics,
                    "timestamp": time.time()
                }, websocket)
                
            elif message_type == "get_status":
                # Send current connection status
                await self.send_personal_message({
                    "type": "status",
                    "connection_count": len(self.active_connections),
                    "client_info": self.connection_info.get(websocket, {}),
                    "timestamp": time.time()
                }, websocket)
                
        except json.JSONDecodeError:
            logger.warning(f"Invalid JSON received from WebSocket")
        except Exception as e:
            logger.error(f"Error handling client message: {e}")
    
    def get_connection_count(self) -> int:
        """Get number of active connections"""
        return len(self.active_connections)
    
    def get_connection_info(self) -> Dict[str, Any]:
        """Get information about all connections"""
        return {
            "total_connections": len(self.active_connections),
            "connections": [
                {
                    "client_id": info.get('client_id'),
                    "connected_at": info.get('connected_at'),
                    "last_ping": info.get('last_ping'),
                    "subscriptions": info.get('subscriptions', [])
                }
                for info in self.connection_info.values()
            ]
        }
    
    async def cleanup_stale_connections(self, timeout_seconds: int = 300):
        """Remove connections that haven't pinged recently"""
        current_time = time.time()
        stale_connections = []
        
        for websocket, info in self.connection_info.items():
            last_ping = info.get('last_ping', info.get('connected_at', 0))
            if current_time - last_ping > timeout_seconds:
                stale_connections.append(websocket)
        
        for websocket in stale_connections:
            logger.info(f"Removing stale connection: {self.connection_info.get(websocket, {}).get('client_id')}")
            self.disconnect(websocket)
            try:
                await websocket.close()
            except:
                pass  # Connection might already be closed

# Global WebSocket manager
websocket_manager = WebSocketManager()

# Background task for connection cleanup
async def connection_cleanup_task():
    """Background task to clean up stale connections"""
    while True:
        try:
            await websocket_manager.cleanup_stale_connections()
            await asyncio.sleep(60)  # Check every minute
        except Exception as e:
            logger.error(f"Error in connection cleanup task: {e}")
            await asyncio.sleep(60)
