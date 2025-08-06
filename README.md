# Skippy - AI-Powered Cryptocurrency Trading Platform

A cutting-edge multi-agent AI crypto trading platform with enhanced analytics, security, and management capabilities.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- PostgreSQL database (Neon DB recommended)
- Replit account with OIDC setup

### Setup Instructions

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Run setup script**
   ```bash
   npm run setup
   ```

3. **Configure database**
   ```bash
   npm run db:push
   ```

4. **Set Replit secrets** (see `.env.example` for all required variables)
   - `DATABASE_URL` - PostgreSQL connection string
   - `SESSION_SECRET` - Secret for session encryption (min 16 chars)
   - `REPLIT_DOMAINS` - Your Replit domain
   - `ADMIN_SECRET` - Admin panel access secret
   - `WEBHOOK_SECRET_TRADING` - Trading webhook HMAC secret
   - `WEBHOOK_SECRET_MARKET` - Market data webhook HMAC secret  
   - `WEBHOOK_SECRET_GENERIC` - Generic webhook HMAC secret
   - `OPENAI_API_KEY` - OpenAI API key for AI agents

5. **Start development server**
   ```bash
   npm run dev
   ```

## 🏗️ Architecture

### Backend
- **Express.js** - RESTful API server with middleware
- **TypeScript** - Full type safety across the stack
- **Drizzle ORM** - Type-safe database interactions
- **PostgreSQL** - Primary data storage
- **WebSocket** - Real-time market data streaming

### Frontend  
- **React 18** - Modern component-based UI
- **Vite** - Fast development and optimized builds
- **Tailwind CSS** - Utility-first styling
- **shadcn/ui** - Accessible component library
- **TanStack Query** - Server state management
- **Zustand** - Client state management

### AI & Trading
- **Multi-Agent System** - Specialized AI agents for different aspects
- **Reinforcement Learning** - PPO model for trading decisions
- **Risk Management** - Policy engine with safety controls
- **Backtesting** - Comprehensive strategy simulation
- **Paper Trading** - Risk-free trading simulation

## 🔧 API Endpoints

### Health & Status
- `GET /api/ping` - Basic health check
- `GET /api/version` - Version and feature information
- `GET /api/health` - Comprehensive system status

### Authentication
- `GET /api/me` - Current user authentication status
- `GET /api/auth/user` - Authenticated user details

### Trading
- `GET /api/trading/trades` - Trading history
- `POST /api/trading/execute` - Execute trades
- `GET /api/portfolio/summary` - Portfolio overview

### AI Services
- `GET /api/ai/agents/status` - AI agent status
- `POST /api/ai/agents/run/:agentType` - Run specific AI agent
- `POST /api/ai/initialize` - Manual AI service initialization

## 🔒 Security Features

- **Helmet.js** - Security headers
- **Rate Limiting** - Multi-tier API protection
- **HMAC Webhooks** - Cryptographically secure webhooks
- **Session Security** - Secure session configuration
- **Environment Validation** - Startup configuration validation
- **Request Tracking** - Unique request IDs for observability

## 📊 Monitoring & Analytics

- **Structured Logging** - JSON format compatible with Replit
- **Analytics Events** - JSONL-based event tracking
- **Error Logging** - Comprehensive error tracking
- **Performance Metrics** - System and trading performance

## 🚀 Deployment

### Replit Deployment
1. Ensure all secrets are configured in Replit
2. The application uses lazy initialization for AI services
3. Deploy using Replit's built-in deployment system

### Environment Variables
See `.env.example` for complete configuration options.

### Feature Flags
- `AI_SERVICES_ENABLED` - Enable/disable AI features
- `FEATURE_BACKTEST` - Enable backtesting capabilities
- `FEATURE_TRADING` - Enable live trading features

## 📁 Project Structure

```
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # Reusable components
│   │   ├── pages/          # Page components
│   │   └── lib/            # Utilities and hooks
├── server/                 # Express backend
│   ├── config/             # Configuration and validation
│   ├── engine/             # Trading engines (RL, Policy, Backtest)
│   ├── middleware/         # Express middleware
│   ├── services/           # Business logic services
│   └── utils/              # Shared utilities
├── shared/                 # Shared types and schemas
├── scripts/                # Setup and utility scripts
└── logs/                   # Application logs
```

## 🔧 Development

### Database Migrations
```bash
npm run db:push      # Push schema changes
npm run db:generate  # Generate migrations
```

### Logging
The application uses structured JSON logging. Logs are written to:
- `logs/analytics.jsonl` - Trading and system events
- `logs/errors.jsonl` - Error events
- `stdout` - Structured logs for Replit

### Testing
```bash
npm test            # Run test suite
npm run test:watch  # Watch mode
```

## 📈 Trading Features

- **Real-time Market Data** - CoinGecko integration
- **Multi-Agent AI** - Market analysis, news sentiment, risk assessment
- **Paper Trading** - Practice with virtual funds
- **Live Trading** - Real cryptocurrency trading
- **Risk Management** - Automated risk controls
- **Portfolio Tracking** - Real-time P&L tracking
- **Trade Journal** - Detailed trading history with AI insights

## 🤖 AI Agents

1. **Market Analyst** - Technical analysis and price prediction
2. **News Analyst** - News sentiment and market impact
3. **Trading Agent** - Trade recommendation generation
4. **Risk Assessor** - Portfolio risk analysis
5. **Sentiment Analyst** - Social media sentiment evaluation

## 📝 License

MIT License - see LICENSE file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📞 Support

For issues and questions:
1. Check the logs in `/logs/` directory
2. Review environment configuration
3. Check Replit secrets are properly set
4. Verify database connectivity