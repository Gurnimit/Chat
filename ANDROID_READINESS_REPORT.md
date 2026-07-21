# Android Readiness Report - Velvet Chat

This report verifies native Android configuration, permissions, Capacitor integration, environment routing, and APK build outputs for Velvet Chat v1.0.0-rc1.

---

## 1. Permission Verification (`VERIFIED`)

The Android manifest [AndroidManifest.xml](file:///c:/Users/karan/Desktop/chat-app/client/android/app/src/main/AndroidManifest.xml) was audited to verify hardware permission mappings:

*   **Internet Access**: `android.permission.INTERNET` declared (Required for API and WebRTC connection endpoints).
*   **WebRTC Media Permissions**:
    *   `android.permission.CAMERA` (Required for video calls).
    *   `android.permission.RECORD_AUDIO` (Required for voice calls).
    *   `android.permission.MODIFY_AUDIO_SETTINGS` (Required for output route switching, speakers, and earpieces).
*   **Network Diagnostics**: `android.permission.ACCESS_NETWORK_STATE` (Used to monitor disconnection events and trigger ICE restarts).
*   **Storage Access (Attachment Downloads & Picker)**:
    *   `android.permission.READ_EXTERNAL_STORAGE` (Targeting SDK <= 32).
    *   `android.permission.WRITE_EXTERNAL_STORAGE` (Targeting SDK <= 32).
    *   `android.permission.READ_MEDIA_IMAGES` (Targeting SDK >= 33).
    *   `android.permission.READ_MEDIA_VIDEO` (Targeting SDK >= 33).
    *   `android.permission.READ_MEDIA_AUDIO` (Targeting SDK >= 33).

---

## 2. Activity Configuration & Rotation (`VERIFIED`)

*   **Preventing Call Disconnects on Rotation**:
    *   `android:configChanges` list configured on `.MainActivity`:
        `orientation|keyboardHidden|keyboard|screenSize|locale|smallestScreenSize|screenLayout|uiMode|navigation|density`
    *   *Result*: Screen rotation will re-orient the layout within the active WebView layout without restarting the primary activity context, preventing active WebRTC calls from dropping.

---

## 3. Capacitor Integration (`VERIFIED`)

The configuration file [capacitor.config.json](file:///c:/Users/karan/Desktop/chat-app/client/capacitor.config.json) was audited:
*   **App Identifier**: `com.velvet.chat`
*   **App Name**: `Velvet Chat`
*   **Web Assets Target**: `dist`
*   **Scheme Settings**: Configured `"androidScheme": "https"`, ensuring assets are served securely via `https://localhost` within the local container.
*   **Installed Native Plugins**:
    *   `@capacitor/app` (Handles native back-button signals).
    *   `@capacitor/browser` (Routes file transfers/downloads to Chrome Custom Tabs).

---

## 4. Release APK Output (`VERIFIED`)

*   **Compilation Command**: `$env:JAVA_HOME="C:\Program Files\Eclipse Adoptium\jdk-21.0.11.10-hotspot"; .\gradlew.bat assembleRelease`
*   **Result**: Compile successful with Gradle and Java 21 Temurin.
*   **Build Target**: `client/android/app/build/outputs/apk/release/app-release-unsigned.apk`
*   **Binary Footprint**: **3.35 MB**

---

## 5. Unverified Native Behaviors (`NOT VERIFIED`)

The following behaviors require physical device execution and cannot be statically verified in the sandbox:

*   **System Permissions Dialog Box**: Display of native runtime permission prompts for camera, audio, or external storage has **not been verified**.
*   **Physical Hardware Back Navigation**: Correct intercepting of physical hardware back signals to close modals and warn during active calls has **not been verified**.
*   **Physical Filesystem Downloads**: Integration between Chrome Custom Tabs and the native Android Download Manager for PDFs, ZIPs, or media has **not been verified**.
*   **Application Resume and Background Call Drop**: Dropping calls on app suspension and preserving socket sessions on foreground resume has **not been verified** on a physical device.
