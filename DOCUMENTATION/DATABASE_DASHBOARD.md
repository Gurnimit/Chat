# DATABASE_DASHBOARD.md

## Current Database Location

The application currently uses **SQLite** for development. There is no hosted database dashboard.

### SQLite File Location
```
/home/karan/Development/projects/chat_app/server/prisma/dev.db
```

### How to View the Database

**Option 1: DB Browser for SQLite (GUI)**
1. Download DB Browser for SQLite: https://sqlitebrowser.org/
2. Open the file: `server/prisma/dev.db`
3. Browse tables, run queries, view data

**Option 2: Command Line**
```bash
cd /home/karan/Development/projects/chat_app/server
sqlite3 prisma/dev.db
.tables                          # List all tables
SELECT COUNT(*) FROM "User";     # Count users
SELECT * FROM "User";            # View all users
SELECT * FROM "Message";         # View all messages
SELECT * FROM "Chat";            # View all chats
SELECT * FROM "Friendship";      # View all friendships
SELECT * FROM "Notification";    # View all notifications
SELECT * FROM "Session";         # View all sessions
SELECT * FROM "CallLog";         # View all call logs
SELECT * FROM "Block";           # View all blocks
SELECT * FROM "DeviceToken";     # View all device tokens
SELECT * FROM "ChatMember";      # View all chat memberships
SELECT * FROM "NotificationPreference"; # View all notification prefs
.quit
```

**Option 3: Prisma Studio (Web UI)**
```bash
cd /home/karan/Development/projects/chat_app/server
npx prisma studio
# Opens browser at http://localhost:5555
```

## Table Reference

| Table | Primary Key | Key Columns |
|-------|-------------|-------------|
| User | id (UUID) | email, username, publicId |
| Profile | id (UUID) | userId (FK→User) |
| Chat | id (UUID) | type (DIRECT/GROUP), groupName |
| ChatMember | id (UUID) | chatId (FK→Chat), userId (FK→User), role |
| Message | id (UUID) | chatId (FK→Chat), senderId (FK→User), content |
| MessageReaction | id (UUID) | messageId, userId, emoji |
| MessageRead | id (UUID) | messageId, userId |
| MessageStatus | id (UUID) | messageId, userId, deliveredAt, readAt |
| Attachment | id (UUID) | messageId (FK→Message), fileUrl, fileName |
| Notification | id (UUID) | userId, title, body, type, status, isRead |
| DeviceToken | id (UUID) | userId, token (unique), deviceId |
| Session | id (UUID) | userId, refreshToken (unique), expiresAt |
| FriendRequest | id (UUID) | senderId, receiverId, status |
| Friendship | id (UUID) | userId, friendId |
| Block | id (UUID) | blockerId, blockedId |
| CallLog | id (UUID) | callerId, receiverId, callType, status |
| NotificationPreference | id (UUID) | userId (unique), messages, calls, etc. |

## Production Database Dashboard

When deployed to production with PostgreSQL, the dashboard depends on the hosting platform:

| Platform | Dashboard URL | Notes |
|----------|--------------|-------|
| Supabase | https://supabase.com/dashboard | Built-in SQL editor, table viewer |
| Neon | https://console.neon.tech | Serverless PostgreSQL |
| Railway | https://railway.app/dashboard | PostgreSQL add-on |
| Render | https://render.com/dashboard | PostgreSQL add-on |
| AWS RDS | AWS Console → RDS | Full PostgreSQL managed service |
| Local PostgreSQL | `psql -d chat_db` | Command line |

## Observability Endpoints (Alternative to Dashboard)

The application provides API endpoints to view aggregate data:

| Endpoint | Auth | Description |
|----------|------|-------------|
| `GET /api/observability/health` | No | Database connection status |
| `GET /api/observability/metrics` | Yes | User/message/chat/notification counts |

Example:
```bash
curl http://localhost:5000/api/observability/health
curl -H "Authorization: Bearer <token>" http://localhost:5000/api/observability/metrics
```
