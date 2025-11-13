#!/bin/bash

# ============================================
# BlockVault MongoDB Restore Script
# ============================================

set -e  # Exit on error

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="${BACKUP_DIR:-$PROJECT_ROOT/backups}"
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

# List available backups
list_available_backups() {
    log_info "Available backups:"
    echo ""
    ls -lht "$BACKUP_DIR"/backup_*.tar.gz 2>/dev/null | head -20 || {
        log_warning "No backups found in $BACKUP_DIR"
        return 1
    }
    echo ""
}

# Select backup to restore
select_backup() {
    if [ -z "$1" ]; then
        log_info "Please specify a backup file:"
        log_info "Usage: $0 <backup_file.tar.gz>"
        echo ""
        list_available_backups
        exit 1
    fi
    
    local backup_file="$1"
    
    # If only filename provided, assume it's in BACKUP_DIR
    if [ ! -f "$backup_file" ]; then
        backup_file="$BACKUP_DIR/$backup_file"
    fi
    
    if [ ! -f "$backup_file" ]; then
        log_error "Backup file not found: $backup_file"
        exit 1
    fi
    
    echo "$backup_file"
}

# Confirm restore operation
confirm_restore() {
    log_warning "⚠️  WARNING: This will overwrite the current database!"
    log_warning "Database: $DB_NAME"
    log_warning "Backup: $1"
    echo ""
    read -p "Are you sure you want to continue? (yes/no): " confirm
    
    if [ "$confirm" != "yes" ]; then
        log_info "Restore cancelled"
        exit 0
    fi
}

# Restore database from backup
restore_database() {
    local backup_file="$1"
    local temp_dir="$BACKUP_DIR/temp_restore_$$"
    
    log_info "Extracting backup..."
    mkdir -p "$temp_dir"
    tar -xzf "$backup_file" -C "$temp_dir"
    
    # Find the backup directory
    local backup_dir=$(find "$temp_dir" -type d -name "backup_*" | head -1)
    
    if [ -z "$backup_dir" ]; then
        log_error "Could not find backup data in archive"
        rm -rf "$temp_dir"
        exit 1
    fi
    
    log_info "Restoring database: $DB_NAME"
    
    if command -v mongorestore &> /dev/null; then
        mongorestore --uri="$MONGO_URI" \
                     --db="$DB_NAME" \
                     --gzip \
                     --drop \
                     "$backup_dir/$DB_NAME"
        
        if [ $? -eq 0 ]; then
            log_success "Database restore completed successfully"
            
            # Cleanup
            rm -rf "$temp_dir"
            return 0
        else
            log_error "Restore failed"
            rm -rf "$temp_dir"
            return 1
        fi
    else
        log_error "mongorestore not found. Please install MongoDB Database Tools"
        log_info "Install: https://www.mongodb.com/docs/database-tools/installation/"
        rm -rf "$temp_dir"
        return 1
    fi
}

# Restore storage directory
restore_storage() {
    local storage_backup="$1"
    local storage_path="$PROJECT_ROOT/storage"
    
    if [ -f "$storage_backup" ]; then
        log_warning "Found storage backup. Restore storage too? (yes/no)"
        read -p "> " restore_storage_confirm
        
        if [ "$restore_storage_confirm" == "yes" ]; then
            log_info "Backing up current storage..."
            if [ -d "$storage_path" ]; then
                mv "$storage_path" "${storage_path}.backup.$(date +%s)"
            fi
            
            log_info "Restoring storage..."
            tar -xzf "$storage_backup" -C "$PROJECT_ROOT"
            log_success "Storage restored successfully"
        fi
    fi
}

# Verify restore
verify_restore() {
    log_info "Verifying restore..."
    
    # Test connection and count documents
    if command -v mongosh &> /dev/null; then
        mongosh "$MONGO_URI/$DB_NAME" --quiet --eval "
            print('Collections:');
            db.getCollectionNames().forEach(function(coll) {
                print('  ' + coll + ': ' + db[coll].countDocuments({}) + ' documents');
            });
        "
    elif command -v mongo &> /dev/null; then
        mongo "$MONGO_URI/$DB_NAME" --quiet --eval "
            print('Collections:');
            db.getCollectionNames().forEach(function(coll) {
                print('  ' + coll + ': ' + db[coll].count() + ' documents');
            });
        "
    else
        log_warning "mongo/mongosh not found. Skipping verification."
    fi
}

# Main execution
main() {
    echo ""
    log_info "========================================="
    log_info "  BlockVault Database Restore"
    log_info "========================================="
    echo ""
    
    if [ "$1" == "--list" ]; then
        list_available_backups
        exit 0
    fi
    
    # Select backup file
    backup_file=$(select_backup "$1")
    
    # Confirm operation
    confirm_restore "$backup_file"
    
    # Extract timestamp from backup filename
    timestamp=$(basename "$backup_file" | sed 's/backup_\(.*\)\.tar\.gz/\1/')
    storage_backup="$BACKUP_DIR/storage_${timestamp}.tar.gz"
    
    # Restore database
    if restore_database "$backup_file"; then
        # Restore storage if available
        restore_storage "$storage_backup"
        
        # Verify restore
        verify_restore
        
        log_success "Restore process completed successfully!"
        echo ""
        exit 0
    else
        log_error "Restore process failed"
        echo ""
        exit 1
    fi
}

# Run main function
main "$@"







