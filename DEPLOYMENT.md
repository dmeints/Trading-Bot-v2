# Skippy Trading Platform - Deployment Guide

## 🚀 Production Deployment Guide

### Prerequisites
- Node.js 18+ with npm/yarn
- PostgreSQL 14+ database
- OpenAI API key (for AI Copilot)
- Replit OIDC credentials

### Environment Configuration

#### Required Environment Variables
```bash
# Database
DATABASE_URL="postgresql://user:password@host:port/database"

# Authentication
REPLIT_CLIENT_ID="your_replit_client_id"
REPLIT_CLIENT_SECRET="your_replit_client_secret"
SESSION_SECRET="secure_random_session_secret"

# AI Services
OPENAI_API_KEY="sk-your_openai_api_key"
AI_SERVICES_ENABLED="true"

# Application
NODE_ENV="production"
PORT="5000"
ALLOWED_ORIGINS="https://yourdomain.com"

# Security
RATE_LIMIT_WINDOW_MS="900000"
RATE_LIMIT_MAX_REQUESTS="100"
```

#### Optional Environment Variables
```bash
# Feature Flags
FEATURE_TRADING="true"
FEATURE_BACKTEST="true"
FEATURE_AI_COPILOT="true"
FEATURE_REVOLUTIONARY_AI="true"

# Monitoring
PROMETHEUS_METRICS_ENABLED="true"
ALERT_WEBHOOK_URL="https://your-slack-webhook"

# Development
DEBUG_MODE="false"
LOG_LEVEL="info"
```

## 📋 Pre-Deployment Checklist

### Database Setup
- [ ] PostgreSQL database created and accessible
- [ ] Database migrations applied: `npm run db:push`
- [ ] Connection pool configured for production load
- [ ] Database backups scheduled

### Security Configuration
- [ ] HTTPS certificates configured
- [ ] CORS origins set to production domains
- [ ] Rate limiting configured appropriately
- [ ] Session secrets are cryptographically secure
- [ ] API keys stored securely (not in code)

### Performance Optimization
- [ ] Database indexes optimized for queries
- [ ] Response caching configured
- [ ] WebSocket connection limits set
- [ ] Memory limits configured

### Monitoring Setup
- [ ] Health check endpoints functional: `/api/health`
- [ ] Prometheus metrics endpoint accessible: `/api/metrics/prometheus`
- [ ] Alert rules configured for critical metrics
- [ ] Log aggregation configured

## 🛠️ Deployment Steps

### 1. Code Deployment
```bash
# Clone the repository
git clone https://github.com/your-org/skippy-trading-platform.git
cd skippy-trading-platform

# Install dependencies
npm ci --production

# Build the application
npm run build

# Run database migrations
npm run db:push
```

### 2. Environment Setup
```bash
# Copy environment template
cp .env.example .env

# Edit environment variables
nano .env

# Validate configuration
npm run audit
```

### 3. Service Configuration
```bash
# Create systemd service (Linux)
sudo nano /etc/systemd/system/skippy.service

# Enable and start service
sudo systemctl enable skippy
sudo systemctl start skippy

# Check service status
sudo systemctl status skippy
```

#### Example systemd Service File
```ini
[Unit]
Description=Skippy Trading Platform
After=network.target postgresql.service

[Service]
Type=simple
User=skippy
WorkingDirectory=/opt/skippy
ExecStart=/usr/bin/node dist/server/index.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
EnvironmentFile=/opt/skippy/.env

[Install]
WantedBy=multi-user.target
```

### 4. Reverse Proxy Configuration

#### Nginx Configuration
```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com;
    
    ssl_certificate /path/to/certificate.crt;
    ssl_certificate_key /path/to/private.key;
    
    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
    
    # WebSocket support
    location /ws {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

## 📊 Production Monitoring

### Health Checks
The application provides comprehensive health check endpoints:

```bash
# Basic health check
curl https://your-domain.com/api/health

# Database health
curl https://your-domain.com/api/health/db

# AI services health
curl https://your-domain.com/api/health/ai

# Trading engine health
curl https://your-domain.com/api/health/trading
```

### Prometheus Metrics
Access system metrics for monitoring:

```bash
# Get Prometheus-format metrics
curl https://your-domain.com/api/metrics/prometheus

