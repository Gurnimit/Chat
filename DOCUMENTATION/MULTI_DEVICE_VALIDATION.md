# MULTI_DEVICE_VALIDATION.md

## Scenario: Android Phone A ↔ Backend ↔ Android Phone B

### Feature Validation

| Feature | Mechanism | Multi-Device Support | Notes |
|---------|-----------|---------------------|-------|
| **Simultaneous Login** | Sessions table | Yes | Each device gets its own Session row. Multiple sessions per user supported. |
| **Presence** | Socket.IO rooms | Yes | Each socket joins `user:{userId}` room. Multiple sockets per user tracked in `userSockets` Map. |
| **Typing** | Socket broadcast | Yes | Typing events broadcast to all chat members (all devices). |
| **Read Receipts** | Socket + DB | Yes | `MessageRead` and `MessageStatus` tables track per-user, not per-device. All devices see receipts. |
| **Reconnect** | Socket.IO reconnection | Yes | Auto-reconnect with 10 attempts, 1s delay. Presence updated on disconnect (last socket). |
| **Image Upload** | HTTP POST + static serving | Yes | File uploaded to server, URL broadcast via socket. All devices see the same URL. |
| **File Upload** | HTTP POST + static serving | Yes | Same as image upload. |
| **Audio Calls** | WebRTC via Socket.IO signaling | Partial | Only 1:1 calls. Second device cannot join same call. If User A calls from Device 1, Device 2 sees incoming call too (socket broadcast). |
| **Video Calls** | WebRTC via Socket.IO signaling | Partial | Same as audio calls. WebRTC is peer-to-peer, so only 2 participants max. |
| **Push Notifications** | FCM | Yes | Multiple device tokens per user. Push sent to all registered devices. |
| **Token Refresh** | Cookie + DB session | Yes | Each device has its own session. Refresh on one device doesn't affect others. |
| **Offline Sync** | localStorage queue | Per-device | Each device has its own offline queue. Messages queued on Device A are not visible on Device B until synced. |
| **Session Invalidation** | DB session deletion | Yes | Password change deletes ALL sessions for user. All devices forced to re-login. |

### Detailed Analysis

#### Simultaneous Login
- **How it works**: Each login creates a new Session row with a unique refresh token. Multiple sessions coexist.
- **Multi-device**: Both Phone A and Phone B can be logged in simultaneously. Each has its own access token and refresh token.
- **Limitation**: None. This is fully supported.

#### Presence
- **How it works**: On connect, user joins `user:{userId}` room. On disconnect (last socket), presence set to offline.
- **Multi-device**: If Phone A and Phone B are both connected, presence stays online until BOTH disconnect.
- **Limitation**: None. Batched presence updates every 20 seconds.

#### Typing
- **How it works**: Typing event broadcast to all chat members via socket.
- **Multi-device**: If Phone A types, Phone B (same user) also receives the typing event (if in the same chat). Other users in the chat see typing from both devices.
- **Limitation**: None.

#### Read Receipts
- **How it works**: `mark_read` event creates MessageRead and MessageStatus records. Broadcast to chat members.
- **Multi-device**: If Phone A reads a message, Phone B also sees it as read (same userId).
- **Limitation**: None.

#### Reconnect
- **How it works**: Socket.IO auto-reconnects with exponential backoff.
- **Multi-device**: Each device reconnects independently. Offline messages queued per-device.
- **Limitation**: Offline queue is per-device (localStorage). Messages queued on Device A are not visible on Device B.

#### Image/File Upload
- **How it works**: File uploaded via HTTP, URL stored in Attachment table, broadcast via socket.
- **Multi-device**: All devices see the same file URL. File served from server filesystem.
- **Limitation**: None.

#### Audio/Video Calls
- **How it works**: WebRTC peer-to-peer. Signaling via Socket.IO. CallLog tracks call state.
- **Multi-device**: Call events broadcast to all sockets of the target user. If User B has Phone A and Phone B, both receive `incoming_call`. Only one can answer.
- **Limitation**: WebRTC is 1:1 only. Conference calling not supported.

#### Push Notifications
- **How it works**: FCM sends push to all registered device tokens.
- **Multi-device**: Each device registers its own token. Push sent to all tokens.
- **Limitation**: Requires Firebase credentials configured.

#### Token Refresh
- **How it works**: Each device has its own session. Refresh rotates the token for that session.
- **Multi-device**: Refreshing on Device A doesn't affect Device B's session.
- **Limitation**: None.

#### Offline Sync
- **How it works**: Messages queued in localStorage when socket disconnected.
- **Multi-device**: Each device has its own localStorage. Offline queue is per-device.
- **Limitation**: Messages queued offline on Device A are not visible on Device B until Device A reconnects and sends them. No cross-device offline sync.

#### Session Invalidation
- **How it works**: Password change deletes ALL sessions for the user.
- **Multi-device**: Both Device A and Device B are forced to re-login.
- **Limitation**: None. This is the intended behavior.

## Multi-Device Test Plan

| # | Test | Steps | Expected |
|---|------|-------|----------|
| 1 | Login on both devices | Login as alice on Phone A and Phone B | Both devices authenticated |
| 2 | Presence shows online | Check bob's view of alice | Alice shows online (both devices connected) |
| 3 | Message from Device A | Send message from Phone A | Phone B receives it via socket |
| 4 | Typing from Device B | Type on Phone B | Other users see "typing..." |
| 5 | Read on Device A | Open chat on Phone A | Phone B shows read receipts |
| 6 | Upload from Device B | Upload image from Phone B | Phone A sees the image |
| 7 | Call from Device A | Call bob from Phone A | Bob receives incoming call |
| 8 | Push on Device B | Send message while Phone B is backgrounded | Phone B receives push notification |
| 9 | Refresh on Device A | Wait for token expiry on Phone A | Phone A refreshes, Phone B unaffected |
| 10 | Offline on Device A | Disconnect Phone A, send message | Message queued on Phone A |
| 11 | Reconnect Device A | Reconnect Phone A | Queued message sent, Phone B receives it |
| 12 | Password change | Change password on Phone A | Phone B forced to re-login |
