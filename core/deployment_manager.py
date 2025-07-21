import os
import json
import subprocess
import uuid
import time
import requests
import psutil
from typing import Dict, List, Optional, Any
from datetime import datetime
from dataclasses import dataclass, asdict
import threading
import signal
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def get_deployment_endpoint(deployment_id: str, port: int) -> str:
    """Generate deployment endpoint based on environment configuration"""
    deployment_mode = os.getenv('DEPLOYMENT_MODE', 'development')
    
    if deployment_mode == 'production':
        # Production: Use domain-based path routing
        protocol = os.getenv('DEPLOYMENT_PROTOCOL', 'https')
        domain = os.getenv('DEPLOYMENT_DOMAIN', 'deepcite.in')
        base_url = os.getenv('DEPLOYMENT_BASE_URL')
        
        if base_url:
            # Use custom base URL if provided
            return f"{base_url}/{deployment_id}"
        else:
            # Use path-based routing with domain
            return f"{protocol}://{domain}/api/deploy/{deployment_id}"
    else:
        # Development: Use localhost with port
        protocol = os.getenv('DEPLOYMENT_PROTOCOL', 'http')
        host = os.getenv('DEPLOYMENT_HOST', 'localhost')
        return f"{protocol}://{host}:{port}"

def get_health_check_url(deployment: 'DeploymentInfo') -> str:
    """Get the URL for health checks (always use localhost for internal checks)"""
    return f"http://localhost:{deployment.port}"

@dataclass
class DeploymentConfig:
    """Configuration for vLLM deployment"""
    gpu_memory_utilization: float = 0.8
    max_model_len: int = 4096
    tensor_parallel_size: int = 1
    dtype: str = "auto"
    trust_remote_code: bool = False
    enforce_eager: bool = False
    disable_log_stats: bool = True

@dataclass
class DeploymentInfo:
    """Information about a deployment"""
    deployment_id: str
    model_path: str
    port: int
    status: str  # starting, running, failed, stopped
    endpoint: str
    config: DeploymentConfig
    process_id: Optional[int] = None
    created_at: str = ""
    started_at: Optional[str] = None
    error_message: Optional[str] = None
    last_health_check: Optional[str] = None
    resource_usage: Optional[Dict[str, Any]] = None

class PortManager:
    """Manages port allocation for deployments"""
    
    def __init__(self, start_port: int = 8001, end_port: int = 8100):
        self.start_port = start_port
        self.end_port = end_port
        self.used_ports = set()
        
    def get_available_port(self) -> int:
        """Get an available port"""
        for port in range(self.start_port, self.end_port + 1):
            if port not in self.used_ports and self._is_port_free(port):
                self.used_ports.add(port)
                return port
        raise Exception(f"No available ports in range {self.start_port}-{self.end_port}")
    
    def release_port(self, port: int):
        """Release a port back to the pool"""
        self.used_ports.discard(port)
    
    def _is_port_free(self, port: int) -> bool:
        """Check if a port is free"""
        import socket
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.bind(('localhost', port))
                return True
        except OSError:
            return False

