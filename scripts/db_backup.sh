#!/bin/bash

# ============================================
# BlockVault MongoDB Backup Script
# ============================================

set -e  # Exit on error

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="${BACKUP_DIR:-$PROJECT_ROOT/backups}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
DB_NAME="${MONGO_DATABASE:-blockvault}"

# Load environment variables if .env exists
if [ -f "$PROJECT_ROOT/.env" ]; then
    export $(cat "$PROJECT_ROOT/.env" | grep -v '^#' | xargs)
fi

# MongoDB connection (fallback to local)
MONGO_URI="${MONGO_URI:-mongodb://localhost:27017}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Create backup directory
create_backup_dir() {
    if [ ! -d "$BACKUP_DIR" ]; then
        mkdir -p "$BACKUP_DIR"
        log_info "Created backup directory: $BACKUP_DIR"
    fi
}

# Backup using mongodump
backup_database() {
    local backup_path="$BACKUP_DIR/backup_${TIMESTAMP}"
    
    log_info "Starting backup of database: $DB_NAME"
    log_info "Backup location: $backup_path"
    
    if command -v mongodump &> /dev/null; then
        mongodump --uri="$MONGO_URI/$DB_NAME" --out="$backup_path" --gzip
        
        if [ $? -eq 0 ]; then
            log_success "Database backup completed successfully"
            
            # Create compressed archive
            cd "$BACKUP_DIR"
            tar -czf "backup_${TIMESTAMP}.tar.gz" "backup_${TIMESTAMP}"
            rm -rf "backup_${TIMESTAMP}"
            
            log_success "Backup compressed: backup_${TIMESTAMP}.tar.gz"
            log_info "Backup size: $(du -h "backup_${TIMESTAMP}.tar.gz" | cut -f1)"
            
            return 0
        else
            log_error "Backup failed"
            return 1
        fi
    else
        log_error "mongodump not found. Please install MongoDB Database Tools"
        log_info "Install: https://www.mongodb.com/docs/database-tools/installation/"
        return 1
    fi
}

# Backup storage directory
backup_storage() {
    local storage_path="$PROJECT_ROOT/storage"
    local backup_path="$BACKUP_DIR/storage_${TIMESTAMP}.tar.gz"
    
    if [ -d "$storage_path" ]; then
        log_info "Backing up storage directory..."
        tar -czf "$backup_path" -C "$PROJECT_ROOT" storage
        log_success "Storage backup completed: storage_${TIMESTAMP}.tar.gz"
        log_info "Storage size: $(du -h "$backup_path" | cut -f1)"
    else
        log_warning "Storage directory not found, skipping..."
    fi
}

# Clean old backups (keep last 30 days)
cleanup_old_backups() {
    local retention_days="${BACKUP_RETENTION_DAYS:-30}"
    
    log_info "Cleaning up backups older than $retention_days days..."
    
    find "$BACKUP_DIR" -name "backup_*.tar.gz" -type f -mtime +$retention_days -delete
    find "$BACKUP_DIR" -name "storage_*.tar.gz" -type f -mtime +$retention_days -delete
    
    log_success "Old backups cleaned up"
}

# List recent backups
list_backups() {
    log_info "Recent backups:"
    echo ""
    ls -lh "$BACKUP_DIR" | grep "backup_" | tail -10
    echo ""
}

# Main execution
main() {
    echo ""
    log_info "========================================="
    log_info "  BlockVault Database Backup"
    log_info "========================================="
    echo ""
    
    create_backup_dir
    
    # Backup database
    if backup_database; then
        # Backup storage
        backup_storage
        
        # Cleanup old backups
        cleanup_old_backups
        
        # Show recent backups
        list_backups
        
        log_success "Backup process completed successfully!"
        echo ""
        exit 0
    else
        log_error "Backup process failed"
        echo ""
        exit 1
    fi
}

# Run main function
main "$@"







