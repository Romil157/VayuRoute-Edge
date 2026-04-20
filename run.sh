#!/bin/bash
# run.sh  --  VayuRoute Edge runtime launcher for Linux and macOS
# Usage: bash run.sh  (or chmod +x run.sh && ./run.sh)

set -e

source venv/bin/activate

echo "Starting VayuRoute Edge backend on port 8000..."
cd backend
uvicorn main:app --host 127.0.0.1 --port 8000 --reload &
BACKEND_PID=$!
cd ..

echo "Starting VayuRoute Edge frontend..."
cd frontend
npm run dev &
FRONTEND_PID=$!
cd ..

echo "Backend PID: $BACKEND_PID  |  Frontend PID: $FRONTEND_PID"
echo "Press Ctrl+C to stop both servers."

wait $BACKEND_PID $FRONTEND_PID
