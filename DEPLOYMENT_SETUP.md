# Deployment Setup Guide

This guide explains how to configure LaaP Studio for production deployment with domain-based endpoints using `deepcite.in`.

## Overview

The system supports two deployment modes:
- **Development**: Direct port access (`http://localhost:8001`, `http://localhost:8002`, etc.)
- **Production**: Path-based routing (`https://deepcite.in/api/deploy/abc123`, `https://deepcite.in/api/deploy/def456`, etc.)

## Environment Configuration

### Development Mode (Default)
Create a `.env` file in the root directory:

```bash
# Development configuration
DEPLOYMENT_MODE=development
DEPLOYMENT_HOST=localhost
DEPLOYMENT_PROTOCOL=http
```

This will generate endpoints like:
- `http://localhost:8001`
- `http://localhost:8002`
- `http://localhost:8003`

### Production Mode
For production deployment on `deepcite.in`:

```bash
# Production configuration
DEPLOYMENT_MODE=production
DEPLOYMENT_PROTOCOL=https
DEPLOYMENT_DOMAIN=deepcite.in
```

This will generate endpoints like:
- `https://deepcite.in/api/deploy/abc123-def4-5678-9012-345678901234`
- `https://deepcite.in/api/deploy/def456-789a-bcde-f012-3456789abcde`

### Custom Base URL (Optional)
If you want to use a custom base URL structure:

```bash
DEPLOYMENT_MODE=production
DEPLOYMENT_BASE_URL=https://api.deepcite.in/models
```

This will generate endpoints like:
- `https://api.deepcite.in/models/abc123-def4-5678-9012-345678901234`

## Infrastructure Setup

### 1. Reverse Proxy Configuration

You'll need to set up a reverse proxy (Nginx recommended) to route requests from your domain to the correct backend ports.

See `nginx-deployment-config.example` for a complete Nginx configuration example.

### 2. SSL/TLS Setup

For production, ensure you have:
- Valid SSL certificate for `deepcite.in`
- HTTPS redirect from HTTP
- Proper security headers

### 3. Firewall Configuration

- **Development**: Ports 8001-8100 should be accessible locally
- **Production**: Only port 80/443 should be publicly accessible
- Backend ports (8001-8100) should only be accessible from localhost

## Deployment Workflow

### Development
1. Set `DEPLOYMENT_MODE=development` in `.env`
2. Deploy models normally through the UI
3. Access models directly via `http://localhost:PORT`

### Production
1. Set `DEPLOYMENT_MODE=production` in `.env`
2. Configure Nginx with the provided example
3. Deploy models through the UI
4. Access models via `https://deepcite.in/api/deploy/DEPLOYMENT_ID`

## URL Structure

### Development URLs
```
http://localhost:8001/v1/chat/completions
http://localhost:8002/v1/chat/completions
```

### Production URLs
```
https://deepcite.in/api/deploy/abc123/v1/chat/completions
https://deepcite.in/api/deploy/def456/v1/chat/completions
```

## API Usage Examples

### Python (OpenAI Client)

**Development:**
```python
import openai

client = openai.OpenAI(
    base_url="http://localhost:8001/v1",
    api_key="not-needed"
)
```

**Production:**
```python
import openai

client = openai.OpenAI(
    base_url="https://deepcite.in/api/deploy/abc123/v1",
    api_key="your-api-key"  # if authentication is implemented
)
```

### cURL

**Development:**
```bash
curl -X POST http://localhost:8001/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model": "your-model", "messages": [{"role": "user", "content": "Hello!"}]}'
```

**Production:**
```bash
curl -X POST https://deepcite.in/api/deploy/abc123/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model": "your-model", "messages": [{"role": "user", "content": "Hello!"}]}'
```

## Implementation Details

### Backend Changes
- `deployment_manager.py` now supports environment-based endpoint generation
- Health checks always use localhost URLs for internal monitoring
- Existing deployments automatically get updated endpoints when environment changes

### Frontend Changes
- API examples in the UI automatically show the correct URLs based on the deployment endpoint
- Copy endpoint functionality works with both development and production URLs

### Nginx Routing
The Nginx configuration extracts the deployment ID from the URL path and routes to the correct backend port. This requires:

1. **Deployment ID to Port Mapping**: A mechanism to map deployment IDs to their backend ports
2. **Dynamic Configuration**: Updates when new deployments are created or removed
3. **Health Checks**: Proper health check routing for monitoring

## Security Considerations

### Production Security
- Use HTTPS only in production
- Implement proper authentication/authorization
- Rate limiting on the reverse proxy level
- Monitor and log all deployment access

### Network Security
- Backend ports should not be directly accessible from the internet
- Use firewall rules to restrict access
- Consider VPN access for administrative tasks

## Monitoring and Maintenance

### Health Checks
- Internal health checks use localhost URLs
- External monitoring should use the public domain URLs
- Set up alerts for deployment failures

### Log Management
- Nginx access logs for public endpoint usage
- Application logs for deployment management
- Separate logs for each deployment process

## Troubleshooting

### Common Issues

1. **Endpoints not updating**: Restart the application after changing environment variables
2. **Health checks failing**: Ensure localhost access is working for internal checks
3. **Nginx routing issues**: Check the deployment ID regex pattern and port mapping
4. **SSL certificate issues**: Verify certificate covers the domain and any subdomains

### Debug Commands

Check current deployment mode:
```bash
python -c "import os; from dotenv import load_dotenv; load_dotenv(); print(f'Mode: {os.getenv(\"DEPLOYMENT_MODE\", \"development\")}')"
```

Test endpoint generation:
```bash
python -c "from core.deployment_manager import get_deployment_endpoint; print(get_deployment_endpoint('test-123', 8001))"
```

## Migration Guide

### From Development to Production

1. **Backup current deployments**: Save `deployments.json`
2. **Update environment**: Change `.env` to production mode
3. **Configure Nginx**: Set up reverse proxy with the provided configuration
4. **Restart application**: The system will automatically update all endpoint URLs
5. **Test deployments**: Verify all deployments are accessible via the new URLs
6. **Update client applications**: Change any hardcoded URLs to use the new domain-based endpoints

The system is designed to handle this transition seamlessly, with automatic endpoint regeneration when the environment configuration changes.
