#!/usr/bin/env bash
# Script to push changes to GitHub and trigger deployment on the VPS
# Run this from your local machine

set -e

VPS_HOST="${VPS_HOST:-75.119.144.171}"
VPS_USER="${VPS_USER:-root}"
APP_DIR="/opt/sleepox-app-new"

echo "📤 Pushing changes to GitHub..."
git push origin main

echo "🚀 Connecting to VPS ($VPS_HOST) to trigger deployment..."
ssh "${VPS_USER}@${VPS_HOST}" "cd ${APP_DIR} && ./deploy.sh"

echo "✅ Deployment trigger sent!"
