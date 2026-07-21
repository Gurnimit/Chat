# FEATURE_AUDIT.md

## Authentication

### User Registration
- **Status**: Complete
- **Description**: Multi-step registration with email, username, password, optional display name
- **Files**: `server/src/routes/auth.routes.ts`, `client/src/pages/Login.tsx`
- **APIs**: POST `/api/auth/register`
- **DB Tables**: User, Profile, NotificationPreference, Session
- **Notes**: Email verification optional (env-configurable). Test accounts auto-verified.

### User Login
- **Status**: Complete
- **Description**: Login with email or username + password
- **Files**: `server/src/routes/auth.routes.ts`, `client/src/context/AuthContext.tsx`
- **APIs**: POST `/api/auth/login`
- **Notes**: Timing attack prevention via dummy bcrypt comparison

### Token Refresh
- **Status**: Complete
- **Description**: Automatic access token refresh with grace period and coalescing
- **Files**: `server/src/routes/auth.routes.ts`, `client/src/context/AuthContext.tsx`
- **APIs**: POST `/api/auth/refresh`
- **Notes**: 30-second grace period, in-memory deduplication of parallel refreshes

### Password Reset
- **Status**: Complete (but no email delivery)
- **Description**: Token-based password reset flow
- **Files**: `server/src/routes/auth.routes.ts`, `client/src/pages/Login.tsx`
- **APIs**: POST `/api/auth/forgot-password`, POST `/api/auth/reset-password`
- **Known Issues**: Reset link only logged to console, not sent via email

### Email Verification
- **Status**: Complete (but no email delivery)
- **Description**: Token-based email verification
- **Files**: `server/src/routes/auth.routes.ts`, `client/src/pages/Login.tsx`
- **Known Issues**: Verification link only logged to console

### Profile Management
- **Status**: Complete
- **Description**: Edit display name, bio, avatar URL, username
- **Files**: `server/src/routes/auth.routes.ts`, `client/src/context/AuthContext.tsx`
- **APIs**: PUT `/api/auth/profile`, GET `/api/auth/me`
- **DB Tables**: User, Profile

### Change Password
- **Status**: Complete
- **Description**: Change password while logged in
- **Files**: `server/src/routes/auth.routes.ts`
- **APIs**: POST `/api/auth/change-password`

---

## Real-time Messaging

### Direct Messaging
- **Status**: Complete
- **Description**: 1-on-1 direct chat between friends
- **Files**: `server/src/routes/chat.routes.ts`, `server/src/sockets/chat.socket.ts`, `client/src/pages/ChatDashboard.tsx`
- **APIs**: POST `/api/chats/direct`, Socket `send_message`
- **DB Tables**: Chat, ChatMember, Message, Attachment
- **Notes**: Friendship required to create direct chat

### Group Messaging
- **Status**: Complete
- **Description**: Group chat with owner/admin/member roles
- **Files**: `server/src/routes/chat.routes.ts`, `client/src/pages/ChatDashboard.tsx`
- **APIs**: POST `/api/chats/group`, PUT `/api/chats/group/:id`, POST `/api/chats/group/:id/members`, DELETE `/api/chats/group/:id/members/:userId`, POST `/api/chats/group/:id/transfer-owner`
- **DB Tables**: Chat, ChatMember
- **Known Issues**: No group chat message search

### Message Reactions
- **Status**: Complete
- **Description**: Toggle emoji reactions on messages
- **Files**: `server/src/sockets/chat.socket.ts`, `client/src/pages/ChatDashboard.tsx`
- **Socket**: `react_message`
- **DB Tables**: MessageReaction

### Message Edit/Delete
- **Status**: Complete
- **Description**: Edit own messages, soft-delete own messages
- **Files**: `server/src/routes/chat.routes.ts`, `server/src/sockets/chat.socket.ts`
- **APIs**: PUT `/api/messages/:messageId`, DELETE `/api/messages/:messageId`
- **Socket**: `edit_message`, `delete_message`

### Message Reply
- **Status**: Complete
- **Description**: Reply to a specific message
- **Files**: `server/src/sockets/chat.socket.ts`
- **DB Tables**: Message (replyToId)

### Typing Indicators
- **Status**: Complete
- **Description**: Real-time typing indicator with 2s debounce
- **Files**: `server/src/sockets/chat.socket.ts`, `client/src/pages/ChatDashboard.tsx`
- **Socket**: `typing`, `user_typing`

