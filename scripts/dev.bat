@echo off
setlocal EnableExtensions
cd /d "%~dp0\.."

docker info >nul 2>&1
if errorlevel 1 (
  echo.
  echo ERROR: Docker is not running. Start Docker Desktop and try again. 1>&2
  echo.
  pause
  exit /b 1
)

where pnpm >nul 2>&1
if errorlevel 1 (
  echo.
  echo ERROR: pnpm is not installed. Install pnpm, then run pnpm install. 1>&2
  echo.
  pause
  exit /b 1
)

if not exist node_modules\ (
  echo.
  echo ERROR: Dependencies are missing. Run pnpm install from the repo root. 1>&2
  echo.
  pause
  exit /b 1
)

if not exist .env (
  echo.
  echo ERROR: .env is missing. Copy .env.example to .env and fill in the values. 1>&2
  echo.
  pause
  exit /b 1
)

REM Skip compose up when postgres is already healthy.
set "PG_READY="
for /f "delims=" %%S in ('docker compose ps postgres --format "{{.Status}}" 2^>nul') do (
  echo %%S | findstr /i "healthy" >nul && set "PG_READY=1"
)

if defined PG_READY (
  echo Postgres is already up.
) else (
  echo Starting Postgres...
  docker compose up -d --wait
  if errorlevel 1 (
    echo.
    echo ERROR: Failed to start Postgres. Check Docker and .env, then try again. 1>&2
    echo.
    pause
    exit /b 1
  )
  echo Postgres is up.
)

echo Starting Next.js. Opening http://localhost:3000 ...
start "" /b cmd /c "timeout /t 4 /nobreak >nul & start http://localhost:3000/"

pnpm dev

echo.
echo Next.js stopped. Postgres is still running. Stop it with: docker compose stop
exit /b 0
