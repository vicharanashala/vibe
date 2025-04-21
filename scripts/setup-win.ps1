# PowerShell Setup Script for Windows
$ErrorActionPreference = "Stop"

Write-Host "🚀 ViBe Setup Script (Windows)"

$STATE_FILE = ".vibe.json"

function Clone-Repo {
    Write-Host "📦 Cloning ViBe repository..."
    git clone https://github.com/continuousactivelearning/vibe.git
  }
  
  function Check-Repo {
    if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
      Write-Host "Git is not installed. Installing Git..."
  
      if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
        Write-Error "winget is not available. Please install Git manually."
        exit 1
      }
  
      winget install --id Git.Git -e --source winget
      Write-Host "✅ Git installed successfully."
    }
  
    $cwd = Get-Location
    if ($cwd.Path -like "*\vibe") {
      try {
        git rev-parse --is-inside-work-tree > $null
        Write-Host "✅ This is a Git repository."
      } catch {
        Write-Host "⚠️ Not a Git repository. Cloning..."
        Clone-Repo
        Set-Location "./vibe"
      }
    } else {
      Write-Host "📁 Not inside 'vibe' directory. Cloning..."
      Clone-Repo
      Set-Location "./vibe"
    }
  }

function Ensure-Node {
    if (!(Get-Command node -ErrorAction SilentlyContinue) -or !(Get-Command npm -ErrorAction SilentlyContinue)) {
        Write-Host "❌ Node.js is not installed."
        pnpm install -g n
        n latest
        $env:Path = "C:\Program Files\nodejs;" + $env:Path
        exit 1
    }

    $nodeVersion = node -v
    Write-Host "✅ Detected Node.js version: $nodeVersion"

    $majorVersion = ($nodeVersion -replace "[vV]", "").Split(".")[0]
    if ([int]$majorVersion -lt 22) {
        Write-Host "🔄 Node.js version too old (<22). Upgrading using 'n'..."
        pnpm install -g n
        n latest
        $env:Path = "C:\Program Files\nodejs;" + $env:Path
    }

    Write-Host "✅ Node.js version: $(node -v)"
    Write-Host "✅ npm version: $(npm -v)"
}

function Install-PNPM {
    if (!(Get-Command pnpm -ErrorAction SilentlyContinue)) {
        Write-Host "📦 Installing pnpm..."
        Invoke-WebRequest https://get.pnpm.io/install.ps1 -UseBasicParsing | Invoke-Expression
    }
    Write-Host "✅ pnpm version: $(pnpm -v)"
}

function Install-NodeDeps {
    if (!(Test-Path "node_modules")) {
        Write-Host "📦 Installing required Node.js dependencies..."
        pnpm install
    }
    # pnpm add -w commander concurrently @inquirer/prompts mongodb-memory-server firebase-tools
}

function Init-StateFile {
    if (!(Test-Path $STATE_FILE)) {
        "{}" | Out-File -Encoding UTF8 $STATE_FILE
        Write-Host "📄 Created $STATE_FILE"
    }
}

function Install-CLI {
    Write-Host "⚙ Installing CLI..."
    cd cli
    pnpm link --global
    cd ..
    Write-Host "✅ Vibe CLI installed and linked globally."
}

if ((Get-Location).Path -match '\\scripts$') {
    Set-Location ..
  }  

Check-Repo
Install-PNPM
Ensure-Node
Install-NodeDeps
Init-StateFile
Install-CLI
vibe setup
Write-Host "🎉 Setup complete! You can now use 'vibe start'"
