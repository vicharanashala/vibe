# =============================================================================
# VIBE Local Development Environment Startup Script
# =============================================================================

# Define Root Path
$ProjectRoot = "L:\PROJECT\vicharanshala\vibe"

# Check if the project root exists before launching anything
if (-not (Test-Path $ProjectRoot)) {
    Write-Error "Project root not found at $ProjectRoot. Please check the path."
    exit 1
}

# -----------------------------------------------------------------------------
# STEP 0: Create the temporary local proxy file
# -----------------------------------------------------------------------------
Write-Host "Preparing Firebase Auth REST Emulator proxy..." -ForegroundColor Cyan
$LmsDbDir = Join-Path $ProjectRoot "lms_db"
if (-not (Test-Path $LmsDbDir)) {
    Write-Error "Local development database folder lms_db not found at $LmsDbDir."
    exit 1
}

$ProxyFile = Join-Path $LmsDbDir "firebase-auth-proxy.mjs"
$ProxyCode = @'
const orig = globalThis.fetch;

globalThis.fetch = (url, opts) => {
  if (
    typeof url === "string" &&
    url.includes("identitytoolkit.googleapis.com")
  ) {
    const host =
      process.env.FIREBASE_AUTH_EMULATOR_HOST || "127.0.0.1:9099";

    const newUrl = url.replace(
      "https://identitytoolkit.googleapis.com",
      `http://${host}/identitytoolkit.googleapis.com`
    );

    console.log(`[Proxy] Redirecting: ${url} -> ${newUrl}`);
    return orig(newUrl, opts);
  }

  return orig(url, opts);
};

console.log("[Proxy] Firebase Auth REST Emulator redirect loaded.");
'@

Set-Content -Path $ProxyFile -Value $ProxyCode -Force
Write-Host "Proxy script written to $ProxyFile" -ForegroundColor Gray

# -----------------------------------------------------------------------------
# WINDOW 1 — MongoDB
# -----------------------------------------------------------------------------
Write-Host "Starting MongoDB TLS Replica Set..." -ForegroundColor Green
$MongoScript = Join-Path $ProjectRoot "lms_db\start-mongod.ps1"
if (-not (Test-Path $MongoScript)) {
    Write-Warning "MongoDB startup script not found at $MongoScript"
} else {
    Start-Process powershell.exe -ArgumentList "-NoExit", "-Command", "`$Host.UI.RawUI.WindowTitle = 'MongoDB'; powershell -ExecutionPolicy Bypass -File '$MongoScript'"
}

# Poll MongoDB (Port 27018)
Write-Host "Waiting for MongoDB on port 27018..." -ForegroundColor Cyan
$MongoReady = $false
$Elapsed = 0
while (-not $MongoReady -and $Elapsed -lt 30) {
    if (Get-NetTCPConnection -LocalPort 27018 -ErrorAction SilentlyContinue) {
        $MongoReady = $true
    } else {
        Start-Sleep -Seconds 1
        $Elapsed += 1
    }
}
if (-not $MongoReady) {
    Write-Error "MongoDB did not start on port 27018 within 30 seconds."
    exit 1
} else {
    Write-Host "MongoDB is online." -ForegroundColor Green
}

# -----------------------------------------------------------------------------
# WINDOW 2 — Firebase Auth Emulator
# -----------------------------------------------------------------------------
Write-Host "Starting Firebase Auth Emulator..." -ForegroundColor Green
$Port9099 = Get-NetTCPConnection -LocalPort 9099 -ErrorAction SilentlyContinue
if ($Port9099) {
    Write-Host "[Info] Port 9099 is already in use. Firebase Auth Emulator is probably already running." -ForegroundColor Yellow
} else {
    $BackendDir = Join-Path $ProjectRoot "backend"
    if (-not (Test-Path $BackendDir)) {
        Write-Warning "Backend directory not found at $BackendDir"
    } else {
        Start-Process powershell.exe -ArgumentList "-NoExit", "-Command", "`$Host.UI.RawUI.WindowTitle = 'Firebase Emulator'; Set-Location '$BackendDir'; firebase emulators:start --only auth --project demo-test"
        
        # Poll Firebase Auth Emulator (Port 9099)
        Write-Host "Waiting for Firebase Auth Emulator on port 9099..." -ForegroundColor Cyan
        $FirebaseReady = $false
        $Elapsed = 0
        while (-not $FirebaseReady -and $Elapsed -lt 30) {
            if (Get-NetTCPConnection -LocalPort 9099 -ErrorAction SilentlyContinue) {
                $FirebaseReady = $true
            } else {
                Start-Sleep -Seconds 1
                $Elapsed += 1
            }
        }
        if (-not $FirebaseReady) {
            Write-Error "Firebase Auth Emulator did not start on port 9099 within 30 seconds."
            exit 1
        } else {
            Write-Host "Firebase Auth Emulator is online." -ForegroundColor Green
            Write-Host "Seeding demo accounts..." -ForegroundColor Cyan
            node (Join-Path $ProjectRoot "lms_db\seed-demo-accounts.mjs")
        }
    }
}

