# RUNTIME_BUGS.md

## RUNTIME-001: Unblock Endpoint Throws Prisma Error

| Field | Value |
|-------|-------|
| **Bug ID** | RUNTIME-001 |
| **Title** | Unblock endpoint throws PrismaClientKnownRequestError when block record doesn't exist |
| **Severity** | Medium |
| **Priority** | P2 |
| **Expected Result** | Unblock should succeed gracefully (idempotent) or return a clear "not found" message |
| **Actual Result** | Server throws unhandled Prisma error: "Record to delete does not exist" at `friend.routes.ts:494` |
| **Steps to Reproduce** | 1. Block user A. 2. User A sends friend request (rejected by block check which deletes requests). 3. Try to unblock user A. 4. Server throws Prisma error. |
| **Evidence** | Server log: `PrismaClientKnownRequestError: Invalid prisma.block.delete() invocation... An operation failed because it depends on one or more records that were required but not found. Record to delete does not exist.` |
| **Console Logs** | `[ERROR] Unblock user error: PrismaClientKnownRequestError: Record to delete does not exist` |
| **Server Logs** | Full stack trace at friend.routes.ts:494 |
| **Files Likely Responsible** | `server/src/routes/friend.routes.ts` (lines 481-515, unblock endpoint) |
| **Root Cause** | The `prisma.block.delete()` call uses `delete()` which throws if record not found. Should use `deleteMany()` or wrap in try-catch with graceful handling. |
| **Confidence** | High — reproduced during runtime testing |

---

## RUNTIME-002: Frontend Hardcoded Backend URL Bypasses Vite Proxy

| Field | Value |
|-------|-------|
| **Bug ID** | RUNTIME-002 |
| **Title** | Frontend `getBackendURL()` returns `http://192.168.10.82:5000` in Vite dev mode, bypassing proxy |
| **Severity** | Critical |
| **Priority** | P1 |
| **Expected Result** | In Vite dev mode, API calls should go through the Vite proxy at `localhost:5173` |
| **Actual Result** | Axios instance configured with `baseURL: http://192.168.10.82:5000/api`. Browser makes direct requests to that IP, bypassing the Vite proxy entirely. |
| **Steps to Reproduce** | 1. Open browser DevTools Network tab. 2. Navigate to `http://localhost:5173`. 3. Try to log in. 4. Observe API requests going to `192.168.10.82:5000` instead of `localhost:5173/api`. |
| **Evidence** | Source code at `client/src/context/AuthContext.tsx:26`: `return isCapacitorNative ? 'http://192.168.10.82:5000' : (import.meta.env.DEV ? 'http://192.168.10.82:5000' : window.location.origin)` |
| **Network Requests** | All API requests in browser would show `192.168.10.82:5000/api/*` instead of `localhost:5173/api/*` |
| **Files Likely Responsible** | `client/src/context/AuthContext.tsx` (line 26, `getBackendURL` function) |
| **Root Cause** | Both the Capacitor and DEV branches return the same hardcoded IP. DEV branch should return `window.location.origin`. |
| **Confidence** | High — confirmed by code review and proxy behavior analysis |

---

## Confirmed from Previous Code Review

The following bugs from the code review phase were confirmed during runtime testing:

| Bug ID | Title | Runtime Status |
|--------|-------|---------------|
| BUG-002 | No server-side password validation | **CONFIRMED** — User with 1-char password created in DB |
| BUG-003 | Debug endpoints without auth | **CONFIRMED** — Record created without authentication |
| BUG-004 | Rate limit bypass in non-production | **CONFIRMED** — Rate limiting works but bypass header active |
| BUG-005 | Seed missing NotificationPreference | **PARTIALLY MITIGATED** — Auto-created on first GET /preferences access |
| BUG-009 | Password change no session invalidation | Not tested (would require multi-device test) |
| BUG-010 | Email delivery not implemented | **CONFIRMED** — Registration returns emailVerificationRequired but no email sent |

## Bugs Disproved or Not Reproduced

| Bug ID | Title | Runtime Status |
|--------|-------|---------------|
| BUG-006 | No React Error Boundary | Cannot test without browser execution |
| BUG-007 | No socket disconnect indicator | Cannot test without browser execution |
| BUG-008 | switch_to_video client missing | Cannot test without browser + WebRTC |
| BUG-011 | Service worker stale content | Cannot test without browser PWA |
| BUG-012 | N+1 query in chat list | Would require SQL logging to verify at runtime |
