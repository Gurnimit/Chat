# Verification Results — Velvet Chat Calling System

Generated: 2026-06-08  
Method: Static code audit + runtime instrumentation (no live device test possible from audit environment)

---

## Verification Matrix

| # | Test | Method | Result |
|---|---|---|---|
| 1 | Caller emits `call_user` with SDP offer | Code trace | ✅ VERIFIED |
| 2 | Server receives and processes `call_user` | Code trace | ✅ VERIFIED |
| 3 | Server guards (block, privacy preference, rate limit) work | Code trace | ✅ VERIFIED |
| 4 | Server creates `CallLog` record on call initiation | Code trace | ✅ VERIFIED |
| 5 | Server emits `incoming_call` to recipient | Code trace | ✅ VERIFIED |
| 6 | Server sends FCM push for offline/background recipient | Code trace | ✅ VERIFIED |
| 7 | Client receives `incoming_call` and shows UI (foreground) | Code trace | ✅ VERIFIED |
| 8 | `incomingOfferRef` stores SDP offer for later use | Code trace | ✅ VERIFIED |
| 9 | `acceptCall()` performs `getUserMedia` → creates PC → sets remote desc | Code trace | ✅ VERIFIED |
| 10 | `acceptCall()` emits `accept_call` with SDP answer | Code trace | ✅ VERIFIED |
| 11 | Server relays `call_accepted` to caller | Code trace | ✅ VERIFIED |
| 12 | Caller calls `setRemoteDescription(answer)` | Code trace | ✅ VERIFIED |
| 13 | ICE candidates queued when remote description not yet set | Code trace | ✅ VERIFIED |
| 14 | ICE candidates drained after `setLocalDescription` | Code trace | ✅ VERIFIED |
| 15 | ICE candidate events relayed correctly by server | Code trace | ✅ VERIFIED |
| 16 | `pc.ontrack` binds remote stream to `<video>/<audio>` | Code trace | ✅ VERIFIED (with known race) |
| 17 | `pc.connectionState === 'connected'` starts timer + monitoring | Code trace | ✅ VERIFIED |
| 18 | `end_call` updates `CallLog` with duration + status | Code trace | ✅ VERIFIED |
| 19 | `cleanupCall()` stops tracks, closes PC, resets state | Code trace | ✅ VERIFIED |
| 20 | Calls work on same LAN | Inferred from STUN-only config | ✅ LIKELY |
| 21 | Calls work between different networks (mobile ↔ WiFi) | TURN required | ❌ FAILS |
| 22 | Calls work with app backgrounded | Code trace | ❌ FAILS (intentional kill) |
| 23 | Incoming calls from closed app state | Code trace + FCM analysis | ❌ NOT SUPPORTED |
| 24 | ICE restart doesn't cause duplicate call screen | ✅ Fixed | ✅ FIXED |
| 25 | `acceptCall()` missing offer gives user alert | ✅ Fixed | ✅ FIXED |
| 26 | `callState = 'active'` only after answer sent | ✅ Fixed | ✅ FIXED |

---

## Runtime Log Verification Guide

To verify calling on a real device, run both clients with DevTools open and filter by these prefixes:

### On Caller's browser/device console

```
[CALL_BUTTON_CLICKED] type=audio targetUserId=...         ← Call started
[ICE_SENT] Local candidate gathered: type=host ...         ← Host candidates (LAN)
[ICE_SENT] Local candidate gathered: type=srflx ...        ← Public IP via STUN
[ICE_SENT] Local candidate gathered: type=relay ...        ← Via TURN (need TURN!)
[OFFER_SENT] Offer emitted to userId=...                   ← SDP sent
[ICE_RECEIVED] Remote candidate from userId=...            ← Remote candidates arriving
[PEER_CONNECTED] WebRTC peer connection established!       ← SUCCESS
```

### On Server console

```
[CALL_START] userId=... → toUserId=...                     ← call_user received
[WEBRTC_OFFER] Offer received sdpType=offer sdpLength=...  ← SDP present
[CALL_FORWARD] Forwarding incoming_call to userId=...      ← Forwarded to recipient
[CALL_ACCEPTED] userId=... accepted call                   ← accept_call received
[WEBRTC_ANSWER] Answer received sdpType=answer             ← Answer SDP present
[ICE_CANDIDATE] Relaying from userId=...                   ← ICE relay active
```

### On Recipient's browser/device console

```
[INCOMING_CALL_RECEIVED] from userId=... offerPresent=true ← Call arrived
[ANSWER_SENT] Answer emitted to userId=...                  ← Answer sent
[ICE_RECEIVED] Remote candidate from userId=...             ← ICE exchange
[PEER_CONNECTED] WebRTC peer connection established!        ← SUCCESS
```

### Failure Indicators to Watch

| Log Pattern | Meaning |
|---|---|
| `[CALL_FORWARD]` on server but no `[INCOMING_CALL_RECEIVED]` on client | Socket delivery failed |
| `[OFFER_SENT]` but no `[WEBRTC_OFFER]` on server | Socket event lost (auth failure?) |
| Only `type=host` ICE candidates, no `srflx` | STUN not working |
| No `type=relay` ICE candidates | TURN not configured (expected) |
| `[PEER_CONNECTED]` never appears | ICE failed (NAT traversal) |
| `[INCOMING_CALL_RECEIVED] Auto-rejected: already in call` | Duplicate call received |

---

## Required Actions Before CALLING_READY

1. ✅ **Fix acceptCall() race condition** — DONE  
2. ✅ **Fix ICE restart duplicate call** — DONE  
3. ✅ **Add runtime instrumentation** — DONE  
4. ❌ **Configure TURN server** — REQUIRED for cross-network calls  
5. ❌ **Real device test on same LAN** — Required  
6. ❌ **Real device test on different networks** — Required (after TURN)  
7. ❌ **Real device test: FCM call push** — Required  
8. ❌ **Real device test: background call** — Required  

---

## Final Verdict

```
╔══════════════════════════════════════════════════════╗
║                                                      ║
║           CALLING_NOT_READY                          ║
║                                                      ║
║  Primary blocker: No TURN server                     ║
║  Cross-network calls will fail for virtually         ║
║  all real-world mobile use cases.                    ║
║                                                      ║
║  Code bugs fixed: 2 (acceptCall race, ICE restart)   ║
║  Code path verified: ✅ (static analysis)            ║
║  Live device test: ❌ Not yet performed              ║
║                                                      ║
╚══════════════════════════════════════════════════════╝
```

### To achieve CALLING_READY:

1. Provision a TURN server (recommended: [Metered.ca](https://www.metered.ca/tools/openrelay/) free tier, or self-host Coturn)  
2. Add to `server/.env`:
   ```
   TURN_URL=turn:your.turn.server:3478
   TURN_USERNAME=yourturnuser
   TURN_PASSWORD=yourturnpassword
   ```
3. Run both client and server, open DevTools on both devices
4. Initiate a voice call between two real devices on **different networks**
5. Confirm `[PEER_CONNECTED]` appears in both consoles
6. Confirm audio is heard on both ends
7. Confirm `call_ended` properly updates call duration in `/calls/history`
