@echo off
cd /d "%~dp0"

echo [1/3] Starting Ollama...
start "" /B ollama serve >nul 2>&1
timeout /t 2 /nobreak >nul

echo [2/3] Starting Lavalink...
start "Lavalink" cmd /c "cd /d %~dp0lavalink && java -jar Lavalink.jar"

echo Waiting for Lavalink to start...
timeout /t 5 /nobreak >nul

echo [3/3] Starting bot...
node --disable-warning=DEP0040 dist/index.js
pause
