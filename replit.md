# Overview
Skippy is a professional cryptocurrency trading platform that combines real-time market analysis, intelligent AI insights, and comprehensive portfolio management. It features live market data streaming, automated trading strategies, risk management tools, and an integrated AI system for market analysis and decision support. The platform aims to provide a robust, scalable, and user-friendly experience for traders.

# User Preferences
Preferred communication style: Simple, everyday language.
Technical Focus: Remove conceptual overhead and focus on practical, measurable trading functionality.
Architecture Preference: Consolidated, efficient systems over complex multi-agent architectures.

# Recent Changes (August 7, 2025)
- **STEVIE ADVANCED FEATURES COMPLETE**: All 5 advanced features fully implemented and operational
- **LLM Conversational Interface**: OpenAI GPT-4o integration with function calling for real-time data and trading analysis
- **Reinforcement Learning Strategy**: Complete RL environment with PPO/DQN agents, composite reward functions, and automated retraining
- **UI Personality Integration**: All notifications and interactions now use Stevie's personality with 25+ message variations
- **Feedback & Monitoring System**: Comprehensive feedback collection with weekly reports and adaptive risk alerts
- **Message Variations**: 5+ examples each for greetings, risk warnings, trade celebrations, market analysis, and encouragement
- **Advanced API Endpoints**: 15+ new Stevie endpoints for chat, RL training, feedback, and UI personality features
- **Production Ready**: Platform ready for deployment with complete AI trading companion system

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
The platform features Stevie, an advanced AI trading companion with comprehensive personality and learning systems:
- **Stevie Personality System**: Complete persona with backstory, tone guidelines, and 25+ message variations for all interaction types
- **LLM Conversational Interface**: OpenAI GPT-4o integration with function calling for portfolio analysis, trade explanations, and strategy suggestions
- **Reinforcement Learning Strategy**: Full RL trading environment with PPO/DQN agents, composite reward functions, and continuous learning
- **Context Management**: Sliding window memory of 1,000 tokens plus key trade events for personalized conversations
- **UI Personality Integration**: All notifications, toasts, and interactions use Stevie's encouraging, data-driven personality
- **Feedback & Monitoring System**: Thumbs-up/down feedback, weekly performance reports, and adaptive risk alerts
- **Real-time Analysis**: Continuous market data processing with pattern recognition and personality-infused insights
- **Performance Learning**: Closed-loop learning from user feedback and trading outcomes for continuous improvement

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