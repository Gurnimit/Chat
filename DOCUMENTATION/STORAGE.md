# STORAGE.md

## File Storage
- **Location**: `server/uploads/` directory on the server filesystem
- **Serving**: Express static middleware at `/uploads` path
- **Persistence**: Docker volume mount for container persistence
- **No cloud storage**: No S3, GCS, or Azure Blob integration
- **No CDN**: Files served directly from origin server

## Database Storage
- **Development**: SQLite file at `server/prisma/dev.db`
- **Production**: PostgreSQL (configured via DATABASE_URL)
- **ORM**: Prisma Client
- **Schema**: 15 models covering all entities
- **Migrations**: 2 migrations (init + user lifecycle columns)

## Client-Side Storage (localStorage)
| Key | Type | Purpose |
|-----|------|---------|
| `accessToken` | string | JWT access token |
| `hasSession` | string ("true") | Session exists flag |
| `deviceId` | string | Unique device identifier |
| `offline_message_queue` | JSON array | Queued messages when offline |
| `velvet_backend_url` | string | Custom backend URL override |
| `velvet_enable_ringtone` | string ("true"/"false") | Ringtone enabled |
| `velvet_enable_callertone` | string ("true"/"false") | Caller tone enabled |
| `velvet_enable_message_sounds` | string ("true"/"false") | Message sounds enabled |
| `velvet_sound_volume` | string (float) | Sound volume (0-1) |

## No Caching Layer
- No Redis, Memcached, or in-memory caching (beyond rate limit maps)
- No HTTP cache headers on API responses
- No ETag or Last-Modified headers
- Service worker provides basic PWA caching of static assets

## No IndexedDB / Offline Database
- No IndexedDB usage
- No local message history storage
- No offline-first architecture
- Messages only available in React state while the session is active
