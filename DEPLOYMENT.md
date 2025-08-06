# Skippy Trading Platform - Deployment Guide

## Overview

This guide covers the complete deployment process for the Skippy Trading Platform, from development to production. The platform is designed for deployment on Replit with support for traditional cloud environments.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Setup](#environment-setup)
3. [Database Migration](#database-migration)
4. [Build and Test](#build-and-test)
5. [Production Deployment](#production-deployment)
6. [Monitoring and Observability](#monitoring-and-observability)
7. [Security Considerations](#security-considerations)
8. [Troubleshooting](#troubleshooting)

## Prerequisites

### Required Services
- **PostgreSQL Database** (Neon recommended for Replit)
- **OpenAI API** access for AI features
- **Node.js 20+** runtime environment

### Required Secrets
Set these environment variables/secrets before deployment:

```bash
DATABASE_URL=postgresql://username:password@host:port/database
OPENAI_API_KEY=sk-...
SESSION_SECRET=your-session-secret-key
ADMIN_SECRET=your-admin-secret-key
```

### Optional Secrets
```bash
SNYK_TOKEN=for-security-scanning
LHCI_GITHUB_APP_TOKEN=for-lighthouse-ci
```

## Environment Setup

### Development Environment

1. **Clone and Install**
   ```bash
   git clone <repository-url>
   cd skippy-trading-platform
   npm install
   ```

2. **Database Setup**
   ```bash
   # Generate schema
   npm run db:generate
   
   # Push to database
   npm run db:push
   
   # Run optimized migration
   npm run migrate:test
   ```

3. **Start Development Server**
   ```bash
   npm run dev
   ```

### Production Environment

1. **Install Dependencies**
   ```bash
   npm ci --production
   ```

2. **Build Application**
   ```bash
   npm run build
   ```

3. **Start Production Server**
   ```bash
   npm start
   ```

## Database Migration

### Schema Transition (Legacy to Optimized)

The platform includes a comprehensive migration from 15+ legacy tables to an optimized 8-10 table design:

```bash
# Dry run (recommended first)
npm run skippy db migrate --dry-run

# Execute migration
npm run skippy db migrate

# Verify migration
npm run skippy db health
```

### Post-Migration Cleanup

After successful migration and verification:

```sql
-- Manual cleanup of legacy tables (run carefully)
DROP TABLE IF EXISTS trading_signals CASCADE;
DROP TABLE IF EXISTS market_regimes CASCADE;
DROP TABLE IF EXISTS sentiment_data CASCADE;
DROP TABLE IF EXISTS agent_memories CASCADE;
DROP TABLE IF EXISTS trading_strategies CASCADE;
```

### Vector Database Setup

For AI similarity search features:

```bash
# Initialize vector database
npm run skippy db init-vectors
```

## Build and Test

### Pre-Deployment Testing

Run the complete test suite before deployment:

```bash
# Lint and format check
npm run lint
npm run format:check

# Unit tests
npm run test:unit

# End-to-end tests
npm run test:e2e

# Visual regression tests
npm run test:visual

# Accessibility tests
npm run test:a11y

# Load testing (optional)
npm run test:load
```

### Bundle Analysis

Verify bundle size targets (<450KB total):

```bash
npm run analyze:bundle
```

### Performance Audit

```bash
# Install Lighthouse CI
npm install -g @lhci/cli

# Run performance audit
lhci autorun
```

## Production Deployment

### Replit Deployment

1. **Configure Secrets**
   - Go to Replit Secrets panel
   - Add all required environment variables
   - Verify database connectivity

2. **Deploy Application**
   ```bash
   # Build for production
   npm run build
   
   # Start application
   npm start
   ```

3. **Verify Deployment**
   ```bash
   # Check system status
   npm run skippy system status
   
   # Test API endpoints
   curl https://your-app.replit.app/api/health
   ```

### Traditional Cloud Deployment

#### Docker Deployment

```dockerfile
# Dockerfile
FROM node:20-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --production

COPY . .
RUN npm run build

EXPOSE 5000
CMD ["npm", "start"]
```

```bash
# Build and run
docker build -t skippy-trading .
docker run -p 5000:5000 --env-file .env skippy-trading
```

#### PM2 Deployment

```bash
# Install PM2
npm install -g pm2

# Create ecosystem file
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'skippy-trading',
    script: 'dist/server/index.js',
    env: {
      NODE_ENV: 'production',
      PORT: 5000
    },
    instances: 2,
    exec_mode: 'cluster'
  }]
}
EOF

# Deploy
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

## Monitoring and Observability

### Health Checks

The platform includes comprehensive health monitoring:

```bash
# System health
curl /api/health

# Database health
npm run skippy db health

# AI service status
curl /api/ai/status
```

### Metrics and Alerting

Built-in Prometheus-compatible metrics at `/api/metrics`:

- **Trading Metrics**: Trades/minute, success rate, P&L
- **AI Metrics**: Inference time, model accuracy, error rates  
- **System Metrics**: API response time, WebSocket connections
- **Business Metrics**: User activity, portfolio performance

### Distributed Tracing

The platform includes OpenTelemetry-compatible tracing:

- **Request Tracing**: End-to-end API request tracking
- **Database Tracing**: Query performance monitoring
- **WebSocket Tracing**: Real-time connection monitoring
- **AI Tracing**: Model inference performance

Access traces via:
```bash
# View recent traces
curl /api/traces?limit=100

# Export traces for external systems
npm run skippy system export-traces
```

### Log Aggregation

Structured JSON logging with levels:

```bash
# View logs
npm run skippy system logs --level=info --tail=100

# Search logs
npm run skippy system logs --search="trade executed"
```

## Security Considerations

### API Security

- **Authentication**: Replit OIDC with session management
- **Authorization**: Role-based access control
- **Rate Limiting**: Built-in request throttling
- **Input Validation**: Zod schema validation

### Database Security

- **Connection Security**: SSL/TLS encrypted connections
- **Query Protection**: Parameterized queries via Drizzle ORM
- **Access Control**: Principle of least privilege

### Secrets Management

- **Environment Variables**: Never commit secrets to code
- **Rotation**: Regular API key rotation
- **Encryption**: At-rest and in-transit encryption

### Security Scanning

```bash
# NPM audit
npm audit --audit-level high

# Snyk security scan (if configured)
snyk test --severity-threshold=high
```

## Performance Optimization

### Bundle Size Optimization

Target: <450KB total bundle size

- **Code Splitting**: Lazy loading for Analytics and AI pages
- **Tree Shaking**: Unused code elimination
- **Chunk Optimization**: Strategic vendor chunking

### Database Performance

- **Connection Pooling**: Neon serverless connections
- **Query Optimization**: Indexed queries and materialized views
- **Data Archival**: Automated cleanup of old data

```bash
# Performance maintenance
npm run skippy system cleanup --days=90
```

### WebSocket Performance

- **Connection Management**: Automatic cleanup and pooling
- **Message Batching**: Efficient real-time updates
- **Backpressure Handling**: Graceful degradation under load

## Plugin System

### Plugin Deployment

```bash
# List available plugins
npm run skippy plugin list

# Deploy EMA crossover strategy
npm run skippy plugin deploy ema-crossover --live

# Monitor plugin performance
npm run skippy plugin status ema-crossover
```

### Plugin Security

- **Sandboxing**: Isolated execution environment
- **Resource Limits**: CPU and memory constraints
- **Code Review**: Required for production deployment

## Troubleshooting

### Common Issues

#### Database Connection Issues
```bash
# Test database connectivity
npm run skippy db health

# Check connection string
echo $DATABASE_URL

# Verify SSL requirements
psql "$DATABASE_URL" -c "SELECT version();"
```

#### Bundle Size Issues
```bash
# Analyze bundle composition
npm run analyze:bundle

# Check for large dependencies
npm ls --depth=0 --prod
```

#### Performance Issues
```bash
# Check system status
npm run skippy system status

# Monitor resource usage
top -p $(pgrep node)

# Analyze slow queries
npm run skippy db slow-queries
```

#### WebSocket Connection Issues
```bash
# Test WebSocket connectivity
wscat -c ws://localhost:5000/ws

# Check WebSocket logs
npm run skippy system logs --search="websocket"
```

### Error Recovery

#### Application Restart
```bash
# Graceful restart
pm2 restart skippy-trading

# Force restart if needed
pm2 stop skippy-trading && pm2 start skippy-trading
```

#### Database Recovery
```bash
# Rollback last migration if needed
npm run skippy db rollback

# Restore from backup
pg_restore -d $DATABASE_URL backup.sql
```

#### Cache Clearing
```bash
# Clear application cache
npm run skippy system cache-clear

# Clear client-side cache
# Add ?v=timestamp to URLs
```

## Maintenance

### Regular Tasks

#### Daily
- Monitor system health
- Check error rates
- Review security alerts

#### Weekly  
- Update dependencies
- Review performance metrics
- Plugin performance analysis

#### Monthly
- Security scan and updates
- Database cleanup and optimization
- Backup verification

### Automated Maintenance

```bash
# Setup automated cleanup (cron job)
echo "0 2 * * * cd /app && npm run skippy system cleanup" | crontab -

# Setup automated health checks
echo "*/5 * * * * curl -f http://localhost:5000/api/health || echo 'Health check failed'" | crontab -
```

## Support and Documentation

### API Documentation
- OpenAPI/Swagger: `/api/docs`
- Health endpoint: `/api/health`
- Metrics endpoint: `/api/metrics`

### CLI Reference
```bash
# Complete CLI help
npm run skippy --help

# Command-specific help
npm run skippy db --help
npm run skippy plugin --help
```

### Monitoring Dashboards
- System health: Built-in dashboard at `/admin/health`
- Performance metrics: Replit metrics panel
- Custom dashboards: Grafana/Prometheus compatible

For additional support, refer to the project documentation and monitoring dashboards.