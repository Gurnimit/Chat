# FRONTEND.md

## Technology Stack
- **Framework**: React 18.3.1
- **Language**: TypeScript ^5.2.2
- **Build Tool**: Vite ^5.2.11
- **Styling**: Tailwind CSS ^3.4.3 + Custom CSS
- **Icons**: Lucide React ^0.379.0
- **HTTP Client**: Axios ^1.6.8
- **WebSocket**: Socket.IO Client ^4.7.5
- **Mobile**: Capacitor 8 (Android)

## Entry Point
`client/src/main.tsx` → `App.tsx`

## Architecture

### State Management
- **React Context API** (no Redux/Zustand)
- **AuthProvider**: User state, tokens, login/register/logout, profile updates
- **SocketProvider**: WebSocket connection, connection status
- **useWebRTCCall hook**: Complete call state machine (~1400 lines)
- **useState/useRef**: Component-local state
- **localStorage**: Persistent settings (sound prefs, device ID, backend URL, offline queue)

### Responsive Layout
```
App.tsx
├── AuthProvider
│   ├── if not logged in → Login.tsx
│   └── if logged in → SocketProvider → ChatDashboard.tsx
│       ├── if viewport < 768px → MobileDashboard.tsx
│       ├── if viewport 768-1024px → TabletDashboard.tsx
│       └── if viewport > 1024px → Desktop layout (inline in ChatDashboard)
```

### Key Components

#### Login.tsx (701 lines)
- Multi-step registration (step 1: credentials, step 2: profile, step 3: success)
- Login form
- Forgot password flow
- Reset password flow
- Email verification handling
- Hidden server config (7x gear click)
- Deep link handling for email verification

#### ChatDashboard.tsx (2000+ lines)
- Main application hub managing ALL state
- Desktop layout with sidebar, chat area, details panel
- Orchestrates: chat list, messages, file upload, search, friendship, calls, notifications, QR codes, settings
- Contains MobileDashboard and TabletDashboard as child layouts
- Handles all Socket.IO event listeners
- Manages offline message queue

#### MobileDashboard.tsx (542 lines)
- Tab-based navigation: Chats, Friends, Calls, Settings
- Fullscreen conversation view
- Native Android back button handling
- Badge counts on tabs

#### TabletDashboard.tsx (404 lines)
- Split-panel layout: sidebar + conversation + details
- Similar to desktop but optimized for tablet viewport

### Mobile Components (14 files)
| Component | Purpose |
|-----------|---------|
| MobileChatsScreen | Chat list with search |
| MobileConversationScreen | Message thread view |
| MobileChatDetailsScreen | Chat info/attachments panel |
| MobileCallsScreen | Call history list |
| MobileCallOverlay | Full-screen call UI |
| MobileFriendsScreen | Friends/requests/blocked list |
| MobileQRScreen | QR code display + camera scanner |
| MobileSettingsScreen | Settings/preferences |
| MobileHeader | App bar with title + actions |
| MobileSearchOverlay | User directory search |
| MobileFloatingButton | FAB component |
| MobileBottomSheet | Bottom sheet modal |
| Avatar | Reusable avatar with online indicator |
| BottomNavigation | Tab bar with badge counts |

### Custom Hooks
| Hook | Purpose |
|------|---------|
| `useWebRTCCall` | Complete WebRTC call management (audio/video, ICE, quality monitoring, fallback, diagnostics) |
| `useLocalStorage` | Persistent state with localStorage |

### Key Features

#### QR Code Friend System
- Generate QR with `qrcode` library (payload: `{ type: 'friend', publicId, version: 1 }`)
- Scan QR with camera using `jsQR` library
- Gallery import for QR scanning
- Deep link handling: `/user/VC-XXXXXXXX`
- Share invite via native share sheet (Capacitor) or clipboard

#### File Upload
- Client-side validation: MIME type checking, size limits per category
- Two-layer defense: client MIME + server magic bytes
- Progress tracking
- Attachment preview in chat

#### WebRTC Calling
- Audio and video call support
- STUN/TURN server configuration from server
- ICE candidate exchange via Socket.IO
- Connection quality monitoring (RTT, packet loss)
- Automatic video quality scaling based on network conditions
- Automatic fallback to audio-only on poor connection
- ICE restart on connection failure (up to 3 attempts)
- Audio routing (speakerphone, device selection)
- Video diagnostics and black-screen recovery

#### Offline Support
- Offline message queue stored in localStorage
- Messages queued when socket disconnected
- Queue processed on reconnect
- Service worker for PWA caching

## Build & Dev
```bash
cd client
npm install
npm run dev      # Vite dev server on :5173, proxies /api to :5000
npm run build    # tsc + vite build → dist/
npm run preview  # Preview production build
```

## PWA
- Service worker at `public/sw.js`
- Caches static assets, falls back to `/index.html` for offline
- Manifest at `public/manifest.json` (standalone, portrait, dark theme)

## Capacitor (Android)
- Config: `capacitor.config.json` (appId: com.velvet.chat)
- Native project: `client/android/`
- Uses `@capacitor/push-notifications`, `@capacitor/app`, `@capacitor/share`, `@capacitor/browser`
- Custom backend URL detection for native vs web
