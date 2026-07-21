# Call Signaling Audit — Velvet Chat v0.1

Generated: 2026-06-08  
Scope: Full end-to-end call signaling trace, WebRTC offer/answer, ICE exchange.

---

## 1. Architecture Overview

```
User A (Caller)                    Server (Socket.IO)                 User B (Recipient)
     │                                    │                                    │
     │── call_user ──────────────────────>│                                    │
     │   {toUserId, offer, callType}      │── incoming_call ──────────────────>│
     │                                    │   {caller, offer, callType,        │
     │                                    │    callLogId}                      │
     │                                    │                                    │── [user sees IncomingCallUI]
     │<────────── call_accepted ──────────│<──────── accept_call ──────────────│
     │   {fromUserId, answer}             │   {toUserId, answer}               │
     │── [setRemoteDescription(answer)]   │                                    │
     │                                    │                                    │
     │── ice_candidate ─────────────────>│── ice_candidate ─────────────────>│
     │   {toUserId, candidate}            │   {fromUserId, candidate}          │
     │<────────── ice_candidate ─────────│<──────── ice_candidate ────────────│
     │                                    │                                    │
     │── [RTCPeerConnection established] ─────────────────────────────────────│
     │                                    │                                    │
     │── end_call ──────────────────────>│── call_ended ─────────────────────>│
```

---

## 2. Phase 1 — Caller Initiates (User A)

### Step 1: User Presses Call Button

- **File**: `client/src/pages/ChatDashboard.tsx`
- **Approx. Line**: L1290 (call button click), also L4363 (call history retry)
- **Function**: Click handler inside conversation header — calls `startCall(type, otherMember)`
- **Where `startCall` is from**: `useWebRTCCall` hook, destructured at L178

### Step 2: `startCall()` — Media Acquisition + Offer Creation

