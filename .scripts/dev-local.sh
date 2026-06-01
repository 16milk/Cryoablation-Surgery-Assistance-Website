#!/usr/bin/env bash
set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND_PORT="${PORT:-5100}"

# Install server deps if needed
if [ ! -d "$ROOT/server/node_modules" ]; then
  echo "Installing server dependencies..."
  (cd "$ROOT/server" && yarn install)
fi

echo "Starting MedView local dev (SQLite server + frontend)..."
echo "  Backend:  http://localhost:${BACKEND_PORT}"
echo "  Frontend: http://localhost:3000"
echo ""

# Free the backend port so reruns don't hit EADDRINUSE from a leftover process.
if lsof -ti ":${BACKEND_PORT}" >/dev/null 2>&1; then
  echo "Stopping existing process on port ${BACKEND_PORT}..."
  lsof -ti ":${BACKEND_PORT}" | xargs kill -9 2>/dev/null || true
  sleep 0.5
fi

mkdir -p "$ROOT/server/data"

(
  while true; do
    echo "[dev-local] starting backend (node index.js) at $(date)"
    (cd "$ROOT/server" && PORT="${BACKEND_PORT}" node index.js) || true
    EXIT_CODE=$?
    # Don't spin forever if the port is still taken — user needs to free it manually.
    if lsof -ti ":${BACKEND_PORT}" >/dev/null 2>&1; then
      echo "[dev-local] port ${BACKEND_PORT} still in use; not restarting backend."
      break
    fi
    echo "[dev-local] backend exited (code ${EXIT_CODE}). Restarting in 1s..."
    sleep 1
  done
) &
SERVER_LOOP_PID=$!

# Optionally start the MedSAM2 inference service (lung-ct-compare segmentation).
MEDSAM2_LOOP_PID=""
MEDSAM2_DIR="$ROOT/medsam2_server"
if [ -x "$MEDSAM2_DIR/.venv/bin/python" ]; then
  echo "  MedSAM2:  http://localhost:5200 (starting)"
  (
    while true; do
      echo "[dev-local] starting MedSAM2 service at $(date)"
      (cd "$MEDSAM2_DIR" && ./.venv/bin/python app.py)
      echo "[dev-local] MedSAM2 exited (code $?). Restarting in 2s..."
      sleep 2
    done
  ) &
  MEDSAM2_LOOP_PID=$!
else
  echo "  MedSAM2:  disabled (no medsam2_server/.venv — see medsam2_server/README.md)"
fi

cleanup() {
  kill "$SERVER_LOOP_PID" 2>/dev/null || true
  [ -n "$MEDSAM2_LOOP_PID" ] && kill "$MEDSAM2_LOOP_PID" 2>/dev/null || true
  pkill -f "$ROOT/server/index.js" 2>/dev/null || true
  [ -n "$MEDSAM2_LOOP_PID" ] && pkill -f "$MEDSAM2_DIR/app.py" 2>/dev/null || true
  lsof -ti ":${BACKEND_PORT}" 2>/dev/null | xargs kill -9 2>/dev/null || true
}
trap cleanup EXIT INT TERM

# Use webpack dev server (not rsbuild/rspack) — rspack can panic on polyseg-wasm.
cd "$ROOT/platform/app"
cross-env APP_CONFIG=config/local_sqlite.js yarn run dev
