# run-vibe-dev.ps1
# One-command startup for the local ViBe dev environment:
# Firebase Auth emulator + backend + seed data + frontend.
#
# Usage: right-click this file -> Run with PowerShell,
# OR from a terminal: powershell -ExecutionPolicy Bypass -File .\run-vibe-dev.ps1

$ErrorActionPreference = "Stop"

# Dynamically resolve project root relative to script location
$ProjectRoot = $PSScriptRoot
if (-not $ProjectRoot) {
    $ProjectRoot = Get-Location
}

$BackendDir  = Join-Path $ProjectRoot "backend"
$FrontendDir = Join-Path $ProjectRoot "frontend"

# Fast, non-blocking TCP port check using .NET TcpClient
function Test-PortOpen {
    param([int]$Port)
    $client = New-Object System.Net.Sockets.TcpClient
    try {
        $asyncResult = $client.BeginConnect("127.0.0.1", $Port, $null, $null)
        if ($asyncResult.AsyncWaitHandle.WaitOne(400, $false) -and $client.Connected) {
            return $true
        }
        return $false
    } catch {
        return $false
    } finally {
        $client.Close()
    }
}

# Robust wait loop with animated progress dots and configurable timeout
function Wait-ForPort {
    param(
        [int]$Port,
        [string]$ServiceName,
        [int]$TimeoutSeconds = 60
    )
    Write-Host "Waiting for $ServiceName to respond on port $Port " -NoNewline -ForegroundColor Yellow
    $startTime = Get-Date
    $lastDot = Get-Date
    
    while (((Get-Date) - $startTime).TotalSeconds -lt $TimeoutSeconds) {
        if (Test-PortOpen -Port $Port) {
            Write-Host ""
            Write-Host "[OK] $ServiceName is up on port $Port." -ForegroundColor Green
            return $true
        }
        
        # Print progress dot once per second
        if (((Get-Date) - $lastDot).TotalSeconds -ge 1) {
            Write-Host "." -NoNewline -ForegroundColor Yellow
            $lastDot = Get-Date
        }
        
        Start-Sleep -Milliseconds 250
    }
    
    Write-Host ""
    Write-Host "[WARN] $ServiceName did not respond on port $Port within ${TimeoutSeconds}s." -ForegroundColor Red
    Write-Host "       Please check the spawned '$ServiceName' window for any error messages." -ForegroundColor Red
    return $false
}

Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "   Starting ViBe Local Dev Environment        " -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan

# 1. Start Firebase Auth emulator in its own window, if not already running
if (Test-PortOpen -Port 9099) {
    Write-Host "[OK] Firebase Auth Emulator already running on port 9099." -ForegroundColor Green
} else {
    Write-Host "Starting Firebase Auth Emulator..." -ForegroundColor Yellow
    
    Start-Process powershell -WorkingDirectory $ProjectRoot -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-Command", "& { Write-Host '=============================================' -ForegroundColor Cyan; Write-Host '   FIREBASE EMULATOR PROCESS                ' -ForegroundColor Cyan; Write-Host '=============================================' -ForegroundColor Cyan; firebase emulators:start }"
    
    $isUp = Wait-ForPort -Port 9099 -ServiceName "Firebase Auth Emulator" -TimeoutSeconds 60
    if (-not $isUp) {
        Read-Host "Press Enter to attempt continuing anyway, or Ctrl+C to abort"
    }
}

# 2. Check MongoDB
if (Test-PortOpen -Port 27017) {
    Write-Host "[OK] MongoDB already running on port 27017." -ForegroundColor Green
} else {
    Write-Host "[WARN] MongoDB does not appear to be running on port 27017." -ForegroundColor Red
    Write-Host "       Start it however you normally do (service, or 'mongod'), then re-run this script."
    Read-Host "Press Enter once MongoDB is running to continue, or Ctrl+C to abort"
}

# 3. Start backend in its own window, if not already running
if (Test-PortOpen -Port 3141) {
    Write-Host "[OK] Backend already running on port 3141." -ForegroundColor Green
} else {
    Write-Host "Starting Backend (pnpm run dev)..." -ForegroundColor Yellow
    
    Start-Process powershell -WorkingDirectory $BackendDir -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-Command", "& { Write-Host '=============================================' -ForegroundColor Cyan; Write-Host '   BACKEND DEV SERVER (pnpm run dev)         ' -ForegroundColor Cyan; Write-Host '=============================================' -ForegroundColor Cyan; pnpm run dev }"
    
    $isUp = Wait-ForPort -Port 3141 -ServiceName "Backend Server" -TimeoutSeconds 90
    if (-not $isUp) {
        Read-Host "Press Enter to attempt continuing anyway, or Ctrl+C to abort"
    }
}

# 4. Seed test user + demo course (safe to re-run every time; emulator data doesn't persist)
Write-Host "Seeding test user..." -ForegroundColor Yellow
Push-Location $BackendDir
try {
    pnpm run seed:user

    Write-Host "Seeding demo course + study notes data..." -ForegroundColor Yellow
    $seedScript = Join-Path $BackendDir "build\modules\notes\scripts\seedStudyNotesDemo.js"
    if (-not (Test-Path $seedScript)) {
        Write-Host "Build output missing - running 'pnpm run build' first..." -ForegroundColor Yellow
        pnpm run build
    }
    node --env-file=.env $seedScript
} catch {
    Write-Host "[WARN] Seeding encountered an error: $_" -ForegroundColor Red
} finally {
    Pop-Location
}

# 5. Start frontend in its own window, if not already running
if (Test-PortOpen -Port 5173) {
    Write-Host "[OK] Frontend already running on port 5173." -ForegroundColor Green
} else {
    Write-Host "Starting Frontend (pnpm run dev)..." -ForegroundColor Yellow
    Start-Process powershell -WorkingDirectory $FrontendDir -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-Command", "& { Write-Host '=============================================' -ForegroundColor Cyan; Write-Host '   FRONTEND DEV SERVER (pnpm run dev)        ' -ForegroundColor Cyan; Write-Host '=============================================' -ForegroundColor Cyan; pnpm run dev }"
}

Write-Host "=============================================" -ForegroundColor Cyan
Write-Host " All services started." -ForegroundColor Green
Write-Host " Backend:  http://localhost:3141"
Write-Host " Frontend: http://localhost:5173"
Write-Host " Login:    test@example.com / Test@1234! (instructor)"
Write-Host "           student@example.com / Test@1234! (student)"
Write-Host "=============================================" -ForegroundColor Cyan
