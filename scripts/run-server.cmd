@echo off
REM ============================================================
REM  Ard Havaleh - server loop (started by the "ArdHavaleh" task)
REM
REM  Do not run this by hand - use 3-SERVER-ON.bat.
REM  If the server stops for any reason it is started again
REM  after 10 seconds. Everything it prints goes to logs\server.log
REM ============================================================

cd /d "%~dp0.."
if not exist "logs" mkdir "logs"

:loop
REM  Keep the log from growing forever: archive it above ~20 MB
if exist "logs\server.log" for %%F in ("logs\server.log") do if %%~zF GTR 20000000 move /y "logs\server.log" "logs\server-old.log" >nul

echo. >> "logs\server.log"
echo ===== start %date% %time% ===== >> "logs\server.log"

node scripts\ensure-current.mjs >> "logs\server.log" 2>&1
node --import tsx server\index.ts >> "logs\server.log" 2>&1

echo ===== stopped %date% %time% - restarting in 10 s ===== >> "logs\server.log"
timeout /t 10 /nobreak >nul
goto loop
