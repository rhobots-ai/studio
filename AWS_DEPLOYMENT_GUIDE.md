# AWS Deployment Guide for LaaP Studio

This guide explains how to deploy LaaP Studio with domain-based model deployments on AWS using Application Load Balancer for SSL termination.

## Architecture Overview

```
Internet (HTTPS requests)
    ↓
AWS Application Load Balancer (SSL termination)
    ↓ (HTTP forwarding)
EC2 Instance (Your server)
    ↓
Nginx (HTTP routing to model deployments)
    ↓
vLLM Model Servers (localhost:8001, 8002, etc.)
```

## Prerequisites

- AWS EC2 instance running Ubuntu/Debian
- Domain `deepcite.in` pointing to your AWS Load Balancer
- AWS Application Load Balancer configured
- SSL certificate in AWS Certificate Manager

## Step 1: Server Setup

### 1.1 Install Dependencies
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Nginx
sudo apt install nginx -y

# Install Python dependencies (if not already installed)
sudo apt install python3 python3-pip -y
```

### 1.2 Clone and Setup Project
```bash
# Clone your project (adjust as needed)
git clone <your-repo-url>
cd laap

# Install Python dependencies
pip3 install -r core/requirements.txt
```

## Step 2: Configure Environment

### 2.1 Copy Production Environment
```bash
# Copy the production environment template
cp .env.production .env

# Edit with your specific values
nano .env
```

### 2.2 Environment Variables
```bash
DEPLOYMENT_MODE=production
DEPLOYMENT_HOST=deepcite.in
DEPLOYMENT_PROTOCOL=https
DEPLOYMENT_BASE_URL=
DEPLOYMENT_DOMAIN=deepcite.in
NODE_ENV=production
VITE_API_BASE_URL=https://deepcite.in
HF_TOKEN=your_huggingface_token_here
```

## Step 3: Configure Nginx

### 3.1 Run AWS Setup Script
```bash
# Make script executable (on your server, not locally)
chmod +x scripts/setup-aws-nginx.sh

# Run the setup script
./scripts/setup-aws-nginx.sh
```

This script will:
- Install AWS-optimized Nginx configuration
- Create deployment mapping files
- Set up logging
- Test and reload Nginx

### 3.2 Verify Nginx Configuration
```bash
# Test configuration
sudo nginx -t

# Check if Nginx is running
sudo systemctl status nginx

# Test local health check
curl -I http://localhost/health
```

## Step 4: AWS Load Balancer Configuration

### 4.1 Create Application Load Balancer

1. **Go to AWS EC2 Console → Load Balancers**
2. **Create Application Load Balancer**
3. **Configure:**
   - Name: `deepcite-alb`
   - Scheme: Internet-facing
   - IP address type: IPv4
   - VPC: Your VPC
   - Subnets: Select at least 2 public subnets

### 4.2 Configure Security Groups

**ALB Security Group:**
```
Inbound Rules:
- Type: HTTPS, Port: 443, Source: 0.0.0.0/0
- Type: HTTP, Port: 80, Source: 0.0.0.0/0 (for redirect)

Outbound Rules:
- Type: HTTP, Port: 80, Destination: EC2 Security Group
```

**EC2 Security Group:**
```
Inbound Rules:
- Type: HTTP, Port: 80, Source: ALB Security Group
- Type: SSH, Port: 22, Source: Your IP (for management)

Outbound Rules:
- Type: All Traffic, Destination: 0.0.0.0/0
```

### 4.3 Configure Target Group

1. **Create Target Group:**
   - Target type: Instances
   - Protocol: HTTP
   - Port: 80
   - VPC: Your VPC

2. **Health Check Settings:**
   - Protocol: HTTP
   - Path: `/health`
   - Port: 80
   - Healthy threshold: 2
   - Unhealthy threshold: 2
   - Timeout: 5 seconds
   - Interval: 30 seconds

3. **Register Targets:**
   - Select your EC2 instance
   - Port: 80

### 4.4 Configure Listeners

**HTTPS Listener (Port 443):**
- Protocol: HTTPS
- Port: 443
- SSL Certificate: Select from AWS Certificate Manager
- Default Action: Forward to target group

**HTTP Listener (Port 80) - Optional Redirect:**
- Protocol: HTTP
- Port: 80
- Default Action: Redirect to HTTPS

### 4.5 Configure DNS

Update your DNS to point `deepcite.in` to the ALB DNS name:
```
Type: CNAME
Name: deepcite.in
Value: your-alb-dns-name.region.elb.amazonaws.com
```

## Step 5: SSL Certificate Setup

### 5.1 Request Certificate in AWS Certificate Manager

1. **Go to AWS Certificate Manager**
2. **Request a certificate**
3. **Add domain names:**
   - `deepcite.in`
   - `www.deepcite.in`
4. **Validation method:** DNS validation
5. **Add CNAME records** to your DNS provider
6. **Wait for validation** (usually takes a few minutes)

### 5.2 Attach Certificate to Load Balancer

1. **Go to your ALB → Listeners**
2. **Edit HTTPS:443 listener**
3. **Select your validated certificate**
4. **Save changes**

## Step 6: Start Your Application

### 6.1 Start Backend Services
```bash
# Start your FastAPI backend (adjust as needed)
cd core
python main.py &

