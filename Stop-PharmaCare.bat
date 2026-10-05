@echo off
title Stop PharmaCare Server
echo Stopping any running PharmaCare server on port 3000...

for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3000" ^| findstr "LISTENING"') do (
    echo Terminating PID: %%a
    taskkill /F /PID %%a >nul 2>&1
)

echo Done! Server stopped.
timeout /t 2 >nul
