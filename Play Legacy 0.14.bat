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
REM Always sync dependencies: quick when nothing changed, and it
REM upgrades old installs (0.14 used an older Electron).
echo   Checking dependencies...
call npm install --no-audit --no-fund --loglevel=error
start "" /b cmd /c "npm run legacy"
exit
