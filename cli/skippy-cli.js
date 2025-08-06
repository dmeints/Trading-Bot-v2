#!/usr/bin/env node

import { Command } from 'commander';
import axios from 'axios';
import fs from 'fs';
import path from 'path';

const program = new Command();

// Configuration
const DEFAULT_API_BASE = 'http://localhost:5000/api';
const API_BASE = process.env.SKIPPY_API_BASE || DEFAULT_API_BASE;

// Helper function to make API requests
async function apiRequest(endpoint, options = {}) {
  try {
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };
    
    // Add admin secret for admin endpoints
    if (endpoint.includes('/admin') || endpoint.includes('/metrics') || endpoint.includes('/flags') || endpoint.includes('/feature-flags') || endpoint.includes('/copilot')) {
      const adminSecret = process.env.ADMIN_SECRET || 'admin_secret_123';
      headers['x-admin-secret'] = adminSecret;
    }
    
    const response = await axios({
      url: `${API_BASE}${endpoint}`,
      method: options.method || 'GET',
      data: options.data,
      params: options.params,
      headers
    });
    return response.data;
  } catch (error) {
    console.error(`API Error: ${error.message}`);
    if (error.response?.data?.error) {
      console.error(`Details: ${error.response.data.error}`);
    }
    process.exit(1);
  }
}

// Format and display results
function displayResults(data, format = 'json') {
  if (format === 'json') {
    console.log(JSON.stringify(data, null, 2));
  } else if (format === 'table') {
    console.table(data);
  } else {
    console.log(data);
  }
}

// Backtest command
program
  .command('backtest')
  .description('Run backtest for specified symbols and strategies')
  .option('-s, --symbols <symbols>', 'Comma-separated list of symbols', 'BTC,ETH')
  .option('--since <since>', 'Time period (e.g., 30d, 7d, 1h)', '30d')
  .option('--strategy <strategy>', 'Trading strategy', 'momentum')
  .option('--capital <capital>', 'Initial capital', '10000')
  .option('-f, --format <format>', 'Output format (json|table)', 'json')
  .action(async (options) => {
    console.log('Running backtest...');
    
    const symbols = options.symbols.split(',');
    const results = [];
    
    for (const symbol of symbols) {
      const config = {
        symbol: symbol.trim() + '/USD',
        strategy: options.strategy,
        initialCapital: parseInt(options.capital),
        startDate: getDateFromPeriod(options.since),
        endDate: new Date().toISOString()
      };
      
      console.log(`Testing ${symbol} with ${options.strategy} strategy...`);
      
      try {
        const result = await apiRequest('/backtest/run', {
          method: 'POST',
          data: config
        });
        
        results.push({
          symbol,
          strategy: options.strategy,
          totalReturn: result.totalReturn,
          winRate: result.winRate,
          sharpeRatio: result.sharpeRatio,
          maxDrawdown: result.maxDrawdown
        });
      } catch (error) {
        console.error(`Failed to test ${symbol}: ${error.message}`);
      }
    }
    
    displayResults(results, options.format);
  });

// Summarize command
program
  .command('summarize')
  .description('Generate trading summary')
  .option('--format <format>', 'Output format (csv|json)', 'json')
  .option('--since <since>', 'Time period', 'yesterday')
  .action(async (options) => {
    console.log('Generating summary...');
    
    try {
      const summary = await apiRequest('/admin/analytics');
      
      if (options.format === 'csv') {
        const csvPath = path.join(process.cwd(), `summary_${Date.now()}.csv`);
        const csvContent = convertToCSV(summary);
        fs.writeFileSync(csvPath, csvContent);
        console.log(`Summary saved to: ${csvPath}`);
      } else {
        displayResults(summary, options.format);
      }
    } catch (error) {
      console.error('Failed to generate summary:', error.message);
    }
  });

// Audit command
program
  .command('audit')
  .description('Run system health checks')
  .action(async () => {
    console.log('Running system audit...');
    
    const checks = [
      { name: 'API Health', endpoint: '/health' },
      { name: 'Database', endpoint: '/health/db' },
      { name: 'AI Services', endpoint: '/health/ai' },
      { name: 'Trading Engine', endpoint: '/health/trading' }
    ];
    
    for (const check of checks) {
      try {
        await apiRequest(check.endpoint);
        console.log(`✅ ${check.name}: OK`);
      } catch (error) {
        console.log(`❌ ${check.name}: FAIL`);
      }
    }
  });

// AI command group
const aiCommand = program.command('ai').description('AI-related commands');

aiCommand
  .command('ask <question>')
  .description('Ask the AI copilot a question')
  .action(async (question) => {
    console.log('Asking AI copilot...');
    
    try {
      const response = await apiRequest('/copilot/ask', {
        method: 'POST',
        data: { question }
      });
      
      console.log('\nAI Response:');
      console.log(response.answer);
      
      if (response.followUpQuestions?.length > 0) {
        console.log('\nSuggested follow-up questions:');
        response.followUpQuestions.forEach((q, i) => {
          console.log(`${i + 1}. ${q}`);
        });
      }
    } catch (error) {
      console.error('Failed to get AI response:', error.message);
    }
  });

