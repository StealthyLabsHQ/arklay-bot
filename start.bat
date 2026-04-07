@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"

set "ROOT=%~dp0"
set "ENV_FILE=%ROOT%.env"
set "DIST_ENTRY=%ROOT%dist\index.js"
set "LAVALINK_DIR=%ROOT%lavalink"
set "LAVALINK_JAR=%LAVALINK_DIR%\Lavalink.jar"

set "OLLAMA_ENABLED=false"
set "LAVALINK_HOST=localhost:2333"

if exist "%ENV_FILE%" (
    for /f "usebackq tokens=1,* delims==" %%A in ("%ENV_FILE%") do (
        set "KEY=%%~A"
        set "VALUE=%%~B"
        if /i "!KEY!"=="OLLAMA_ENABLED" set "OLLAMA_ENABLED=!VALUE!"
        if /i "!KEY!"=="LAVALINK_HOST" set "LAVALINK_HOST=!VALUE!"
    )
)

for /f "tokens=* delims= " %%A in ("%OLLAMA_ENABLED%") do set "OLLAMA_ENABLED=%%~A"
for /f "tokens=* delims= " %%A in ("%LAVALINK_HOST%") do set "LAVALINK_HOST=%%~A"

if not exist "%DIST_ENTRY%" (
    echo [error] Missing dist\index.js. Run npm run build first.
    exit /b 1
)

where node >nul 2>&1
if errorlevel 1 (
    echo [error] Node.js is not available in PATH.
    exit /b 1
)

where java >nul 2>&1
if errorlevel 1 (
    echo [error] Java is not available in PATH.
    exit /b 1
)

if not exist "%LAVALINK_JAR%" (
    echo [error] Missing lavalink\Lavalink.jar.
    exit /b 1
)

for /f "tokens=1,2 delims=:" %%A in ("%LAVALINK_HOST%") do (
    set "LAVALINK_HOSTNAME=%%~A"
    set "LAVALINK_PORT=%%~B"
)
if not defined LAVALINK_HOSTNAME set "LAVALINK_HOSTNAME=localhost"
if not defined LAVALINK_PORT set "LAVALINK_PORT=2333"

echo [1/3] Checking Ollama...
if /i "%OLLAMA_ENABLED%"=="true" (
    where ollama >nul 2>&1
    if errorlevel 1 (
        echo [error] OLLAMA_ENABLED=true but ollama is not available in PATH.
        exit /b 1
    )
    start "" /B ollama serve >nul 2>&1
) else (
    echo Ollama disabled, skipping.
)

echo [2/3] Starting Lavalink...
start "Lavalink" /D "%LAVALINK_DIR%" cmd /c "java -jar Lavalink.jar"

echo Waiting for Lavalink on %LAVALINK_HOSTNAME%:%LAVALINK_PORT%...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$deadline=(Get-Date).AddSeconds(20); while((Get-Date) -lt $deadline){ if(Test-NetConnection -ComputerName '%LAVALINK_HOSTNAME%' -Port %LAVALINK_PORT% -InformationLevel Quiet -WarningAction SilentlyContinue){ exit 0 }; Start-Sleep -Milliseconds 500 }; exit 1" >nul
if errorlevel 1 (
    echo [error] Lavalink did not become reachable within 20 seconds.
    exit /b 1
)

echo [3/3] Starting bot...
node --disable-warning=DEP0040 dist/index.js
endlocal
