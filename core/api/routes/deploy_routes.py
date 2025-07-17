import subprocess
from fastapi import APIRouter, HTTPException, Body
from pydantic import BaseModel
from typing import List, Optional, Dict, Any

router = APIRouter()

class DeployModelRequest(BaseModel):
    model_name: str
    model_path: str
    port: Optional[int] = None

class ModelActionRequest(BaseModel):
    model_name: str

@router.get("/deploy-models/running")
def list_running_models():
    """List all running vllm model processes managed by PM2."""
    try:
        result = subprocess.run(
            ["pm2", "jlist"],
            capture_output=True,
            text=True,
            check=True
        )
        processes = []
        import json
        pm2_list = json.loads(result.stdout)
        for proc in pm2_list:
            name = proc.get("name", "")
            if name.startswith("vllm-"):
                processes.append({
                    "name": name,
                    "status": proc.get("pm2_env", {}).get("status", ""),
                    "pid": proc.get("pid"),
                    "port": proc.get("pm2_env", {}).get("PORT"),
                    "pm_id": proc.get("pm_id"),
                })
        return {"status": "success", "processes": processes}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error listing running models: {str(e)}")

@router.post("/deploy-models/start")
def start_model(request: DeployModelRequest = Body(...)):
    """Start serving a model via vllm using PM2."""
    try:
        pm2_name = f"vllm-{request.model_name}"
        port_arg = f"--port {request.port}" if request.port else ""
        cmd = f'pm2 start vllm --name {pm2_name} -- serve "{request.model_path}" {port_arg}'
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
        if result.returncode != 0:
            raise Exception(result.stderr)
        return {"status": "success", "message": f"Started {pm2_name}", "output": result.stdout}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error starting model: {str(e)}")

@router.post("/deploy-models/stop")
def stop_model(request: ModelActionRequest = Body(...)):
    """Stop a running vllm model process via PM2."""
    try:
        pm2_name = f"vllm-{request.model_name}"
        result = subprocess.run(
            ["pm2", "stop", pm2_name],
            capture_output=True,
            text=True
        )
        if result.returncode != 0:
            raise Exception(result.stderr)
        return {"status": "success", "message": f"Stopped {pm2_name}", "output": result.stdout}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error stopping model: {str(e)}")

@router.get("/deploy-models/status/{model_name}")
def get_model_status(model_name: str):
    """Get status of a specific vllm model process."""
    try:
        pm2_name = f"vllm-{model_name}"
        result = subprocess.run(
            ["pm2", "show", pm2_name],
            capture_output=True,
            text=True
        )
        if result.returncode != 0:
            raise Exception(result.stderr)
        return {"status": "success", "output": result.stdout}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting model status: {str(e)}")

@router.get("/deploy-models/logs/{model_name}")
def get_model_logs(model_name: str, lines: int = 100):
    """Get recent logs for a vllm model process."""
    try:
        pm2_name = f"vllm-{model_name}"
        result = subprocess.run(
            ["pm2", "logs", pm2_name, "--lines", str(lines), "--raw"],
            capture_output=True,
            text=True
        )
        if result.returncode != 0:
            raise Exception(result.stderr)
        return {"status": "success", "logs": result.stdout}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting model logs: {str(e)}")
