#!/bin/bash
# Airlink v3.0 — load the legacy v2.0 dump into the airlink_legacy schema.
# Runs once, on first container boot, AFTER 01-create-schemas.sql.
# The dump (nalrd_backup.sql) has no CREATE DATABASE/USE, so we target the
# schema explicitly. Mounted read-only at /legacy/nalrd_backup.sql.
set -euo pipefail

DUMP=/legacy/nalrd_backup.sql

if [ ! -f "$DUMP" ]; then
  echo "[legacy] ERROR: $DUMP not found — is nalrd_backup.sql mounted?" >&2
  exit 1
fi

echo "[legacy] Loading $(du -h "$DUMP" | cut -f1) dump into airlink_legacy ..."
mariadb --user=root --password="${MARIADB_ROOT_PASSWORD}" airlink_legacy < "$DUMP"

COUNT=$(mariadb --user=root --password="${MARIADB_ROOT_PASSWORD}" --skip-column-names \
  -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='airlink_legacy';")
echo "[legacy] Done — airlink_legacy now has ${COUNT} tables."
