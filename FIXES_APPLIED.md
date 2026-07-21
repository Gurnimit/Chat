# Fixes Applied — Velvet Chat Calling System

Generated: 2026-06-08

---

## Fix 1: `acceptCall()` Guard and State Transition

**Files Modified**:
- [`client/src/hooks/useWebRTCCall.ts`](file:///c:/Users/karan/Desktop/chat-app/client/src/hooks/useWebRTCCall.ts)

**Problem**:  
`setCallState('active')` and `startCallTimer()` were called at the beginning of `acceptCall()` — before any WebRTC setup — making it silent when setup failed. Also: a missing-offer case returned silently with no user alert.

**Changes Made**:
1. Added explicit `null` check for `incomingOfferRef.current` with user alert on failure
2. Removed `setCallState('active')` and `startCallTimer()` from the top of `acceptCall()`
3. Moved `setCallState('active')` and `startCallTimer()` to AFTER `socket.emit('accept_call', ...)` — inside the success path of the `try` block
4. Added diagnostic log: `[ANSWER_SENT] Queued ICE candidates drained`

**Before**:
```typescript
const acceptCall = async () => {
  if (!socket || !callPeer || !incomingOfferRef.current) return; // silent fail
  setCallState('active'); // ← premature, BEFORE any WebRTC setup
  startCallTimer();
  ...
};
```

**After**:
```typescript
const acceptCall = async () => {
  if (!socket || !callPeer) return;
  if (!incomingOfferRef.current) {
    console.error('...');
    alert('Could not accept the call: call offer was missing or expired.');
    cleanupCall();
    return;
  }
  try {
    // ... media, peer connection, offer/answer ...
    socket.emit('accept_call', { ... });
    setCallState('active'); // ← correct: after signaling is in-flight
    startCallTimer();
  } catch (err) { cleanupCall(); }
};
```

---

## Fix 2: ICE Restart Dedicated Event

**Files Modified**:
- [`client/src/hooks/useWebRTCCall.ts`](file:///c:/Users/karan/Desktop/chat-app/client/src/hooks/useWebRTCCall.ts)
- [`server/src/sockets/chat.socket.ts`](file:///c:/Users/karan/Desktop/chat-app/server/src/sockets/chat.socket.ts)

**Problem**:  
The ICE restart fallback (for browsers without `pc.restartIce()`) re-emitted `call_user`.  
This caused the server to create a new `CallLog` + emit a second `incoming_call` to the recipient.

**Changes Made**:
1. **Client** (`useWebRTCCall.ts` L432): Changed `socket.emit('call_user', ...)` to `socket.emit('ice_restart', { toUserId, offer })`
2. **Server** (`chat.socket.ts`): Added new `ice_restart` event handler that relays offer as `call_restarted` (bypasses CallLog creation and `incoming_call` emit)
3. **Client** (`useWebRTCCall.ts`): Added `onCallRestarted` handler for `call_restarted` events — sets new remote description and sends a new answer
4. **Client**: Registered/deregistered `call_restarted` event properly in the `useEffect` cleanup

**Before**:
```typescript
// WRONG: triggers new CallLog + duplicate incoming_call on recipient
socket.emit('call_user', { toUserId: targetUserId, offer, callType });
```

**After**:
```typescript
// CORRECT: relays offer via dedicated ice_restart event
socket.emit('ice_restart', { toUserId: targetUserId, offer });
```

---

## Fix 3: Runtime Instrumentation Added

**Files Modified**:
- [`client/src/hooks/useWebRTCCall.ts`](file:///c:/Users/karan/Desktop/chat-app/client/src/hooks/useWebRTCCall.ts)
- [`server/src/sockets/chat.socket.ts`](file:///c:/Users/karan/Desktop/chat-app/server/src/sockets/chat.socket.ts)

**Diagnostic logs added to server** (all prefixed to aid filtering):

| Log Tag | Location | Event |
|---|---|---|
| `[CALL_START]` | `chat.socket.ts` | `call_user` received |
| `[WEBRTC_OFFER]` | `chat.socket.ts` | Offer SDP details |
| `[CALL_FORWARD]` | `chat.socket.ts` | `incoming_call` emitted to recipient |
| `[CALL_ACCEPTED]` | `chat.socket.ts` | `accept_call` received |
| `[WEBRTC_ANSWER]` | `chat.socket.ts` | Answer SDP details |
| `[CALL_DECLINED]` | `chat.socket.ts` | `reject_call` received |
| `[ICE_CANDIDATE]` | `chat.socket.ts` | ICE candidate relayed |

**Diagnostic logs added to client**:

| Log Tag | Location | Event |
|---|---|---|
| `[CALL_BUTTON_CLICKED]` | `useWebRTCCall.ts` | Call initiated |
| `[OFFER_SENT]` | `useWebRTCCall.ts` | Offer emitted via socket |
| `[INCOMING_CALL_RECEIVED]` | `useWebRTCCall.ts` | `incoming_call` received |
| `[ANSWER_SENT]` | `useWebRTCCall.ts` | Answer emitted via socket |
| `[ICE_SENT]` | `useWebRTCCall.ts` | Local ICE candidate gathered |
| `[ICE_RECEIVED]` | `useWebRTCCall.ts` | Remote ICE candidate received |
| `[PEER_CONNECTED]` | `useWebRTCCall.ts` | RTCPeerConnection reached 'connected' |

---

## Fix 4: Documents Created

| File | Purpose |
|---|---|
| [`CALL_SIGNALING_AUDIT.md`](file:///c:/Users/karan/Desktop/chat-app/CALL_SIGNALING_AUDIT.md) | Full event-by-event call flow trace |
| [`INCOMING_CALL_DEBUG_REPORT.md`](file:///c:/Users/karan/Desktop/chat-app/INCOMING_CALL_DEBUG_REPORT.md) | Incoming call delivery verification with failure modes |
| [`WEBRTC_CONNECTION_REPORT.md`](file:///c:/Users/karan/Desktop/chat-app/WEBRTC_CONNECTION_REPORT.md) | Media, ICE, and connection state analysis |
| [`MOBILE_CALLING_REPORT.md`](file:///c:/Users/karan/Desktop/chat-app/MOBILE_CALLING_REPORT.md) | Android foreground/background/closed calling behavior |
| [`ROOT_CAUSE.md`](file:///c:/Users/karan/Desktop/chat-app/ROOT_CAUSE.md) | Root cause analysis |
| [`FIXES_APPLIED.md`](file:///c:/Users/karan/Desktop/chat-app/FIXES_APPLIED.md) | This document |
| [`VERIFICATION_RESULTS.md`](file:///c:/Users/karan/Desktop/chat-app/VERIFICATION_RESULTS.md) | Verification results |

---

## What Was NOT Fixed (Requires Infrastructure or Architecture)

1. **No TURN server**: Must provision a TURN server (Coturn, Twilio, Metered, etc.) and configure `.env`
2. **Background call kill**: Terminating active calls on backgrounding is by-design but limits real usage
3. **Closed-app call wakeup**: Requires VOIP integration (Android foreground service + pending call storage)
4. **`remoteAudioRef` race condition**: Low-priority; would need to track stream and re-bind on mount
