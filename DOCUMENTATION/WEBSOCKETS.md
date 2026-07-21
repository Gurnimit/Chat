# WEBSOCKETS.md

## Technology
- **Socket.IO v4.7.5** (server + client)
- **Transport**: WebSocket only (client forces `transports: ['websocket']`)
- **Authentication**: JWT access token in `handshake.auth.token`

## Connection Flow
1. Client connects with `io(backendUrl, { auth: { token: accessToken } })`
2. Server middleware verifies JWT, attaches `userId` to socket
3. Socket joins personal room `user:{userId}`
4. Online status updated in DB + broadcast via batched presence updates (every 20s)

## Socket Events

### Client → Server

| Event | Data | Description |
|-------|------|-------------|
| `typing` | `{ chatId, isTyping }` | Typing indicator |
| `send_message` | `{ chatId, content, clientMessageId?, replyToId?, attachments? }` | Send message (rate limited: 10/5s) |
| `mark_read` | `{ chatId, messageId? }` | Mark messages as read |
| `mark_delivered` | `{ chatId, messageIds[] }` | Mark messages as delivered |
| `react_message` | `{ chatId, messageId, emoji }` | Toggle emoji reaction |
| `edit_message` | `{ chatId, messageId, content }` | Edit message |
| `delete_message` | `{ chatId, messageId }` | Soft-delete message |
| `call_user` | `{ toUserId, offer, callType? }` | Initiate WebRTC call (rate limited: 3/30s prod) |
| `accept_call` | `{ toUserId, answer }` | Accept incoming call |
| `reject_call` | `{ toUserId }` | Reject incoming call |
| `ice_candidate` | `{ toUserId, candidate }` | Relay ICE candidate (rate limited: 100/10s) |
| `ice_restart` | `{ toUserId, offer }` | ICE restart offer (no new CallLog) |
| `end_call` | `{ toUserId, missed? }` | End active call |
| `switch_to_audio` | `{ toUserId }` | Switch call from video to audio-only |
| `switch_to_video` | `{ toUserId }` | Switch call to video (currently unused in UI) |

### Server → Client

| Event | Data | Description |
|-------|------|-------------|
| `message_received` | `{ chatId, message }` | New message broadcast |
| `message_edited` | `{ chatId, message }` | Message edit broadcast |
| `message_deleted` | `{ chatId, message }` | Message deletion broadcast |
| `messages_read` | `{ chatId, userId, messageIds, readAt }` | Read receipt |
| `messages_delivered` | `{ chatId, userId, messageIds, deliveredAt }` | Delivery receipt |
| `message_reaction` | `{ chatId, messageId, userId, emoji, action, reaction }` | Reaction toggle |
| `user_typing` | `{ chatId, userId, isTyping }` | Typing indicator |
| `presence_batch` | `{ updates: [{ userId, isOnline, lastSeen }] }` | Batched presence updates (every 20s) |
| `notification_received` | `{ notification }` | Real-time notification |
| `friend_request_received` | `{ request }` | New friend request |
| `friend_request_accepted` | `{ requestId, friend }` | Friend request accepted |
| `friend_request_rejected` | `{ requestId }` | Friend request rejected |
| `friend_request_cancelled` | `{ requestId }` | Friend request cancelled |
| `friend_removed` | `{ friendId }` | Friend removed |
| `user_blocked` | `{ blockedId }` | User blocked |
| `blocked_by_user` | `{ blockerId }` | Blocked by user |
| `friend_list_changed` | | Friend list changed |
| `group_created` | `{ chat }` | New group chat created |
| `group_updated` | `{ chat }` | Group metadata updated |
| `member_joined` | `{ chatId, members, newMemberIds }` | Member added to group |
| `member_left` | `{ chatId, userId, remainingMembers }` | Member left/removed |
| `owner_transferred` | `{ chatId, oldOwnerId, newOwnerId, members }` | Group ownership transferred |
| `incoming_call` | `{ caller, offer, callType, callLogId }` | Incoming call |
| `call_accepted` | `{ fromUserId, answer }` | Call accepted |
| `call_rejected` | `{ fromUserId }` | Call rejected |
| `call_ended` | `{ fromUserId }` | Call ended |
| `call_restarted` | `{ fromUserId, offer }` | ICE restart offer |
| `switched_to_audio` | `{ fromUserId }` | Peer switched to audio |
| `switched_to_video` | `{ fromUserId }` | Peer switched to video |
| `ice_candidate` | `{ fromUserId, candidate }` | ICE candidate relay |

## Rate Limiting (Socket-level)
In-memory sliding-window rate limiter per socket:
- `send_message`: 10 events per 5 seconds
- `call_user`: 3 events per 30 seconds (production), 100 (development)
- `ice_candidate`: 100 events per 10 seconds

## Presence System
- On connect: Update `profile.isOnline = true`, `profile.lastSeen = now()`
- On disconnect (last socket): Update `profile.isOnline = false`, `profile.lastSeen = now()`
- Presence updates are batched every 20 seconds and broadcast as `presence_batch` event (battery optimization)

## Call Signaling Flow
1. Caller emits `call_user` with SDP offer
2. Server creates CallLog (status: MISSED), stores in `activeCalls` map
3. Server forwards `incoming_call` to callee
4. Callee emits `accept_call` with SDP answer
5. ICE candidates exchanged via `ice_candidate` events
6. On `end_call`: CallLog updated with duration and final status
7. On disconnect during call: CallLog updated, other party notified

## Block Enforcement
- Messages and calls check for block relationships before processing
- Blocked users cannot send messages or initiate calls
- Block checks happen server-side in both REST and Socket handlers
