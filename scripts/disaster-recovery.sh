#!/bin/bash

# Skippy Trading Platform - Disaster Recovery Script
# This script performs a complete system restore from backup

set -e  # Exit on any error

# Configuration
BACKUP_DIR="${BACKUP_DIR:-./backups}"
RESTORE_DIR="${RESTORE_DIR:-./restore-temp}"
LOG_FILE="${LOG_FILE:-./dr-restore.log}"
SMOKE_TEST_TIMEOUT=60

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

error() {
    log "${RED}ERROR: $1${NC}"
    exit 1
}

success() {
    log "${GREEN}SUCCESS: $1${NC}"
}

warning() {
    log "${YELLOW}WARNING: $1${NC}"
}

# Help function
show_help() {
    cat << EOF
Skippy Trading Platform - Disaster Recovery Script

Usage: $0 [OPTIONS] BACKUP_FILE

OPTIONS:
    -h, --help              Show this help message
    -d, --backup-dir DIR    Backup directory (default: ./backups)
    -r, --restore-dir DIR   Temporary restore directory (default: ./restore-temp)
    -t, --test-only         Run smoke tests only (no restore)
    -v, --verbose           Verbose output
    --skip-deps             Skip dependency installation
    --skip-db               Skip database operations
    --skip-tests            Skip smoke tests

EXAMPLES:
    $0 skippy-backup-20250107.tar.gz
    $0 -v --backup-dir /opt/backups skippy-backup-latest.tar.gz
    $0 --test-only  # Run smoke tests on current system

EOF
}

# Parse command line arguments
BACKUP_FILE=""
SKIP_DEPS=false
SKIP_DB=false
SKIP_TESTS=false
TEST_ONLY=false
VERBOSE=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_help
            exit 0
            ;;
        -d|--backup-dir)
            BACKUP_DIR="$2"
            shift 2
            ;;
        -r|--restore-dir)
            RESTORE_DIR="$2"
            shift 2
            ;;
        -t|--test-only)
            TEST_ONLY=true
            shift
            ;;
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        --skip-deps)
            SKIP_DEPS=true
            shift
            ;;
        --skip-db)
            SKIP_DB=true
            shift
            ;;
        --skip-tests)
            SKIP_TESTS=true
            shift
            ;;
        -*)
            error "Unknown option: $1"
            ;;
        *)
            BACKUP_FILE="$1"
            shift
            ;;
    esac
done

# Function to check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."
    
    # Check required commands
    local required_commands=("node" "npm" "psql" "tar")
    for cmd in "${required_commands[@]}"; do
        if ! command -v "$cmd" &> /dev/null; then
            error "Required command not found: $cmd"
        fi
    done
    
    # Check environment variables
    if [[ -z "$DATABASE_URL" ]]; then
        error "DATABASE_URL environment variable not set"
    fi
    
    success "Prerequisites check passed"
}

# Function to extract backup
extract_backup() {
    local backup_path="$1"
    
    log "Extracting backup from $backup_path..."
    
    # Create restore directory
    mkdir -p "$RESTORE_DIR"
    
    # Extract backup
    if [[ ! -f "$backup_path" ]]; then
        error "Backup file not found: $backup_path"
    fi
    
    tar -xzf "$backup_path" -C "$RESTORE_DIR" || error "Failed to extract backup"
    
    success "Backup extracted to $RESTORE_DIR"
}

# Function to install dependencies
install_dependencies() {
    if [[ "$SKIP_DEPS" == true ]]; then
        warning "Skipping dependency installation"
        return
    fi
    
    log "Installing dependencies..."
    
    local package_json_path="$RESTORE_DIR/package.json"
    if [[ ! -f "$package_json_path" ]]; then
        error "package.json not found in backup"
    fi
    
    cd "$RESTORE_DIR"
    npm ci --silent || error "Failed to install dependencies"
    cd - > /dev/null
    
    success "Dependencies installed"
}

# Function to restore database
restore_database() {
    if [[ "$SKIP_DB" == true ]]; then
        warning "Skipping database operations"
        return
    fi
    
    log "Restoring database..."
    
    # Check if backup contains database schema
    local schema_path="$RESTORE_DIR/shared/schema.ts"
    if [[ ! -f "$schema_path" ]]; then
        error "Database schema not found in backup"
    fi
    
    # Apply migrations using Drizzle
    cd "$RESTORE_DIR"
    
    # Push schema to database
    npm run db:push || error "Failed to apply database migrations"
    
    # Seed minimal data if seed script exists
    if [[ -f "scripts/seed-minimal.js" ]]; then
        log "Seeding minimal data..."
        node scripts/seed-minimal.js || warning "Failed to seed minimal data"
    fi
    
    cd - > /dev/null
    
    success "Database restored"
}