class VLLMDeploymentManager:
    """Manages vLLM model deployments"""
    
    def __init__(self):
        self.deployments: Dict[str, DeploymentInfo] = {}
        self.port_manager = PortManager()
        self.deployments_file = "deployments.json"
        self.health_check_interval = 30  # seconds
        self.health_check_thread = None
        self.running = True
        
        # Load existing deployments
        self._load_deployments()
        
        # Start health check thread
        self._start_health_check_thread()
    
    def deploy_model(self, model_path: str, config: DeploymentConfig) -> str:
        """Deploy a model using vLLM"""
        try:
            # Generate deployment ID
            deployment_id = str(uuid.uuid4())
            
            # Get available port
            port = self.port_manager.get_available_port()
            
            # Generate endpoint based on environment configuration
            endpoint = get_deployment_endpoint(deployment_id, port)
            model_path = "finvix/966_e_qwen-2.5-1.5I-15Inv"
            # Create deployment info
            deployment = DeploymentInfo(
                deployment_id=deployment_id,
                model_path=model_path,
                port=port,
                status="starting",
                endpoint=endpoint,
                config=config,
                created_at=datetime.now().isoformat()
            )
            
            # Store deployment info
            self.deployments[deployment_id] = deployment
            self._save_deployments()
            
            # Start vLLM server in background thread
            threading.Thread(
                target=self._start_vllm_server,
                args=(deployment_id,),
                daemon=True
            ).start()
            
            return deployment_id
            
        except Exception as e:
            # Release port if allocation failed
            if 'port' in locals():
                self.port_manager.release_port(port)
            raise Exception(f"Failed to deploy model: {str(e)}")
    
    def _start_vllm_server(self, deployment_id: str):
        """Start vLLM server process"""
        deployment = self.deployments.get(deployment_id)
        if not deployment:
            return
        
        try:
            # Build vLLM command using the unsloth_venv environment
            cmd = f"source ~/unsloth_venv/bin/activate && python -m vllm.entrypoints.openai.api_server --model {deployment.model_path} --port {deployment.port} --host localhost --gpu-memory-utilization {deployment.config.gpu_memory_utilization} --max-model-len {deployment.config.max_model_len} --tensor-parallel-size {deployment.config.tensor_parallel_size} --dtype {deployment.config.dtype}"
            
            if deployment.config.trust_remote_code:
                cmd += " --trust-remote-code"
            
            if deployment.config.enforce_eager:
                cmd += " --enforce-eager"
            
            if deployment.config.disable_log_stats:
                cmd += " --disable-log-stats"
            
            # Start process with shell=True to allow source command
            process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                shell=True,
                executable="/bin/bash"  # Ensure bash is used
            )
            
            # Update deployment info
            deployment.process_id = process.pid
            deployment.started_at = datetime.now().isoformat()
            self._save_deployments()
            
            # Wait for server to start and check health
            max_wait_time = 300  # 5 minutes
            start_time = time.time()
            
            while time.time() - start_time < max_wait_time:
                if process.poll() is not None:
                    # Process has terminated
                    stdout, stderr = process.communicate()
                    deployment.status = "failed"
                    deployment.error_message = f"Process terminated: {stderr}"
                    self._save_deployments()
                    return
                
                # Check if server is responding
                if self._check_health(deployment):
                    deployment.status = "running"
                    self._save_deployments()
                    return
                
                time.sleep(5)
            
            # Timeout - kill process
            process.terminate()
            deployment.status = "failed"
            deployment.error_message = "Startup timeout"
            self._save_deployments()
            
        except Exception as e:
            deployment.status = "failed"
            deployment.error_message = str(e)
            self._save_deployments()
    
    def stop_deployment(self, deployment_id: str) -> bool:
        """Stop a deployment"""
        deployment = self.deployments.get(deployment_id)
        if not deployment:
            return False
        
        try:
            # Kill process if running
            if deployment.process_id:
                try:
                    process = psutil.Process(deployment.process_id)
                    process.terminate()
                    process.wait(timeout=10)
                except (psutil.NoSuchProcess, psutil.TimeoutExpired):
                    # Force kill if needed
                    try:
                        process.kill()
                    except psutil.NoSuchProcess:
                        pass
            
            # Release port
            self.port_manager.release_port(deployment.port)
            
            # Update status
            deployment.status = "stopped"
            self._save_deployments()
            
            return True
            
        except Exception as e:
            print(f"Error stopping deployment {deployment_id}: {e}")
            return False
    
    def get_deployment(self, deployment_id: str) -> Optional[DeploymentInfo]:
        """Get deployment info"""
        return self.deployments.get(deployment_id)
    
    def list_deployments(self) -> List[DeploymentInfo]:
        """List all deployments"""
        return list(self.deployments.values())
    
    def get_active_deployments(self) -> List[DeploymentInfo]:
        """Get only active (running) deployments"""
        return [d for d in self.deployments.values() if d.status == "running"]
    
    def delete_deployment(self, deployment_id: str) -> bool:
        """Delete a deployment (stop and remove)"""
        if deployment_id not in self.deployments:
            return False
        
        # Stop if running
        self.stop_deployment(deployment_id)
        
        # Remove from deployments
        del self.deployments[deployment_id]
        self._save_deployments()
        
        return True
    
    def _check_health(self, deployment: DeploymentInfo) -> bool:
        """Check if deployment is healthy"""
        try:
            # Use localhost URL for internal health checks (always works regardless of production/dev mode)
            health_check_url = get_health_check_url(deployment)
            response = requests.get(
                f"{health_check_url}/v1/models",
                timeout=5
            )
            is_healthy = response.status_code == 200
            
            if is_healthy:
                deployment.last_health_check = datetime.now().isoformat()
                
                # Get resource usage if process exists
                if deployment.process_id:
                    try:
                        process = psutil.Process(deployment.process_id)
                        deployment.resource_usage = {
                            "cpu_percent": process.cpu_percent(),
                            "memory_mb": process.memory_info().rss / 1024 / 1024,
                            "status": process.status()
                        }
                    except psutil.NoSuchProcess:
                        deployment.resource_usage = None
            
            return is_healthy
            
        except Exception:
            return False
    
    def _start_health_check_thread(self):
        """Start background health check thread"""
        def health_check_loop():
            while self.running:
                try:
                    for deployment in self.deployments.values():
                        if deployment.status == "running":
                            if not self._check_health(deployment):
                                deployment.status = "failed"
                                deployment.error_message = "Health check failed"
                    
                    self._save_deployments()
                    
                except Exception as e:
                    print(f"Health check error: {e}")
                
                time.sleep(self.health_check_interval)
        
        self.health_check_thread = threading.Thread(
            target=health_check_loop,
            daemon=True
        )
        self.health_check_thread.start()
    
    def _load_deployments(self):
        """Load deployments from file"""
        if os.path.exists(self.deployments_file):
            try:
                with open(self.deployments_file, 'r') as f:
                    data = json.load(f)
                
                for deployment_data in data:
                    # Handle config separately to ensure it's a DeploymentConfig instance
                    config_data = deployment_data.pop('config', {})
                    config = DeploymentConfig(**config_data)
                    
                    # Create deployment with the config
                    deployment_data['config'] = config
                    deployment = DeploymentInfo(**deployment_data)
                    
                    # Regenerate endpoint based on current environment configuration
                    # This ensures endpoints are updated when switching between dev/prod
                    deployment.endpoint = get_deployment_endpoint(deployment.deployment_id, deployment.port)
                    
                    self.deployments[deployment.deployment_id] = deployment
                    
                    # Mark as stopped if was running (server restart)
                    if deployment.status in ["starting", "running"]:
                        deployment.status = "stopped"
                        
                    # Reserve port if deployment exists
                    if deployment.status != "stopped":
                        self.port_manager.used_ports.add(deployment.port)
                        
            except Exception as e:
                print(f"Error loading deployments: {e}")
    
    def _save_deployments(self):
        """Save deployments to file"""
        try:
            data = []
            for deployment in self.deployments.values():
                # Make a copy of the deployment to avoid modifying the original
                deployment_dict = asdict(deployment)
                
                # Handle the config separately to ensure it's properly serialized
                if isinstance(deployment.config, DeploymentConfig):
                    deployment_dict['config'] = asdict(deployment.config)
                
                data.append(deployment_dict)
            
            with open(self.deployments_file, 'w') as f:
                json.dump(data, f, indent=2, default=str)
            
            # Update Nginx mapping if in production mode
            self._update_nginx_mapping()
                
        except Exception as e:
            print(f"Error saving deployments: {e}")
    
    def _update_nginx_mapping(self):
        """Update Nginx deployment mapping file"""
        deployment_mode = os.getenv('DEPLOYMENT_MODE', 'development')
        
        if deployment_mode != 'production':
            return
        
        try:
            # Generate Nginx map content
            map_content = []
            map_content.append("# Auto-generated deployment mapping")
            map_content.append("# Maps deployment IDs to backend ports")
            map_content.append(f"# Generated at: {datetime.now().isoformat()}")
            map_content.append("")
            
            active_deployments = 0
            for deployment in self.deployments.values():
                if deployment.status == 'running':
                    map_content.append(f"{deployment.deployment_id} {deployment.port};")
                    active_deployments += 1
            
            # Add default case
            map_content.append("default 0;")
            map_content.append("")
            map_content.append(f"# Total active deployments: {active_deployments}")
            
            # Write to temporary file first
            temp_map_file = "deployment-map.conf"
            with open(temp_map_file, 'w') as f:
                f.write('\n'.join(map_content))
            
            # Try to update the Nginx map file
            nginx_map_file = "/etc/nginx/deployment-map.conf"
            try:
                # Copy to Nginx directory (requires proper permissions)
                import shutil
                shutil.copy2(temp_map_file, nginx_map_file)
                
                # Test and reload Nginx configuration
                subprocess.run(['sudo', 'nginx', '-t'], check=True, capture_output=True)
                subprocess.run(['sudo', 'systemctl', 'reload', 'nginx'], check=True, capture_output=True)
                
                print(f"✅ Updated Nginx mapping with {active_deployments} active deployments")
                
            except PermissionError as e:
                # Permission denied - provide helpful instructions
                print(f"⚠️  Could not automatically update Nginx mapping: Permission denied")
                print(f"📋 To fix this permanently, run: ./scripts/fix-nginx-permissions.sh")
                print(f"🔧 For immediate fix, run: sudo cp {temp_map_file} {nginx_map_file} && sudo nginx -t && sudo systemctl reload nginx")
                
            except subprocess.CalledProcessError as e:
                # Nginx configuration or reload failed
                print(f"❌ Nginx configuration error: {e}")
                print(f"🔍 Check Nginx logs: sudo tail -f /var/log/nginx/error.log")
                print(f"🧪 Test configuration: sudo nginx -t")
                
            except FileNotFoundError as e:
                # Nginx not installed or wrong path
                print(f"❌ Nginx not found: {e}")
                print(f"📦 Install Nginx: sudo apt install nginx")
                print(f"🔧 Or run setup script: ./scripts/setup-aws-nginx.sh")
                
            except Exception as e:
                # Other unexpected errors
                print(f"❌ Unexpected error updating Nginx mapping: {e}")
                print(f"🔧 Manual command: sudo cp {temp_map_file} {nginx_map_file} && sudo nginx -t && sudo systemctl reload nginx")
                
        except Exception as e:
            print(f"Error updating Nginx mapping: {e}")
    
    def get_deployment_stats(self) -> Dict[str, Any]:
        """Get deployment statistics"""
        total = len(self.deployments)
        running = len([d for d in self.deployments.values() if d.status == "running"])
        failed = len([d for d in self.deployments.values() if d.status == "failed"])
        stopped = len([d for d in self.deployments.values() if d.status == "stopped"])
        
        return {
            "total_deployments": total,
            "running_deployments": running,
            "failed_deployments": failed,
            "stopped_deployments": stopped,
            "available_ports": len(range(self.port_manager.start_port, self.port_manager.end_port + 1)) - len(self.port_manager.used_ports)
        }
    
    def cleanup(self):
        """Cleanup resources"""
        self.running = False
        
        # Stop all running deployments
        for deployment_id in list(self.deployments.keys()):
            deployment = self.deployments[deployment_id]
            if deployment.status == "running":
                self.stop_deployment(deployment_id)

# Global deployment manager instance
deployment_manager = VLLMDeploymentManager()

# Cleanup on exit
import atexit
atexit.register(deployment_manager.cleanup)
