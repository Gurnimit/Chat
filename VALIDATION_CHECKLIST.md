# VALIDATION_CHECKLIST.md

## How to Use This Checklist

1. Start the application using `docker-compose up --build` or the local dev setup
2. Use two browser windows (one normal, one incognito) to simulate two users
3. Test each feature sequentially
4. Mark Pass or Fail in the Status column
5. If a test fails, log the issue in KNOWN_BUGS.md with reproduction steps

## Seed Accounts

| User | Username | Email | Password |
|------|----------|-------|----------|
| Alice | alice | alice@example.com | password123 |
| Bob | bob | bob@example.com | password123 |
| Charlie | charlie | charlie@example.com | password123 |

---

## 1. Authentication

### 1.1 User Registration

| Field | Value |
|-------|-------|
| **Expected behavior** | New user can create an account with email, username, password, and optional display name. Account is created, tokens are issued, user is logged in. |
| **Steps to test** | 1. Navigate to the login page. 2. Click "Create an account". 3. Enter a unique email, username, and password (min 6 chars). 4. Click Continue. 5. Optionally enter display name. 6. Click Create Account. |
| **Backend** | `server/src/routes/auth.routes.ts` — POST `/api/auth/register` |
| **Frontend** | `client/src/pages/Login.tsx` — register step 1 and step 2 |
| **Database** | User, Profile, NotificationPreference, Session |
| **WebSocket** | None |
| **Expected result** | User is created in DB. Access token returned. Refresh token set as HttpOnly cookie. User is redirected to chat dashboard. |
| **Status** | |

### 1.2 User Registration — Duplicate Prevention

| Field | Value |
|-------|-------|
| **Expected behavior** | Registration with an existing email or username is rejected. |
| **Steps to test** | 1. Register with email `alice@example.com`. 2. Observe error message. 3. Register with username `alice`. 4. Observe error message. |
| **Backend** | `server/src/routes/auth.routes.ts` — POST `/api/auth/register` |
| **Frontend** | `client/src/pages/Login.tsx` |
| **Database** | User |
| **WebSocket** | None |
| **Expected result** | Error message: "Email or username already in use". No user created. |
| **Status** | |

### 1.3 User Registration — Password Validation

| Field | Value |
|-------|-------|
| **Expected behavior** | Passwords shorter than 6 characters are rejected. |
| **Steps to test** | 1. Attempt to register with a 5-character password. 2. Observe client-side validation message. |
| **Backend** | `server/src/routes/auth.routes.ts` |
| **Frontend** | `client/src/pages/Login.tsx` — step 1 validation |
| **Database** | None |
| **WebSocket** | None |
| **Expected result** | Error: "Password must be at least 6 characters." |
| **Status** | |

### 1.4 User Login — With Username

| Field | Value |
|-------|-------|
| **Expected behavior** | User can log in using their username. |
| **Steps to test** | 1. Navigate to login page. 2. Enter username `alice`. 3. Enter password `password123`. 4. Click Sign In. |
| **Backend** | `server/src/routes/auth.routes.ts` — POST `/api/auth/login` |
| **Frontend** | `client/src/context/AuthContext.tsx` — login function |
| **Database** | User, Session, Profile |
| **WebSocket** | None |
| **Expected result** | Login succeeds. Access token stored. User redirected to chat dashboard. Profile shows online status. |
| **Status** | |

### 1.5 User Login — With Email

| Field | Value |
|-------|-------|
| **Expected behavior** | User can log in using their email address. |
| **Steps to test** | 1. Navigate to login page. 2. Enter email `alice@example.com`. 3. Enter password `password123`. 4. Click Sign In. |
| **Backend** | `server/src/routes/auth.routes.ts` — POST `/api/auth/login` |
| **Frontend** | `client/src/context/AuthContext.tsx` |
| **Database** | User, Session |
| **WebSocket** | None |
| **Expected result** | Login succeeds. Same behavior as username login. |
| **Status** | |

### 1.6 User Login — Incorrect Password

| Field | Value |
|-------|-------|
| **Expected behavior** | Wrong password returns a generic error (no user enumeration). |
| **Steps to test** | 1. Enter username `alice` with wrong password. 2. Observe error. 3. Enter username `nonexistent_user` with any password. 4. Observe error is identical. |
| **Backend** | `server/src/routes/auth.routes.ts` — POST `/api/auth/login` |
| **Frontend** | `client/src/pages/Login.tsx` |
| **Database** | User |
| **WebSocket** | None |
| **Expected result** | Both cases return: "Invalid email/username or password". Timing is similar (dummy bcrypt comparison). |
| **Status** | |

### 1.7 Logout

| Field | Value |
|-------|-------|
| **Expected behavior** | User is logged out, session destroyed, tokens cleared. |
| **Steps to test** | 1. While logged in, click the logout button. 2. Observe redirect to login page. 3. Try to access `/api/auth/me` — should return 401. 4. Refresh the page — should stay on login page. |
| **Backend** | `server/src/routes/auth.routes.ts` — POST `/api/auth/logout` |
| **Frontend** | `client/src/context/AuthContext.tsx` — logout function |
| **Database** | Session (deleted) |
| **WebSocket** | None |
| **Expected result** | Session row deleted from DB. Cookie cleared. Client state reset. Page refresh does not restore session. |
| **Status** | |

### 1.8 Token Refresh

| Field | Value |
|-------|-------|
| **Expected behavior** | Access token is automatically refreshed when it expires (15 min). |
| **Steps to test** | 1. Log in as alice. 2. Open browser DevTools > Network tab. 3. Wait for access token to expire (or manually set a short expiry for testing). 4. Perform any action (e.g., load chats). 5. Observe a 403 response followed by a successful refresh + retry. |
| **Backend** | `server/src/routes/auth.routes.ts` — POST `/api/auth/refresh` |
| **Frontend** | `client/src/context/AuthContext.tsx` — Axios response interceptor |
| **Database** | Session |
| **WebSocket** | None |
| **Expected result** | Old session deleted, new session created, new access token issued, original request retried transparently. |
| **Status** | |

### 1.9 Token Refresh — Grace Period

| Field | Value |
|-------|-------|
| **Expected behavior** | After a token rotation, the old refresh token works for 30 seconds (grace period). |
| **Steps to test** | 1. Log in. 2. Immediately trigger two parallel refresh requests. 3. Both should succeed (coalescing). 4. After the first refresh, use the OLD refresh token within 30 seconds. 5. It should still work. 6. After 30 seconds, it should fail. |
| **Backend** | `server/src/routes/auth.routes.ts` — rotatedTokensGrace Map |
| **Frontend** | `client/src/context/AuthContext.tsx` — failedQueue |
| **Database** | Session |
| **WebSocket** | None |
| **Expected result** | Parallel refreshes coalesce. Grace period works. |
| **Status** | |

### 1.10 Forgot Password

| Field | Value |
|-------|-------|
| **Expected behavior** | User can request a password reset. A token is generated. |
| **Steps to test** | 1. On login page, click "Forgot password?". 2. Enter `alice@example.com`. 3. Click Send Reset Link. 4. Check server console for the reset link. |
| **Backend** | `server/src/routes/auth.routes.ts` — POST `/api/auth/forgot-password` |
| **Frontend** | `client/src/pages/Login.tsx` — forgot view |
| **Database** | User (passwordResetToken, passwordResetExpires) |
| **WebSocket** | None |
| **Expected result** | Success message shown. Reset token logged to server console (no email service). |
| **Status** | |

### 1.11 Reset Password

| Field | Value |
|-------|-------|
| **Expected behavior** | User can reset password using the token from forgot-password. |
| **Steps to test** | 1. Copy the reset token from server console. 2. Navigate to `/reset-password?token=<token>`. 3. Enter new password. 4. Click Reset Password. 5. Try logging in with old password — should fail. 6. Try logging in with new password — should succeed. |
| **Backend** | `server/src/routes/auth.routes.ts` — POST `/api/auth/reset-password` |
| **Frontend** | `client/src/pages/Login.tsx` — reset view |
| **Database** | User (passwordHash updated), Session (all deleted) |
| **WebSocket** | None |
| **Expected result** | Password updated. All existing sessions invalidated. Old password no longer works. |
| **Status** | |

### 1.12 Email Verification

| Field | Value |
|-------|-------|
| **Expected behavior** | When EMAIL_VERIFICATION_REQUIRED=true, new accounts must verify email before logging in. |
| **Steps to test** | 1. Set `EMAIL_VERIFICATION_REQUIRED=true` in server `.env`. 2. Register a new account (not alice/bob/charlie). 3. Observe "verification required" message. 4. Copy verification token from server console. 5. Navigate to `/verify-email?token=<token>`. 6. Observe success message. 7. Try logging in. |
| **Backend** | `server/src/routes/auth.routes.ts` — POST `/api/auth/verify-email` |
| **Frontend** | `client/src/pages/Login.tsx` — verify view |
| **Database** | User (isEmailVerified, emailVerificationToken) |
| **WebSocket** | None |
| **Expected result** | Unverified user cannot log in (403). After verification, login succeeds. |
| **Status** | |

### 1.13 Change Password

| Field | Value |
|-------|-------|
| **Expected behavior** | Logged-in user can change their password. |
| **Steps to test** | 1. Log in as alice. 2. Open settings/profile. 3. Enter current password and new password. 4. Submit. 5. Log out. 6. Log in with new password. |
| **Backend** | `server/src/routes/auth.routes.ts` — POST `/api/auth/change-password` |
| **Frontend** | `client/src/pages/ChatDashboard.tsx` — settings panel |
| **Database** | User (passwordHash) |
| **WebSocket** | None |
| **Expected result** | Password updated. Old password no longer works. |
| **Status** | |

---

## 2. User Profile

### 2.1 View Profile

| Field | Value |
|-------|-------|
| **Expected behavior** | User can view their own profile information. |
| **Steps to test** | 1. Log in as alice. 2. Open the profile/settings panel. 3. Verify display name, bio, avatar, and username are displayed. |
| **Backend** | `server/src/routes/auth.routes.ts` — GET `/api/auth/me` |
| **Frontend** | `client/src/context/AuthContext.tsx` — initializeAuth |
| **Database** | User, Profile |
| **WebSocket** | None |
| **Expected result** | Profile data matches seed data. |
| **Status** | |

### 2.2 Edit Profile — Display Name

| Field | Value |
|-------|-------|
| **Expected behavior** | User can update their display name. |
| **Steps to test** | 1. Open profile settings. 2. Change display name to "Alice W." 3. Click Save. 4. Verify the new name appears in the sidebar and chat header. |
| **Backend** | `server/src/routes/auth.routes.ts` — PUT `/api/auth/profile` |
| **Frontend** | `client/src/context/AuthContext.tsx` — updateProfile |
| **Database** | Profile |
| **WebSocket** | None |
| **Expected result** | Display name updated in DB and reflected in UI immediately. |
| **Status** | |

