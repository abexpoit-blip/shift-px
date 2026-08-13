#!/usr/bin/env bash
set -e
REPO_URL="https://github.com/abexpoit-blip/urlsheild.git"
echo "📤 Preparing to push VPS changes to GitHub..."
if [ ! -d .git ]; then git init; fi
git remote remove origin 2>/dev/null || true
git remote add origin "$REPO_URL"
git add .
git commit -m "Fixes applied directly on VPS - $(date '+%Y-%m-%d %H:%M:%S')" || echo "No changes"
git push -u origin main || git push -u origin master
