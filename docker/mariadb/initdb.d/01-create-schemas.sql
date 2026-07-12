-- Airlink v3.0 — MariaDB init (runs once, on first container boot)
--
-- The entrypoint (via MARIADB_DATABASE/MARIADB_USER) has already created the
-- clean `airlink` schema and the `airlink` app user with full rights on it.
-- Here we add the read-only legacy schema and grant the app user SELECT on it,
-- so the Laravel `legacy` connection can ETL from it without ever writing.

CREATE DATABASE IF NOT EXISTS `airlink`
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE DATABASE IF NOT EXISTS `airlink_legacy`
  CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

-- App user (created by entrypoint) gets read-only access to the legacy schema.
GRANT SELECT ON `airlink_legacy`.* TO 'airlink'@'%';

-- FreeRADIUS reuses the app user in dev; it needs read on radcheck/radreply/nas
-- and write on radacct/radpostauth — all inside `airlink`, already granted by
-- the entrypoint's ALL PRIVILEGES on `airlink`.*. Nothing extra needed here.

FLUSH PRIVILEGES;
