# Incoming Call Push Report — Velvet Chat

This report verifies the VoIP calling notification channel settings, Android importance priorities, and lock-screen display configurations.

---

## 1. Native Android Notification Channels

The client codebase [ChatDashboard.tsx](file:///c:/Users/karan/Desktop/chat-app/client/src/pages/ChatDashboard.tsx#L511-L529) declares the custom Android notification channels required by Capacitor.

- **Messages Channel**:
  - `id`: `'messages'`
  - `name`: `'Messages'`
  - `importance`: `4` (High Importance - triggers sounds and head-up popups).
- **Calls Channel**:
  - `id`: `'calls'`
  - `name`: `'Calls'`
  - `importance`: `5` (Maximum Importance - bypasses system limits for real-time ringtones, displays full-screen, and shows immediately on lock-screens).

---

## 2. Lock-Screen Visibility & Priorities

1. **Server Side Mapping**:
   In `server/src/utils/notification.ts`, when dispatching calling events (where `data.type === 'call'`), the server explicitly overrides the Android channel and maps it to the `'calls'` channel:
   ```typescript
   const channelId = payload.data?.type === 'call' ? 'calls' : 'messages';
   const message = {
     token: payload.token,
     notification: {
       title: payload.title,
       body: payload.body
     },
     android: {
       notification: {
         channelId: channelId
       }
     },
     data: payload.data
   };
   ```
2. **Android Priority Level**:
   Assigning `importance: 5` (Max) inside the calling channel triggers Android's high-priority visual notification layouts:
   - Plays ringing sound.
   - Appears as a heads-up banner over other fullscreen apps.
   - Bypasses battery saver delays to wake the device.
   - Shows details on secure lock-screens based on the user's notification privacy configurations.

---

## 3. Verified Calling Notification Flows

- **Incoming Calls**: Triggers push notifications with `{ type: 'call', callType, callerId }`.
- **Missed Calls**: Triggers push notifications with `{ type: 'missed_call', callerId }`.

---

## 4. Verdict

**Final Verdict:**
`CODE_VERIFIED_BUT_REAL_DEVICE_NOT_TESTED`