### 2.3 Edit Profile — Bio

| Field | Value |
|-------|-------|
| **Expected behavior** | User can update their bio. |
| **Steps to test** | 1. Open profile settings. 2. Change bio text. 3. Click Save. 4. Verify bio updated in the info panel. |
| **Backend** | `server/src/routes/auth.routes.ts` — PUT `/api/auth/profile` |
| **Frontend** | `client/src/context/AuthContext.tsx` — updateProfile |
| **Database** | Profile |
| **WebSocket** | None |
| **Expected result** | Bio updated in DB and reflected in UI. |
| **Status** | |

### 2.4 Edit Profile — Username Change

| Field | Value |
|-------|-------|
| **Expected behavior** | User can change their username (must be unique). |
| **Steps to test** | 1. Open profile settings. 2. Change username to a unique value. 3. Save. 4. Try changing to `bob` — should fail. |
| **Backend** | `server/src/routes/auth.routes.ts` — PUT `/api/auth/profile` |
| **Frontend** | `client/src/context/AuthContext.tsx` — updateProfile |
| **Database** | User (username) |
| **WebSocket** | None |
| **Expected result** | Unique username change succeeds. Duplicate username rejected with "Username is already taken". |
| **Status** | |

### 2.5 Edit Profile — Avatar URL

| Field | Value |
|-------|-------|
| **Expected behavior** | User can set an avatar URL. |
| **Steps to test** | 1. Open profile settings. 2. Enter a valid image URL in the avatar field. 3. Save. 4. Verify avatar updates in sidebar and chat. |
| **Backend** | `server/src/routes/auth.routes.ts` — PUT `/api/auth/profile` |
| **Frontend** | `client/src/context/AuthContext.tsx` |
| **Database** | Profile (avatarUrl) |
| **WebSocket** | None |
| **Expected result** | Avatar URL stored and displayed. If URL is invalid, fallback initials are shown. |
| **Status** | |

### 2.6 Avatar Upload via File Upload

| Field | Value |
|-------|-------|
| **Expected behavior** | User can upload an image file as avatar via the general file upload mechanism. |
| **Steps to test** | 1. Open profile settings. 2. Click the avatar upload area. 3. Select an image file. 4. Verify the file uploads. 5. Copy the returned fileUrl. 6. Set it as avatarUrl in profile. 7. Save. |
| **Backend** | `server/src/routes/upload.routes.ts` — POST `/api/upload` |
| **Frontend** | `client/src/pages/ChatDashboard.tsx` — avatar upload handler |
| **Database** | Profile (avatarUrl) |
| **WebSocket** | None |
| **Expected result** | Image uploaded, URL returned, avatar displayed. |
| **Status** | |

---

## 3. Friend System

### 3.1 Search Users

| Field | Value |
|-------|-------|
| **Expected behavior** | User can search for other users by username, email, or display name. |
| **Steps to test** | 1. Log in as alice. 2. Open the user search modal. 3. Type "bob". 4. Verify Bob appears in results. 5. Verify alice does not appear in results (excluded). |
| **Backend** | `server/src/routes/chat.routes.ts` — GET `/api/users/search` |
| **Frontend** | `client/src/pages/ChatDashboard.tsx` — handleUserSearch |
| **Database** | User, Profile |
| **WebSocket** | None |
| **Expected result** | Search returns matching users (excluding self). Results are sanitized by privacy settings. |
| **Status** | |

### 3.2 Send Friend Request

| Field | Value |
|-------|-------|
| **Expected behavior** | User can send a friend request to another user. |
| **Steps to test** | 1. Log in as alice (Window 1). 2. Log in as bob (Window 2). 3. As alice, search for bob. 4. Click "Add Friend" or send friend request. 5. Verify bob receives a real-time notification. |
| **Backend** | `server/src/routes/friend.routes.ts` — POST `/api/friends/request` |
| **Frontend** | `client/src/pages/ChatDashboard.tsx` — handleSendFriendRequest |
| **Database** | FriendRequest |
| **WebSocket** | `friend_request_received` |
| **Expected result** | FriendRequest created with status PENDING. Bob receives socket event and push notification. |
| **Status** | |

### 3.3 Accept Friend Request

| Field | Value |
|-------|-------|
| **Expected behavior** | Receiver can accept a pending friend request. |
| **Steps to test** | 1. As bob, open the Friends tab. 2. See pending request from alice. 3. Click Accept. 4. Verify alice receives a real-time notification. 5. Verify both users now appear in each other's friend list. |
| **Backend** | `server/src/routes/friend.routes.ts` — POST `/api/friends/request/:id/accept` |
| **Frontend** | `client/src/pages/ChatDashboard.tsx` — handleAcceptFriendRequest |
| **Database** | FriendRequest (ACCEPTED), Friendship (2 rows) |
| **WebSocket** | `friend_request_accepted`, `friend_list_changed` |
| **Expected result** | Two Friendship records created (bidirectional). Both users' friend lists update in real-time. |
| **Status** | |

### 3.4 Reject Friend Request

| Field | Value |
|-------|-------|
| **Expected behavior** | Receiver can reject a pending friend request. |
| **Steps to test** | 1. As charlie, send a friend request to alice. 2. As alice, open Friends > Pending. 3. Click Reject on charlie's request. 4. Verify charlie receives notification. |
| **Backend** | `server/src/routes/friend.routes.ts` — POST `/api/friends/request/:id/reject` |
| **Frontend** | `client/src/pages/ChatDashboard.tsx` — handleRejectFriendRequest |
| **Database** | FriendRequest (REJECTED) |
| **WebSocket** | `friend_request_rejected` |
| **Expected result** | Request status updated to REJECTED. No Friendship created. |
| **Status** | |

### 3.5 Cancel Friend Request

| Field | Value |
|-------|-------|
| **Expected behavior** | Sender can cancel a pending friend request. |
| **Steps to test** | 1. As alice, send a friend request to charlie. 2. As alice, open Friends > Pending > Outgoing. 3. Click Cancel on the request to charlie. 4. Verify charlie receives notification. |
| **Backend** | `server/src/routes/friend.routes.ts` — DELETE `/api/friends/request/:id/cancel` |
| **Frontend** | `client/src/pages/ChatDashboard.tsx` — handleCancelFriendRequest |
| **Database** | FriendRequest (deleted) |
| **WebSocket** | `friend_request_cancelled` |
| **Expected result** | FriendRequest deleted. Charlie no longer sees the pending request. |
| **Status** | |

### 3.6 Remove Friend

| Field | Value |
|-------|-------|
| **Expected behavior** | User can remove an existing friend. |
| **Steps to test** | 1. Ensure alice and bob are friends. 2. As alice, open Friends > Friends list. 3. Click Remove on bob. 4. Verify both users' friend lists update. 5. Verify alice can no longer start a direct chat with bob. |
| **Backend** | `server/src/routes/friend.routes.ts` — DELETE `/api/friends/:friendId` |
| **Frontend** | `client/src/pages/ChatDashboard.tsx` — handleRemoveFriendPublic |
| **Database** | Friendship (both rows deleted), FriendRequest (cleaned up) |
| **WebSocket** | `friend_removed`, `friend_list_changed` |
| **Expected result** | Both Friendship rows deleted. Direct chat creation now fails. |
| **Status** | |

### 3.7 Block User

| Field | Value |
|-------|-------|
| **Expected behavior** | User can block another user. Removes existing friendship and pending requests. |
| **Steps to test** | 1. As alice, block bob. 2. Verify friendship is removed. 3. As bob, try to send a message to alice — should fail. 4. As bob, try to call alice — should fail. 5. As bob, try to send a friend request — should fail. |
| **Backend** | `server/src/routes/friend.routes.ts` — POST `/api/friends/block` |
| **Frontend** | `client/src/pages/ChatDashboard.tsx` — handleBlockUser |
| **Database** | Block, Friendship (deleted), FriendRequest (deleted) |
| **WebSocket** | `user_blocked`, `blocked_by_user`, `friend_list_changed` |
| **Expected result** | Block record created. Friendship removed. Blocked user cannot interact. |
| **Status** | |

### 3.8 Unblock User

| Field | Value |
|-------|-------|
| **Expected behavior** | User can unblock a previously blocked user. |
| **Steps to test** | 1. As alice, open Friends > Blocked. 2. Click Unblock on bob. 3. Verify bob can now send friend requests. |
| **Backend** | `server/src/routes/friend.routes.ts` — DELETE `/api/friends/block/:blockedId` |
| **Frontend** | `client/src/pages/ChatDashboard.tsx` — handleUnblockUser |
| **Database** | Block (deleted) |
| **WebSocket** | `user_unblocked`, `unblocked_by_user` |
| **Expected result** | Block record deleted. Interactions are restored. |
| **Status** | |

### 3.9 Self-Friend Request Prevention

| Field | Value |
|-------|-------|
| **Expected behavior** | User cannot send a friend request to themselves. |
| **Steps to test** | 1. As alice, try to send a friend request to herself (via API or UI if possible). |
| **Backend** | `server/src/routes/friend.routes.ts` — POST `/api/friends/request` |
| **Frontend** | `client/src/pages/ChatDashboard.tsx` |
| **Database** | None |
| **WebSocket** | None |
| **Expected result** | Error: "Cannot send a friend request to yourself". |
| **Status** | |

### 3.10 QR Code — Generate

| Field | Value |
|-------|-------|
| **Expected behavior** | User's QR code is generated from their publicId. |
| **Steps to test** | 1. Open Friends > QR Invite tab. 2. Verify a QR code image is displayed. 3. Decode the QR code — should contain JSON with type "friend", publicId, and version. |
| **Backend** | None (client-side generation) |
| **Frontend** | `client/src/pages/ChatDashboard.tsx` — QRCode.toDataURL |
| **Database** | None |
| **WebSocket** | None |
| **Expected result** | QR code displayed. Payload: `{"type":"friend","publicId":"VC-XXXXXXXX","version":1}`. |
| **Status** | |

### 3.11 QR Code — Scan via Camera

| Field | Value |
|-------|-------|
| **Expected behavior** | User can scan another user's QR code via camera. |
| **Steps to test** | 1. Open Friends > QR Invite > Scan tab on device 1. 2. Grant camera permission. 3. Point camera at device 2's QR code. 4. Verify the scanned profile is displayed. |
| **Backend** | `server/src/routes/friend.routes.ts` — GET `/api/friends/public-profile/:publicId` |
| **Frontend** | `client/src/pages/ChatDashboard.tsx` — startCameraScan, jsQR |
| **Database** | User, Profile, Friendship, FriendRequest, Block |
| **WebSocket** | None |
| **Expected result** | Camera opens, QR decoded, profile fetched and displayed with relationship status. |
| **Status** | |

