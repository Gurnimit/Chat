# Mobile Calling Report — Velvet Chat v0.1

Generated: 2026-06-08  
Platform: Android (Capacitor)  
Purpose: Verify calling behavior across app states.

---

## 1. Foreground Call (App Open and Visible)

### Incoming Call

**Flow**: Socket `incoming_call` event → `[INCOMING_CALL_RECEIVED]` log → `callState = 'incoming'`  
→ `MobileCallOverlay` renders (L372 in `MobileDashboard.tsx`)

**Status**: ✅ Code path is complete and correct.  
Ringtone plays via `playRingtone()` triggered by `callState` useEffect in `useWebRTCCall.ts` L246.

### Outgoing Call

**Flow**: User taps call button → `startCall()` → `[CALL_BUTTON_CLICKED]` → `callState = 'outgoing'`  
→ `MobileCallOverlay` renders

**Status**: ✅ Code path is complete.

### Voice Call Connection

**Status**: ⚠️ Depends on network topology (STUN-only — see WebRTC report)  
On same local network: likely works  
On mobile data ↔ different WiFi: **will fail without TURN server**

### Video Call Connection

**Status**: ⚠️ Same TURN dependency as voice.  
Additionally: Video track acquisition depends on camera permission.

---

## 2. Background Call (App Minimized)

**Android behavior**: When user presses Home, app is backgrounded.

### What Happens to the Socket

The Capacitor Android socket (Socket.IO with WebSocket transport) typically:
- **Remains connected** for ~30–60 seconds (Android keeps the app alive briefly)
- **Disconnects** after Android kills background network connections (varies by OEM/power management)

### Code Behavior When Backgrounded

