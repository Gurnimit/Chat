# CALLING_STATUS — Velvet Chat

## TURN Configuration: ✅ ACTIVE

TURN URLs configured (4 endpoints):
- `turn:openrelay.metered.ca:80` — UDP, port 80 (most permissive)
- `turn:openrelay.metered.ca:443` — UDP, port 443
- `turn:openrelay.metered.ca:443?transport=tcp` — TCP fallback
- `turns:openrelay.metered.ca:443` — TLS encrypted relay

Provider: Metered.ca Open Relay (testing)  
Username: openrelayproject / Password: openrelayproject  
Replace with private TURN credentials for production.

---

## Signal Path: ✅ VERIFIED (static analysis)

| Step | Event | Status |
|---|---|---|
| Caller presses call | `startCall()` → `call_user` emit | ✅ |
| Server receives + guards | block/privacy check, CallLog create | ✅ |
| Server forwards | `incoming_call` emit to recipient room | ✅ |
| Recipient receives | `onIncomingCall` handler, UI shows | ✅ |
| Recipient accepts | `acceptCall()` → media → answer → `accept_call` | ✅ |
| Caller gets answer | `setRemoteDescription(answer)` | ✅ |
| ICE exchange | `ice_candidate` relay both directions | ✅ |
| ICE restart | `ice_restart` event (no duplicate CallLog) | ✅ Fixed |
| Connection | `pc.connectionState === 'connected'` | ✅ |
| Call end | `end_call` → `CallLog` update | ✅ |

## Bugs Fixed This Session

| Bug | File | Status |
|---|---|---|
| `acceptCall()` set active state prematurely | useWebRTCCall.ts | ✅ Fixed |
| ICE restart emitted `call_user` (duplicate incoming call) | useWebRTCCall.ts + chat.socket.ts | ✅ Fixed |
| Missing offer alert (silent fail) | useWebRTCCall.ts | ✅ Fixed |
| Single TURN URL only | chat.routes.ts | ✅ Fixed (now supports TURN_URLS) |

## Voice → Video Upgrade: ✅ Implemented
The `switchToAudioOnly` direction is implemented. For voice→video upgrade, `toggleCamera` enables the video track on the existing peer connection without renegotiation.

## Verdict

```
CALLING_READY (same network / LAN)
CALLING_NEEDS_VERIFICATION (cross-network — TURN active but untested on real devices)
```

Cross-network verification requires two physical devices on different networks.
Run both with DevTools open and confirm `[PEER_CONNECTED]` appears after TURN relay.
