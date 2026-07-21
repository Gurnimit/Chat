# EXECUTION_PLAN.md

## Guiding Principles

1. **Security before features** — Remove exposed vulnerabilities before adding anything new.
2. **Stability before optimization** — Prevent crashes and data loss before tuning performance.
3. **Safety net before refactoring** — Add tests before decomposing components.
4. **Backend before frontend** — Fix server-side issues first since they affect all clients.
5. **Incremental delivery** — Each phase produces a deployable improvement.

---

## Phase 1 — Critical Security Fixes

### Objective
Remove active security vulnerabilities that could be exploited in production today.

### Why Before Next Phase
These are open doors. Any user can bypass rate limits, access debug endpoints, or crash the app. No other work is safe until these are closed.

### Estimated Effort
1 day

### Risks
- Rate limit bypass removal could break existing test scripts that use the header.
- Debug endpoint removal could break mobile connectivity test scripts.

### Dependencies
None. This is the starting point.

### Definition of Done
- No unauthenticated write access to database.
- No client-controllable rate limit bypass in production.
- Default secrets rejected in all environments.
- Firebase credentials not committed to repo.

---

| Task ID | Title | Description | Files Modified | Dependencies | Time | Risk | Acceptance Criteria |
|---------|-------|-------------|----------------|--------------|------|------|---------------------|
| 1.1 ✅ | Remove debug endpoints or add auth | Either delete `/api/debug/mobile-write-test` (GET and POST) or wrap them in `authenticateToken` middleware. Deleting is preferred since they serve no production purpose. | `server/src/index.ts` | None | 30 min | Low | Debug endpoints return 401 without valid token, or return 404 if deleted. |
| 1.2 ✅ | Remove rate limit bypass in production | Conditionally skip the `x-bypass-rate-limit` check when `NODE_ENV=production`. The bypass should only work in development. | `server/src/index.ts` (rate limiters) | None | 30 min | Low | In production mode, the bypass header has no effect. In development, it still works for testing. |
| 1.3 ✅ | Block default JWT secrets in all environments | The current code only blocks default secrets when `NODE_ENV=production`. Extend this to also warn loudly in development, and consider refusing to start if the secrets are defaults and `NODE_ENV` is not set. | `server/src/index.ts` | None | 20 min | Low | Server refuses to start with default secrets unless explicitly in development mode. |
| 1.4 ✅ | Remove Firebase service account from repo | Add `firebase/service-account.json` to `.gitignore`. Move the file out of the repo or document that it must be provided via environment variable (`FCM_SERVICE_ACCOUNT_KEY` or `FIREBASE_SERVICE_ACCOUNT_PATH`). | `.gitignore`, `README.md` | None | 20 min | Low | Firebase credentials file is gitignored. Existing file removed from git tracking. |
| 1.5 ✅ | Remove the orphan edit_socket.js script | The file at project root (`/home/karan/Desktop/chat_app/edit_socket.js`) references a hardcoded path outside the project and serves no purpose. Delete it. | `edit_socket.js` (delete) | None | 5 min | None | File no longer exists. |

---

## Phase 2 — Application Stability

### Objective
Prevent application crashes and ensure basic resilience for production users.

### Why Before Next Phase
A crashing app loses users permanently. Error boundaries and disconnection indicators are foundational UX. These must exist before any feature work or refactoring.

### Estimated Effort
1–2 days

### Risks
- Error boundaries may mask bugs if error reporting is poor. Mitigate by logging errors.
- Socket disconnection indicator must not cause excessive re-renders.

