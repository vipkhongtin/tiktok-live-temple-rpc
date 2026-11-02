@echo off
chcp 65001 >nul
title CHUA LINH UNG ONLINE - OBS 9:16 STREAM MODE
color 0B

cd /d "%~dp0"

for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3000" ^| findstr "LISTENING"') do (
    taskkill /F /PID %%a >nul 2>nul
)

start "" "http://localhost:3000/?obs=1"
node server.js
pause
