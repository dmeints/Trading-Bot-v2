#!/usr/bin/env bash
set -e
PORT="${PORT:-5000}"
if ! (echo > /dev/tcp/127.0.0.1/$PORT) >/dev/null 2>&1; then
  echo "Starting server on $PORT..."
  (npm start >/dev/null 2>&1 &)
  sleep 4
fi
node tests/contract/run.mjs
#!/bin/bash
set -e

echo "🚀 Starting contract test suite..."

# Create reports directory
mkdir -p reports

# Start server in background
echo "📡 Starting server..."
npm run start:logged &
SERVER_PID=$!

# Wait for server to be ready
echo "⏳ Waiting for server to be ready..."
sleep 5

# Health check
echo "🌡️ Health check..."
HEALTH=$(curl -s 0.0.0.0:5000/api/health || echo "FAILED")
echo "Health: $HEALTH"

# Ready check
echo "🩺 Ready check..."
READY=$(curl -s 0.0.0.0:5000/api/ready || echo "FAILED")
echo "Ready: $READY"

# Metrics check
echo "📊 Metrics check..."
METRICS=$(curl -s 0.0.0.0:5000/metrics | head -5 || echo "FAILED")
echo "Metrics sample: $METRICS"

# API endpoints check
echo "🔍 API endpoints check..."
ENDPOINTS=(
  "/api/health"
  "/api/ready"
  "/metrics"
)

for endpoint in "${ENDPOINTS[@]}"; do
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" 0.0.0.0:5000$endpoint || echo "000")
  if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ $endpoint: OK ($HTTP_CODE)"
  else
    echo "❌ $endpoint: FAILED ($HTTP_CODE)"
    echo "Contract test failure for $endpoint" > "reports/contract_failure_$(date +%s).txt"
  fi
done

# Cleanup
echo "🧹 Cleaning up..."
kill $SERVER_PID 2>/dev/null || true
wait $SERVER_PID 2>/dev/null || true

echo "✅ Contract test sweep complete"
