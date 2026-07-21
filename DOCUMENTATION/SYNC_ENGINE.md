# SYNC_ENGINE.md

## Overview
Velvet Chat uses a **real-time WebSocket-based sync model** with offline queue support. There is no traditional "sync engine" like Apollo or WatermelonDB — synchronization is handled through Socket.IO events and HTTP API polling.

## Real-time Sync (Primary)
- **Transport**: Socket.IO WebSocket connection
- **Pattern**: Server-authoritative broadcast
- **Flow**: Client action → Socket event → Server persists to DB → Server broadcasts to all chat members
- **Latency**: Near-instantaneous (WebSocket round-trip)

## Offline Support
### Message Queue
- Messages queued in `localStorage` key `offline_message_queue` when socket is disconnected
- Queue processed automatically when socket reconnects
- Each message has a `clientMessageId` for deduplication
- Temporary messages displayed locally with `isOfflinePending: true` flag

### Presence
- Presence updates batched every 20 seconds (battery optimization)
- `presence_batch` event carries all changed user statuses

### Session Restoration
- `hasSession` flag in localStorage
- On page load: attempt token refresh via HttpOnly cookie
- If refresh succeeds: fetch user profile, restore session
- Multi-tab sync via `StorageEvent` listener

## Message Deduplication
- Client generates `clientMessageId` (random string) for each message
- Server checks `@@unique([clientMessageId, senderId])` constraint
- If duplicate found, returns existing message instead of creating new one
- Client replaces temporary message with server response

## Read/Delivery Receipts
1. **Sent**: Message saved to DB, broadcast to members
2. **Delivered**: Recipient's client emits `mark_delivered` when messages loaded
3. **Read**: Recipient's client emits `mark_read` when chat is active/focused

Receipts stored in both `MessageRead` and `MessageStatus` tables (redundant but provides flexibility).

## Multi-Tab Sync
- Auth state synced via `StorageEvent` (localStorage changes broadcast across tabs)
- Access token changes trigger re-fetch of user profile
- `isRefreshing` flag + `failedQueue` prevent parallel token refresh storms

## State Management
No dedicated sync engine or state management library. All state is:
- **React useState/useRef** for component state
- **React Context** for auth and socket
- **Direct API calls** for data fetching
- **Socket event handlers** for real-time updates
- **localStorage** for persistence (settings, offline queue, device ID)

## No Offline-First Architecture
The app is **online-first** with offline fallback:
- Data is fetched from server on every page load/chat open
- No local database or IndexedDB for offline message history
- No optimistic updates with server reconciliation
- Messages only available offline if they were loaded while online and cached in React state
