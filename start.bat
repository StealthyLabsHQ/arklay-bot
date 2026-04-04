@echo off
cd /d "%~dp0"
echo Starting discord-bot...
node --disable-warning=DEP0040 dist/index.js
pause
