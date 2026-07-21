# AUTHENTICATION.md

## Method
JWT (JSON Web Token) based authentication with access/refresh token rotation.

## Token Architecture

### Access Token
- **Lifespan**: 15 minutes
- **Payload**: `{ userId }`
- **Secret**: `ACCESS_TOKEN_SECRET` env var
- **Usage**: Sent via `Authorization: Bearer <token>` header
- **Verification**: `server/src/middleware/auth.middleware.ts`

### Refresh Token
- **Lifespan**: 90 days
- **Payload**: `{ userId, jti: randomUUID() }`
- **Secret**: `REFRESH_TOKEN_SECRET` env var
- **Storage**: HttpOnly cookie (`sameSite: strict`, `secure` in production) + DB Session record
- **Rotation**: On each refresh, old token is deleted, new one issued

## Session Management
- Sessions stored in `Session` database table
- Each refresh token creates a new session row
- On logout: session row deleted
- On password reset: ALL sessions deleted for the user
- Grace period: 30-second window where old refresh token still works after rotation

## Auth Flow

### Registration
1. POST `/api/auth/register` with email, username, password
2. Password hashed with bcrypt (salt rounds: 10)
3. Public ID generated (VC-XXXXXXXX format)
4. Profile auto-created with DiceBear avatar
5. NotificationPreference auto-created
6. If email verification required: verification token generated, no tokens issued
7. If no verification required: access + refresh tokens issued

### Login
1. POST `/api/auth/login` with loginIdentifier (email or username) + password
2. Dummy bcrypt comparison if user not found (timing attack prevention)
3. Email verification check (bypassed for test accounts: alice, bob, charlie)
4. Access + refresh tokens issued
5. Profile updated: `isOnline = true`, `lastSeen = now()`

### Token Refresh
1. POST `/api/auth/refresh` with cookie or body refresh token
2. Check grace period cache (in-memory)
3. Check active refreshes map (coalescing parallel refreshes)
4. Verify JWT signature
5. Verify session exists in DB and not expired
6. Delete old session, create new session
7. Old token kept in grace period for 30 seconds

### Logout
1. POST `/api/auth/logout`
2. Delete session from DB
3. Clean up grace period cache
4. Clear cookie

## Security Measures

### Password Security
- bcrypt with salt rounds 10
- Minimum password length: 6 characters (client-side validation)

### Timing Attack Prevention
- Dummy bcrypt comparison when user not found during login

### Account Enumeration Prevention
- Forgot password returns same response regardless of email existence
- Dummy delay (50ms) when user not found to match DB write latency

### Token Security
- Access token short-lived (15 min)
- Refresh token in HttpOnly cookie (not accessible via JavaScript)
- `sameSite: strict` prevents CSRF
- `secure: true` in production (HTTPS only)
- Default dev secrets blocked in production mode

### Rate Limiting
- Login: 15 attempts per 15 minutes
- Register: 5 attempts per 15 minutes
- General auth: 100 requests per 15 minutes

### Multi-tab Synchronization
- StorageEvent listener syncs auth state across tabs
- Refresh queue coalesces parallel refresh attempts

## Client-Side Token Management
- Access token stored in `localStorage` for Axios interceptor
- `hasSession` flag in `localStorage` for session restoration
- Axios response interceptor auto-refreshes on 403
- Request interceptor adds `Authorization` header

## Email Verification
- Token-based verification (crypto.randomBytes(32))
- Verification link logged to server console (no email service configured)
- Test accounts (alice, bob, charlie) auto-verified

## Password Reset
- Token-based reset (crypto.randomBytes(32))
- Token expires after 1 hour
- Reset link logged to server console (no email service configured)
- All sessions invalidated on successful reset
