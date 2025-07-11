#!/bin/bash

# Neo VMS Database Backup Script
set -e

# Configuration
BACKUP_DIR="/backups"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="neo_vms_backup_${DATE}.sql"
BACKUP_PATH="${BACKUP_DIR}/${BACKUP_FILE}"

# Database connection info
DB_HOST=${POSTGRES_HOST:-database}
DB_NAME=${POSTGRES_DB:-neo_vms}
DB_USER=${POSTGRES_USER:-neo_vms_user}
DB_PASSWORD=${POSTGRES_PASSWORD:-secure_password}

echo "Starting database backup at $(date)"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Create database backup
PGPASSWORD="$DB_PASSWORD" pg_dump \
    -h "$DB_HOST" \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    --no-password \
    --verbose \
    --clean \
    --if-exists \
    --create \
    > "$BACKUP_PATH"

# Compress the backup
gzip "$BACKUP_PATH"
COMPRESSED_BACKUP="${BACKUP_PATH}.gz"

echo "Database backup completed: $COMPRESSED_BACKUP"

# Clean up old backups (keep last N days)
RETENTION_DAYS=${BACKUP_RETENTION_DAYS:-30}
find "$BACKUP_DIR" -name "neo_vms_backup_*.sql.gz" -mtime +$RETENTION_DAYS -delete

echo "Backup cleanup completed - keeping last $RETENTION_DAYS days"

# Backup file uploads if they exist
if [ -d "/app/uploads" ]; then
    UPLOADS_BACKUP="neo_vms_uploads_${DATE}.tar.gz"
    UPLOADS_PATH="${BACKUP_DIR}/${UPLOADS_BACKUP}"
    
    tar -czf "$UPLOADS_PATH" -C /app uploads/
    echo "Uploads backup completed: $UPLOADS_PATH"
    
    # Clean up old upload backups
    find "$BACKUP_DIR" -name "neo_vms_uploads_*.tar.gz" -mtime +$RETENTION_DAYS -delete
fi

echo "Backup process completed at $(date)"