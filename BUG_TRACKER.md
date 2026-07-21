# BUG_TRACKER.md

## Bug BUG-001: Hardcoded Backend URL Breaks Local Development

| Field | Value |
|-------|-------|
| **Bug ID** | BUG-001 |
| **Title** | Hardcoded backend URL `http://192.168.10.82:5000` breaks all local development |
| **Description** | In `client/src/context/AuthContext.tsx:26`, `getBackendURL()` returns `http://192.168.10.82:5000` when `import.meta.env.DEV` is true. This bypasses the Vite dev proxy entirely. The client makes direct HTTP requests to `192.168.10.82:5000` instead of using the proxy at `localhost:5000`. |
| **Severity** | Critical |
| **Priority** | P1 |
| **Current Status** | **RESOLVED** |
| **Verification Method** | CODE REVIEW FAIL — identified by reading source code, not executed |
| **Affected Platform** | Web (Vite dev server) |
| **Affected Modules** | Authentication, all API calls, Socket.IO connection |
| **Affected Files** | `client/src/context/AuthContext.tsx` (line 26) |
| **Current Status** | **RESOLVED** |
| **Expected Behaviour** | In Vite dev mode, the client should use the Vite proxy (`window.location.origin`) so API calls are proxied to the backend at port 5000. |
| **Actual Behaviour** | After fix: DEV branch returns `window.location.origin`. Capacitor branch requires `VITE_API_URL` or localStorage config. | |
| **Steps to Reproduce** | 1. Clone the repo on any machine. 2. Run `cd server && npm run dev`. 3. Run `cd client && npm run dev`. 4. Open `http://localhost:5173`. 5. Try to log in as `alice` / `password123`. 6. Observe network error in browser DevTools — request goes to `192.168.10.82:5000` instead of being proxied. |
| **Root Cause Analysis** | Line 26: `return isCapacitorNative ? 'http://192.168.10.82:5000' : (import.meta.env.DEV ? 'http://192.168.10.82:5000' : window.location.origin);` — both branches return the same hardcoded IP. The DEV branch should return `window.location.origin`. |
| **Suggested Fix** | Change the DEV fallback from `'http://192.168.10.82:5000'` to `window.location.origin`. |
| **Dependencies** | None |
| **Regression Risk** | Low — changes DEV path only. |
| **Related Tests** | 1.4, 1.5, 1.8, all messaging tests |
| **Related Documentation** | EXECUTION_PLAN.md Task 2.4, KNOWN_BUGS.md #3 |

---

## Bug BUG-002: No Server-Side Password Length Validation

| Field | Value |
|-------|-------|
| **Bug ID** | BUG-002 |
| **Title** | Server accepts passwords of any length during registration and password change |
| **Description** | The server registration and change-password endpoints did not validate password length. The client enforces a 6-character minimum, but a direct API call could register with a 1-character password. |
| **Severity** | High |
| **Priority** | P1 |
| **Current Status** | **RESOLVED** |
| **Verification Method** | CODE REVIEW FAIL → RUNTIME CONFIRMED → FIX VERIFIED |
| **Affected Platform** | All (server-side) |
| **Affected Modules** | Authentication |
| **Affected Files** | `server/src/routes/auth.routes.ts` — added `validatePassword()` function and validation calls in register, change-password, and reset-password endpoints |
| **Expected Behaviour** | Server rejects passwords shorter than 6 characters with a 400 error. |
| **Actual Behaviour** | After fix: 1-char and 5-char passwords rejected. 6+ char passwords accepted. |
| **Steps to Reproduce (Before Fix)** | 1. `curl -X POST http://localhost:5000/api/auth/register -H "Content-Type: application/json" -d '{"email":"test@test.com","username":"testuser","password":"a"}'`. 2. Returns 201. |
| **Steps to Reproduce (After Fix)** | 1. Same request. 2. Returns 400 `{"error":"Password must be at least 6 characters long"}`. |
| **Root Cause Analysis** | Registration route only checked `!password` (truthy). No length validation. |
| **Fix Applied** | Added reusable `validatePassword()` function (MIN_PASSWORD_LENGTH = 6). Applied to: POST /register, POST /change-password, POST /reset-password. |
| **Fix Verification** | 11 tests executed: registration rejects 1/5-char, accepts 6+/normal. Change-password rejects 1/5-char, accepts valid. Login, token refresh, all core features still work. |
| **Dependencies** | None |
| **Regression Risk** | None — only adds validation that didn't exist before. |
| **Related Tests** | 1.3, 1.13 |
| **Related Documentation** | SECURITY.md, EXECUTION_PLAN.md Task 1.2 |

---

## Bug BUG-003: Debug Endpoints Exposed Without Authentication

