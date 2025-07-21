#!/bin/bash

# Setup script for Nginx deployment routing
# This script helps configure Nginx for LaaP Studio production deployment

set -e

echo "🚀 Setting up Nginx for LaaP Studio deployment routing..."

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

# Copy our configuration
echo "📝 Installing Nginx configuration..."
sudo cp nginx-deployment-config.example "$NGINX_CONF"

# Enable the site
if [ ! -L "$NGINX_ENABLED" ]; then
    echo "🔗 Enabling site..."
    sudo ln -s "$NGINX_CONF" "$NGINX_ENABLED"
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

echo ""
echo "✅ Nginx setup completed successfully!"
echo ""
echo "📋 Next steps:"
echo "1. Update SSL certificate paths in $NGINX_CONF"
echo "2. Adjust backend ports if needed (currently set to localhost:5173 for frontend, localhost:8000 for API)"
echo "3. Set up SSL certificates for deepcite.in"
echo "4. Set DEPLOYMENT_MODE=production in your .env file"
echo "5. Reload Nginx: sudo systemctl reload nginx"
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
echo "   curl -I https://deepcite.in/health"
echo ""
