# DEPLOYMENT.md

## Docker Compose Deployment
The primary deployment method uses Docker Compose with three services:

### Services
1. **backend** — Node.js Express server (port 5000)
2. **frontend** — Nginx serving React static files (port 80)
3. *(Implicit)* — SQLite database file on disk

### Docker Compose Configuration
```yaml
services:
  backend:
    build: ./server
    ports: ["5000:5000"]
    volumes:
      - ./server/uploads:/usr/src/app/uploads  # File uploads
      - ./server/prisma:/usr/src/app/prisma    # SQLite database
    command: sh -c "npx prisma db push --accept-data-loss && npm run db:seed && node dist/index.js"
    
  frontend:
    build: ./client
    ports: ["80:80"]
    depends_on: [backend]
```

### Server Dockerfile (Multi-stage)
1. **Builder**: Node 20 Alpine → npm ci → prisma generate → tsc
2. **Runner**: Node 20 Alpine → npm ci → copy dist + prisma client → `node dist/index.js`

### Client Dockerfile (Multi-stage)
1. **Builder**: Node 20 Alpine → npm ci → npm run build (tsc + vite)
2. **Runner**: Nginx Alpine → copy dist to nginx html → copy nginx.conf

### Nginx Configuration
- Serves static files from `/usr/share/nginx/html`
- Proxies `/api` to `http://backend:5000`
- Proxies `/socket.io` to `http://backend:5000` (WebSocket upgrade)
- Proxies `/uploads` to `http://backend:5000`
- SPA fallback: `try_files $uri $uri/ /index.html`

## Production Considerations

### Security
- Default JWT secrets blocked in production mode
- HTTPS required (not configured in Docker — needs reverse proxy/load balancer)
- Helmet CSP headers configured
- Rate limiting on all sensitive endpoints

### Database
- Docker Compose uses SQLite for simplicity
- Production should use PostgreSQL:
  - Change `DATABASE_URL` to PostgreSQL connection string
  - Update `schema.prisma` provider from "sqlite" to "postgresql"
  - Run `prisma migrate deploy`

### File Uploads
- Volumes persist uploads and database on host
- No cloud storage integration
- No CDN for static assets

### Scaling Limitations
- Single-server architecture
- In-memory rate limiters (not shared across instances)
- Socket.IO uses default in-memory adapter (not Redis)
- No load balancer configuration
- No health check automation

### Missing Production Components
- No HTTPS/TLS termination configuration
- No Redis for session storage / Socket.IO adapter
- No S3/cloud storage for file uploads
- No CDN
- No log aggregation
- No monitoring/alerting
- No CI/CD pipeline
- No database connection pooling
