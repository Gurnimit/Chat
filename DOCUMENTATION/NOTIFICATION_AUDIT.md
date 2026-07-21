# NOTIFICATION_AUDIT.md

## Notification System Components

### 1. Push Notifications (FCM)
| Component | Status | Notes |
|-----------|--------|-------|
| Firebase Admin SDK | Installed | `firebase-admin` ^13.10.0 |
| Service Account | Configured | `FIREBASE_SERVICE_ACCOUNT_PATH` env var |
| FCM Provider | Implemented | `server/src/utils/notification.ts` — FCMProvider class |
| Mock Provider | Implemented | FCMProvider falls back to MockProvider when no credentials |
| Token Registration | Implemented | `POST /api/auth/device-token` |
| Token Storage | Implemented | `DeviceToken` table with userId, token, deviceId, platform |
| Token Cleanup | Implemented | Stale tokens (>30 days) cleaned on registration |
| Push Delivery | Implemented | `NotificationService.sendPush()` sends via FCM |
| Delivery Tracking | Implemented | Notification record updated with status (queued→sent/failed) |

### 2. Foreground Notifications (In-App)
| Component | Status | Notes |
|-----------|--------|-------|
| Real-time Socket | Implemented | `notification_received` event via Socket.IO |
| Notification Center | Implemented | Paginated list with read/unread tracking |
| Badge Count | Implemented | Unread count fetched every 30 seconds |
| Sound Effects | Implemented | `messagetone.mp3` plays on notification receive |

### 3. Background Notifications
| Component | Status | Notes |
|-----------|--------|-------|
| FCM Background | Implemented | FCM delivers when app is backgrounded |
| Notification Channels | Implemented | "messages" (high), "calls" (max importance) |

### 4. Android Notifications
| Component | Status | Notes |
|-----------|--------|-------|
| Capacitor Push Plugin | Installed | `@capacitor/push-notifications` ^8.1.1 |
| Permission Request | Implemented | Requested on app launch |
| Channel Creation | Implemented | Messages + Calls channels created |
| Token Registration | Implemented | Token sent to server on registration |
| Tap Handling | Implemented | Routes to correct screen based on notification type |

### 5. Notification Types
| Type | Trigger | Push | In-App | Sound |
|------|---------|------|--------|-------|
| MESSAGE | New message in chat | Yes | Yes | Yes |
| FRIEND_REQUEST | Friend request sent | Yes | Yes | Yes |
| FRIEND_ACCEPTED | Friend request accepted | Yes | Yes | Yes |
| GROUP_INVITE | Added to group | Yes | Yes | Yes |
| CALL | Incoming call | Yes | Yes | Ringtone |
| MISSED_CALL | Call not answered | Yes | Yes | No |
| MENTION | @mention in group | Yes | Yes | Yes |

### 6. Notification Preferences
| Setting | Default | Controls |
|---------|---------|----------|
| messages | true | Message push notifications |
| calls | true | Call push notifications |
| friendRequests | true | Friend request push notifications |
| groupNotifications | true | Group invitation push notifications |
| soundEffects | true | All sound effects |
| whoCanSendFriendRequests | EVERYONE | Privacy: who can send friend requests |
| whoCanCallMe | EVERYONE | Privacy: who can initiate calls |
| whoCanSeeProfilePhoto | EVERYONE | Privacy: profile photo visibility |
| whoCanSeeLastSeen | EVERYYONE | Privacy: last seen visibility |

### 7. Multiple Device Support
| Feature | Status | Notes |
|---------|--------|-------|
| Multiple tokens per user | Supported | DeviceToken table allows multiple entries per userId |
| Token per device | Supported | Unique constraint on (userId, deviceId) |
| Push to all devices | Supported | NotificationService iterates all tokens for user |
| Token cleanup | Supported | Stale tokens cleaned, invalid tokens auto-removed |

## Known Limitations
1. **No email delivery** — Verification/reset links only logged to console
2. **No Web Push** — Only FCM for Android; no web push notifications
3. **No notification grouping** — Notifications are listed individually
4. **No notification actions** — No reply/mark-read from notification shade
5. **No badge count on web** — Badge count only works on Android via Capacitor

## Notification Flow Diagram
```
Event occurs (message, friend request, call, etc.)
    ↓
NotificationService.sendPush(userId, title, body, data)
    ↓
Check user's notification preferences
    ↓ (if allowed)
Create Notification record (status: "queued")
    ↓
Emit socket notification (real-time)
    ↓
Fetch all DeviceTokens for user
    ↓ (for each token)
FCMProvider.send(token, title, body, data)
    ↓
Update Notification record (status: "sent" or "failed")
    ↓
Clean up invalid tokens (auto-remove on FCM error)
```
