#!/usr/bin/env bash
# Linux (or macOS from a terminal): ./start.sh, then open http://localhost:8765
cd "$(dirname "$0")"
PY=python3; [ -x .venv/bin/python ] && PY=.venv/bin/python
exec "$PY" app/server.py "$@"