- **File**: `client/src/hooks/useWebRTCCall.ts` — [L450–L552](file:///c:/Users/karan/Desktop/chat-app/client/src/hooks/useWebRTCCall.ts#L450-L552)
- **Function**: `startCall(type, peer)`

**Execution path:**
1. L452: `setCallPeer(peer)` — store who we are calling
2. L453: `setCallState('outgoing')` — UI transitions to outgoing call screen
3. L454: `setCallTypeSynced(type)` — syncs state AND ref
4. L460–L467: 30-second timeout set; if unanswered, emits `end_call { missed: true }`
5. L470–L496: `navigator.mediaDevices.getUserMedia(constraints)` — acquires microphone (and camera for video)
   - On failure: falls back to audio-only (for video call) or cleans up
6. L499: `localStreamRef.current = stream` — stores MediaStream
7. L511: `new RTCPeerConnection(iceConfig)` — creates peer connection
   - `iceConfig` was fetched from `GET /api/chats/ice-config` on mount (L272)
   - Defaults to Google STUN if TURN not configured
8. L517: `stream.getTracks().forEach(track => pc.addTrack(track, stream))` — adds tracks
9. L519–L528: `pc.onicecandidate` — emits `ice_candidate` for each local ICE candidate
10. L530–L538: `pc.ontrack` — binds remote stream to video/audio elements
11. L540: `setupConnectionMonitoring(pc, peer.id)` — sets up `onconnectionstatechange`
12. L543–L545: `pc.createOffer()` → `pc.setLocalDescription(offer)` → **emits `call_user`**

---

## 3. Phase 2 — Server Receives and Forwards

### Step 3: Server Receives `call_user`

- **File**: `server/src/sockets/chat.socket.ts`
- **Line**: [L575](file:///c:/Users/karan/Desktop/chat-app/server/src/sockets/chat.socket.ts#L575)
- **Event**: `socket.on('call_user', ...)`
- **Payload**: `{ toUserId, offer, callType? }`

**Server execution path:**
1. L577–L581: Rate limit check (3 per 30s in production, 100 in dev)
2. L583–L595: Block check via `prisma.block.findFirst`
3. L597–L618: `whoCanCallMe` privacy preference check via `prisma.notificationPreference`
4. L620–L627: Fetch caller profile `prisma.user.findUnique`
5. L630–L638: **`prisma.callLog.create`** — creates DB record with `status: 'MISSED'`
6. L640–L641: Adds caller and recipient to `activeCalls` map
7. **L643–L648**: `io.to(`user:${data.toUserId}`).emit('incoming_call', { caller, offer, callType, callLogId })`
8. L651–L657: Push notification dispatched via `NotificationService.sendPush()`

---

## 4. Phase 3 — Recipient Receives Call (User B)

### Step 4: Client Receives `incoming_call`

- **File**: `client/src/hooks/useWebRTCCall.ts`
- **Line**: [L892](file:///c:/Users/karan/Desktop/chat-app/client/src/hooks/useWebRTCCall.ts#L892)
- **Handler**: `onIncomingCall`

**Execution path:**
1. L893: Guard — if already in a call, auto-rejects via `socket.emit('reject_call')`
2. L897: `setCallPeer(data.caller)` — store caller
3. L898: `setCallState('incoming')` — UI transitions to incoming call screen
4. L899: `setCallTypeSynced(data.callType || 'audio')`
5. L901: `incomingOfferRef.current = data.offer` — stores offer for later
6. L903–L909: 30-second incoming call timeout

**Socket listener registered at**: L980 inside `useEffect([socket])` dependency

### Step 5: Incoming Call Screen Appears

- **File**: `client/src/pages/ChatDashboard.tsx`
- The call overlay renders when `callState !== 'idle'`  
- Renders at approx. L3880+ — condition: `{callState !== 'idle' && (<CallOverlay .../>)}`
- On mobile: `MobileCallOverlay` in `MobileDashboard.tsx` at L372

---

## 5. Phase 4 — Answer Flow

### Step 6: User B Accepts Call

- **File**: `client/src/hooks/useWebRTCCall.ts`
- **Line**: [L554](file:///c:/Users/karan/Desktop/chat-app/client/src/hooks/useWebRTCCall.ts#L554)
- **Function**: `acceptCall()`

**Execution path:**
1. L556: `setCallState('active')` — pre-empts UI (call timer starts)
2. L557: `startCallTimer()` — kicks off 1-second interval
3. L563–L590: `getUserMedia(constraints)` — acquire local media
4. L604: `new RTCPeerConnection(iceConfig)` — create peer connection
5. L610: Add local tracks to PC
6. L612–L620: `pc.onicecandidate` → emit `ice_candidate`
7. L623–L630: `pc.ontrack` → bind remote stream
8. L633: `setupConnectionMonitoring(pc, callPeer.id)`
9. L636: `pc.setRemoteDescription(incomingOfferRef.current)` — set caller's offer
10. L637: `pc.createAnswer()`
11. L638: `pc.setLocalDescription(answer)`
12. **L640**: `socket.emit('accept_call', { toUserId: callPeer.id, answer })`
13. L641: `incomingOfferRef.current = null` — clear stored offer
14. L642: `processQueuedCandidates()` — drain any ICE candidates that arrived early

### Step 7: Server Forwards `accept_call`

- **File**: `server/src/sockets/chat.socket.ts`
- **Line**: [L669](file:///c:/Users/karan/Desktop/chat-app/server/src/sockets/chat.socket.ts#L669)
- **Event**: `socket.on('accept_call', ...)`
- **Execution**: 
  1. Marks `activeCalls[userId].conversationStartedAt = new Date()`
  2. `io.to(`user:${data.toUserId}`).emit('call_accepted', { fromUserId, answer })`

### Step 8: Caller Receives `call_accepted`

- **File**: `client/src/hooks/useWebRTCCall.ts`
- **Line**: [L929](file:///c:/Users/karan/Desktop/chat-app/client/src/hooks/useWebRTCCall.ts#L929)
- **Handler**: `onCallAccepted`

**Execution path:**
1. L932: `peerConnectionRef.current.setRemoteDescription(data.answer)` — completes SDP exchange
2. L935: `setCallState('active')`
3. L936–L939: Clear call timeout
4. L940: `startCallTimer()`
5. L941: `processQueuedCandidates()` — drain queued ICE candidates

---

## 6. Phase 5 — ICE Exchange

### ICE Candidate Flow (Bidirectional)

**Sender**: `pc.onicecandidate` callback  
**Files**: `useWebRTCCall.ts` L519–L528 (caller), L612–L620 (answerer)  
**Event emitted**: `socket.emit('ice_candidate', { toUserId, candidate })`

**Server relay**:  
- **File**: `server/src/sockets/chat.socket.ts` — [L706](file:///c:/Users/karan/Desktop/chat-app/server/src/sockets/chat.socket.ts#L706)
- Rate limited: 100 per 10 seconds
- `io.to(`user:${data.toUserId}`).emit('ice_candidate', { fromUserId, candidate })`

**Receiver handler**:  
- **File**: `useWebRTCCall.ts` — [L954](file:///c:/Users/karan/Desktop/chat-app/client/src/hooks/useWebRTCCall.ts#L954)
- If `pc.remoteDescription` is set: immediately `pc.addIceCandidate()`
- If not: push to `queuedIceCandidatesRef.current` (drained in `processQueuedCandidates`)

---

## 7. Phase 6 — Connection Established

- **Event**: `pc.connectionState === 'connected'`
- **File**: `useWebRTCCall.ts` — [L376](file:///c:/Users/karan/Desktop/chat-app/client/src/hooks/useWebRTCCall.ts#L376)
- Actions taken:
  - Starts quality monitoring interval (every 4s)
  - Logs candidate pair type (host/srflx/relay) to diagnostic API
  - Call timer already running

---

## 8. Phase 7 — Call End

### Hang Up

- **File**: `useWebRTCCall.ts` — [L657](file:///c:/Users/karan/Desktop/chat-app/client/src/hooks/useWebRTCCall.ts#L657)
- Emits `socket.emit('end_call', { toUserId, missed })`

**Server**:  
- **File**: `chat.socket.ts` — [L717](file:///c:/Users/karan/Desktop/chat-app/server/src/sockets/chat.socket.ts#L717)
- Updates `CallLog` status (COMPLETED/MISSED/CANCELLED) with duration
- `io.to(toUserId).emit('call_ended', { fromUserId })`

**Recipient receives `call_ended`**:  
- **File**: `useWebRTCCall.ts` — [L976](file:///c:/Users/karan/Desktop/chat-app/client/src/hooks/useWebRTCCall.ts#L976)
- Calls `cleanupCall()` — stops tracks, closes PC, resets all state

---

## 9. ICE / TURN Configuration

**Endpoint**: `GET /api/chats/ice-config`  
**File**: `server/src/routes/chat.routes.ts` — [L420](file:///c:/Users/karan/Desktop/chat-app/server/src/routes/chat.routes.ts#L420)

**Current State** (from `.env`):
- `TURN_URL`: **NOT SET**
- `TURN_USERNAME`: **NOT SET**
- `TURN_PASSWORD`: **NOT SET**
- `STUN_URLS`: **NOT SET** (falls back to Google STUN)
- `turnConfigured`: **`false`**

**Fallback ICE servers (active)**:
```json
[
  { "urls": "stun:stun.l.google.com:19302" },
  { "urls": "stun:stun1.l.google.com:19302" },
  { "urls": "stun:stun2.l.google.com:19302" }
]
```

> ⚠️ **CRITICAL**: Without a TURN server, calls between devices on different NATs (e.g., mobile data vs. home WiFi) will FAIL at ICE negotiation. STUN-only works only when both peers are on the same network or have open NATs.

---

## 10. Key Events Map

| Direction | Event | File | Line |
|---|---|---|---|
| Client→Server | `call_user` | `chat.socket.ts` | L575 |
| Server→Client | `incoming_call` | `chat.socket.ts` | L643 |
| Client→Server | `accept_call` | `chat.socket.ts` | L669 |
| Server→Client | `call_accepted` | `chat.socket.ts` | L676 |
| Client→Server | `reject_call` | `chat.socket.ts` | L682 |
| Server→Client | `call_rejected` | `chat.socket.ts` | L701 |
| Client→Server | `ice_candidate` | `chat.socket.ts` | L706 |
| Server→Client | `ice_candidate` | `chat.socket.ts` | L711 |
| Client→Server | `end_call` | `chat.socket.ts` | L717 |
| Server→Client | `call_ended` | `chat.socket.ts` | L745 |
| Client→Server | `switch_to_audio` | `chat.socket.ts` | L663 |
| Server→Client | `switched_to_audio` | `chat.socket.ts` | L664 |
