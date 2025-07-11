#!/bin/bash

# Neo VMS Database Restore Script
set -e

# Check if backup file is provided
if [ $# -eq 0 ]; then
    echo "Usage: $0 <backup_file.sql.gz>"
    echo "Available backups:"
    ls -la /backups/neo_vms_backup_*.sql.gz 2>/dev/null || echo "No backups found"
    exit 1
fi

BACKUP_FILE="$1"
BACKUP_PATH="/backups/$BACKUP_FILE"

# Check if backup file exists
if [ ! -f "$BACKUP_PATH" ]; then
    echo "Error: Backup file not found: $BACKUP_PATH"
    exit 1
fi

# Database connection info
DB_HOST=${POSTGRES_HOST:-database}
DB_NAME=${POSTGRES_DB:-neo_vms}
DB_USER=${POSTGRES_USER:-neo_vms_user}
DB_PASSWORD=${POSTGRES_PASSWORD:-secure_password}

echo "Starting database restore from: $BACKUP_FILE"
echo "Target database: $DB_NAME on $DB_HOST"

# Extract and restore database
echo "Extracting backup file..."
gunzip -c "$BACKUP_PATH" | PGPASSWORD="$DB_PASSWORD" psql \
    -h "$DB_HOST" \
    -U "$DB_USER" \
    -d postgres \
    --no-password \
    --verbose

echo "Database restore completed successfully"

# Check if there's a corresponding uploads backup
UPLOADS_BACKUP=$(echo "$BACKUP_FILE" | sed 's/neo_vms_backup_/neo_vms_uploads_/' | sed 's/.sql.gz/.tar.gz/')
UPLOADS_PATH="/backups/$UPLOADS_BACKUP"

if [ -f "$UPLOADS_PATH" ]; then
    echo "Restoring uploads from: $UPLOADS_BACKUP"
    mkdir -p /app
    tar -xzf "$UPLOADS_PATH" -C /app/
    echo "Uploads restore completed"
else
    echo "No uploads backup found for this date"
fi

echo "Restore process completed at $(date)"