# Device Token Verification Report — Velvet Chat

This report documents the validation of the device token registration lifecycles, duplicate association checks, and invalid token garbage collection routines within the SQLite database.

---

## 1. Token Registration Lifecycle & Duplicate Prevention

When a client app (native Capacitor WebView) registers for push notifications:
1. It requests permissions and obtains a registration token.
2. It hits the `POST /api/auth/device-token` endpoint on the server.
3. The server invokes `NotificationService.registerToken()`, which operates under these database lifecycle constraints:
   - **Unique Association Guard**: Cleans up any prior device-token mapping for the token if associated with a different user/device.
   - **Upsert Execution**: Uses `prisma.deviceToken.upsert` targeted by the compound unique constraint `@@unique([userId, deviceId])`.
     - *If user and device already exist*: Updates the token and updates the `lastSeenAt` field to `new Date()`.
     - *If user/device is new*: Inserts a new record, registering the `userId`, `deviceId`, `token`, and `platform`.
   - **Stale Token Eviction**: The `NotificationService.cleanStaleTokens()` routine deletes device tokens that have not been seen for over 30 days.

---

## 2. Token Invalidation Cleanup (Real FCM Error Intercept)

If Google's FCM servers reject a token (due to uninstalling the app, token expiration, or token corruption), they return one of the following errors:
- `messaging/invalid-registration-token`
- `messaging/registration-token-not-registered`

The backend `FCMProvider.send()` method catches these errors and executes:
```typescript
prisma.deviceToken.delete({
  where: { token: payload.token }
});
```
This instantly evicts the invalid token from the database, preventing redundant delivery attempts.

---

## 3. Database State Audits (Verification Runs)

During the real FCM connection handshake test execution:
1. **Token Insertion Check**: A test token (`dUmMy-fCm-ToKeN-1234567890-aBcDeFgHiJkLmNoPqRsTuVwXyZ`) was registered.
   - *Result*: Successfully stored in SQLite as a `DeviceToken` row associated with the test user ID.
2. **Duplicate Prevention Check**: A second registration call with the same token updates the record rather than creating a duplicate constraint violation.
   - *Result*: Success. Compound index constraint `userId_deviceId` prevented duplicate entries.
3. **Invalid Token Cleanup Check**: Google FCM returned the invalid token error code `The registration token is not a valid FCM registration token`.
   - *Result*: The token cleanup handler triggered, deleting the row. A subsequent DB query returned `Token still exists in database: false`.

---

## 4. Verdict

**Final Verdict:**
`CODE_VERIFIED_BUT_REAL_DEVICE_NOT_TESTED`
