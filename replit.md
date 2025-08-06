# Overview
Skippy is a revolutionary self-improving AI financial intelligence ecosystem that combines advanced AI capabilities, collaborative features, real-time market intelligence, ensemble AI models, sentiment analysis, and breakthrough innovations. The platform features adversarial trading networks, multi-source data fusion, collaborative intelligence sharing, predictive analytics, sophisticated automation, and comprehensive backtesting capabilities. The system integrates a React frontend with an Express.js backend, utilizing PostgreSQL for data persistence and WebSockets for real-time market data and AI agent coordination.

# User Preferences
Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
The client is built with React 18 and Vite. It features a component-based architecture using shadcn/ui (Radix UI + Tailwind CSS) for UI. Zustand manages client-side state, TanStack Query handles server state, and Wouter is used for routing. Custom WebSocket hooks facilitate real-time market data and AI agent updates.

## Backend Architecture
The server follows a RESTful API design using Express.js. It includes middleware for logging, authentication, and error handling. Drizzle ORM provides type-safe database interactions with PostgreSQL. A WebSocket server enables real-time communication. The core features include a multi-agent AI system for market analysis, news sentiment, trading decisions, and risk assessment, alongside a trading engine for execution and position management.

## Data Storage Solutions
PostgreSQL is the primary database, featuring comprehensive schemas for users, trading data, and AI activities. It utilizes appropriate data types for financial precision and JSONB for metadata. Drizzle Kit manages schema migrations.

## Authentication and Authorization
Replit's OpenID Connect (OIDC) via Passport.js handles secure authentication. Server-side sessions are stored in PostgreSQL. Route-level authorization protects endpoints, and user management includes automatic creation and profile synchronization with Replit accounts.

## Multi-Agent AI System
The AI system orchestrates specialized agents:
- **Market Analyst Agent**: Uses OpenAI GPT-4o for technical analysis and price prediction.
- **News Analyst Agent**: Assesses news sentiment and market impact.
- **Trading Agent**: Generates trade recommendations from diverse data sources.
- **Risk Assessor Agent**: Provides portfolio risk analysis and position sizing.
- **Sentiment Analyst Agent**: Evaluates social media and market sentiment.
Each agent contributes to trading decisions with confidence scores and reasoning.

## Trading Engine Design
The trading engine supports:
- **Paper Trading**: Full simulation with realistic market conditions.
- **Position Management**: Real-time tracking of open positions and P&L.
- **Order Types**: Support for market, limit, and stop orders.
- **Risk Management**: Integrated controls and position sizing based on user risk tolerance.

## Core Engine Components
- **Policy Engine**: Advanced risk management with confidence thresholds, loss streak tracking, cooldown periods, and emergency stops.
- **RL Engine**: Reinforcement learning inference system with model management and prediction APIs.
- **Backtest Engine**: Comprehensive strategy simulation with synthetic events and detailed analysis.
- **Trading Integration**: Policy-controlled trade execution with automated risk assessment.
- **Ensemble AI System**: Multi-agent ensemble orchestrator with performance tracking and confidence scoring.
- **Sentiment Analysis Engine**: Real-time multi-source sentiment analysis with confidence weighting.
- **Collaborative Intelligence**: Community strategy sharing, voting, and reputation systems.
- **Advanced Analytics**: Real-time performance metrics, risk analysis, and market regime detection.

## API Infrastructure
Includes routes for RL inference, policy management, simulation services, and journal analytics.

## Deployment Architecture
Features lazy initialization of AI services, where services are initialized only when first requested via API endpoints, optimizing startup and resource management for production environments.

# External Dependencies

## Database and Infrastructure
- **Neon Database**: Serverless PostgreSQL hosting.
- **WebSocket Library**: 'ws' package for real-time communication.

## AI and Machine Learning
- **OpenAI API**: GPT-4o model integration for NLP and trading insights.
- **Multiple AI Agents**: Custom specialized trading agents.

## Authentication Services
- **Replit OIDC**: Integration with Replit's authentication system.
- **Passport.js**: Authentication middleware.

## Frontend Libraries
- **Radix UI**: Primitives for UI components.
- **Tailwind CSS**: For styling.
- **Zustand**: For state management.
- **TanStack Query**: For server state management and caching.

## Development and Build Tools
- **TypeScript**: For type safety.
- **Vite**: Fast development server and optimized builds.
- **ESBuild**: High-performance bundling.
- **Drizzle Kit**: Database migration and introspection.

## Real-time Market Data
- **CoinGecko API**: Provides real cryptocurrency prices.
- **WebSocket Integration**: For real-time price streaming.