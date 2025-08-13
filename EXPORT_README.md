# Skippy Trading Platform - Complete Export Package

## What's Included

### Source Code Directories
- `client/` - React frontend application with TypeScript
- `server/` - Express.js backend with API routes and services  
- `shared/` - Shared TypeScript schemas and utilities
- `config/` - Configuration files and settings
- `cli/` - Command-line interface tools
- `tools/` - Development and build utilities
- `scripts/` - Automation and deployment scripts
- `tests/` - Test suites and testing utilities
- `plugins/` - Custom plugins and extensions

### Configuration & Metadata Files
- `package.json` - Project dependencies and scripts
- `package-lock.json` - Exact dependency versions
- `tsconfig.json` - TypeScript compiler configuration
- `vite.config.ts` - Vite build configuration
- `tailwind.config.ts` - TailwindCSS styling configuration
- `drizzle.config.ts` - Database ORM configuration
- `playwright.config.ts` - End-to-end testing configuration
- `.replit` - Replit development environment settings
- `.env.example` - Environment variables template
- `.gitignore` - Git exclusion patterns
- `Dockerfile` - Container deployment configuration

### Documentation
- `README.md` - Main project documentation
- `replit.md` - Project context and development notes
- Implementation phase documents (PHASE_A through PHASE_L)
- Feature implementation completion reports
- Architecture and design documentation
- Performance benchmarking reports

### Scripts & Tools
- Development server startup scripts
- Database migration utilities
- Performance testing and benchmarking tools
- API testing and validation scripts
- Transfer learning and AI model scripts

## What's Excluded (to minimize file size)

### Dependencies & Build Artifacts
- `node_modules/` - NPM package dependencies (~897MB)
- `.pythonlibs/` - Python package dependencies
- `dist/`, `build/` - Compiled output directories
- `.cache/` - Build and development caches

### Version Control & Logs
- `.git/` - Git version history (~27MB)
- `*.log` - Application and system logs
- `.local/` - Local development state files

### Large Data Files
- `benchmark-results/` - Performance test datasets
- `artifacts/` - Build and test artifacts
- `training-results/` - ML model training outputs
- `simulation-reports/` - Trading simulation data
- `models/` - Trained machine learning models
- `data/` - Large datasets and market data archives

### Temporary Files
- `tmp/` - Temporary processing files
- `shared_volume/` - Docker volume mounts
- `runs/` - Experiment run data
- Large JSON benchmark files
- Historical backup archives

## Project Overview

This is a sophisticated AI-powered institutional-grade cryptocurrency trading platform featuring:

- **Real-time Market Data**: Live streaming from multiple exchanges
- **AI Trading Algorithms**: Custom reinforcement learning system ("Stevie")
- **Advanced Analytics**: Risk management, portfolio optimization, performance attribution
- **Modern Architecture**: React frontend, Express backend, PostgreSQL database
- **Production Ready**: Docker deployment, comprehensive monitoring, 180+ API endpoints

## Development Setup

1. Install dependencies: `npm install`
2. Set up environment variables from `.env.example`
3. Initialize database: `npm run db:push`
4. Start development server: `npm run dev`

## Key Technical Features

- **Database**: 50+ tables with comprehensive trading schema
- **API**: 180+ endpoints covering trading, analytics, AI services
- **Real-time**: WebSocket servers for live market data
- **Security**: Authentication, rate limiting, input validation
- **Performance**: Optimized queries, caching, monitoring
- **Testing**: Unit tests, integration tests, E2E testing

The platform is currently operational with live market data streaming and all core systems functioning.