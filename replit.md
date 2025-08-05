# Overview

Skippy is an AI-powered cryptocurrency trading assistant built with modern web technologies. The application features a multi-agent AI system that provides real-time market analysis, intelligent trade recommendations, and comprehensive risk management for both paper and live trading modes. The system combines a React-based frontend with an Express.js backend, leveraging PostgreSQL for data persistence and WebSocket connections for real-time market data streaming.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
The client is built with React 18 using Vite as the build tool and bundler. The application follows a modern component-based architecture:

- **UI Framework**: Utilizes shadcn/ui components built on Radix UI primitives with Tailwind CSS for styling
- **State Management**: Implements Zustand for client-side state management with a trading store handling market data, positions, and AI agent status
- **Data Fetching**: TanStack Query (React Query) handles server state, caching, and synchronization
- **Routing**: Uses Wouter for lightweight client-side routing
- **Real-time Communication**: Custom WebSocket hooks manage live market data feeds and AI agent updates

## Backend Architecture
The server follows a RESTful API design with Express.js as the core framework:

- **API Layer**: Express.js handles HTTP requests with middleware for logging, authentication, and error handling
- **Database Layer**: Drizzle ORM provides type-safe database interactions with PostgreSQL
- **Real-time Services**: WebSocket server enables bidirectional communication for market data streaming
- **AI Orchestration**: Multi-agent system with specialized agents for market analysis, news sentiment, trading decisions, and risk assessment
- **Trading Engine**: Handles both paper and live trading execution with position management

## Data Storage Solutions
PostgreSQL serves as the primary database with the following key design decisions:

- **Schema Design**: Comprehensive tables for users, trading positions, trades, market data, AI agent activities, recommendations, and portfolio snapshots
- **Session Management**: PostgreSQL-backed session store for authentication persistence
- **Data Types**: Utilizes appropriate PostgreSQL types including DECIMAL for financial precision and JSONB for flexible metadata storage
- **Migrations**: Drizzle Kit manages schema migrations and database versioning

## Authentication and Authorization
Replit's OpenID Connect (OIDC) integration provides secure authentication:

- **Authentication Flow**: OIDC-based authentication with Passport.js strategy implementation
- **Session Management**: Server-side sessions stored in PostgreSQL with configurable TTL
- **Authorization**: Route-level protection with middleware checking authentication status
- **User Management**: Automatic user creation and profile synchronization with Replit accounts

## Multi-Agent AI System
The AI orchestration system employs specialized agents for different aspects of trading:

- **Market Analyst Agent**: Technical analysis and price prediction using OpenAI GPT-4o
- **News Analyst Agent**: News sentiment analysis and market impact assessment
- **Trading Agent**: Trade recommendation generation based on multiple data sources
- **Risk Assessor Agent**: Portfolio risk analysis and position sizing recommendations
- **Sentiment Analyst Agent**: Social media and market sentiment evaluation

Each agent operates independently and contributes to the overall trading decision matrix with confidence scores and reasoning.

## Trading Engine Design
The trading engine supports both simulated and live trading environments:

- **Paper Trading**: Full simulation of trades with realistic market conditions and fees
- **Position Management**: Real-time tracking of open positions with P&L calculations
- **Order Types**: Support for market, limit, and stop orders with appropriate execution logic
- **Risk Management**: Integrated risk controls and position sizing based on user risk tolerance

# External Dependencies

## Database and Infrastructure
- **Neon Database**: Serverless PostgreSQL hosting with connection pooling via @neondatabase/serverless
- **WebSocket Library**: 'ws' package for real-time bidirectional communication

## AI and Machine Learning
- **OpenAI API**: GPT-4o model integration for natural language processing and trading insights
- **Multiple AI Agents**: Custom implementation of specialized trading agents with confidence scoring

## Authentication Services
- **Replit OIDC**: Integration with Replit's authentication system using openid-client
- **Passport.js**: Authentication middleware with OIDC strategy implementation

## Frontend Libraries
- **UI Components**: Radix UI primitives for accessible, customizable components
- **Styling**: Tailwind CSS with custom CSS variables for theming
- **State Management**: Zustand for predictable state management
- **Data Fetching**: TanStack Query for server state management and caching

## Development and Build Tools
- **TypeScript**: Full type safety across the entire application stack
- **Vite**: Fast development server and optimized production builds
- **ESBuild**: High-performance bundling for server-side code
- **Drizzle Kit**: Database migration and introspection tools

## Real-time Market Data
- **Simulated Market Data**: Built-in price simulation for development and testing
- **WebSocket Integration**: Ready for external market data provider integration
- **Caching Layer**: In-memory price caching with configurable update intervals