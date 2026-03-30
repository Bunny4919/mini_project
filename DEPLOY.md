# DocRule — Deployment Guide

Step-by-step guide to deploy the DocRule application on a Linux server (Ubuntu/Debian recommended).

---

## Prerequisites

Install on your server:
```bash
# Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# PostgreSQL
sudo apt-get install -y postgresql postgresql-contrib

# PM2 (global process manager)
npm install -g pm2

# Nginx
sudo apt-get install -y nginx

# Certbot (free HTTPS via Let's Encrypt)
sudo apt-get install -y certbot python3-certbot-nginx
```

---

## 1. Clone the Repository

```bash
git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git /var/www/docrule
cd /var/www/docrule
```

---

## 2. Set Up the Database

```bash
sudo -u postgres psql
```
Inside psql:
```sql
CREATE USER docrule_user WITH PASSWORD 'YOUR_STRONG_PASSWORD_HERE';
CREATE DATABASE docrule OWNER docrule_user;
GRANT ALL PRIVILEGES ON DATABASE docrule TO docrule_user;
\q
```

---

## 3. Configure Environment Variables

```bash
cd /var/www/docrule/backend
cp ../.env.example .env
nano .env
```

Fill in your real values:
```env
PORT=3001
NODE_ENV=production

# PostgreSQL
DB_HOST=localhost
DB_PORT=5432
DB_NAME=docrule
DB_USER=docrule_user
DB_PASSWORD=YOUR_STRONG_PASSWORD_HERE

# JWT — generate a strong secret:
# node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
JWT_SECRET=PASTE_YOUR_64_CHAR_HEX_SECRET_HERE
JWT_EXPIRES_IN=7d

# CORS — your real frontend domain
CORS_ORIGIN=https://yourdomain.com
```

> ⚠️ **Never commit the `.env` file to Git.** The `.gitignore` already excludes it.

---

## 4. Install Backend Dependencies

```bash
cd /var/www/docrule/backend
npm install --omit=dev

# Create log directory for pm2
mkdir -p logs
```

---

## 5. Build the Frontend

```bash
cd /var/www/docrule/frontend
npm install
npm run build
# Output: frontend/dist/ — this is what Nginx serves
```

---

## 6. Start the Backend with PM2

```bash
cd /var/www/docrule/backend
pm2 start pm2.config.js --env production
pm2 save
pm2 startup   # follow the printed command to auto-start on reboot
```

Check it's running:
```bash
pm2 status
pm2 logs docrule-backend
```

---

## 7. Configure Nginx

```bash
# Copy the sample config
sudo cp /var/www/docrule/nginx.conf /etc/nginx/sites-available/docrule
sudo ln -s /etc/nginx/sites-available/docrule /etc/nginx/sites-enabled/

# Edit and replace 'yourdomain.com' with your real domain
sudo nano /etc/nginx/sites-available/docrule

# Test and reload
sudo nginx -t
sudo systemctl reload nginx
```

---

## 8. Enable HTTPS (Let's Encrypt)

```bash
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
# Follow prompts — it auto-configures SSL in your Nginx config
sudo systemctl reload nginx
```

---

## 9. Verify Everything Works

```bash
# Backend health check
curl https://yourdomain.com/api/health
# Expected: {"status":"ok","activeSessions":0,...}

# Open the frontend in a browser
# https://yourdomain.com
```

---

## Useful Commands

| Task | Command |
|---|---|
| View backend logs | `pm2 logs docrule-backend` |
| Restart backend | `pm2 restart docrule-backend` |
| Stop backend | `pm2 stop docrule-backend` |
| Monitor resources | `pm2 monit` |
| Rebuild frontend | `cd frontend && npm run build` |
| Reload Nginx | `sudo systemctl reload nginx` |

---

## Updating the Application

```bash
cd /var/www/docrule
git pull origin main

# Rebuild frontend
cd frontend && npm run build

# Restart backend
cd ../backend && npm install --omit=dev
pm2 restart docrule-backend
```
