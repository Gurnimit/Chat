# SECURITY.md

## Authentication Security
- JWT access tokens (15min expiry) + refresh tokens (90day expiry)
- Refresh tokens stored in HttpOnly cookies (not accessible via JavaScript)
- `sameSite: strict` prevents CSRF attacks
- `secure: true` in production (HTTPS only)
- bcrypt password hashing (salt rounds: 10)
- Timing attack prevention: dummy bcrypt comparison when user not found
- Default dev secrets blocked in production mode
- All sessions invalidated on password reset

## Input Validation
- Rate limiting on all auth endpoints
- Rate limiting on file uploads
- Rate limiting on Socket.IO events (message spam, call abuse, ICE flood)
- Friend request rate limiting (5/min, 20/day)
- Profile lookup rate limiting (15/min)
- Minimum password length: 6 characters

## File Upload Security
- Two-layer validation: MIME type + magic byte signature
- Files saved as `.tmp` first, renamed after validation
- Executables, HTML, JavaScript, SVGs, PHP blocked
- Text files scanned for malicious content
- CSP sandbox header on static file serving
- Content-Disposition headers per file type
- Category-based size limits enforced

## API Security
- Helmet middleware: CSP, X-Content-Type-Options, Referrer-Policy
- CORS whitelist-based origin validation
- JWT verification on all authenticated routes
- Block relationships enforced on messages and calls
- Privacy settings enforced (who can see profile photo, last seen, who can call, who can send friend requests)

## Data Protection
- PII redaction in logs (passwords, tokens, SDP, ICE candidates, emails)
- Correlation ID tracking for request tracing
- No stack traces leaked in API responses
- Generic error messages ("Internal server error")
- Account enumeration prevention (forgot-password returns same response regardless)

## WebSocket Security
- JWT authentication on socket connection
- Per-socket rate limiting
- Block relationship enforcement on message sending
- Block relationship enforcement on call initiation

## Known Security Concerns
1. **No HTTPS** — Docker setup uses HTTP; needs TLS termination proxy in production
2. **Default secrets in dev** — While blocked in production, dev mode uses predictable secrets
3. **SQLite in Docker** — Production Docker compose still uses SQLite
4. **No CSRF protection beyond SameSite cookies** — No CSRF tokens
5. **Rate limit bypass** — `x-bypass-rate-limit` header allows bypassing all rate limits
6. **No input sanitization** — No XSS protection beyond React's default escaping
7. **Firebase service account** — Stored as JSON file in repo (should be in secrets management)
8. **No account lockout** — No progressive delay or lockout after failed login attempts
9. **No session invalidation on password change** — Only on password reset
10. **Debug endpoints exposed** — `/api/debug/mobile-write-test` endpoints have no auth