aiCommand
  .command('performance')
  .description('Get AI performance metrics')
  .action(async () => {
    try {
      const performance = await apiRequest('/ai/performance');
      displayResults(performance, 'table');
    } catch (error) {
      console.error('Failed to get AI performance:', error.message);
    }
  });

// Trading command group
const tradingCommand = program.command('trading').description('Trading-related commands');

tradingCommand
  .command('status')
  .description('Get trading system status')
  .action(async () => {
    try {
      const status = await apiRequest('/trading/status');
      console.log('Trading Status:', status.enabled ? '🟢 Active' : '🔴 Inactive');
      console.log('Open Positions:', status.openPositions || 0);
      console.log('Total PnL:', `$${status.totalPnL || 0}`);
    } catch (error) {
      console.error('Failed to get trading status:', error.message);
    }
  });

tradingCommand
  .command('recommendations')
  .description('Get current AI trading recommendations')
  .action(async () => {
    try {
      const recommendations = await apiRequest('/ai/recommendations');
      console.log('\nCurrent Recommendations:');
      recommendations.forEach(rec => {
        console.log(`📊 ${rec.symbol}: ${rec.recommendation} (${Math.round(rec.confidence * 100)}% confidence)`);
        console.log(`   Reasoning: ${rec.reasoning}`);
      });
    } catch (error) {
      console.error('Failed to get recommendations:', error.message);
    }
  });

// Metrics command
program
  .command('metrics')
  .description('Get system metrics')
  .option('--range <range>', 'Time range (1h|24h|7d|30d)', '24h')
  .option('-f, --format <format>', 'Output format', 'json')
  .action(async (options) => {
    try {
      const metrics = await apiRequest('/metrics/system', {
        params: { range: options.range }
      });
      displayResults(metrics, options.format);
    } catch (error) {
      console.error('Failed to get metrics:', error.message);
    }
  });

// Feature flags command group
const flagsCommand = program.command('flags').description('Feature flag management');

flagsCommand
  .command('list')
  .description('List all feature flags')
  .action(async () => {
    try {
      const flags = await apiRequest('/feature-flags/all');
      console.log('\n🏳️  Feature Flags:');
      flags.forEach(flag => {
        const status = flag.enabled ? '🟢' : '🔴';
        console.log(`${status} ${flag.name} (${flag.rolloutPercentage}%)`);
        console.log(`   ${flag.description}`);
      });
    } catch (error) {
      console.error('Failed to get feature flags:', error.message);
    }
  });

flagsCommand
  .command('toggle <flagId>')
  .description('Toggle a feature flag')
  .action(async (flagId) => {
    try {
      const result = await apiRequest(`/feature-flags/${flagId}/toggle`, {
        method: 'POST'
      });
      console.log(`✅ ${result.message}`);
    } catch (error) {
      console.error('Failed to toggle feature flag:', error.message);
    }
  });

// Revolutionary AI commands
program
  .command('consciousness')
  .description('Get quantum consciousness metrics')
  .action(async () => {
    try {
      const metrics = await apiRequest('/revolutionary/quantum-consciousness/status');
      console.log('\n🧠 Quantum Consciousness Status:');
      console.log(`Market Awareness: ${Math.round(metrics.marketAwareness?.consciousnessLevel * 100)}%`);
      console.log(`Active Quantum States: ${metrics.activeQuantumStates}`);
      console.log(`Conscious Trading: ${metrics.consciousTrading ? '🟢 Active' : '🔴 Inactive'}`);
    } catch (error) {
      console.error('Failed to get consciousness metrics:', error.message);
    }
  });

program
  .command('superintelligence')
  .description('Get collective superintelligence metrics')
  .action(async () => {
    try {
      const metrics = await apiRequest('/revolutionary/collective-intelligence/status');
      console.log('\n🤝 Collective Superintelligence Status:');
      console.log(`Network Nodes: ${metrics.network?.totalNodes || 0}`);
      console.log(`Emergent Intelligence: ${Math.round((metrics.network?.emergentIntelligence || 0) * 100)}%`);
      console.log(`Collective Wisdom: ${Math.round((metrics.network?.collectiveWisdom || 0) * 100)}%`);
    } catch (error) {
      console.error('Failed to get superintelligence metrics:', error.message);
    }
  });

// Ultra-Adaptive Intelligence commands
program
  .command('retrain')
  .description('Trigger adaptive RL retraining on high-impact events')
  .option('--force', 'Force retraining even without high-impact events')
  .action(async (options) => {
    console.log('Analyzing high-impact events and triggering adaptive retraining...');
    
    try {
      const result = await apiRequest('/ultra-adaptive/retrain', {
        method: 'POST',
        data: { forceRetrain: options.force || false }
      });
      
      console.log(`\n⚡️ Adaptive Retraining Result:`);
      console.log(`Status: ${result.status}`);
      console.log(`Events Processed: ${result.eventsProcessed || 0}`);
      
      if (result.improvementMetrics) {
        console.log(`\nPerformance Improvements:`);
        console.log(`Accuracy: +${(result.improvementMetrics.accuracyImprovement * 100).toFixed(1)}%`);
        console.log(`Loss Reduction: ${(result.improvementMetrics.lossReduction * 100).toFixed(1)}%`);
      }
    } catch (error) {
      console.error('Failed to trigger retraining:', error.message);
    }
  });

