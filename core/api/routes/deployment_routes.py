from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
import json

from deployment_manager import deployment_manager, DeploymentConfig

router = APIRouter(prefix="/api/")

class DeploymentRequest(BaseModel):
    """Request to deploy a model"""
    model_path: str
    config: Optional[Dict[str, Any]] = Field(default_factory=dict)

class DeploymentResponse(BaseModel):
    """Response for deployment operations"""
    deployment_id: str
    status: str
    endpoint: Optional[str] = None
    message: str

class DeploymentListResponse(BaseModel):
    """Response for listing deployments"""
    deployments: List[Dict[str, Any]]
    total: int
    stats: Dict[str, Any]

class DeploymentStatusResponse(BaseModel):
    """Response for deployment status"""
    deployment_id: str
    model_path: str
    status: str
    endpoint: Optional[str] = None
    created_at: str
    started_at: Optional[str] = None
    error_message: Optional[str] = None
    resource_usage: Optional[Dict[str, Any]] = None
    config: Dict[str, Any]

class DeploymentTestRequest(BaseModel):
    """Request to test a deployment"""
    message: str
    max_tokens: Optional[int] = 100
    temperature: Optional[float] = 0.7
    top_p: Optional[float] = 0.9

class DeploymentTestResponse(BaseModel):
    """Response for deployment test"""
    deployment_id: str
    message: str
    response: str
    endpoint: str
    latency_ms: float

