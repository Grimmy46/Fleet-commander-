@echo off
title Hormuz - Build Installer
cd /d "%~dp0"

REM Stop electron-builder from downloading Apple code-signing tools.
REM That archive contains macOS symlinks Windows cannot extract
REM without elevated privileges, and we do not sign anything.
set CSC_IDENTITY_AUTO_DISCOVERY=false
set WIN_CSC_LINK=
set CSC_LINK=

echo.
echo   ============================================
echo     HORMUZ - BUILD WINDOWS INSTALLER
echo   ============================================
echo.

where node >nul 2>nul
if errorlevel 1 (
    echo   Node.js required.  https://nodejs.org
    echo.
    pause & exit /b
)

if not exist "node_modules\" (
    echo   Installing build tools...
    call npm install
    echo.
)

echo   [1/2] Building installer...
echo.
call npm run build

if exist "dist\HormuzFleetCommand-Setup.exe" goto success

echo.
echo   Installer build did not complete. Trying portable build...
echo.
call npm run build-portable

if exist "dist\HormuzFleetCommand.exe" goto portable

echo.
echo   Both builds failed. Trying plain folder build...
echo.
call npm run build-folder

if exist "dist\win-unpacked\Hormuz Fleet Command.exe" goto folder

echo.
echo   ============================================
echo     BUILD FAILED
echo.
echo     Use "Play Hormuz.bat" - it works without
echo     any build step.
echo.
echo     To fix the installer build, turn on
echo     Windows Developer Mode:
echo       Settings ^> System ^> For developers
echo       ^> Developer Mode = ON
echo     Then run this again.
echo   ============================================
echo.
pause & exit /b

:success
echo.
echo   ============================================
echo     DONE - INSTALLER READY
echo.
echo     dist\HormuzFleetCommand-Setup.exe
echo.
echo     Full Windows install wizard with
echo     shortcuts and Add/Remove Programs entry.
echo   ============================================
echo.
pause & exit /b

:portable
echo.
echo   ============================================
echo     DONE - PORTABLE BUILD
echo.
echo     dist\HormuzFleetCommand.exe
echo.
echo     Single file, no install needed.
echo     Copy it anywhere and double-click.
echo   ============================================
echo.
pause & exit /b

:folder
echo.
echo   ============================================
echo     DONE - FOLDER BUILD
echo.
echo     dist\win-unpacked\
echo     Run "Hormuz Fleet Command.exe" inside it.
echo.
echo     Keep the whole folder together.
echo   ============================================
echo.
pause & exit /b
