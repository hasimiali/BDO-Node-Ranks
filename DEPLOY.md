# VPS Deploy Guide

GitHub is used as the source repository only. This project is not deployed with GitHub Pages because the app needs the Express API server for `/api/*` routes.

Target domain:

```txt
https://bdo-node-ranks.treaplabs.com
```

## DNS

In Hostinger DNS for `treaplabs.com`, create or confirm:

```txt
Type: A
Name: bdo-node-ranks
Value: 43.156.116.186
TTL: 3600
```

Check propagation:

```sh
nslookup bdo-node-ranks.treaplabs.com
```

Expected result should include `43.156.116.186`.

## Server Install

SSH into VPS:

```sh
ssh root@43.156.116.186
```

Install required packages:

```sh
sudo apt update
sudo apt install -y git nginx curl certbot python3-certbot-nginx
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2
```

Check versions:

```sh
node -v
npm -v
pm2 -v
```

## Clone And Build

```sh
sudo mkdir -p /var/www
sudo chown -R $USER:$USER /var/www
cd /var/www
git clone https://github.com/hasimiali/BDO-Node-Ranks.git
cd BDO-Node-Ranks
npm ci
npm run build
```

## Start API

Use PM2 config from repo:

```sh
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

`pm2 startup` prints one `sudo env ...` command. Run that printed command.

Check API:

```sh
curl http://127.0.0.1:3001/api/market/status
```

## Nginx

Copy repo Nginx config:

```sh
sudo cp nginx/bdo-node-ranks.conf /etc/nginx/sites-available/bdo-node-ranks
sudo ln -s /etc/nginx/sites-available/bdo-node-ranks /etc/nginx/sites-enabled/bdo-node-ranks
sudo nginx -t
sudo systemctl reload nginx
```

If default site conflicts:

```sh
sudo rm /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

Check HTTP:

```sh
curl http://bdo-node-ranks.treaplabs.com/api/market/status
```

## SSL

Run after DNS points to VPS:

```sh
sudo certbot --nginx -d bdo-node-ranks.treaplabs.com
```

Choose HTTP-to-HTTPS redirect.

Check HTTPS:

```sh
curl https://bdo-node-ranks.treaplabs.com/api/market/status
```

Open:

```txt
https://bdo-node-ranks.treaplabs.com
```

## Update Deploy

After code changes:

```sh
cd /var/www/BDO-Node-Ranks
git pull
npm ci
npm run build
pm2 restart bdo-node-ranks
```

Or run helper script:

```sh
bash deploy/update.sh
```

## Firewall

If UFW is enabled:

```sh
sudo ufw allow OpenSSH
sudo ufw allow "Nginx Full"
sudo ufw enable
```

Do not expose port `3001` publicly. Nginx should proxy `/api/*` internally.

## Troubleshooting

Check PM2:

```sh
pm2 status
pm2 logs bdo-node-ranks
```

Check Nginx:

```sh
sudo nginx -t
sudo systemctl status nginx
sudo tail -n 100 /var/log/nginx/error.log
```

Check API directly:

```sh
curl http://127.0.0.1:3001/api/market/status
curl http://127.0.0.1:3001/api/rankings?region=ASIA
```

Check public API:

```sh
curl https://bdo-node-ranks.treaplabs.com/api/market/status
```
