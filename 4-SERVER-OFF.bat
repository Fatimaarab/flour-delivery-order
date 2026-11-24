@echo off
REM ============================================================
REM  Ard Havaleh - Turn the server OFF
REM
REM  Run as Administrator. Stops the system and removes the
REM  automatic start at boot. Use this before an update or a
REM  restore from backup; run 3-SERVER-ON.bat to turn it back on.
REM
REM  Plain English on purpose - see 1-INSTALL.bat
REM ============================================================

title Ard Havaleh - Server OFF
cd /d "%~dp0"

net session >nul 2>&1
if errorlevel 1 goto :notadmin

echo.
echo Stopping the system...
schtasks /End /TN "ArdHavaleh" >nul 2>&1
schtasks /Delete /TN "ArdHavaleh" /F >nul 2>&1

REM  Make sure the server process itself is gone (it listens on port 4000)
for /f "tokens=5" %%p in ('netstat -ano ^| findstr /c:":4000 " ^| findstr /c:"LISTENING"') do taskkill /F /T /PID %%p >nul 2>&1

netsh advfirewall firewall delete rule name="Ard Havaleh" >nul 2>&1

echo.
echo ============================================================
echo    SERVER IS OFF - it will NOT start at boot any more.
echo    To turn it on again: 3-SERVER-ON.bat
echo ============================================================
echo.
pause
exit /b 0

:notadmin
echo.
echo [ERROR] This must be run as Administrator.
echo   Right-click  4-SERVER-OFF.bat  and choose
echo   "Run as administrator".
echo.
pause
exit /b 1
