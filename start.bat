@echo off
title Tingchao Startup

cd /d "%~dp0"

echo ==============================
echo   Tingchao install and start
echo ==============================
echo.

:: Check Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [Error] Node.js was not found. Please install Node.js ^22.18.0 or ^>=24.12.0.
    pause
    exit /b 1
)

:: Check the supported Node.js version before installing dependencies
node -e "const [a,b]=process.versions.node.split('.').map(Number); process.exit((a===22 && b>=18)||(a===24 && b>=12)||a>24 ? 0 : 1)"
if %errorlevel% neq 0 (
    echo [Error] Unsupported Node.js version. Required: ^22.18.0 or ^>=24.12.0.
    node --version
    pause
    exit /b 1
)

:: Install frontend dependencies
echo [1/3] Installing frontend dependencies...
call npm install
if %errorlevel% neq 0 (
    echo [Error] Failed to install frontend dependencies.
    pause
    exit /b 1
)
echo.

:: Install API dependencies
echo [2/3] Installing API dependencies...
if not exist "%~dp0NeteaseCloudMusicApi\" (
    echo [Error] NeteaseCloudMusicApi directory was not found.
    pause
    exit /b 1
)

pushd "%~dp0NeteaseCloudMusicApi"
call npm install
if %errorlevel% neq 0 (
    echo [Error] Failed to install API dependencies.
    popd
    pause
    exit /b 1
)
popd
echo.

:: Start API server in a new window
echo [3/3] Starting services...
start "Tingchao-API" /D "%~dp0NeteaseCloudMusicApi" cmd /k node app.js

:: Wait for API startup
timeout /t 6 /nobreak >nul

:: Start frontend + open browser (delayed)
echo.
echo API server started in a new window. Starting frontend...
echo Opening http://localhost:5173 in your browser...
echo.
start "" cmd /c "timeout /t 4 >nul & start http://localhost:5173"
call npm run dev
pause
