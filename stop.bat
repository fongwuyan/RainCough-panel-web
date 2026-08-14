@echo off
chcp 65001 >nul 2>nul
title TouchGal - 停止服务
cd /d "%~dp0"

echo [~] 正在停止 TouchGal 服务...

for /f "tokens=2" %%a in ('tasklist /fi "imagename eq python.exe" /fo list ^| findstr "PID"') do (
    taskkill /f /pid %%a >nul 2>nul
)

echo [✓] 服务已停止
timeout /t 2 /nobreak >nul