### Read/Delivery Receipts
- **Status**: Complete
- **Description**: Sent → Delivered → Read receipt chain
- **Files**: `server/src/sockets/chat.socket.ts`
- **Socket**: `mark_read`, `mark_delivered`, `messages_read`, `messages_delivered`
- **DB Tables**: MessageRead, MessageStatus
- **Known Issues**: Redundant tables (MessageRead + MessageStatus)

### Offline Message Queue
- **Status**: Partial
- **Description**: Messages queued when disconnected, sent on reconnect
- **Files**: `client/src/pages/ChatDashboard.tsx`
- **Notes**: Queue stored in localStorage, processed on socket reconnect. No offline message history.

---

## File Upload & Media

### File Upload
- **Status**: Complete
- **Description**: Upload images, videos, audio, documents, archives
- **Files**: `server/src/routes/upload.routes.ts`, `server/src/utils/file_validator.ts`
- **APIs**: POST `/api/upload`
- **Security**: Two-layer validation (MIME + magic bytes)

### Attachment Display
- **Status**: Complete
- **Description**: Display uploaded files inline in chat
- **Files**: `client/src/pages/ChatDashboard.tsx`
- **Notes**: Images displayed inline, other files as download links

### Avatar Upload
- **Status**: Partial
- **Description**: Upload profile picture during registration
- **Files**: `client/src/pages/Login.tsx`
- **Known Issues**: Avatar uploaded client-side as data URL preview, not actually uploaded to server during registration. Upload happens via general file upload in settings.

---

## Friend System

### Friend Requests
- **Status**: Complete
- **Description**: Send, accept, reject, cancel friend requests
- **Files**: `server/src/routes/friend.routes.ts`, `client/src/pages/ChatDashboard.tsx`
- **APIs**: POST `/api/friends/request`, POST `/api/friends/request/:id/accept`, POST `/api/friends/request/:id/reject`, DELETE `/api/friends/request/:id/cancel`

### Block/Unblock
- **Status**: Complete
- **Description**: Block/unblock users, removes existing friendship
- **Files**: `server/src/routes/friend.routes.ts`
- **APIs**: POST `/api/friends/block`, DELETE `/api/friends/block/:blockedId`
- **Notes**: Block enforced on messages and calls

### QR Code Friend Adding
- **Status**: Complete
- **Description**: Generate QR code, scan via camera or gallery, deep link handling
- **Files**: `client/src/pages/ChatDashboard.tsx`, `client/src/components/mobile/Friends/MobileQRScreen.tsx`
- **Libraries**: qrcode, jsQR
- **Notes**: Camera scanning, gallery import, deep link handling

### Public Profile Lookup
- **Status**: Complete
- **Description**: Look up user profile by public ID (for QR codes)
- **Files**: `server/src/routes/friend.routes.ts`
- **APIs**: GET `/api/friends/public-profile/:publicId`
- **Rate Limited**: 15 lookups per minute

---

## WebRTC Calling

### Audio Calling
- **Status**: Complete
- **Description**: Peer-to-peer audio calls with WebRTC
- **Files**: `client/src/hooks/useWebRTCCall.ts`, `server/src/sockets/chat.socket.ts`
- **Socket**: `call_user`, `accept_call`, `reject_call`, `end_call`, `ice_candidate`

### Video Calling
- **Status**: Complete
- **Description**: Peer-to-peer video calls with adaptive quality
- **Files**: `client/src/hooks/useWebRTCCall.ts`
- **Notes**: Adaptive quality based on connection (RTT, packet loss), automatic audio fallback

### Call Quality Monitoring
- **Status**: Complete
- **Description**: RTT, packet loss monitoring with automatic quality adjustment
- **Files**: `client/src/hooks/useWebRTCCall.ts`
- **Notes**: 4-tier quality: good, fair, poor, very_poor. Auto fallback to audio on very_poor.

### ICE Restart
- **Status**: Complete
- **Description**: Automatic ICE restart on connection failure (up to 3 attempts)
- **Files**: `client/src/hooks/useWebRTCCall.ts`, `server/src/sockets/chat.socket.ts`

### Call Logging
- **Status**: Complete
- **Description**: Call history with status tracking (completed, missed, rejected, cancelled, failed)
- **Files**: `server/src/routes/call.routes.ts`, `server/src/sockets/chat.socket.ts`
- **APIs**: POST `/api/calls/log`, GET `/api/calls/history`
- **DB Tables**: CallLog

### Call Sounds
- **Status**: Complete
- **Description**: Ringtone (incoming), callertone (outgoing), message tone
- **Files**: `client/src/hooks/useWebRTCCall.ts`
- **Audio**: `client/public/sounds/`

