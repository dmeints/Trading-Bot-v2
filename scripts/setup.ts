#!/usr/bin/env tsx

/**
 * Setup Script for Skippy Trading Platform
 * 
 * Creates necessary directories and default files for the application
 */

import fs from 'fs/promises';
import path from 'path';

async function ensureDirectory(dirPath: string) {
  try {
    await fs.mkdir(dirPath, { recursive: true });
    console.log(`✓ Created directory: ${dirPath}`);
  } catch (error) {
    console.log(`✓ Directory exists: ${dirPath}`);
  }
}

async function ensureFile(filePath: string, defaultContent: string = '') {
  try {
    await fs.access(filePath);
    console.log(`✓ File exists: ${filePath}`);
  } catch (error) {
    await fs.writeFile(filePath, defaultContent);
    console.log(`✓ Created file: ${filePath}`);
  }
}

async function setup() {
  console.log('🚀 Setting up Skippy Trading Platform...\n');

  // Create required directories
  await ensureDirectory('logs');
  await ensureDirectory('models');
  await ensureDirectory('tmp');

  // Create default log files
  await ensureFile('logs/analytics.jsonl', '');
  await ensureFile('logs/errors.jsonl', '');
  await ensureFile('logs/system.log', '');

  // Create default model directory structure
  await ensureDirectory('models/rl');
  await ensureDirectory('models/backups');

  // Create placeholder model metadata
  const defaultModelMetadata = {
    version: '1.0.0',
    architecture: 'PPO',
    trainingEpochs: 0,
    accuracy: 0,
    lastUpdated: new Date().toISOString(),
    featureNames: [
      'price', 'volume24h', 'change24h', 'volatility',
      'rsi', 'macd', 'bollingerPosition', 'volumeProfile'
    ]
  };

  await ensureFile(
    'models/ppo_trading_model_metadata.json',
    JSON.stringify(defaultModelMetadata, null, 2)
  );

  // Create .env.example if it doesn't exist
  const envExample = `# Database Configuration
DATABASE_URL=your_database_url_here

# Authentication & Sessions
SESSION_SECRET=your-super-secret-session-key-at-least-16-chars
REPLIT_DOMAINS=your-replit-domain.replit.dev

# Admin Configuration
ADMIN_SECRET=your-admin-secret

# Webhook Security
WEBHOOK_SECRET_TRADING=your-trading-webhook-secret
WEBHOOK_SECRET_MARKET=your-market-webhook-secret
WEBHOOK_SECRET_GENERIC=your-generic-webhook-secret

# AI Services
AI_SERVICES_ENABLED=true
OPENAI_API_KEY=your_openai_api_key_here

# Feature Flags
FEATURE_BACKTEST=true
FEATURE_TRADING=true

# Runtime
NODE_ENV=development
PORT=5000
BUILD_SHA=dev`;

  await ensureFile('.env.example', envExample);

  console.log('\n✅ Setup complete!');
  console.log('\n📋 Next steps:');
  console.log('1. npm install');
  console.log('2. npm run db:push');
  console.log('3. Set all Replit secrets (see .env.example)');
  console.log('4. npm run dev');
}

setup().catch(console.error);