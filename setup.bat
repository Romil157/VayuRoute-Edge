@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "ROOT=%~dp0"
if "%ROOT:~-1%"=="\" set "ROOT=%ROOT:~0,-1%"

set "FORCE_FRONTEND_INSTALL=0"
set "UPDATE_BROWSERLIST=0"

:parse_args
if "%~1"=="" goto args_done
if /I "%~1"=="--force" (
    set "FORCE_FRONTEND_INSTALL=1"
    shift
    goto parse_args
)
if /I "%~1"=="--update-browserslist" (
    set "UPDATE_BROWSERLIST=1"
    shift
    goto parse_args
)

echo Unknown option: %~1
echo Usage: setup.bat [--force] [--update-browserslist]
exit /b 1

:args_done
echo Setting up VayuRoute Edge...
echo.

set "PYTHON_CMD="
call python --version >nul 2>&1
if not errorlevel 1 set "PYTHON_CMD=python"
if not defined PYTHON_CMD (
    call py -3 --version >nul 2>&1
    if not errorlevel 1 set "PYTHON_CMD=py -3"
)
if not defined PYTHON_CMD (
    echo Python not found. Install Python 3.8+ and try again.
    exit /b 1
)

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

set "NPX_CMD=npx.cmd"
call %NPX_CMD% --version >nul 2>&1
if errorlevel 1 (
    set "NPX_CMD=npx"
    call %NPX_CMD% --version >nul 2>&1
    if errorlevel 1 (
        echo npx not found. Install Node.js properly and try again.
        exit /b 1
    )
)

set "PIP_INSTALL_SCOPE=--user"
if defined VIRTUAL_ENV set "PIP_INSTALL_SCOPE="
if defined CONDA_PREFIX set "PIP_INSTALL_SCOPE="

if not exist "%ROOT%\backend\requirements.txt" (
    echo Missing backend\requirements.txt. Run this script from the repository root.
    exit /b 1
)

if not exist "%ROOT%\frontend\package.json" (
    echo Missing frontend\package.json. Run this script from the repository root.
    exit /b 1
)

echo [1/3] Installing backend dependencies...
call %PYTHON_CMD% -m pip install %PIP_INSTALL_SCOPE% -r "%ROOT%\backend\requirements.txt"
if errorlevel 1 (
    echo Backend dependency installation failed.
    exit /b 1
)

echo [2/3] Installing frontend dependencies...
if exist "%ROOT%\frontend\node_modules" if "%FORCE_FRONTEND_INSTALL%"=="0" (
    echo Frontend dependencies already exist. Use --force to reinstall them.
) else (
    pushd "%ROOT%\frontend" >nul || (
        echo Failed to open the frontend directory.
        exit /b 1
    )

    if exist "package-lock.json" (
        if "%FORCE_FRONTEND_INSTALL%"=="1" (
            call %NPM_CMD% ci --prefer-offline --no-fund --no-audit
        ) else (
            call %NPM_CMD% install --prefer-offline --no-fund --no-audit
        )
    ) else (
        call %NPM_CMD% install --prefer-offline --no-fund --no-audit
    )

    if errorlevel 1 (
        popd >nul
        echo Frontend dependency installation failed.
        exit /b 1
    )

    popd >nul
)

echo [3/3] Browserslist database...
if "%UPDATE_BROWSERLIST%"=="1" (
    pushd "%ROOT%\frontend" >nul || (
        echo Failed to open the frontend directory.
        exit /b 1
    )

    call %NPX_CMD% --yes update-browserslist-db@latest
    if errorlevel 1 (
        popd >nul
        echo Browserslist update failed.
        exit /b 1
    )

    popd >nul
) else (
    echo Skipping browserslist update. Use --update-browserslist to run it.
)

echo.
echo Setup complete.
echo Run run.bat to start the project.
exit /b 0
