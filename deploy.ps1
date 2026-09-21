# Auto-deploy to VPS (109.205.180.183) with Zero-Downtime
param (
    [switch]$SkipPush = $false
)

$ErrorActionPreference = "Stop"

if (-not $SkipPush) {
    Write-Host "🚀 [1/2] Pushing latest commits to GitHub..." -ForegroundColor Cyan
    git push origin main
    git push swiftpx main
}

Write-Host "🚀 [2/2] Triggering Zero-Downtime Deployment on VPS..." -ForegroundColor Cyan
ssh -o StrictHostKeyChecking=no root@109.205.180.183 "cd /var/www/swiftpx && git checkout -- . && git pull origin main && chmod +x deploy-zero-downtime.sh && ./deploy-zero-downtime.sh"
