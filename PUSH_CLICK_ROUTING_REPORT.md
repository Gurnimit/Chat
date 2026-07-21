# Push Click Routing Report — Velvet Chat

This report verifies that tapping a system push notification routes the user to the correct view or screen within the Velvet Chat client application.

---

## 1. Intent Action Event Listeners

Tapping a system tray push notification triggers the Capacitor `@capacitor/push-notifications` listener `pushNotificationActionPerformed` in [ChatDashboard.tsx](file:///c:/Users/karan/Desktop/chat-app/client/src/pages/ChatDashboard.tsx#L558-L579).

---

## 2. Notification Data Payload to UI Mappings

The following routing targets have been verified in the frontend codebase:

| Event Type | Push Data Payload | Destination / UI Transition | Code Verification Status |
| :--- | :--- | :--- | :--- |
| **Incoming Message** | `{ type: 'message', chatId: '...' }` | Fetches recent chats, matches the `chatId`, and selects/opens the corresponding conversation panel. | **VERIFIED** |
| **Friend Request** | `{ type: 'friend_request', requestId: '...' }` | Opens the Friendship Management overlay panel and switches focus to the Pending tab. | **VERIFIED** |
| **Friend Acceptance** | `{ type: 'friend_accept', friendId: '...' }` | Opens the Friendship Management overlay panel and switches focus to the Friends list. | **VERIFIED** |
| **Group Invitation** | `{ type: 'group_invite', chatId: '...' }` | Fetches updated group rosters, matches the `chatId`, and launches the group chat view. | **VERIFIED** |
| **Incoming Call** | `{ type: 'call', callType: '...', callerId: '...' }` | Triggers custom call modals and transitions to the active calling screen immediately. | **VERIFIED** |
| **Missed Call** | `{ type: 'missed_call', callerId: '...' }` | Navigates back to the dashboard conversation list to check the missed call logs. | **VERIFIED** |

---

## 3. Verdict

**Final Verdict:**
`CODE_VERIFIED_BUT_REAL_DEVICE_NOT_TESTED`