### Dependencies
Phase 1 (so we're not adding stability to an insecure app).

### Definition of Done
- Unhandled React errors show a fallback UI instead of white screen.
- Socket disconnection is visible to the user.
- Socket event listener cleanup is deterministic (no duplicate handlers).
- Hardcoded backend URL removed from client.

---

| Task ID | Title | Description | Files Modified | Dependencies | Time | Risk | Acceptance Criteria |
|---------|-------|-------------|----------------|--------------|------|------|---------------------|
| 2.1 ✅ | Add React Error Boundary | Create an `ErrorBoundary` class component in `client/src/components/`. Wrap `<AppContent />` in `App.tsx` with it. Log errors to console (structured) and show a "Something went wrong" fallback with a retry button. | `client/src/App.tsx`, new `client/src/components/ErrorBoundary.tsx` | None | 1 hr | Low | Simulated throw in a child component shows fallback UI, not white screen. |
| 2.2 ✅ | Add socket disconnection indicator | In `SocketContext.tsx`, the `isConnected` state already exists. Expose it. In `ChatDashboard.tsx`, show a subtle toast/banner at the top when `isConnected` transitions to `false`, and hide it when `true`. Keep it lightweight — a single `<div>` with a message. | `client/src/context/SocketContext.tsx`, `client/src/pages/ChatDashboard.tsx` | None | 1 hr | Low | Disconnecting the network shows a "Reconnecting..." banner. Reconnecting hides it. |
| 2.3 ✅ | Fix socket event listener cleanup | In `ChatDashboard.tsx`, the socket `useEffect` depends on `[socket, selectedChat]`. The cleanup function calls `socket.off()` for each event. Verify that every `socket.on()` has a matching `socket.off()` in cleanup, and that the dependency array is correct. If `selectedChat` changes cause re-registration, ensure old handlers are fully removed before new ones are added. | `client/src/pages/ChatDashboard.tsx` | None | 2 hrs | Medium | Console logging confirms only one handler per event is active at any time. No duplicate message_received or typing events. |
| 2.4 ✅ | Remove hardcoded backend URL fallback | In `client/src/context/AuthContext.tsx`, `getBackendURL()` falls back to `http://192.168.10.82:5000` for native/dev. Replace this with a clear error or a configurable default (e.g., require `VITE_API_URL` in Capacitor builds). | `client/src/context/AuthContext.tsx` | None | 30 min | Low | In Capacitor mode without a configured URL, the app shows an error message instead of silently pointing at a wrong IP. |

---

## Phase 3 — Core Feature Completion

### Objective
Close the gaps in existing features so all advertised functionality actually works end-to-end.

### Why Before Next Phase
Incomplete features confuse users and create support burden. Email verification is half-built — either finish it or remove the dead code path.

### Estimated Effort
2–3 days

### Risks
- Email delivery requires a third-party service (SendGrid, SES, etc.). This phase documents the integration point but does not require choosing a provider.
- `switch_to_video` is a minor feature; could be deferred.

### Dependencies
Phase 2 (stability ensures features don't crash).

### Definition of Done
- `switch_to_video` socket event has a client-side handler.
- Email verification flow is documented with a clear integration point (even if using console.log fallback).
- Avatar upload during registration is functional or the UI clearly indicates it's a preview.

---

| Task ID | Title | Description | Files Modified | Dependencies | Time | Risk | Acceptance Criteria |
|---------|-------|-------------|----------------|--------------|------|------|---------------------|
| 3.1 ✅ | Add client-side handler for switch_to_video | In `useWebRTCCall.ts`, add a `onSwitchedToVideo` listener analogous to `onSwitchedToAudio`. When received, the client should enable the local camera (if available) or gracefully fall back. Server-side already handles this event. | `client/src/hooks/useWebRTCCall.ts` | 2.3 | 1 hr | Low | When peer emits `switch_to_video`, the local client attempts to enable camera. If camera is unavailable, it stays in audio mode and logs a warning. |
| 3.2 ✅ | Document email delivery integration point | The auth routes already generate verification and reset tokens and log them. Create a `server/src/utils/email.ts` module with a `sendEmail(to, subject, body)` function that currently logs to console but has a clear interface for plugging in SendGrid/SES. Update auth routes to call this instead of inline `logger.info`. | `server/src/utils/email.ts` (new), `server/src/routes/auth.routes.ts` | None | 2 hrs | Low | Auth routes call `sendEmail()` instead of inline logging. The module is documented with instructions for adding a real provider. |
| 3.3 ✅ | Clarify avatar upload UX during registration | In `Login.tsx` step 2, the avatar picker shows a preview but doesn't upload the file. Either: (a) upload the avatar file during registration and attach the URL to the profile, or (b) clearly label it as "Profile preview — you can upload a photo after creating your account" and disable the picker. Option (b) is the minimum viable fix. | `client/src/pages/Login.tsx` | None | 30 min | Low | The avatar section in registration either uploads the file or has clear text indicating it's preview-only. |

---

## Phase 4 — Testing Foundation

### Objective
Establish a test infrastructure so all future changes have a safety net.

### Why Before Next Phase
Refactoring ChatDashboard (Phase 5) without tests is extremely risky. Tests must exist first so we can verify nothing breaks.

### Estimated Effort
3–4 days

### Risks
- Setting up Vitest + React Testing Library is well-documented but the sheer volume of untested code means we start with critical-path tests only.
- Playwright E2E tests require a running server, adding CI complexity.

### Dependencies
Phase 2 (error boundaries and stable socket handling make the app testable). Phase 3 (feature completion means we test the final behavior, not incomplete code).

### Definition of Done
- Vitest configured and running for server and client.
- Auth flow has integration tests (register, login, refresh, logout).
- Socket messaging has at least one integration test.
- A basic Playwright test covers login → send message flow.
- `npm test` runs all tests and passes.

---

| Task ID | Title | Description | Files Modified | Dependencies | Time | Risk | Acceptance Criteria |
|---------|-------|-------------|----------------|--------------|------|------|---------------------|
| 4.1 | Set up Vitest for server | Add `vitest` to server devDependencies. Create `server/vitest.config.ts`. Add `"test": "vitest run"` script to `server/package.json`. Create `server/src/__tests__/auth.test.ts` with tests for register, login, refresh, and logout using the existing seed data. | `server/package.json`, new `server/vitest.config.ts`, new `server/src/__tests__/auth.test.ts` | None | 3 hrs | Medium | `npm test` in server directory runs and passes auth tests against a test database. |
| 4.2 | Set up Vitest + React Testing Library for client | Add `vitest`, `@testing-library/react`, `@testing-library/jest-dom` to client devDependencies. Create `client/vitest.config.ts`. Add `"test": "vitest run"` script. Create `client/src/__tests__/AuthContext.test.tsx` testing login, logout, and token refresh mock flows. | `client/package.json`, new `client/vitest.config.ts`, new `client/src/__tests__/AuthContext.test.tsx` | None | 3 hrs | Medium | `npm test` in client directory runs and passes AuthContext tests. |
| 4.3 | Write server integration test for messaging flow | Create `server/src/__tests__/messaging.test.ts` that tests: create direct chat, send message via REST, fetch messages, edit message, delete message. Uses supertest or direct HTTP calls against a test server instance. | new `server/src/__tests__/messaging.test.ts` | 4.1 | 3 hrs | Medium | Test covers the full message lifecycle and passes. |
| 4.4 | Write basic Playwright E2E test | Create `client/e2e/login-and-message.spec.ts`. Test: navigate to login page, log in as alice, verify chat dashboard loads, verify socket connects. Keep it minimal — just validate the happy path. | new `client/e2e/login-and-message.spec.ts`, `client/playwright.config.ts` (new) | 4.2 | 4 hrs | High | Playwright test runs against a dev server and passes. |
| 4.5 | Add test scripts to package.json | Ensure both `server/package.json` and `client/package.json` have `"test"` scripts. Add a root-level `"test"` script that runs both. | `server/package.json`, `client/package.json`, root `package.json` (if exists) | 4.1, 4.2 | 15 min | Low | Running `npm test` at root executes all server and client tests. |

---

## Phase 5 — ChatDashboard Decomposition

### Objective
Break the 2000+ line god component into smaller, testable, maintainable modules.

### Why Before Next Phase
This is the biggest barrier to maintainability. Every future change touches this file. Decomposing it enables all subsequent work. However, we need tests (Phase 4) first to verify nothing breaks.

### Estimated Effort
4–5 days

### Risks
- This is the highest-risk phase. A wrong decomposition breaks the entire UI.
- Each extraction must be verified against the test suite.
- Prop drilling will temporarily worsen before it improves.

### Dependencies
Phase 4 (tests to verify refactoring correctness).

### Definition of Done
- ChatDashboard.tsx reduced to under 500 lines (layout + orchestration only).
- Domain logic extracted into custom hooks: `useChats`, `useMessages`, `useFriendship`, `useNotifications`, `useCallHistory`.
- Each hook is independently testable.
- All existing functionality works identically.

---

| Task ID | Title | Description | Files Modified | Dependencies | Time | Risk | Acceptance Criteria |
|---------|-------|-------------|----------------|--------------|------|------|---------------------|
| 5.1 | Extract `useChats` hook | Create `client/src/hooks/useChats.ts`. Move chat list state, `fetchChats`, chat selection, and chat-related socket listeners (`message_received` for chat list updates, `presence_batch`) into this hook. Return `{ chats, selectedChat, setSelectedChat, fetchChats }`. | new `client/src/hooks/useChats.ts`, `client/src/pages/ChatDashboard.tsx` | 4.2 | 4 hrs | Medium | Hook compiles, ChatDashboard imports and uses it, existing behavior unchanged. |
| 5.2 | Extract `useMessages` hook | Create `client/src/hooks/useMessages.ts`. Move message state, `fetchMessages`, `handleSendMessage`, message-related socket listeners (`message_received`, `messages_read`, `messages_delivered`, `message_reaction`, `message_edited`, `message_deleted`), typing indicators, and offline queue into this hook. | new `client/src/hooks/useMessages.ts`, `client/src/pages/ChatDashboard.tsx` | 5.1 | 4 hrs | Medium | Hook compiles, messages send/receive/edit/delete/react work as before. |
| 5.3 | Extract `useFriendship` hook | Create `client/src/hooks/useFriendship.ts`. Move friends state, pending requests, blocked users, all friendship API calls, and friendship socket listeners into this hook. | new `client/src/hooks/useFriendship.ts`, `client/src/pages/ChatDashboard.tsx` | 4.2 | 3 hrs | Medium | Hook compiles, friend request/accept/reject/block flows work as before. |
| 5.4 | Extract `useNotifications` hook | Create `client/src/hooks/useNotifications.ts`. Move notification state, pagination, mark-read, preferences, and notification socket listener into this hook. | new `client/src/hooks/useNotifications.ts`, `client/src/pages/ChatDashboard.tsx` | 4.2 | 2 hrs | Low | Hook compiles, notification center and preferences work as before. |
| 5.5 | Extract `useFileUpload` hook | Create `client/src/hooks/useFileUpload.ts`. Move upload state, progress tracking, file validation, and the upload API call into this hook. | new `client/src/hooks/useFileUpload.ts`, `client/src/pages/ChatDashboard.tsx` | 4.2 | 2 hrs | Low | Hook compiles, file upload flow works as before. |
| 5.6 | Extract `useCallHistory` hook | Create `client/src/hooks/useCallHistory.ts`. Move call history state and fetch into this hook. | new `client/src/hooks/useCallHistory.ts`, `client/src/pages/ChatDashboard.tsx` | 4.2 | 1 hr | Low | Hook compiles, call history modal shows correct data. |
| 5.7 | Slim down ChatDashboard to layout-only | After all hooks are extracted, ChatDashboard should only handle: responsive layout switching, modal visibility state, and composing the hooks together. Remove all direct state management and socket listeners. | `client/src/pages/ChatDashboard.tsx` | 5.1–5.6 | 3 hrs | Medium | ChatDashboard is under 500 lines. All features work. `npm test` passes. |

---

## Phase 6 — Security Hardening

### Objective
Address remaining security concerns for production deployment.

### Why Before Next Phase
Performance work (Phase 7) is irrelevant if the app is insecure. These are production-blocking issues.

### Estimated Effort
2–3 days

### Risks
- Session invalidation on password change affects all devices — must be tested carefully.
- Database indexes require a Prisma migration, which could conflict with `prisma db push` usage.

### Dependencies
Phase 1 (basic security fixes). Phase 5 (decomposed code makes security changes easier to audit).

### Definition of Done
- Password change invalidates all sessions.
- Database has performance indexes on high-traffic query columns.
- Prisma migrations are in sync with schema (no drift).
- Client TypeScript has `noUnusedLocals` and `noUnusedParameters` enabled.

---

| Task ID | Title | Description | Files Modified | Dependencies | Time | Risk | Acceptance Criteria |
|---------|-------|-------------|----------------|--------------|------|------|---------------------|
| 6.1 ✅ | Invalidate sessions on password change | In `auth.routes.ts` `change-password` endpoint, after updating the password hash, delete all sessions for the user (`prisma.session.deleteMany({ where: { userId } })`) and clear rotated tokens grace cache for that user. | `server/src/routes/auth.routes.ts` | None | 30 min | Low | After changing password, existing refresh tokens for other devices are rejected. |
| 6.2 ✅ | Add database performance indexes | Create a new Prisma migration adding indexes on: `Message(chatId, createdAt)`, `Message(senderId)`, `ChatMember(userId)`, `Notification(userId, isRead)`, `CallLog(callerId)`, `CallLog(receiverId)`. Use `prisma migrate dev` to generate the migration. | `server/prisma/schema.prisma`, new migration SQL | None | 1 hr | Medium | Migration applies cleanly. Queries using these columns show improved performance (test with EXPLAIN). |
| 6.3 ✅ | Sync Prisma schema with migrations | The schema has drifted from migrations. Run `prisma migrate dev --create-only` to capture all current schema changes as a proper migration. This ensures future `prisma migrate deploy` works correctly. | new Prisma migration | 6.2 | 30 min | Medium | `prisma migrate status` shows all migrations applied. `prisma db push` is no longer needed. |
| 6.4 ✅ | Enable stricter TypeScript on client | In `client/tsconfig.json`, set `noUnusedLocals: true` and `noUnusedParameters: true` (prefix unused params with `_`). Fix any resulting compile errors. | `client/tsconfig.json`, potentially multiple client source files | None | 2 hrs | Medium | `tsc --noEmit` passes with no errors. |
| 6.5 | Update Docker Compose for PostgreSQL | In `docker-compose.yml`, add a PostgreSQL service. Update the backend service's `DATABASE_URL` to point to PostgreSQL. Change `schema.prisma` provider to `postgresql`. Update the backend command to use `prisma migrate deploy` instead of `prisma db push`. | `docker-compose.yml`, `server/prisma/schema.prisma`, `server/Dockerfile` | 6.3 | 2 hrs | High | `docker-compose up --build` starts all services. App functions correctly with PostgreSQL. |

---

## Phase 7 — Performance Optimization

### Objective
Address N+1 queries, missing caching, and frontend performance issues.

### Why Before Next Phase
With security and stability addressed, performance improvements now have measurable impact. This phase also reduces server load before production traffic.

### Estimated Effort
2–3 days

### Risks
- N+1 query fixes change SQL query patterns — must verify correctness.
- Code splitting changes loading behavior — must test on slow connections.

### Dependencies
Phase 4 (tests to verify performance changes don't break functionality). Phase 6 (indexes must exist before optimizing queries).

### Definition of Done
- Chat list fetch uses a single efficient query (no N+1).
- Images/media load lazily.
- Application is code-split (login page loads separately from dashboard).

---

| Task ID | Title | Description | Files Modified | Dependencies | Time | Risk | Acceptance Criteria |
|---------|-------|-------------|----------------|--------------|------|------|---------------------|
| 7.1 | Fix N+1 query in chat list | In `chat.routes.ts` `GET /chats`, the unread count is computed per-chat with separate `prisma.message.count()` calls. Replace with a single raw query or Prisma `groupBy` that computes unread counts for all chats in one pass. | `server/src/routes/chat.routes.ts` | 6.2 | 3 hrs | Medium | Chat list fetch time measurable reduced. Database query count drops from O(n) to O(1). |
| 7.2 | Add lazy loading for images/media | In `ChatDashboard.tsx` and mobile conversation components, add `loading="lazy"` to `<img>` tags for message attachments and avatars. | `client/src/pages/ChatDashboard.tsx`, `client/src/components/mobile/Shared/Avatar.tsx`, `client/src/components/mobile/Chats/MobileConversationScreen.tsx` | None | 1 hr | Low | Images below the fold don't load until scrolled into view. |
| 7.3 | Add route-based code splitting | Use `React.lazy` + `Suspense` to split: Login page, ChatDashboard, MobileDashboard, TabletDashboard. Each loads only when needed. | `client/src/App.tsx`, `client/src/pages/ChatDashboard.tsx` | None | 2 hrs | Medium | Initial bundle size reduced. Login page loads fast. Dashboard loads on demand. |
| 7.4 | Update service worker with cache versioning | In `client/public/sw.js`, update the cache name to include a version hash. Add network-first strategy for API calls and cache-first for static assets. | `client/public/sw.js` | None | 1 hr | Low | After deploying a new version, users see updated content within one page refresh. |

---

## Phase 8 — Production Readiness

### Objective
Ensure the application is deployable, observable, and maintainable in production.

### Why Last Phase
All previous phases make the app worthy of production. This phase adds the operational tooling around it.

### Estimated Effort
2–3 days

### Risks
- CI/CD pipeline requires a platform (GitHub Actions, etc.).
- Monitoring requires infrastructure decisions.

### Dependencies
All previous phases.

### Definition of Done
- CI pipeline runs lint, type-check, and tests on every push.
- Application logs are structured and PII-free.
- Health check endpoint is used by Docker for readiness probes.
- All manual test scripts in root are either deleted or converted to automated tests.

---

| Task ID | Title | Description | Files Modified | Dependencies | Time | Risk | Acceptance Criteria |
|---------|-------|-------------|----------------|--------------|------|------|---------------------|
| 8.1 | Add GitHub Actions CI workflow | Create `.github/workflows/ci.yml`. Steps: checkout, install, type-check, lint (once ESLint is configured), run tests. Trigger on push to main and on pull requests. | new `.github/workflows/ci.yml` | 4.5, 6.4 | 2 hrs | Low | Pushing to a branch triggers the CI pipeline. All steps pass. |
| 8.2 | Configure ESLint for client | Add `.eslintrc.cjs` for the client with TypeScript + React rules. Fix any existing violations. Add `"lint": "eslint ."` script to `client/package.json`. | new `client/.eslintrc.cjs`, `client/package.json`, potentially multiple source files | 6.4 | 3 hrs | Medium | `npm run lint` passes with zero warnings. |
| 8.3 | Clean up console.log statements | Audit all `console.log`, `console.error`, `console.warn` in client code. Remove debug-only logs. Keep only error logs and meaningful warnings. For the server, the structured logger already handles this. | `client/src/pages/ChatDashboard.tsx`, `client/src/hooks/useWebRTCCall.ts`, `client/src/context/AuthContext.tsx`, others | None | 3 hrs | Low | No console.log statements remain in client production code paths. |
| 8.4 | Clean up manual test scripts | Delete all `test-*.cjs`, `test-*.js`, `verify-*.cjs`, `pre-turn-verify.*` files from the project root. These are replaced by the automated test suite. | Multiple files in project root | 4.4 | 15 min | Low | No manual test scripts remain in the project root. |
| 8.5 | Add Docker health check | In `docker-compose.yml`, add `healthcheck` to the backend service using the `/api/observability/health` endpoint. Add `depends_on` condition `service_healthy` to the frontend service. | `docker-compose.yml` | 6.5 | 30 min | Low | `docker-compose ps` shows backend as healthy before frontend starts. |

---

## Execution Timeline Summary

| Phase | Name | Effort | Cumulative |
|-------|------|--------|------------|
| 1 | Critical Security Fixes | 1 day | 1 day |
| 2 | Application Stability | 1–2 days | 2–3 days |
| 3 | Core Feature Completion | 2–3 days | 4–6 days |
| 4 | Testing Foundation | 3–4 days | 7–10 days |
| 5 | ChatDashboard Decomposition | 4–5 days | 11–15 days |
| 6 | Security Hardening | 2–3 days | 13–18 days |
| 7 | Performance Optimization | 2–3 days | 15–21 days |
| 8 | Production Readiness | 2–3 days | 17–24 days |

**Total estimated effort: 17–24 working days (3.5–5 weeks)**

---

## Single Highest-Priority Task

**Task 1.1: Remove debug endpoints or add authentication**

**Why this is first:**
The `/api/debug/mobile-write-test` POST and GET endpoints are exposed without any authentication. Any anonymous user can create arbitrary `Chat` records in the database, read them, and delete them. This is an active data integrity vulnerability that could be exploited right now. It takes 30 minutes to fix and has zero risk of breaking legitimate functionality (these endpoints serve no production purpose). Every other task in this plan assumes a reasonably secure baseline — this task establishes that baseline.

If you want me to begin implementation, I will start with Task 1.1.
