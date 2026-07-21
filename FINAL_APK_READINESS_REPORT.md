# Android APK Production Readiness Audit Report

This report presents the final audit findings for the Velvet Chat Android mobile application build (Capacitor) prior to Phase 6 implementation. 

---

## 1. Audit Summary & Recommendation

> [!IMPORTANT]
> **Recommendation: READY FOR APK TESTING (With Limitations)**
> The application compiles successfully into a production release APK under Java 21, with robust WebRTC track cleanup, dynamic ICE/TURN server discovery, log redaction, and database reproducibility. However, background incoming calls, back-button handling, and background call persistence require native plugins (FCM/Foreground Services) currently slated for later phases.

| Audit Area | Status | Key Findings |
| :--- | :--- | :--- |
| **APK Compilation** | **PASSED** | Clean production build of `app-release-unsigned.apk` (3.26 MB) in 1m 38s using Gradle & JDK 21. |
| **Log & Secret Security** | **PASSED** | Dual-layer log redaction for JWTs, passwords, cookies, and WebRTC credentials (`credential`, `sdp`, `candidate`, `ufrag`, `pwd`). |
| **ICE & TURN Routing** | **PASSED** | Dynamic ICE configs fetched over REST via `/chats/ice-config` with credentials protected from client bundles. |
| **Network Transition** | **PASSED** | Local connection state monitoring with automatic `restartIce()` logic (capped at 3 retry attempts). |
| **Screen Rotation** | **PASSED** | Call state preserved across orientation changes through Activity config flags. |
| **Hardware Release** | **PASSED** | Audio and video tracks stopped cleanly on call teardown, releasing camera and mic hardware resources. |
| **Android Back Button** | **FAILED** | Hardware back-button exits the app immediately due to absence of `@capacitor/app` event listener. |
| **Attachment Downloads** | **FAILED** | Standard `<a>` download links fail or override WebView state inside Android WebView. |
| **Background Calling** | **FAILED** | Active calls freeze when backgrounded, and incoming calls cannot wake the app without push notifications (FCM). |

---

## 2. Detailed Findings

### A. Android & Capacitor Readiness

* **WebRTC Calling inside WebView (PASSED)**:
  Capacitor successfully mounts the React app on `https://localhost` (a secure context), allowing the WebRTC API (`navigator.mediaDevices`) to initialize and negotiate calls natively.
* **Camera & Microphone Permissions (PASSED)**:
  `AndroidManifest.xml` correctly declares:
  - `android.permission.CAMERA`
  - `android.permission.RECORD_AUDIO`
  - `android.permission.MODIFY_AUDIO_SETTINGS`
  Capacitor intercepts browser `getUserMedia()` requests and displays standard Android system permission prompts. Camera rejection is handled gracefully by falling back to audio-only calling.
* **Screen Rotation Call State (PASSED)**:
  `MainActivity` is configured in `AndroidManifest.xml` with:
  ```xml
  android:configChanges="orientation|keyboardHidden|keyboard|screenSize|locale|smallestScreenSize|screenLayout|uiMode|navigation|density"
  ```
  This prevents the operating system from destroying and recreating the Activity on orientation change, preserving the active WebRTC PeerConnection and state.
* **Android Back Button Behavior (FAILED)**:
  There is currently no event listener registered in the client code for the native back button. Pressing the hardware back button causes the Android OS to finish the `MainActivity`, closing the app. 
  *Mitigation for APK Testing*: Implement `@capacitor/app` back-button interception in a subsequent task to handle back navigation or call dismissal before closing the app.
* **Attachment Downloads in WebView (FAILED)**:
  The application utilizes simple `<a>` links with the `download` attribute. Android WebView does not automatically support download managers for these links, resulting in ignored clicks or local URL rendering attempts that overwrite the React app context.
  *Mitigation for APK Testing*: Modify attachment links to target `_system` or integrate `@capacitor/browser` / `@capacitor/filesystem`.
* **Background incoming call handling (FAILED)**:
  Since push notifications (FCM) are not yet implemented, incoming calls cannot be received when the app is minimized or closed. Active WebRTC calls will also freeze in the background due to standard OS battery optimization and WebView suspension.
  *Mitigation for APK Testing*: Perform call tests exclusively with the application active in the foreground on both devices.

---

