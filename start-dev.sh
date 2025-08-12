#!/bin/bash

# Start the server and client without concurrently
echo "Starting Skippy AI Trading Platform..."

# Start server in background
echo "Starting Express server..."
npx tsx watch server/index.ts &
SERVER_PID=$!

# Wait a moment for server to initialize
sleep 3

# Start Vite client
echo "Starting Vite frontend..."
npx vite

# Clean up background processes on exit
trap "kill $SERVER_PID" EXIT