# Skippy Trading Platform - Disaster Recovery Guide

## Overview
Complete disaster recovery procedures for the Skippy Trading Platform, including automated backup creation, one-command restoration, and comprehensive smoke testing.

## Quick Recovery

### One-Command Restore
```bash
# Using the disaster recovery script
./scripts/disaster-recovery.sh backup-file.tar.gz

# Using the CLI tool
./cli/skippy-cli.js recover --file backup-file.tar.gz

# Test-only mode (smoke tests without restore)
./cli/skippy-cli.js recover --test-only
```

### Recovery Options
```bash
# Full recovery with all steps
./scripts/disaster-recovery.sh -v backup-file.tar.gz

# Skip dependency installation (faster)
./scripts/disaster-recovery.sh --skip-deps backup-file.tar.gz

# Skip database operations
./scripts/disaster-recovery.sh --skip-db backup-file.tar.gz

# Skip smoke tests
./scripts/disaster-recovery.sh --skip-tests backup-file.tar.gz
```

## Backup Creation

### Automated Backups
```bash
# Create full system backup
./cli/skippy-cli.js backup

# Custom backup with database
./cli/skippy-cli.js backup --include-db --output custom-backup.tar.gz

# Compressed backup
./cli/skippy-cli.js backup --compress
```

### Manual Backup Process
```bash
# 1. Create backup directory
mkdir -p backups

# 2. Archive project files
tar -czf backups/skippy-$(date +%Y%m%d-%H%M%S).tar.gz \
  --exclude=node_modules \
  --exclude=.git \
  --exclude=tmp \
  --exclude=logs \
  --exclude=backups \
  .

# 3. Database backup (if needed)
pg_dump $DATABASE_URL > backups/database-$(date +%Y%m%d-%H%M%S).sql
```

## Recovery Process

### Step-by-Step Recovery
1. **Extract Backup**
   ```bash
   tar -xzf backup-file.tar.gz -C restore-temp/
   ```

2. **Install Dependencies**
   ```bash
   cd restore-temp && npm ci
   ```

3. **Database Migration**
   ```bash
   npm run db:push
   ```

4. **Start Services**
   ```bash
   npm run dev
   ```

5. **Run Smoke Tests**
   ```bash
   ./scripts/disaster-recovery.sh --test-only
   ```

### Smoke Test Coverage
The recovery process includes comprehensive smoke tests:

- **Health Check**: `/api/health` endpoint
- **Ping Test**: `/api/ping` endpoint  
- **Market Data**: `/api/market/data` endpoint
- **Database**: Database connectivity test
- **WebSocket**: Real-time connection test
- **AI Services**: AI agent availability

### Expected Recovery Time
- **Small deployment** (< 1GB): 2-5 minutes
- **Medium deployment** (1-5GB): 5-15 minutes
- **Large deployment** (> 5GB): 15-30 minutes

## Backup Strategy

### Backup Schedule
- **Hourly**: Configuration files and critical data
- **Daily**: Full application backup
- **Weekly**: Complete system backup with database
- **Monthly**: Archive backup to long-term storage

### Retention Policy
- **Hourly backups**: Keep for 7 days
- **Daily backups**: Keep for 30 days
- **Weekly backups**: Keep for 12 weeks
- **Monthly backups**: Keep for 12 months

### Backup Validation
```bash
# Validate backup integrity
tar -tzf backup-file.tar.gz > /dev/null

# Test restore in isolated environment
./scripts/disaster-recovery.sh --test-only
```

## Emergency Procedures

### Critical System Failure
1. **Assess the situation**
   - Identify affected components
   - Determine data loss extent
   - Estimate recovery time

2. **Initiate recovery**
   ```bash
   # Get latest backup
   LATEST_BACKUP=$(ls -t backups/*.tar.gz | head -1)
   
   # Start recovery
   ./scripts/disaster-recovery.sh "$LATEST_BACKUP"
   ```

3. **Verify recovery**
   ```bash
   # Check system health
   ./cli/skippy-cli.js monitor --health
   
   # Verify critical functions
   curl http://localhost:5000/api/health/detailed
   ```

### Partial System Recovery
```bash
# Database only
./cli/skippy-cli.js db --restore database-backup.sql

# Application only (skip database)
./scripts/disaster-recovery.sh --skip-db backup-file.tar.gz

# Configuration only
tar -xzf backup-file.tar.gz --include="*.env*" --include="config/*"
```

## Data Loss Scenarios

