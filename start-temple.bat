@echo off
chcp 65001 >nul
title CHUA LINH UNG ONLINE - TIKTOK LIVE RPC v2.5 (ANTI-STATIC STREAM)
color 0E

cd /d "%~dp0"

echo ============================================================================
echo    🪷 CHUA LINH UNG ONLINE - HE THONG TIKTOK LIVE RPC 9:16 (v2.5) 🪷
echo ============================================================================
echo.

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [LOI] Khong tim thay Node.js tren may tinh!
    echo Vui long cai dat Node.js tu https://nodejs.org/
    pause
    exit /b 1
)

if not exist "node_modules\" (
    echo [1/3] Dang cai dat cac thu vien Node.js lan dau...
    call npm install
) else (
    echo [1/3] Thu vien Node.js da san sang.
)

:: Don dep tien trinh cu dang chiem cong 3000 (neu co)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3000" ^| findstr "LISTENING"') do (
    echo [2/3] Dang dong phien Server cu tren cong 3000 (PID: %%a)...
    taskkill /F /PID %%a >nul 2>nul
)

echo [3/3] Dang khoi dong Server va mo giao dien Chanh Dien 9:16...
echo.
echo   - Man hinh Dieu Khien ^& Live : http://localhost:3000
echo   - Man hinh OBS 9:16 Sach     : http://localhost:3000/?obs=1
echo   - Bang Quan Tri JSON-RPC     : http://localhost:3000/admin
echo.
echo ============================================================================
echo   Nhan Ctrl + C de dung Server.
echo ============================================================================
echo.

start "" "http://localhost:3000"
node server.js

pause
