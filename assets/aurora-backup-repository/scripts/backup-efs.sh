
#!/bin/bash
set -euo pipefail

LOG_PREFIX="[AURORA-BACKUP-EFS]"

# Required environment variables
: "${DB_HOST:?DB_HOST required}"
: "${DB_NAME:?DB_NAME required}"
: "${DB_USER:?DB_USER required}"
: "${DB_PASSWORD:?DB_PASSWORD required}"
: "${AWS_REGION:?AWS_REGION required}"
: "${CLUSTER_IDENTIFIER:?CLUSTER_IDENTIFIER required}"

DB_PORT="${DB_PORT:-5432}"
BACKUP_ROOT="${BACKUP_ROOT:-/mnt/aurora-backups}"
TIMESTAMP="$(date '+%Y%m%d_%H%M%S')"
BACKUP_BASENAME="$(date '+%Y-%m-%d')"
TARGET_DIR="${BACKUP_ROOT%/}/${BACKUP_BASENAME}"
WORK_DIR="${TARGET_DIR}.inprogress"

cleanup_work_dir() {
  if [[ -d "${WORK_DIR}" ]]; then
    rm -rf "${WORK_DIR}"
  fi
}

log() {
  echo "$(date '+%Y-%m-%d %H:%M:%S') ${LOG_PREFIX} $*" >&2
}

log_error() {
  echo "$(date '+%Y-%m-%d %H:%M:%S') ${LOG_PREFIX} ERROR: $*" >&2
}

ensure_backup_root() {
  mkdir -p "$BACKUP_ROOT"
  chmod 750 "$BACKUP_ROOT"
}

check_aws_identity() {
  log "Validating AWS credentials"
  aws sts get-caller-identity --region "$AWS_REGION" --output text --query 'Arn' >/dev/null 2>&1 || {
    log_error "AWS credential validation failed"; exit 1; }
}

perform_backup() {
  if [[ -e "${TARGET_DIR}" ]]; then
    log_error "Target backup directory ${TARGET_DIR} already exists"
    exit 1
  fi
  cleanup_work_dir
  mkdir -p "$WORK_DIR" && chmod 750 "$WORK_DIR"
  log "pg_dump: $DB_HOST:$DB_PORT/$DB_NAME -> $WORK_DIR"
  if ! PGPASSWORD="$DB_PASSWORD" pg_dump \
    "host=$DB_HOST port=$DB_PORT user=$DB_USER dbname=$DB_NAME sslmode=require" \
    --format=directory --file="$WORK_DIR" --compress=9 --clean --if-exists --verbose --no-password; then
    log_error "pg_dump failed"; cleanup_work_dir; exit 1;
  fi

  # Verify backup has content before finalizing
  if [[ ! -f "${WORK_DIR}/toc.dat" ]]; then
    log_error "Backup validation failed: missing toc.dat file"
    cleanup_work_dir
    exit 1
  fi

  mv "${WORK_DIR}" "${TARGET_DIR}"
  log "Backup directory finalized at ${TARGET_DIR}"

  # Log backup size efficiently
  if backup_size=$(du -sh "${TARGET_DIR}" 2>/dev/null | cut -f1); then
    log "Backup size: ${backup_size}"
  fi
}

sync_to_s3() {
  local backup_dir="$1"
  if [[ -z "${S3_BUCKET:-}" ]]; then
    log_error "S3_BUCKET is required for backup. Aborting."
    exit 1
  fi
  local s3_path="s3://${S3_BUCKET}/${S3_PREFIX:-backups}/${CLUSTER_IDENTIFIER}/${backup_dir##*/}/"
  log "Syncing to $s3_path"
  if aws s3 sync "$backup_dir/" "$s3_path" --region "$AWS_REGION"; then
    log "S3 sync done: $s3_path"
    rm -rf "$backup_dir" && log "Removed local backup dir"
  else
    log_error "S3 sync failed"; return 1;
  fi
}

main() {
  log "=== Aurora Backup Started ($TIMESTAMP) ==="
  ensure_backup_root
  check_aws_identity
  perform_backup
  sync_to_s3 "$TARGET_DIR"
  log "=== Aurora Backup Finished ==="
}

trap cleanup_work_dir EXIT
main "$@"
