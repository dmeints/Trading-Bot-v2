# Skippy - AI-Powered Crypto Trading Bot

A comprehensive AI-powered cryptocurrency trading assistant built with modern web technologies. Features a multi-agent AI system that provides real-time market analysis, intelligent trade recommendations, and comprehensive risk management for both paper and live trading modes.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- PostgreSQL database
- OpenAI API key (optional for AI features)

### Installation

1. **Clone and install dependencies:**
```bash
npm install
```

2. **Setup environment variables:**
Create a `.env` file with:
```bash
DATABASE_URL=postgresql://username:password@localhost:5432/skippy
OPENAI_API_KEY=your_openai_api_key_here
SESSION_SECRET=your_session_secret_here
REPL_ID=your_repl_id_for_auth
ISSUER_URL=https://replit.com/oidc
REPLIT_DOMAINS=your-domain.repl.co
```

3. **Setup database:**
```bash
npm run db:push
```

4. **Start development server:**
```bash
npm run dev
```

## 🏗️ Architecture

### Frontend (React + TypeScript)
- **UI Framework**: shadcn/ui components with Tailwind CSS
- **State Management**: Zustand for trading data
- **Data Fetching**: TanStack Query for server state
- **Real-time**: WebSocket integration for live market data
- **Routing**: Wouter for lightweight routing

### Backend (Express + TypeScript)
- **API**: RESTful endpoints with Express.js
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Replit OIDC integration
- **Real-time**: WebSocket server for market data streaming
- **AI System**: Multi-agent orchestration with OpenAI GPT-4o

### AI Trading System
- **Market Analyst**: Technical analysis and price predictions
- **News Analyst**: News sentiment and market impact
- **Trading Agent**: Trade recommendation generation
- **Risk Assessor**: Portfolio risk analysis
- **Sentiment Analyst**: Social media sentiment evaluation

## 📊 Features

### ✅ Core Features
- **Paper Trading**: Safe simulation environment
- **Real-time Market Data**: Live price feeds for major cryptocurrencies
- **AI Recommendations**: Intelligent trading signals with confidence scores
- **Portfolio Management**: P&L tracking and performance analytics
- **Risk Management**: Position sizing and risk assessment
- **Multi-Agent AI**: Specialized agents for different trading aspects

### 🔄 Trading Engine
- **Order Types**: Market, limit, and stop orders
- **Position Tracking**: Real-time P&L calculations
- **Trade History**: Complete transaction logging
- **Risk Controls**: Automated risk management

### 📱 Dashboard
- **Live Market Data**: Real-time price updates
- **AI Agent Status**: Activity monitoring and recommendations
- **Portfolio Summary**: Performance metrics and analytics
- **Trading Interface**: Buy/sell execution with order management

## 🛠️ Development

### Project Structure
```
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── pages/         # Route components
│   │   ├── hooks/         # Custom React hooks
│   │   ├── stores/        # Zustand state management
│   │   └── lib/           # Utilities and helpers
├── server/                # Express backend
│   ├── services/          # Business logic
│   │   ├── aiAgents.ts    # AI system orchestration
│   │   ├── tradingEngine.ts # Trading execution
│   │   └── marketData.ts  # Market data simulation
│   ├── routes.ts          # API endpoints
│   ├── storage.ts         # Database operations
│   └── db.ts             # Database connection
├── shared/                # Shared types and schemas
│   └── schema.ts         # Database schema and types
└── README.md             # This file
```

### Available Scripts
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run db:push` - Push database schema changes
- `npm run db:studio` - Open Drizzle Studio

### API Endpoints
- `GET /api/auth/user` - Get current user
- `GET /api/portfolio/summary` - Portfolio overview
- `GET /api/ai/recommendations` - AI trading recommendations
- `GET /api/trading/trades` - Trade history
- `POST /api/trading/execute` - Execute trades
- `GET /api/market/data` - Current market data

### Database Schema
The system uses PostgreSQL with the following key tables:
- `users` - User profiles and settings
- `trades` - Trading transaction history
- `positions` - Current trading positions
- `recommendations` - AI-generated trading signals
- `agent_activities` - AI agent activity logs
- `market_data` - Real-time market price data
- `portfolio_snapshots` - Portfolio performance history

## 🔧 Configuration

### Authentication
Uses Replit's OIDC for secure authentication. Configure these environment variables:
- `REPL_ID` - Your Replit application ID
- `REPLIT_DOMAINS` - Comma-separated list of allowed domains
- `SESSION_SECRET` - Secret for session encryption

### AI Integration
The system integrates with OpenAI for intelligent trading analysis:
- `OPENAI_API_KEY` - Your OpenAI API key for AI features

### Trading Modes
- **Paper Trading**: Safe simulation (default)
- **Live Trading**: Real exchange integration (requires exchange API setup)

## 🚀 Deployment

### Replit Deployment
The project is optimized for Replit deployment:
1. Import project to Replit
2. Configure secrets in Replit's environment
3. Use "Deploy" button for production

### Self-Hosting
For local or cloud deployment:
1. Set up PostgreSQL database
2. Configure environment variables
3. Build and deploy using your preferred platform

## 📈 Trading Strategy

The AI system employs multiple specialized agents:

1. **Market Analysis**: Technical indicators and trend analysis
2. **Sentiment Analysis**: News and social media sentiment
3. **Risk Assessment**: Portfolio risk and position sizing
4. **Trade Execution**: Optimal entry/exit timing

Each agent provides confidence scores and reasoning for transparent decision-making.

## 🔐 Security

- **Authentication**: Secure OIDC integration
- **Session Management**: PostgreSQL-backed sessions
- **API Protection**: Rate limiting and input validation
- **Data Encryption**: Secure storage of sensitive information

## 📝 License

This project is for educational and personal use. Please review the terms of service for any external APIs used.

## 🤝 Contributing

This is a personal trading assistant. For improvements or bug fixes:
1. Test thoroughly in paper trading mode
2. Ensure all AI agents function correctly
3. Verify database migrations work properly
4. Update documentation as needed

## ⚠️ Disclaimer

This software is for educational purposes only. Cryptocurrency trading involves significant risk. Always:
- Start with paper trading
- Never risk more than you can afford to lose
- Understand the markets before trading
- Consider consulting financial advisors

The AI recommendations are not financial advice and should be used as one factor in your trading decisions.

---

Built with ❤️ using React, Express, PostgreSQL, and OpenAI GPT-4o.