# Airlink FreeRADIUS Billing System v3.0 — Implementation Plan

**Prepared from:** `Airlink Billing 3.0 (1).pdf` / `.md` spec, `FrontendSKILL.md`
**Date:** 2026-07-11

---

## 1. Goal

Upgrade the existing v2.0 hotspot billing platform (FreeRADIUS + MikroTik + MariaDB + PHP admin)
into a **multi-level distribution system**: `Admin → Reseller → Seller → Customer`, with two parallel
balances that both deduct on voucher generation — **Wallet (money, Rs)** and **GB quota**.

The v2.0 authentication path is unchanged: Customer → MikroTik captive portal → RADIUS Access-Request
(UDP 1812) → FreeRADIUS checks `radcheck` in MariaDB → Accept/Reject → accounting to `radacct` (UDP 1813).

---

## 2. Tech stack (decided)

| Layer | Choice |
|---|---|
| Backend | **Laravel 11 (PHP 8.3)** REST API, Sanctum token auth |
| Frontend | **React + Vite + TypeScript**, Tailwind, Framer Motion, lucide-react (per `FrontendSKILL.md`) |
| Database | **Shared MariaDB** — app tables + FreeRADIUS `radcheck`/`radreply`/`radacct`/`nas` |
| Auth path | FreeRADIUS + MikroTik NAS (existing, unchanged) |
| Build | Fresh build from spec (no v2.0 source reused) |
| Repo | Monorepo: `backend/` + `frontend/` |

> Open to reuse of a v2.0 DB dump if provided later — schema below is designed to stay FreeRADIUS-compatible.

---

## 3. Repository layout

```
Airlink 3.0/
├── backend/                 # Laravel 11 API
│   ├── app/
│   │   ├── Models/          # User, InternetPlan, Voucher, Batch, WalletTransaction, GbTransaction
│   │   ├── Http/Controllers/Api/
│   │   ├── Http/Middleware/ # role gate
│   │   ├── Policies/        # per-resource authorization
│   │   └── Services/        # VoucherService, WalletService, GbService, RadiusService
│   ├── database/migrations/
│   ├── routes/api.php
│   └── .env                 # MariaDB connection
├── frontend/                # React + Vite SPA
│   ├── src/
│   │   ├── lib/             # api client, auth store
│   │   ├── components/      # Sidebar, GlassCard, MotionTable, Pagination (FrontendSKILL)
│   │   ├── layouts/         # AppShell (role-aware sidebar)
│   │   ├── pages/           # login, dashboards, plans, resellers, sellers, wallet, vouchers, reports
│   │   └── styles/          # tailwind tokens from FrontendSKILL
│   └── vite.config.ts
├── docs/
│   └── SRS reference (pdf/md)
├── IMPLEMENTATION_PLAN.md
└── README.md
```

---

## 4. Data model

App-owned tables:

- **users** — `id, name, username, email, phone, password, role (admin|reseller|seller), parent_id (FK users),
  wallet_balance (decimal), gb_balance (decimal GB), status (active|disabled), created_by, timestamps`
  - `parent_id` builds the hierarchy: reseller.parent = admin, seller.parent = reseller.
- **internet_plans** — `id, name, plan_type (data|time|unlimited), bandwidth, data_gb (nullable), time_limit (nullable),
  validity_days, base_price, selling_price, api_nas, status, timestamps` (admin-only writes)
- **vouchers** — `id, code (unique), username, password, plan_id (FK), batch_id (FK nullable),
  owner_id (FK users), reseller_id, seller_id, data_gb, validity_days, price,
  status (new|sold|active|expired|disabled), sold_at, activated_at, expires_at, customer_username, timestamps`
- **batches** — `id, batch_code (e.g. BAT260711), plan_id, quantity, generated_by (FK users), created_at`
- **wallet_transactions** — `id, user_id, type (load|transfer|deduct|refund), amount, balance_after,
  from_user_id, to_user_id, reference (voucher/batch), note, created_at`
- **gb_transactions** — `id, user_id, type (allocate|deduct|refund), gb_amount, balance_after,
  from_user_id, to_user_id, reference, created_at`

FreeRADIUS tables (standard schema, app writes into them):

- **radcheck** — voucher credentials + `Max-Data`/`Session-Timeout`/`Expiration` attributes
- **radreply** — per-user reply attributes (rate limits, etc.)
- **radacct** — accounting (read-only for reports: login date, session, data used)
- **nas** — registered MikroTik NAS devices

> DB gotcha: enforce the wallet/GB deduction + voucher insert + radcheck insert inside a **single DB transaction**
> so partial generation can never leave orphaned credentials or double-spent balance.

