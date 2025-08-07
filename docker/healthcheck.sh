#!/bin/sh
# Health check script for Skippy Trading Platform Docker container

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Health check configuration
HEALTH_URL="http://localhost:5000/api/health"
TIMEOUT=10
MAX_RETRIES=3

log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" >&2
}

# Function to perform HTTP health check
check_health() {
    local url="$1"
    local timeout="$2"
    
    response=$(curl -s -f -m "$timeout" "$url" 2>/dev/null) || return 1
    
    # Parse JSON response and check status
    status=$(echo "$response" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
    
    if [ "$status" = "healthy" ]; then
        return 0
    else
        return 1
    fi
}

# Function to check if the application port is listening
check_port() {
    local port="${PORT:-5000}"
    
    if command -v netstat >/dev/null 2>&1; then
        netstat -ln | grep -q ":$port " || return 1
    elif command -v ss >/dev/null 2>&1; then
        ss -ln | grep -q ":$port " || return 1
    else
        # Fallback: try to connect to the port
        nc -z localhost "$port" 2>/dev/null || return 1
    fi
    
    return 0
}

# Function to check database connectivity (if applicable)
check_database() {
    if [ -n "$DATABASE_URL" ] && command -v pg_isready >/dev/null 2>&1; then
        # Extract database details from URL
        if echo "$DATABASE_URL" | grep -q "postgresql://"; then
            host=$(echo "$DATABASE_URL" | sed -n 's/.*@\([^:]*\).*/\1/p')
            port=$(echo "$DATABASE_URL" | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
            
            if [ -n "$host" ] && [ -n "$port" ]; then
                pg_isready -h "$host" -p "$port" -q || return 1
            fi
        fi
    fi
    
    return 0
}

# Main health check function
perform_health_check() {
    local retry_count=0
    
    while [ $retry_count -lt $MAX_RETRIES ]; do
        # Check if port is listening
        if ! check_port; then
            log "${RED}Port check failed - application may not be running${NC}"
            return 1
        fi
        
        # Check HTTP health endpoint
        if check_health "$HEALTH_URL" "$TIMEOUT"; then
            # Additional checks
            if check_database; then
                log "${GREEN}Health check passed${NC}"
                return 0
            else
                log "${YELLOW}Application healthy but database connectivity issues${NC}"
                return 1
            fi
        else
            retry_count=$((retry_count + 1))
            if [ $retry_count -lt $MAX_RETRIES ]; then
                log "${YELLOW}Health check failed, retrying... ($retry_count/$MAX_RETRIES)${NC}"
                sleep 2
            fi
        fi
    done
    
    log "${RED}Health check failed after $MAX_RETRIES attempts${NC}"
    return 1
}

# Execute health check
perform_health_check
exit $?