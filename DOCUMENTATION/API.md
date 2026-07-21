# API.md

## Base URL
- **Development (Vite proxy)**: `http://localhost:5173/api`
- **Direct backend**: `http://localhost:5000/api`
- **Docker**: `http://localhost/api` (via Nginx)

## Authentication
All authenticated endpoints require `Authorization: Bearer <accessToken>` header.
Refresh token is sent via HttpOnly cookie (browser) or request body (Capacitor).

## Rate Limiting
| Endpoint Group | Limit | Window |
|---------------|-------|--------|
| Auth (general) | 100 requests | 15 minutes |
| Login | 15 attempts | 15 minutes |
| Register | 5 attempts | 1 hour |
| File Upload | 10 uploads | 10 minutes |
| Diagnostics | 30 requests | 10 minutes |
| Bypass header | `x-bypass-rate-limit: bypass-key-123` |

---

## Auth Routes (`/api/auth`)

### POST `/api/auth/register`
Register a new user.
- **Body**: `{ email, username, password, displayName? }`
- **Returns 201**: `{ message, accessToken, user: { id, email, username, profile } }`
- **Returns 201** (verification required): `{ message, emailVerificationRequired: true }`

### POST `/api/auth/login`
Login with username/email + password.
- **Body**: `{ loginIdentifier, password }`
- **Returns 200**: `{ message, accessToken, user }` + Set-Cookie: refreshToken

### POST `/api/auth/refresh`
Rotate refresh token and get new access token.
- **Cookie**: refreshToken (or body: `{ refreshToken }`)
- **Returns 200**: `{ accessToken }` + Set-Cookie: new refreshToken

### POST `/api/auth/logout`
Clear session and refresh token.
- **Returns 200**: `{ message }`

### GET `/api/auth/me`
Get current user profile. Requires auth.
- **Returns 200**: `{ user: { id, email, username, publicId, profile } }`

### PUT `/api/auth/profile`
Update user profile. Requires auth.
- **Body**: `{ displayName?, bio?, avatarUrl?, username? }`
- **Returns 200**: `{ message, profile, user }`

### POST `/api/auth/change-password`
Change password. Requires auth.
- **Body**: `{ currentPassword, newPassword }`

### POST `/api/auth/forgot-password`
Request password reset.
- **Body**: `{ email }`
- **Returns 200**: Generic success message (prevents enumeration)

### POST `/api/auth/reset-password`
Reset password with token.
- **Body**: `{ token, newPassword }`

### POST `/api/auth/verify-email`
Verify email with token.
- **Body**: `{ token }`

### POST `/api/auth/device-token`
Register device for push notifications. Requires auth.
- **Body**: `{ token, deviceId, platform }`

---

## Chat Routes (`/api`)

### GET `/api/users/search?q=query`
Search users by username, email, or display name. Requires auth.
- **Returns 200**: Array of user profiles (sanitized by privacy settings)

### GET `/api/chats`
Get recent chats list with unread counts. Requires auth.
- **Returns 200**: Array of chat objects with otherMember, lastMessage, unreadCount

### GET `/api/chats/:chatId/messages?limit=50&cursor=<messageId>`
Fetch paginated messages for a chat. Requires auth.
- **Returns 200**: Array of messages (chronological order)

### POST `/api/chats/direct`
Create or get existing direct chat. Requires auth.
- **Body**: `{ otherUserId }`
- **Returns 200/201**: `{ id, type, otherMember, unreadCount }`

### PUT `/api/messages/:messageId`
Edit a message. Requires auth. Owner only.
- **Body**: `{ content }`

### DELETE `/api/messages/:messageId`
Soft-delete a message. Requires auth. Owner only.

### GET `/api/chats/ice-config`
Get WebRTC ICE server configuration. Requires auth.
- **Returns 200**: `{ iceServers, turnConfigured, turnUrlCount }`

### POST `/api/chats/group`
Create a group chat. Requires auth.
- **Body**: `{ name, description?, avatarUrl?, memberIds? }`
- **Returns 201**: Full chat object with members

### PUT `/api/chats/group/:id`
Update group metadata. Requires auth. OWNER/ADMIN only.
- **Body**: `{ name?, description?, avatarUrl? }`

