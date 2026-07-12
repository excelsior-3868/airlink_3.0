#!/bin/sh
# Install deps on first run (node_modules is a named volume), then start Vite.
set -e
cd /app

if [ ! -f node_modules/.installed ]; then
  echo "[frontend] Installing npm dependencies ..."
  npm install
  touch node_modules/.installed
fi

exec "$@"
