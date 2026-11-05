#!/usr/bin/env bash
# Start the local ViBe stack used by v3 development:
#   - Firebase Auth emulator  (127.0.0.1:9099, project demo-vibe)
#   - ViBe backend            (localhost:4001, built from ../../../backend, code untouched)
# Database settings and the throwaway emulator key are read from ~/.config/vibe-v3/.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
BACKEND="$(cd "$HERE/../../../backend" && pwd)"
CONFIG="${VIBE_V3_CONFIG:-$HOME/.config/vibe-v3}"

for f in atlas.env firebase-emulator.env; do
  [[ -f "$CONFIG/$f" ]] || { echo "Missing $CONFIG/$f — see tools/local-api/README.md" >&2; exit 1; }
done
grep -q '^DB_NAME=vibe_v3_local' "$CONFIG/atlas.env" || { echo "Refusing to start: DB_NAME must be vibe_v3_local*" >&2; exit 1; }

cleanup() { kill 0 2>/dev/null || true; }
trap cleanup EXIT INT TERM

(cd "$HERE" && mkdir -p .emulator-data && npx --yes firebase-tools@latest emulators:start --only auth --project demo-vibe --import .emulator-data --export-on-exit) &

if [[ ! -d "$BACKEND/node_modules" ]]; then
  (cd "$BACKEND/.." && pnpm install --frozen-lockfile --filter ./backend)
fi
(cd "$BACKEND" && ./node_modules/.bin/tsc)

until curl -sf http://127.0.0.1:9099/ >/dev/null; do sleep 1; done
# The emulator only saves accounts on a clean exit; rebuild any missing logins from the DB.
node "$HERE/restore-emulator-accounts.mjs" || echo "warning: could not restore emulator accounts" >&2
(
  cd "$BACKEND"
  set -a
  . "$HERE/backend.env"
  . "$CONFIG/atlas.env"
  . "$CONFIG/firebase-emulator.env"
  set +a
  exec node build/index.js
) &

until curl -sf http://localhost:4001/health >/dev/null; do sleep 1; done
echo
echo "Local stack ready: backend http://localhost:4001  ·  auth emulator http://127.0.0.1:9099"
echo "Seed sample data with: node tools/local-api/seed.mjs"
wait