@router.post("/deploy", response_model=DeploymentResponse)
async def deploy_model(request: DeploymentRequest, background_tasks: BackgroundTasks):
    """Deploy a model with vLLM"""
    try:
        # Convert config dict to DeploymentConfig
        config_dict = request.config or {}
        config = DeploymentConfig(
            gpu_memory_utilization=config_dict.get("gpu_memory_utilization", 0.8),
            max_model_len=config_dict.get("max_model_len", 4096),
            tensor_parallel_size=config_dict.get("tensor_parallel_size", 1),
            dtype=config_dict.get("dtype", "auto"),
            trust_remote_code=config_dict.get("trust_remote_code", False),
            enforce_eager=config_dict.get("enforce_eager", False),
            disable_log_stats=config_dict.get("disable_log_stats", True)
        )
        
        # Deploy model
        deployment_id = deployment_manager.deploy_model(
            model_path=request.model_path,
            config=config
        )
        
        # Get deployment info
        deployment = deployment_manager.get_deployment(deployment_id)
        
        return DeploymentResponse(
            deployment_id=deployment_id,
            status=deployment.status,
            endpoint=deployment.endpoint,
            message=f"Model deployment started. Check status at /api/deploy/{deployment_id}"
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to deploy model: {str(e)}")

@router.get("/deploy", response_model=DeploymentListResponse)
async def list_deployments():
    """List all deployments"""
    try:
        deployments = deployment_manager.list_deployments()
        
        # Convert to dict for JSON serialization
        deployment_list = []
        for deployment in deployments:
            deployment_dict = {
                "deployment_id": deployment.deployment_id,
                "model_path": deployment.model_path,
                "status": deployment.status,
                "endpoint": deployment.endpoint,
                "created_at": deployment.created_at,
                "started_at": deployment.started_at,
                "error_message": deployment.error_message,
                "resource_usage": deployment.resource_usage,
                "config": {
                    "gpu_memory_utilization": deployment.config.gpu_memory_utilization,
                    "max_model_len": deployment.config.max_model_len,
                    "tensor_parallel_size": deployment.config.tensor_parallel_size,
                    "dtype": deployment.config.dtype,
                    "trust_remote_code": deployment.config.trust_remote_code,
                    "enforce_eager": deployment.config.enforce_eager,
                    "disable_log_stats": deployment.config.disable_log_stats
                }
            }
            deployment_list.append(deployment_dict)
        
        # Get stats
        stats = deployment_manager.get_deployment_stats()
        
        return DeploymentListResponse(
            deployments=deployment_list,
            total=len(deployment_list),
            stats=stats
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list deployments: {str(e)}")

@router.get("/deploy/{deployment_id}", response_model=DeploymentStatusResponse)
async def get_deployment_status(deployment_id: str):
    """Get status of a specific deployment"""
    deployment = deployment_manager.get_deployment(deployment_id)
    if not deployment:
        raise HTTPException(status_code=404, detail="Deployment not found")
    
    return DeploymentStatusResponse(
        deployment_id=deployment.deployment_id,
        model_path=deployment.model_path,
        status=deployment.status,
        endpoint=deployment.endpoint,
        created_at=deployment.created_at,
        started_at=deployment.started_at,
        error_message=deployment.error_message,
        resource_usage=deployment.resource_usage,
        config={
            "gpu_memory_utilization": deployment.config.gpu_memory_utilization,
            "max_model_len": deployment.config.max_model_len,
            "tensor_parallel_size": deployment.config.tensor_parallel_size,
            "dtype": deployment.config.dtype,
            "trust_remote_code": deployment.config.trust_remote_code,
            "enforce_eager": deployment.config.enforce_eager,
            "disable_log_stats": deployment.config.disable_log_stats
        }
    )

@router.delete("/deploy/{deployment_id}", response_model=DeploymentResponse)
async def stop_deployment(deployment_id: str):
    """Stop a deployment"""
    deployment = deployment_manager.get_deployment(deployment_id)
    if not deployment:
        raise HTTPException(status_code=404, detail="Deployment not found")
    
    success = deployment_manager.stop_deployment(deployment_id)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to stop deployment")
    
    return DeploymentResponse(
        deployment_id=deployment_id,
        status="stopped",
        message="Deployment stopped successfully"
    )

@router.delete("/deploy/{deployment_id}/delete", response_model=DeploymentResponse)
async def delete_deployment(deployment_id: str):
    """Delete a deployment (stop and remove)"""
    deployment = deployment_manager.get_deployment(deployment_id)
    if not deployment:
        raise HTTPException(status_code=404, detail="Deployment not found")
    
    success = deployment_manager.delete_deployment(deployment_id)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to delete deployment")
    
    return DeploymentResponse(
        deployment_id=deployment_id,
        status="deleted",
        message="Deployment deleted successfully"
    )

@router.post("/deploy/{deployment_id}/test", response_model=DeploymentTestResponse)
async def test_deployment(deployment_id: str, request: DeploymentTestRequest):
    """Test a deployment by sending a message"""
    import time
    import requests
    
    deployment = deployment_manager.get_deployment(deployment_id)
    if not deployment:
        raise HTTPException(status_code=404, detail="Deployment not found")
    
    if deployment.status != "running":
        raise HTTPException(status_code=400, detail=f"Deployment is not running (status: {deployment.status})")
    
    try:
        # Prepare request to OpenAI-compatible endpoint
        payload = {
            "model": deployment.model_path,
            "messages": [{"role": "user", "content": request.message}],
            "max_tokens": request.max_tokens,
            "temperature": request.temperature,
            "top_p": request.top_p
        }
        
        # Measure latency
        start_time = time.time()
        
        # Send request to vLLM server
        response = requests.post(
            f"{deployment.endpoint}/v1/chat/completions",
            json=payload,
            timeout=30
        )
        
        # Calculate latency
        latency_ms = (time.time() - start_time) * 1000
        
        if response.status_code != 200:
            raise HTTPException(
                status_code=response.status_code,
                detail=f"Error from vLLM server: {response.text}"
            )
        
        # Parse response
        response_data = response.json()
        content = response_data.get("choices", [{}])[0].get("message", {}).get("content", "")
        
        return DeploymentTestResponse(
            deployment_id=deployment_id,
            message=request.message,
            response=content,
            endpoint=deployment.endpoint,
            latency_ms=latency_ms
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to test deployment: {str(e)}")

@router.get("/deploy/{deployment_id}/curl")
async def get_curl_example(deployment_id: str):
    """Get curl example for using the deployment"""
    deployment = deployment_manager.get_deployment(deployment_id)
    if not deployment:
        raise HTTPException(status_code=404, detail="Deployment not found")
    
    if deployment.status != "running":
        raise HTTPException(status_code=400, detail=f"Deployment is not running (status: {deployment.status})")
    
    # Generate curl examples
    chat_example = f"""
# Chat completions example
curl -X POST \\
  {deployment.endpoint}/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -d '{{
    "model": "{deployment.model_path}",
    "messages": [
      {{
        "role": "user",
        "content": "Hello, how are you?"
      }}
    ],
    "max_tokens": 100,
    "temperature": 0.7
  }}'
"""
    
    completions_example = f"""
# Completions example
curl -X POST \\
  {deployment.endpoint}/v1/completions \\
  -H "Content-Type: application/json" \\
  -d '{{
    "model": "{deployment.model_path}",
    "prompt": "Hello, how are you?",
    "max_tokens": 100,
    "temperature": 0.7
  }}'
"""
    
    python_example = f"""
# Python example using OpenAI client
import openai

client = openai.OpenAI(
    base_url="{deployment.endpoint}/v1",
    api_key="not-needed"  # API key is not needed for local deployments
)

response = client.chat.completions.create(
    model="{deployment.model_path}",
    messages=[
        {{"role": "user", "content": "Hello, how are you?"}}
    ],
    max_tokens=100,
    temperature=0.7
)

print(response.choices[0].message.content)
"""
    
    return {
        "deployment_id": deployment_id,
        "endpoint": deployment.endpoint,
        "examples": {
            "curl_chat": chat_example.strip(),
            "curl_completions": completions_example.strip(),
            "python": python_example.strip()
        }
    }
