# BACKEND.md

## Technology Stack
- **Runtime**: Node.js 20
- **Framework**: Express.js ^4.19.2
- **Language**: TypeScript ^5.4.5
- **WebSocket**: Socket.IO ^4.7.5
- **ORM**: Prisma ^5.14.0
- **Database**: SQLite (dev) / PostgreSQL (prod)

## Entry Point
`server/src/index.ts`

## Server Startup Sequence
1. Load environment variables via `dotenv`
2. Validate required env vars (ACCESS_TOKEN_SECRET, REFRESH_TOKEN_SECRET, DATABASE_URL)
3. Validate Firebase config if FCM_ENABLED=true
4. Block default JWT secrets in production
5. Create Express app + HTTP server
6. Configure Socket.IO with CORS
7. Apply middleware: Helmet, correlation, CORS, JSON parsing, cookies
8. Set up static file serving for uploads with security headers
9. Mount route handlers with rate limiters
10. Set up Socket.IO event handlers
11. Connect to database, start listening on PORT

## Route Structure
| Mount Point | Router | Auth Required |
|-------------|--------|---------------|
| `/api/auth` | auth.routes.ts | Partial (register, login, refresh, forgot, reset, verify don't; me, profile, change-password, device-token do) |
| `/api` | chat.routes.ts | Yes |
| `/api/friends` | friend.routes.ts | Yes |
| `/api/calls` | call.routes.ts | Yes |
| `/api/upload` | upload.routes.ts | Yes |
| `/api/notifications` | notification.routes.ts | Yes |
| `/api/observability` | observability.routes.ts | No (health); Yes (metrics) |
| `/uploads` | Static files | No (CSP sandboxed) |

## Middleware Stack
1. **Helmet** — Security headers (CSP, X-Content-Type-Options, Referrer-Policy)
2. **Correlation** — x-correlation-id tracking via AsyncLocalStorage
3. **CORS** — Whitelist-based origin validation
4. **JSON/URL-encoded body parsing**
5. **Cookie parsing**
6. **Rate limiting** (per-route)

## Key Design Patterns

### Request-Scoped State
- `req.userId` attached by `authenticateToken` middleware
- `req.app.get('io')` accesses Socket.IO instance

### Error Handling
- Try-catch in every route handler
- Generic "Internal server error" responses (no stack traces leaked)
- Structured logging with correlation IDs

### File Upload Security
- Two-layer validation: MIME type (client header) + magic bytes (server-side)
- Files saved as `.tmp` first, renamed after validation
- Category-based size limits (Image: 25MB, Audio/Doc: 100MB, Archive: 250MB, Video: 500MB)
- CSP sandbox header on static file serving
- Content-Disposition: inline for safe types, attachment for others

### Notification Service
- Pluggable provider pattern (NotificationProvider interface)
- FCMProvider for production, MockProvider for development
- Notifications persisted in DB before sending
- Delivery tracking (queued → sent/failed)

## Background Scripts
| Script | Purpose |
|--------|---------|
| `server/src/list-logs.ts` | List users and call logs |
| `server/src/backfill-preferences.ts` | Create missing NotificationPreference records |

## Build
```bash
cd server
npm run build    # tsc → dist/
npm run dev      # ts-node-dev --respawn --transpile-only src/index.ts
npm run db:generate  # prisma generate
npm run db:migrate   # prisma migrate dev
npm run db:seed      # ts-node prisma/seed.ts
```

## Docker
Multi-stage build:
1. **Builder**: Node 20 Alpine, npm ci, prisma generate, tsc
2. **Runner**: Node 20 Alpine, npm ci, copy dist + prisma client
3. Exposes port 5000
4. CMD: `node dist/index.js`

## Environment Variables
| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| PORT | No | 5000 | Server port |
| DATABASE_URL | Yes | | Prisma database URL |
| ACCESS_TOKEN_SECRET | Yes | | JWT access token secret |
| REFRESH_TOKEN_SECRET | Yes | | JWT refresh token secret |
| NODE_ENV | No | development | development/production |
| EMAIL_VERIFICATION_REQUIRED | No | false | Require email verification |
| ALLOWED_ORIGINS | No | localhost:5173,5000 | CORS whitelist |
| STUN_URLS | No | Google STUN servers | Comma-separated STUN URLs |
| TURN_URLS | No | | Comma-separated TURN URLs |
| TURN_USERNAME | No | | TURN server username |
| TURN_PASSWORD | No | | TURN server password |
| FCM_ENABLED | No | false | Enable Firebase Cloud Messaging |
| FIREBASE_SERVICE_ACCOUNT_PATH | No | | Path to Firebase service account JSON |
| FCM_SERVICE_ACCOUNT_KEY | No | | Inline Firebase service account JSON |
| MAX_GROUP_MEMBERS | No | 100 | Maximum group chat members |
