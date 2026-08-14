@echo off
title Plugin Web Runner
cd /d "%~dp0"

echo ========================================
echo   AstrBot Plugin Web Runner
echo ========================================
echo.

where python >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Python not found. Please install Python 3.8+
    echo         https://www.python.org/downloads/
    pause
    exit /b 1
)

python -c "import flask" 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [SETUP] Installing dependencies...
    pip install flask flask-cors curl_cffi
    if %ERRORLEVEL% NEQ 0 (
        echo [ERROR] Failed to install dependencies.
        echo         Run: pip install flask flask-cors curl_cffi
        pause
        exit /b 1
    )
)

echo [START] Server starting...
echo.
echo Open browser at: http://localhost:3000
echo Close this window to stop the server.
echo.

python app.py

echo.
echo Server stopped.
pause
