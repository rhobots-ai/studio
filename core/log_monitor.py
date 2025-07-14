import json
import threading
import time
from datetime import datetime
from flask import Flask, render_template, jsonify
from transformers import TrainerCallback
import os

# Import IST timezone utilities
from timezone_utils import get_ist_timestamp, get_ist_datetime, convert_to_ist_timestamp

class DetailedLoggingCallback(TrainerCallback):
    """Custom callback for detailed training logging"""
    
    def __init__(self, logging_steps=1, session_id=None):
        self.start_time = None
        self.step_times = []
        self.last_step_time = None
        self.logging_steps = logging_steps
        self.session_id = session_id
        
    def on_train_begin(self, args, state, control, **kwargs):
        """Called at the beginning of training"""
        self.start_time = time.time()
        self.last_step_time = self.start_time
        
        # Log training initialization
        self._write_log({
            "timestamp": get_ist_timestamp(),
            "type": "initialization",
            "level": "INFO",
            "message": "🚀 Initializing training process",
            "step": 0,
            "epoch": 0,
            "details": "Setting up model and tokenizer"
        })
        
        # Log training start
        self._write_log({
            "timestamp": get_ist_timestamp(),
            "type": "training_start",
            "level": "INFO",
            "message": "🎯 Training started",
            "step": 0,
            "epoch": 0,
            "total_steps": state.max_steps,
            "total_epochs": args.num_train_epochs
        })
    
    def on_step_begin(self, args, state, control, **kwargs):
        """Called at the beginning of each training step"""
        self._write_log({
            "timestamp": get_ist_timestamp(),
            "type": "step_begin",
            "level": "DEBUG",
            "message": f"📝 Starting step {state.global_step + 1}",
            "step": state.global_step + 1,
            "epoch": state.epoch,
            "progress_percent": round((state.global_step / state.max_steps) * 100, 2) if state.max_steps > 0 else 0
        })
    
    def on_step_end(self, args, state, control, **kwargs):
        """Called at the end of each training step"""
        current_time = time.time()
        step_time = current_time - self.last_step_time
        self.step_times.append(current_time)
        self.last_step_time = current_time
        
        # Get current metrics
        logs = kwargs.get('logs', {})
        
        # Calculate ETA
        avg_step_time = sum([self.step_times[i] - self.step_times[i-1] for i in range(1, len(self.step_times))]) / max(1, len(self.step_times) - 1) if len(self.step_times) > 1 else step_time
        remaining_steps = state.max_steps - state.global_step
        eta_seconds = avg_step_time * remaining_steps
        eta_minutes = eta_seconds / 60
        
        log_entry = {
            "timestamp": get_ist_timestamp(),
            "type": "training_step",
            "level": "INFO",
            "message": f"✅ Step {state.global_step} completed - Loss: {logs.get('loss', 0):.4f}",
            "step": state.global_step,
            "epoch": state.epoch,
            "step_time": round(step_time, 3),
            "avg_step_time": round(avg_step_time, 3),
            "eta_minutes": round(eta_minutes, 2),
            "learning_rate": logs.get('learning_rate', 0),
            "loss": logs.get('loss', 0),
            "grad_norm": logs.get('grad_norm', 0),
            "progress_percent": round((state.global_step / state.max_steps) * 100, 2) if state.max_steps > 0 else 0,
            "remaining_steps": remaining_steps
        }
        self._write_log(log_entry)
    
    def on_epoch_begin(self, args, state, control, **kwargs):
        """Called at the beginning of each epoch"""
        self._write_log({
            "timestamp": get_ist_timestamp(),
            "type": "epoch_begin",
            "level": "INFO",
            "message": f"🔄 Starting epoch {state.epoch + 1}/{args.num_train_epochs}",
            "step": state.global_step,
            "epoch": state.epoch + 1,
            "total_epochs": args.num_train_epochs
        })
    
    def on_epoch_end(self, args, state, control, **kwargs):
        """Called at the end of each epoch"""
        logs = kwargs.get('logs', {})
        
        log_entry = {
            "timestamp": get_ist_timestamp(),
            "type": "epoch_end",
            "level": "INFO",
            "message": f"🏁 Epoch {state.epoch} completed",
            "step": state.global_step,
            "epoch": state.epoch,
            "train_loss": logs.get('train_loss', 0),
            "eval_loss": logs.get('eval_loss', 0),
            "epoch_progress": f"{state.epoch}/{args.num_train_epochs}"
        }
        self._write_log(log_entry)
    
    def on_save(self, args, state, control, **kwargs):
        """Called when model is saved"""
        self._write_log({
            "timestamp": get_ist_timestamp(),
            "type": "model_save",
            "level": "INFO",
            "message": f"💾 Model checkpoint saved at step {state.global_step}",
            "step": state.global_step,
            "epoch": state.epoch,
            "save_path": args.output_dir
        })
    
    def on_evaluate(self, args, state, control, **kwargs):
        """Called during evaluation"""
        self._write_log({
            "timestamp": get_ist_timestamp(),
            "type": "evaluation",
            "level": "INFO",
            "message": f"📊 Running evaluation at step {state.global_step}",
            "step": state.global_step,
            "epoch": state.epoch
        })
    
    def on_prediction_step(self, args, state, control, **kwargs):
        """Called during prediction steps"""
        if state.global_step % 10 == 0:  # Log every 10 prediction steps to avoid spam
            self._write_log({
                "timestamp": get_ist_timestamp(),
                "type": "prediction",
                "level": "DEBUG",
                "message": f"🔮 Prediction step at {state.global_step}",
                "step": state.global_step,
                "epoch": state.epoch
            })
    
    def on_log(self, args, state, control, logs=None, **kwargs):
        """Called when logging occurs"""
        if logs and state.global_step % self.logging_steps == 0:  # Log detailed metrics based on logging_steps
            self._write_log({
                "timestamp": get_ist_timestamp(),
                "type": "metrics",
                "level": "DEBUG",
                "message": f"📈 Training metrics update - Step {state.global_step}",
                "step": state.global_step,
                "epoch": state.epoch,
                "metrics": logs
            })
    
    def on_train_end(self, args, state, control, **kwargs):
        """Called at the end of training"""
        total_time = time.time() - self.start_time
        self._write_log({
            "timestamp": get_ist_timestamp(),
            "type": "training_complete",
            "level": "INFO",
            "message": f"🎉 Training completed successfully in {total_time/60:.2f} minutes",
            "step": state.global_step,
            "epoch": state.epoch,
            "total_time_minutes": round(total_time/60, 2),
            "total_steps": state.global_step,
            "final_loss": getattr(state, 'log_history', [{}])[-1].get('train_loss', 0) if hasattr(state, 'log_history') and state.log_history else 0
        })
    
    def _write_log(self, log_entry):
        """Write log entry to file"""
        try:
            # Add session_id to log entry if available
            if self.session_id:
                log_entry['session_id'] = self.session_id
                
                # Write to session-specific training_logs.jsonl file
                session_logs_dir = f"training_sessions/{self.session_id}/logs"
                os.makedirs(session_logs_dir, exist_ok=True)
                session_training_log_file = os.path.join(session_logs_dir, "training_logs.jsonl")
                
                with open(session_training_log_file, 'a') as f:
                    f.write(json.dumps(log_entry) + '\n')
            else:
                # Fallback to global log file if no session_id
                with open('training_logs.jsonl', 'a') as f:
                    f.write(json.dumps(log_entry) + '\n')
        except Exception as e:
            print(f"Error writing log: {e}")

