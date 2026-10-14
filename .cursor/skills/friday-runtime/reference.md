# Friday runtime reference

Files live at the repo root / `scripts/`. Keep `dev.bat` and `dev.sh` behavior identical.

## compose.yaml

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

- `env_file.required: true` fails fast without `.env`.
- `$$POSTGRES_*` is Compose escaping for the healthcheck shell inside the container.
- Postgres 18 volume mount is `/var/lib/postgresql`, not `/var/lib/postgresql/data`.

## Env file (gitignored)

```
POSTGRES_USER=
POSTGRES_PASSWORD=
POSTGRES_DB=
DATABASE_URL=postgresql://USER:PASSWORD@127.0.0.1:5432/DB
```

`DATABASE_URL` must match the three `POSTGRES_*` values. Used by `db/index.ts` and `drizzle.config.ts`.

## Boot scripts

- `scripts/dev.sh` — POSIX `sh`; healthy-postgres skip; delayed browser open (`open` / `xdg-open`); `fail` waits on `/dev/tty`.
- `scripts/dev.bat` — `cd /d "%~dp0\.."`; same checks; `start http://localhost:3000/` after 4s; `:fail` + `pause`.

Order: Docker → pnpm → `node_modules` → `.env` → postgres (skip if healthy) → browser → `pnpm dev`.

Unix: keep `chmod +x scripts/dev.sh` when recreating the file.

## Everyday commands

| Intent | Command |
| --- | --- |
| Boot DB + app | `scripts/dev.bat` / `scripts/dev.sh` |
| DB only | `docker compose up -d --wait` |
| Stop DB, keep data | `docker compose stop` |
| Wipe DB volume | `docker compose down -v` (only when user asks) |
| Push schema | `pnpm db:push` |
| App only (DB already up) | `pnpm dev` |

## Related

Domain: `friday-architecture`. Toolchain: `friday-repo`.
