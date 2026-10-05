@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
    echo.
    echo   Node.js is required.  Get it free from https://nodejs.org
    echo   Install the LTS version, then run this again.
    echo.
    pause
    exit /b
)
if not exist "node_modules\" (
    echo.
    echo   First-time setup. This takes 1-2 minutes, once only.
    echo.
    call npm install
)
start "" /b cmd /c "npm start"
exit