---

## 5. Backend build order

1. **Foundation** — Laravel install, Sanctum, MariaDB `.env`, CORS for the SPA, `pkg`-style base response/error envelope.
2. **Schema** — all migrations above + FreeRADIUS tables; seeders for a default admin + sample plans.
3. **Auth & RBAC** — login/logout/me endpoints; `role` middleware + Policies encoding the permission matrix:

   | Feature | Admin | Reseller | Seller |
   |---|:-:|:-:|:-:|
   | Create Plan / Reseller / Delete Voucher | ✅ | ❌ | ❌ |
   | Create Seller / Wallet Load / Allocate GB | ✅ | ✅ | ❌ |
   | Generate Voucher / Dashboard | ✅ | ✅ | ✅ |
   | Reports | ✅ | ✅ | Limited (own) |

4. **Plans** — CRUD (admin), list (all roles).
5. **User management** — create reseller (admin), create seller (admin/reseller), disable user, list scoped to hierarchy.
6. **Wallet** — load (admin→reseller, reseller→seller), transfer, refund; every change writes `wallet_transactions`.
7. **GB allocation** — allocate down the chain; writes `gb_transactions`.
8. **Voucher generation** (core) — `VoucherService`:
   - read plan → compute `qty × data_gb` and `qty × price`
   - check wallet **and** GB balance → if short, `422` "Not enough GB/wallet balance"
   - in one transaction: create vouchers, deduct wallet, deduct GB, insert `radcheck`(+`radreply`), set status `new`
   - single + **batch** mode (500–20,000), unique `batch_code`
