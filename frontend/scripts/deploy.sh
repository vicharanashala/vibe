#!/usr/bin/env bash
set -e

LOG_FILE="deploy.log"

# Log a message with a timestamp
log() {
  echo "$(date '+%Y-%m-%d %H:%M:%S') $1" | tee -a "$LOG_FILE"
}

log "🚀 Starting deployment process"

# Save current repo name and path
CURRENT_REPO=$(basename "$(git rev-parse --show-toplevel)")
CURRENT_PATH=$(pwd)

log "📍 Current repo: $CURRENT_REPO"

# Stash current changes
log "💾 Stashing current changes..."
git stash push -m "Deploy stash $(date '+%Y-%m-%d %H:%M:%S')"

# Switch to deploy repo
log "🔄 Switching to saaransh/deploy repo..."
cd ../saaransh-deploy || {
  log "❌ Deploy repo not found. Creating it..."
  cd ..
  git clone https://github.com/saaransh/deploy.git saaransh-deploy
  cd saaransh-deploy
}

# Copy all files from source repo (excluding .git)
log "📦 Copying code from $CURRENT_REPO..."
rsync -av --exclude='.git' --exclude='node_modules' --delete "$CURRENT_PATH/" ./

# Apply the stash to current repo
log "🔧 Applying stashed changes..."
git stash pop || log "⚠️ No stash to apply or conflicts occurred"

# Build and deploy
log "🏗️ Building project..."
pnpm install
pnpm vite build

log "🚀 Deploying to Firebase..."
firebase deploy

# Commit changes with timestamp
COMMIT_MSG="Deploy: $(date '+%Y-%m-%d %H:%M:%S')"
log "💾 Committing changes: $COMMIT_MSG"
git add .
git commit -m "$COMMIT_MSG" || log "⚠️ Nothing to commit"
git push origin main || log "⚠️ Push failed"

# Go back to original repo
log "🔙 Returning to $CURRENT_REPO..."
cd "$CURRENT_PATH"

# Pop the stash back
log "🔄 Restoring stashed changes..."
git stash pop || log "⚠️ No stash to restore"

log "✅ Deployment complete! Back to $CURRENT_REPO with original state restored."