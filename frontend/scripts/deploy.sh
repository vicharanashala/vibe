#!/usr/bin/env bash

set -euo pipefail
IFS=$'\n\t'

#========================================
# Configuration
#========================================
DEPLOY_BRANCH="deploy"
STASH_MSG="pre-deploy-stash"

#========================================
# Helpers
#========================================
error_exit() {
  echo "❌ ERROR: $1"
  cleanup
  exit 1
}

cleanup() {
  # undo workspace changes
  echo "⚠️  Cleaning up..."
  # Reset any partial index changes
  git reset --hard HEAD || true
  # Return to previous branch if set
  if [[ -n "${PREV_BRANCH:-}" ]]; then
    git checkout "${PREV_BRANCH}" || true
  fi
  # Pop stash if still present
  if git stash list | grep -q "${STASH_MSG}"; then
    git stash pop --index || true
  fi
}

prompt_continue() {
  local prompt_msg="$1"
  read -rp "$prompt_msg [y/N]: " ans
  case "$ans" in
    [yY]|[yY][eE][sS]) return 0 ;;  *) return 1 ;;
  esac
}

trap 'error_exit "An unexpected error occurred."' ERR
trap 'echo "\nInterrupted."; cleanup; exit 1' INT TERM

#========================================
# Main flow
#========================================

# Save current branch
PREV_BRANCH=$(git symbolic-ref --short HEAD) || error_exit "Could not determine current branch."

echo "🔀 Switching from '$PREV_BRANCH' to '$DEPLOY_BRANCH'..."

git stash push -u -m "$STASH_MSG" || error_exit "Failed to stash changes."

git checkout "$DEPLOY_BRANCH" || error_exit "Failed to checkout '$DEPLOY_BRANCH'."

# Update deploy branch
echo "⬇️  Pulling latest '$DEPLOY_BRANCH'..."
if ! git pull --ff-only; then
  echo "⚠️  Merge required on '$DEPLOY_BRANCH'."
  echo "Please resolve conflicts in '$DEPLOY_BRANCH' branch and then press Enter to continue..."
  read -r
  # Verify no unmerged files
  if git diff --check; then
    echo "✔️  Conflicts resolved."
  else
    error_exit "Unresolved conflicts remain on '$DEPLOY_BRANCH'."
  fi
fi

# Reset index and working tree
git rm -r --cached . || error_exit "Failed to clear index."

# Restore files from prev branch
echo "📂 Restoring files from '$PREV_BRANCH'..."
if ! git checkout "$PREV_BRANCH" -- .; then
  error_exit "Failed to restore files from '$PREV_BRANCH'."
fi

# Apply stashed changes
echo "📦 Applying stashed changes..."
if ! git stash pop --index; then
  echo "⚠️  Could not apply stash cleanly. Please resolve conflicts and then continue..."
  read -rp "Press Enter once manual resolution is done..."
  # Check again
  if ! git diff --check; then
    error_exit "Unresolved conflicts after stash pop."
  fi
fi

# Stage everything
git add -A

echo "📝 Staged changes:"
git diff --cached --name-status

# Confirm commit and push
if prompt_continue "❓ Commit and push changes to '$DEPLOY_BRANCH'?"; then
  echo "✅ Committing..."
  git commit -m "Deploy: auto-commit on $(date '+%Y-%m-%d %H:%M:%S')" || echo "Nothing to commit."
  echo "🚀 Pushing to '$DEPLOY_BRANCH'..."
  git push origin "$DEPLOY_BRANCH" || error_exit "Failed to push to '$DEPLOY_BRANCH'."
else
  echo "❌ Aborted by user."
  cleanup
  exit 1
fi

# Build and deploy
echo "🏗️  Building..."
pnpm vite build || error_exit "Build failed."

echo "☁️  Deploying..."
firebase deploy || error_exit "Deploy failed."

# Switch back
echo "🔀 Returning to '$PREV_BRANCH'..."
git checkout "$PREV_BRANCH" || error_exit "Failed to checkout '$PREV_BRANCH'."

# Final cleanup (pop any remaining stash)
cleanup

echo "🎉 Deployment completed successfully."