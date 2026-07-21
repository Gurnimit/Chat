# CONFIGURATION.md

## Environment Variables

### Server (`server/.env`)
| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| PORT | No | 5000 | Express server port |
| DATABASE_URL | Yes | `file:./dev.db` | Prisma database URL |
| ACCESS_TOKEN_SECRET | Yes | `super_secret_access_key_123` | JWT access token secret |
| REFRESH_TOKEN_SECRET | Yes | `super_secret_refresh_key_456` | JWT refresh token secret |
| NODE_ENV | No | `development` | `development` or `production` |
| EMAIL_VERIFICATION_REQUIRED | No | `false` | Require email verification |
| ALLOWED_ORIGINS | No | `http://localhost:5173,http://localhost:5000` | CORS whitelist |
| STUN_URLS | No | Google STUN servers | Comma-separated STUN URLs |
| TURN_URLS | No | (empty) | Comma-separated TURN URLs |
| TURN_USERNAME | No | (empty) | TURN server username |
| TURN_PASSWORD | No | (empty) | TURN server password |
| FCM_ENABLED | No | `false` | Enable Firebase Cloud Messaging |
| FIREBASE_SERVICE_ACCOUNT_PATH | No | (empty) | Path to Firebase service account JSON |
| FCM_SERVICE_ACCOUNT_KEY | No | (empty) | Inline Firebase service account JSON |
| MAX_GROUP_MEMBERS | No | `100` | Maximum group chat members |

### Client (Vite)
| Variable | Description |
|----------|-------------|
| VITE_API_URL | Custom API base URL override |

## Client-Side Configuration

### localStorage Settings
| Key | Values | Default |
|-----|--------|---------|
| `velvet_backend_url` | Custom backend URL | (empty — uses auto-detection) |
| `velvet_enable_ringtone` | `true`/`false` | `true` |
| `velvet_enable_callertone` | `true`/`false` | `true` |
| `velvet_enable_message_sounds` | `true`/`false` | `true` |
| `velvet_sound_volume` | `0.0`-`1.0` | `0.5` |
| `deviceId` | Auto-generated string | Auto-generated on first visit |

### Hidden Server Config
Accessed by clicking the settings gear icon 7 times on the login page. Allows setting a custom backend URL.

## Docker Compose Configuration
- Backend: SQLite database at `./server/prisma/dev.db`
- Frontend: Nginx on port 80
- Uploads persisted at `./server/uploads`
- Database persisted at `./server/prisma`

## Capacitor Configuration (`client/capacitor.config.json`)
```json
{
  "appId": "com.velvet.chat",
  "appName": "Velvet Chat",
  "webDir": "dist",
  "server": {
    "androidScheme": "http",
    "allowNavigation": ["*"]
  }
}
```

## Vite Configuration (`client/vite.config.ts`)
- Dev server port: 5173
- Host: `true` (all interfaces)
- Proxy: `/api`, `/uploads`, `/socket.io` → localhost:5000

## Tailwind Configuration (`client/tailwind.config.js`)
Custom theme:
- Brand colors: 50-950 (indigo-based)
- Dark theme colors: bg (#0a0d14), surface (#121824), card, border, text, muted
- Custom animations: fade-in, slide-up, pulse-slow
