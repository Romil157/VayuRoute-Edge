#!/bin/bash
set -e

echo "Starting backend..."
cd backend
python3 -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload &
BACKEND_PID=$!
cd ..

echo "Starting frontend..."
cd frontend
npm run dev &
FRONTEND_PID=$!
cd ..

echo "Backend: http://127.0.0.1:8000"
echo "Frontend: http://127.0.0.1:5173"

wait $BACKEND_PID $FRONTEND_PID
