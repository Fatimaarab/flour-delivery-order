@echo off
REM ============================================================
REM  Ard Havaleh - Installer
REM
REM  NOTE: This file is intentionally written in plain English.
REM  Windows batch files cannot reliably display Persian text,
REM  and non-ASCII characters can break command parsing.
REM  Persian instructions are in START-HERE.md
REM
REM  This file only checks that Node.js is installed. Everything
REM  else lives in scripts/install.mjs, because that part can be
REM  tested before release and batch files cannot.
REM
REM  A full log is written to install-log.txt next to this file.
REM ============================================================

title Ard Havaleh - Install
cd /d "%~dp0"

where node >nul 2>&1
if errorlevel 1 goto :nonode

where npm >nul 2>&1
if errorlevel 1 goto :nonpm

echo.
echo ============================================================
echo    Is this the REAL factory server?
echo.
echo    Y = real server: NO demo data, one admin user with a
echo        random password (shown once on screen).
echo    N = test machine: demo customers, products and users.
echo ============================================================
choice /C YN /M "Real factory server"
if errorlevel 2 goto :demo

node "scripts\install.mjs" --production
goto :done

:demo
node "scripts\install.mjs"

:done
echo.
pause
exit /b 0


:nonode
echo.
echo ============================================================
echo    [ERROR] Node.js is not installed
echo ============================================================
echo.
echo   1. Go to   https://nodejs.org
echo   2. Download the Windows LTS installer.
echo   3. Install it - click Next on every screen.
echo   4. CLOSE this window, open the folder again,
echo      and run 1-INSTALL.bat once more.
echo.
echo   Step 4 matters: Windows only sees Node.js in a
echo   window opened AFTER the install finished.
echo.
pause
exit /b 1


:nonpm
echo.
echo ============================================================
echo    [ERROR] npm was not found
echo ============================================================
echo.
echo   Node.js is installed but npm is not visible yet.
echo.
echo   1. CLOSE this window completely.
echo   2. Open the folder again and run 1-INSTALL.bat.
echo.
echo   If it still fails, re-install Node.js from
echo   https://nodejs.org and keep every default option.
echo.
pause
exit /b 1
