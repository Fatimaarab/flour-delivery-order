@echo off
REM ============================================================
REM  Ard Havaleh - Start the system
REM
REM  NOTE: plain English on purpose - see 1-INSTALL.bat
REM  Persian instructions are in START-HERE.md
REM ============================================================

title Ard Havaleh - Running
cd /d "%~dp0"

if not exist "node_modules" goto :notinstalled
if not exist ".env" goto :notinstalled

echo.
echo ============================================================
echo    ARD HAVALEH - RUNNING
echo ============================================================
echo.
echo    On this computer:
echo        http://localhost:4000
echo.
echo    From phones and other computers on the same network:
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do (
    for /f "tokens=* delims= " %%b in ("%%a") do echo        http://%%b:4000
)
echo.
echo    Username: admin      Password: ard@1404
echo.
echo ------------------------------------------------------------
echo    KEEP THIS WINDOW OPEN.
echo    Closing it shuts the system down.
echo    Press Ctrl+C to stop.
echo ------------------------------------------------------------
echo.

REM ---- open the browser once the server is up ----
start "" /b cmd /c "timeout /t 4 >nul & start http://localhost:4000"

call npm start

echo.
echo System stopped.
pause
exit /b 0


:notinstalled
echo.
echo [ERROR] The system is not installed yet.
echo.
echo   Run  1-INSTALL.bat  first.
echo.
pause
exit /b 1