# Function to start services
start_services() {
    log "Starting services..."
    
    cd "$RESTORE_DIR"
    
    # Build the application
    npm run build || error "Failed to build application"
    
    # Start the server in background
    npm run start &
    local server_pid=$!
    
    # Wait for server to start
    log "Waiting for server to start..."
    local retries=30
    while [[ $retries -gt 0 ]]; do
        if curl -s http://localhost:5000/api/ping > /dev/null 2>&1; then
            break
        fi
        sleep 2
        ((retries--))
    done
    
    if [[ $retries -eq 0 ]]; then
        kill $server_pid 2>/dev/null || true
        error "Server failed to start within timeout"
    fi
    
    cd - > /dev/null
    
    success "Services started (PID: $server_pid)"
    echo $server_pid > "$RESTORE_DIR/.server.pid"
}

# Function to run smoke tests
run_smoke_tests() {
    if [[ "$SKIP_TESTS" == true ]]; then
        warning "Skipping smoke tests"
        return
    fi
    
    log "Running smoke tests..."
    
    local base_url="http://localhost:5000"
    local test_results=()
    
    # Test 1: Health check
    log "Testing health endpoint..."
    if curl -s -f "$base_url/api/health" > /dev/null; then
        test_results+=("✓ Health check")
    else
        test_results+=("✗ Health check")
    fi
    
    # Test 2: Ping endpoint
    log "Testing ping endpoint..."
    if curl -s -f "$base_url/api/ping" > /dev/null; then
        test_results+=("✓ Ping endpoint")
    else
        test_results+=("✗ Ping endpoint")
    fi
    
    # Test 3: Market data endpoint
    log "Testing market data endpoint..."
    if curl -s -f "$base_url/api/market/data" > /dev/null; then
        test_results+=("✓ Market data")
    else
        test_results+=("✗ Market data")
    fi
    
    # Test 4: Database connectivity
    log "Testing database connectivity..."
    if curl -s -f "$base_url/api/health/db" > /dev/null; then
        test_results+=("✓ Database connectivity")
    else
        test_results+=("✗ Database connectivity")
    fi
    
    # Test 5: WebSocket connectivity
    log "Testing WebSocket connectivity..."
    if timeout 10 wscat -c "ws://localhost:5000/ws" --execute "ping" > /dev/null 2>&1; then
        test_results+=("✓ WebSocket connectivity")
    else
        test_results+=("✗ WebSocket connectivity")
    fi
    
    # Test 6: AI service availability
    log "Testing AI service..."
    if curl -s -f "$base_url/api/ai/status" > /dev/null; then
        test_results+=("✓ AI service")
    else
        test_results+=("✗ AI service")
    fi
    
    # Display results
    log "Smoke test results:"
    local failed_tests=0
    for result in "${test_results[@]}"; do
        if [[ $result == *"✗"* ]]; then
            ((failed_tests++))
            log "  ${RED}$result${NC}"
        else
            log "  ${GREEN}$result${NC}"
        fi
    done
    
    if [[ $failed_tests -gt 0 ]]; then
        error "Smoke tests failed: $failed_tests out of ${#test_results[@]} tests"
    else
        success "All smoke tests passed (${#test_results[@]} tests)"
    fi
}

# Function to cleanup
cleanup() {
    log "Cleaning up..."
    
    # Stop server if running
    if [[ -f "$RESTORE_DIR/.server.pid" ]]; then
        local server_pid=$(cat "$RESTORE_DIR/.server.pid")
        if kill -0 "$server_pid" 2>/dev/null; then
            kill "$server_pid"
            log "Server stopped (PID: $server_pid)"
        fi
        rm -f "$RESTORE_DIR/.server.pid"
    fi
    
    # Remove temporary restore directory
    if [[ "$RESTORE_DIR" != "." && "$RESTORE_DIR" != "/" ]]; then
        rm -rf "$RESTORE_DIR"
        log "Temporary restore directory removed"
    fi
}

# Main execution
main() {
    log "Starting Skippy disaster recovery process..."
    
    # Set trap for cleanup on exit
    trap cleanup EXIT
    
    check_prerequisites
    
    if [[ "$TEST_ONLY" == true ]]; then
        log "Running smoke tests only..."
        run_smoke_tests
        return 0
    fi
    
    if [[ -z "$BACKUP_FILE" ]]; then
        error "No backup file specified. Use -h for help."
    fi
    
    # Construct full backup path
    local backup_path="$BACKUP_DIR/$BACKUP_FILE"
    if [[ ! "$BACKUP_FILE" =~ ^/ ]]; then
        backup_path="$BACKUP_DIR/$BACKUP_FILE"
    else
        backup_path="$BACKUP_FILE"
    fi
    
    extract_backup "$backup_path"
    install_dependencies
    restore_database
    start_services
    run_smoke_tests
    
    success "Disaster recovery completed successfully!"
    
    log "System is now running. Access the application at: http://localhost:5000"
    log "To stop the system, run: kill \$(cat $RESTORE_DIR/.server.pid)"
}

# Run main function
main "$@"