### Audio Routing
- **Status**: Complete
- **Description**: Speakerphone toggle, audio output device selection
- **Files**: `client/src/hooks/useWebRTCCall.ts`
- **Notes**: Uses setSinkId API where supported

---

## Push Notifications

### FCM Integration
- **Status**: Complete (but requires Firebase setup)
- **Description**: Firebase Cloud Messaging for Android push notifications
- **Files**: `server/src/utils/notification.ts`, `client/src/pages/ChatDashboard.tsx`
- **APIs**: POST `/api/auth/device-token`
- **DB Tables**: DeviceToken, Notification

### Notification Preferences
- **Status**: Complete
- **Description**: Per-user notification and privacy preferences
- **Files**: `server/src/routes/notification.routes.ts`
- **APIs**: GET/PUT `/api/notifications/preferences`
- **DB Tables**: NotificationPreference

### Notification Center
- **Status**: Complete
- **Description**: Paginated notification list with read/unread tracking
- **Files**: `server/src/routes/notification.routes.ts`, `client/src/pages/ChatDashboard.tsx`
- **APIs**: GET `/api/notifications`, PUT `/api/notifications/read-all`, PUT `/api/notifications/:id/read`

---

## Privacy & Security

### Privacy Settings
- **Status**: Complete
- **Description**: Control who can see profile photo, last seen, who can call, who can send friend requests
- **Files**: `server/src/utils/privacy.ts`, `server/src/routes/notification.routes.ts`
- **DB Tables**: NotificationPreference

### Profile Sanitization
- **Status**: Complete
- **Description**: Server-side profile data filtering based on privacy settings
- **Files**: `server/src/utils/privacy.ts`

### Rate Limiting
- **Status**: Complete
- **Description**: HTTP and WebSocket rate limiting
- **Files**: `server/src/index.ts`, `server/src/utils/rateLimit.ts`, `server/src/sockets/chat.socket.ts`

### File Validation
- **Status**: Complete
- **Description**: Two-layer file type validation (MIME + magic bytes)
- **Files**: `server/src/utils/file_validator.ts`, `server/src/routes/upload.routes.ts`

---

## Observability

### Health Check
- **Status**: Complete
- **Description**: System health and database connectivity check
- **Files**: `server/src/routes/observability.routes.ts`
- **APIs**: GET `/api/observability/health`

### Metrics
- **Status**: Complete
- **Description**: Aggregate application metrics (users, messages, chats, notifications)
- **Files**: `server/src/routes/observability.routes.ts`
- **APIs**: GET `/api/observability/metrics`

### Correlation Tracing
- **Status**: Complete
- **Description**: Request correlation ID tracking via AsyncLocalStorage
- **Files**: `server/src/middleware/correlation.middleware.ts`, `server/src/utils/logger.ts`

### Client Diagnostics
- **Status**: Complete
- **Description**: Client-side diagnostic logging to server
- **Files**: `client/src/hooks/useWebRTCCall.ts`
- **APIs**: POST `/api/diagnostics/log`

---

## Platform

### PWA (Progressive Web App)
- **Status**: Complete
- **Description**: Service worker, manifest, installable
- **Files**: `client/public/sw.js`, `client/public/manifest.json`
- **Notes**: Basic cache-first strategy

### Android (Capacitor)
- **Status**: Complete
- **Description**: Native Android app via Capacitor
- **Files**: `client/android/`, `client/capacitor.config.json`
- **Notes**: Push notifications, back button handling, app state changes

### Responsive Design
- **Status**: Complete
- **Description**: Desktop, tablet, and mobile layouts
- **Files**: `client/src/pages/ChatDashboard.tsx`, `MobileDashboard.tsx`, `TabletDashboard.tsx`
- **Notes**: Viewport-based layout switching at 768px and 1024px breakpoints

---

## Missing Features

### Email Delivery
- **Status**: Missing
- **Description**: No email service configured for verification/password reset
- **Impact**: Verification and reset links only logged to console

### Message Search
- **Status**: Missing
- **Description**: No search functionality within chat messages

### End-to-End Encryption
- **Status**: Missing
- **Description**: Messages stored in plaintext on server

### Message Forwarding
- **Status**: Missing

### Voice Messages
- **Status**: Missing

### Video Messages
- **Status**: Missing

### Contact Import
- **Status**: Missing

### User Deletion / Account Deactivation
- **Status**: Missing

### Data Export
- **Status**: Missing

### Admin Panel
- **Status**: Missing
