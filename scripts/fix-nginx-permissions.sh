#!/bin/bash

# Fix Nginx permissions for automatic deployment mapping updates
# This script sets up proper permissions so the application can update Nginx automatically

set -e

echo "🔧 Setting up Nginx permissions for automatic deployment updates..."

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   echo "❌ This script should not be run as root. Please run as a regular user with sudo access."
   exit 1
fi

# Check if we have sudo access
if ! sudo -n true 2>/dev/null; then
    echo "❌ This script requires sudo access. Please ensure you can run sudo commands."
    exit 1
fi

# Get current user
CURRENT_USER=$(whoami)

echo "👤 Setting up permissions for user: $CURRENT_USER"

# Create nginx-deploy group if it doesn't exist
if ! getent group nginx-deploy > /dev/null 2>&1; then
    echo "📝 Creating nginx-deploy group..."
    sudo groupadd nginx-deploy
else
    echo "✅ nginx-deploy group already exists"
fi

# Add current user to nginx-deploy group
echo "👥 Adding $CURRENT_USER to nginx-deploy group..."
sudo usermod -a -G nginx-deploy $CURRENT_USER

# Create the deployment mapping file if it doesn't exist
if [ ! -f "/etc/nginx/deployment-map.conf" ]; then
    echo "📄 Creating initial deployment mapping file..."
    sudo tee /etc/nginx/deployment-map.conf > /dev/null << 'EOF'
# Auto-generated deployment mapping
# Maps deployment IDs to backend ports
default 0;
EOF
fi

# Set proper ownership and permissions
echo "🔐 Setting up file permissions..."
sudo chown root:nginx-deploy /etc/nginx/deployment-map.conf
sudo chmod 664 /etc/nginx/deployment-map.conf

# Create sudoers rule for nginx operations
SUDOERS_FILE="/etc/sudoers.d/nginx-deploy"
echo "📋 Creating sudoers rule for Nginx operations..."

sudo tee "$SUDOERS_FILE" > /dev/null << EOF
# Allow nginx-deploy group to reload nginx without password
%nginx-deploy ALL=(ALL) NOPASSWD: /usr/sbin/nginx -t
%nginx-deploy ALL=(ALL) NOPASSWD: /bin/systemctl reload nginx
%nginx-deploy ALL=(ALL) NOPASSWD: /usr/bin/systemctl reload nginx
EOF

# Set proper permissions on sudoers file
sudo chmod 440 "$SUDOERS_FILE"

# Test the sudoers file
echo "🧪 Testing sudoers configuration..."
if sudo visudo -c -f "$SUDOERS_FILE"; then
    echo "✅ Sudoers configuration is valid"
else
    echo "❌ Sudoers configuration is invalid. Removing..."
    sudo rm -f "$SUDOERS_FILE"
    exit 1
fi

echo ""
echo "✅ Nginx permissions setup completed successfully!"
echo ""
echo "📋 What was configured:"
echo "   • Created nginx-deploy group"
echo "   • Added $CURRENT_USER to nginx-deploy group"
echo "   • Set proper permissions on /etc/nginx/deployment-map.conf"
echo "   • Created sudoers rule for passwordless nginx operations"
echo ""
echo "⚠️  IMPORTANT: You need to log out and log back in (or restart your session)"
echo "   for the group membership to take effect."
echo ""
echo "🔍 To verify the setup:"
echo "   1. Log out and log back in"
echo "   2. Check group membership: groups"
echo "   3. Test nginx reload: sudo nginx -t"
echo "   4. Deploy a model to test automatic updates"
echo ""
echo "🎯 After this setup, your deployments will automatically update Nginx"
echo "   without requiring manual intervention!"
echo ""
