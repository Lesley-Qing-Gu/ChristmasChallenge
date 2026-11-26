@echo off
rem One-time setup on Windows: creates .venv and installs everything
cd /d "%~dp0"
where ffmpeg >nul 2>nul || (echo Please install ffmpeg first: winget install ffmpeg & pause & exit /b 1)
python -m venv .venv
.venv\Scripts\python -m pip install --upgrade pip
.venv\Scripts\pip install -r requirements.txt
echo Done. Double-click start.bat to open Podcast Desk.
pause
