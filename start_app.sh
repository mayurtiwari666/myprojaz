#!/bin/bash
# Kill existing processes
echo "Stopping old servers..."
lsof -t -i :8000 | xargs kill -9 2>/dev/null
lsof -t -i :5173 | xargs kill -9 2>/dev/null

# Start Backend (IPV4 Localhost specific to avoid confusion)
echo "Starting Backend on 127.0.0.1:8000..."
source venv/bin/activate
# Using 127.0.0.1 explicitly forces IPv4, which matches what we put in App.jsx
nohup uvicorn backend.main:app --host 127.0.0.1 --port 8000 > backend.log 2>&1 &
BACKEND_PID=$!

# Start Frontend
echo "Starting Frontend..."
cd frontend
# --host 127.0.0.1 forces Vite to serve on IPv4 loopback
nohup npm run dev -- --host 127.0.0.1 > frontend.log 2>&1 &
FRONTEND_PID=$!

echo "Servers Started!"
echo "Backend PID: $BACKEND_PID"
echo "Frontend PID: $FRONTEND_PID"
echo "--------------------------------"
echo "Please open: http://127.0.0.1:5173"
echo "--------------------------------"
