@echo off
cd /d "%~dp0"

:: Read OLLAMA_ENABLED from .env
set OLLAMA_ENABLED=false
for /f "tokens=1,* delims==" %%a in ('findstr /i "OLLAMA_ENABLED" .env 2^>nul') do set %%a=%%b

if /i "%OLLAMA_ENABLED%"=="true" (
    echo [1/3] Starting Ollama...
    start "" /B ollama serve >nul 2>&1
    timeout /t 2 /nobreak >nul
) else (
    echo [1/3] Ollama disabled, skipping...
)

echo [2/3] Starting Lavalink...
start "Lavalink" cmd /c "cd /d %~dp0lavalink && java -jar Lavalink.jar"

echo Waiting for Lavalink to start...
timeout /t 5 /nobreak >nul

echo [3/3] Starting bot...
node --disable-warning=DEP0040 dist/index.js
pause
