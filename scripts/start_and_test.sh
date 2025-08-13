#!/usr/bin/env bash
set -e
PORT="${PORT:-5000}"
if ! (echo > /dev/tcp/127.0.0.1/$PORT) >/dev/null 2>&1; then
  echo "Starting server on $PORT..."
  (npm start >/dev/null 2>&1 &)
  sleep 4
fi
node tests/contract/run.mjs