Start-Sleep -Seconds 2

# -----------------------------------------------------------------------------
# WINDOW 3 — Backend
# -----------------------------------------------------------------------------
Write-Host "Starting Backend dev server..." -ForegroundColor Green
$BackendDir = Join-Path $ProjectRoot "backend"
if (-not (Test-Path $BackendDir)) {
    Write-Warning "Backend directory not found at $BackendDir"
} else {
    # Convert proxy path to Node-compatible file URI
    $ProxyFileUri = "file:///" + ($ProxyFile -replace "\\", "/")
    $NodeOptions = "--unhandled-rejections=warn --import=$ProxyFileUri"
    
    Start-Process powershell.exe -ArgumentList "-NoExit", "-Command", "`$Host.UI.RawUI.WindowTitle = 'Backend'; Set-Location '$BackendDir'; `$env:NODE_EXTRA_CA_CERTS = '$ProjectRoot\lms_db\certs\ca.pem'; `$env:NODE_OPTIONS = '$NodeOptions'; pnpm run dev"
    
    # Poll Backend health endpoint
    Write-Host "Waiting for Backend health endpoint (http://localhost:3141/health)..." -ForegroundColor Cyan
    $BackendReady = $false
    $Elapsed = 0
    while (-not $BackendReady -and $Elapsed -lt 60) {
        try {
            $Res = Invoke-RestMethod -Uri "http://localhost:3141/health" -Method Get -TimeoutSec 2 -ErrorAction Stop
            if ($Res.status -eq "ok") {
                $BackendReady = $true
            }
        } catch {
            # Not ready yet
        }
        if (-not $BackendReady) {
            Start-Sleep -Seconds 2
            $Elapsed += 2
        }
    }
    if (-not $BackendReady) {
        Write-Error "Backend health check failed or timed out."
        exit 1
    } else {
        Write-Host "Backend is online and healthy." -ForegroundColor Green
    }
}

Start-Sleep -Seconds 2

# -----------------------------------------------------------------------------
# WINDOW 4 — Frontend
# -----------------------------------------------------------------------------
$StartFrontend = $true
$Port5173 = Get-NetTCPConnection -LocalPort 5173 -ErrorAction SilentlyContinue
if ($Port5173) {
    try {
        $Res = Invoke-WebRequest -Uri "http://localhost:5173" -Method Get -TimeoutSec 2 -UseBasicParsing -ErrorAction Stop
        if ($Res.StatusCode -eq 200) {
            Write-Host "[Info] Vite Frontend is already running on port 5173." -ForegroundColor Yellow
            $StartFrontend = $false
        } else {
            Write-Warning "Port 5173 is occupied by an unknown process (non-200 response). Cannot start Vite on this port (strictPort is required)."
            $StartFrontend = $false
        }
    } catch {
        Write-Warning "Port 5173 is occupied by an unknown process (no HTTP response). Cannot start Vite on this port (strictPort is required)."
        $StartFrontend = $false
    }
}

if ($StartFrontend) {
    Write-Host "Starting Frontend dev server..." -ForegroundColor Green
    $FrontendDir = Join-Path $ProjectRoot "frontend"
    if (-not (Test-Path $FrontendDir)) {
        Write-Warning "Frontend directory not found at $FrontendDir"
    } else {
        Start-Process powershell.exe -ArgumentList "-NoExit", "-Command", "`$Host.UI.RawUI.WindowTitle = 'Frontend'; Set-Location '$FrontendDir'; pnpm dev -- --port 5173 --strictPort"
    }
}

# Poll Frontend (Port 5173)
Write-Host "Waiting for Frontend to become ready at http://localhost:5173..." -ForegroundColor Cyan
$FrontendReady = $false
$Elapsed = 0
while (-not $FrontendReady -and $Elapsed -lt 60) {
    try {
        $Res = Invoke-WebRequest -Uri "http://localhost:5173" -Method Get -TimeoutSec 2 -UseBasicParsing -ErrorAction Stop
        if ($Res.StatusCode -eq 200) {
            $FrontendReady = $true
        }
    } catch {
        # Not ready yet
    }
    if (-not $FrontendReady) {
        Start-Sleep -Seconds 2
        $Elapsed += 2
    }
}

# -----------------------------------------------------------------------------
# FINAL STEP — Open Web App
# -----------------------------------------------------------------------------
if ($FrontendReady) {
    Write-Host "VIBE development environment is ready! Launching in browser..." -ForegroundColor Green
    Start-Process "http://localhost:5173"
} else {
    Write-Error "Frontend failed to become ready on http://localhost:5173 within 60 seconds."
}
