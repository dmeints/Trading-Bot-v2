/**
 * Environment Configuration Validation
 * 
 * Uses envalid to validate all environment variables on startup
 * ensuring required configuration is present and properly formatted
 */

import { cleanEnv, str, url, port } from 'envalid';

// Validate and export environment configuration
export const env = cleanEnv(process.env, {
  // Database
  DATABASE_URL: url({ desc: 'PostgreSQL database connection URL' }),
  
  // Authentication & Sessions
  SESSION_SECRET: str({ desc: 'Secret for session encryption' }),
  REPLIT_DOMAINS: str({ desc: 'Comma-separated list of allowed Replit domains' }),
  
  // Admin Access
  ADMIN_SECRET: str({ desc: 'Secret for admin panel access', default: 'dev-admin-secret' }),
  
  // Webhook Security
  WEBHOOK_SECRET_TRADING: str({ desc: 'HMAC secret for trading webhooks', default: 'dev-trading-secret' }),
  WEBHOOK_SECRET_MARKET: str({ desc: 'HMAC secret for market data webhooks', default: 'dev-market-secret' }),
  WEBHOOK_SECRET_GENERIC: str({ desc: 'HMAC secret for generic webhooks', default: 'dev-generic-secret' }),
  
  // AI Services
  AI_SERVICES_ENABLED: str({ default: 'true', desc: 'Enable AI services (true/false)' }),
  OPENAI_API_KEY: str({ default: '', desc: 'OpenAI API key for AI agents' }),
  
  // Feature Flags
  FEATURE_BACKTEST: str({ default: 'true', desc: 'Enable backtesting features' }),
  FEATURE_TRADING: str({ default: 'true', desc: 'Enable live trading features' }),
  LIVE_TRADING_ENABLED: str({ default: 'false', desc: 'Enable live trading with real money (false=paper mode)' }),
  
  // Exchange Configuration
  EXCHANGE_API_KEY: str({ default: '', desc: 'Exchange API key for live trading' }),
  EXCHANGE_API_SECRET: str({ default: '', desc: 'Exchange API secret for live trading' }),
  
  // Runtime
  NODE_ENV: str({ choices: ['development', 'production'], default: 'development' }),
  PORT: port({ default: 5000 }),
  BUILD_SHA: str({ default: 'dev', desc: 'Build hash for version tracking' }),
});