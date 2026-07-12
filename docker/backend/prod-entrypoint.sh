#!/bin/bash
# Production backend entrypoint: wait for DB, migrate, cache config, start php-fpm.
set -euo pipefail
cd /var/www/html

echo "[app] Waiting for MariaDB at ${DB_HOST}:${DB_PORT} ..."
until php -r "try { new PDO('mysql:host='.getenv('DB_HOST').';port='.getenv('DB_PORT'), getenv('DB_USERNAME'), getenv('DB_PASSWORD')); exit(0);} catch (Exception \$e){exit(1);}"; do
  sleep 2
done

if [ "${RUN_MIGRATIONS:-1}" = "1" ]; then
  php artisan migrate --force
  php artisan db:seed --force || true
fi

# Cache config/routes for speed (safe to re-run).
php artisan config:cache
php artisan route:cache

exec "$@"
