#!/bin/bash
# Usage: scripts/screenshot.sh <page> <name> [width] [height]
#   scripts/screenshot.sh days/02/index.html day-02 1000 1400
# Saves docs/screenshots/<name>.png using headless Chrome (macOS).
set -e
cd "$(dirname "$0")/.."
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
"$CHROME" --headless --disable-gpu --hide-scrollbars \
  --screenshot="docs/screenshots/$2.png" \
  --window-size="${3:-1100},${4:-1400}" \
  --virtual-time-budget=4000 "file://$PWD/$1"
echo "saved docs/screenshots/$2.png"
