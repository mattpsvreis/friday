#!/usr/bin/env sh
set -eu
cd "$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"

fail() {
  echo "" >&2
  echo "ERROR: $1" >&2
  echo "" >&2
  printf %s "Press Enter to close..."
  # Prefer the controlling terminal when double-clicked / launched from a GUI.
  if [ -r /dev/tty ]; then
    read -r _ </dev/tty || true
  else
    read -r _ || true
  fi
  exit 1
}

open_browser() {
  url="$1"
  (
    sleep 4
    if command -v open >/dev/null 2>&1; then
      open "$url"
    elif command -v xdg-open >/dev/null 2>&1; then
      xdg-open "$url"
    elif command -v wslview >/dev/null 2>&1; then
      wslview "$url"
    fi
  ) >/dev/null 2>&1 &
}

if ! command -v docker >/dev/null 2>&1 || ! docker info >/dev/null 2>&1; then
  fail "Docker is not running. Start Docker Desktop and try again."
fi
if ! command -v pnpm >/dev/null 2>&1; then
  fail "pnpm is not installed. Install pnpm, then run pnpm install."
fi
if [ ! -d node_modules ]; then
  fail "Dependencies are missing. Run pnpm install from the repo root."
fi
if [ ! -f .env ]; then
  fail ".env is missing. Copy .env.example to .env and fill in the values."
fi

# Skip compose up when postgres is already healthy.
pg_status="$(docker compose ps postgres --format '{{.Status}}' 2>/dev/null || true)"
case "$pg_status" in
  *healthy* | *Healthy*)
    echo "Postgres is already up."
    ;;
  *)
    echo "Starting Postgres..."
    if ! docker compose up -d --wait; then
      fail "Failed to start Postgres. Check Docker and .env, then try again."
    fi
    echo "Postgres is up."
    ;;
esac

echo "Starting Next.js. Opening http://localhost:3000 ..."
open_browser "http://localhost:3000/"

# Ctrl+C / normal stop should not trip the failure pause.
set +e
pnpm dev
set -e

echo ""
echo "Next.js stopped. Postgres is still running. Stop it with: docker compose stop"
exit 0
