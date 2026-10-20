#!/bin/bash
# Double-click to play Pazar.
# Serves the game from a tiny local web server (serve.py) so YouTube music
# works (YouTube refuses to play on pages opened straight from disk) and so the
# browser never caches stale game files.
cd "$(dirname "$0")"
PORT=8765
if command -v python3 >/dev/null 2>&1; then
  if ! lsof -iTCP:$PORT -sTCP:LISTEN >/dev/null 2>&1; then
    nohup python3 serve.py $PORT >/dev/null 2>&1 &
    sleep 0.8
  fi
  open "http://localhost:$PORT/"
else
  echo "python3 not found — opening without the local server (YouTube music unavailable)."
  open index.html
fi