### 3.12 QR Code — Scan via Gallery

| Field | Value |
|-------|-------|
| **Expected behavior** | User can import a QR code image from their gallery. |
| **Steps to test** | 1. Save a QR code image. 2. Open Friends > QR Invite > Scan. 3. Click gallery import. 4. Select the saved QR image. 5. Verify the profile is displayed. |
| **Backend** | `server/src/routes/friend.routes.ts` — GET `/api/friends/public-profile/:publicId` |
| **Frontend** | `client/src/pages/ChatDashboard.tsx` — handleGalleryImport |
| **Database** | User, Profile |
| **WebSocket** | None |
| **Expected result** | QR decoded from image, profile fetched. |
| **Status** | |

### 3.13 Public Profile Lookup — Relationship States

| Field | Value |
|-------|-------|
| **Expected behavior** | Public profile lookup returns correct relationship status. |
| **Steps to test** | 1. As alice, look up bob's profile via QR. If not friends: relationship = "NONE". 2. Send friend request. Lookup shows "PENDING_SENT". 3. As bob, lookup alice shows "PENDING_RECEIVED". 4. Accept. Lookup shows "FRIENDS". 5. Block. Lookup shows "BLOCKED". |
| **Backend** | `server/src/routes/friend.routes.ts` — GET `/api/friends/public-profile/:publicId` |
| **Frontend** | `client/src/pages/ChatDashboard.tsx` — fetchAndPreviewProfile |
| **Database** | Friendship, FriendRequest, Block |
| **WebSocket** | None |
| **Expected result** | Relationship field matches actual state. |
| **Status** | |

### 3.14 Friend Request Privacy — Who Can Send

| Field | Value |
|-------|-------|
| **Expected behavior** | Privacy setting controls who can send friend requests. |
| **Steps to test** | 1. As bob, set whoCanSendFriendRequests to "NOONE". 2. As charlie, try to send a friend request to bob — should fail with 403. 3. As bob, change to "FRIENDS". 4. As charlie (not a friend of bob), try again — should fail. 5. As alice (friend of bob), try — should succeed. |
| **Backend** | `server/src/routes/friend.routes.ts` — POST `/api/friends/request` |
| **Frontend** | `client/src/pages/ChatDashboard.tsx` — updatePreference |
| **Database** | NotificationPreference, FriendRequest |
| **WebSocket** | None |
| **Expected result** | Requests are blocked based on privacy setting. |
| **Status** | |

### 3.15 Friend Request Rate Limiting

| Field | Value |
|-------|-------|
| **Expected behavior** | Friend requests are rate limited (5 per minute, 20 per day). |
| **Steps to test** | 1. As alice, send 5 friend requests to different users within 1 minute. 2. The 6th should fail. 3. Send 20 in a day. 4. The 21st should fail. |
| **Backend** | `server/src/utils/rateLimit.ts` — checkFriendRequestLimit |
| **Frontend** | `client/src/pages/ChatDashboard.tsx` |
| **Database** | None (in-memory rate limit) |
| **WebSocket** | None |
| **Expected result** | 6th request in a minute returns 429. 21st in a day returns 429. |
| **Status** | |

---

## 4. Direct Messaging

### 4.1 Create Direct Chat

| Field | Value |
|-------|-------|
| **Expected behavior** | Friends can create a direct chat. Non-friends cannot. |
| **Steps to test** | 1. As alice, search for bob. 2. Click to start a chat. 3. Verify chat appears in sidebar. 4. As charlie (not friends with alice), try to create a direct chat — should fail. |
| **Backend** | `server/src/routes/chat.routes.ts` — POST `/api/chats/direct` |
| **Frontend** | `client/src/pages/ChatDashboard.tsx` — startDirectChat |
| **Database** | Chat, ChatMember |
| **WebSocket** | None |
| **Expected result** | Direct chat created with 2 ChatMember rows. Non-friends rejected. |
| **Status** | |

### 4.2 Send Message

| Field | Value |
|-------|-------|
| **Expected behavior** | Message is sent in real-time to the other user. |
| **Steps to test** | 1. Open alice and bob in separate windows. 2. As alice, open chat with bob. 3. Type a message. 4. Press Send. 5. Verify message appears instantly in both windows. |
| **Backend** | `server/src/sockets/chat.socket.ts` — `send_message` |
| **Frontend** | `client/src/pages/ChatDashboard.tsx` — handleSendMessage |
| **Database** | Message |
| **WebSocket** | `send_message` (client→server), `message_received` (server→client) |
| **Expected result** | Message saved to DB. Broadcast to all chat members. Appears in both UIs. |
| **Status** | |

### 4.3 Message Deduplication

| Field | Value |
|-------|-------|
| **Expected behavior** | Duplicate messages (same clientMessageId) are not created twice. |
| **Steps to test** | 1. As alice, send a message. 2. If network is slow, the client may retry. 3. Verify only one message appears. |
| **Backend** | `server/src/sockets/chat.socket.ts` — clientMessageId check |
| **Frontend** | `client/src/pages/ChatDashboard.tsx` — clientMessageId generation |
| **Database** | Message (clientMessageId + senderId unique constraint) |
| **WebSocket** | `send_message` |
| **Expected result** | Only one Message row created per unique clientMessageId. |
| **Status** | |

### 4.4 Edit Message

| Field | Value |
|-------|-------|
| **Expected behavior** | Sender can edit their own messages. |
| **Steps to test** | 1. As alice, send a message "Hello". 2. Right-click or long-press the message. 3. Click Edit. 4. Change text to "Hello, Bob!". 5. Save. 6. Verify both windows show updated text with "edited" indicator. |
| **Backend** | `server/src/sockets/chat.socket.ts` — `edit_message` |
| **Frontend** | `client/src/pages/ChatDashboard.tsx` — editingMessage state |
| **Database** | Message (content, isEdited) |
| **WebSocket** | `edit_message` (client→server), `message_edited` (server→client) |
| **Expected result** | Message content updated. isEdited=true. Other users see the edit. |
| **Status** | |

### 4.5 Edit Message — Cannot Edit Others' Messages

| Field | Value |
|-------|-------|
| **Expected behavior** | User can only edit their own messages. |
| **Steps to test** | 1. As bob, send a message. 2. As alice, try to edit bob's message. |
| **Backend** | `server/src/sockets/chat.socket.ts` — senderId check |
| **Frontend** | `client/src/pages/ChatDashboard.tsx` |
| **Database** | None |
| **WebSocket** | `edit_message` |
| **Expected result** | Edit is silently ignored (no error, no change). |
| **Status** | |

### 4.6 Delete Message (Soft Delete)

| Field | Value |
|-------|-------|
| **Expected behavior** | Sender can soft-delete their own messages. |
| **Steps to test** | 1. As alice, send a message. 2. Right-click the message. 3. Click Delete. 4. Verify both windows show "This message was deleted". |
| **Backend** | `server/src/sockets/chat.socket.ts` — `delete_message` |
| **Frontend** | `client/src/pages/ChatDashboard.tsx` |
| **Database** | Message (content="This message was deleted", isDeleted=true) |
| **WebSocket** | `delete_message` (client→server), `message_deleted` (server→client) |
| **Expected result** | Message content replaced with "This message was deleted". isDeleted=true. Attachments preserved. |
| **Status** | |

### 4.7 Message Reply

| Field | Value |
|-------|-------|
| **Expected behavior** | User can reply to a specific message. |
| **Steps to test** | 1. As alice, send a message. 2. As bob, right-click alice's message. 3. Click Reply. 4. Type a reply. 5. Send. 6. Verify the reply shows a quoted reference to the original message. |
| **Backend** | `server/src/sockets/chat.socket.ts` — `send_message` with replyToId |
| **Frontend** | `client/src/pages/ChatDashboard.tsx` — replyingToMessage state |
| **Database** | Message (replyToId) |
| **WebSocket** | `send_message`, `message_received` |
| **Expected result** | New message has replyToId pointing to original. UI shows quoted message. |
| **Status** | |

### 4.8 Message Reactions

| Field | Value |
|-------|-------|
| **Expected behavior** | User can toggle emoji reactions on messages. |
| **Steps to test** | 1. As alice, send a message. 2. As bob, click the smiley icon on the message. 3. Select an emoji. 4. Verify reaction appears on both windows. 5. Click the same emoji again to remove it. |
| **Backend** | `server/src/sockets/chat.socket.ts` — `react_message` |
| **Frontend** | `client/src/pages/ChatDashboard.tsx` — showEmojiPickerForMessageId |
| **Database** | MessageReaction |
| **WebSocket** | `react_message` (client→server), `message_reaction` (server→client) |
| **Expected result** | Reaction added/removed. Toggle behavior works. Both users see the update. |
| **Status** | |

### 4.9 Read Receipts — Sent → Delivered

| Field | Value |
|-------|-------|
| **Expected behavior** | Sender sees delivery confirmation when recipient loads messages. |
| **Steps to test** | 1. As alice, send a message to bob. 2. As bob, open the chat. 3. Observe alice's message now shows delivery indicator (single check → double check or similar). |
| **Backend** | `server/src/sockets/chat.socket.ts` — `mark_delivered` |
| **Frontend** | `client/src/pages/ChatDashboard.tsx` — mark_delivered emission |
| **Database** | MessageStatus (deliveredAt) |
| **WebSocket** | `mark_delivered` (client→server), `messages_delivered` (server→client) |
| **Expected result** | MessageStatus row created with deliveredAt timestamp. Sender sees delivery confirmation. |
| **Status** | |

### 4.10 Read Receipts — Delivered → Read

| Field | Value |
|-------|-------|
| **Expected behavior** | Sender sees read confirmation when recipient views the message. |
| **Steps to test** | 1. As alice, send a message. 2. As bob, open the chat and view the message. 3. Observe alice's message shows read indicator (double check with color change or similar). |
| **Backend** | `server/src/sockets/chat.socket.ts` — `mark_read` |
| **Frontend** | `client/src/pages/ChatDashboard.tsx` — mark_read emission |
| **Database** | MessageRead (readAt), MessageStatus (readAt) |
| **WebSocket** | `mark_read` (client→server), `messages_read` (server→client) |
| **Expected result** | MessageRead and MessageStatus rows updated with readAt. Sender sees read confirmation. |
| **Status** | |

### 4.11 Typing Indicators

