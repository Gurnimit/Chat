# Rollback Plan - Velvet Chat

This plan provides rollback procedures for the client application, backend server, and database state to restore the system to a known good state in the event of failure.

---

## 1. Database Rollback

Velvet Chat staging relies on SQLite.

### Reverting SQLite State (Staging/Dev)
If a staging database migration or transaction seed fails:
1. Stop the backend server immediately to stop writing to the database:
   ```bash
   # Kill running server node process
   ```
2. Locate the database file at: `server/prisma/dev.db`
3. Delete the corrupted database file:
   ```powershell
   Remove-Item "server/prisma/dev.db" -ErrorAction Ignore
   ```
4. Copy the archived database version back to the prisma folder:
   ```powershell
   Copy-Item "archives/dev.db" -Destination "server/prisma/dev.db"
   ```
5. Restart the server.

### Reverting PostgreSQL State (Production Roadmap)
For production PostgreSQL environments:
1. Revert schema migration status using Prisma:
   ```bash
   npx prisma db push --force-reset
   ```
2. Restore database from the last pg_dump SQL file:
   ```bash
   pg_restore -d <database_uri> archives/db-backup.dump
   ```

---

## 2. Backend Server Rollback

If server processes fail to launch or experience runtime errors after deploying v1.0.0-rc1:
1. Stop the server task:
   ```bash
   npm run stop # or PM2 command: pm2 stop server
   ```
2. Revert the repository to the last stable commit:
   ```bash
   git reset --hard HEAD~1
   ```
3. Re-install exact locked package dependencies:
   ```bash
   npm ci
   ```
4. Compile the previous stable build:
   ```bash
   npm run build
   ```
5. Relaunch the server and verify connectivity logs.

---

## 3. Client & APK Rollback

If the native client crashes or fails after staging distribution:
1. Revert Web public folder assets by pointing the client web server (Nginx or static host) to the previous archived build bundle.
2. In the Android staging environment, instruct testers to uninstall the current RC build (`app-release-unsigned.apk` or client-release-rc1).
3. Distribute the previous archived APK from `archives/app-release-unsigned.apk` to testers.
4. If staging updates were distributed via testing channels (e.g. Google Play Console Staging/Internal Test tracks), initiate a version code rollback by promoting the previous verified release code block.
