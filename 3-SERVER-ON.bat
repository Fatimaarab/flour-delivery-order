@echo off
REM ============================================================
REM  Ard Havaleh - Turn the server ON (runs by itself at boot)
REM
REM  Run this ONCE on the factory server, as Administrator
REM  (right-click -> Run as administrator).
REM
REM  What it does:
REM    1. Creates a Windows task "ArdHavaleh" that starts the
REM       system every time the computer boots - even if nobody
REM       is logged in. If the system crashes, it restarts.
REM    2. Opens port 4000 in the firewall for PRIVATE networks
REM       only (not public networks).
REM    3. Starts the system right now.
REM
REM  Plain English on purpose - see 1-INSTALL.bat
REM  Persian instructions are in DEPLOY.md
REM ============================================================

title Ard Havaleh - Server ON
cd /d "%~dp0"

net session >nul 2>&1
if errorlevel 1 goto :notadmin

if not exist "node_modules" goto :notinstalled
if not exist ".env" goto :notinstalled

echo.
echo Creating the startup task...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\install-task.ps1" -Root "%~dp0."
if errorlevel 1 goto :taskfailed

echo.
echo Opening port 4000 for private networks...
netsh advfirewall firewall delete rule name="Ard Havaleh" >nul 2>&1
netsh advfirewall firewall add rule name="Ard Havaleh" dir=in action=allow protocol=TCP localport=4000 profile=private,domain
if errorlevel 1 echo [warn] Could not create the firewall rule. See DEPLOY.md

echo.
echo Starting the system now...
schtasks /Run /TN "ArdHavaleh" >nul

echo.
echo ============================================================
echo    SERVER IS ON
echo ============================================================
echo.
echo    It starts by itself every time this computer boots.
echo    Wait about 30 seconds, then open from any computer or
echo    phone on the factory network:
echo.
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do (
    for /f "tokens=* delims= " %%b in ("%%a") do echo        http://%%b:4000
)
echo.
echo    (On this computer:  http://localhost:4000)
echo.
echo    Messages from the system are saved in:  logs\server.log
echo    To turn it off:  4-SERVER-OFF.bat
echo.
pause
exit /b 0


:notadmin
echo.
echo [ERROR] This must be run as Administrator.
echo.
echo   Right-click  3-SERVER-ON.bat  and choose
echo   "Run as administrator".
echo.
pause
exit /b 1

:notinstalled
echo.
echo [ERROR] The system is not installed yet. Run 1-INSTALL.bat first.
echo.
pause
exit /b 1

:taskfailed
echo.
echo [ERROR] Windows refused to create the startup task.
echo   Make sure you used "Run as administrator" and try again.
echo.
pause
exit /b 1
