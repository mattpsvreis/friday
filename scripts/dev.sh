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