program
  .command('what-if <tradeId>')
  .description('Generate what-if scenarios for a specific trade')
  .action(async (tradeId) => {
    console.log(`Generating what-if scenarios for trade ${tradeId}...`);
    
    try {
      const response = await apiRequest(`/ultra-adaptive/what-if/${tradeId}`);
      
      console.log(`\n🔮 What-If Scenarios for Trade ${tradeId}:`);
      response.scenarios.forEach((scenario, i) => {
        console.log(`\n${i + 1}. ${scenario.explanation}`);
        console.log(`   PnL Difference: $${scenario.pnlDifference.toFixed(2)}`);
        console.log(`   Confidence Change: ${scenario.confidenceDelta > 0 ? '+' : ''}${(scenario.confidenceDelta * 100).toFixed(1)}%`);
      });
    } catch (error) {
      console.error('Failed to generate what-if scenarios:', error.message);
    }
  });

program
  .command('vector-search')
  .description('Search for similar historical trades')
  .option('-s, --symbol <symbol>', 'Symbol to search for', 'BTC')
  .option('-t, --type <type>', 'Trade type (buy/sell)', 'buy')
  .action(async (options) => {
    console.log(`Searching for trades similar to ${options.type} ${options.symbol}...`);
    
    try {
      const query = {
        symbol: options.symbol,
        type: options.type,
        executedAt: new Date()
      };
      
      const response = await apiRequest('/ultra-adaptive/vector-search', {
        method: 'POST',
        data: { query, limit: 5 }
      });
      
      console.log(`\n🔍 Similar Historical Trades:`);
      response.results.forEach((result, i) => {
        console.log(`\n${i + 1}. ${result.trade.type.toUpperCase()} ${result.trade.symbol}`);
        console.log(`   Similarity: ${(result.similarity * 100).toFixed(1)}%`);
        console.log(`   PnL: $${result.outcome.pnl?.toFixed(2) || 'N/A'}`);
        console.log(`   Date: ${new Date(result.trade.executedAt).toLocaleDateString()}`);
      });
    } catch (error) {
      console.error('Failed to perform vector search:', error.message);
    }
  });

program
  .command('cross-domain <symbol>')
  .description('Get cross-domain analysis (on-chain + sentiment)')
  .action(async (symbol) => {
    console.log(`Analyzing cross-domain data for ${symbol}...`);
    
    try {
      const enrichedContext = await apiRequest(`/ultra-adaptive/enriched-context/${symbol}`);
      
      console.log(`\n🌐 Cross-Domain Analysis for ${symbol}:`);
      
      // On-chain data
      console.log(`\nOn-Chain Metrics:`);
      console.log(`Whale Activity: ${enrichedContext.onChain.whaleActivity}`);
      console.log(`Liquidity Health: ${enrichedContext.onChain.liquidityHealth}`);
      console.log(`Network Strength: ${enrichedContext.onChain.networkStrength}`);
      
      // Sentiment data
      console.log(`\nSentiment Analysis:`);
      console.log(`Overall: ${enrichedContext.sentiment.overall}`);
      console.log(`Trend: ${enrichedContext.sentiment.trend}`);
      
      // Insights
      if (enrichedContext.enrichedInsights?.length > 0) {
        console.log(`\nKey Insights:`);
        enrichedContext.enrichedInsights.forEach((insight, i) => {
          console.log(`${i + 1}. ${insight}`);
        });
      }
    } catch (error) {
      console.error('Failed to get cross-domain analysis:', error.message);
    }
  });

// Utility functions
function getDateFromPeriod(period) {
  const now = new Date();
  const match = period.match(/(\d+)([dhm])/);
  
  if (!match) {
    return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // Default 30 days
  }
  
  const value = parseInt(match[1]);
  const unit = match[2];
  
  let milliseconds = 0;
  switch (unit) {
    case 'm':
      milliseconds = value * 60 * 1000;
      break;
    case 'h':
      milliseconds = value * 60 * 60 * 1000;
      break;
    case 'd':
      milliseconds = value * 24 * 60 * 60 * 1000;
      break;
  }
  
  return new Date(now.getTime() - milliseconds).toISOString();
}

function convertToCSV(data) {
  if (!Array.isArray(data) || data.length === 0) {
    return '';
  }
  
  const headers = Object.keys(data[0]);
  const csvRows = [headers.join(',')];
  
  data.forEach(row => {
    const values = headers.map(header => {
      const value = row[header];
      return typeof value === 'string' && value.includes(',') ? `"${value}"` : value;
    });
    csvRows.push(values.join(','));
  });
  
  return csvRows.join('\n');
}

// Set up program
program
  .name('skippy')
  .description('Skippy Trading Platform CLI')
  .version('2.0.0');

program.parse();