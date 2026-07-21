# Linux Migration Audit Report — Velvet Chat

This document summarizes the audit and environment verification findings for Velvet Chat following the migration of the development environment to Kali Linux.

---

## Executive Summary

The migration of Velvet Chat to Kali Linux has been thoroughly audited. The core services (Frontend, Backend, Database, and Firebase FCM) are fully operational after resolving node dependency permission issues and adjusting path configurations from Windows to Linux. 

However, the native Android build environment is currently **not configured** on this Kali Linux machine.

| Component | Status | Details |
| :--- | :--- | :--- |
| **Frontend Compilation** | **PASSED** | Clean build of React client assets completed successfully. |
| **Backend Service** | **PASSED** | Node Express & Socket.IO server running successfully on port 5000. |
| **Database State** | **PASSED** | SQLite database accessible via Prisma with all pre-existing records intact. |
| **Firebase FCM** | **PASSED** | Verified secure TLS handshake and token cleanup via Firebase Admin SDK. |
| **ICE & TURN Signaling** | **PASSED** | Verified `/api/chats/ice-config` endpoint correctly serving STUN/TURN credentials. |
| **Android Build Env** | **FAILED** | Android SDK, platform tools, and build tools are not installed on the system. |

---

## Phase 1 & 2 Findings

### 1. Frontend Audit (`client/`)
* **Node Modules Permissions**: The direct copy from the previous Windows environment stripped execute permissions from local binaries in `node_modules/.bin`.
  * *Resolution*: Cleared `node_modules` and performed a clean `npm install` to rebuild system symlinks and restore executable permissions.
* **TypeScript Compilation & Build**: 
  * *Command Run*: `npm run build`
  * *Result*: **Success** (Output: `dist/assets/index-SORgja6b.js` ~694 kB).
* **Vite Configuration**: Verified Vite proxy paths pointing correctly to `http://localhost:5000` for `/api`, `/uploads`, and `/socket.io`.

### 2. Backend Audit (`server/`)
* **Environment Paths**: Found Windows-style path in `.env` for `FIREBASE_SERVICE_ACCOUNT_PATH` (`C:\Users\karan\Desktop\chat-app\firebase\service-account.json`).
  * *Resolution*: Updated path to Linux format: `/home/karan/Desktop/chat_app/firebase/service-account.json`.
* **Database Connection & Server Run**:
  * *Command Run*: `npm run dev` (running in background)
  * *Result*: **Success**. Server successfully binds to port 5000 and connects to the SQLite database.
* **Prisma Client**: Generated successfully via `npm run db:generate`.

### 3. Database Audit
Verified that SQLite loads correctly via Prisma Client without migrating or altering existing schemas. Pre-existing records are fully intact:
* **Total Registered Users**: 46
* **Total Conversations (Chats)**: 6
* **Total Messages**: 63
* **Total Friend Requests**: 15
* **Total Friendships**: 10
* **Total Call Logs**: 16

### 4. Firebase Cloud Messaging (FCM)
* **Configuration**: Verified `firebase/service-account.json` exists and parses successfully.
* **Handshake Verification**: Ran a real-time FCM handshake test (`verify-fcm-handshake.cjs`).
  * *Result*: **PASSED**. Successfully authenticated with the real Google FCM API, dispatched a push request, handled token rejection, and automatically cleaned up the invalid token from the database.

### 5. WebRTC Calling & ICE/TURN Signaling
* **Endpoint Status**: Verified `/api/chats/ice-config` via `verify-ice-config.cjs`.
  * *Result*: **PASSED**. Correctly retrieves Google public STUN servers and Metered.ca TURN servers with active credentials.
* **Signaling Mechanics**: Audited Socket.IO calling channels (`call_user`, `accept_call`, `reject_call`, `ice_candidate`, `end_call`).
  * Rate-limits are set at 100 call initiations per 30 seconds and 100 ICE candidate exchanges per 10 seconds in development.
  * Privacy preferences (`whoCanCallMe`) and blocking rules are correctly enforced at the socket registration layer.

---

## Phase 3 — Android Build Environment Audit

The Android build environment on this Kali Linux machine is **incomplete** and cannot currently compile an APK:

1. **Java Development Kit**: Installed (OpenJDK 25.0.3).
2. **Android SDK**: **Not Found** in standard paths (`/usr/lib/android-sdk` or `~/Android/Sdk`).
3. **Command-line Tools**: `adb` and `sdkmanager` are not installed.
4. **Environment Variables**: `ANDROID_HOME` and `JAVA_HOME` are not exported.

### Recommendations to Configure Android Build Environment:
To build the Capacitor Android app, run the following commands on Kali Linux:
```bash
# 1. Install Android SDK platform tools and command line tools
sudo apt update
sudo apt install -y android-sdk adb sdkmanager

# 2. Export environment variables (add to ~/.bashrc or ~/.zshrc)
export ANDROID_HOME=/usr/lib/android-sdk
export PATH=$PATH:$ANDROID_HOME/tools/bin:$ANDROID_HOME/platform-tools

# 3. Accept SDK licenses and install build tools
yes | sdkmanager --licenses
sdkmanager "platforms;android-34" "build-tools;34.0.0"
```

---

## Phase 4 — Next Steps & Action Plan

Once the Android build environment is set up and the platform/runner issue is resolved, we will proceed with:
1. **Fixing Calling System Verification**: Run a full WebRTC end-to-end test using real browser contexts.
2. **Mobile UI Redesign**: Implement separate bottom navigation (Chats, Friends, Calls, Settings) optimized for mobile layouts.
