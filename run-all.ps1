# ─────────────────────────────────────────────────────────────────────────────
# ViBe Local Development Startup Script (Windows)
# ─────────────────────────────────────────────────────────────────────────────
# Usage: powershell -ExecutionPolicy Bypass -File .\run-all.ps1
#    or: ./run-all.ps1  (from within PowerShell)

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  ViBe Local Development Startup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# ─────────────────────────────────────────────────────────────────────────────
# STEP 1: Pre-flight — Check prerequisites
# ─────────────────────────────────────────────────────────────────────────────
Write-Host "[PRE-FLIGHT] Checking prerequisites..." -ForegroundColor Yellow

function Check-Command {
    param([string]$Cmd, [string]$InstallHint)
    $found = Get-Command $Cmd -ErrorAction SilentlyContinue
    if (-not $found) {
        Write-Host "[ERROR] '$Cmd' is not installed or not in PATH." -ForegroundColor Red
        Write-Host "        $InstallHint" -ForegroundColor Red
        exit 1
    } else {
        Write-Host "[OK]   $Cmd found: $($found.Source)" -ForegroundColor Green
    }
}

Check-Command "node"     "Install Node.js v22+ from https://nodejs.org"
Check-Command "pnpm"     "Install pnpm via: npm install -g pnpm"
Check-Command "java"     "Install Java 11+ from https://adoptium.net (required for Firebase emulator)"
Check-Command "firebase" "Install Firebase CLI via: npm install -g firebase-tools"

Write-Host ""

# ─────────────────────────────────────────────────────────────────────────────
# STEP 2: Pre-flight — Validate and bootstrap backend/.env
# ─────────────────────────────────────────────────────────────────────────────
Write-Host "[PRE-FLIGHT] Validating environment configuration..." -ForegroundColor Yellow

$backendEnvPath        = Join-Path $PSScriptRoot "backend\.env"
$backendExampleEnvPath = Join-Path $PSScriptRoot "backend\.example.env"
$backendFirebasercPath = Join-Path $PSScriptRoot "backend\.firebaserc"

# 2a. Bootstrap .env from .example.env if it doesn't exist
if (-not (Test-Path $backendEnvPath)) {
    if (Test-Path $backendExampleEnvPath) {
        Write-Host "[PRE-FLIGHT] backend/.env not found. Creating from .example.env ..." -ForegroundColor Yellow
        Copy-Item $backendExampleEnvPath $backendEnvPath
        Write-Host "[OK]   backend/.env created from .example.env." -ForegroundColor Green
    } else {
        Write-Host "[ERROR] backend/.env and backend/.example.env are both missing." -ForegroundColor Red
        Write-Host "        Please create backend/.env manually." -ForegroundColor Red
        exit 1
    }
}

# 2b. Detect emulator project ID from backend/.firebaserc
$emulatorProjectId = $null
if (Test-Path $backendFirebasercPath) {
    try {
        $firebasercContent = Get-Content $backendFirebasercPath -Raw | ConvertFrom-Json
        $emulatorProjectId = $firebasercContent.projects.default
    } catch {
        Write-Host "[WARN] Could not parse backend/.firebaserc. Skipping project ID check." -ForegroundColor DarkYellow
    }
}

# 2c. Auto-fix Firebase project ID mismatch
# FIX (Issue 3): The emulator project in .firebaserc must match FIREBASE_PROJECT_ID in .env.
# Without this, Firebase Admin SDK rejects emulator tokens causing signup to fail.
if ($emulatorProjectId) {
    $envContent = Get-Content $backendEnvPath -Raw

    $currentProjectId = ""
    if ($envContent -match "FIREBASE_PROJECT_ID=([^\r\n]+)") {
        $currentProjectId = $Matches[1].Trim().Trim('"')
    }

    if ($currentProjectId -ne "" -and $currentProjectId -ne $emulatorProjectId) {
        Write-Host "[WARN] Firebase Project ID mismatch:" -ForegroundColor Yellow
        Write-Host "       backend/.env            -> FIREBASE_PROJECT_ID=$currentProjectId" -ForegroundColor Yellow
        Write-Host "       backend/.firebaserc      -> project=$emulatorProjectId" -ForegroundColor Yellow
        Write-Host "[FIX]  Auto-correcting backend/.env ..." -ForegroundColor Cyan

        $envContent = $envContent -replace "FIREBASE_PROJECT_ID=[^\r\n]+", "FIREBASE_PROJECT_ID=$emulatorProjectId"
        $envContent = $envContent -replace 'GCLOUD_PROJECT="[^"]+"', ('GCLOUD_PROJECT="' + $emulatorProjectId + '"')
        $envContent = $envContent -replace "FIREBASE_CLIENT_EMAIL=firebase-adminsdk-fbsvc@[^@\s\r\n.]+\.[^\r\n]+",
                                           ("FIREBASE_CLIENT_EMAIL=firebase-adminsdk-fbsvc@" + $emulatorProjectId + ".iam.gserviceaccount.com")

        Set-Content -Path $backendEnvPath -Value $envContent -NoNewline
        Write-Host "[OK]   backend/.env updated. Firebase project IDs are now aligned." -ForegroundColor Green
    } else {
        Write-Host "[OK]   Firebase project ID is consistent ($emulatorProjectId)." -ForegroundColor Green
    }
}

# 2d. Ensure FIREBASE_AUTH_EMULATOR_HOST is set
# FIX (Issue 2): Without this, the login endpoint calls the real Firebase API
# instead of the local emulator, causing login to fail in dev.
$envContent = Get-Content $backendEnvPath -Raw
if ($envContent -notmatch "FIREBASE_AUTH_EMULATOR_HOST") {
    Write-Host "[WARN] FIREBASE_AUTH_EMULATOR_HOST not set in backend/.env." -ForegroundColor Yellow
    Write-Host "[FIX]  Adding FIREBASE_AUTH_EMULATOR_HOST=`"127.0.0.1:9099`" ..." -ForegroundColor Cyan
    Add-Content -Path $backendEnvPath -Value "`nFIREBASE_AUTH_EMULATOR_HOST=`"127.0.0.1:9099`""
    Write-Host "[OK]   FIREBASE_AUTH_EMULATOR_HOST added." -ForegroundColor Green
} else {
    Write-Host "[OK]   FIREBASE_AUTH_EMULATOR_HOST is configured." -ForegroundColor Green
}

Write-Host ""
Write-Host "[PRE-FLIGHT] All checks passed." -ForegroundColor Green
Write-Host ""

# ─────────────────────────────────────────────────────────────────────────────
# STEP 3: Install workspace dependencies
# ─────────────────────────────────────────────────────────────────────────────
Write-Host "[DEPS] Installing workspace dependencies..." -ForegroundColor Yellow
pnpm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Failed to install workspace dependencies." -ForegroundColor Red
    exit 1
}

Write-Host ""

# ─────────────────────────────────────────────────────────────────────────────
# STEP 4: Launch all services
# ─────────────────────────────────────────────────────────────────────────────
Write-Host "[START] Launching all services..." -ForegroundColor Green
Write-Host ""
Write-Host "  Backend API   ->  http://localhost:3141" -ForegroundColor Cyan
Write-Host "  Frontend      ->  http://localhost:5173" -ForegroundColor Cyan
Write-Host "  API Docs      ->  http://localhost:3141/reference" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Press Ctrl+C to stop all services." -ForegroundColor DarkGray
Write-Host ""

pnpm run vibe start
