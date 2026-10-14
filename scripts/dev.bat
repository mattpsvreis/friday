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
