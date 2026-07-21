# BUILD_GUIDE.md

## Prerequisites
- Node.js 20+
- npm
- PostgreSQL (for production) or SQLite (for development)
- Docker + Docker Compose (for containerized deployment)

## Local Development

### 1. Database Setup
```bash
cd server
# Create .env file with:
# DATABASE_URL="postgresql://user:pass@localhost:5432/chat_db"
# ACCESS_TOKEN_SECRET="your_secret"
# REFRESH_TOKEN_SECRET="your_secret"
# PORT=5000

npm install
npx prisma generate
npx prisma migrate dev --name init
npm run db:seed
```

### 2. Start Backend
```bash
cd server
npm run dev
# Server starts on http://localhost:5000
```

### 3. Start Frontend
```bash
cd client
npm install
npm run dev
# Vite starts on http://localhost:5173
# Proxies /api, /uploads, /socket.io to localhost:5000
```

## Docker Deployment
```bash
# From project root
docker-compose up --build
# Frontend: http://localhost (Nginx on port 80)
# Backend: http://localhost:5000 (internal)
# Database: SQLite file persisted at ./server/prisma/dev.db
```

## Build Commands

### Server
```bash
cd server
npm run build       # TypeScript → dist/
npm run start       # node dist/index.js
npm run db:generate # prisma generate
npm run db:migrate  # prisma migrate dev
npm run db:seed     # ts-node prisma/seed.ts
```

### Client
```bash
cd client
npm run build       # tsc && vite build → dist/
npm run preview     # Preview production build
```

### Android APK
```bash
cd client
npm run build                    # Build web assets
npx cap sync                     # Sync to Android project
npx cap open android             # Open in Android Studio
# In Android Studio: Build > Build APK(s)
```

## Environment Variables
See `.env.example` for all configuration options. Key variables:
- `DATABASE_URL` — Database connection string
- `ACCESS_TOKEN_SECRET` — JWT access token secret (required)
- `REFRESH_TOKEN_SECRET` — JWT refresh token secret (required)
- `PORT` — Server port (default: 5000)
- `NODE_ENV` — development/production
- `STUN_URLS` — Comma-separated STUN server URLs
- `TURN_URLS` — Comma-separated TURN server URLs
- `FCM_ENABLED` — Enable Firebase push notifications