### POST `/api/chats/group/:id/members`
Add members to group. Requires auth. OWNER/ADMIN only.
- **Body**: `{ memberIds: string[] }`

### DELETE `/api/chats/group/:id/members/:userId`
Remove member or leave group. Requires auth.
- Owner cannot leave (must transfer ownership first)
- Admins cannot remove other admins

### POST `/api/chats/group/:id/transfer-owner`
Transfer group ownership. Requires auth. OWNER only.
- **Body**: `{ newOwnerId }`

### POST `/api/diagnostics/log`
Client-side diagnostic logging. Requires auth.
- **Body**: `{ level, message, details? }`

---

## Friend Routes (`/api/friends`)

### GET `/api/friends/public-profile/:publicId`
Look up user by public ID (for QR code). Requires auth. Rate limited.
- **Returns 200**: `{ publicId, username, displayName, avatarUrl, bio, relationship, requestId, blockState }`

### POST `/api/friends/request`
Send friend request. Requires auth. Rate limited (5/min, 20/day).
- **Body**: `{ receiverId? | receiverUsername? | receiverPublicId? }`
- Respects `whoCanSendFriendRequests` privacy setting

### POST `/api/friends/request/:id/accept`
Accept friend request. Requires auth.

### POST `/api/friends/request/:id/reject`
Reject friend request. Requires auth.

### DELETE `/api/friends/request/:id/cancel`
Cancel outgoing friend request. Requires auth.

### DELETE `/api/friends/:friendId`
Remove friend. Requires auth.

### POST `/api/friends/block`
Block user. Requires auth.
- **Body**: `{ blockedId? | blockedPublicId? }`
- Also removes friendship and pending requests

### DELETE `/api/friends/block/:blockedId`
Unblock user. Requires auth. Accepts ID or publicId.

### GET `/api/friends`
List all friends. Requires auth.

### GET `/api/friends/requests`
List pending friend requests (incoming + outgoing). Requires auth.

### GET `/api/friends/blocked`
List blocked users. Requires auth.

---

## Call Routes (`/api/calls`)

### POST `/api/calls/log`
Create or update call log. Requires auth.
- **Body**: `{ id?, callerId?, receiverId, callType, startedAt?, endedAt?, durationSeconds?, status }`

### GET `/api/calls/history`
Get call history (last 50). Requires auth.

---

## Notification Routes (`/api/notifications`)

### GET `/api/notifications?page=1&limit=20`
Get paginated notifications (excludes MESSAGE type). Requires auth.

### GET `/api/notifications/preferences`
Get notification preferences. Requires auth.

### PUT `/api/notifications/preferences`
Update notification/privacy preferences. Requires auth.
- **Body**: `{ messages?, calls?, friendRequests?, groupNotifications?, soundEffects?, whoCanSendFriendRequests?, whoCanCallMe?, whoCanSeeProfilePhoto?, whoCanSeeLastSeen? }`

### PUT `/api/notifications/read-all`
Mark all notifications as read. Requires auth.

### PUT `/api/notifications/:id/read`
Mark single notification as read. Requires auth.

---

## Upload Routes (`/api/upload`)

### POST `/api/upload`
Upload a file. Requires auth. Rate limited.
- **Content-Type**: multipart/form-data, field: `file`
- **Accepted types**: Images, Videos, Audio, PDFs, Office docs, ZIP archives
- **Size limits**: Image 25MB, Audio/Document 100MB, Archive 250MB, Video 500MB
- **Validation**: MIME type check + magic byte signature verification
- **Returns 200**: `{ message, fileUrl, fileName, fileSize, mimeType }`

---

## Observability Routes (`/api/observability`)

### GET `/api/observability/health`
Health check endpoint. No auth required.
- **Returns 200/503**: `{ status, timestamp, uptime, system, database }`

### GET `/api/observability/metrics`
Application metrics. Requires auth.
- **Returns 200**: `{ timestamp, system: { uptime, memory }, db_aggregates: { users, messages, chats, notifications } }`

---

## Debug Routes

### POST `/api/debug/mobile-write-test`
Database write test. No auth.

### GET `/api/debug/mobile-write-test/:id`
Database read test. No auth.

### GET `/`
Health check. Returns `{ message: 'Secure Real-time Chat API is running!' }`
