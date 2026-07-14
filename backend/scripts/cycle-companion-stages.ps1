# cycle-companion-stages.ps1
# Cycles the companion through all 6 stages so you can see each one visually.
# After each stage, hard-refresh browser (Ctrl+F5) to confirm.
#
# Real stage thresholds (CompanionService._computeStage):
#   stage 0: p <  17%  → Baby 🥚
#   stage 1: p >= 17%  → Toddler 🐣
#   stage 2: p >= 33%  → Child 🌱
#   stage 3: p >= 50%  → Teen 🌿
#   stage 4: p >= 67%  → Young Adult 🌸
#   stage 5: p >= 83%  → Adult ⭐

$ErrorActionPreference = 'Stop'
Set-Location "C:\Users\openclaw-user\Projects\vibe"

function Set-CompanionStage($pct, $label) {
  Write-Host "`n=== $label (percentCompleted=$pct%) ===" -ForegroundColor Cyan
  $env:TARGET_PCT = "$pct"
  node scripts/bump-companion-progress.cjs
  Write-Host "`n>>> Hard-refresh browser (Ctrl+F5) to see $label" -ForegroundColor Yellow
  Read-Host "Press Enter when done → next stage (or Ctrl+C to stop)"
}

Set-CompanionStage  5  "Stage 0 — Baby 🥚"
Set-CompanionStage 20  "Stage 1 — Toddler 🐣"
Set-CompanionStage 40  "Stage 2 — Child 🌱"
Set-CompanionStage 55  "Stage 3 — Teen 🌿"
Set-CompanionStage 70  "Stage 4 — Young Adult 🌸"
Set-CompanionStage 85  "Stage 5 — Adult ⭐"
Set-CompanionStage 100 "Stage 5 — Adult ⭐ (celebrating)"

Write-Host "`n=== All stages done! ===" -ForegroundColor Green