# run-visual-test.ps1
# Visual companion test — cycles through all 4 panda stages.
# After each stage, hard-refresh browser (Ctrl+Shift+R) to see the panda.

$ErrorActionPreference = 'Stop'
Set-Location "C:\Users\openclaw-user\Projects\vibe\backend"

Write-Host "=== Step 1: Inspect current state ===" -ForegroundColor Cyan
node scripts/inspect-companion-state.cjs
Write-Host ""
Write-Host ">>> Paste this output back to the assistant if anything looks off." -ForegroundColor Yellow
Write-Host ""

Read-Host "Press Enter to continue to Stage 0 (Baby)..."

Write-Host "`n=== Step 2: Baby panda (Stage 0, 20% growth) ===" -ForegroundColor Cyan
$env:TARGET_STAGE="0"; $env:TARGET_GROWTH="20"; $env:TARGET_PCT="10"
node scripts/bump-companion-progress.cjs
Write-Host ""
Write-Host ">>> Hard-refresh browser (Ctrl+Shift+R) and confirm baby panda is visible." -ForegroundColor Yellow
Read-Host "Press Enter to continue to Stage 1 (Teen)..."

Write-Host "`n=== Step 3: Teen panda (Stage 1, 60% growth) ===" -ForegroundColor Cyan
$env:TARGET_STAGE="1"; $env:TARGET_GROWTH="60"; $env:TARGET_PCT="50"
node scripts/bump-companion-progress.cjs
Write-Host ""
Write-Host ">>> Refresh browser — confirm teen panda." -ForegroundColor Yellow
Read-Host "Press Enter to continue to Stage 2 (Sub-adult)..."

Write-Host "`n=== Step 4: Sub-adult panda (Stage 2, 90% growth) ===" -ForegroundColor Cyan
$env:TARGET_STAGE="2"; $env:TARGET_GROWTH="90"; $env:TARGET_PCT="80"
node scripts/bump-companion-progress.cjs
Write-Host ""
Write-Host ">>> Refresh browser — confirm sub-adult panda." -ForegroundColor Yellow
Read-Host "Press Enter to continue to Stage 3 (Adult)..."

Write-Host "`n=== Step 5: Adult panda (Stage 3, 100% growth) ===" -ForegroundColor Cyan
Remove-Item Env:\TARGET_STAGE -ErrorAction SilentlyContinue
Remove-Item Env:\TARGET_GROWTH -ErrorAction SilentlyContinue
Remove-Item Env:\TARGET_PCT -ErrorAction SilentlyContinue
node scripts/bump-companion-progress.cjs
Write-Host ""
Write-Host ">>> Refresh browser — final adult panda. ALL DONE." -ForegroundColor Green
Read-Host "Press Enter to exit"