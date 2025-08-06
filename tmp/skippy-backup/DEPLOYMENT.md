# Skippy Deployment Guide

## Deployment Options

### 1. Replit Deployment (Recommended)
The platform is optimized for Replit's infrastructure with Autoscale compatibility.

#### Setup Steps:
1. Import the project into a new Replit
2. Configure environment variables in Replit Secrets
3. Run `npm install` to install dependencies
4. Run `npm run db:push` to set up the database
5. Use Replit's Deploy button for production deployment

#### Required Replit Secrets:
```
DATABASE_URL=postgresql://user:pass@host:port/db
SESSION_SECRET=your-secure-32-character-secret
OPENAI_API_KEY=sk-your-openai-key
ADMIN_SECRET=your-admin-password
```

### 2. Local Development
For local development and testing.

#### Prerequisites:
- Node.js 20.x or higher
- PostgreSQL 13+ installed and running
- Git (for version control)

#### Setup:
```bash
# Clone/extract the project
cd skippy-trading-platform

# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Edit .env with your local configuration
# Start PostgreSQL service
sudo service postgresql start

# Create database
createdb skippy_dev

# Push schema to database
npm run db:push

# Start development server
npm run dev
```

### 3. Docker Deployment

#### Dockerfile (create if needed):
```dockerfile
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --only=production

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Expose port
EXPOSE 5000

# Start the application
CMD ["npm", "start"]
```

## Environment Configuration

### Required Variables
```env
# Database
DATABASE_URL=postgresql://user:password@host:port/database

# Security
SESSION_SECRET=a-very-secure-32-character-minimum-secret
REPLIT_DOMAINS=*.replit.app,*.replit.co,localhost:*

# AI Services (Optional)
OPENAI_API_KEY=sk-your-openai-api-key

# Admin Access
ADMIN_SECRET=secure-admin-password
```

## Production Checklist

### Pre-Deployment
- [ ] All environment variables configured
- [ ] Database connection tested
- [ ] SSL certificates configured (if applicable)
- [ ] Build process tested
- [ ] Health endpoints responding correctly
- [ ] Security headers configured
- [ ] Rate limiting tested

### Security
- [ ] Strong session secret (32+ characters)
- [ ] Admin password secured
- [ ] API keys with minimal permissions
- [ ] Database credentials secured
- [ ] CORS domains properly configured
- [ ] Rate limiting configured
- [ ] Request logging enabled

See the complete backup package for full deployment documentation and security guidelines.