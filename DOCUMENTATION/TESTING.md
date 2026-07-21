# TESTING.md

## Current State
**No formal test suite exists.** There are no unit tests, integration tests, or end-to-end tests configured in the project.

## Test Scripts Found
Several manual test/verification scripts exist at the project root:

| Script | Purpose |
|--------|---------|
| `test-socket.js` / `test-socket.cjs` | Basic socket connection test |
| `test-webrtc-calling.cjs` | WebRTC calling flow test |
| `test-webrtc-video-calling.cjs` | Video calling test |
| `test-advanced-calling.cjs` | Advanced calling scenarios |
| `test-friend-spam-qr.cjs` | Friend request spam and QR test |
| `test-history-notifications.cjs` | History and notification test |
| `test-production-ready.cjs` | Production readiness check |
| `test-refresh-grace.cjs` | Token refresh grace period test |
| `test-upload-vulnerability.cjs` | Upload security test |
| `verify-fcm-handshake.cjs` | Firebase FCM handshake verification |
| `verify-ice-config.cjs` | ICE configuration verification |
| `pre-turn-verify.cjs` | Pre-TURN verification |

These are Node.js scripts meant to be run manually against a running server.

## Server-Side Diagnostics
- `/api/observability/health` — Database and system health check
- `/api/observability/metrics` — Aggregate counts (users, messages, chats)
- `/api/debug/mobile-write-test` — Database write test
- `server/src/list-logs.ts` — Utility to list users and call logs

## Client-Side Diagnostics
- WebRTC connection quality monitoring (RTT, packet loss)
- Video black-screen recovery diagnostics
- Client diagnostic logging to server via `/api/diagnostics/log`
- `liveDiagnostics` state in useWebRTCCall hook

## What's Missing
- No Jest/Vitest configuration
- No React Testing Library setup
- No Playwright test files (Playwright is in devDependencies but unused)
- No CI/CD pipeline
- No linting configuration (ESLint referenced in package.json scripts but no config)
- No code coverage reporting
