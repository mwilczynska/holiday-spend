#!/bin/sh
set -eu
# Run from the checkout on the deployment host. The backup directory must be writable by UID 1001.
BACKUP_NAME="$(date -u +%Y-%m-%dT%H-%M-%SZ)"
docker compose run --rm --no-deps backup --destination "/backups/$BACKUP_NAME"
# Configure off-host copying and retention on the deployment host. Never delete
# the last verified backup automatically.
