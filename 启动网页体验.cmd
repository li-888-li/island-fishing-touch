@echo off
cd /d "%~dp0"
if not exist "E:\nodejs\node.exe" (
  echo 找不到 E:\nodejs\node.exe，请联系制作人员。
  pause
  exit /b 1
)
start "" "http://127.0.0.1:5189/"
"E:\nodejs\node.exe" "%~dp0server.mjs"
pause
