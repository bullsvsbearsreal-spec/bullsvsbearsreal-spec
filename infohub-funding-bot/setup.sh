#!/bin/bash
# InfoHub Funding Bot — Droplet Setup Script (Frankfurt FRA1)
# Fully automated — run as root on a fresh Ubuntu droplet
#
# Usage: curl -s <raw-github-url>/setup.sh | bash
#   or:  bash setup.sh
#
# Requires these env vars (pass via cloud-init or set before running):
#   GITHUB_PAT     — GitHub personal access token for private repo
#   DATABASE_URL   — PostgreSQL connection string
#   PROXY_URL      — Cloudflare Worker proxy URL (for CF-blocked exchanges)

set -euo pipefail

APP_DIR=/opt/infohub
BOT_DIR=$APP_DIR/infohub-funding-bot
REPO_URL="https://${GITHUB_PAT:-}@github.com/bullsvsbearsreal-spec/infohub.git"

echo "=== InfoHub Funding Bot Setup (FRA1) ==="
echo "Timestamp: $(date -u '+%Y-%m-%d %H:%M:%S UTC')"

# ─── System packages ────────────────────────────────────────────────────────
echo "[1/7] Installing Node.js 20 LTS..."
if ! command -v node &>/dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
echo "  Node: $(node --version)"
echo "  npm:  $(npm --version)"

echo "[2/7] Installing PM2..."
if ! command -v pm2 &>/dev/null; then
  npm install -g pm2
fi
echo "  PM2: $(pm2 --version)"

# ─── Clone repo ─────────────────────────────────────────────────────────────
echo "[3/7] Cloning repo to $APP_DIR..."
if [ -d "$APP_DIR/.git" ]; then
  cd $APP_DIR
  git pull origin main
else
  if [ -z "${GITHUB_PAT:-}" ]; then
    echo "ERROR: GITHUB_PAT not set. Export it first:"
    echo "  export GITHUB_PAT=ghp_..."
    exit 1
  fi
  git clone "$REPO_URL" $APP_DIR
fi
cd $APP_DIR
echo "  Commit: $(git log --oneline -1)"

# ─── Install dependencies ───────────────────────────────────────────────────
echo "[4/7] Installing dependencies..."
# Root project deps (exchange fetchers import from src/)
cd $APP_DIR
npm install --production --ignore-scripts 2>&1 | tail -1
# Bot-specific deps
cd $BOT_DIR
npm install --production 2>&1 | tail -1

# ─── Configure .env ─────────────────────────────────────────────────────────
echo "[5/7] Writing .env..."
if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL not set."
  exit 1
fi

cat > $BOT_DIR/.env << ENVEOF
DATABASE_URL=${DATABASE_URL}
PROXY_URL=${PROXY_URL:-}
CRON_INTERVAL=*/2 * * * *
HEALTH_PORT=3002
ANOMALY_THRESHOLD=50
ENVEOF

echo "  .env written ($(wc -l < $BOT_DIR/.env) lines)"
# Verify DATABASE_URL is on one line
if [ "$(grep -c 'sslmode=require' $BOT_DIR/.env)" -ne 1 ]; then
  echo "WARNING: DATABASE_URL may be malformed (sslmode not found)"
fi

# ─── Add SSH key for remote management ──────────────────────────────────────
echo "[6/7] Configuring SSH access..."
mkdir -p ~/.ssh
chmod 700 ~/.ssh
# Add the management key (allows SSH from dev machine)
MGMT_KEY="ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIIgYgjQfjpqaVD7u6VcBfDtRbSQBLkMxJK51VSpqXSdN Shadow@SHADOW-KCSS207M"
if ! grep -q "Shadow@SHADOW-KCSS207M" ~/.ssh/authorized_keys 2>/dev/null; then
  echo "$MGMT_KEY" >> ~/.ssh/authorized_keys
  chmod 600 ~/.ssh/authorized_keys
  echo "  SSH key added"
else
  echo "  SSH key already present"
fi

# ─── Start PM2 ──────────────────────────────────────────────────────────────
echo "[7/7] Starting bot with PM2..."
cd $BOT_DIR
pm2 delete infohub-funding-bot 2>/dev/null || true
pm2 start ecosystem.config.cjs
pm2 save

# Startup script for reboot survival
pm2 startup systemd -u root --hp /root 2>&1 | tail -1
pm2 save

echo ""
echo "=== Setup Complete ==="
echo "  Status:  pm2 status"
echo "  Logs:    pm2 logs infohub-funding-bot --lines 30"
echo "  Health:  curl -s localhost:3002/health | python3 -m json.tool"
echo ""
echo "Waiting 30s for first run to complete..."
sleep 30
HEALTH=$(curl -s localhost:3002/health 2>/dev/null || echo '{"error":"no response"}')
echo "Health: $HEALTH"
echo ""
echo "Done! Bot is running on port 3002."
