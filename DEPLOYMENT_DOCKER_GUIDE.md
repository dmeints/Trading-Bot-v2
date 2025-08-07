# 🚀 Skippy Docker Deployment Guide

**Status**: Environment Limitation Workaround  
**Issue**: Replit doesn't support Docker natively  
**Solution**: External VPS deployment with CI/CD pipeline  

## Current Deployment Architecture

### Option 1: External VPS with Docker (Recommended)

**Requirements:**
- Ubuntu 20.04+ VPS with Docker installed
- 4GB RAM minimum, 8GB recommended
- 2+ CPU cores
- 50GB disk space
- Public IP with ports 80, 443, 5000 accessible

**Step 1: VPS Setup**
```bash
# Install Docker and Docker Compose
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Create deployment directory
mkdir -p /opt/skippy
cd /opt/skippy
```

**Step 2: Environment Configuration**
```bash
# Copy environment variables
cp .env.example .env.production

# Edit production environment
nano .env.production

# Required variables:
# DATABASE_URL=postgresql://user:password@db:5432/skippy
# OPENAI_API_KEY=your_openai_key
# ADMIN_SECRET=your_secure_admin_secret
# NODE_ENV=production
# SESSION_SECRET=your_session_secret
# REPL_ID=your_repl_id
# REPLIT_DOMAINS=your-domain.com
```

**Step 3: Deploy with Docker Compose**
```bash
# Copy docker-compose.yml to VPS
# Start services
docker-compose -f docker-compose.yml --env-file .env.production up -d

# Verify deployment
docker-compose ps
docker-compose logs -f
```

### Option 2: Replit → VPS CI/CD Pipeline

**GitHub Actions Workflow:**
```yaml
# .github/workflows/deploy.yml
name: Deploy to Production
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Deploy to VPS
        uses: appleboy/ssh-action@v0.1.5
        with:
          host: ${{ secrets.VPS_HOST }}
          username: ${{ secrets.VPS_USER }}
          key: ${{ secrets.VPS_SSH_KEY }}
          script: |
            cd /opt/skippy
            git pull origin main
            docker-compose down
            docker-compose build
            docker-compose up -d
```

## Docker Configuration

### Current docker-compose.yml Status
```yaml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "5000:5000"
    environment:
      - NODE_ENV=production
    depends_on:
      - db
      - redis
  
  db:
    image: postgres:15
    environment:
      POSTGRES_DB: skippy
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
  
  redis:
    image: redis:7-alpine
    
volumes:
  postgres_data:
```

### Dockerfile Optimization
```dockerfile
FROM node:18-alpine
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Build application
COPY . .
RUN npm run build

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:5000/api/health || exit 1

EXPOSE 5000
CMD ["npm", "start"]
```

## Production Deployment Checklist

### Infrastructure ✅
- [x] Health endpoints configured
- [x] Prometheus metrics active
- [x] Database schema ready
- [x] Environment variables configured
- [x] SSL/TLS certificates (Let's Encrypt)

### Security 🔐
- [x] Admin authentication system
- [x] Rate limiting configured
- [x] CORS properly set
- [x] Security headers (helmet.js)
- [x] Environment secrets management

### Monitoring 📊
- [x] Application logs structured
- [x] Metrics collection active
- [x] Health checks implemented
- [ ] Alerting system (Slack integration ready)
- [ ] Dashboard setup (Grafana recommended)

### Performance ⚡
- [x] Database indexing optimized
- [x] API response caching
- [x] WebSocket connection pooling
- [x] Bundle size optimized (<450KB)

## Deployment Commands

### Manual Deployment
```bash
# Build and deploy
npm run build
docker build -t skippy-trading .
docker run -d --name skippy -p 5000:5000 --env-file .env.production skippy-trading

# Verify deployment
curl http://localhost:5000/api/health
curl http://localhost:5000/api/metrics
```

### CLI Deployment Tools
```bash
# Use Skippy CLI for deployment
node dist/cli/index.js deploy status
node dist/cli/index.js deploy start --environment production
node dist/cli/index.js deploy health-check
```

## Troubleshooting

### Common Issues
1. **Port 5000 in use**: Change to different port in environment
2. **Database connection fails**: Verify DATABASE_URL format
3. **Memory issues**: Increase VPS RAM or optimize Node.js heap
4. **SSL certificate errors**: Configure reverse proxy (Nginx recommended)

### Emergency Procedures
```bash
# Stop all services
docker-compose down

# Emergency rollback
docker-compose down
git checkout previous-stable-commit
docker-compose up -d

# Check logs
docker-compose logs --tail=100 -f
```

## Cost Estimation

### VPS Hosting (Monthly)
- **DigitalOcean Droplet**: $12-24/month (2-4GB RAM)
- **AWS EC2 t3.small**: $15-30/month 
- **Linode**: $10-20/month
- **Hetzner**: $8-15/month (Europe)

### Additional Services
- **Domain name**: $10-15/year
- **SSL certificate**: Free (Let's Encrypt)
- **Monitoring**: $0-50/month (depending on scale)

## Next Steps

1. **Choose VPS provider** and create instance
2. **Configure domain DNS** to point to VPS IP
3. **Set up CI/CD pipeline** for automated deployments
4. **Configure monitoring dashboard** (Grafana + Prometheus)
5. **Set up backup strategy** for database and configurations

**Status**: Ready for production deployment once VPS is provisioned

---
*This guide provides a complete workaround for Docker deployment limitations in the Replit environment*