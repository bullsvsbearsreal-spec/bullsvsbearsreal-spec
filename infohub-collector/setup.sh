#!/bin/bash
# InfoHub Collector — Droplet Setup Script
# Run on a fresh Ubuntu 22.04+ DigitalOcean droplet
#
# Usage: curl -s https://raw.githubusercontent.com/.../setup.sh | bash
# Or: bash setup.sh

set -e

echo "=== InfoHub Collector Setup ==="

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

# Create app directory
APP_DIR=/opt/infohub-collector
sudo mkdir -p $APP_DIR
sudo chown $USER:$USER $APP_DIR

# Copy files (if running locally, adjust as needed)
if [ -f collector.mjs ]; then
  cp package.json collector.mjs health.mjs ecosystem.config.cjs $APP_DIR/
fi

cd $APP_DIR

# Install dependencies
npm install --production

# Create .env if not exists
if [ ! -f .env ]; then
  echo "Creating .env — you need to fill in DATABASE_URL"
  cat > .env << 'EOF'
DATABASE_URL=
INFOHUB_BASE_URL=https://info-hub.io
HEALTH_PORT=3001
EOF
  echo ">>> Edit .env with your DATABASE_URL before starting! <<<"
  echo ">>> nano $APP_DIR/.env <<<"
fi

# Start with PM2
pm2 start ecosystem.config.cjs
pm2 save

# Setup PM2 startup (survives reboot)
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u $USER --hp $HOME
pm2 save

echo ""
echo "=== Setup Complete ==="
echo "Check status: pm2 status"
echo "View logs:    pm2 logs infohub-collector"
echo "Health:       curl http://localhost:3001/health"
echo ""
echo "IMPORTANT: Edit $APP_DIR/.env with your DATABASE_URL if not set"