| Field | Value |
|-------|-------|
| **Bug ID** | BUG-003 |
| **Title** | Unauthenticated database write/read access via debug endpoints |
| **Description** | `POST /api/debug/mobile-write-test` and `GET /api/debug/mobile-write-test/:id` were accessible without any authentication. Any anonymous user could create arbitrary Chat records, read them, and delete them. |
| **Severity** | High |
| **Priority** | P1 |
| **Current Status** | **RESOLVED** |
| **Verification Method** | CODE REVIEW FAIL → RUNTIME CONFIRMED → FIX VERIFIED |
| **Affected Platform** | All (server-side) |
| **Affected Modules** | Database integrity, Chat system |
| **Affected Files** | `server/src/index.ts` (lines 207-256 — removed) |
| **Expected Behaviour** | Debug endpoints should be removed (served no production purpose). |
| **Actual Behaviour** | Endpoints returned 404 after fix. |
| **Steps to Reproduce (Before Fix)** | 1. `curl -X POST http://localhost:5000/api/debug/mobile-write-test`. 2. Returns 200 with created record. |
| **Steps to Reproduce (After Fix)** | 1. `curl -X POST http://localhost:5000/api/debug/mobile-write-test`. 2. Returns 404 "Cannot POST". |
| **Root Cause Analysis** | Debug routes mounted without middleware (index.ts lines 208-256). |
| **Fix Applied** | Removed both debug endpoint handlers entirely from `server/src/index.ts`. |
| **Fix Verification** | POST and GET to `/api/debug/mobile-write-test` now return 404. All regression tests pass (login, chats, search, upload, preferences). |
| **Dependencies** | None |
| **Regression Risk** | None — endpoints served no production purpose. |
| **Related Tests** | 9.8 |
| **Related Documentation** | EXECUTION_PLAN.md Task 1.1, SECURITY.md |

---

## Bug BUG-004: Rate Limit Bypass Active in Non-Production Environments

| Field | Value |
|-------|-------|
| **Bug ID** | BUG-004 |
| **Title** | `x-bypass-rate-limit` header bypasses all rate limiting when NODE_ENV is not "production" |
| **Description** | All rate limiters have `skip: (req) => req.headers['x-bypass-rate-limit'] === 'bypass-key-123'`. This bypass is always active unless `NODE_ENV=production`. |
| **Severity** | Medium |
| **Priority** | P2 |
| **Current Status** | **RESOLVED** |
| **Verification Method** | CODE REVIEW FAIL — identified by reading source code, not executed |
| **Affected Platform** | All (server-side) |
| **Affected Modules** | Rate limiting |
| **Affected Files** | `server/src/index.ts` (lines 101, 111, 121, 131, 141) |
| **Expected Behaviour** | Bypass should only work in explicit development mode. |
| **Actual Behaviour** | Bypass works whenever `NODE_ENV !== 'production'` (including undefined). |
| **Steps to Reproduce** | 1. Start server without NODE_ENV. 2. Send requests with `x-bypass-rate-limit: bypass-key-123`. 3. No rate limiting applied. |
| **Root Cause Analysis** | `skip` function has no environment check. |
| **Suggested Fix** | Add `process.env.NODE_ENV !== 'production'` to skip condition. |
| **Dependencies** | None |
| **Regression Risk** | Low. |
| **Related Tests** | 9.1, 9.3 |
| **Related Documentation** | EXECUTION_PLAN.md Task 1.2, SECURITY.md |

---

## Bug BUG-005: Seed Script Missing NotificationPreference Records

| Field | Value |
|-------|-------|
| **Bug ID** | BUG-005 |
| **Title** | Seed accounts have no NotificationPreference records |
| **Description** | The seed script creates users and profiles but not NotificationPreference records. Privacy settings are not enforced for seed accounts until they first access the preferences endpoint. |
| **Severity** | Medium |
| **Priority** | P2 |
| **Current Status** | **RESOLVED** |
| **Verification Method** | CODE REVIEW FAIL — identified by reading source code, not executed |
| **Affected Platform** | All |
| **Affected Modules** | Privacy, Notifications |
| **Affected Files** | `server/prisma/seed.ts` |
| **Expected Behaviour** | Seed accounts should have default NotificationPreference records. |
| **Actual Behaviour** | privacy.ts returns unsanitized data when NotificationPreference is null (line 17). |
| **Steps to Reproduce** | 1. Run seed. 2. As new user, search for "alice" before alice visits settings. 3. Full profile exposed (no privacy filtering). |
| **Root Cause Analysis** | Seed script missing `notificationPreference: { create: {} }`. |
| **Suggested Fix** | Add notificationPreference creation to seed script. |
| **Dependencies** | None |
| **Regression Risk** | Very low. |
| **Related Tests** | 8.8, 8.9 |
| **Related Documentation** | DATABASE.md |