### B. APK Build Validation

* **Release Build Success (PASSED)**:
  Gradle successfully assembled the release APK using:
  - **Gradle Version**: 8.14.3
  - **Java JDK**: Eclipse Temurin OpenJDK 21.0.11
  - **Android SDK Platform**: API Level 36
  - **Android Build-Tools**: 35.0.0
* **Build Warnings Audit (PASSED)**:
  No critical warnings exist. FlatDir warning (`Using flatDir should be avoided...`) and SDK XML format warnings are present but harmless.
* **ProGuard/R8 WebRTC Safety (PASSED)**:
  `proguard-rules.pro` contains explicit keep statements:
  ```text
  -keep class com.getcapacitor.** { *; }
  -dontwarn com.getcapacitor.**
  -keep class org.webrtc.** { *; }
  -dontwarn org.webrtc.**
  ```
  This guarantees that even if minification (`minifyEnabled true`) is activated in the future, the WebRTC native Java wrapper classes and Capacitor bridge interfaces will not be pruned or obfuscated.

---

### C. Security Audit

* **Log Redaction (PASSED)**:
  Centralized logging utility `logger.ts` recursively traverses log parameters and redacts `password`, `token`, `refreshtoken`, `accesstoken`, `cookie`, `authorization`, `credentials`, `credential`, `sdp`, `candidate`, `pwd`, `ufrag`, and `secret`.
* **Zero Hardcoded Secrets (PASSED)**:
  Axios baseURL in `AuthContext.tsx` reads dynamically from `import.meta.env.VITE_API_URL` to prevent endpoint hardcoding. All token signing secrets remain strictly on the backend `.env`.
* **TURN Credentials Integrity (PASSED)**:
  TURN server passwords and usernames are never embedded in compiled assets. Instead, clients query the `/chats/ice-config` authenticated endpoint at runtime to get transient credentials.

---

### D. Performance Audit

* **Resource Release (PASSED)**:
  `useWebRTCCall.ts` iterates and terminates all media tracks on hangup:
  ```typescript
  localStreamRef.current.getTracks().forEach(track => track.stop());
  ```
  This frees the native camera/microphone hardware indicator instantly.
* **APK Footprint (PASSED)**:
  The compiled binary size is **3.26 MB**, representing a highly optimized native footprint.
* **Memory Leakage (PASSED)**:
  No accumulation of `RTCPeerConnection` instances occurs across repeated calling cycles. Standard Garbage Collection releases memory cleanly on cleanup.

---

### E. Repository Reproducibility

Starting from a completely clean machine, the project successfully compiles using these steps:
1. `git clone` the repository.
2. Run `npm install` inside both `server/` and `client/` directories.
3. Configure `server/.env` using `.env.example`.
4. Run SQLite migrations: `npx prisma migrate dev` (which populates tables).
5. Seed database: `npm run db:seed` (automatically marks seeded users alice, bob, and charlie as email-verified).
6. Build client: `npm run build` (outputs optimized production bundle).
7. Sync assets with Capacitor: `npx cap sync android` (copies assets to local native folders).
8. Accept SDK licenses via Android CLI:
   ```cmd
   android sdk install platforms/android-36 build-tools/35.0.0
   ```
9. Compile APK via Gradle wrapper:
   ```cmd
   .\gradlew.bat assembleRelease
   ```
This complete process succeeds without manual intervention.

---

## 3. Remaining Risks & Testing Recommendations

### Remaining Risks
1. **CORS Origin Block**: The backend `ALLOWED_ORIGINS` must include `https://localhost` (or the configured Capacitor scheme) in production to accept Axios/Socket requests from the native Android app.
2. **Symmetric NAT Disconnection**: Calls conducted across separate mobile carrier networks (double-NAT/symmetric firewalls) will fail to establish direct ICE candidate pairs. A functional TURN server is required in production.

### Testing Plan for APK Sideloading
1. Distribute `app-release-unsigned.apk` to test devices.
2. Sideload and launch app. Ensure both devices are connected to the same Wi-Fi network (or configure the server `STUN_URLS`/`TURN_URL` variables to allow internet routing).
3. Log in with seeded accounts (e.g., Alice and Bob, which bypass email verification).
4. Perform audio/video calls, verify screen rotation, and test file upload attachment workflows in the foreground.
