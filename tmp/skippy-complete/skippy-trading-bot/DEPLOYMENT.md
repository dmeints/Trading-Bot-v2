# Skippy Deployment Guide

This guide covers deploying Skippy locally or on various platforms.

## 🚀 Local Development Setup

### 1. Prerequisites
```bash
# Install Node.js 18+
node --version  # Should be 18.0.0 or higher

# Install PostgreSQL
# macOS: brew install postgresql
# Ubuntu: sudo apt install postgresql postgresql-contrib
# Windows: Download from postgresql.org
```

### 2. Database Setup
```bash
# Create database
createdb skippy

# Or using psql
psql -U postgres
CREATE DATABASE skippy;
\q
```

### 3. Environment Configuration
```bash
# Copy environment template
cp .env.example .env

# Edit .env with your settings
nano .env
```

### 4. Install and Start
```bash
# Install dependencies
npm install

# Push database schema
npm run db:push

# Start development server
npm run dev
```

## 🌐 Production Deployment

### Replit (Recommended)
1. **Import Project**: Upload zip to Replit or connect GitHub repo
2. **Configure Secrets**: In Replit Secrets panel, add:
   - `DATABASE_URL`
   - `OPENAI_API_KEY`
   - `SESSION_SECRET`
   - `REPL_ID`
   - `REPLIT_DOMAINS`
3. **Deploy**: Click "Deploy" button in Replit

### Vercel + Neon Database
```bash
# Install Vercel CLI
npm i -g vercel

# Configure database
# 1. Create Neon database at neon.tech
# 2. Copy connection string

# Deploy
vercel

# Add environment variables in Vercel dashboard
```

### Railway
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and deploy
railway login
railway init
railway up

# Add environment variables in Railway dashboard
```

### DigitalOcean App Platform
1. **Create App**: Connect GitHub repo in DO dashboard
2. **Configure Build**: 
   - Build Command: `npm run build`
   - Run Command: `npm start`
3. **Add Database**: Create PostgreSQL database
4. **Environment Variables**: Add all required env vars

### AWS/Google Cloud/Azure
1. **Container Deployment**: Use provided Dockerfile
2. **Database**: Set up managed PostgreSQL instance
3. **Environment**: Configure all required variables
4. **Load Balancer**: Set up HTTPS termination

## 🐳 Docker Deployment

### Dockerfile
```dockerfile
# Already included in project
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 5000
CMD ["npm", "start"]
```

### Docker Compose
```yaml
# docker-compose.yml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "5000:5000"
    environment:
      - DATABASE_URL=postgresql://postgres:password@db:5432/skippy
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - SESSION_SECRET=${SESSION_SECRET}
    depends_on:
      - db
  
  db:
    image: postgres:15
    environment:
      - POSTGRES_DB=skippy
      - POSTGRES_PASSWORD=password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

volumes:
  postgres_data:
```

### Deploy with Docker
```bash
# Build and run
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down
```

## 🔧 Environment Variables

### Required Variables
| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/db` |
| `SESSION_SECRET` | Session encryption key | Random 32-character string |

### Optional Variables
| Variable | Description | Default |
|----------|-------------|---------|
| `OPENAI_API_KEY` | OpenAI API key for AI features | None (AI disabled) |
| `PORT` | Server port | 5000 |
| `NODE_ENV` | Environment mode | development |

### Authentication Variables (for production)
| Variable | Description |
|----------|-------------|
| `REPL_ID` | Replit application ID |
| `ISSUER_URL` | OIDC issuer URL |
| `REPLIT_DOMAINS` | Allowed domains for auth |

## 📊 Database Migration

### Initial Setup
```bash
# Create and push schema
npm run db:push

# Generate migration (if needed)
npx drizzle-kit generate:pg

# Apply migration
npx drizzle-kit push:pg
```

### Production Migration
```bash
# Backup database first
pg_dump $DATABASE_URL > backup.sql

# Apply new schema
npm run db:push

# Verify migration
npm run db:studio
```

## 🔍 Health Checks

### Application Health
- **Endpoint**: `GET /api/ping`
- **Expected**: `{"status":"ok","ts":"2024-..."}`

### Database Health
```bash
# Check connection
psql $DATABASE_URL -c "SELECT 1;"

# Check tables
psql $DATABASE_URL -c "\dt"
```

### AI System Health
- **Endpoint**: `GET /api/ai/status`
- **Check**: Agent activities in database

## 📈 Performance Optimization

### Database
```sql
-- Add indexes for better performance
CREATE INDEX idx_trades_user_id ON trades(user_id);
CREATE INDEX idx_market_data_timestamp ON market_data(timestamp);
CREATE INDEX idx_recommendations_user_id ON recommendations(user_id);
```

### Caching
```bash
# Add Redis for caching (optional)
npm install redis
```

### Load Balancing
- Use nginx or cloud load balancer
- Configure sticky sessions for WebSocket

## 🔐 Security Checklist

### Production Security
- [ ] Use HTTPS only
- [ ] Set secure session cookies
- [ ] Configure CORS properly
- [ ] Enable rate limiting
- [ ] Use strong passwords
- [ ] Regular security updates
- [ ] Monitor access logs
- [ ] Backup database regularly

### Environment Security
- [ ] Never commit `.env` files
- [ ] Use secrets management
- [ ] Rotate API keys regularly
- [ ] Limit database permissions
- [ ] Use read-only replicas for reports

## 🚨 Troubleshooting

### Common Issues

**Port already in use:**
```bash
# Kill process on port 5000
lsof -ti:5000 | xargs kill -9
```

**Database connection failed:**
```bash
# Check PostgreSQL status
pg_isready -h localhost -p 5432

# Restart PostgreSQL
# macOS: brew services restart postgresql
# Ubuntu: sudo systemctl restart postgresql
```

**Build failures:**
```bash
# Clear npm cache
npm cache clean --force

# Delete node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

**WebSocket connection issues:**
- Check firewall settings
- Verify proxy configuration
- Ensure WebSocket support in load balancer

### Logging and Monitoring
```bash
# View application logs
tail -f logs/app.log

# Monitor database
tail -f /var/log/postgresql/postgresql.log

# Check system resources
htop
```

## 📞 Support

For deployment issues:
1. Check logs first
2. Verify environment variables
3. Test database connection
4. Check API key validity
5. Review firewall/security group settings

Remember: Always test deployments in staging environment first!