def create_dashboard_app():
    """Create Flask app for the dashboard"""
    app = Flask(__name__)
    
    @app.route('/')
    def dashboard():
        """Main dashboard page"""
        return render_template('dashboard.html')
    
    @app.route('/api/logs')
    def get_logs():
        """API endpoint to get training logs"""
        logs = []
        if os.path.exists('training_logs.jsonl'):
            try:
                with open('training_logs.jsonl', 'r') as f:
                    logs = [json.loads(line) for line in f.readlines()]
            except Exception as e:
                return jsonify({"error": str(e)}), 500
        
        return jsonify({"logs": logs})
    
    @app.route('/api/status')
    def get_status():
        """API endpoint to get training status"""
        status = {
            "status": "running",
            "timestamp": get_ist_timestamp(),
            "log_count": 0
        }
        
        if os.path.exists('training_logs.jsonl'):
            try:
                with open('training_logs.jsonl', 'r') as f:
                    lines = f.readlines()
                    status["log_count"] = len(lines)
                    
                    if lines:
                        last_log = json.loads(lines[-1])
                        status["last_update"] = last_log.get("timestamp")
                        status["current_step"] = last_log.get("step", 0)
                        status["current_epoch"] = last_log.get("epoch", 0)
                        
                        if last_log.get("type") == "training_complete":
                            status["status"] = "completed"
            except Exception:
                pass
        
        return jsonify(status)
    
    return app

