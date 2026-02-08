#!/bin/bash

# ClassTrack Database Backup Script (Manual / Cron)
# Application uses Supabase. Run this with Supabase CLI or pg_dump if Direct Connection is available.

BACKUP_DIR="backups"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=7

mkdir -p $BACKUP_DIR

if [ -z "$DATABASE_URL" ]; then
  echo "Error: DATABASE_URL is not set."
  exit 1
fi

echo "Creating backup: backup_$DATE.sql"
# pg_dump requires pg_dump utility installed
pg_dump $DATABASE_URL > "$BACKUP_DIR/backup_$DATE.sql"

# Compress
gzip "$BACKUP_DIR/backup_$DATE.sql"

# Clean old
find $BACKUP_DIR -name "backup_*.sql.gz" -mtime +$RETENTION_DAYS -delete

echo "Backup completed: $BACKUP_DIR/backup_$DATE.sql.gz"
