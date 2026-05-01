@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if %errorlevel%==0 (
  node server.js
  goto :end
)

set "CODEX_NODE=%LOCALAPPDATA%\OpenAI\Codex\bin\node.exe"
if exist "%CODEX_NODE%" (
  "%CODEX_NODE%" server.js
  goto :end
)

echo Node.js не найден.
echo Установите Node.js LTS с https://nodejs.org/ или запустите через Codex.
pause

:end
endlocal
