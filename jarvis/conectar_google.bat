@echo off
chcp 65001 >nul
cd /d "%~dp0"
.venv\Scripts\python.exe conectar_google.py
pause
