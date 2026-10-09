@echo off
setlocal
cd /d "%~dp0"
title Knowledge Arena Dev Server

echo ========================================================
echo   Knowledge Arena - Local Dev Server Launcher
echo ========================================================
echo.

:: 1. Verify Node.js existence
where node >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Node.js is not found in PATH!
    echo Please download and install Node.js from https://nodejs.org/
    echo.
    pause
    exit /b 1
)

:: 2. Verify script existence
if not exist "scripts\dev-server.mjs" (
    echo [ERROR] Cannot locate scripts\dev-server.mjs!
    echo Current directory: %cd%
    echo Please run this script from the project root directory.
    echo.
    pause
    exit /b 1
)

:: 3. Check if server is already running
echo [*] Checking local port status...
node -e "fetch('http://localhost:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" >nul 2>nul
if not errorlevel 1 (
    echo [INFO] Dev Server is already running on http://localhost:3000
    echo [INFO] Opening web app in your default browser...
    start "" "http://localhost:3000"
    echo.
    echo Press any key to close this launcher...
    pause >nul
    exit /b 0
)

:: 4. Start browser and dev server
echo [*] Starting Dev Server and CORS Proxy on http://localhost:3000 ...
start "" "http://localhost:3000"

echo [*] Dev server started successfully!
echo [*] Press Ctrl+C in this window or close it to stop the server.
echo ========================================================
echo.

node scripts\dev-server.mjs

echo.
echo [INFO] Dev server process exited.
pause
