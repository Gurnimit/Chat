# Root Cause Analysis — Velvet Chat Calling System

Generated: 2026-06-08  
Scope: End-to-end audit of voice/video calling functionality

---

## Primary Root Cause: No TURN Server

**Severity**: 🔴 Critical — blocks all cross-network calls  
**File**: `server/.env`  
**Variables**: `TURN_URL`, `TURN_USERNAME`, `TURN_PASSWORD` — all unset

### Explanation

WebRTC requires ICE (Interactive Connectivity Establishment) to route media between peers.  
ICE uses STUN servers to discover public IPs, and TURN servers to relay traffic when direct connections fail.

**Current state**: Only Google STUN servers configured (`stun.l.google.com`).

| Network Scenario | Works Without TURN? |
|---|---|
| Both peers on same WiFi LAN | ✅ Yes (host candidates work) |
| One peer on mobile data, one on WiFi | ❌ No (symmetric NAT) |
| Both peers on mobile data | ❌ No |
| Corporate network / VPN | ❌ No |
| Most real-world mobile-to-mobile scenarios | ❌ No |

**Impact**: Calling will fail for essentially all real-world usage between two different devices on different networks.

---

## Secondary Root Causes

### Bug 1: `acceptCall()` Set State Before Peer Connection Was Established

**Severity**: 🟠 High  
**File**: `client/src/hooks/useWebRTCCall.ts`  
**Was at**: L556 (before fix)

`setCallState('active')` and `startCallTimer()` were called at the very beginning of `acceptCall()`,  
BEFORE media acquisition, BEFORE RTCPeerConnection setup, BEFORE answer creation.

**Consequence**: Call UI showed "active" even if:
- `getUserMedia` failed silently
- `pc.setRemoteDescription` threw an error
- The guard check at L555 was bypassed (missing offer case)

Additionally, the guard `if (!incomingOfferRef.current) return` was a silent return with no user alert —  
making it appear as if the call was answered but nothing happened.

### Bug 2: ICE Restart Re-emitted `call_user` Causing Duplicate Incoming Call

**Severity**: 🟠 High  
**File**: `client/src/hooks/useWebRTCCall.ts`  
**Was at**: L432

When the browser's modern `pc.restartIce()` API was unavailable, the fallback code  
re-emitted `call_user` with a new offer to perform an ICE restart.

**Consequence**: The server processed `call_user` as a brand new call:
- Created a new `CallLog` record in the database
- Re-emitted `incoming_call` to the recipient
- Recipient saw a **second incoming call screen** on top of the active call

The fix uses a dedicated `ice_restart` server event that relays the offer as `call_restarted`  
without touching the CallLog or re-triggering call setup.

### Issue 3: Background App Kills Active Calls Immediately

**Severity**: 🟡 Medium (by design, but UX-critical for mobile)  
**File**: `client/src/hooks/useWebRTCCall.ts` L1023+

`App.addListener('appStateChange')` immediately terminates any active call when the app goes to background.  
This means pressing the Home button during a call hangs up.

### Issue 4: Closed-App Call Push Notification Cannot Restore Call

**Severity**: 🟡 Medium  
**File**: `client/src/pages/ChatDashboard.tsx` L610

When a push notification for a call is tapped and the app opens from a closed state:
- The `incoming_call` socket event is ephemeral and has already been missed
- The push notification handler only calls `setSelectedChat(null)` — no call UI appears
- The call is effectively missed

### Issue 5: `remoteAudioRef` May Miss `ontrack` Event

**Severity**: 🟡 Low (race condition)  
**File**: `client/src/hooks/useWebRTCCall.ts` L535

If the `<audio>` element is not yet mounted in the DOM when the `ontrack` event fires,  
the audio stream is never bound to the element. Audio plays silently or not at all.

---

## Summary Table

| # | Root Cause | Severity | Status After Fix |
|---|---|---|---|
| 1 | No TURN server configured | 🔴 Critical | ⏳ Needs TURN server deployed |
| 2 | `acceptCall` premature state transition | 🟠 High | ✅ Fixed |
| 3 | ICE restart re-emits `call_user` | 🟠 High | ✅ Fixed |
| 4 | Background app kills active calls | 🟡 Medium | ⚠️ Known, documented |
| 5 | Closed-app call push can't restore call | 🟡 Medium | ⚠️ Known, documented |
| 6 | `remoteAudioRef` race condition | 🟡 Low | ⚠️ Known, not fixed |
