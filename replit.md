# Overview
Skippy is a professional cryptocurrency trading platform that combines real-time market analysis, intelligent AI insights, and comprehensive portfolio management. It features live market data streaming, automated trading strategies, risk management tools, and an integrated AI system for market analysis and decision support. The platform aims to provide a robust, scalable, and user-friendly experience for traders.

# User Preferences
Preferred communication style: Simple, everyday language.
Technical Focus: Remove conceptual overhead and focus on practical, measurable trading functionality.
Architecture Preference: Consolidated, efficient systems over complex multi-agent architectures.

# Recent Changes (August 7, 2025)
- Completed comprehensive go-live validation across all critical components
- Implemented production-ready CLI with simulation, deployment, and emergency controls
- Validated live exchange connector with testnet integration and safety controls
- Identified critical trading algorithm "Stevie" optimization requirements (15,778% unrealistic returns)
- Confirmed health endpoints, Prometheus metrics, and monitoring infrastructure operational
- Identified authentication system as critical blocker for user portfolio access
- Created improvement roadmap focusing on auth, admin controls, and deployment environment

# System Architecture

## Frontend Architecture
The client is built with React 18 and Vite, utilizing a component-based architecture. UI components are built using shadcn/ui (Radix UI + Tailwind CSS). Zustand manages client-side state, TanStack Query handles server state, and Wouter is used for routing. Custom WebSocket hooks facilitate real-time market data and AI agent updates. The design prioritizes mobile-first responsiveness, accessibility (WCAG 2.1 AA compliance), and performance optimization with a target bundle size under 450KB. It includes enhanced order entry, professional layout presets, advanced trading components (e.g., watchlist, depth-of-market, chart indicators), and comprehensive drawing tools.

## Backend Architecture
The server follows a RESTful API design using Express.js with middleware for logging, authentication, and error handling. Drizzle ORM provides type-safe database interactions with PostgreSQL. A WebSocket server enables real-time communication. Core features include a multi-agent AI system for market analysis, news sentiment, trading decisions, and risk assessment, alongside a trading engine for execution and position management. The architecture is designed for scalability, security (sub-200ms API responses, authenticated sessions), and observability with distributed tracing and Prometheus-compatible metrics.

## Data Storage Solutions
PostgreSQL is the primary database, with comprehensive schemas for users, trading data, and AI activities. Drizzle Kit manages schema migrations. A vector database is integrated for OpenAI embeddings, enabling trade similarity search and contextual insights, with automated indexing.

## Authentication and Authorization
Replit's OpenID Connect (OIDC) via Passport.js handles secure authentication. Server-side sessions are stored in PostgreSQL. Route-level authorization protects endpoints, and user management includes automatic creation and profile synchronization with Replit accounts.

## AI System Architecture
The platform features a practical AI system for real-world trading, focusing on measurable performance improvements. Key components include:
- **Market Insight Agent**: Provides technical analysis, sentiment analysis, and news interpretation.
- **Real-time Analysis**: Continuous market data processing with pattern recognition.
- **Risk Assessment**: Automated portfolio risk evaluation and position sizing recommendations.
- **Strategy Backtesting**: Historical performance validation for trading strategies.
- **Performance Learning**: Closed-loop RL retraining where AI models learn from real trade outcomes.
- **Vector Intelligence System**: Utilizes OpenAI embeddings for semantic search, enabling "find similar scenario" and historical analogues.
- **Data Fusion Engine**: Combines on-chain data (e.g., whale transfers) with multi-source sentiment analysis.

## Trading Engine Design
The trading engine supports:
- **Paper Trading**: Full simulation with realistic market conditions.
- **Position Management**: Real-time tracking of open positions and P&L.
- **Order Types**: Support for market, limit, and stop orders.
- **Risk Management**: Integrated controls and position sizing based on user risk tolerance.

## Core Trading Components
The system integrates several core components including a Market Insight Agent, Risk Assessment System, Real-time Analysis, Strategy Backtesting, Performance Learning, and Portfolio Management.

## Extensibility and Developer Experience
The platform features a comprehensive four-point plugin architecture (data connectors, signal transformers, UI panels, trading strategies) with a visual strategy builder, a plugin marketplace, and automatic plugin discovery with hot-reloading. It includes a unified CLI toolkit with 25+ management commands and OpenAPI documentation for structured API versioning.

## Deployment Architecture
Features lazy initialization of AI services to optimize startup and resource management in production. Includes a comprehensive CI/CD pipeline, performance monitoring, and robust operational excellence features like distributed tracing and Prometheus-compatible metrics.

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

## Development and Build Tools
- **TypeScript**: For type safety.
- **Vite**: Fast development server and optimized builds.
- **ESBuild**: High-performance bundling.
- **Drizzle Kit**: Database migration and introspection.

## Real-time Market Data
- **CoinGecko API**: Provides real cryptocurrency prices.
- **WebSocket Integration**: For real-time price streaming.