@echo off
cd /d "%~dp0"
start "kondate-server" cmd /k python serve.py 5173
timeout /t 2 >nul
start "" http://localhost:5173
