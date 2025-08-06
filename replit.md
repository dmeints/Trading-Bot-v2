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
- **Live Market Data**: CoinGecko API integration providing real cryptocurrency prices updated every 30 seconds
- **WebSocket Integration**: Real-time price streaming to connected clients
- **Caching Layer**: In-memory price caching with configurable update intervals

# Recent Changes

## Phase 1: Bootstrap Core Feature Restoration (August 6, 2025)

### Analytics Logging System
- **Comprehensive Event Logging**: JSONL-based analytics logging system tracks all trades, AI decisions, and system events
- **Daily Summary Generation**: CSV export functionality for daily trading and system analytics
- **Error Logging**: Dedicated error logging with structured metadata and stack traces
- **System Statistics**: Real-time monitoring of log file sizes, event counts, and system health

### Security and Rate Limiting
- **Multi-tier Rate Limiting**: Different rate limits for general API, trading operations, and admin functions
- **Admin Authentication**: Secure admin access system using environment-based secrets
- **Request Logging**: All rate limit violations and unauthorized access attempts are logged

### Admin Dashboard
- **System Management Interface**: Comprehensive admin panel accessible at `/admin` route
- **Analytics Visualization**: View recent analytics events, error logs, and system statistics
- **Export Functionality**: Download daily summaries and system reports
- **Log Management**: Clear logs and monitor system performance

### Integration Enhancements
- **Trade Event Logging**: All successful and failed trades are automatically logged with metadata
- **AI Agent Monitoring**: AI agent activities and performance metrics are tracked
- **Enhanced Error Handling**: Comprehensive error logging across all API endpoints

## Phase 2: Webhook Security & Model Management (August 6, 2025)

### Webhook Security Infrastructure
- **HMAC-SHA256 Verification**: Cryptographically secure webhook signature verification system
- **Multi-endpoint Support**: Separate webhook endpoints for trading, market data, and generic integrations
- **Request Logging**: All webhook activities and security events are logged for audit trails
- **Raw Body Capture**: Middleware for proper signature verification with original payload integrity

### Model Management System
- **Model Registry**: Complete AI model registration, versioning, and metadata management
- **Performance Tracking**: Monitor model accuracy, precision, recall, and F1 scores
- **Backup & Restore**: Automated model backup system with version control
- **Activation Control**: Dynamic model activation/deactivation for A/B testing and rollbacks
- **File Management**: Secure model file storage with checksum verification

### API Security Enhancements
- **Webhook Endpoints**: `/api/webhooks/trading`, `/api/webhooks/market`, `/api/webhooks/generic`
- **Model Management**: Full CRUD operations for AI models with admin authentication
- **Environment Secrets**: Configurable webhook secrets for different integration types
- **Admin Interface Extensions**: Integrated model management and webhook monitoring in admin panel

## Phase 3: Advanced Features Implementation (August 6, 2025)

### Webhook Testing Utility
- **Automated Test Suite**: Comprehensive webhook testing with signature verification
- **Performance Monitoring**: Response time tracking and success rate analytics
- **Test History**: Complete audit trail of webhook test executions
- **Real-time Validation**: Live testing of webhook endpoints with proper HMAC signatures

### Advanced Analytics Dashboard
- **Comprehensive Metrics**: Multi-dimensional analytics with time series visualization
- **Performance Charts**: Real-time confidence, P&L, and latency tracking
- **Strategy Breakdown**: Detailed analysis by strategy type, risk level, and data source
- **Interactive Filtering**: Dynamic time range and source filtering capabilities

### Enterprise Integration
- **Multi-interface Access**: Separate pages for model management (`/models`) and analytics (`/analytics`)
- **Admin Panel Extensions**: Integrated webhook testing and advanced analytics links
- **Real-time Monitoring**: Live system statistics with automatic refresh intervals
- **Export Capabilities**: CSV download functionality for all analytics data