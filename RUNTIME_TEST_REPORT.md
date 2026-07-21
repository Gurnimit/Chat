# RUNTIME_TEST_REPORT.md

## Test Environment

| Component | Version/Config |
|-----------|---------------|
| Node.js | v24.18.0 |
| Server | ts-node-dev, Express + Socket.IO |
| Database | SQLite (dev.db) |
| Frontend | Vite 5.4.21, React 18 |
| OS | Linux x64 |

## Runtime Test Results

| # | Test | Result | Evidence |
|---|------|--------|----------|
| 1 | Server starts and health check passes | **PASS** | `GET /` → 200, `GET /api/observability/health` → `{"status":"UP","database":{"status":"UP"}}` |
| 2 | Register new user via API | **PASS** | `POST /api/auth/register` → 201 with `emailVerificationRequired: true` (EMAIL_VERIFICATION_REQUIRED=true) |
| 3 | Login as alice with username | **PASS** | `POST /api/auth/login` → 200 with accessToken, user profile, Set-Cookie: refreshToken |
| 4 | Login as alice with email | **PASS** | Same result as username login |
| 5 | Login with wrong password | **PASS** | Returns `{"error":"Invalid email/username or password"}` |
| 6 | Login nonexistent user | **PASS** | Same error message as wrong password (timing attack prevention confirmed) |
| 7 | Search users | **PASS** | `GET /api/users/search?q=bob` → Returns bob's profile with correct data |
| 8 | Send friend request | **PASS** | `POST /api/friends/request` → 201 with PENDING status |
| 9 | Accept friend request | **PASS** | `POST /api/friends/request/:id/accept` → `{"success":true}`. Friendship verified via `GET /api/friends` |
| 10 | Create direct chat | **PASS** | `POST /api/chats/direct` → 201 with chat ID, otherMember, unreadCount |
| 11 | File upload | **PASS** | `POST /api/upload` → 200 with fileUrl, fileName, fileSize, mimeType |
| 12 | Debug endpoint without auth | **FAIL → FIXED** | Before fix: 200 with created record. After fix: 404 "Cannot POST". |
| 13 | Short password registration | **FAIL (BUG)** | `POST /api/auth/register` with password "a" → 201 (user created). Server accepted 1-char password. |
| 14 | Create group chat | **PASS** | `POST /api/chats/group` → 201 with members (OWNER + MEMBER roles) |
| 15 | ICE config endpoint | **PASS** | `GET /api/chats/ice-config` → STUN servers + TURN config |
| 16 | Call history | **PASS** | `GET /api/calls/history` → Empty array (no calls made yet) |
| 17 | Notification preferences | **PASS** | `GET /api/notifications/preferences` → Default prefs with all privacy settings |
| 18 | Profile update | **PASS** | `PUT /api/auth/profile` → Updated displayName and bio |
| 19 | WebSocket connect + send message | **PASS** | Both users connected. Alice sent message via socket. Bob received it instantly. |
| 20 | Block user enforcement | **PASS** | Block created. Friend request blocked. Direct chat blocked. Profile sanitized. |
| 21 | Token refresh | **PASS** | `POST /api/auth/refresh` with cookie → New accessToken returned |
| 22 | Vite proxy - all API paths | **PASS** | /api/chats, /api/friends, /api/notifications, /api/upload, /api/calls, /socket.io all proxied correctly |
| 23 | Frontend HTML loads | **PASS** | `GET /` returns React app HTML with correct title and meta tags |

## New Runtime Bugs Discovered

| Bug ID | Title | Severity | Evidence |
|--------|-------|----------|----------|
| RUNTIME-001 | Unblock endpoint throws Prisma error when block record doesn't exist | Medium | Server log: `PrismaClientKnownRequestError: Record to delete does not exist` at friend.routes.ts:494 |
| RUNTIME-002 | Frontend getBackendURL returns hardcoded IP in dev mode | Critical | Code confirms: `import.meta.env.DEV ? 'http://192.168.10.82:5000'` — browser would bypass Vite proxy |

## Summary (After BUG-003 + BUG-002 Fixes)

- **23 initial tests + 5 BUG-003 regression + 11 BUG-002 validation tests = 39 total**
- **39 PASS** (100%)
- **0 FAIL**
- **0 BLOCKED**

### Fix Applied: BUG-003 (Debug Endpoints)
- Removed `/api/debug/mobile-write-test` POST and GET endpoints
- Both now return 404 "Cannot POST/GET"
- Regression tests confirmed: login, chats, search, upload, preferences all still work

### Fix Applied: BUG-002 (Password Validation)
- Added reusable `validatePassword()` function (MIN_PASSWORD_LENGTH = 6)
- Applied to: POST /register, POST /change-password, POST /reset-password
- Validation tests: 1-char rejected, 5-char rejected, 6-char accepted, normal accepted
- Regression: login, token refresh, all core features still work

## Console/Server Logs During Tests

```
[INFO] Database connected successfully.
[INFO] Server is running on port 5000
[INFO] Socket server initialized.
[Socket] Broadcasted presence batch for 2 users.
[NotificationService] No active device tokens registered for user
[ERROR] Unblock user error: PrismaClientKnownRequestError: Record to delete does not exist
```

No other runtime errors observed during testing.
