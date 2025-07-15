#!/bin/sh

# Start the server in the background
npx serve dist &

# Get the process ID of the server
SERVER_PID=$!

# Wait a moment for the server to start
sleep 2

# Print success message with ASCII art
echo "--------------------------------------------------"
echo "██████╗  ██████╗  ██████╗██╗   ██╗███╗   ███╗███████╗███╗   ██╗████████╗██╗     ███╗   ███╗"
echo "██╔══██╗██╔═══██╗██╔════╝██║   ██║████╗ ████║██╔════╝████╗  ██║╚══██╔══╝██║     ████╗ ████║"
echo "██║  ██║██║   ██║██║     ██║   ██║██╔████╔██║█████╗  ██╔██╗ ██║   ██║   ██║     ██╔████╔██║"
echo "██║  ██║██║   ██║██║     ██║   ██║██║╚██╔╝██║██╔══╝  ██║╚██╗██║   ██║   ██║     ██║╚██╔╝██║"
echo "██████╔╝╚██████╔╝╚██████╗╚██████╔╝██║ ╚═╝ ██║███████╗██║ ╚████║   ██║   ███████╗██║ ╚═╝ ██║"
echo "╚═════╝  ╚═════╝  ╚═════╝ ╚═════╝ ╚═╝     ╚═╝╚══════╝╚═╝  ╚═══╝   ╚═╝   ╚══════╝╚═╝     ╚═╝"
echo ""
echo "✅ Server is running and accessible on:"
echo "   http://localhost:5173"
echo ""
echo "ℹ️ Press CTRL+C to stop the server"

# Keep container running
wait $SERVER_PID