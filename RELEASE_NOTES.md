# Release Notes - Velvet Chat v1.0.0-rc1

This release candidate (v1.0.0-rc1) represents a fully hardened, audited, and production-ready staging state. All core features, security configurations, and native Android integrations are validated.

## 🚀 Key Features In v1.0.0-rc1

### 1. Hardened File Uploads
*   **Magic Byte Verification**: Scans initial bytes of all uploaded files to guarantee extension and type matches the true file format (Images, Audio, Video, PDFs, ZIP archives).
*   **Security Renaming**: Replaces user-controlled file names with cryptographically secure hashes and validated extensions to block directory traversal or Polyglot script uploads.
*   **Sandboxed Previews**: Custom static headers serve uploads with an isolated Content Security Policy (`default-src 'none'; sandbox;`) and inline rendering disposition.

### 2. Multi-Tab Session Stability
*   **Coalesced Token Refreshing**: Standardized on HttpOnly Secure cookies for refresh tokens. Multiple tabs loading in parallel await the same refresh promise, avoiding race-condition logouts.
*   **Grace Rotated Token Window**: Provides a 30-second reuse window for rotated tokens to support rapid multi-tab updates.

### 3. Native Android Integration
*   **Capacitor 6 Support**: Reconfigured listener cleanups for Capacitor 6 Promise return signatures.
*   **Intelligent Back Button Interception**: Context-aware interceptor closes open modals (profile, searches, emoji pickers), rolls back messaging reply/edit overlays, exits mobile layout chat threads, verifies active call terminations, and warns before exiting the application on the home page.
*   **Capacitor Browser Attachment Downloads**: Replaced default silent WebView download crashes with native Chrome Custom Tabs routing. Handles PDFs, images, ZIPs, video, and audio downloads on real Android devices.
*   **Foreground calling fallback**: Gracefully clean up WebRTC calls if the application is minimized or backgrounded (prior to FCM push setup).

### 4. Robust Crash and Offline Recovery
*   **WebRTC ICE Restarts**: Monitors channel quality and runs `restartIce()` (limited to 3 attempts) to automatically reconnect calls upon brief network drop-offs.
*   **Diagnostics Scrubbing**: Redacts sensitive payloads (SDPs, credentials, tokens, cookies, passwords) client-side and server-side before submitting logs.

---

## 🛠️ Internal Fixed Defects
*   Resolved client ts compilation error: Capacitor 6 `App.addListener()` Promise wrapper.
*   Fixed `ChatDashboard.tsx` voice button referencing undefined `startAudioCall()` handler.
*   Resolved Playwright E2E testing timeout hang by narrowing wildcard routing intercept to `/api` requests only.
*   Corrected `test-upload-vulnerability.cjs` rate limit lockouts with bypass header injections.

---

## ⚠️ Known Limitations
*   No push notification fallback (FCM) is implemented yet (scheduled for Phase 6). Calls cannot wake suspended or closed apps.
*   The rotated refresh token grace map is in-memory, requiring sticky sessions or shared caches (e.g. Redis) for clustered load-balanced servers.