| Field | Value |
|-------|-------|
| **Expected behavior** | When one user types, the other sees a typing indicator. |
| **Steps to test** | 1. Open alice and bob in separate windows. 2. As alice, click in the message input. 3. Observe bob sees "typing..." indicator. 4. As alice, stop typing for 2 seconds. 5. Observe bob's typing indicator disappears. |
| **Backend** | `server/src/sockets/chat.socket.ts` — `typing`, `user_typing` |
| **Frontend** | `client/src/pages/ChatDashboard.tsx` — handleInputChange, typingUsers state |
| **Database** | None |
| **WebSocket** | `typing` (client→server), `user_typing` (server→client) |
| **Expected result** | Typing indicator appears/disappears with 2-second debounce. |
| **Status** | |

### 4.12 Message History — Pagination

| Field | Value |
|-------|-------|
| **Expected behavior** | Messages are loaded with cursor-based pagination. |
| **Steps to test** | 1. Create a chat with 60+ messages. 2. Open the chat. 3. Verify the first 50 messages load. 4. Scroll up to trigger loading more messages. |
| **Backend** | `server/src/routes/chat.routes.ts` — GET `/api/chats/:chatId/messages` |
| **Frontend** | `client/src/pages/ChatDashboard.tsx` — fetchMessages |
| **Database** | Message |
| **WebSocket** | None |
| **Expected result** | Messages load in batches of 50. Older messages load on scroll. |
| **Status** | |

### 4.13 Chat List — Sorted by Last Message

| Field | Value |
|-------|-------|
| **Expected behavior** | Chat list is sorted by most recent message. |
| **Steps to test** | 1. Have chats with alice-bob and alice-charlie. 2. Send a message in alice-charlie. 3. Verify alice-charlie chat moves to top of alice's list. |
| **Backend** | `server/src/routes/chat.routes.ts` — GET `/api/chats` |
| **Frontend** | `client/src/pages/ChatDashboard.tsx` — fetchChats |
| **Database** | Chat, Message |
| **WebSocket** | None |
| **Expected result** | Chat list sorted by lastMessage.createdAt descending. |
| **Status** | |

### 4.14 Unread Count

| Field | Value |
|-------|-------|
| **Expected behavior** | Unread message count is shown per chat. |
| **Steps to test** | 1. As bob, receive a message from alice while not viewing the chat. 2. Verify unread badge appears on the chat. 3. Open the chat. 4. Verify badge clears. |
| **Backend** | `server/src/routes/chat.routes.ts` — GET `/api/chats` |
| **Frontend** | `client/src/pages/ChatDashboard.tsx` — unreadCount |
| **Database** | ChatMember (lastReadMessageId), Message |
| **WebSocket** | `message_received` |
| **Expected result** | Unread count increments on new message, resets when chat is opened. |
| **Status** | |

### 4.15 Block Enforcement — Messages

| Field | Value |
|-------|-------|
| **Expected behavior** | Blocked users cannot send messages to each other. |
| **Steps to test** | 1. As alice, block bob. 2. As bob, try to send a message to alice in their existing direct chat. 3. Verify the message is rejected. |
| **Backend** | `server/src/sockets/chat.socket.ts` — block check in send_message |
| **Frontend** | `client/src/pages/ChatDashboard.tsx` |
| **Database** | Block |
| **WebSocket** | `send_message` |
| **Expected result** | Socket emits `message_error` with "Blocked user. Action not permitted." Message not saved. |
| **Status** | |

---

## 5. Group Messaging

### 5.1 Create Group Chat

| Field | Value |
|-------|-------|
| **Expected behavior** | User can create a group chat with friends. |
| **Steps to test** | 1. As alice, click Create Group. 2. Enter group name "Test Group". 3. Select bob and charlie as members. 4. Click Create Group. 5. Verify group appears in chat list. 6. Verify bob and charlie receive notifications. |
| **Backend** | `server/src/routes/chat.routes.ts` — POST `/api/chats/group` |
| **Frontend** | `client/src/pages/ChatDashboard.tsx` — handleCreateGroup |
| **Database** | Chat (type=GROUP), ChatMember (3 rows with roles) |
| **WebSocket** | `group_created` |
| **Expected result** | Group created. Creator is OWNER. Members are MEMBER. All members notified via socket and push. |
| **Status** | |

### 5.2 Send Message in Group

| Field | Value |
|-------|-------|
| **Expected behavior** | All group members receive messages in real-time. |
| **Steps to test** | 1. As alice, open the group chat. 2. Send a message. 3. Verify bob and charlie receive it. 4. As bob, send a message. 5. Verify alice and charlie receive it. |
| **Backend** | `server/src/sockets/chat.socket.ts` — `send_message` |
| **Frontend** | `client/src/pages/ChatDashboard.tsx` |
| **Database** | Message |
| **WebSocket** | `send_message`, `message_received` |
| **Expected result** | Message broadcast to all group members. |
| **Status** | |

### 5.3 Add Members to Group

| Field | Value |
|-------|-------|
| **Expected behavior** | Owner/Admin can add members to a group. |
| **Steps to test** | 1. As alice (OWNER), open group details. 2. Add charlie to the group. 3. Verify charlie receives notification. 4. As bob (MEMBER), try to add someone — should fail. |
| **Backend** | `server/src/routes/chat.routes.ts` — POST `/api/chats/group/:id/members` |
| **Frontend** | `client/src/pages/ChatDashboard.tsx` |
| **Database** | ChatMember |
| **WebSocket** | `member_joined` |
| **Expected result** | New ChatMember row created. All members notified. Member role enforced. |
| **Status** | |

### 5.4 Remove Member from Group

| Field | Value |
|-------|-------|
| **Expected behavior** | Owner/Admin can remove members. Members can leave. |
| **Steps to test** | 1. As alice (OWNER), remove bob from the group. 2. Verify bob is removed and notified. 3. As charlie, leave the group. 4. Verify charlie is removed. |
| **Backend** | `server/src/routes/chat.routes.ts` — DELETE `/api/chats/group/:id/members/:userId` |
| **Frontend** | `client/src/pages/ChatDashboard.tsx` |
| **Database** | ChatMember (deleted) |
| **WebSocket** | `member_left` |
| **Expected result** | ChatMember row deleted. All members notified. |
| **Status** | |

### 5.5 Owner Cannot Leave Group

| Field | Value |
|-------|-------|
| **Expected behavior** | Owner cannot leave without transferring ownership first. |
| **Steps to test** | 1. As alice (OWNER), try to leave the group. |
| **Backend** | `server/src/routes/chat.routes.ts` — DELETE `/api/chats/group/:id/members/:userId` |
| **Frontend** | `client/src/pages/ChatDashboard.tsx` |
| **Database** | ChatMember |
| **WebSocket** | None |
| **Expected result** | Error: "OWNER cannot leave the group. Transfer ownership first or delete the group." |
| **Status** | |

### 5.6 Transfer Group Ownership

| Field | Value |
|-------|-------|
| **Expected behavior** | Owner can transfer ownership to another member. |
| **Steps to test** | 1. As alice (OWNER), transfer ownership to bob. 2. Verify alice becomes ADMIN. 3. Verify bob becomes OWNER. 4. Verify bob can now manage the group. |
| **Backend** | `server/src/routes/chat.routes.ts` — POST `/api/chats/group/:id/transfer-owner` |
| **Frontend** | `client/src/pages/ChatDashboard.tsx` |
| **Database** | ChatMember (roles updated) |
| **WebSocket** | `owner_transferred` |
| **Expected result** | Old owner → ADMIN. New owner → OWNER. All members notified. |
| **Status** | |

### 5.7 Update Group Metadata

| Field | Value |
|-------|-------|
| **Expected behavior** | Owner/Admin can update group name, description, and avatar. |
| **Steps to test** | 1. As alice (OWNER), update group name to "Renamed Group". 2. Verify all members see the update. 3. As bob (MEMBER), try to update — should fail. |
| **Backend** | `server/src/routes/chat.routes.ts` — PUT `/api/chats/group/:id` |
| **Frontend** | `client/src/pages/ChatDashboard.tsx` |
| **Database** | Chat (groupName, groupDescription, groupAvatarUrl) |
| **WebSocket** | `group_updated` |
| **Expected result** | Group metadata updated. All members notified. Permission enforced. |
| **Status** | |

### 5.8 Group Size Limit

| Field | Value |
|-------|-------|
| **Expected behavior** | Groups cannot exceed MAX_GROUP_MEMBERS (default 100). |
| **Steps to test** | 1. Create a group. 2. Try to add members beyond the limit. |
| **Backend** | `server/src/routes/chat.routes.ts` — POST `/api/chats/group`, POST `/api/chats/group/:id/members` |
| **Frontend** | `client/src/pages/ChatDashboard.tsx` |
| **Database** | ChatMember |
| **WebSocket** | None |
| **Expected result** | Error: "Group size exceeds maximum limit of 100 members." |
| **Status** | |

---

## 6. File Upload & Media

### 6.1 Upload Image

| Field | Value |
|-------|-------|
| **Expected behavior** | User can upload an image file (JPEG, PNG, GIF, WebP, BMP). |
| **Steps to test** | 1. Open a chat. 2. Click the paperclip icon. 3. Select a JPEG image under 25MB. 4. Click Send. 5. Verify the image renders inline in the chat. 6. Verify the other user sees it. |
| **Backend** | `server/src/routes/upload.routes.ts` — POST `/api/upload` |
| **Frontend** | `client/src/pages/ChatDashboard.tsx` — handleFileUpload |
| **Database** | Attachment |
| **WebSocket** | `send_message` (with attachments) |
| **Expected result** | File uploaded. URL returned. Attachment record created. Image displayed inline in both windows. |
| **Status** | |

### 6.2 Upload Document

| Field | Value |
|-------|-------|
| **Expected behavior** | User can upload a document (PDF, DOCX, XLSX, etc.). |
| **Steps to test** | 1. Open a chat. 2. Click the paperclip icon. 3. Select a PDF file under 100MB. 4. Send. 5. Verify a file link appears in the chat. |
| **Backend** | `server/src/routes/upload.routes.ts` |
| **Frontend** | `client/src/pages/ChatDashboard.tsx` |
| **Database** | Attachment |
| **WebSocket** | `send_message` |
| **Expected result** | File uploaded. Download link displayed in chat. |
| **Status** | |

### 6.3 Upload — File Type Rejection

| Field | Value |
|-------|-------|
| **Expected behavior** | Executables, HTML, JavaScript, SVGs are rejected. |
| **Steps to test** | 1. Try to upload a .exe file. 2. Try to upload an .html file. 3. Try to upload a .js file. 4. Try to upload a .svg file. |
| **Backend** | `server/src/routes/upload.routes.ts` — fileFilter, `server/src/utils/file_validator.ts` |
| **Frontend** | `client/src/pages/ChatDashboard.tsx` |
| **Database** | None |
| **WebSocket** | None |
| **Expected result** | All rejected with error: "Invalid file type. Executables, HTML, JavaScript, and SVGs are strictly prohibited." |
| **Status** | |

