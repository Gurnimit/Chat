# PROJECT_OVERVIEW.md

## Application Name
**Velvet Chat** — Secure & Private Messenger

## What It Is
Velvet Chat is a full-stack real-time messaging application with a "Midnight Velvet" dark theme. It operates as a single-codebase web application with PWA (Progressive Web App) functionality and is engineered to package into an Android APK using Capacitor with zero code changes.

## What Problem It Solves
Provides a secure, privacy-focused real-time messaging experience supporting:
- 1-on-1 direct messaging
- Group chat (up to 100 members)
- WebRTC audio and video calling
- File/image/media sharing
- Friend system with QR code-based discovery
- Push notifications for mobile
- Cross-platform: Web browser + Android native app

## Key Capabilities
1. **Real-time messaging** via WebSocket (Socket.IO)
2. **WebRTC peer-to-peer audio/video calls** with STUN/TURN support
3. **File upload** with magic-byte validation (anti-malware)
4. **Friend system** with QR code scanning, friend requests, blocking
5. **Privacy settings** controlling who can see profile photo, last seen, who can call, who can send friend requests
6. **Group chats** with owner/admin/member roles
7. **Push notifications** via Firebase Cloud Messaging (FCM) for Android
8. **Responsive UI** — desktop, tablet, and mobile layouts
9. **Message delivery/read receipts** (sent → delivered → read)
10. **Message reactions**, edit, soft-delete, reply-to-thread
11. **Typing indicators** with debounce
12. **Offline message queue** — messages queued when disconnected, sent on reconnect
13. **PWA** with service worker caching
14. **Android APK** via Capacitor

## Tech Summary
| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS |
| Backend | Node.js, Express, TypeScript, Socket.IO |
| Database | SQLite (dev) / PostgreSQL (prod) via Prisma ORM |
| Auth | JWT (access + refresh tokens, HttpOnly cookies) |
| Push | Firebase Cloud Messaging (optional) |
| Calling | WebRTC with STUN/TURN |
| Mobile | Capacitor 8 (Android) |
| Deploy | Docker Compose (Nginx + Express + SQLite) |

## Project Location
The actual source code lives at:
```
/home/karan/Development/projects/chat_app/
```
Within that directory:
- `server/` — Backend Express + Socket.IO server
- `client/` — React frontend (Vite + Capacitor Android)
- `soundsforcall/` — Call audio assets (ringtone, callertone, messagetone)
- `firebase/` — Firebase service account credentials (gitignored in production)
- Docker compose at root level

## README
A comprehensive README exists at `/home/karan/Development/projects/chat_app/README.md` with setup instructions, API docs, seed accounts, and testing instructions.
