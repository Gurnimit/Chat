# DATABASE.md

## Database Engine
- **Development**: SQLite 3.45.0 (file-based)
- **Production**: PostgreSQL (configured in docker-compose.yml, not yet deployed)
- **ORM**: Prisma Client ^5.14.0
- **Migration System**: Prisma Migrations (2 migrations applied)
- **Connection**: `DATABASE_URL` env var

## Database File Location
- **Development**: `server/prisma/dev.db` (392KB)
- **Docker**: `./server/prisma/dev.db` (mounted volume)

## Schema Location
`server/prisma/schema.prisma`

## Migrations
| Migration | Description |
|-----------|-------------|
| `20260606000000_init` | Initial schema: User, Profile, Chat, ChatMember, Message, MessageReaction, MessageRead, Attachment, Notification, Session |
| `20260606180724_add_user_lifecycle_columns` | Added `isEmailVerified`, `emailVerificationToken`, `passwordResetToken`, `passwordResetExpires` |

## Models (17 total)
User, Profile, Chat, ChatMember, Message, MessageReaction, MessageRead, MessageStatus, Attachment, Notification, DeviceToken, Session, FriendRequest, Friendship, Block, CallLog, NotificationPreference

## Performance Indexes (Added)
| Table | Index Columns |
|-------|--------------|
| Message | `chatId, createdAt` |
| Message | `senderId` |
| ChatMember | `userId` |
| Notification | `userId, isRead` |
| CallLog | `callerId` |
| CallLog | `receiverId` |

## Storage Estimates for Production

### Per-User Storage
| Entity | Avg Size | 100 Users | 500 Users | 1,000 Users |
|--------|----------|-----------|-----------|-------------|
| User record | ~500B | 50KB | 250KB | 500KB |
| Profile | ~300B | 30KB | 150KB | 300KB |
| Session (avg 2 active) | ~400B | 80KB | 400KB | 800KB |
| NotificationPreference | ~200B | 20KB | 100KB | 200KB |
| **Subtotal** | | **180KB** | **900KB** | **1.8MB** |

### Per-Relationship Storage
| Entity | Avg Size | 100 Users | 500 Users | 1,000 Users |
|--------|----------|-----------|-----------|-------------|
| Friendship (avg 20 friends/user) | ~100B | 200KB | 5MB | 20MB |
| FriendRequest (avg 5 pending/user) | ~150B | 75KB | 1.25MB | 5MB |
| Block (avg 2/user) | ~100B | 20KB | 200KB | 400KB |
| ChatMember (avg 3 chats/user) | ~100B | 30KB | 750KB | 3MB |
| **Subtotal** | | **325KB** | **6.7MB** | **28.4MB** |

### Per-Message Storage
| Entity | Avg Size | 100 Users | 500 Users | 1,000 Users |
|--------|----------|-----------|-----------|-------------|
| Message (avg 100 msg/user/day) | ~200B | 2MB/day | 10MB/day | 20MB/day |
| MessageStatus (read receipts) | ~100B | 1MB/day | 5MB/day | 10MB/day |
| Attachment metadata | ~150B | 0.5MB/day | 2.5MB/day | 5MB/day |
| **Subtotal (daily)** | | **3.5MB/day** | **17.5MB/day** | **35MB/day** |
| **Subtotal (monthly)** | | **105MB/mo** | **525MB/mo** | **1.05GB/mo** |

### Total Storage (1 month)
| Scale | SQLite | PostgreSQL |
|-------|--------|------------|
| 100 users | ~106MB | ~106MB |
| 500 users | ~533MB | ~533MB |
| 1,000 users | ~1.1GB | ~1.1GB |

## Database Suitability Assessment

### SQLite (Current Development)
- **Suitable for**: Up to ~500 concurrent users
- **Limitations**: Single-writer, no concurrent writes, no network access
- **Verdict**: Fine for development and testing

### PostgreSQL (Production)
- **Suitable for**: 1,000+ concurrent users
- **Advantages**: Concurrent writes, networking, replication, backups
- **Verdict**: Recommended for production

### Recommendation
For the target scale (100-1,000 users), **PostgreSQL is the appropriate choice**. The schema is already PostgreSQL-compatible. The Docker Compose setup should be updated to use PostgreSQL for production.

## Backup Strategy
- **Development**: File copy of `dev.db`
- **Production**: pg_dump for PostgreSQL, scheduled daily backups
- **Docker**: Volume mount ensures data persists across container restarts

## Current Record Counts (Development)
| Table | Records |
|-------|---------|
| User | 9 |
| Profile | 9 |
| Chat | 3 |
| ChatMember | 4 |
| Message | 1 |
| Notification | 4 |
| Session | 22 |
| FriendRequest | 1 |
| Friendship | 2 |
| Block | 1 |
| NotificationPreference | 8 |
