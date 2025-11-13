#!/bin/bash

# ===============================================
# BlockVault Startup Script - New Frontend (Vite)
# Starts Backend (Flask) and New Frontend (Vite)
# ===============================================

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_DIR="$SCRIPT_DIR"
FRONTEND_DIR="$PROJECT_DIR/blockvault-frontend-new"
VENV_DIR="$PROJECT_DIR/venv"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

print_info() { echo -e "${CYAN}ℹ️  $1${NC}"; }
print_success() { echo -e "${GREEN}✅ $1${NC}"; }
print_error() { echo -e "${RED}❌ $1${NC}"; }
print_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }

print_header() {
    echo -e "${BLUE}"
    echo "╔════════════════════════════════════════════════════════╗"
    echo "║         🔐 BlockVault v2.0 Startup 🔐                 ║"
    echo "║    Modern Vite Frontend + Flask Backend              ║"
    echo "╚════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

cleanup() {
    echo ""
    print_info "Shutting down services..."
    if [ -n "$(jobs -p)" ]; then
        print_info "Stopping background jobs..."
        kill $(jobs -p) 2>/dev/null
        sleep 2
        kill -9 $(jobs -p) 2>/dev/null
    fi
    print_success "All services stopped"
}

trap cleanup SIGINT SIGTERM

check_port() {
    lsof -Pi :$1 -sTCP:LISTEN -t >/dev/null 2>&1
}

free_port() {
    local port=$1
    print_warning "Port $port is in use. Freeing it..."
    lsof -ti:$port | xargs kill -9 2>/dev/null
    sleep 1
}

print_header

# Check and free ports
print_info "Checking ports..."
check_port 5000 && free_port 5000
check_port 3000 && free_port 3000
print_success "Ports 3000 and 5000 are free"

# Start Backend
print_info "Starting Flask Backend..."
cd "$PROJECT_DIR"
source "$VENV_DIR/bin/activate"
FLASK_ENV=development python app.py > backend.log 2>&1 &
BACKEND_PID=$!
print_info "Backend PID: $BACKEND_PID"
sleep 3

# Start Frontend
print_info "Starting Vite Frontend (New)..."
cd "$FRONTEND_DIR"
npm run dev > frontend.log 2>&1 &
FRONTEND_PID=$!
print_info "Frontend PID: $FRONTEND_PID"
sleep 5

# Open browser
if command -v open &> /dev/null; then
    print_info "Opening browser..."
    open http://localhost:3000
fi

echo ""
echo -e "${GREEN}"
echo "╔════════════════════════════════════════════════════════╗"
echo "║        🎉 BlockVault v2.0 Started Successfully! 🎉    ║"
echo "╚════════════════════════════════════════════════════════╝"
echo -e "${NC}"
echo ""
echo -e "${CYAN}📱 Frontend (Vite):${NC}  http://localhost:3000"
echo -e "${CYAN}🔧 Backend (Flask):${NC}  http://localhost:5000"
echo ""
echo -e "${YELLOW}📊 Process Information:${NC}"
echo "   Backend PID:  $BACKEND_PID"
echo "   Frontend PID: $FRONTEND_PID"
echo ""
echo -e "${YELLOW}📋 Log Files:${NC}"
echo "   Backend:  $PROJECT_DIR/backend.log"
echo "   Frontend: $FRONTEND_DIR/frontend.log"
echo ""
echo -e "${GREEN}✨ New features: Vite build, modern UI, better performance!${NC}"
echo ""
echo -e "${RED}Press Ctrl+C to stop all services${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

wait







