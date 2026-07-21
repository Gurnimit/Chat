# FOLDER_STRUCTURE.md

```
chat_app/                              # Project root
├── .env.example                       # Environment variable template
├── .gitignore                         # Git ignore rules
├── README.md                          # Project documentation
├── docker-compose.yml                 # Docker orchestration (backend + frontend)
│
├── client/                            # React frontend application
│   ├── android/                       # Capacitor Android native project
│   │   ├── app/                       # Android app module
│   │   ├── build.gradle               # Android build config
│   │   ├── capacitor-cordova-android-plugins/  # Capacitor plugins
│   │   └── gradle/                    # Gradle wrapper
│   ├── public/                        # Static assets
│   │   ├── manifest.json              # PWA manifest
│   │   ├── sw.js                      # Service worker for PWA caching
│   │   └── sounds/                    # Call notification audio files
│   │       ├── ringtone.mp3
│   │       ├── callertone.mp3
│   │       └── messagetone.mp3
│   ├── src/                           # React source code
│   │   ├── main.tsx                   # Entry point, Service Worker registration
│   │   ├── App.tsx                    # Root component, auth routing
│   │   ├── index.css                  # Global styles, Tailwind imports, animations
│   │   ├── types/index.ts             # TypeScript type definitions
│   │   ├── context/
│   │   │   ├── AuthContext.tsx         # Authentication state, token refresh, Axios config
│   │   │   └── SocketContext.tsx       # WebSocket connection lifecycle
│   │   ├── hooks/
│   │   │   ├── useWebRTCCall.ts       # Complete WebRTC call logic (~1400 lines)
│   │   │   └── useLocalStorage.ts     # Persistent state hook
│   │   ├── pages/
│   │   │   ├── Login.tsx              # Auth pages (login, register, forgot/reset password)
│   │   │   ├── ChatDashboard.tsx      # Main desktop dashboard (~2000+ lines)
│   │   │   ├── MobileDashboard.tsx    # Mobile layout orchestrator
│   │   │   └── TabletDashboard.tsx    # Tablet layout
│   │   └── components/
│   │       └── mobile/                # Mobile-specific UI components
│   │           ├── Chats/
│   │           │   ├── MobileChatsScreen.tsx
│   │           │   ├── MobileConversationScreen.tsx
│   │           │   ├── MobileChatDetailsScreen.tsx
│   │           │   ├── MobileCallsScreen.tsx
│   │           │   └── MobileCallOverlay.tsx
│   │           ├── Friends/
│   │           │   ├── MobileFriendsScreen.tsx
│   │           │   └── MobileQRScreen.tsx
│   │           ├── Settings/
│   │           │   └── MobileSettingsScreen.tsx
│   │           ├── Shared/
│   │           │   ├── Avatar.tsx
│   │           │   ├── MobileHeader.tsx
│   │           │   ├── MobileSearchOverlay.tsx
│   │           │   ├── MobileFloatingButton.tsx
│   │           │   └── MobileBottomSheet.tsx
│   │           └── Navigation/
│   │               └── BottomNavigation.tsx
│   ├── capacitor.config.json          # Capacitor config (com.velvet.chat)
│   ├── vite.config.ts                 # Vite config with dev proxy
│   ├── tailwind.config.js             # Tailwind theme (brand colors, dark theme)
│   ├── postcss.config.js
│   ├── index.html                     # HTML entry point
│   ├── tsconfig.json
│   ├── package.json
│   ├── Dockerfile                     # Multi-stage: Node build → Nginx serve
│   ├── nginx.conf                     # Reverse proxy config
│   └── test-*.cjs / test-*.js         # Integration test scripts
│
├── server/                            # Express + Socket.IO backend
│   ├── src/
│   │   ├── index.ts                   # Server entry: Express, Socket.IO, middleware, routes
│   │   ├── routes/
│   │   │   ├── auth.routes.ts         # Register, login, logout, refresh, profile, device-token
│   │   │   ├── chat.routes.ts         # Chats CRUD, messages, groups, ICE config
│   │   │   ├── friend.routes.ts       # Friend requests, blocking, QR profile lookup
│   │   │   ├── call.routes.ts         # Call log CRUD, call history
│   │   │   ├── notification.routes.ts # Notification CRUD, preferences
│   │   │   ├── upload.routes.ts       # File upload with magic-byte validation
│   │   │   └── observability.routes.ts # Health check, metrics
│   │   ├── sockets/
│   │   │   └── chat.socket.ts         # WebSocket event handlers (860+ lines)
│   │   ├── middleware/
│   │   │   ├── auth.middleware.ts      # JWT token verification middleware
│   │   │   └── correlation.middleware.ts # Request correlation ID tracking
│   │   ├── utils/
│   │   │   ├── db.ts                  # Prisma client singleton
│   │   │   ├── token.ts               # JWT generation/verification
│   │   │   ├── logger.ts              # Structured logging with PII redaction
│   │   │   ├── notification.ts        # Push notification service (FCM + Mock)
│   │   │   ├── privacy.ts             # Profile sanitization based on privacy prefs
│   │   │   ├── rateLimit.ts           # In-memory rate limiters (friend req, profile lookup)
│   │   │   ├── publicId.ts            # VC-XXXXXXXX public ID generation
│   │   │   └── file_validator.ts      # Magic byte file type validation
│   │   ├── list-logs.ts               # Utility: list users and call logs
│   │   └── backfill-preferences.ts    # Utility: backfill missing NotificationPreferences
│   ├── prisma/
│   │   ├── schema.prisma              # Database schema (15 models)
│   │   ├── seed.ts                    # Seed data (3 test users)
│   │   ├── dev.db                     # SQLite database file
│   │   └── migrations/
│   │       ├── 20260606000000_init/
│   │       │   └── migration.sql      # Initial schema
│   │       └── 20260606180724_add_user_lifecycle_columns/
│   │           └── migration.sql      # Email verification + password reset columns
│   ├── uploads/                       # File upload storage directory
│   ├── Dockerfile                     # Multi-stage: Node build → Node run
│   ├── package.json
│   ├── tsconfig.json
│   └── test-msg-db.js                 # Test script for message DB operations
│
├── soundsforcall/                     # Call audio files (source copies)
│   ├── ringtone.mp3
│   ├── callertone.mp3
│   └── messagetone.mp3
│
├── firebase/
│   └── service-account.json           # Firebase service account (for FCM)
│
├── chat_app/
│   └── LINUX_MIGRATION_AUDIT.md       # Migration audit notes
│
├── archives/                          # Archived files
│
├── node-temp/                         # Temporary node files
│
├── ANDROID_READINESS_REPORT.md        # Existing reports (various audit/status docs)
├── CALL_SIGNALING_AUDIT.md
├── CODEBASE_AUDIT_REPORT.md
├── DEPLOYMENT.md
├── FINAL_APK_READINESS_REPORT.md
├── RELEASE_NOTES.md
└── [other .md report files]
```
