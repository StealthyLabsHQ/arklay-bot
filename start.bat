@echo off
cd /d "%~dp0"

echo [1/2] Starting Lavalink...
start "Lavalink" cmd /c "cd /d %~dp0lavalink && java -jar Lavalink.jar"

echo Waiting for Lavalink to start...
timeout /t 5 /nobreak >nul

echo [2/2] Starting bot...
node --disable-warning=DEP0040 dist/index.js
pause
