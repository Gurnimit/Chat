# Deployment Guide - Velvet Chat

This guide provides technical instructions for deploying Velvet Chat in development, Docker, and high-availability production environments.

---

## 1. Local Development Setup

### Prerequisites
- **Node.js** (v18 or higher)
- **npm** (v9 or higher)
- **SQLite3** (Automatically managed by Prisma)

### Steps
1. **Clone the Repository**:
   ```bash
   git clone <repository-url> velvet-chat
   cd velvet-chat
   ```
2. **Configure Environment Variables**:
   Copy `.env.example` to `server/.env` and configure credentials:
   ```bash
   cp .env.example server/.env
   ```
3. **Install Dependencies**:
   ```bash
   # In root directory
   npm install --prefix server
   npm install --prefix client
   ```
4. **Initialize Database & Seed Test Accounts**:
   ```bash
   cd server
   npx prisma migrate dev --name init
   npm run db:seed
   ```
5. **Start Dev Servers**:
   ```bash
   # Start backend (on http://localhost:5000)
   npm run dev --prefix server
   
   # Start frontend (on http://localhost:5173)
   npm run dev --prefix client
   ```

---

## 2. Docker Compose Deployment

The repository contains a `docker-compose.yml` to launch client and server services from a single container configuration.

### Deployment Steps
1. Ensure `docker` and `docker-compose` are installed and running.
2. Build and run containers:
   ```bash
   docker-compose up --build -d
   ```
3. Verify that:
   - Server runs on `http://localhost:5000`
   - Client is served on `http://localhost:5173`

---

## 3. SQLite to PostgreSQL Production Migration Roadmap

While SQLite is configured for rapid development, high-traffic production deployments should use PostgreSQL to prevent write-locking and support horizontal scaling.

### Step 1: Provision PostgreSQL
Set up a PostgreSQL server instance and create a blank database:
```sql
CREATE DATABASE velvetchat;
CREATE USER chat_user WITH PASSWORD 'secure_production_password';
GRANT ALL PRIVILEGES ON DATABASE velvetchat TO chat_user;
```

### Step 2: Modify Provider in Schema
Change the datasource provider block in `server/prisma/schema.prisma`:
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

### Step 3: Configure Production env
Update `server/.env` to point to the PostgreSQL instance:
```text
DATABASE_URL="postgresql://chat_user:secure_production_password@localhost:5432/velvetchat?schema=public"
```

### Step 4: Regenerate Prisma Client & Run Migrations
Run the migration engine on the Postgres database to build table structures:
```bash
npx prisma migrate dev --name init_postgres
npx prisma generate
```

### Step 5: Seed Production Initial Data
Seed initial configurations or default values:
```bash
npm run db:seed
```

---

## 4. Production Nginx Reverse Proxy Configuration

In a production environment, Nginx should act as the SSL termination layer, proxying requests to the client build files and passing backend/WebSocket routes to the Node.js process.

Create a site configuration file (e.g. `/etc/nginx/sites-available/velvetchat.conf`):

```nginx
server {
    listen 80;
    server_name chat.yourdomain.com;
    
    # Redirect all HTTP traffic to HTTPS
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name chat.yourdomain.com;

    # SSL Certificates (managed by Certbot / Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/chat.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/chat.yourdomain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Upload size limit (matches Express maximum of 500MB)
    client_max_body_size 500M;

    # Serve compiled static React files
    location / {
        root /var/www/velvetchat/client/dist;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    # Proxy REST API requests to Express Backend
    location /api/ {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Proxy Socket.IO WebSocket traffic
    location /socket.io/ {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Static uploads with Nginx-level cache headers (optional, server handles fallback)
    location /uploads/ {
        alias /var/www/velvetchat/server/uploads/;
        add_header Content-Security-Policy "default-src 'none'; sandbox;";
        add_header X-Content-Type-Options "nosniff";
        expires 7d;
        add_header Cache-Control "public, no-transform";
    }
}
```

Enable the configuration and reload Nginx:
```bash
ln -s /etc/nginx/sites-available/velvetchat.conf /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

---

## 5. Upload Security & Cleanup Policy

To prevent disk saturation and ensure upload safety, the application enforces the following security standards:

### Upload Hardening Policy
- **Sandboxed Delivery**: All files requested from `/uploads/` are served with `Content-Security-Policy: default-src 'none'; sandbox;` and `X-Content-Type-Options: nosniff`.
- **Neutral Safe Extensions Only**: Files are initially uploaded as random `.tmp` files. They are validated against magic bytes (signatures) and renamed using only server-verified safe extensions (e.g., `.jpg`, `.pdf`, `.zip`).
- **Filename Obfuscation**: Client-submitted filenames are never saved directly to the filesystem, avoiding directory traversal or file-overwrite exploits.

### Orphaned / Old File Cleanup Strategy
To clean up unreferenced uploads or files older than 30 days, schedule the following cron utility script:

Create `cleanup_uploads.sh`:
```bash
#!/bin/bash
# Configuration
UPLOADS_DIR="/var/www/velvetchat/server/uploads"
MAX_AGE_DAYS=30

# Find and delete files older than 30 days
find "${UPLOADS_DIR}" -type f -mtime +${MAX_AGE_DAYS} -exec rm -f {} \;

echo "Uploads cleanup completed successfully."
```
Register it via `crontab -e` to run daily:
```text
0 2 * * * /var/www/velvetchat/cleanup_uploads.sh
```

