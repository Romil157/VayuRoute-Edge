@echo off
setlocal

echo Starting VayuRoute Edge backend and frontend...
start cmd /k "cd /d %~dp0backend && python -m uvicorn main:app --host 127.0.0.1 --port 8000"
start cmd /k "cd /d %~dp0frontend && npm run dev"

echo Backend: http://127.0.0.1:8000
echo Frontend: http://127.0.0.1:5173
