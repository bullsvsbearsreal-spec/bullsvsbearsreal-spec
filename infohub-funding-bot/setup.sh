#!/bin/bash
# InfoHub Funding Bot — Droplet Setup Script
# Run on the infohub-funding-bot droplet (168.144.85.183)
#
# Prerequisites: Git access to the repo
# Usage: bash setup.sh

set -e

echo "=== InfoHub Funding Bot Setup ==="

# Install Node.js 20 LTS
if ! command -v node &> /dev/null; then
  echo "Installing Node.js 20..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi
echo "Node: $(node --version)"

# Install PM2
if ! command -v pm2 &> /dev/null; then
  echo "Installing PM2..."
  sudo npm install -g pm2
fi
echo "PM2: $(pm2 --version)"

# Clone or update repo
APP_DIR=/opt/infohub
if [ -d "$APP_DIR/.git" ]; then
  echo "Updating repo..."
  cd $APP_DIR
  git pull
else
  echo "Cloning repo..."
  sudo mkdir -p $APP_DIR
  sudo chown $USER:$USER $APP_DIR
  # Clone your repo here — adjust URL as needed
  echo ">>> Clone your infohub repo to $APP_DIR <<<"
  echo ">>> git clone <your-repo-url> $APP_DIR <<<"
  exit 1
fi

# Install bot dependencies
cd $APP_DIR/infohub-funding-bot
npm install --production

# Also install shared dependencies the bot imports from src/
cd $APP_DIR
npm install --production 2>/dev/null || true

# Create .env if not exists
cd $APP_DIR/infohub-funding-bot
if [ ! -f .env ]; then
  echo "Creating .env — you MUST fill in DATABASE_URL"
  cp .env.example .env
  echo ""
  echo ">>> IMPORTANT: Edit .env with your DATABASE_URL <<<"
  echo ">>> nano /opt/infohub/infohub-funding-bot/.env <<<"
  echo ""
fi

# Start with PM2
pm2 start ecosystem.config.cjs
pm2 save

# PM2 startup (survives reboot)
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u $USER --hp $HOME
pm2 save

echo ""
echo "=== Setup Complete ==="
echo "Status:  pm2 status"
echo "Logs:    pm2 logs infohub-funding-bot"
echo "Health:  curl http://localhost:3002/health"
echo "Funding: curl http://localhost:3002/funding"
echo ""
echo "IMPORTANT: Edit /opt/infohub/infohub-funding-bot/.env with your DATABASE_URL"
