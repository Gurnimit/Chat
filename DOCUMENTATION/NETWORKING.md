# NETWORKING.md

## API Communication
- **Protocol**: HTTP/HTTPS
- **Client Library**: Axios with interceptors
- **Base URL Detection**: Dynamic — checks localStorage custom URL, Vite env var, Capacitor native detection, or window.location.origin
- **Credentials**: `withCredentials: true` for cookie-based refresh tokens

## WebSocket Communication
- **Protocol**: WebSocket (Socket.IO)
- **Transport**: Forced `websocket` only (no polling fallback)
- **Auth**: JWT token in `handshake.auth.token`
- **Reconnection**: Enabled, 10 attempts, 1s delay

## Token Refresh Interceptor
- Axios response interceptor catches 403 errors
- Queues parallel failed requests during refresh
- Retries original request with new access token
- Falls back to checking localStorage (multi-tab sync)

## Vite Dev Proxy
| Path | Target | Notes |
|------|--------|-------|
| `/api` | http://localhost:5000 | REST API proxy |
| `/uploads` | http://localhost:5000 | Static file proxy |
| `/socket.io` | http://localhost:5000 | WebSocket proxy (ws: true) |

## Nginx Production Proxy
| Path | Target | Notes |
|------|--------|-------|
| `/api` | http://backend:5000 | REST API proxy |
| `/socket.io` | http://backend:5000 | WebSocket proxy with Upgrade headers |
| `/uploads` | http://backend:5000 | Static file proxy |
| `/*` | Static files | SPA fallback with try_files |

## CORS Configuration
- Whitelist-based: `ALLOWED_ORIGINS` env var (comma-separated)
- Default: `http://localhost:5173, http://localhost:5000`
- Socket.IO CORS matches Express CORS
- `credentials: true` for cookie support

## Rate Limiting (HTTP)
| Endpoint | Limit | Window |
|----------|-------|--------|
| `/api/auth` (general) | 100 req | 15 min |
| `/api/auth/login` | 15 req | 15 min |
| `/api/auth/register` | 5 req | 1 hr |
| `/api/upload` | 10 req | 10 min |
| `/api/diagnostics/log` | 30 req | 10 min |
| `/api/friends/*` | Uses auth limiter | 15 min |
| `/api/calls/*` | Uses auth limiter | 15 min |
| `/api/notifications/*` | Uses auth limiter | 15 min |

All rate limiters can be bypassed with `x-bypass-rate-limit: bypass-key-123` header.

## Rate Limiting (WebSocket)
In-memory sliding-window per socket:
| Event | Limit | Window |
|-------|-------|--------|
| `send_message` | 10 | 5s |
| `call_user` | 3 (prod) / 100 (dev) | 30s |
| `ice_candidate` | 100 | 10s |

## Rate Limiting (Application)
| Feature | Limit | Window |
|---------|-------|--------|
| Friend requests sent | 5/min, 20/day | Sliding |
| Profile lookups (QR) | 15/min | Sliding |

## File Upload Networking
- Multipart form-data upload to `/api/upload`
- Files stored on server filesystem
- Served via Express static middleware with CSP sandbox headers
- Content-Disposition: inline for images/audio/video/PDFs, attachment for others

## ICE/TURN Configuration
- STUN servers from `STUN_URLS` env (default: Google public STUN)
- TURN servers from `TURN_URLS`, `TURN_USERNAME`, `TURN_PASSWORD`
- Configuration served via `/api/chats/ice-config`
- Client fetches ICE config on hook initialization

## Push Notification Networking
- **Service**: Firebase Cloud Messaging (FCM)
- **Registration**: Capacitor push plugin → FCM token → POST `/api/auth/device-token`
- **Delivery**: Server-side via `firebase-admin` SDK
- **Channels**: "messages" (high importance), "calls" (max importance)
- **Cleanup**: Stale tokens (>30 days inactive) cleaned asynchronously
