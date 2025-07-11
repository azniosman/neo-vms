#!/bin/bash

# Start backup service with cron
echo "Starting Neo VMS Backup Service"

# Set up cron job
CRON_SCHEDULE=${BACKUP_SCHEDULE:-"0 2 * * *"}
echo "$CRON_SCHEDULE /usr/local/bin/backup.sh >> /var/log/backup.log 2>&1" > /tmp/crontab

# Install cron job
crontab /tmp/crontab

# Start cron daemon
crond -f -l 2