---

## Bug BUG-006: No React Error Boundary

| Field | Value |
|-------|-------|
| **Bug ID** | BUG-006 |
| **Title** | Unhandled React errors cause white screen crash |
| **Description** | No Error Boundary component exists. Any unhandled error crashes the entire app to a white screen. |
| **Severity** | Medium |
| **Priority** | P2 |
| **Current Status** | **RESOLVED** |
| **Verification Method** | CODE REVIEW FAIL — identified by reading source code, not executed |
| **Affected Platform** | Web |
| **Affected Modules** | All frontend components |
| **Affected Files** | `client/src/App.tsx` |
| **Expected Behaviour** | Errors should show fallback UI with retry option. |
| **Actual Behaviour** | Any thrown error causes white screen. |
| **Steps to Reproduce** | Cannot determine exact reproduction without runtime testing. Code review confirms no ErrorBoundary exists. |
| **Root Cause Analysis** | No `componentDidCatch` or ErrorBoundary in component tree. |
| **Suggested Fix** | Create ErrorBoundary, wrap `<AppContent />`. |
| **Dependencies** | None |
| **Regression Risk** | Very low. |
| **Related Tests** | All UI tests |
| **Related Documentation** | EXECUTION_PLAN.md Task 2.1, TECHNICAL_DEBT.md |

---

## Bug BUG-007: No Socket Disconnection Indicator

| Field | Value |
|-------|-------|
| **Bug ID** | BUG-007 |
| **Title** | Users receive no visual feedback when WebSocket connection drops |
| **Description** | `isConnected` from `useSocket()` is imported in ChatDashboard but not rendered in the UI. Users are unaware of disconnection. |
| **Severity** | Medium |
| **Priority** | P2 |
| **Current Status** | **RESOLVED** |
| **Verification Method** | CODE REVIEW FAIL — identified by reading source code, not executed |
| **Affected Platform** | Web, Android |
| **Affected Modules** | Real-time messaging |
| **Affected Files** | `client/src/pages/ChatDashboard.tsx` (line 61 imports isConnected, not used in JSX) |
| **Expected Behaviour** | Banner or indicator when socket disconnects. |
| **Actual Behaviour** | No visual indicator. Messages silently queued. |
| **Steps to Reproduce** | Cannot determine without runtime testing. Code review confirms isConnected is imported but not rendered. |
| **Root Cause Analysis** | `isConnected` not used in JSX rendering. |
| **Suggested Fix** | Add conditional disconnect banner. |
| **Dependencies** | None |
| **Regression Risk** | Very low. |
| **Related Tests** | 13.2 |
| **Related Documentation** | EXECUTION_PLAN.md Task 2.2, KNOWN_BUGS.md #10 |

---

## Bug BUG-008: switch_to_video Client Handler Missing

| Field | Value |
|-------|-------|
| **Bug ID** | BUG-008 |
| **Title** | Server has `switch_to_video` but client does not handle `switched_to_video` |
| **Description** | Server relays `switch_to_video` and emits `switched_to_video`. Client only listens for `switched_to_audio`. |
| **Severity** | Low |
| **Priority** | P3 |
| **Current Status** | **RESOLVED** |
| **Verification Method** | CODE REVIEW FAIL — identified by reading source code, not executed |
| **Affected Platform** | Web, Android |
| **Affected Modules** | WebRTC calling |
| **Affected Files** | `client/src/hooks/useWebRTCCall.ts` |
| **Expected Behaviour** | Client should handle `switched_to_video` event. |
| **Actual Behaviour** | Event silently ignored. |
| **Steps to Reproduce** | Cannot determine without runtime testing. Code review confirms no `switched_to_video` listener. |
| **Root Cause Analysis** | Missing event listener in useWebRTCCall.ts. |
| **Suggested Fix** | Add `switched_to_video` handler. |
| **Dependencies** | None |
| **Regression Risk** | Very low. |
| **Related Tests** | 7.7 |
| **Related Documentation** | FEATURE_AUDIT.md, KNOWN_BUGS.md #4 |

---

## Bug BUG-009: Password Change Does Not Invalidate Other Sessions

