# Backup and Recovery Procedures - Velvet Chat

This guide documents the procedures for backup operations, integrity checking, and recovery processes for both development (SQLite) and production (PostgreSQL) databases.

---

## 1. SQLite (Development & Local Environments)

### Backup Script
For local installations or staging servers running on SQLite, backups are made by copying the database file when no write operations are in progress. The SQLite `.backup` command is safe to use concurrently as it locks the database during replication.

Save the following as a cron job script `backup_sqlite.sh`:

```bash
#!/bin/bash
# Configuration
DB_PATH="/var/www/velvetchat/server/prisma/dev.db"
BACKUP_DIR="/var/backups/velvetchat/sqlite"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_PATH="${BACKUP_DIR}/dev_backup_${TIMESTAMP}.db"

# Ensure backup directory exists
mkdir -p "${BACKUP_DIR}"

# Execute SQLite online backup
sqlite3 "${DB_PATH}" ".backup '${BACKUP_PATH}'"

# Compress backup file
gzip "${BACKUP_PATH}"

# Keep only last 14 days of backups
find "${BACKUP_DIR}" -name "dev_backup_*.db.gz" -mtime +14 -exec rm {} \;

echo "SQLite backup completed successfully: ${BACKUP_PATH}.gz"
```

### Database Maintenance
Perform periodic database optimization and integrity scans:
```bash
# Verify file integrity
sqlite3 server/prisma/dev.db "PRAGMA integrity_check;"

# Optimize space and rebuild indexes (Run weekly/monthly)
sqlite3 server/prisma/dev.db "VACUUM;"
```

### SQLite Recovery
To restore an SQLite database from a compressed backup:
1. Stop the application server:
   ```bash
   pm2 stop velvetchat-server
   ```
2. Backup the current corrupted database (just in case):
   ```bash
   mv server/prisma/dev.db server/prisma/dev.db.corrupted
   ```
3. Extract the target backup file:
   ```bash
   gunzip -c /var/backups/velvetchat/sqlite/dev_backup_20260606_120000.db.gz > server/prisma/dev.db
   ```
4. Run an integrity check to verify correctness:
   ```bash
   sqlite3 server/prisma/dev.db "PRAGMA integrity_check;"
   ```
5. Restart the server:
   ```bash
   pm2 start velvetchat-server
   ```

---

## 2. PostgreSQL (Production Environments)

### Production Backup Script
Use the native `pg_dump` utility to perform non-blocking backups on production instances.

Create the backup script `backup_postgres.sh`:

```bash
#!/bin/bash
# Configuration
DB_NAME="velvetchat"
DB_USER="chat_user"
BACKUP_DIR="/var/backups/velvetchat/postgres"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/postgres_${DB_NAME}_${TIMESTAMP}.sql.gz"

mkdir -p "${BACKUP_DIR}"

# Run pg_dump and pipe to gzip
pg_dump -U "${DB_USER}" -h localhost "${DB_NAME}" | gzip > "${BACKUP_FILE}"

# Keep only last 30 days of backups
find "${BACKUP_DIR}" -name "postgres_${DB_NAME}_*.sql.gz" -mtime +30 -exec rm {} \;

echo "PostgreSQL backup completed: ${BACKUP_FILE}"
```

### PostgreSQL Recovery
To restore the database structure and data:
1. Stop the application server to release database connection locks.
2. Drop and recreate the production database:
   ```bash
   dropdb -U chat_user -h localhost velvetchat
   createdb -U chat_user -h localhost velvetchat
   ```
3. Restore from the compressed SQL backup:
   ```bash
   gunzip -c /var/backups/velvetchat/postgres/postgres_velvetchat_20260606_120000.sql.gz | psql -U chat_user -h localhost velvetchat
   ```
4. Verify connections and restart the application:
   ```bash
   npm run start --prefix server
   ```

---

## 3. Testing Backup Restoration (Drill)

It is critical to regularly practice database restoration procedures in a safe environment:
1. Copy a backup file (`.db` or `.sql.gz`) to a secondary test server.
2. Perform the recovery steps detailed in sections 1 or 2.
3. Establish a Prisma client instance pointing to the restored test database.
4. Execute `npx prisma db pull` or run user search queries to ensure tables and records are intact.