def start_log_monitoring():
    """Start the log monitoring dashboard server"""
    app = create_dashboard_app()
    
    # Create templates directory and dashboard HTML
    os.makedirs('templates', exist_ok=True)
    
    dashboard_html = '''
<!DOCTYPE html>
<html>
<head>
    <title>Training Dashboard</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .container { max-width: 1200px; margin: 0 auto; }
        .status-card { background: #f5f5f5; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
        .charts-container { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; }
        .chart-container { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .logs-container { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .log-entry { padding: 8px; border-bottom: 1px solid #eee; font-family: monospace; font-size: 12px; }
        .log-info { color: #2196F3; }
        .log-error { color: #f44336; }
        .log-debug { color: #9E9E9E; }
        #status { font-size: 18px; font-weight: bold; }
        .running { color: #4CAF50; }
        .completed { color: #2196F3; }
        .failed { color: #f44336; }
    </style>
</head>
<body>
    <div class="container">
        <h1>Model Training Dashboard</h1>
        
        <div class="status-card">
            <h2>Training Status</h2>
            <div id="status">Loading...</div>
            <div id="progress"></div>
        </div>
        
        <div class="charts-container">
            <div class="chart-container">
                <h3>Training Loss</h3>
                <canvas id="lossChart"></canvas>
            </div>
            <div class="chart-container">
                <h3>Learning Rate</h3>
                <canvas id="lrChart"></canvas>
            </div>
        </div>
        
        <div class="logs-container">
            <h3>Recent Logs</h3>
            <div id="logs" style="height: 300px; overflow-y: auto;"></div>
        </div>
    </div>

    <script>
        let lossChart, lrChart;
        
        function initCharts() {
            const lossCtx = document.getElementById('lossChart').getContext('2d');
            lossChart = new Chart(lossCtx, {
                type: 'line',
                data: {
                    labels: [],
                    datasets: [{
                        label: 'Training Loss',
                        data: [],
                        borderColor: 'rgb(75, 192, 192)',
                        tension: 0.1
                    }]
                },
                options: {
                    responsive: true,
                    scales: {
                        y: {
                            beginAtZero: false
                        }
                    }
                }
            });
            
            const lrCtx = document.getElementById('lrChart').getContext('2d');
            lrChart = new Chart(lrCtx, {
                type: 'line',
                data: {
                    labels: [],
                    datasets: [{
                        label: 'Learning Rate',
                        data: [],
                        borderColor: 'rgb(255, 99, 132)',
                        tension: 0.1
                    }]
                },
                options: {
                    responsive: true,
                    scales: {
                        y: {
                            beginAtZero: true
                        }
                    }
                }
            });
        }
        
        function updateDashboard() {
            fetch('/api/status')
                .then(response => response.json())
                .then(data => {
                    const statusEl = document.getElementById('status');
                    statusEl.textContent = `Status: ${data.status}`;
                    statusEl.className = data.status;
                    
                    const progressEl = document.getElementById('progress');
                    progressEl.innerHTML = `
                        <p>Current Step: ${data.current_step || 0}</p>
                        <p>Current Epoch: ${data.current_epoch || 0}</p>
                        <p>Last Update: ${data.last_update || 'N/A'}</p>
                        <p>Total Logs: ${data.log_count}</p>
                    `;
                });
            
            fetch('/api/logs')
                .then(response => response.json())
                .then(data => {
                    updateCharts(data.logs);
                    updateLogs(data.logs);
                });
        }
        
        function updateCharts(logs) {
            const lossData = [];
            const lrData = [];
            const labels = [];
            
            logs.forEach(log => {
                if (log.type === 'training_step' && log.loss !== undefined) {
                    labels.push(log.step);
                    lossData.push(log.loss);
                    lrData.push(log.learning_rate);
                }
            });
            
            lossChart.data.labels = labels;
            lossChart.data.datasets[0].data = lossData;
            lossChart.update();
            
            lrChart.data.labels = labels;
            lrChart.data.datasets[0].data = lrData;
            lrChart.update();
        }
        
        function updateLogs(logs) {
            const logsEl = document.getElementById('logs');
            const recentLogs = logs.slice(-20).reverse();
            
            logsEl.innerHTML = recentLogs.map(log => `
                <div class="log-entry log-${log.level.toLowerCase()}">
                    [${log.timestamp}] ${log.level}: ${log.message}
                </div>
            `).join('');
        }
        
        // Initialize
        initCharts();
        updateDashboard();
        
        // Update every 2 seconds
        setInterval(updateDashboard, 2000);
    </script>
</body>
</html>
    '''
    
    with open('templates/dashboard.html', 'w') as f:
        f.write(dashboard_html)
    
    # Run Flask app
    app.run(host='0.0.0.0', port=5000, debug=False, use_reloader=False)
