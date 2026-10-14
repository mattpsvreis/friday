# Friday runtime reference

These files are not in the repo yet. Create them only when the user asks for local startup. Follow this contract so the two boot scripts stay the same program.

## compose.yaml

Place it at the repo root. Compose project directory is the repo root, so `docker compose` works without `-f`.

```yaml
name: friday

services:
  postgres:
    image: postgres:18
    restart: unless-stopped
    env_file:
      - path: .env
        required: true
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    ports:
      - "5432:5432"
    volumes:
      - friday-postgres:/var/lib/postgresql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U $$POSTGRES_USER -d $$POSTGRES_DB"]
      interval: 5s
      timeout: 5s
      retries: 10

volumes:
  friday-postgres:
```

Notes:

- Project name `friday` keeps the volume and network from colliding with other Compose projects.
- `env_file.required: true` fails fast when `.env` is missing. Do not fall back to inline passwords.
- `$$POSTGRES_USER` and `$$POSTGRES_DB` are Compose escaping so the shell inside the container expands the real values.
- The Postgres 18 image stores data under `/var/lib/postgresql/18/docker` and declares its volume at `/var/lib/postgresql`. Mount the named volume there. Mounting `/var/lib/postgresql/data` does not persist on this major version.
- Do not add a finance schema, init SQL, or seed data to this file.
- Change the image major only by editing `image`. Keep the tag explicit.

## Env file

`.env` stays gitignored. Expected keys when startup is implemented:

```
POSTGRES_USER=
POSTGRES_PASSWORD=
POSTGRES_DB=
```

`DATABASE_URL` is for the Next.js app later, not for the Postgres image. Omit it until the app is connected. Never echo `.env` from the boot scripts.

## scripts/dev.sh

```sh
#!/usr/bin/env sh
set -eu
cd "$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"

if ! command -v docker >/dev/null 2>&1 || ! docker info >/dev/null 2>&1; then
  echo "Docker is not running." >&2
  exit 1
fi
if ! command -v pnpm >/dev/null 2>&1; then
  echo "pnpm is not installed." >&2
  exit 1
fi
if [ ! -d node_modules ]; then
  echo "Dependencies are missing. Run pnpm install." >&2
  exit 1
fi

docker compose up -d --wait
echo "Postgres is up. Starting Next.js."
pnpm dev
echo "Next.js stopped. Postgres is still running. Stop it with: docker compose stop"
```

Use `sh`, not bash-only syntax. After creating the file, it needs the executable bit on Unix (`chmod +x scripts/dev.sh`). Windows does not.

## scripts/dev.bat

```bat
@echo off
setlocal
cd /d "%~dp0\.."

docker info >nul 2>&1
if errorlevel 1 (
  echo Docker is not running. 1>&2
  exit /b 1
)
where pnpm >nul 2>&1
if errorlevel 1 (
  echo pnpm is not installed. 1>&2
  exit /b 1
)
if not exist node_modules\ (
  echo Dependencies are missing. Run pnpm install. 1>&2
  exit /b 1
)

docker compose up -d --wait
if errorlevel 1 exit /b 1
echo Postgres is up. Starting Next.js.
pnpm dev
echo Next.js stopped. Postgres is still running. Stop it with: docker compose stop
```

`cd /d "%~dp0\.."` is what makes a double-click start from the repo root. Keep the checks and the Compose command in the same order as `scripts/dev.sh`.

## Commands after the files exist

| Intent | Command |
| --- | --- |
| Boot database and app | `scripts/dev.bat` or `scripts/dev.sh` |
| Boot database only | `docker compose up -d --wait` |
| Stop database, keep data | `docker compose stop` |
| Stop database and delete data | `docker compose down -v` — only when the user explicitly wants the volume removed |

App-only work that does not need Postgres can still use `pnpm dev`. Once the app depends on the database, prefer the boot script so the database is not forgotten.

## Out of scope until the user designs it

Personal-finance behavior, tables, migrations, seed transactions, authentication, and how malleable user-defined categories or accounts should work. Record those decisions in a new skill or an added section of this reference after that discussion. Do not preview them here.