**File**: `client/src/hooks/useWebRTCCall.ts` — [L1016](file:///c:/Users/karan/Desktop/chat-app/client/src/hooks/useWebRTCCall.ts#L1016)

```typescript
useEffect(() => {
  if (!window.hasOwnProperty('Capacitor')) return;
  const capacitor = (window as any).Capacitor;
  if (!capacitor.isNativePlatform()) return;

  const subscriptionPromise = App.addListener('appStateChange', ({ isActive }) => {
    if (!isActive) {
      if (callStateRef.current !== 'idle' && callPeerRef.current && socket) {
        socket.emit('end_call', { toUserId: callPeerRef.current.id, reason: 'backgrounded' });
        cleanupCall();
        alert('Call ended because the application went to the background.');
      }
    }
  });
});
```

> ⚠️ **ACTIVE CALLS ARE KILLED ON BACKGROUNDING.**  
> If user presses Home during an active call, the call is immediately terminated.  
> This is by design in current code but is a significant limitation for a real calling app.

### Background Incoming Calls

When app is backgrounded BEFORE a call arrives:
1. Socket may still be connected → `incoming_call` event might still arrive
2. If socket is still connected → `onIncomingCall` fires → `callState = 'incoming'` in background
3. BUT the UI is not visible → user sees nothing (no native UI for VoIP call on screen)
4. FCM push notification is sent simultaneously → may appear as notification
5. When user taps notification → app opens → `callState` is already `incoming` in memory  
   BUT: If app was killed/recreated, React state is reset → call state lost → **call missed**

**Status**: ❌ Background incoming calls are unreliable without VOIP integration.

---

## 3. Locked-Screen Call

When device is locked:
- Socket connection status depends on Android version and OEM power management
- FCM push notification is sent by server → displays on lock screen (calls channel, importance 5)
- User taps notification → device unlocks → app opens
- **Same limitation as background**: If the WebRTC session was never established, tapping the notification cannot resume it

**Status**: ❌ Locked-screen calls cannot be answered properly.  
A WebRTC session requires the `incoming_call` socket event, which is ephemeral.

---

## 4. App Minimized During Active Call

If user minimizes during an active call (after connection is established):

```typescript
// useWebRTCCall.ts L1023
if (!isActive) {
  if (callStateRef.current !== 'idle' && callPeerRef.current && socket) {
    socket.emit('end_call', { toUserId: callPeerRef.current.id, reason: 'backgrounded' });
    cleanupCall();
    alert('Call ended because the application went to the background.');
  }
}
```

**Status**: ❌ Minimizing kills the call. Alert dialog shows (which itself is problematic — alerts don't show well on Android when app is backgrounded).

---

## 5. App Resume (After Backgrounding Without Active Call)

When user resumes app (was backgrounded with no active call):
- Socket reconnects automatically (configured with `reconnectionAttempts: 10`, `reconnectionDelay: 1000`)
- `SocketContext.tsx` — L39: `reconnection: true`
- After reconnect, user rejoins `user:${userId}` room via server's `io.on('connection')` handler

**Status**: ✅ Socket reconnection works. No call state to restore.

---

## 6. Push Notification Infrastructure (Android)

### FCM Configuration

| Variable | Status |
|---|---|
| `FCM_ENABLED` | `true` ✅ |
| `FIREBASE_SERVICE_ACCOUNT_PATH` | Set in `.env` ✅ |
| Firebase Admin SDK | Initialized if file exists |

### Android Notification Channels

Configured in `ChatDashboard.tsx` [L542–L565](file:///c:/Users/karan/Desktop/chat-app/client/src/pages/ChatDashboard.tsx#L542):

| Channel | ID | Importance | Notes |
|---|---|---|---|
| Messages | `messages` | 4 (High) | Heads-up notifications |
| Calls | `calls` | 5 (Max) | Lock screen, max priority |

### Device Token Registration

- Registered after `PushNotifications.register()` succeeds
- Posted to `POST /api/auth/device-token`
- Stored in `DeviceToken` table in database
- Used by `NotificationService.sendPush()` for FCM delivery

### Known Push Issue: Closed-App Call Wake-Up

Push notification for a call sends:
```json
{ "type": "call", "callType": "audio/video", "callerId": "..." }
```

When tapped: `ChatDashboard.tsx` L610:
```typescript
} else if (data.type === 'call') {
  setSelectedChat(null); // Opens app, but DOES NOT trigger incoming call
}
```

> ❌ **The `incoming_call` socket event is gone by the time the app opens.**  
> The app opens but no call screen appears. The call is effectively missed.

---

## 7. Summary Table

| Scenario | Status | Reason |
|---|---|---|
| Foreground voice call | ✅ Works (same network) | Socket + WebRTC flow complete |
| Foreground video call | ✅ Works (same network) | Same |
| Cross-network call (any) | ❌ Fails | No TURN server |
| Background incoming call | ❌ Unreliable | Socket may disconnect; no VOIP |
| Locked-screen call | ❌ Not answered properly | App opens but call event gone |
| Minimized during active call | ❌ Call terminated | Explicit backgrounding kill |
| App resume after bg | ✅ Socket reconnects | Auto-reconnect works |
| Push notification for call | ✅ Delivered | FCM configured and active |
| Closed-app call wakeup | ❌ Doesn't reconnect call | VOIP not implemented |

---

## 8. Required Changes for Production Mobile Calling

1. **TURN Server** — Required for cross-network calls. Configure `TURN_URL`, `TURN_USERNAME`, `TURN_PASSWORD` in `.env`.

2. **Background Call Handling** — Instead of terminating calls on background:
   - Use Android foreground service notification to keep app alive during calls
   - Or integrate a proper VOIP wake mechanism

3. **Closed-App Call Flow** — FCM data-only message + pending call state stored in DB:
   - When app opens from call push, check DB for active pending call
   - Re-fetch pending offer from server (store offer in DB temporarily)
   - Present incoming call UI

4. **Call Kill on Background** — Remove or make the background kill optional:
   - Allow audio calls to continue in background (audio-only, no UI)
   - Kill only video calls on background

5. **iOS Considerations** — CallKit integration needed for iOS call delivery (not in scope for current Android build)