# Or use a process manager like PM2
npm install -g pm2
pm2 start "python main.py" --name "laap-backend"
```

### 6.2 Start Frontend (if serving from same server)
```bash
# Build and serve frontend (adjust as needed)
cd web
npm run build
# Serve built files or use development server
```

## Step 7: Test the Setup

### 7.1 Health Checks
```bash
# Test local health check
curl -I http://localhost/health

# Test through load balancer
curl -I https://deepcite.in/health
```

### 7.2 Deploy a Test Model
1. **Access your application:** `https://deepcite.in`
2. **Deploy a model** through the UI
3. **Check deployment mapping:**
   ```bash
   cat /etc/nginx/deployment-map.conf
   ```
4. **Test model endpoint:**
   ```bash
   curl -X POST https://deepcite.in/api/deploy/{deployment-id}/v1/chat/completions \
     -H "Content-Type: application/json" \
     -d '{"model": "your-model", "messages": [{"role": "user", "content": "Hello!"}]}'
   ```

## Step 8: Monitoring and Maintenance

### 8.1 Log Monitoring
```bash
# Monitor Nginx access logs
sudo tail -f /var/log/nginx/access.log

# Monitor deployment-specific logs
sudo tail -f /var/log/nginx/deployment_access.log

# Monitor application logs
tail -f your-app-logs.log
```

### 8.2 Deployment Management
```bash
# Check active deployments
python3 scripts/generate-nginx-map.py

# Manually update Nginx mapping if needed
sudo cp deployment-map.conf /etc/nginx/deployment-map.conf
sudo systemctl reload nginx
```

### 8.3 SSL Certificate Renewal
AWS Certificate Manager automatically renews certificates, but monitor:
- Certificate expiration dates in ACM console
- ALB health checks
- SSL certificate warnings

## Troubleshooting

### Common Issues

**1. 502 Bad Gateway**
- Check if your backend is running: `curl http://localhost:8000`
- Check Nginx error logs: `sudo tail -f /var/log/nginx/error.log`
- Verify target group health in AWS console

**2. SSL Certificate Issues**
- Verify certificate is validated in ACM
- Check ALB listener configuration
- Ensure DNS points to ALB

**3. Deployment Routing Not Working**
- Check deployment mapping: `cat /etc/nginx/deployment-map.conf`
- Verify model server is running: `curl http://localhost:8001/v1/models`
- Check deployment logs

**4. Health Check Failures**
- Test health endpoint: `curl http://localhost/health`
- Check EC2 security group allows port 80 from ALB
- Verify target group configuration

### Useful Commands

```bash
# Check Nginx status
sudo systemctl status nginx

# Reload Nginx configuration
sudo systemctl reload nginx

# Test Nginx configuration
sudo nginx -t

# Check ALB target health
aws elbv2 describe-target-health --target-group-arn your-target-group-arn

# Monitor real-time logs
sudo tail -f /var/log/nginx/access.log /var/log/nginx/error.log
```

## Security Best Practices

1. **Keep systems updated**
2. **Use least-privilege security groups**
3. **Enable AWS CloudTrail for audit logging**
4. **Monitor access logs regularly**
5. **Use AWS WAF for additional protection**
6. **Implement rate limiting in Nginx if needed**

## Scaling Considerations

For high-traffic deployments:
1. **Use multiple EC2 instances** behind the ALB
2. **Implement auto-scaling groups**
3. **Use RDS for shared database** (if applicable)
4. **Consider using EFS for shared storage**
5. **Implement proper load balancing** for model deployments

Your LaaP Studio deployment should now be fully operational at `https://deepcite.in` with automatic model deployment routing!
