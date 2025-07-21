#!/bin/bash

# Setup script for Nginx with AWS Load Balancer SSL termination
# This script configures Nginx to work behind AWS ALB/CloudFront

set -e

echo "🚀 Setting up Nginx for AWS Load Balancer + LaaP Studio deployment routing..."

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   echo "❌ This script should not be run as root. Please run as a regular user with sudo access."
   exit 1
fi

# Check if Nginx is installed
if ! command -v nginx &> /dev/null; then
    echo "❌ Nginx is not installed. Please install Nginx first:"
    echo "   Ubuntu/Debian: sudo apt update && sudo apt install nginx"
    echo "   CentOS/RHEL: sudo yum install nginx"
    exit 1
fi

# Check if we have sudo access
if ! sudo -n true 2>/dev/null; then
    echo "❌ This script requires sudo access. Please ensure you can run sudo commands."
    exit 1
fi

# Create backup of existing Nginx configuration
NGINX_CONF="/etc/nginx/sites-available/deepcite.in"
NGINX_ENABLED="/etc/nginx/sites-enabled/deepcite.in"

if [ -f "$NGINX_CONF" ]; then
    echo "📋 Backing up existing configuration..."
    sudo cp "$NGINX_CONF" "$NGINX_CONF.backup.$(date +%Y%m%d_%H%M%S)"
fi

# Copy our AWS-optimized configuration
echo "📝 Installing AWS-optimized Nginx configuration..."
sudo cp nginx-aws-config.conf "$NGINX_CONF"

# Enable the site
if [ ! -L "$NGINX_ENABLED" ]; then
    echo "🔗 Enabling site..."
    sudo ln -s "$NGINX_CONF" "$NGINX_ENABLED"
fi

# Disable default Nginx site if it exists
if [ -L "/etc/nginx/sites-enabled/default" ]; then
    echo "🚫 Disabling default Nginx site..."
    sudo unlink /etc/nginx/sites-enabled/default
fi

# Create deployment mapping file directory
echo "📁 Creating deployment mapping directory..."
sudo mkdir -p /etc/nginx

# Create initial empty mapping file
if [ ! -f "/etc/nginx/deployment-map.conf" ]; then
    echo "📄 Creating initial deployment mapping file..."
    sudo tee /etc/nginx/deployment-map.conf > /dev/null << 'EOF'
# Auto-generated deployment mapping
# Maps deployment IDs to backend ports
# This file will be updated automatically by the deployment manager

default 0;

# No active deployments yet
EOF
fi

# Set proper permissions
sudo chown root:root /etc/nginx/deployment-map.conf
sudo chmod 644 /etc/nginx/deployment-map.conf

# Test Nginx configuration
echo "🧪 Testing Nginx configuration..."
if sudo nginx -t; then
    echo "✅ Nginx configuration is valid"
else
    echo "❌ Nginx configuration test failed. Please check the configuration."
    exit 1
fi

# Create log directory for deployment access logs
sudo mkdir -p /var/log/nginx
sudo touch /var/log/nginx/deployment_access.log
sudo chown www-data:www-data /var/log/nginx/deployment_access.log

# Reload Nginx
echo "🔄 Reloading Nginx..."
sudo systemctl reload nginx

echo ""
echo "✅ AWS Load Balancer + Nginx setup completed successfully!"
echo ""
echo "📋 Configuration Summary:"
echo "   • Nginx listens on HTTP port 80 (receives traffic from AWS ALB)"
echo "   • AWS Load Balancer handles SSL termination"
echo "   • Deployment routing: /api/deploy/{deployment-id}/* → localhost:{port}/*"
echo "   • Health checks available at: /health and /healthcheck"
echo ""
echo "📋 Next steps:"
echo "1. Configure your AWS Application Load Balancer:"
echo "   • Target: This EC2 instance on port 80"
echo "   • Health check path: /health"
echo "   • SSL certificate: Use AWS Certificate Manager"
echo ""
echo "2. Set environment variables in your .env file:"
echo "   DEPLOYMENT_MODE=production"
echo "   DEPLOYMENT_PROTOCOL=https"
echo "   DEPLOYMENT_DOMAIN=deepcite.in"
echo ""
echo "3. Ensure your ALB security group allows:"
echo "   • Inbound: HTTPS (443) from 0.0.0.0/0"
echo "   • Outbound: HTTP (80) to EC2 security group"
echo ""
echo "4. Ensure your EC2 security group allows:"
echo "   • Inbound: HTTP (80) from ALB security group"
echo ""
echo "🔧 To manually update deployment mapping:"
echo "   python3 scripts/generate-nginx-map.py"
echo "   sudo cp deployment-map.conf /etc/nginx/deployment-map.conf"
echo "   sudo systemctl reload nginx"
echo ""
echo "📊 To monitor deployment access:"
echo "   sudo tail -f /var/log/nginx/deployment_access.log"
echo ""
echo "🔍 To test the setup:"
echo "   curl -I http://localhost/health  # Local test"
echo "   curl -I https://deepcite.in/health  # Through ALB"
echo ""
echo "🎯 Your deployed models will be accessible at:"
echo "   https://deepcite.in/api/deploy/{deployment-id}/v1/chat/completions"
echo ""
