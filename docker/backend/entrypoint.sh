#!/bin/bash
# Airlink v3.0 backend entrypoint.
# Runs on every container start. First-run tasks (composer install, key
# generate) are guarded so restarts are fast. Only the primary `backend`
# service runs migrations/seed; queue & scheduler set RUN_MIGRATIONS=0.
set -euo pipefail

cd /var/www/html

# 1. Dependencies (first run only — vendor is bind-mounted and persists).
if [ ! -f vendor/autoload.php ]; then
  echo "[backend] Installing composer dependencies ..."
  composer install --no-interaction --prefer-dist --no-progress
fi

# 2. App key (first run only).
if ! grep -q '^APP_KEY=base64:' .env 2>/dev/null; then
  echo "[backend] Generating APP_KEY ..."
  php artisan key:generate --force
fi

# 3. Wait for MariaDB to accept connections.
echo "[backend] Waiting for MariaDB at ${DB_HOST}:${DB_PORT} ..."
until php -r "
  try { new PDO('mysql:host='.getenv('DB_HOST').';port='.getenv('DB_PORT'),
        getenv('DB_USERNAME'), getenv('DB_PASSWORD')); exit(0); }
  catch (Exception \$e) { exit(1); }
"; do
  sleep 2
done
echo "[backend] MariaDB is up."

# 4. Migrations + seed (primary service only).
if [ "${RUN_MIGRATIONS:-1}" = "1" ]; then
  echo "[backend] Running migrations ..."
  php artisan migrate --force
  if [ "${RUN_SEED:-1}" = "1" ]; then
    echo "[backend] Seeding ..."
    php artisan db:seed --force || echo "[backend] (seed skipped/failed — non-fatal)"
  fi
fi

exec "$@"
