# Companion stage presets — copy/paste commands

## Step 1: Inspect current state (read-only)
```powershell
cd "C:\Users\openclaw-user\Projects\vibe\backend"
node scripts/inspect-companion-state.cjs
```
Paste the output back so I can verify the companion shape matches what my script assumes.

## Step 2: Bump presets (pick ONE)

### 🐣 Baby panda (Stage 0, 20% grown)
```powershell
$env:TARGET_STAGE="0"; $env:TARGET_GROWTH="20"; $env:TARGET_PCT="10"
node scripts/bump-companion-progress.cjs
```

### 🐼 Teen panda (Stage 1, 60% grown)
```powershell
$env:TARGET_STAGE="1"; $env:TARGET_GROWTH="60"; $env:TARGET_PCT="50"
node scripts/bump-companion-progress.cjs
```

### 🐼 Sub-adult panda (Stage 2, 90% grown)
```powershell
$env:TARGET_STAGE="2"; $env:TARGET_GROWTH="90"; $env:TARGET_PCT="80"
node scripts/bump-companion-progress.cjs
```

### 🐼 Adult panda (Stage 3, 100% grown) — DEFAULT
```powershell
node scripts/bump-companion-progress.cjs
```

### Reset back to fresh-hatch (Stage 0, 0% growth)
```powershell
$env:TARGET_STAGE="0"; $env:TARGET_GROWTH="0"; $env:TARGET_PCT="0"
node scripts/bump-companion-progress.cjs
```

## Step 3: View
1. Browser → http://localhost:5173 (dashboard)
2. Hard-refresh (Ctrl+Shift+R)
3. Panda should appear at the chosen stage

## Tip
Try them in order: baby → teen → sub-adult → adult. Hard-refresh between each so the dashboard picks up the new state. If any preset doesn't render correctly, paste what you see (screenshot or description) and I'll inspect.

## Optional: visual cycle loop
```powershell
foreach ($stage in @(0,1,2,3)) {
  $env:TARGET_STAGE="$stage"
  $env:TARGET_GROWTH="$(($stage * 33))"
  $env:TARGET_PCT="$(($stage * 25))"
  node scripts/bump-companion-progress.cjs
  Start-Sleep -Seconds 1
}
```