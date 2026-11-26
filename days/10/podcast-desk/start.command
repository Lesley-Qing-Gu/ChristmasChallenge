#!/bin/zsh
# macOS: double-click to open Podcast Desk (starts it first if it isn't running)
cd "$(dirname "$0")"
URL="http://localhost:8765"
if ! curl -s -o /dev/null --max-time 2 "$URL/api/projects"; then
  echo "Starting Podcast Desk…"
  PY=python3; [ -x .venv/bin/python ] && PY=.venv/bin/python
  nohup "$PY" app/server.py --no-browser > /tmp/podcast_desk.log 2>&1 &
  for i in {1..20}; do curl -s -o /dev/null --max-time 1 "$URL" && break; sleep 0.5; done
fi
open "$URL"
echo "Opened $URL in your browser (you can close this window)."
