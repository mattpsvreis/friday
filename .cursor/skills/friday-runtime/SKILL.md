---
name: friday-runtime
description: >-
  Defines Friday's local runtime: Docker Compose for Postgres, and one-click
  boot scripts that start the database and the Next.js app. Use when adding
  or changing Docker Compose, Postgres, database env vars, scripts/dev.sh,
  scripts/dev.bat, or when the user wants to boot the whole app. Also use
  when the user mentions the personal finance manager, so finance architecture
  stays undecided until they design it.
---

# Friday local runtime

Friday is a personal finance manager. Domain and UI rules live in the `friday-architecture` skill. Do not invent parallel boot paths or host-installed Postgres.

What this skill covers is how the machine starts.

## One boot path

Everyday local startup is one command. It brings up every component that exists, including the Docker Compose Postgres instance and the Next.js dev server.

| Machine | Command |
| --- | --- |
| Windows | `scripts/dev.bat` |
| macOS / Linux | `scripts/dev.sh` |

The user works on Windows. `scripts/dev.bat` is the one-click button there (run it from the repo root, or double-click it). `scripts/dev.sh` runs the same sequence.

Both boot scripts exist at `scripts/dev.bat` and `scripts/dev.sh`. Keep them equivalent. When another component is added later, extend both files. Do not add a second boot path.

Development Postgres runs only through Docker Compose. Do not use a host-installed Postgres, a cloud database, or `npm run dev`.

## What the boot scripts do

1. Change to the repo root, derived from the script's own path, so the current directory does not matter.
2. Exit with a short message if `docker` is missing or the Docker daemon is unreachable.
3. Exit with a short message if `pnpm` is missing. Do not auto-install pnpm or Node.
4. From the repo root, start the database and wait until it is healthy: `docker compose up -d --wait`.
5. Start the app with `pnpm dev` in the foreground.
6. On exit, leave Compose running. Print that Postgres is still up. Stopping it is explicit: `docker compose stop` from the repo root. Ctrl+C in the boot script must not remove the volume or run `docker compose down`.

`pnpm install` is not part of boot. If `node_modules` is missing, tell the user to run `pnpm install` and exit.

## Compose file

When implementing startup, add `compose.yaml` at the repo root. One service, named `postgres`. Pin an official major image tag. The default tag is `postgres:18`. Do not use `latest`. Persist data in a named volume mounted at `/var/lib/postgresql` (the Postgres 18 image path, not `/var/lib/postgresql/data`). Publish host port `5432` only so the app on the host can connect.

Required environment for the database container, supplied by Compose from a gitignored env file (do not commit values):

| Variable | Purpose |
| --- | --- |
| `POSTGRES_USER` | Database role |
| `POSTGRES_PASSWORD` | Role password |
| `POSTGRES_DB` | Database name |

The Next.js process does not read those three names. It reads a single `DATABASE_URL` that points at `127.0.0.1:5432` with the same user, password, and database. Do not hard-code a connection string in source.

`.env*` is gitignored. Boot scripts may pass an env file to Compose. They must not print secret values. A committed example file is allowed only when the user asks for one, and it must contain placeholders.

## Adding a component later

A new local component (another Compose service, a worker process) is started from `scripts/dev.sh` and `scripts/dev.bat`. Update the `friday-runtime` reference when the boot sequence changes. Do not invent the finance architecture as part of that edit.

## Further detail

See [reference.md](reference.md) for the Compose and script contract.
