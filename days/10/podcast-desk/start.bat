@echo off
rem Windows: double-click to start Podcast Desk; it opens in your browser
cd /d "%~dp0"
if exist .venv\Scripts\python.exe (set PY=.venv\Scripts\python.exe) else (set PY=python)
%PY% app\server.py
pause
