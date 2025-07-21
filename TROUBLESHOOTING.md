# Troubleshooting Guide for LaaP Studio Deployment

## Current Issue: Deployment Still Shows localhost URL

### Problem
Your deployment is showing `http://localhost:8002` instead of the production URL `https://deepcite.in/api/deploy/{deployment-id}`.

### Root Cause
The deployment was created before switching to production mode, so it still has the development endpoint URL stored.

## Quick Fix Options

### Option 1: Restart Application (Recommended)
```bash
# Stop your current application
# Then restart it - the deployment manager will automatically update endpoints

# The _load_deployments() method will regenerate endpoints based on current environment
```

### Option 2: Manual Nginx Update (Immediate)
```bash
# Run the command shown in your logs:
sudo cp deployment-map.conf /etc/nginx/deployment-map.conf && sudo nginx -t && sudo systemctl reload nginx
```

### Option 3: Redeploy the Model
1. Stop the current deployment in the UI
2. Deploy the model again
3. New deployment will use production URLs

## Fix Automatic Nginx Updates

### Current Permission Issue
```
⚠️  Could not automatically update Nginx mapping: Permission denied
📋 To fix this permanently, run: ./scripts/fix-nginx-permissions.sh
```

### Run the Permission Fix Script
```bash
# Make script executable
chmod +x scripts/fix-nginx-permissions.sh

# Run the script
./scripts/fix-nginx-permissions.sh

# Log out and log back in for group changes to take effect
```

## Verification Steps

### 1. Check Environment Configuration
```bash
# Verify production mode is set
cat core/.env | grep DEPLOYMENT_MODE
# Should show: DEPLOYMENT_MODE=production
```

### 2. Check Deployment Mapping
```bash
# Check if mapping file exists and has content
cat /etc/nginx/deployment-map.conf

# Should show something like:
# abc123-def4-5678-9012-345678901234 8002;
# default 0;
```

### 3. Test Nginx Configuration
```bash
# Test Nginx config
sudo nginx -t

# Check Nginx status
sudo systemctl status nginx

# Reload Nginx
sudo systemctl reload nginx
```

### 4. Verify Endpoint Generation
```bash
# Test endpoint generation in Python
python3 -c "
import os
from dotenv import load_dotenv
load_dotenv('core/.env')
from core.deployment_manager import get_deployment_endpoint
print('Mode:', os.getenv('DEPLOYMENT_MODE'))
print('Domain:', os.getenv('DEPLOYMENT_DOMAIN'))
print('Protocol:', os.getenv('DEPLOYMENT_PROTOCOL'))
print('Generated URL:', get_deployment_endpoint('test-123', 8002))
"
```

## Expected Results After Fix

### Development Mode
- Endpoint: `http://localhost:8002`
- API Examples: `http://localhost:8002/v1/chat/completions`

### Production Mode
- Endpoint: `https://deepcite.in/api/deploy/abc123-def4-5678-9012-345678901234`
- API Examples: `https://deepcite.in/api/deploy/abc123-def4-5678-9012-345678901234/v1/chat/completions`

## Common Issues and Solutions

### 1. Environment Variables Not Loading
**Problem**: `.env` file not being read
**Solution**: 
- Ensure `.env` file is in the `core/` directory
- Restart the application
- Check file permissions: `ls -la core/.env`

### 2. Nginx Permission Denied
**Problem**: Cannot write to `/etc/nginx/deployment-map.conf`
**Solution**: Run `./scripts/fix-nginx-permissions.sh`

### 3. Nginx Configuration Invalid
**Problem**: `nginx -t` fails
**Solution**: 
- Check Nginx error logs: `sudo tail -f /var/log/nginx/error.log`
- Verify mapping file syntax: `cat /etc/nginx/deployment-map.conf`

### 4. Deployment Not Updating
**Problem**: UI still shows old endpoint
**Solution**:
- Hard refresh browser (Ctrl+F5)
- Check browser developer tools for cached responses
- Restart application to regenerate endpoints

## Debug Commands

### Check Current Configuration
```bash
# Environment variables
env | grep DEPLOYMENT

# Deployment file content
cat deployments.json | jq '.[].endpoint'

# Nginx mapping
cat /etc/nginx/deployment-map.conf

# Process status
ps aux | grep python
```

### Monitor Logs
```bash
# Application logs (adjust path as needed)
tail -f your-app.log

# Nginx access logs
sudo tail -f /var/log/nginx/access.log

# Nginx error logs
sudo tail -f /var/log/nginx/error.log

# Deployment access logs
sudo tail -f /var/log/nginx/deployment_access.log
```

## Step-by-Step Resolution

### For Your Current Issue:

1. **Verify environment is set correctly**:
   ```bash
   cat core/.env | grep DEPLOYMENT_MODE
   ```

2. **Restart your application** to regenerate endpoints

3. **Fix Nginx permissions** for future automatic updates:
   ```bash
   chmod +x scripts/fix-nginx-permissions.sh
   ./scripts/fix-nginx-permissions.sh
   ```

4. **Manually update Nginx** for immediate fix:
   ```bash
   sudo cp deployment-map.conf /etc/nginx/deployment-map.conf && sudo nginx -t && sudo systemctl reload nginx
   ```

5. **Verify the fix** by checking the deployment in your UI

After these steps, your deployment should show the correct production URL: `https://deepcite.in/api/deploy/{deployment-id}`

## Need More Help?

If issues persist:
1. Check all the debug commands above
2. Verify AWS Load Balancer is configured correctly
3. Ensure DNS points to your ALB
4. Test health endpoints: `curl -I https://deepcite.in/health`
