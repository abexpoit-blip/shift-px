@echo off
title AdsPx Token Worker - LDPlayer Edition
color 0A
cls
echo =======================================================
echo          AdsPx Automated Google Token Worker
echo =======================================================
echo.

cd /d "%~dp0"

echo [1] Checking LDPlayer Connection...
C:\LDPlayer\LDPlayer14\adb.exe devices
echo.

set /p TOKEN_COUNT="How many tokens do you want to generate? [Default 10]: "
if "%TOKEN_COUNT%"=="" set TOKEN_COUNT=10

echo.
echo Starting worker for %TOKEN_COUNT% tokens...
node scripts/pc-token-worker.cjs --count %TOKEN_COUNT%

echo.
echo =======================================================
echo All done! You can close this window.
echo =======================================================
pause