9. **Voucher lifecycle** — status transitions `new→sold→active→expired/disabled`; `active/expired` driven by radacct + a scheduled command; admin disable.
10. **Reports** — Used Voucher report with package summary (generated/used/remaining) and drill-down; filters: date range, package, reseller, seller, code, username, status. Reseller/Seller scoped to their own tree.
11. **Exports** — voucher list → Excel (`.xlsx`) + CSV; batch report; voucher-card PNG (QR + logo + T&C) and printable sheets.
12. **Dashboards** — aggregate endpoints per role (Admin: sales/wallet/GB distributed, online/offline, revenue, top reseller; Reseller: balances, seller count, sales, top seller; Seller: balances, today's vouchers/sales, recent customers).

---

## 6. Frontend build order (uses `FrontendSKILL.md`)

1. **Foundation** — Vite React-TS, Tailwind config with FrontendSKILL tokens (Outfit font, NT-blue primary, glass cards), lucide-react, Framer Motion, axios API client, auth store, protected routes.
2. **Login page** — animated gradient background, glass card, `.btn-primary`, tap scale.
3. **App shell** — role-aware animated sidebar (`.app-sidebar-*`), topbar.
4. **Dashboards** — Admin / Reseller / Seller variants with stat cards + recent-transactions motion table.
5. **Plans** — table + create/edit modal (admin).
6. **Resellers / Sellers** — hierarchy management, disable, wallet/GB load actions.
7. **Wallet & GB** — load/transfer forms, balance widgets, transaction history.
8. **Voucher generation** — single + batch UI (select plan, validity, quantity, live cost/GB calc, insufficient-balance guard), print/PNG/export.
9. **Reports** — package summary + drill-down with the spec's filter set; status badges (`.pill.*`).
10. **Polish** — pagination component, motion table transitions, empty/loading states.

---

## 7. Milestones (suggested phasing)

- **M1 — Skeleton & auth:** both apps scaffolded, login working end-to-end, role gating, admin seeded. *(foundation)*
- **M2 — Money & quota:** plans, user hierarchy, wallet load/transfer, GB allocation, dashboards. *(the v3.0 distribution core)*
- **M3 — Vouchers & RADIUS:** single + batch generation with wallet/GB deduction and `radcheck` insert; voucher lifecycle; card PNG/print/export.
- **M4 — Reports & exports:** used-voucher reports, filters, Excel/CSV, batch report.
- **M5 — Hardening:** NAS management, login logs, scheduled expiry, refunds, tests, deploy notes.

---

## 8. Decisions (resolved 2026-07-11)

| # | Decision | Choice |
|---|---|---|
| 1 | **v2.0 source** | Legacy dump `nalrd_backup.sql` provided → migrate. |
| 2 | **DB bridge strategy** | **Clean v3.0 schema + ETL import.** New app tables built per §4; standard FreeRADIUS tables kept as-is; a Laravel `legacy:import` command transforms legacy `tbl_*` data into the new schema. See §9–10. |
| 3 | **Import scope** | **Operational state + live credentials.** Import plans, bandwidth, staff→users, current wallet balances, and vouchers/customers with their `radcheck`/`radreply`. Skip `radacct` (2.4M) + `radpostauth` (4.5M) history. Small history tables (`tbl_transactions`, `tbl_user_recharges`) imported as reference. |
| 4 | **Role/hierarchy mapping** | **Best-effort inferred, then reviewed.** `tbl_users.user_type`: Admin→admin, Sales→reseller, Regular/POS→seller. Resellers' parent = the admin; sellers' parent = best-guess reseller. Import emits a review report to correct `parent_id` in-app. See §10.C. |
| 5 | **FreeRADIUS** | **Included in Docker** (ports 1812/1813) wired to MariaDB → full auth path runs locally. See §11. |
| 6 | **Deployment target** | **Docker Desktop** (Linux containers on Windows 11). Queue worker + scheduler run as their own containers. |

Assumptions taken (flag if wrong): currency = **Rs / NPR**, Gregorian dates; portal auth = **username/password** (Sanctum), OTP deferred; legacy `tbl_routers`/`nas` are **empty** in the dump, so NAS/router config is created fresh in v3.0 (one dev NAS seeded for FreeRADIUS). GB balances start at **0**; admin seeded with a configurable opening GB pool so it can allocate downward.

---

## 9. Database bridge design (legacy → v3.0)

Two MariaDB schemas inside one server, two Laravel connections:

- **`airlink`** (connection `mysql`, default) — the clean v3.0 schema built by migrations (§4). All new code targets only this.
- **`airlink_legacy`** (connection `legacy`, read-only) — the raw `nalrd_backup.sql` loaded verbatim at container init.

The standard **FreeRADIUS tables live in `airlink`** (`radcheck`, `radreply`, `radacct`, `nas`, `radgroupcheck`, `radgroupreply`, `radusergroup`) so FreeRADIUS and the app share one DB, exactly as v2.0. `radcheck`/`radreply` rows for still-live users are **copied** from legacy during ETL; `radacct` starts empty (fresh accounting).

```
nalrd_backup.sql ──load──► airlink_legacy (untouched, read-only)
                                  │
                    php artisan legacy:import  (ETL, idempotent)
                                  ▼
      airlink:  users · internet_plans · vouchers · batches
                wallet_transactions · gb_transactions · nas_devices
                radcheck · radreply · radacct(empty) · nas   ◄── FreeRADIUS reads here
```

Every migrated new-schema row keeps a `legacy_id` (and `legacy_username` where useful) column so the import is **idempotent** (re-runnable) and auditable back to source.

---

## 10. ETL mapping (legacy table → v3.0)

### A. Direct/reference tables

| Legacy | → v3.0 | Notes |
|---|---|---|
| `tbl_bandwidth` | folded into `internet_plans.bandwidth` | legacy plans FK `id_bw`; rendered as `"<down>/<up>"` (e.g. `10M/10M`). |
| `tbl_plans` | `internet_plans` | `name_plan`→`name`; derive `plan_type` from `typebp`/`limit_type` (`Unlimited`→unlimited, `Data_Limit`→data, `Time_Limit`→time, `Both_Limit`→data+time_limit); `data_limit`/`data_unit`/`data_usage_gb`→`data_gb`; `time_limit`+`time_unit`→minutes; `validity`+`validity_unit`→`validity_days`; `price`→`base_price` **and** `selling_price`. Keep `legacy_id`. |
| `tbl_users` | `users` (staff) | role per §8 map; `status` Active/Inactive→active/disabled. Passwords: legacy hashes are unknown format → set a temp password + `must_reset_password` flag (report lists affected accounts). |
| `wallet` | `users.wallet_balance` + opening `wallet_transactions` | match `wallet.username`→user; `available_balance`→`wallet_balance`; write a `type=load` opening-balance transaction for audit. `wallet.user_type` feeds role inference. |
| `walletCompany` | admin opening balance | seeds the admin's wallet + company-level opening transaction. |

### B. Vouchers & customers (operational core)

| Legacy | → v3.0 | Notes |
|---|---|---|
| `tbl_voucher` | `vouchers` | `code`→`code`; `user`→`username`; `id_plan`→`plan_id` (remap via `internet_plans.legacy_id`); `status`/`user_status`+`expired`→v3.0 status (`new`\|`sold`\|`active`\|`expired`\|`disabled`); `generated_by`→`owner_id` (match username→user); `batch`→`batches` row + `batch_id`; `data_gb`/`price` backfilled from plan. |
| `tbl_customers` | `vouchers.customer_username` + `radcheck` | end-users aren't first-class v3.0 accounts (roles are admin/reseller/seller only). A customer = a sold/active voucher's `customer_username` plus its FreeRADIUS credentials. |
| `radcheck`, `radreply` | copied to `airlink` (filtered) | only rows whose `username` maps to an imported voucher/customer → keeps live logins working while trimming size. |
| `radacct`, `radpostauth` | **not imported** | fresh accounting going forward (scope decision #3). |
| `tbl_transactions`, `tbl_user_recharges` | `wallet_transactions` (reference) | small; imported as historical recharge rows for report continuity. |
| `tbl_routers`, `nas` | — | empty in dump; not imported. One dev NAS seeded into `nas` + `nas_devices` for FreeRADIUS/MikroTik testing. |

### C. Hierarchy reconstruction & review report

1. Create the single **admin** from `tbl_users` Admin (or seed one if absent).
2. Sales staff / wallet holders → **reseller**, `parent_id` = admin.
3. Regular/POS staff → **seller**; `parent_id` guessed from `tbl_voucher.generated_by`/`generated_for` chains (who generated whose vouchers); fall back to first reseller.
4. Emit `storage/app/legacy-import-report.json` + a console table: every user with inferred role, chosen parent, confidence, and password-reset flag. **You review and fix `parent_id`/roles in the UI** (or re-run with an override CSV).

> Import command is `--dry-run` capable (prints the report without writing) and idempotent (safe to re-run; matches on `legacy_id`).

---

## 11. Docker Desktop stack

`docker-compose.yml` at repo root (Linux containers). Services:

| Service | Image / build | Ports | Role |
|---|---|---|---|
| `mariadb` | `mariadb:11` | 3306 | Both schemas; `docker/mariadb/initdb.d/` loads `nalrd_backup.sql` into `airlink_legacy` on first boot. Named volume for persistence. |
| `backend` | build `backend/` (php:8.3-fpm + nginx) | 8000 | Laravel 11 API (Sanctum). Entrypoint runs `migrate --force` then optional `legacy:import`. |
| `queue` | same image as backend | — | `php artisan queue:work` (exports, PNG cards, SMS). |
| `scheduler` | same image as backend | — | `php artisan schedule:work` (voucher expiry, radacct-driven status sync). |
| `frontend` | build `frontend/` (node build → nginx) | 5173 | React + Vite SPA; nginx proxies `/api` → backend in prod, Vite dev server in dev. |
| `freeradius` | `freeradius/freeradius-server:3.2` | 1812/udp, 1813/udp | `rlm_sql` (mysql) pointed at `airlink`; config mounted from `docker/freeradius/`. Reads `radcheck`/`radreply`, writes `radacct`. |
| `phpmyadmin` | `phpmyadmin` | 8080 | DB inspection. |

Bring-up order via `depends_on` + healthchecks: `mariadb` (healthy) → `backend` (migrate+import) → `freeradius`/`frontend`. Two compose profiles: `dev` (Vite HMR, code bind-mounts) and `prod` (built assets). Single command: `docker compose up -d --build`.

Layout additions:
```
Airlink 3.0/
├── docker-compose.yml
├── docker/
│   ├── mariadb/initdb.d/    # 01-create-schemas.sql, 02-legacy (symlink to nalrd_backup.sql)
│   ├── backend/             # Dockerfile, nginx.conf, entrypoint.sh
│   ├── frontend/            # Dockerfile, nginx.conf
│   └── freeradius/          # mods-available/sql, clients.conf, sites
└── backend/app/Console/Commands/LegacyImport.php
```

---

## 12. Execution roadmap

1. **Docker skeleton** — compose + Dockerfiles; MariaDB boots with legacy dump loaded into `airlink_legacy`; phpMyAdmin reachable.
2. **Backend foundation** — Sanctum, two DB connections, CORS, response envelope, base seeder (admin).
3. **Schema** — all §4 migrations (with `legacy_id` columns) + FreeRADIUS tables in `airlink`.
4. **ETL command** — `legacy:import` with `--dry-run`, report output, idempotency (§10). Verify counts + spot-check logins in `radcheck`.
5. **Auth & RBAC** → **Plans** → **Users/hierarchy** → **Wallet** → **GB** → **Vouchers+RADIUS** → **Reports/exports** → **Dashboards** (backend build order §5).
6. **FreeRADIUS wiring** — seed dev NAS, confirm Access-Request against an imported voucher returns Accept + writes `radacct`.
7. **Frontend** — per §6 and `FrontendSKILL.md`.
8. **Hardening** — scheduled expiry, refunds, login logs, tests, prod compose profile.

Milestones M1–M5 from §7 still apply; M0 = "Docker + legacy loaded + ETL green" is added in front.