### 6.4 Upload — Magic Byte Validation

| Field | Value |
|-------|-------|
| **Expected behavior** | Server validates file content matches declared MIME type. |
| **Steps to test** | 1. Rename a .txt file to .jpg. 2. Try to upload it. 3. Verify rejection (magic bytes don't match JPEG). |
| **Backend** | `server/src/utils/file_validator.ts` — validateFileSignature |
| **Frontend** | `client/src/pages/ChatDashboard.tsx` |
| **Database** | None |
| **WebSocket** | None |
| **Expected result** | Error: "File signature verification failed." |
| **Status** | |

### 6.5 Upload — Size Limits

| Field | Value |
|-------|-------|
| **Expected behavior** | Files exceeding category-specific size limits are rejected. |
| **Steps to test** | 1. Try to upload an image over 25MB. 2. Try to upload a video over 500MB. |
| **Backend** | `server/src/routes/upload.routes.ts` — CATEGORY_LIMITS |
| **Frontend** | `client/src/pages/ChatDashboard.tsx` |
| **Database** | None |
| **WebSocket** | None |
| **Expected result** | Image: error about 25MB limit. Video: error about 500MB limit. |
| **Status** | |

### 6.6 Upload — Shared Attachments in Chat Details

| Field | Value |
|-------|-------|
| **Expected behavior** | Uploaded files appear in the chat info panel under "Shared Attachments". |
| **Steps to test** | 1. Send an image in a chat. 2. Open the chat details/info panel. 3. Verify the image appears in the attachments list. |
| **Backend** | `server/src/routes/chat.routes.ts` — GET `/api/chats/:chatId/messages` (includes attachments) |
| **Frontend** | `client/src/pages/ChatDashboard.tsx` — right sidebar |
| **Database** | Attachment, Message |
| **WebSocket** | None |
| **Expected result** | Attachment listed in info panel with filename and size. |
| **Status** | |

### 6.7 Static File Serving — Security Headers

| Field | Value |
|-------|-------|
| **Expected behavior** | Uploaded files are served with CSP sandbox and Content-Disposition headers. |
| **Steps to test** | 1. Upload a file. 2. Open the file URL directly in browser. 3. Check response headers for CSP and Content-Disposition. |
| **Backend** | `server/src/index.ts` — `/uploads` middleware |
| **Frontend** | None |
| **Database** | None |
| **WebSocket** | None |
| **Expected result** | CSP header: `default-src 'none'; sandbox;`. Content-Disposition: inline for images/audio/video, attachment for others. |
| **Status** | |

---

## 7. WebRTC Calling

### 7.1 Audio Call — Initiate and Accept

| Field | Value |
|-------|-------|
| **Expected behavior** | User can initiate an audio call, and the recipient can accept. |
| **Steps to test** | 1. Open alice and bob in separate windows. 2. As alice, open chat with bob. 3. Click the phone icon (voice call). 4. Verify bob sees incoming call overlay. 5. As bob, click Accept. 6. Verify both are connected and can hear audio. 7. Either party clicks End Call. |
| **Backend** | `server/src/sockets/chat.socket.ts` — `call_user`, `accept_call`, `end_call` |
| **Frontend** | `client/src/hooks/useWebRTCCall.ts` — startCall, acceptCall |
| **Database** | CallLog |
| **WebSocket** | `call_user`, `incoming_call`, `accept_call`, `call_accepted`, `ice_candidate`, `end_call`, `call_ended` |
| **Expected result** | CallLog created. WebRTC peer connection established. Audio streams flowing. CallLog updated on end. |
| **Status** | |

### 7.2 Video Call — Initiate and Accept

| Field | Value |
|-------|-------|
| **Expected behavior** | User can initiate a video call with camera. |
| **Steps to test** | 1. As alice, click the video icon on chat with bob. 2. Grant camera permission. 3. As bob, accept the call. 4. Verify both see local and remote video. 5. End the call. |
| **Backend** | `server/src/sockets/chat.socket.ts` — `call_user` with callType='video' |
| **Frontend** | `client/src/hooks/useWebRTCCall.ts` |
| **Database** | CallLog |
| **WebSocket** | `call_user`, `incoming_call`, `accept_call`, `call_accepted`, `ice_candidate` |
| **Expected result** | Video call established. Local/remote video elements display streams. |
| **Status** | |

### 7.3 Call — Reject

| Field | Value |
|-------|-------|
| **Expected behavior** | Recipient can reject an incoming call. |
| **Steps to test** | 1. As alice, call bob. 2. As bob, click Reject. 3. Verify alice sees "Call rejected" message. 4. Verify CallLog status is REJECTED. |
| **Backend** | `server/src/sockets/chat.socket.ts` — `reject_call` |
| **Frontend** | `client/src/hooks/useWebRTCCall.ts` — rejectCall |
| **Database** | CallLog (status=REJECTED) |
| **WebSocket** | `reject_call`, `call_rejected` |
| **Expected result** | CallLog updated. Both parties return to idle state. |
| **Status** | |

### 7.4 Call — Missed Call Notification

| Field | Value |
|-------|-------|
| **Expected behavior** | Unanswered calls are logged as missed and generate push notifications. |
| **Steps to test** | 1. As alice, call bob. 2. Don't answer. 3. Wait for timeout (30s) or alice hangs up. 4. Verify CallLog status is MISSED. 5. Verify bob receives a missed call notification. |
| **Backend** | `server/src/sockets/chat.socket.ts` — `end_call` with missed=true |
| **Frontend** | `client/src/hooks/useWebRTCCall.ts` |
| **Database** | CallLog (status=MISSED), Notification |
| **WebSocket** | `end_call`, `call_ended` |
| **Expected result** | CallLog marked as MISSED. Push notification sent to bob. |
| **Status** | |

### 7.5 Call — Mute/Unmute

| Field | Value |
|-------|-------|
| **Expected behavior** | User can mute/unmute their microphone during a call. |
| **Steps to test** | 1. Start an audio call. 2. Click the microphone icon to mute. 3. Verify the other party can no longer hear you. 4. Click again to unmute. |
| **Backend** | None (client-side only) |
| **Frontend** | `client/src/hooks/useWebRTCCall.ts` — toggleMute |
| **Database** | None |
| **WebSocket** | None |
| **Expected result** | Audio track enabled/disabled. Other party hears silence when muted. |
| **Status** | |

### 7.6 Call — Toggle Camera

| Field | Value |
|-------|-------|
| **Expected behavior** | User can enable/disable camera during a video call. |
| **Steps to test** | 1. Start a video call. 2. Click camera icon to disable. 3. Verify video stops (black screen or avatar). 4. Click again to re-enable. 5. Verify video resumes. |
| **Backend** | None (client-side only) |
| **Frontend** | `client/src/hooks/useWebRTCCall.ts` — toggleCamera |
| **Database** | None |
| **WebSocket** | None |
| **Expected result** | Video track stopped/restarted. Sender replaced on peer connection. |
| **Status** | |

### 7.7 Call — Switch to Audio-Only

| Field | Value |
|-------|-------|
| **Expected behavior** | Video call can be downgraded to audio-only. |
| **Steps to test** | 1. Start a video call. 2. Click "Switch to Audio" or let quality degrade. 3. Verify video is disabled on both sides. 4. Audio continues. |
| **Backend** | `server/src/sockets/chat.socket.ts` — `switch_to_audio` |
| **Frontend** | `client/src/hooks/useWebRTCCall.ts` — switchToAudioOnly |
| **Database** | None |
| **WebSocket** | `switch_to_audio`, `switched_to_audio` |
| **Expected result** | Video tracks stopped. Call continues as audio-only. Peer notified. |
| **Status** | |

### 7.8 Call — Speakerphone Toggle

| Field | Value |
|-------|-------|
| **Expected behavior** | User can toggle speakerphone during a call. |
| **Steps to test** | 1. Start an audio call on a device with speaker. 2. Click the speaker icon. 3. Verify audio routes to speaker. 4. Click again. 5. Verify audio routes back to earpiece. |
| **Backend** | None (client-side only, uses setSinkId API) |
| **Frontend** | `client/src/hooks/useWebRTCCall.ts` — toggleSpeakerphone |
| **Database** | None |
| **WebSocket** | None |
| **Expected result** | Audio output device switches between speaker and default. |
| **Status** | |

### 7.9 Call — Call Duration Timer

| Field | Value |
|-------|-------|
| **Expected behavior** | Call duration is displayed during active calls. |
| **Steps to test** | 1. Start a call. 2. Accept. 3. Verify a timer is displayed showing MM:SS format. 4. Wait 60 seconds. 5. Verify timer shows 01:00. |
| **Backend** | None (client-side only) |
| **Frontend** | `client/src/hooks/useWebRTCCall.ts` — callDuration, startCallTimer |
| **Database** | None |
| **WebSocket** | None |
| **Expected result** | Timer increments every second. Format: MM:SS. |
| **Status** | |

### 7.10 Call — Connection Quality Monitoring

| Field | Value |
|-------|-------|
| **Expected behavior** | Call quality is monitored and video quality adapts. |
| **Steps to test** | 1. Start a video call. 2. Monitor console logs for quality stats. 3. Simulate poor network (if possible). 4. Verify quality indicator changes. 5. Verify video resolution/framerate reduces. |
| **Backend** | None (client-side only, uses getStats()) |
| **Frontend** | `client/src/hooks/useWebRTCCall.ts` — startQualityMonitor |
| **Database** | None |
| **WebSocket** | None |
| **Expected result** | Quality tiers: good/fair/poor/very_poor. Video encoding adapts. Auto fallback to audio on very_poor. |
| **Status** | |

### 7.11 Call — ICE Restart

| Field | Value |
|-------|-------|
| **Expected behavior** | On connection failure, ICE restart is attempted up to 3 times. |
| **Steps to test** | 1. Start a call. 2. Simulate network disruption (if possible). 3. Monitor console for ICE restart attempts. |
| **Backend** | `server/src/sockets/chat.socket.ts` — `ice_restart`, `call_restarted` |
| **Frontend** | `client/src/hooks/useWebRTCCall.ts` — iceRestartAttemptsRef |
| **Database** | CallLog |
| **WebSocket** | `ice_restart`, `call_restarted` |
| **Expected result** | Up to 3 restart attempts. After 3 failures, call is torn down. |
| **Status** | |

### 7.12 Call — Call Log History

| Field | Value |
|-------|-------|
| **Expected behavior** | Call history is recorded and viewable. |
| **Steps to test** | 1. Make a few calls (completed, missed, rejected). 2. Open Call History. 3. Verify all calls appear with correct status, duration, and participants. |
| **Backend** | `server/src/routes/call.routes.ts` — GET `/api/calls/history` |
| **Frontend** | `client/src/pages/ChatDashboard.tsx` — fetchCallHistory |
| **Database** | CallLog |
| **WebSocket** | None |
| **Expected result** | Call history shows all calls with correct status (COMPLETED, MISSED, REJECTED, CANCELLED, FAILED), duration, and participant info. |
| **Status** | |

### 7.13 Call — Call Sounds

| Field | Value |
|-------|-------|
| **Expected behavior** | Ringtone plays for incoming calls, callertone for outgoing calls. |
| **Steps to test** | 1. As alice, call bob. 2. Verify alice hears the caller tone (outgoing). 3. Verify bob hears the ringtone (incoming). 4. Disable sound effects in settings. 5. Repeat — no sounds should play. |
| **Backend** | None (client-side only) |
| **Frontend** | `client/src/hooks/useWebRTCCall.ts` — playRingtone, playCallertone |
| **Database** | None |
| **WebSocket** | None |
| **Expected result** | Sounds play/stop correctly. Settings toggle works. |
| **Status** | |

### 7.14 Call — Auto-Reject When Already in Call

| Field | Value |
|-------|-------|
| **Expected behavior** | Incoming calls are auto-rejected if user is already in a call. |
| **Steps to test** | 1. As bob, start a call with charlie. 2. As alice, call bob while bob is on the call with charlie. 3. Verify bob auto-rejects alice's call. |
| **Backend** | `server/src/sockets/chat.socket.ts` — `incoming_call` handler |
| **Frontend** | `client/src/hooks/useWebRTCCall.ts` — onIncomingCall |
| **Database** | CallLog |
| **WebSocket** | `call_user`, `incoming_call`, `reject_call` |
| **Expected result** | Alice receives "call_rejected" immediately. Bob stays on existing call. |
| **Status** | |

### 7.15 Call — Call Timeout

| Field | Value |
|-------|-------|
| **Expected behavior** | Outgoing calls time out after 30 seconds if not answered. |
| **Steps to test** | 1. As alice, call bob. 2. Don't answer. 3. Wait 30 seconds. 4. Verify call ends automatically. |
| **Backend** | `server/src/sockets/chat.socket.ts` — `end_call` with missed=true |
| **Frontend** | `client/src/hooks/useWebRTCCall.ts` — callTimeoutRef |
| **Database** | CallLog (status=MISSED) |
| **WebSocket** | `end_call`, `call_ended` |
| **Expected result** | Call times out. CallLog marked as MISSED. Alert shown to caller. |
| **Status** | |

### 7.16 Call — Disconnect Cleanup

| Field | Value |
|-------|-------|
| **Expected behavior** | If a user disconnects during a call, the call is ended and logged. |
| **Steps to test** | 1. Start a call between alice and bob. 2. Close bob's browser tab. 3. Verify alice's call ends. 4. Verify CallLog is updated. |
| **Backend** | `server/src/sockets/chat.socket.ts` — disconnect handler |
| **Frontend** | `client/src/hooks/useWebRTCCall.ts` — cleanupCall |
| **Database** | CallLog |
| **WebSocket** | disconnect, `call_ended` |
| **Expected result** | CallLog updated with duration and status. Other party notified. |
| **Status** | |

### 7.17 Call — Block Enforcement

| Field | Value |
|-------|-------|
| **Expected behavior** | Blocked users cannot call each other. |
| **Steps to test** | 1. As alice, block bob. 2. As bob, try to call alice. 3. Verify call is rejected. |
| **Backend** | `server/src/sockets/chat.socket.ts` — block check in call_user |
| **Frontend** | `client/src/hooks/useWebRTCCall.ts` |
| **Database** | Block |
| **WebSocket** | `call_user` |
| **Expected result** | Socket emits `call_error` with "Blocked user. Action not permitted." |
| **Status** | |

### 7.18 Call — Privacy Enforcement (Who Can Call Me)

| Field | Value |
|-------|-------|
| **Expected behavior** | Privacy setting controls who can initiate calls. |
| **Steps to test** | 1. As bob, set whoCanCallMe to "NOONE". 2. As alice, try to call bob — should fail. 3. As bob, change to "FRIENDS". 4. As charlie (not a friend), try — should fail. 5. As alice (friend), try — should succeed. |
| **Backend** | `server/src/sockets/chat.socket.ts` — whoCanCallMe check |
| **Frontend** | `client/src/pages/ChatDashboard.tsx` — updatePreference |
| **Database** | NotificationPreference |
| **WebSocket** | `call_user` |
| **Expected result** | Calls blocked based on privacy setting. |
| **Status** | |

### 7.19 Call — ICE Config from Server

| Field | Value |
|-------|-------|
| **Expected behavior** | Client fetches STUN/TURN configuration from server. |
| **Steps to test** | 1. Log in. 2. Check network tab for GET `/api/chats/ice-config`. 3. Verify response contains iceServers array. |
| **Backend** | `server/src/routes/chat.routes.ts` — GET `/api/chats/ice-config` |
| **Frontend** | `client/src/hooks/useWebRTCCall.ts` — fetchIceConfig |
| **Database** | None |
| **WebSocket** | None |
| **Expected result** | Response includes STUN servers (default: Google). TURN servers if configured. turnConfigured boolean. |
| **Status** | |

### 7.20 Call — Call Rate Limiting

| Field | Value |
|-------|-------|
| **Expected behavior** | Call initiation is rate limited (3 per 30 seconds in production). |
| **Steps to test** | 1. In production mode, attempt 4 calls within 30 seconds. 2. Verify the 4th is rejected. |
| **Backend** | `server/src/sockets/chat.socket.ts` — checkRateLimit for call_user |
| **Frontend** | `client/src/hooks/useWebRTCCall.ts` |
| **Database** | None (in-memory) |
| **WebSocket** | `call_user` |
| **Expected result** | Socket emits `call_error` with "Abuse protection: Call rate limit exceeded." |
| **Status** | |

---

## 8. Push Notifications

### 8.1 Device Token Registration

| Field | Value |
|-------|-------|
| **Expected behavior** | Android app registers FCM token with server. |
| **Steps to test** | 1. Install and open the Android app. 2. Check server logs for token registration. 3. Query DeviceToken table. |
| **Backend** | `server/src/routes/auth.routes.ts` — POST `/api/auth/device-token` |
| **Frontend** | `client/src/pages/ChatDashboard.tsx` — registerPush |
| **Database** | DeviceToken |
| **WebSocket** | None |
| **Expected result** | DeviceToken row created with userId, token, deviceId, platform. |
| **Status** | |

### 8.2 Push Notification — Incoming Message

| Field | Value |
|-------|-------|
| **Expected behavior** | Offline user receives push notification for new messages. |
| **Steps to test** | 1. Log in on Android. 2. Background the app. 3. As another user, send a message. 4. Verify push notification is received. |
| **Backend** | `server/src/utils/notification.ts` — sendPush |
| **Frontend** | `client/src/pages/ChatDashboard.tsx` — pushNotificationActionPerformed |
| **Database** | Notification, DeviceToken |
| **WebSocket** | `notification_received` |
| **Expected result** | FCM notification delivered. Tapping it opens the chat. |
| **Status** | |

### 8.3 Push Notification — Incoming Call

| Field | Value |
|-------|-------|
| **Expected behavior** | User receives push notification for incoming calls. |
| **Steps to test** | 1. Log in on Android. 2. Background the app. 3. As another user, initiate a call. 4. Verify push notification is received. |
| **Backend** | `server/src/sockets/chat.socket.ts` — call_user handler |
| **Frontend** | `client/src/pages/ChatDashboard.tsx` |
| **Database** | Notification |
| **WebSocket** | `incoming_call` |
| **Expected result** | Push notification with "Incoming Call" title. |
| **Status** | |

### 8.4 Push Notification — Missed Call

| Field | Value |
|-------|-------|
| **Expected behavior** | Missed call generates a push notification. |
| **Steps to test** | 1. As alice, call bob (who is on Android, backgrounded). 2. Don't answer. 3. Hang up. 4. Verify bob receives "Missed Call" notification. |
| **Backend** | `server/src/sockets/chat.socket.ts` — end_call with missed=true |
| **Frontend** | `client/src/pages/ChatDashboard.tsx` |
| **Database** | Notification |
| **WebSocket** | `end_call` |
| **Expected result** | Missed call notification delivered via FCM. |
| **Status** | |

### 8.5 Push Notification — Friend Request

| Field | Value |
|-------|-------|
| **Expected behavior** | Friend requests generate push notifications. |
| **Steps to test** | 1. As charlie (on Android), background the app. 2. As alice, send friend request to charlie. 3. Verify push notification. |
| **Backend** | `server/src/routes/friend.routes.ts` — POST `/api/friends/request` |
| **Frontend** | `client/src/pages/ChatDashboard.tsx` |
| **Database** | Notification |
| **WebSocket** | `friend_request_received` |
| **Expected result** | Push notification with "New Friend Request" title. |
| **Status** | |

### 8.6 Notification Preferences — Disable Messages

| Field | Value |
|-------|-------|
| **Expected behavior** | User can disable message push notifications. |
| **Steps to test** | 1. As bob, disable message notifications in settings. 2. As alice, send a message to bob. 3. Verify bob does NOT receive a push notification. 4. Verify bob still receives the message when they open the app (socket delivery). |
| **Backend** | `server/src/utils/notification.ts` — preference check |
| **Frontend** | `client/src/pages/ChatDashboard.tsx` — updatePreference |
| **Database** | NotificationPreference (messages=false) |
| **WebSocket** | `message_received` (still works) |
| **Expected result** | Push skipped. In-app delivery unaffected. |
| **Status** | |

### 8.7 Notification Preferences — Disable Calls

| Field | Value |
|-------|-------|
| **Expected behavior** | User can disable call push notifications. |
| **Steps to test** | 1. As bob, disable call notifications. 2. As alice, call bob. 3. Verify bob does NOT receive a push notification. |
| **Backend** | `server/src/utils/notification.ts` |
| **Frontend** | `client/src/pages/ChatDashboard.tsx` |
| **Database** | NotificationPreference (calls=false) |
| **WebSocket** | `incoming_call` (still works) |
| **Expected result** | Push skipped. In-app call UI unaffected. |
| **Status** | |

### 8.8 Notification Preferences — Who Can See Profile Photo

| Field | Value |
|-------|-------|
| **Expected behavior** | Privacy setting controls profile photo visibility. |
| **Steps to test** | 1. As bob, set whoCanSeeProfilePhoto to "NOONE". 2. As alice, search for bob. 3. Verify avatar is null. 4. Set to "FRIENDS". 5. As charlie (not a friend), verify avatar is null. 6. As alice (friend), verify avatar is visible. |
| **Backend** | `server/src/utils/privacy.ts` — sanitizeProfileForUser |
| **Frontend** | `client/src/pages/ChatDashboard.tsx` |
| **Database** | NotificationPreference, Friendship |
| **WebSocket** | None |
| **Expected result** | Avatar visibility matches privacy setting. |
| **Status** | |

### 8.9 Notification Preferences — Who Can See Last Seen

| Field | Value |
|-------|-------|
| **Expected behavior** | Privacy setting controls last seen visibility. |
| **Steps to test** | 1. As bob, set whoCanSeeLastSeen to "NOONE". 2. As alice, view bob's profile. 3. Verify lastSeen is hidden (set to epoch). 4. As a friend, verify lastSeen is visible (if set to FRIENDS). |
| **Backend** | `server/src/utils/privacy.ts` |
| **Frontend** | `client/src/pages/ChatDashboard.tsx` |
| **Database** | NotificationPreference |
| **WebSocket** | None |
| **Expected result** | Last seen hidden based on privacy setting. |
| **Status** | |

### 8.10 Notification Center — List

| Field | Value |
|-------|-------|
| **Expected behavior** | User can view paginated notifications. |
| **Steps to test** | 1. Trigger several notifications (friend requests, messages). 2. Open notification center. 3. Verify notifications appear in reverse chronological order. 4. Scroll to load more. |
| **Backend** | `server/src/routes/notification.routes.ts` — GET `/api/notifications` |
| **Frontend** | `client/src/pages/ChatDashboard.tsx` — fetchNotifications |
| **Database** | Notification |
| **WebSocket** | `notification_received` |
| **Expected result** | Notifications listed with pagination. MESSAGE type excluded. |
| **Status** | |

### 8.11 Notification Center — Mark Read

| Field | Value |
|-------|-------|
| **Expected behavior** | User can mark notifications as read. |
| **Steps to test** | 1. Have unread notifications. 2. Click on one notification. 3. Verify it's marked as read. 4. Click "Mark all as read". 5. Verify all are marked as read. |
| **Backend** | `server/src/routes/notification.routes.ts` — PUT `/api/notifications/:id/read`, PUT `/api/notifications/read-all` |
| **Frontend** | `client/src/pages/ChatDashboard.tsx` — markNotificationRead, markAllNotificationsRead |
| **Database** | Notification (isRead) |
| **WebSocket** | None |
| **Expected result** | Notification isRead updated. Unread count decremented. |
| **Status** | |

### 8.12 Notification Sound

| Field | Value |
|-------|-------|
| **Expected behavior** | Notification sound plays for incoming messages when enabled. |
| **Steps to test** | 1. Enable sound effects in settings. 2. Receive a message. 3. Verify messagetone.mp3 plays. 4. Disable sound effects. 5. Receive another message. 6. Verify no sound plays. |
| **Backend** | None (client-side only) |
| **Frontend** | `client/src/hooks/useWebRTCCall.ts` — playNotificationSound |
| **Database** | None |
| **WebSocket** | `message_received` |
| **Expected result** | Sound plays/doesn't play based on settings. |
| **Status** | |

---

## 9. Privacy & Security

### 9.1 Rate Limiting — Auth

| Field | Value |
|-------|-------|
| **Expected behavior** | Auth endpoints are rate limited. |
| **Steps to test** | 1. Make 16 login attempts within 15 minutes. 2. Verify the 16th is rejected. 3. Make 6 registration attempts within 1 hour. 4. Verify the 6th is rejected. |
| **Backend** | `server/src/index.ts` — loginLimiter, registerLimiter |
| **Frontend** | `client/src/pages/Login.tsx` |
| **Database** | None |
| **WebSocket** | None |
| **Expected result** | 429 Too Many Requests after exceeding limits. |
| **Status** | |

### 9.2 Rate Limiting — Upload

| Field | Value |
|-------|-------|
| **Expected behavior** | File uploads are rate limited (10 per 10 minutes). |
| **Steps to test** | 1. Upload 10 files within 10 minutes. 2. Try an 11th. |
| **Backend** | `server/src/index.ts` — uploadLimiter |
| **Frontend** | `client/src/pages/ChatDashboard.tsx` |
| **Database** | None |
| **WebSocket** | None |
| **Expected result** | 429 after 10 uploads. |
| **Status** | |

### 9.3 Rate Limiting — Message Spam

| Field | Value |
|-------|-------|
| **Expected behavior** | Socket message sending is rate limited (10 per 5 seconds). |
| **Steps to test** | 1. Rapidly send 11 messages within 5 seconds. 2. Verify the 11th is rejected with a spam error. |
| **Backend** | `server/src/sockets/chat.socket.ts` — checkRateLimit for send_message |
| **Frontend** | `client/src/pages/ChatDashboard.tsx` |
| **Database** | None (in-memory) |
| **WebSocket** | `send_message` |
| **Expected result** | Socket emits `message_error` with "Spam protection: Message rate limit exceeded." |
| **Status** | |

### 9.4 CORS — Blocked Origin

| Field | Value |
|-------|-------|
| **Expected behavior** | Requests from non-whitelisted origins are rejected. |
| **Steps to test** | 1. Make a request from a non-whitelisted origin (e.g., `http://evil.com`). 2. Verify CORS error. |
| **Backend** | `server/src/index.ts` — CORS middleware |
| **Frontend** | N/A |
| **Database** | None |
| **WebSocket** | None |
| **Expected result** | Request blocked with CORS error. |
| **Status** | |

### 9.5 Helmet Security Headers

| Field | Value |
|-------|-------|
| **Expected behavior** | Security headers are set by Helmet middleware. |
| **Steps to test** | 1. Make a request to the API. 2. Check response headers. 3. Verify X-Content-Type-Options, Referrer-Policy, CSP headers. |
| **Backend** | `server/src/index.ts` — helmet middleware |
| **Frontend** | N/A |
| **Database** | None |
| **WebSocket** | None |
| **Expected result** | Headers present: X-Content-Type-Options: nosniff, Referrer-Policy: strict-origin-when-cross-origin, CSP directives. |
| **Status** | |

### 9.6 Account Enumeration Prevention

| Field | Value |
|-------|-------|
| **Expected behavior** | Forgot password returns same response for existing and non-existing emails. |
| **Steps to test** | 1. POST forgot-password with `alice@example.com`. 2. Note response time. 3. POST with `nonexistent@example.com`. 4. Verify same response and similar timing. |
| **Backend** | `server/src/routes/auth.routes.ts` — POST `/api/auth/forgot-password` |
| **Frontend** | `client/src/pages/Login.tsx` |
| **Database** | User |
| **WebSocket** | None |
| **Expected result** | Both return: "If an account with that email exists, a password reset link has been sent." |
| **Status** | |

### 9.7 Timing Attack Prevention

| Field | Value |
|-------|-------|
| **Expected behavior** | Login with non-existent user takes similar time as login with wrong password. |
| **Steps to test** | 1. Time login attempt with existing user + wrong password. 2. Time login attempt with non-existent user. 3. Verify similar timing (dummy bcrypt comparison). |
| **Backend** | `server/src/routes/auth.routes.ts` — POST `/api/auth/login` |
| **Frontend** | `client/src/pages/Login.tsx` |
| **Database** | User |
| **WebSocket** | None |
| **Expected result** | Both paths execute bcrypt.compare, resulting in similar response times. |
| **Status** | |

### 9.8 Debug Endpoints — No Auth

| Field | Value |
|-------|-------|
| **Expected behavior** | Debug endpoints are accessible without authentication (known issue). |
| **Steps to test** | 1. POST to `/api/debug/mobile-write-test` without auth header. 2. Verify 200 response with created record. |
| **Backend** | `server/src/index.ts` — debug routes |
| **Frontend** | N/A |
| **Database** | Chat |
| **WebSocket** | None |
| **Expected result** | Record created without authentication (SECURITY ISSUE). |
| **Status** | |

---

## 10. Observability

### 10.1 Health Check

| Field | Value |
|-------|-------|
| **Expected behavior** | Health endpoint returns system and database status. |
| **Steps to test** | 1. GET `/api/observability/health`. 2. Verify response includes status, uptime, memory, database status. |
| **Backend** | `server/src/routes/observability.routes.ts` — GET `/api/observability/health` |
| **Frontend** | N/A |
| **Database** | None (tests connection) |
| **WebSocket** | None |
| **Expected result** | Status: UP. Database: UP. Uptime and memory stats included. |
| **Status** | |

### 10.2 Metrics

| Field | Value |
|-------|-------|
| **Expected behavior** | Metrics endpoint returns aggregate counts. |
| **Steps to test** | 1. GET `/api/observability/metrics` with auth token. 2. Verify response includes user count, message count, chat count. |
| **Backend** | `server/src/routes/observability.routes.ts` — GET `/api/observability/metrics` |
| **Frontend** | N/A |
| **Database** | User, Message, Chat, Notification |
| **WebSocket** | None |
| **Expected result** | Counts returned for users, messages, chats (direct + group), notifications by status. |
| **Status** | |

### 10.3 Correlation Tracing

| Field | Value |
|-------|-------|
| **Expected behavior** | Each request gets a correlation ID logged. |
| **Steps to test** | 1. Make an API request. 2. Check server logs. 3. Verify correlation ID appears in log entries. |
| **Backend** | `server/src/middleware/correlation.middleware.ts`, `server/src/utils/logger.ts` |
| **Frontend** | N/A |
| **Database** | None |
| **WebSocket** | None |
| **Expected result** | Log entries include `[CID:<uuid>]` prefix. |
| **Status** | |

---

## 11. Platform

### 11.1 Responsive Layout — Desktop (>1024px)

| Field | Value |
|-------|-------|
| **Expected behavior** | Desktop layout shows sidebar, chat area, and optional details panel. |
| **Steps to test** | 1. Open browser at >1024px width. 2. Verify sidebar with chat list. 3. Select a chat. 4. Verify chat area with messages. 5. Toggle info panel. |
| **Backend** | N/A |
| **Frontend** | `client/src/pages/ChatDashboard.tsx` — desktop layout |
| **Database** | None |
| **WebSocket** | None |
| **Expected result** | Three-panel layout renders correctly. |
| **Status** | |

### 11.2 Responsive Layout — Tablet (768–1024px)

| Field | Value |
|-------|-------|
| **Expected behavior** | Tablet layout shows sidebar + conversation with collapsible details. |
| **Steps to test** | 1. Open browser at 768–1024px width. 2. Verify sidebar. 3. Select a chat. 4. Verify conversation area. 5. Toggle info panel. |
| **Backend** | N/A |
| **Frontend** | `client/src/pages/TabletDashboard.tsx` |
| **Database** | None |
| **WebSocket** | None |
| **Expected result** | Split layout with 320px sidebar and flexible content area. |
| **Status** | |

### 11.3 Responsive Layout — Mobile (<768px)

| Field | Value |
|-------|-------|
| **Expected behavior** | Mobile layout shows tab navigation with fullscreen conversation. |
| **Steps to test** | 1. Open browser at <768px width. 2. Verify bottom tab navigation (Chats, Friends, Calls, Settings). 3. Select a chat. 4. Verify fullscreen conversation. 5. Press back. 6. Verify return to chat list. |
| **Backend** | N/A |
| **Frontend** | `client/src/pages/MobileDashboard.tsx` |
| **Database** | None |
| **WebSocket** | None |
| **Expected result** | Tab navigation works. Conversation is fullscreen. Back returns to list. |
| **Status** | |

### 11.4 PWA — Service Worker

| Field | Value |
|-------|-------|
| **Expected behavior** | Service worker caches static assets for offline access. |
| **Steps to test** | 1. Open the app. 2. Check DevTools > Application > Service Workers. 3. Verify SW is registered. 4. Go offline. 5. Refresh the page. 6. Verify cached assets load. |
| **Backend** | N/A |
| **Frontend** | `client/public/sw.js`, `client/src/main.tsx` |
| **Database** | None |
| **WebSocket** | None |
| **Expected result** | SW registered. Static assets cached. Offline page loads from cache. |
| **Status** | |

### 11.5 PWA — Manifest

| Field | Value |
|-------|-------|
| **Expected behavior** | App is installable as a PWA. |
| **Steps to test** | 1. Open the app in Chrome. 2. Click install prompt or menu > Install app. 3. Verify app installs. 4. Open installed app. 5. Verify standalone mode. |
| **Backend** | N/A |
| **Frontend** | `client/public/manifest.json` |
| **Database** | None |
| **WebSocket** | None |
| **Expected result** | App installs. Opens in standalone window with dark theme. |
| **Status** | |

### 11.6 Android — Back Button

| Field | Value |
|-------|-------|
| **Expected behavior** | Android back button navigates through app hierarchy. |
| **Steps to test** | 1. Open Android app. 2. Open a chat. 3. Press back. 4. Verify return to chat list. 5. Press back again. 6. Verify exit confirmation. |
| **Backend** | N/A |
| **Frontend** | `client/src/pages/ChatDashboard.tsx` — backButton listener |
| **Database** | None |
| **WebSocket** | None |
| **Expected result** | Back navigates: conversation → chat list → exit confirmation → app exit. |
| **Status** | |

### 11.7 Android — Push Notification Channels

| Field | Value |
|-------|-------|
| **Expected behavior** | Android notification channels are configured for messages and calls. |
| **Steps to test** | 1. Install Android app. 2. Go to Android Settings > Apps > Velvet Chat > Notifications. 3. Verify "Messages" and "Calls" channels exist. |
| **Backend** | N/A |
| **Frontend** | `client/src/pages/ChatDashboard.tsx` — createChannel |
| **Database** | None |
| **WebSocket** | None |
| **Expected result** | Two channels: Messages (high importance), Calls (max importance). |
| **Status** | |

### 11.8 Android — Deep Link Handling

| Field | Value |
|-------|-------|
| **Expected behavior** | Deep links open the correct screen in the app. |
| **Steps to test** | 1. Open `velvet-chat.com/user/VC-XXXXXXXX` on Android. 2. Verify the app opens to the QR/profile screen. 3. Verify the profile is displayed. |
| **Backend** | N/A |
| **Frontend** | `client/src/pages/ChatDashboard.tsx` — appUrlOpen listener |
| **Database** | None |
| **WebSocket** | None |
| **Expected result** | App opens, navigates to QR screen, profile fetched and displayed. |
| **Status** | |

---

## 12. Group Chat Details

### 12.1 Shared Attachments in Group

| Field | Value |
|-------|-------|
| **Expected behavior** | All attachments sent in a group are listed in the group info panel. |
| **Steps to test** | 1. Send an image in a group chat. 2. Open group details. 3. Verify attachment appears in the list. |
| **Backend** | `server/src/routes/chat.routes.ts` — messages include attachments |
| **Frontend** | `client/src/pages/ChatDashboard.tsx` — right sidebar |
| **Database** | Attachment, Message |
| **WebSocket** | None |
| **Expected result** | Attachment listed with filename, size, and preview. |
| **Status** | |

### 12.2 Group Member List

| Field | Value |
|-------|-------|
| **Expected behavior** | Group info panel shows all members with roles. |
| **Steps to test** | 1. Open a group chat. 2. Open group details. 3. Verify all members listed with correct roles (OWNER, ADMIN, MEMBER). |
| **Backend** | `server/src/routes/chat.routes.ts` — chat includes members |
| **Frontend** | `client/src/pages/ChatDashboard.tsx` |
| **Database** | ChatMember |
| **WebSocket** | None |
| **Expected result** | All members displayed with correct role labels. |
| **Status** | |

---

## 13. Offline & Reconnect

### 13.1 Offline Message Queue

| Field | Value |
|-------|-------|
| **Expected behavior** | Messages sent while offline are queued and sent on reconnect. |
| **Steps to test** | 1. Open alice and bob. 2. Disconnect alice's network. 3. As alice, type a message and send. 4. Verify message shows with "pending" indicator. 5. Reconnect alice. 6. Verify message is sent and delivered to bob. |
| **Backend** | `server/src/sockets/chat.socket.ts` — send_message |
| **Frontend** | `client/src/pages/ChatDashboard.tsx` — offlineQueue state |
| **Database** | Message |
| **WebSocket** | `send_message` |
| **Expected result** | Message queued in localStorage. Sent on reconnect. Delivered to bob. |
| **Status** | |

### 13.2 Socket Reconnection

| Field | Value |
|-------|-------|
| **Expected behavior** | Socket automatically reconnects after disconnection. |
| **Steps to test** | 1. Stop the server. 2. Wait a few seconds. 3. Restart the server. 4. Verify socket reconnects automatically. 5. Verify chat functionality resumes. |
| **Backend** | `server/src/sockets/chat.socket.ts` |
| **Frontend** | `client/src/context/SocketContext.tsx` — reconnection config |
| **Database** | None |
| **WebSocket** | connect/disconnect |
| **Expected result** | Socket reconnects within a few seconds. Reconnection attempts: up to 10 with 1s delay. |
| **Status** | |

### 13.3 Session Restoration

| Field | Value |
|-------|-------|
| **Expected behavior** | User session is restored after page refresh. |
| **Steps to test** | 1. Log in as alice. 2. Refresh the page. 3. Verify alice is still logged in. 4. Verify chat list loads. |
| **Backend** | `server/src/routes/auth.routes.ts` — POST `/api/auth/refresh` |
| **Frontend** | `client/src/context/AuthContext.tsx` — initializeAuth |
| **Database** | Session |
| **WebSocket** | None |
| **Expected result** | Token refresh succeeds via cookie. User profile fetched. App restores to previous state. |
| **Status** | |

### 13.4 Multi-Tab Sync

| Field | Value |
|-------|-------|
| **Expected behavior** | Auth state syncs across browser tabs. |
| **Steps to test** | 1. Log in as alice in Tab 1. 2. Open Tab 2 to the same URL. 3. Verify Tab 2 also shows alice logged in. 4. Log out in Tab 1. 5. Verify Tab 2 also logs out. |
| **Backend** | N/A |
| **Frontend** | `client/src/context/AuthContext.tsx` — StorageEvent listener |
| **Database** | None |
| **WebSocket** | None |
| **Expected result** | Auth state synchronized via localStorage events. |
| **Status** | |

---

## 14. Server Configuration

### 14.1 Custom Backend URL

| Field | Value |
|-------|-------|
| **Expected behavior** | User can configure a custom backend URL via hidden settings. |
| **Steps to test** | 1. On login page, click the settings gear icon 7 times quickly. 2. Verify server config modal appears. 3. Enter a custom backend URL. 4. Save. 5. Verify API calls use the new URL. |
| **Backend** | N/A |
| **Frontend** | `client/src/pages/Login.tsx` — handleGearClick, handleSaveServerUrl |
| **Database** | None |
| **WebSocket** | None |
| **Expected result** | Custom URL stored in localStorage. API calls redirect to new URL. |
| **Status** | |

### 14.2 Docker Compose — Full Stack

| Field | Value |
|-------|-------|
| **Expected behavior** | `docker-compose up --build` starts all services. |
| **Steps to test** | 1. Run `docker-compose up --build`. 2. Wait for all services to start. 3. Open `http://localhost`. 4. Verify the app loads. 5. Test login. |
| **Backend** | `docker-compose.yml`, `server/Dockerfile` |
| **Frontend** | `client/Dockerfile`, `client/nginx.conf` |
| **Database** | SQLite (in container) |
| **WebSocket** | N/A |
| **Expected result** | All services start. Frontend accessible on port 80. Backend on port 5000. |
| **Status** | |

### 14.3 Nginx — Reverse Proxy

| Field | Value |
|-------|-------|
| **Expected behavior** | Nginx proxies /api, /socket.io, /uploads to the backend. |
| **Steps to test** | 1. Access `http://localhost/api/observability/health`. 2. Verify response from backend. 3. Open a WebSocket connection to `http://localhost/socket.io`. 4. Verify connection succeeds. |
| **Backend** | `client/nginx.conf` |
| **Frontend** | `client/nginx.conf` |
| **Database** | None |
| **WebSocket** | `/socket.io` proxy |
| **Expected result** | All routes proxied correctly. WebSocket upgrade works. |
| **Status** | |

---

## Summary

| Category | Features Tested | Pass | Fail | Not Tested |
|----------|----------------|------|------|------------|
| Authentication | 13 | | | |
| User Profile | 6 | | | |
| Friend System | 15 | | | |
| Direct Messaging | 15 | | | |
| Group Messaging | 8 | | | |
| File Upload | 7 | | | |
| WebRTC Calling | 20 | | | |
| Push Notifications | 12 | | | |
| Privacy & Security | 8 | | | |
| Observability | 3 | | | |
| Platform | 8 | | | |
| Group Chat Details | 2 | | | |
| Offline & Reconnect | 4 | | | |
| Server Configuration | 3 | | | |
| **Total** | **124** | | | |
