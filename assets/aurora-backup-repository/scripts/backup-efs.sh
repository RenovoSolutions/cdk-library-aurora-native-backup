#!/bin/bash
set -euo pipefail

LOG_PREFIX="[AURORA-BACKUP-EFS]"

# Required environment variables
: "${DB_HOST:?DB_HOST required}"
: "${DB_NAMES:?DB_NAMES required}"
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
BACKUP_FAILED=0

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
    log_error "AWS credential validation failed"; return 1; }
}

perform_backup() {
  if [[ -e "${TARGET_DIR}" ]]; then
    log_error "Target backup directory ${TARGET_DIR} already exists"
    return 1
  fi
  cleanup_work_dir
  mkdir -p "$WORK_DIR" && chmod 750 "$WORK_DIR"
  
  # Parse database names from JSON array
  local db_names_array
  if ! db_names_array=$(echo "$DB_NAMES" | jq -r '.[]' 2>/dev/null); then
    log_error "Failed to parse DB_NAMES JSON array: $DB_NAMES"
    return 1
  fi
  
  # Backup each database - continue on individual failures
  local successful_backups=0
  while IFS= read -r db_name; do
    [[ -z "$db_name" ]] && continue
    local db_backup_dir="${WORK_DIR}/${db_name}"
    mkdir -p "$db_backup_dir" && chmod 750 "$db_backup_dir"
    
    log "pg_dump: $DB_HOST:$DB_PORT/$db_name -> $db_backup_dir"
    if ! PGPASSWORD="$DB_PASSWORD" pg_dump \
      "host=$DB_HOST port=$DB_PORT user=$DB_USER dbname=$db_name sslmode=require" \
      --format=directory --file="$db_backup_dir" --compress=9 --clean --if-exists --verbose --no-password; then
      log_error "pg_dump failed for database: $db_name (continuing with remaining databases)"
      BACKUP_FAILED=1
      rm -rf "$db_backup_dir"
      continue
    fi
    
    # Verify backup has content for this database
    if [[ ! -f "${db_backup_dir}/toc.dat" ]]; then
      log_error "Backup validation failed for $db_name: missing toc.dat file (continuing with remaining databases)"
      BACKUP_FAILED=1
      rm -rf "$db_backup_dir"
      continue
    fi
    
    log "Database backup completed: $db_name"
    ((successful_backups++))
  done <<< "$db_names_array"

  # Verify at least one database was backed up successfully
  if [[ $successful_backups -eq 0 ]]; then
    log_error "Backup failed: no databases were backed up successfully"
    cleanup_work_dir
    return 1
  fi

  mv "${WORK_DIR}" "${TARGET_DIR}"
  log "Backup directory finalized at ${TARGET_DIR} (${successful_backups} database(s) backed up successfully)"

  # Log backup size efficiently
  if backup_size=$(du -sh "${TARGET_DIR}" 2>/dev/null | cut -f1); then
    log "Backup size: ${backup_size}"
  fi
}

sync_to_s3() {
  local backup_dir="$1"
  if [[ -z "${S3_BUCKET:-}" ]]; then
    log_error "S3_BUCKET is required for backup. Aborting."
    return 1
  fi
  
  # Sync each database directory separately to maintain proper S3 structure
  local successful_syncs=0
  local total_dbs=0
  for db_backup_dir in "$backup_dir"/*/; do
    [[ -d "$db_backup_dir" ]] || continue
    ((total_dbs++))
    local db_name="${db_backup_dir%/}"
    db_name="${db_name##*/}"
    
    local s3_path="s3://${S3_BUCKET}/${S3_PREFIX:-backups}/${CLUSTER_IDENTIFIER}/${db_name}/${backup_dir##*/}/"
    log "Syncing database $db_name to $s3_path"
    
    if aws s3 sync "$db_backup_dir" "$s3_path" --region "$AWS_REGION"; then
      log "S3 sync done for $db_name: $s3_path"
      ((successful_syncs++))
    else
      log_error "S3 sync failed for database: $db_name (continuing with remaining databases)"
      BACKUP_FAILED=1
    fi
  done
  
  if [[ $successful_syncs -eq 0 ]] && [[ $total_dbs -gt 0 ]]; then
    log_error "All S3 syncs failed"
    return 1
  fi
  
  log "S3 sync completed: ${successful_syncs}/${total_dbs} database(s) synced successfully"
  
  # Remove local backup directory after sync attempts
  rm -rf "$backup_dir" && log "Removed local backup dir"
}

main() {
  log "=== Aurora Backup Started ($TIMESTAMP) ==="
  ensure_backup_root
  check_aws_identity || BACKUP_FAILED=1
  
  # Only attempt backup if AWS credentials are valid
  if [[ $BACKUP_FAILED -eq 0 ]]; then
    perform_backup || BACKUP_FAILED=1
  fi
  
  # Sync to S3 if any backups were successful (TARGET_DIR exists)
  if [[ -d "$TARGET_DIR" ]]; then
    sync_to_s3 "$TARGET_DIR" || BACKUP_FAILED=1
  fi
  
  if [[ $BACKUP_FAILED -eq 1 ]]; then
    log "=== Aurora Backup Finished with ERRORS ==="
    exit 1
  else
    log "=== Aurora Backup Finished Successfully ==="
    exit 0
  fi
}

trap cleanup_work_dir EXIT
main "$@"
