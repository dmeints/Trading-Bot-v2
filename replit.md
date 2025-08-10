# Overview
Skippy is a professional cryptocurrency trading platform providing real-time market analysis, intelligent AI insights, and comprehensive portfolio management. It offers live market data streaming, automated trading strategies, risk management tools, and an integrated AI system for market analysis and decision support. The platform aims to deliver a robust, scalable, and user-friendly experience, enabling users to leverage advanced AI for informed trading decisions.

# User Preferences
Preferred communication style: Simple, everyday language.
Technical Focus: Remove conceptual overhead and focus on practical, measurable trading functionality.
Architecture Preference: Consolidated, efficient systems over complex multi-agent architectures.
Data Integrity Priority: Real algorithm performance testing over marketing metrics - eliminate fake/fabricated data.
Anti-Fabrication Requirement: Verifiable, reproducible benchmark results with full provenance tracking.
UI/UX Quality: Comprehensive accessibility compliance (WCAG 2.2) and systematic interaction validation following ChatGPT-5 specifications.

# System Architecture

## Frontend Architecture
The client is built with React 18 and Vite, using a component-based architecture. UI components are developed with shadcn/ui (Radix UI + Tailwind CSS). Zustand manages client-side state, TanStack Query handles server state, and Wouter is used for routing. Custom WebSocket hooks facilitate real-time market data and AI agent updates. The design prioritizes mobile-first responsiveness, accessibility (WCAG 2.1 AA compliance), and performance optimization, including enhanced order entry and advanced trading components.

## Backend Architecture
The server follows a RESTful API design using Express.js with middleware for logging, authentication, and error handling. Drizzle ORM provides type-safe database interactions with PostgreSQL. A WebSocket server enables real-time communication. Core features include a multi-agent AI system for market analysis, news sentiment, trading decisions, and risk assessment, alongside a trading engine for execution and position management. The architecture emphasizes scalability, security, and observability.

## Data Storage Solutions
PostgreSQL is the primary database, with comprehensive schemas for users, trading data, and AI activities. Drizzle Kit manages schema migrations. A vector database is integrated for OpenAI embeddings, enabling trade similarity search and contextual insights, with automated indexing.

## Authentication and Authorization
Replit's OpenID Connect (OIDC) via Passport.js handles secure authentication. Server-side sessions are stored in PostgreSQL. Route-level authorization protects endpoints, and user management includes automatic creation and profile synchronization with Replit accounts.

## AI System Architecture
The platform features Stevie, an advanced AI trading companion with comprehensive personality and learning systems. This includes:
- **Stevie Personality System**: A complete persona with backstory, tone guidelines, and varied message variations.
- **LLM Conversational Interface**: OpenAI GPT-4o integration with function calling for portfolio analysis, trade explanations, and strategy suggestions.
- **Reinforcement Learning Strategy**: A full RL trading environment with PPO/DQN agents, composite reward functions, and continuous learning, including Optuna hyperparameter optimization and genetic algorithm strategy evolution.
- **Comprehensive Data Integration**: Full integration with all 8 external data sources (CoinGecko Pro, Binance WebSocket, Twitter API, Reddit API, Etherscan, CryptoPanic, Blockchair, Trading Economics) providing real market data, sentiment analysis, and on-chain metrics to the algorithm.
- **Real Algorithmic Trading Engine**: Stevie now uses a quantitative decision engine with mathematical routing logic - breakout detection, mean reversion, news momentum, liquidity scaling, and risk-adjusted position sizing. Replaces simplistic if-statements with comprehensive multi-factor analysis.
- **Anti-Mock Data Protection**: Production guardrails prevent fake data infiltration with provenance tracking, cross-source validation, and entropy testing to ensure algorithm integrity.
- **Context Management**: A sliding window memory of 1,000 tokens plus key trade events for personalized conversations.
- **UI Personality Integration**: All notifications, toasts, and interactions use Stevie's encouraging, data-driven personality.
- **Feedback & Monitoring System**: Includes thumbs-up/down feedback, weekly performance reports, and adaptive risk alerts.
- **Real-time Analysis**: Continuous market data processing with pattern recognition and personality-infused insights using actual market data from all configured sources.
- **Performance Learning**: Closed-loop learning from user feedback and trading outcomes.
- **Advanced Multi-Modal Trading System**: Features multi-modal signal fusion (news, on-chain, social sentiment), dynamic risk management, adversarial training, and real-time explainability via LLM-powered trade reasoning.
- **Multi-Mind Transcendence System**: Incorporates 5 distinct Stevie personalities with a competitive evolution system for trading battles, breeding, and mutation algorithms for knowledge transfer.
- **Training Day System**: Provides an iterative benchmark hardening loop with version tracking for continuous improvement of Stevie models, utilizing a professional async job system with queue management.
- **Stevie as Isolated Algorithm Package**: Containerized system for safe experimentation, configuration-driven personality and algorithm system with hot-reload, interface contracts, A/B testing infrastructure, and version management.

## Trading Engine Design
The trading engine supports:
- **Paper Trading**: Full simulation with realistic market conditions.
- **Position Management**: Real-time tracking of open positions and P&L.
- **Order Types**: Support for market, limit, and stop orders.
- **Risk Management**: Integrated controls and position sizing based on user risk tolerance.

## Core Trading Components
The system integrates a Market Insight Agent, Risk Assessment System, Real-time Analysis, Strategy Backtesting, Performance Learning, and Portfolio Management.

## Extensibility and Developer Experience
The platform features a comprehensive four-point plugin architecture (data connectors, signal transformers, UI panels, trading strategies) with a visual strategy builder, a plugin marketplace, and automatic plugin discovery with hot-reloading. It includes a unified CLI toolkit with management commands and OpenAPI documentation.

## Deployment Architecture
Features lazy initialization of AI services to optimize startup and resource management in production. Includes a comprehensive CI/CD pipeline, performance monitoring, and robust operational excellence features.

# External Dependencies

## Database and Infrastructure
- **Neon Database**: Serverless PostgreSQL hosting.
- **ws**: WebSocket library for real-time communication.

## AI and Machine Learning
- **OpenAI API**: Integration for GPT-4o model and vector embeddings.

## Authentication Services
- **Replit OIDC**: For authentication.
- **Passport.js**: Authentication middleware.

## Frontend Libraries
- **Radix UI**: UI component primitives.
- **Tailwind CSS**: For styling.
- **Zustand**: For state management.
- **TanStack Query**: For server state management and caching.
- **Wouter**: For client-side routing.

## Development and Build Tools
- **TypeScript**: For type safety.
- **Vite**: Fast development server and optimized builds.
- **ESBuild**: High-performance bundling.
- **Drizzle Kit**: Database migration and introspection.

## Real-time Market Data and Analytics
- **CoinGecko Pro API**: Cryptocurrency prices and historical data.
- **Binance API**: Real-time trading data.
- **X (Twitter) API v2**: Social sentiment.
- **Reddit API**: Community sentiment.
- **Etherscan API**: Ethereum on-chain analytics.
- **CryptoPanic API**: News sentiment with voting data analysis.
- **Blockchair**: Bitcoin on-chain data.
- **Trading Economics API**: Economic calendar and macro events.