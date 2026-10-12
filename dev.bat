@echo off
title Tingchao Dev

cd /d "%~dp0"

echo ==============================
echo   Tingchao Dev (debug mode)
echo ==============================
echo.

:: Check Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [Error] Node.js was not found.
    pause
    exit /b 1
)

:: Chrome path (hardcoded)
set "CHROME=C:\Program Files\Google\Chrome\Application\chrome.exe"

:: Start API server in a new window
echo [1/2] Starting API server...
start "Tingchao-API" /D "%~dp0NeteaseCloudMusicApi" cmd /k node app.js

:: Wait for API startup
timeout /t 6 /nobreak >nul

:: Start frontend + open browser (delayed, async so dev server can run in foreground)
echo [2/2] Starting frontend dev server...
echo Opening http://localhost:5173 in Chrome (--disable-extensions)...
echo.

start "" cmd /c "timeout /t 5 >nul & start "" "%CHROME%" --disable-extensions http://localhost:5173/"

call npm run dev
pause
