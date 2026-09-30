@echo off
title AdsPx Google Token Worker v3.0
color 0B
cls
echo.
echo  =========================================================
echo    AdsPx Automated Google Token Minting Worker  v3.0
echo    Strategy: WEB_SEARCH Intent -- Zero Misclick Mode
echo  =========================================================
echo.
echo  Emulator  : LDPlayer (emulator-5558)
echo  API Target: https://adspx.com/api/public/token-pool
echo  Method    : share.google token via WEB_SEARCH intent
echo.

cd /d "%~dp0"

echo  [1] Checking LDPlayer connection...
echo.
C:\LDPlayer\LDPlayer14\adb.exe devices
echo.

echo  [2] Checking current pool stock...
node -e "const h=require('https');h.get('https://adspx.com/api/public/token-pool',r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>{try{const j=JSON.parse(d);console.log('  Current pool stock: '+j.available+' tokens available');}catch{console.log('  Pool: '+d);}})}).end();"
echo.

set /p TOKEN_COUNT="  How many tokens to mint? [Default=5]: "
if "%TOKEN_COUNT%"=="" set TOKEN_COUNT=5
if "%TOKEN_COUNT%"=="0" (
  echo  Nothing to do. Exiting.
  pause
  exit /b 0
)

echo.
echo  [3] Starting minting engine for %TOKEN_COUNT% token(s)...
echo  NOTE: Do NOT touch LDPlayer while minting is in progress!
echo.
node "scripts/pc-token-worker.cjs" --count %TOKEN_COUNT%

echo.
echo  =========================================================
echo   Done! Tokens are now in the AdsPx pool.
echo   Admin panel: https://adspx.com/control-panel
echo  =========================================================
echo.
pause
