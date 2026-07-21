# Incoming Call Debug Report — Velvet Chat v0.1

Generated: 2026-06-08  
Purpose: Verify the 4-step incoming call delivery chain.

---

## Expected Flow: Account A calls Account B

```
Step 1: Server receives call event      → [CALL_START] log
Step 2: Server forwards call event      → [CALL_FORWARD] log
Step 3: Recipient receives event        → [INCOMING_CALL_RECEIVED] log
Step 4: Incoming call screen appears    → callState === 'incoming' + UI renders
```

---

## Step 1 — Server Receives Call Event

**Event**: `call_user`  
**File**: `server/src/sockets/chat.socket.ts` — [L575](file:///c:/Users/karan/Desktop/chat-app/server/src/sockets/chat.socket.ts#L575)  
**Log indicator**: `[CALL_START] userId=... → toUserId=... callType=... offerPresent=true`

### Known Blockers at This Step

| Condition | Error | Fix |
|---|---|---|
| Block between users | `call_error: Blocked user` | Unblock users first |
| Receiver's `whoCanCallMe = 'NOONE'` | `call_error: This user has disabled incoming calls` | Change to `EVERYONE` in settings |
| Receiver's `whoCanCallMe = 'FRIENDS'` but not friends | `call_error: This user only accepts calls from friends` | Add as friend first |
| Offer is null/undefined | `offerPresent=false` log | Bug in `startCall()` — check `pc.createOffer()` error |
| Rate limit exceeded (>3 calls/30s in prod) | `call_error: Abuse protection` | Wait 30 seconds |

---

## Step 2 — Server Forwards Call Event

**Emit**: `io.to('user:${toUserId}').emit('incoming_call', ...)`  
**File**: `server/src/sockets/chat.socket.ts` — [L643](file:///c:/Users/karan/Desktop/chat-app/server/src/sockets/chat.socket.ts#L643)  
**Log indicator**: `[CALL_FORWARD] Forwarding incoming_call to userId=... callLogId=...`

### Known Blockers at This Step

| Condition | Effect | How to Detect |
|---|---|---|
| Recipient not in `user:${userId}` socket room | Event emitted but never received | Server log shows CALL_FORWARD, client shows no INCOMING_CALL_RECEIVED |
| Recipient socket disconnected | Silently dropped | No socket ID in `userSockets` map for recipient |
| Recipient is offline entirely | Only push notification sent | Socket delivery silently fails; push relies on FCM |
| DB error creating CallLog | `catch(e)` — execution halts before emit | Server error log shows Prisma error |
| `prisma.user.findUnique` returns null | `caller` is `null` — call still goes through, but missing caller info | Caller name shows undefined on recipient's screen |

---

## Step 3 — Recipient Receives `incoming_call` Event

**Handler**: `onIncomingCall`  
**File**: `client/src/hooks/useWebRTCCall.ts` — [L892](file:///c:/Users/karan/Desktop/chat-app/client/src/hooks/useWebRTCCall.ts#L892)  
**Listener registered at**: L980 in `useEffect([socket])`  
**Log indicator**: `[INCOMING_CALL_RECEIVED] from userId=... username=... callType=... offerPresent=true/false`

### Known Blockers at This Step

| Condition | Effect | Log |
|---|---|---|
| `socket` is `null` on recipient | Listener never registered | No INCOMING_CALL_RECEIVED log |
| `callStateRef.current !== 'idle'` | Auto-rejected | `[INCOMING_CALL_RECEIVED] Auto-rejected: already in call state=...` |
| `data.offer` is null | `incomingOfferRef.current = null` — acceptCall() will fail later | `offerPresent=false` in log |
| Component unmounted before call arrives | Listener cleaned up | No log, socket event silently lost |
| `useEffect([socket])` dependency not triggered | Listener never bound | Check if `socket` is stable (not recreated on each render) |

---

## Step 4 — Incoming Call Screen Appears

**Condition**: `callState === 'incoming'` → UI renders call overlay

**Desktop**: `ChatDashboard.tsx` renders call overlay when `callState !== 'idle'`  
**Mobile**: `MobileDashboard.tsx` [L372](file:///c:/Users/karan/Desktop/chat-app/client/src/pages/MobileDashboard.tsx#L372) — `{props.callState !== 'idle' && <MobileCallOverlay .../>}`

### Known Blockers at This Step

| Condition | Effect |
|---|---|
| `setCallState('incoming')` not called | UI never transitions |
| `callPeer` not set | Call UI has no peer info to display |
| `callType` not set | Defaults to 'audio'; video call shows as audio |
| Ringtone autoplay blocked by browser | Silent incoming call (no sound) |

---

## Critical Finding: MISSING `CALL_RECEIVED` LOG ON RECIPIENT

> The server emits `incoming_call` and logs `[CALL_FORWARD]`.  
> **The client logs `[INCOMING_CALL_RECEIVED]` only if the socket listener fires.**  
> If you see `[CALL_FORWARD]` on server but NO `[INCOMING_CALL_RECEIVED]` on client, the socket delivery is failing.

### Diagnostic Steps If Delivery Fails

1. **Check recipient socket connection**: Open browser devtools → Network → WS.  
   Confirm socket is connected with `isConnected: true` from `SocketContext`.

2. **Check socket room membership**: The server emits to `user:${toUserId}`.  
   On connection, the recipient socket joins `socket.join('user:${userId}')` at L93.  
   If this line never ran (auth failed), delivery silently fails.

3. **Check for multiple socket instances**: If `SocketContext` creates multiple socket instances  
   (e.g., due to React strict mode or token changes), old listeners may be orphaned.

4. **Check iOS/Android background state**: When app is backgrounded on mobile,  
   the socket may disconnect. The call will then only arrive via FCM push.  
   On Capacitor: `App.addListener('appStateChange')` in `useWebRTCCall.ts` L1021  
   **ends any active call on background** — incoming calls while backgrounded require FCM.

---

## Push Notification Fallback for Incoming Calls

When recipient is offline or backgrounded, FCM push is triggered at:  
**File**: `server/src/sockets/chat.socket.ts` — [L651](file:///c:/Users/karan/Desktop/chat-app/server/src/sockets/chat.socket.ts#L651)

```typescript
NotificationService.sendPush(
  data.toUserId,
  'Incoming Call',
  `${caller?.profile?.displayName || caller?.username} is calling you...`,
  { type: 'call', callType: data.callType || 'audio', callerId: userId }
)
```

Push notification tap routing (when app is closed):  
**File**: `client/src/pages/ChatDashboard.tsx` — L610  
```typescript
} else if (data.type === 'call') {
  setSelectedChat(null); // just opens app, no auto-accept
}
```

> ⚠️ **KNOWN GAP**: Tapping a call push notification opens the app but does NOT  
> re-trigger the WebRTC incoming call flow. The socket `incoming_call` event is  
> a one-time emission. Once missed (app was closed), it is gone.  
> A VOIP-style wakeup flow (using Android's Incoming Call Notification API or  
> iOS CallKit) would be needed to properly handle closed-app call delivery.

---

## Verdict

| Check | Status |
|---|---|
| Server receives `call_user` | ✅ Code verified |
| Server forwards `incoming_call` via socket | ✅ Code verified |
| Server sends FCM push for call | ✅ Code verified |
| Client receives `incoming_call` (foreground) | ✅ Code verified |
| Client receives `incoming_call` (background) | ❌ NOT SUPPORTED — socket disconnects |
| Client receives call when app is closed | ❌ NOT SUPPORTED — requires VOIP integration |
| Caller profile info included in incoming_call | ✅ Includes `caller`, `callType`, `callLogId` |
| Offer included in `incoming_call` | ✅ Full SDP offer passed |
