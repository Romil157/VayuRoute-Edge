@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "ROOT=%~dp0"
if "%ROOT:~-1%"=="\" set "ROOT=%ROOT:~0,-1%"

set "OPEN_BROWSER=1"
set "CHECK_ONLY=0"

:parse_args
if "%~1"=="" goto args_done
if /I "%~1"=="--no-browser" (
    set "OPEN_BROWSER=0"
    shift
    goto parse_args
)
if /I "%~1"=="--check" (
    set "CHECK_ONLY=1"
    shift
    goto parse_args
)

echo Unknown option: %~1
echo Usage: run.bat [--no-browser] [--check]
exit /b 1

:args_done
echo Starting VayuRoute Edge backend and frontend...
echo.

call :resolve_python
if errorlevel 1 exit /b 1

call :resolve_node_tools
if errorlevel 1 exit /b 1

if not exist "%ROOT%\backend\main.py" (
    echo Missing backend\main.py. Run this script from the repository root.
    exit /b 1
)

if not exist "%ROOT%\frontend\package.json" (
    echo Missing frontend\package.json. Run this script from the repository root.
    exit /b 1
)

if not exist "%ROOT%\frontend\node_modules" (
    echo Frontend dependencies are missing. Run setup.bat first.
    exit /b 1
)

set "BACKEND_DIR=%ROOT%\backend"
set "FRONTEND_DIR=%ROOT%\frontend"
set "BACKEND_CMD=%PYTHON_CMD% -m uvicorn main:app --host 127.0.0.1 --port 8000"
set "FRONTEND_CMD=%NPM_CMD% run dev -- --host 127.0.0.1"

if "%CHECK_ONLY%"=="1" (
    echo Startup checks passed.
    echo Backend command: %BACKEND_CMD%
    echo Frontend command: %FRONTEND_CMD%
    exit /b 0
)

echo Starting backend on http://127.0.0.1:8000 ...
start "VayuRoute Backend" cmd /k "cd /d ""%BACKEND_DIR%"" && call %BACKEND_CMD%"

echo Starting frontend on http://127.0.0.1:5173 ...
start "VayuRoute Frontend" cmd /k "cd /d ""%FRONTEND_DIR%"" && call %FRONTEND_CMD%"

if "%OPEN_BROWSER%"=="1" (
    timeout /t 5 /nobreak >nul
    start "" "http://127.0.0.1:5173"
) else (
    echo Browser launch skipped.
)

echo.
echo Backend:  http://127.0.0.1:8000
echo Frontend: http://127.0.0.1:5173
echo.
echo If frontend does not load immediately, refresh after a few seconds.

exit /b 0

:resolve_python
set "PYTHON_CMD="
call python --version >nul 2>&1
if not errorlevel 1 set "PYTHON_CMD=python"
if defined PYTHON_CMD goto validate_python

call py -3 --version >nul 2>&1
if not errorlevel 1 set "PYTHON_CMD=py -3"
if defined PYTHON_CMD goto validate_python

echo Python not found. Install Python 3.8+ and try again.
exit /b 1

:validate_python
call %PYTHON_CMD% --version >nul 2>&1
if errorlevel 1 (
    echo Python was found, but it could not be started.
    exit /b 1
)
exit /b 0

:resolve_node_tools
call node --version >nul 2>&1
if errorlevel 1 (
    echo Node.js not found. Install Node.js 18+ and try again.
    exit /b 1
)

set "NPM_CMD=npm.cmd"
call %NPM_CMD% --version >nul 2>&1
if errorlevel 1 (
    set "NPM_CMD=npm"
    call %NPM_CMD% --version >nul 2>&1
    if errorlevel 1 (
        echo npm not found. Install Node.js properly and try again.
        exit /b 1
    )
)

exit /b 0
