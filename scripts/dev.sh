#!/usr/bin/env bash
#
# One command to bring up the whole local dev stack:
#   Postgres + Redis (Docker)  ->  DB migrations  ->  backend API  ->  Expo on the iOS simulator
#
# Run with:  make dev
# Stop with: Ctrl-C  (shuts down the API this script started; leaves Postgres/Redis up
#                     so you don't re-pull/re-init every time — use `make down` to stop them).
#
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

API_HOST=0.0.0.0
API_PORT=8000
API_HEALTH="http://localhost:${API_PORT}/health"
PG_CONTAINER=rr-postgres
API_PID=""

log() { printf '\n\033[1;36m▸ %s\033[0m\n' "$*"; }

cleanup() {
  # Only stop the API if THIS script started it (otherwise we're reusing a backend
  # someone else launched, and shouldn't kill it).
  [ -n "$API_PID" ] || return 0
  log "Stopping backend API"
  kill "$API_PID" 2>/dev/null || true                 # stops uvicorn (and its --reload supervisor)
  local stragglers
  stragglers="$(lsof -ti tcp:"$API_PORT" 2>/dev/null || true)"
  [ -n "$stragglers" ] && kill $stragglers 2>/dev/null || true
}
trap cleanup EXIT
trap 'exit 130' INT TERM

# 1. Docker must be running. (We hit a "Docker engine stopped" state before — nudge it.)
if ! docker info >/dev/null 2>&1; then
  log "Docker isn't running — launching Docker Desktop"
  open -a Docker 2>/dev/null || { echo "Could not start Docker Desktop. Start it manually, then re-run 'make dev'."; exit 1; }
  printf "   waiting for the Docker engine"
  for _ in $(seq 1 60); do
    docker info >/dev/null 2>&1 && { echo " ready."; break; }
    printf "."; sleep 2
  done
  docker info >/dev/null 2>&1 || { echo; echo "Docker engine didn't come up. Open Docker Desktop, wait for 'Engine running', then re-run 'make dev'."; exit 1; }
fi

# 2. Data services (idempotent — a no-op if already up).
log "Starting Postgres + Redis"
docker compose up -d postgres redis

# 3. Wait for Postgres to accept connections, then apply migrations.
log "Waiting for Postgres"
printf "   "
until docker exec "$PG_CONTAINER" pg_isready -U postgres -d restaurant_recommender >/dev/null 2>&1; do
  printf "."; sleep 1
done
echo " ready."
log "Applying migrations"
( cd backend && uv run alembic upgrade head )

# 4. Backend API — reuse if one is already healthy, otherwise start it in the background.
if curl -fsS "$API_HEALTH" >/dev/null 2>&1; then
  log "Backend already healthy on :${API_PORT} — reusing it"
else
  log "Starting backend API on :${API_PORT}  (logs -> backend/uvicorn.log)"
  ( cd backend && exec uv run uvicorn app.main:app --host "$API_HOST" --port "$API_PORT" --reload ) \
    >backend/uvicorn.log 2>&1 &
  API_PID=$!
  printf "   waiting for the API"
  for _ in $(seq 1 30); do
    curl -fsS "$API_HEALTH" >/dev/null 2>&1 && { echo " ready."; break; }
    printf "."; sleep 1
  done
  curl -fsS "$API_HEALTH" >/dev/null 2>&1 || { echo; echo "Backend didn't become healthy — see backend/uvicorn.log"; exit 1; }
fi

# 5. Expo on the iOS simulator (foreground — this is what you interact with).
#    expo auto-boots a simulator if none is running. Ctrl-C here ends the session.
log "Starting Expo on the iOS simulator  (Ctrl-C to stop everything)"
cd mobile
npx expo start --ios
