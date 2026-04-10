#!/bin/bash
# Daily SQLite backup script
# Add to crontab: 0 3 * * * /path/to/backup.sh

BACKUP_DIR="/app/backups"
DB_PATH="/app/data/travel.db"
DATE=$(date +%Y-%m-%d_%H%M%S)

mkdir -p "$BACKUP_DIR"

# Use SQLite's .backup command for safe copy
sqlite3 "$DB_PATH" ".backup '$BACKUP_DIR/travel-$DATE.db'"

# Keep only last 7 days of backups
find "$BACKUP_DIR" -name "travel-*.db" -mtime +7 -delete

echo "Backup complete: travel-$DATE.db"
