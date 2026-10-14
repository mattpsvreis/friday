---
name: friday-runtime
description: >-
  Friday local runtime: Docker Compose Postgres 18, .env DATABASE_URL,
  scripts/dev.bat and scripts/dev.sh one-click boot. Use when changing
  Compose, Postgres, env vars, boot scripts, or when the user wants to
  start the whole stack locally.
---

# Friday local runtime

Domain rules: `friday-architecture`. Toolchain: `friday-repo`.

## One boot path

| Machine | Command |
| --- | --- |
| Windows | `scripts/dev.bat` (from repo root or double-click) |
| macOS / Linux | `scripts/dev.sh` |

Keep both scripts equivalent. Do not add a second boot path. Do not use host-installed Postgres or cloud DB for local default.

## What the boot scripts do

1. `cd` to repo root from the script path.
2. Fail if Docker CLI/daemon missing.
3. Fail if `pnpm` missing (do not auto-install).
4. Fail if `node_modules` missing — tell user to run `pnpm install`.
5. `docker compose up -d --wait`.
6. Foreground `pnpm dev`.
7. On exit, leave Compose running; print `docker compose stop`. Ctrl+C must not `down -v`.

## Compose

- File: `compose.yaml` at repo root. Project name `friday`.
- Service: `postgres`, image **`postgres:18`** (never `latest`).
- Volume: named `friday-postgres` → `/var/lib/postgresql` (Postgres 18 path).
- Port: `5432:5432`.
- Env from gitignored `.env` (`POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`).

Next.js reads **`DATABASE_URL`** pointing at `127.0.0.1:5432` with the same credentials. Never hard-code secrets in source. Never echo `.env` from scripts.

## First-time DB schema

After Postgres is up: `pnpm db:push` (Drizzle).

## Further detail

See [reference.md](reference.md).
