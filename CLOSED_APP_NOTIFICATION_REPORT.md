# Closed-App Notification Report — Velvet Chat

This report verifies the behavior of Firebase Cloud Messaging (FCM) notifications across various operating system states of the mobile client app.

---

## 1. App State Notification Delivery Matrices

Push notifications behave differently depending on the activity status of the React/Capacitor application on Android:

| App State | Push Delivery Behavior | Visual Alert | UI Callback Execution |
| :--- | :--- | :--- | :--- |
| **Foregrounded (Active)** | Handled by FCM / Socket.IO. | System sound/popup. | Socket event updates messages list instantly. |
| **Backgrounded (Minimized)** | OS intercepts push. | System tray banner. | `pushNotificationReceived` listener triggers. |
| **Removed from Recents** | OS intercepts push. | System tray banner. | Postponed until user taps the notification. |
| **App Process Terminated** | System registers push token. | System tray banner. | Native Android OS boots the WebView intent upon tap. |

---

## 2. Process Termination & OS Traversal

- **FCM High-Priority Payload**:
  FCM delivers pushes directly to the native Google Play Services daemon on Android. Because Play Services runs as a persistent background service at the OS level, it is not terminated when Velvet Chat is swiped out of Recents or force-stopped.
- **Waking Suspended WebViews**:
  When a push is received while the process is terminated:
  1. The Android OS displays the banner notification.
  2. Clicking the notification launches a native Intent mapping to `MainActivity`.
  3. The WebView instantiates, booting up the React single page application.
  4. The custom `pushNotificationActionPerformed` listener parses the clicked intent data and performs navigation routing.

---

## 3. Verdict

**Final Verdict:**
`CODE_VERIFIED_BUT_REAL_DEVICE_NOT_TESTED`
