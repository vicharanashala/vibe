#!/usr/bin/env bash
# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
# ViBe Local Development Startup Script (macOS / Linux)
# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
# Usage:  bash run-all.sh
# Make executable once:  chmod +x run-all.sh  &&  ./run-all.sh

set -euo pipefail

# Resolve the directory this script lives in (project root)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo ""
echo "========================================"
echo "  ViBe Local Development Startup"
echo "========================================"
echo ""

# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
# STEP 1: Pre-flight â€” validate prerequisites
# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
echo "[PRE-FLIGHT] Checking prerequisites..."

check_command() {
  local cmd="$1"
  local install_hint="$2"
  if ! command -v "$cmd" &>/dev/null; then
    echo "[ERROR] '$cmd' is not installed or not in PATH."
    echo "        $install_hint"
    exit 1
  else
    echo "[OK]   $cmd found: $(command -v "$cmd")"
  fi
}

check_command "node"  "Install Node.js v22+ from https://nodejs.org"
check_command "pnpm"  "Install pnpm via: npm install -g pnpm"
check_command "java"  "Install Java 11+ from https://adoptium.net (required for Firebase emulator)"
check_command "firebase" "Install Firebase CLI via: npm install -g firebase-tools"

echo ""

# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
# STEP 2: Pre-flight â€” validate and bootstrap backend/.env
# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
BACKEND_ENV="$SCRIPT_DIR/backend/.env"
BACKEND_EXAMPLE_ENV="$SCRIPT_DIR/backend/.example.env"
BACKEND_FIREBASERC="$SCRIPT_DIR/backend/.firebaserc"

# 2a. Bootstrap .env from example if it doesn't exist
if [ ! -f "$BACKEND_ENV" ]; then
  if [ -f "$BACKEND_EXAMPLE_ENV" ]; then
    echo "[PRE-FLIGHT] backend/.env not found. Creating from .example.env ..."
    cp "$BACKEND_EXAMPLE_ENV" "$BACKEND_ENV"
    echo "[OK]   backend/.env created."
  else
    echo "[ERROR] backend/.env and backend/.example.env both missing."
    echo "        Please create backend/.env manually."
    exit 1
  fi
fi

# 2b. Detect emulator project ID from backend/.firebaserc
EMULATOR_PROJECT_ID=""
if [ -f "$BACKEND_FIREBASERC" ]; then
  # Extract the "default" project using basic shell parsing (no jq required)
  EMULATOR_PROJECT_ID=$(grep -o '"default": *"[^"]*"' "$BACKEND_FIREBASERC" | sed 's/"default": *"\([^"]*\)"/\1/')
fi

# 2c. Auto-fix Firebase project ID mismatch
# FIX (Issue 3): The emulator project in .firebaserc must match FIREBASE_PROJECT_ID in .env.
if [ -n "$EMULATOR_PROJECT_ID" ]; then
  CURRENT_PROJECT_ID=$(grep "^FIREBASE_PROJECT_ID=" "$BACKEND_ENV" | sed 's/FIREBASE_PROJECT_ID=//' | tr -d '"' | tr -d '\r' || true)

  if [ -n "$CURRENT_PROJECT_ID" ] && [ "$CURRENT_PROJECT_ID" != "$EMULATOR_PROJECT_ID" ]; then
    echo "[WARN] Firebase Project ID mismatch:"
    echo "       backend/.env            -> FIREBASE_PROJECT_ID=$CURRENT_PROJECT_ID"
    echo "       backend/.firebaserc      -> project=$EMULATOR_PROJECT_ID"
    echo "[FIX]  Auto-correcting backend/.env ..."

    # Use sed to replace the values in-place (macOS requires '' after -i)
    if [[ "$(uname)" == "Darwin" ]]; then
      sed -i '' "s|^FIREBASE_PROJECT_ID=.*|FIREBASE_PROJECT_ID=$EMULATOR_PROJECT_ID|" "$BACKEND_ENV"
      sed -i '' "s|^GCLOUD_PROJECT=.*|GCLOUD_PROJECT=\"$EMULATOR_PROJECT_ID\"|" "$BACKEND_ENV"
      sed -i '' "s|^FIREBASE_CLIENT_EMAIL=firebase-adminsdk-fbsvc@.*|FIREBASE_CLIENT_EMAIL=firebase-adminsdk-fbsvc@$EMULATOR_PROJECT_ID.iam.gserviceaccount.com|" "$BACKEND_ENV"
    else
      sed -i "s|^FIREBASE_PROJECT_ID=.*|FIREBASE_PROJECT_ID=$EMULATOR_PROJECT_ID|" "$BACKEND_ENV"
      sed -i "s|^GCLOUD_PROJECT=.*|GCLOUD_PROJECT=\"$EMULATOR_PROJECT_ID\"|" "$BACKEND_ENV"
      sed -i "s|^FIREBASE_CLIENT_EMAIL=firebase-adminsdk-fbsvc@.*|FIREBASE_CLIENT_EMAIL=firebase-adminsdk-fbsvc@$EMULATOR_PROJECT_ID.iam.gserviceaccount.com|" "$BACKEND_ENV"
    fi
    echo "[OK]   backend/.env updated. Firebase project IDs are now aligned."
  else
    echo "[OK]   Firebase project ID is consistent ($EMULATOR_PROJECT_ID)."
  fi
fi

# 2d. Ensure FIREBASE_AUTH_EMULATOR_HOST is set
# FIX (Issue 2): Without this the login endpoint calls the real Firebase API instead of the emulator.
if ! grep -q "^FIREBASE_AUTH_EMULATOR_HOST" "$BACKEND_ENV"; then
  echo "[WARN] FIREBASE_AUTH_EMULATOR_HOST not set in backend/.env."
  echo "[FIX]  Adding FIREBASE_AUTH_EMULATOR_HOST=\"127.0.0.1:9099\" ..."
  echo 'FIREBASE_AUTH_EMULATOR_HOST="127.0.0.1:9099"' >> "$BACKEND_ENV"
  echo "[OK]   FIREBASE_AUTH_EMULATOR_HOST added."
else
  echo "[OK]   FIREBASE_AUTH_EMULATOR_HOST is configured."
fi

echo ""
echo "[PRE-FLIGHT] All checks passed."
echo ""

# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
# STEP 3: Install workspace dependencies
# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
echo "[DEPS] Installing workspace dependencies..."
cd "$SCRIPT_DIR"
pnpm install
echo ""

# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
# STEP 4: Launch all services
# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
echo "[START] Launching all services..."
echo ""
echo "  Backend API   ->  http://localhost:3141"
echo "  Frontend      ->  http://localhost:5173"
echo "  API Docs      ->  http://localhost:3141/reference"
echo ""
echo "  Press Ctrl+C to stop all services."
echo ""

pnpm run vibe start
