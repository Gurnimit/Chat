# KNOWN_BUGS.md

## Based on Code Analysis

### 1. ChatDashboard.tsx is a God Component
- **File**: `client/src/pages/ChatDashboard.tsx`
- **Issue**: ~2000+ lines managing ALL application state, all socket listeners, all API calls
- **Impact**: Extremely difficult to maintain, test, or debug. Any state change triggers re-renders across the entire dashboard.

### 2. Redundant Read Receipt Tables
- **File**: `server/prisma/schema.prisma`
- **Issue**: Both `MessageRead` and `MessageStatus` tables track read receipts
- **Impact**: Duplicate data, potential inconsistency

### 3. Hardcoded Backend URL in AuthContext
- **File**: `client/src/context/AuthContext.tsx:26`
- **Issue**: `getBackendURL()` falls back to `http://192.168.10.82:5000` in dev/native mode
- **Impact**: Breaks on different network configurations

### 4. Switch_to_video Event Handler Added but UI Not Connected
- **File**: `edit_socket.js` (the script in chat_app directory)
- **Issue**: `switch_to_video` socket event exists server-side but the client's `useWebRTCCall.ts` only handles `switch_to_audio`
- **Impact**: Video-to-video switching is a no-op on the client

### 5. No Error Boundary
- **Issue**: No React Error Boundary component exists
- **Impact**: Unhandled errors crash the entire app

### 6. Massive Prop Drilling in MobileDashboard
- **File**: `client/src/pages/MobileDashboard.tsx`
- **Issue**: 60+ props drilled from ChatDashboard through MobileDashboard to child components
- **Impact**: Extremely fragile, any prop change cascades through the entire component tree

### 7. Potential Memory Leak in Socket Event Listeners
- **File**: `client/src/pages/ChatDashboard.tsx`
- **Issue**: Socket event listeners re-registered on every `selectedChat` change without cleanup guarantee
- **Impact**: Potential duplicate event handlers

### 8. Debug Endpoints Exposed Without Auth
- **File**: `server/src/index.ts:208-256`
- **Issue**: `/api/debug/mobile-write-test` endpoints are accessible without authentication
- **Impact**: Any user can create/read/delete Chat records

### 9. Rate Limit Bypass Header in Production
- **File**: `server/src/index.ts:101`
- **Issue**: `x-bypass-rate-limit: bypass-key-123` bypasses ALL rate limits
- **Impact**: If the header value is known, all rate limiting can be circumvented

### 10. No Graceful Error Recovery for Socket Disconnection
- **Issue**: When socket disconnects, UI shows no visual indicator to the user
- **Impact**: User may think messages are being sent when they're actually queued

### 11. In-Memory Rate Limiters Lost on Restart
- **File**: `server/src/utils/rateLimit.ts`
- **Issue**: All rate limiting state is in-memory Maps, lost on server restart
- **Impact**: Rate limits reset on every deployment/restart

### 12. In-Memory activeCalls Map Lost on Restart
- **File**: `server/src/sockets/chat.socket.ts:12`
- **Issue**: Active call tracking is in-memory, lost on server restart
- **Impact**: If server restarts during a call, call logs won't be properly finalized

### 13. Service Worker Caching May Serve Stale Content
- **File**: `client/public/sw.js`
- **Issue**: Cache-first strategy with no version invalidation beyond name change
- **Impact**: Users may see old versions until they manually clear cache

### 14. No Input Sanitization for Group Chat Names
- **Issue**: Group names and descriptions stored as-is
- **Impact**: Potential XSS if rendered without escaping (React mitigates this by default)
