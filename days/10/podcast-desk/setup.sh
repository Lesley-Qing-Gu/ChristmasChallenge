#!/usr/bin/env bash
# One-time setup on macOS / Linux: creates .venv and installs everything
set -e
cd "$(dirname "$0")"
command -v ffmpeg >/dev/null || { echo "Please install ffmpeg first (macOS: brew install ffmpeg, Ubuntu: sudo apt install ffmpeg)"; exit 1; }
python3 -m venv .venv
.venv/bin/pip install --upgrade pip
.venv/bin/pip install -r requirements.txt
if [ "$(uname -s)" = "Darwin" ] && [ "$(uname -m)" = "arm64" ]; then .venv/bin/pip install mlx-whisper; fi
echo "Done. Start it with ./start.command (macOS) or ./start.sh"
