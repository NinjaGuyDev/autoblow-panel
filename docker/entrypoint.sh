#!/bin/sh
set -e

NODE_PID=""
NGINX_PID=""

cleanup() {
  echo "Shutting down..."
  [ -n "$NODE_PID" ] && kill "$NODE_PID" 2>/dev/null
  [ -n "$NGINX_PID" ] && kill "$NGINX_PID" 2>/dev/null
  wait
  exit 0
}

trap cleanup SIGTERM SIGINT

# Start Node.js backend
node /app/server/index.js &
NODE_PID=$!

# Wait for backend to be ready (up to 30s)
echo "Waiting for backend..."
ATTEMPTS=0
MAX_ATTEMPTS=30
while [ $ATTEMPTS -lt $MAX_ATTEMPTS ]; do
  if wget --spider -q http://127.0.0.1:3001/health 2>/dev/null; then
    echo "Backend is ready"
    break
  fi
  ATTEMPTS=$((ATTEMPTS + 1))
  sleep 1
done

if [ $ATTEMPTS -eq $MAX_ATTEMPTS ]; then
  echo "Backend failed to start within ${MAX_ATTEMPTS}s"
  kill "$NODE_PID" 2>/dev/null
  exit 1
fi

# Start nginx
nginx -g 'daemon off;' &
NGINX_PID=$!

echo "All services started"

# Monitor both processes — if either exits, shut down
while kill -0 "$NODE_PID" 2>/dev/null && kill -0 "$NGINX_PID" 2>/dev/null; do
  wait -n "$NODE_PID" "$NGINX_PID" 2>/dev/null && break || break
done

echo "A process exited, shutting down"
cleanup
