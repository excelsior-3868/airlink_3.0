#!/bin/sh
# Install deps into the node_modules named volume, then start Vite.
# Reinstall whenever package.json / package-lock.json changes (not just first
# run) so newly added dependencies land in the volume without a manual wipe.
set -e
cd /app

# Stamp is the hash of the manifest files; mismatch => deps changed => reinstall.
STAMP_FILE=node_modules/.deps-stamp
CURRENT_STAMP=$(cat package.json package-lock.json 2>/dev/null | md5sum | cut -d' ' -f1)

if [ ! -f "$STAMP_FILE" ] || [ "$(cat "$STAMP_FILE")" != "$CURRENT_STAMP" ]; then
  echo "[frontend] Installing npm dependencies (manifest changed or first run) ..."
  npm install
  echo "$CURRENT_STAMP" > "$STAMP_FILE"
fi

exec "$@"
