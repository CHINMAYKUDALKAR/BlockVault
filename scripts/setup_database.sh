#!/bin/bash

# ============================================
# BlockVault Database Setup Script
# One-command database initialization
# ============================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

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

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo ""
log_info "==========================================="
log_info "  BlockVault Database Setup"
log_info "==========================================="
echo ""

# Check if .env exists
if [ ! -f "$PROJECT_ROOT/.env" ]; then
    log_warning ".env file not found"
    log_info "Creating .env from env.example..."
    
    if [ -f "$PROJECT_ROOT/env.example" ]; then
        cp "$PROJECT_ROOT/env.example" "$PROJECT_ROOT/.env"
        log_success ".env file created"
        log_warning "Please update .env with your configuration"
        log_warning "Then run this script again"
        exit 0
    else
        log_error "env.example not found"
        exit 1
    fi
fi

# Load environment variables
export $(cat "$PROJECT_ROOT/.env" | grep -v '^#' | xargs)

# Detect setup type
echo ""
log_info "Select setup type:"
echo "  1) Local MongoDB"
echo "  2) Docker Compose"
echo "  3) MongoDB Atlas (Cloud)"
echo ""
read -p "Choice [1-3]: " setup_choice

case $setup_choice in
    1)
        log_info "Setting up Local MongoDB..."
        
        # Check if MongoDB is installed
        if ! command -v mongod &> /dev/null; then
            log_error "MongoDB is not installed"
            log_info "Install instructions:"
            log_info "  macOS: brew install mongodb-community"
            log_info "  Ubuntu: sudo apt-get install mongodb-org"
            exit 1
        fi
        
        # Check if MongoDB is running
        if ! pgrep -x "mongod" > /dev/null; then
            log_warning "MongoDB is not running"
            log_info "Starting MongoDB..."
            
            if [[ "$OSTYPE" == "darwin"* ]]; then
                brew services start mongodb-community
            else
                sudo systemctl start mongod
            fi
            
            sleep 3
        fi
        
        MONGO_URI="${MONGO_URI:-mongodb://localhost:27017/blockvault}"
        ;;
        
    2)
        log_info "Setting up Docker Compose..."
        
        # Check if Docker is installed
        if ! command -v docker &> /dev/null; then
            log_error "Docker is not installed"
            log_info "Install from: https://www.docker.com/get-started"
            exit 1
        fi
        
        # Start Docker Compose
        log_info "Starting MongoDB container..."
        cd "$PROJECT_ROOT"
        docker-compose up -d mongo
        
        log_info "Waiting for MongoDB to be ready..."
        sleep 10
        
        MONGO_URI="mongodb://localhost:27017/blockvault"
        ;;
        
    3)
        log_info "Setting up MongoDB Atlas..."
        log_info "Please enter your Atlas connection string:"
        log_info "Example: mongodb+srv://user:password@cluster.mongodb.net/blockvault"
        echo ""
        read -p "Connection string: " MONGO_URI
        
        if [ -z "$MONGO_URI" ]; then
            log_error "Connection string cannot be empty"
            exit 1
        fi
        ;;
        
    *)
        log_error "Invalid choice"
        exit 1
        ;;
esac

# Initialize database
log_info "Initializing database..."
echo ""

cd "$PROJECT_ROOT"

if ! command -v python3 &> /dev/null; then
    log_error "Python 3 is not installed"
    exit 1
fi

# Run initialization script
python3 blockvault/core/db_init.py "$MONGO_URI"

if [ $? -eq 0 ]; then
    log_success "Database initialized successfully!"
    echo ""
    
    # Show health check
    log_info "Running health check..."
    python3 blockvault/core/db_init.py "$MONGO_URI" --health
    echo ""
    
    # Show statistics
    log_info "Database statistics:"
    python3 blockvault/core/db_init.py "$MONGO_URI" --stats
    echo ""
    
    log_success "Setup complete!"
    log_info "Your database is ready to use"
    log_info "Connection: $MONGO_URI"
    echo ""
    
    # Create backup directory
    mkdir -p "$PROJECT_ROOT/backups"
    log_info "Backup directory created: $PROJECT_ROOT/backups"
    
    # Show next steps
    echo ""
    log_info "Next steps:"
    echo "  1. Start the backend: python app.py"
    echo "  2. Create a backup: ./scripts/db_backup.sh"
    echo "  3. Check DATABASE_SETUP_GUIDE.md for more info"
    echo ""
else
    log_error "Database initialization failed"
    exit 1
fi