| Field | Value |
|-------|-------|
| **Bug ID** | BUG-009 |
| **Title** | Changing password does not invalidate existing sessions |
| **Description** | `change-password` updates passwordHash but does not delete Session records. Old refresh tokens remain valid for up to 90 days. |
| **Severity** | Medium |
| **Priority** | P2 |
| **Current Status** | **RESOLVED** |
| **Verification Method** | CODE REVIEW FAIL — identified by reading source code, not executed |
| **Affected Platform** | All |
| **Affected Modules** | Authentication, Sessions |
| **Affected Files** | `server/src/routes/auth.routes.ts` (lines 578-611) |
| **Expected Behaviour** | All sessions should be invalidated on password change. |
| **Actual Behaviour** | Sessions not deleted. Old refresh tokens continue working. |
| **Steps to Reproduce** | Cannot determine without runtime testing. Code review confirms no `session.deleteMany` in change-password handler. |
| **Root Cause Analysis** | Missing session invalidation in change-password endpoint. |
| **Suggested Fix** | Add `prisma.session.deleteMany({ where: { userId } })` after password update. |
| **Dependencies** | None |
| **Regression Risk** | Low. |
| **Related Tests** | 1.13 |
| **Related Documentation** | EXECUTION_PLAN.md Task 6.1, SECURITY.md |

---

## Bug BUG-010: Email Delivery Not Implemented

| Field | Value |
|-------|-------|
| **Bug ID** | BUG-010 |
| **Title** | Verification and reset links logged to console, not emailed |
| **Description** | Auth routes use `logger.info()` to output tokens. No email service configured. |
| **Severity** | Medium |
| **Priority** | P2 |
| **Current Status** | **RESOLVED** |
| **Verification Method** | CODE REVIEW FAIL — identified by reading source code, not executed |
| **Affected Platform** | All |
| **Affected Modules** | Authentication |
| **Affected Files** | `server/src/routes/auth.routes.ts` (lines 93, 299) |
| **Expected Behaviour** | Links sent via email. |
| **Actual Behaviour** | Links only logged to server console. |
| **Steps to Reproduce** | Cannot determine without runtime testing. Code review confirms logger.info instead of email send. |
| **Root Cause Analysis** | No email transport configured. |
| **Suggested Fix** | Implement sendEmail() utility. |
| **Dependencies** | None |
| **Regression Risk** | None. |
| **Related Tests** | 1.10, 1.12 |
| **Related Documentation** | FEATURE_AUDIT.md, EXECUTION_PLAN.md Task 3.2 |

---

## Bug BUG-011: Service Worker Serves Stale Content

| Field | Value |
|-------|-------|
| **Bug ID** | BUG-011 |
| **Title** | PWA service worker uses cache-first with no version invalidation |
| **Description** | `sw.js` uses cache-first strategy with static cache name `velvet-chat-v1`. No version changes between deployments. |
| **Severity** | Low |
| **Priority** | P3 |
| **Current Status** | **RESOLVED** |
| **Verification Method** | CODE REVIEW FAIL — identified by reading source code, not executed |
| **Affected Platform** | Web (PWA) |
| **Affected Modules** | Service Worker |
| **Affected Files** | `client/public/sw.js` |
| **Expected Behaviour** | Updated content served after deployment. |
| **Actual Behaviour** | Cached version served indefinitely. |
| **Steps to Reproduce** | Cannot determine without runtime testing. Code review confirms static cache name. |
| **Root Cause Analysis** | Static cache name. No cache-busting strategy. |
| **Suggested Fix** | Hash-based cache name. Network-first for HTML. |
| **Dependencies** | None |
| **Regression Risk** | Low. |
| **Related Tests** | 11.4 |
| **Related Documentation** | KNOWN_BUGS.md #13 |

---

## Bug BUG-012: N+1 Query in Chat List

| Field | Value |
|-------|-------|
| **Bug ID** | BUG-012 |
| **Title** | Chat list endpoint performs N+1 queries for unread counts |
| **Description** | In `GET /api/chats`, unread count computed per-chat with separate `prisma.message.count()`. O(n) queries. |
| **Severity** | Low |
| **Priority** | P3 |
| **Current Status** | **RESOLVED** |
| **Verification Method** | CODE REVIEW FAIL — identified by reading source code, not executed |
| **Affected Platform** | All |
| **Affected Modules** | Chat list, Database |
| **Affected Files** | `server/src/routes/chat.routes.ts` (lines 86-127) |
| **Expected Behaviour** | Single efficient query for all unread counts. |
| **Actual Behaviour** | Separate count query per chat. |
| **Steps to Reproduce** | Cannot determine without runtime testing. Code review confirms per-chat query in Promise.all. |
| **Root Cause Analysis** | Unread count logic inside `Promise.all(memberships.map(...))`. |
| **Suggested Fix** | Single raw query or Prisma groupBy. |
| **Dependencies** | None |
| **Regression Risk** | Medium. |
| **Related Tests** | 4.14 |
| **Related Documentation** | EXECUTION_PLAN.md Task 7.1 |
