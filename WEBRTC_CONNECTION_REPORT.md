# WebRTC Connection Report — Velvet Chat v0.1

Generated: 2026-06-08  
Purpose: Verify WebRTC media acquisition, offer/answer, ICE, and connection states.

---

## 1. Local Media Acquisition

### Microphone Permission

**Code path**: `useWebRTCCall.ts` [L470–L496](file:///c:/Users/karan/Desktop/chat-app/client/src/hooks/useWebRTCCall.ts#L470) (caller) / [L563–L590](file:///c:/Users/karan/Desktop/chat-app/client/src/hooks/useWebRTCCall.ts#L563) (answerer)

```typescript
navigator.mediaDevices.getUserMedia({ audio: true, video: false })
```

- On permission denied → **falls back alert**: `"Could not start call. Please check microphone permissions."`
- Calls `cleanupCall()` and returns
- **Log to watch**: No `[CALL_BUTTON_CLICKED]`-adjacent `getUserMedia` failure visible in logs  
  (error is caught in `catch` block and alerts user)

### Camera Permission (Video Calls Only)

```typescript
navigator.mediaDevices.getUserMedia({ audio: true, video: { width: 640, height: 480, frameRate: 15 } })
```

- On camera failure during **video call** → automatically falls back to audio-only
- Calls `setCallTypeSynced('audio')` — call continues without video
- Alert: `"Camera permission denied or camera not found. Falling back to audio-only call."`

### Assessment

| Permission | Behavior on Deny | User Alert | Fallback |
|---|---|---|---|
| Microphone | Call fails entirely | ✅ Yes | ❌ None |
| Camera (video call) | Downgrade to audio | ✅ Yes | ✅ Audio-only |
| Camera (audio call) | Not requested | N/A | N/A |

---

## 2. Offer Generation

**Caller flow**:  
`useWebRTCCall.ts` [L543–L545](file:///c:/Users/karan/Desktop/chat-app/client/src/hooks/useWebRTCCall.ts#L543)

```typescript
const offer = await pc.createOffer();
await pc.setLocalDescription(offer);
socket.emit('call_user', { toUserId: peer.id, offer, callType });
```

**Log to watch**: `[OFFER_SENT] Offer emitted to userId=... sdpType=offer sdpLength=...`

### Known Issues

- **Tracks must be added BEFORE `createOffer()`** — verified ✅ (L517 adds tracks, L543 creates offer)
- `createOffer()` requires at least one track to negotiate media — if `getUserMedia` fails silently,  
  offer may be created without tracks (rare edge case on some browsers)

---

## 3. Answer Generation

**Answerer flow**:  
`useWebRTCCall.ts` [L636–L641](file:///c:/Users/karan/Desktop/chat-app/client/src/hooks/useWebRTCCall.ts#L636)

```typescript
await pc.setRemoteDescription(new RTCSessionDescription(incomingOfferRef.current));
const answer = await pc.createAnswer();
await pc.setLocalDescription(answer);
socket.emit('accept_call', { toUserId: callPeer.id, answer });
```

**Log to watch**: `[ANSWER_SENT] Answer emitted to userId=... sdpType=answer sdpLength=...`

### Known Issues

- If `incomingOfferRef.current` is null (offer was not included in `incoming_call`), `setRemoteDescription` fails  
  → `catch(err)` → `cleanupCall()` — **call silently tears down on answer attempt**
- `acceptCall()` guard at L555: `if (!socket || !callPeer || !incomingOfferRef.current) return;`  
  → If offer is null, function returns silently — **this is a silent failure with no user alert**

> ⚠️ **BUG**: If `acceptCall()` returns early due to missing offer, the call UI stays in `active` state  
> (set at L556 BEFORE the guard) but peer connection was never established.  
> **Fix needed**: Move `setCallState('active')` AFTER the guard check.

---

## 4. ICE Candidate Generation

**ICE gathering**: Automatic after `setLocalDescription()`  
**Trigger**: `pc.onicecandidate` callback fires for each candidate

### ICE Server Configuration

**Fetched from**: `GET /api/chats/ice-config`  
**Current config** (`.env` file — no TURN configured):

```json
{
  "iceServers": [
    { "urls": "stun:stun.l.google.com:19302" },
    { "urls": "stun:stun1.l.google.com:19302" },
    { "urls": "stun:stun2.l.google.com:19302" }
  ],
  "turnConfigured": false
}
```

> ⚠️ **CRITICAL: No TURN server configured.**  
> Without TURN: Calls WILL fail between devices on different networks (mobile ↔ home WiFi,  
> different ISPs, symmetric NATs, corporate firewalls).  
> Calls MAY work on the same LAN or with permissive NATs.

### ICE Candidate Types Expected

| Type | Meaning | Works Without TURN |
|---|---|---|
| `host` | Local LAN IP | ✅ Same network only |
| `srflx` | Public IP via STUN | ✅ Open/cone NAT |
| `relay` | Via TURN server | ❌ Not available |

### ICE Relay (Emitted Events)

**Log to watch**: `[ICE_SENT] Local candidate gathered: type=host/srflx/relay`  
If only `host` candidates are generated → both peers are behind NAT → **call will fail without TURN**

---

## 5. ICE Candidate Exchange

**Sender** → Server → **Recipient**:  
Server logs: `[ICE_CANDIDATE] Relaying from userId=... → toUserId=... type=... protocol=...`  
Recipient logs: `[ICE_RECEIVED] Remote candidate from userId=...`

### Timing Issue: Early ICE Candidates

ICE candidates may arrive BEFORE `setRemoteDescription()` is called on the recipient.  
**Code handles this correctly**: `queuedIceCandidatesRef.current.push(candidate)` at L972  
Candidates are drained at L642 after `setLocalDescription(answer)`.

**Log to watch**: `[ICE_RECEIVED] Queued ICE candidate (remoteDescription not set yet)`

---

## 6. Connection State Changes

**Handler**: `pc.onconnectionstatechange` at [L376](file:///c:/Users/karan/Desktop/chat-app/client/src/hooks/useWebRTCCall.ts#L376)

| State | Action |
|---|---|
| `connected` | Start timer, start quality monitor, log `[PEER_CONNECTED]` |
| `failed` | Attempt ICE restart (up to 3 times) |
| `disconnected` | Call `cleanupCall()` |
| `closed` | Call `cleanupCall()` |

### ICE Restart on Failure

**Code**: `useWebRTCCall.ts` [L421–L441](file:///c:/Users/karan/Desktop/chat-app/client/src/hooks/useWebRTCCall.ts#L421)

```typescript
if (iceRestartAttemptsRef.current < 3) {
  pc.restartIce(); // or createOffer({ iceRestart: true })
}
```

> ⚠️ **ISSUE**: On ICE restart, the code re-emits `call_user` with a new offer.  
> But `call_user` on the server creates a NEW `CallLog` record and re-triggers `incoming_call`  
> on the receiver — **causing a duplicate incoming call screen on the recipient's side.**  
> A dedicated `ice_restart` socket event should be used instead.

---

## 7. Remote Stream Binding

**Caller receives remote stream** via `pc.ontrack`:  
`useWebRTCCall.ts` [L530–L538](file:///c:/Users/karan/Desktop/chat-app/client/src/hooks/useWebRTCCall.ts#L530)

```typescript
pc.ontrack = (event) => {
  if (remoteVideoRef.current && event.streams[0]) {
    remoteVideoRef.current.srcObject = event.streams[0];
  }
  if (remoteAudioRef.current && event.streams[0] && event.track.kind === 'audio') {
    remoteAudioRef.current.srcObject = event.streams[0];
  }
};
```

> ⚠️ **POTENTIAL ISSUE**: `remoteAudioRef.current` must be a mounted `<audio>` element.  
> If the audio element is not mounted in the DOM when `ontrack` fires, the audio binding is lost.  
> Check that `<audio ref={remoteAudioRef} autoPlay>` is always mounted when `callState !== 'idle'`.

---

## 8. Quality Monitoring

**Interval**: every 4 seconds while `pc.connectionState === 'connected'`  
**File**: `useWebRTCCall.ts` [L771](file:///c:/Users/karan/Desktop/chat-app/client/src/hooks/useWebRTCCall.ts#L771)

| Metric | Poor Threshold | Action |
|---|---|---|
| RTT > 1000ms OR packet loss > 25% | `very_poor` | Auto switch to audio-only |
| RTT > 500ms OR packet loss > 10% | `poor` | Scale down video (2x downscale, 10fps) |
| RTT > 250ms OR packet loss > 5% | `fair` | Moderate downscale (1.5x, 12fps) |
| Below all thresholds | `good` | Restore full quality |

---

## 9. Summary of WebRTC Issues Found

| # | Issue | Severity | File | Line |
|---|---|---|---|---|
| 1 | No TURN server configured — cross-network calls will fail | 🔴 Critical | `.env` | — |
| 2 | `setCallState('active')` called before guard check in `acceptCall()` | 🟠 High | `useWebRTCCall.ts` | L556 |
| 3 | ICE restart re-emits `call_user` causing duplicate `incoming_call` on recipient | 🟠 High | `useWebRTCCall.ts` | L431 |
| 4 | `remoteAudioRef` may be unset when `ontrack` fires | 🟡 Medium | `useWebRTCCall.ts` | L535 |
| 5 | `acceptCall()` returns silently if offer missing — no user alert | 🟡 Medium | `useWebRTCCall.ts` | L555 |
| 6 | No `TURN_URL` in `.env` and no TURN setup documentation | 🔴 Critical | `server/.env` | L8 |
