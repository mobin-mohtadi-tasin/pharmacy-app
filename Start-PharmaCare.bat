@echo off
title PharmaCare Billing System
cd /d "%~dp0"

echo ========================================================
echo        PharmaCare Pharmacy Billing System
echo ========================================================
echo.

if exist "PharmaCare.exe" (
    echo Starting via PharmaCare.exe...
    start "" "PharmaCare.exe"
    exit /b
)

if exist "pharmacy-app\package.json" cd "pharmacy-app"

echo Checking if server is already running on http://localhost:3000 ...
curl -s -o nul -w "%%{http_code}" http://localhost:3000 > nul 2>&1
if %errorlevel% equ 0 (
    echo Server is already online! Opening Google Chrome...
    start "" "chrome.exe" "http://localhost:3000"
    exit /b
)

echo Starting Next.js server in the background...
start /min "PharmaCare Server" cmd /c "npm run dev"

echo Waiting for server to initialize...
:wait_loop
timeout /t 1 /nobreak > nul
curl -s -o nul -w "%%{http_code}" http://localhost:3000 > nul 2>&1
if %errorlevel% neq 0 (
    goto wait_loop
)

echo Server ready! Opening in Google Chrome...
start "" "chrome.exe" "http://localhost:3000"
echo.
echo PharmaCare is running at http://localhost:3000
