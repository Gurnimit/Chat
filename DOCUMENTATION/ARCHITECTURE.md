# ARCHITECTURE.md

## Overall Architecture Pattern
**Client-Server architecture with WebSocket-based real-time communication**

```
┌─────────────────────────────────────────────────────┐
│                    CLIENTS                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │
│  │  Browser  │  │  Tablet  │  │  Android (Cap.)  │  │
│  │  (React)  │  │  (React) │  │  (React+Capacitor│  │
│  └─────┬─────┘  └─────┬────┘  └────────┬─────────┘  │
│        │              │               │              │
│   HTTP REST API    HTTP REST API   HTTP REST API     │
│   WebSocket (WS)   WebSocket (WS)  WebSocket (WS)   │
│        │              │               │              │
└────────┼──────────────┼───────────────┼──────────────┘
         │              │               │
         ▼              ▼               ▼
┌─────────────────────────────────────────────────────┐
│                 NGINX REVERSE PROXY                 │
│         (Docker: port 80, /api, /socket.io)         │
└─────────────────────┬───────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────┐
│              EXPRESS.JS SERVER (port 5000)           │
│  ┌──────────────────────────────────────────────┐   │
│  │  REST API Routes                              │   │
│  │  /api/auth/*  /api/chats/*  /api/friends/*    │   │
│  │  /api/upload  /api/calls   /api/notifications │   │
│  └──────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────┐   │
│  │  Socket.IO Real-time Layer                    │   │
│  │  send_message, typing, reactions, calls...   │   │
│  └──────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────┐   │
│  │  Middleware                                    │   │
│  │  JWT Auth, CORS, Helmet, Rate Limiting,       │   │
│  │  Correlation Tracing                          │   │
│  └──────────────────────────────────────────────┘   │
└─────────────────────┬───────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────┐
│           DATABASE (SQLite / PostgreSQL)            │
│              via Prisma ORM Client                   │
│         15 models, 13 unique indexes                │
└─────────────────────────────────────────────────────┘
```

## Server Architecture
- **Entry point**: `server/src/index.ts`
- **Express** app with HTTP server
- **Socket.IO** server attached to the HTTP server
- **Prisma** ORM connects to SQLite (dev) or PostgreSQL (prod)
- **Routes** organized by domain: auth, chat, friend, call, upload, notification, observability
- **Sockets** handled in a single `chat.socket.ts` file
- **Middleware**: JWT auth, CORS, Helmet (CSP), rate limiting, correlation ID tracking

## Client Architecture
- **Entry point**: `client/src/main.tsx` → `App.tsx`
- **React 18** with Context API for state management (no Redux/Zustand)
- **AuthProvider** manages authentication state, token refresh, session restoration
- **SocketProvider** manages WebSocket connection lifecycle
- **useWebRTCCall** hook encapsulates all WebRTC call logic (~1400 lines)
- **Responsive layout**: ChatDashboard renders MobileDashboard or TabletDashboard based on viewport width
- **Capacitor** wraps the web build for Android native

## Data Flow
1. **Auth flow**: Register → Email Verify → Login → JWT Access Token + HttpOnly Refresh Cookie
2. **Message flow**: User types → Socket `send_message` → Server saves to DB → Server broadcasts to chat members → Client updates UI
3. **Call flow**: User clicks call → Socket `call_user` → Server creates CallLog → Socket `incoming_call` → WebRTC SDP exchange via sockets → P2P media stream
4. **Notification flow**: Event occurs → `NotificationService.sendPush()` → Creates DB Notification → Sends via FCM → Client receives push → Routes to correct screen

## Scaling Notes
- Currently designed for single-server deployment (in-memory rate limiters, presence maps)
- Socket.IO uses default in-memory adapter (not Redis adapter)
- File uploads stored on local filesystem (not S3/object storage)
- No caching layer (Redis/Memcached)
- Database is SQLite in dev, PostgreSQL schema ready for production