# Key metrics include:
# - skippy_requests_total
# - skippy_request_duration_ms
# - skippy_trades_total
# - skippy_ai_confidence
# - skippy_system_uptime_seconds
```

### Alerting Rules
Configure alerts for critical metrics:

```yaml
# Example Prometheus alert rules
groups:
  - name: skippy_alerts
    rules:
      - alert: SkippyHighErrorRate
        expr: skippy_system_error_rate > 0.05
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High error rate detected"
          
      - alert: SkippyLowAIConfidence
        expr: skippy_ai_confidence < 0.4
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "AI confidence below threshold"
```

## 🔧 CLI Management

### Production Management Commands
```bash
# System audit and health check
skippy audit

# Get system metrics
skippy metrics --range 24h

# Check feature flag status
skippy flags list

# Get trading recommendations
skippy trading recommendations

# Query AI copilot
skippy ai ask "What's the system performance today?"

# Generate daily summary
skippy summarize --format csv --since yesterday
```

### Nightly Jobs Management
```bash
# The system automatically runs nightly jobs:
# - 1 AM: AI Performance Analysis
# - 2 AM: Backtest Sweeps
# - 3 AM: Market Health Reports
# - 4 AM: System Analytics Summary
# - 5 AM: Database Cleanup
# - 6 AM Sunday: Weekly Deep Analysis
```

## 🛡️ Security Best Practices

### Application Security
- [ ] Regular dependency updates with `npm audit`
- [ ] Environment variables never committed to code
- [ ] Secure session configuration with HttpOnly cookies
- [ ] CSRF protection enabled
- [ ] Rate limiting configured per endpoint type

### Infrastructure Security
- [ ] Firewall configured to allow only necessary ports
- [ ] Database access restricted to application servers
- [ ] SSL/TLS certificates auto-renewal configured
- [ ] Log files protected and regularly rotated
- [ ] Backup encryption configured

### API Security
- [ ] Authentication required for all sensitive endpoints
- [ ] Admin endpoints protected with additional authorization
- [ ] Request validation with Zod schemas
- [ ] Response sanitization to prevent data leaks

## 📈 Scaling Considerations

### Horizontal Scaling
```bash
# The application supports horizontal scaling:
# - Stateless architecture with PostgreSQL session storage
# - WebSocket clustering with Redis adapter (if needed)
# - Database connection pooling
# - Load balancer session affinity not required
```

### Performance Optimization
- **Database**: Connection pooling, query optimization, read replicas
- **Caching**: Redis for session storage and response caching
- **CDN**: Static assets served via CDN
- **Monitoring**: APM tools for performance tracking

### Resource Requirements

#### Minimum Production Requirements
- **CPU**: 2 vCPUs
- **RAM**: 4 GB
- **Storage**: 50 GB SSD
- **Network**: 1 Gbps

#### Recommended Production Configuration
- **CPU**: 4 vCPUs
- **RAM**: 8 GB  
- **Storage**: 100 GB SSD
- **Network**: 10 Gbps
- **Database**: Dedicated PostgreSQL instance

## 🔄 Backup & Recovery

### Database Backup
```bash
# Daily automated backups
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql

# Point-in-time recovery setup
# Configure WAL-E or similar for continuous backup
```

### Application Backup
```bash
# Configuration backup
tar -czf config_backup_$(date +%Y%m%d).tar.gz .env logs/

# Full application backup
tar -czf app_backup_$(date +%Y%m%d).tar.gz --exclude node_modules .
```

### Disaster Recovery
- **RTO (Recovery Time Objective)**: < 15 minutes
- **RPO (Recovery Point Objective)**: < 5 minutes
- **Automated failover**: Configure with monitoring alerts
- **Data replication**: Cross-region database replication

## 🎯 Production Validation

### Smoke Tests
```bash
# Automated deployment validation
curl -f https://your-domain.com/api/health || exit 1
curl -f https://your-domain.com/api/health/db || exit 1
curl -f https://your-domain.com/api/health/ai || exit 1

# Feature validation
skippy audit
skippy metrics --range 1h
```

### Performance Validation
- [ ] API response times < 500ms under load
- [ ] WebSocket connections stable under 1000+ concurrent users
- [ ] Database query performance optimized
- [ ] Memory usage stable over 24 hours

### Security Validation
- [ ] SSL/TLS configuration scored A+ on SSL Labs
- [ ] No exposed sensitive endpoints
- [ ] Rate limiting functional
- [ ] Authentication/authorization working correctly

---

**Deployment Status**: Ready for Production  
**Last Updated**: August 6, 2025  
**Next Review**: Post-deployment performance analysis