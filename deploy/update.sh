#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/var/www/BDO-Node-Ranks"

cd "$APP_DIR"
git pull
npm ci
npm run build
pm2 restart bdo-node-ranks