### Scenario 1: Database Corruption
```bash
# 1. Stop services
./cli/skippy-cli.js service --stop

# 2. Restore database from backup
./cli/skippy-cli.js db --restore latest-db-backup.sql

# 3. Restart services
./cli/skippy-cli.js service --start

# 4. Verify data integrity
./cli/skippy-cli.js monitor --health
```

### Scenario 2: Complete System Loss
```bash
# 1. Provision new environment
# 2. Download latest backup
# 3. Run full recovery
./scripts/disaster-recovery.sh backup-file.tar.gz

# 4. Update DNS/routing if needed
# 5. Notify users of recovery completion
```

### Scenario 3: Configuration Loss
```bash
# 1. Extract configuration files only
tar -xzf backup-file.tar.gz --include=".env*" --include="config/*"

# 2. Restart services
./cli/skippy-cli.js service --restart

# 3. Verify configuration
./cli/skippy-cli.js monitor --health
```

## Recovery Validation

### Post-Recovery Checklist
- [ ] System health checks pass
- [ ] Database connectivity verified
- [ ] WebSocket connections working
- [ ] AI services responding
- [ ] External API connections active
- [ ] Real-time data flowing
- [ ] User authentication working
- [ ] Trading functions operational

### Performance Validation
```bash
# Check system performance
./cli/skippy-cli.js monitor --metrics

# Run load test
./cli/skippy-cli.js loadtest --users 100 --duration 2

# Verify SLA compliance
./cli/skippy-cli.js monitor --slo
```

## Monitoring and Alerting

### Recovery Monitoring
- **Recovery time tracking**: Monitor recovery duration
- **Success rate**: Track recovery success percentage
- **Data integrity**: Verify no data corruption
- **Performance impact**: Monitor post-recovery performance

### Alert Integration
```bash
# Send recovery notification
curl -X POST "$SLACK_WEBHOOK" \
  -H 'Content-Type: application/json' \
  -d '{"text":"🚨 Disaster recovery completed for Skippy Trading Platform"}'

# Update status page
curl -X POST "$STATUS_API/incidents" \
  -H 'Authorization: Bearer $STATUS_TOKEN' \
  -d '{"status":"resolved","message":"System restored from backup"}'
```

## Best Practices

### Backup Best Practices
- **Test backups regularly**: Quarterly recovery tests
- **Multiple locations**: Store backups in different regions
- **Encryption**: Encrypt sensitive backup data
- **Versioning**: Keep multiple backup versions
- **Documentation**: Maintain current recovery procedures

### Recovery Best Practices
- **Practice regularly**: Monthly recovery drills
- **Automated testing**: Include in CI/CD pipeline
- **Communication plan**: Notify stakeholders during recovery
- **Rollback plan**: Have ability to rollback if recovery fails
- **Post-incident review**: Learn from each recovery event

### Security Considerations
- **Access control**: Limit backup access to authorized personnel
- **Audit trails**: Log all backup and recovery operations
- **Encryption**: Use encrypted channels for backup transfer
- **Key management**: Secure backup encryption keys
- **Verification**: Verify backup integrity before use

## Troubleshooting

### Common Recovery Issues

1. **Dependencies not installing**
   ```bash
   # Clear cache and retry
   rm -rf node_modules package-lock.json
   npm install
   ```

2. **Database connection fails**
   ```bash
   # Check environment variables
   echo $DATABASE_URL
   
   # Test database connectivity
   psql $DATABASE_URL -c "SELECT version();"
   ```

3. **Port conflicts**
   ```bash
   # Find process using port
   lsof -i :5000
   
   # Kill process if needed
   kill -9 $(lsof -t -i :5000)
   ```

4. **Permission issues**
   ```bash
   # Fix file permissions
   chmod +x scripts/disaster-recovery.sh
   chmod +x cli/skippy-cli.js
   ```

### Emergency Contacts
- **System Administrator**: [Contact Information]
- **Database Administrator**: [Contact Information]
- **Development Team Lead**: [Contact Information]
- **Infrastructure Team**: [Contact Information]

### Recovery Logs
All recovery operations are logged to:
- **Recovery log**: `./dr-restore.log`
- **System logs**: `./logs/application.log`
- **Database logs**: Check PostgreSQL logs

### Support Resources
- **Documentation**: This guide and MONITORING.md
- **CLI Help**: `./cli/skippy-cli.js --help`
- **Script Help**: `./scripts/disaster-recovery.sh --help`
- **Health Checks**: `/api/health/detailed` endpoint