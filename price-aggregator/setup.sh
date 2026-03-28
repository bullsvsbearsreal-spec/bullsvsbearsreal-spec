#!/bin/bash
# InfoHub Price Aggregator - One-click setup for Ubuntu 24.04
set -e

echo "=== Installing Node.js 22 ==="
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs

echo "=== Creating app directory ==="
mkdir -p /opt/infohub-aggregator
cd /opt/infohub-aggregator

echo "=== Writing package.json ==="
cat > package.json << 'PKGEOF'
{
  "name": "infohub-price-aggregator",
  "version": "1.0.0",
  "type": "module",
  "scripts": { "start": "node index.mjs" },
  "dependencies": { "ws": "^8.16.0" }
}
PKGEOF

echo "=== Installing dependencies ==="
npm install --production

echo "=== Creating systemd service ==="
cat > /etc/systemd/system/infohub-aggregator.service << 'SVCEOF'
[Unit]
Description=InfoHub Price Aggregator
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/infohub-aggregator
ExecStart=/usr/bin/node index.mjs
Restart=always
RestartSec=5
Environment=PORT=3100

[Install]
WantedBy=multi-user.target
SVCEOF

echo "=== Setup complete! ==="
echo "Now paste index.mjs content, then run:"
echo "  systemctl daemon-reload"
echo "  systemctl enable infohub-aggregator"
echo "  systemctl start infohub-aggregator"
echo "  systemctl status infohub-aggregator"
