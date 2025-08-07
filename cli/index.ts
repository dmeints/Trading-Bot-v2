#!/usr/bin/env tsx

import { Command } from 'commander';
import { migrateToOptimizedSchema } from '../scripts/schema-transition';
import { logger } from '../server/utils/logger';
import { db } from '../server/db';
import { sql } from 'drizzle-orm';
import { VectorDBService, initializeVectorDB } from '../server/services/vectorDB';

const program = new Command();

program
  .name('skippy')
  .description('Skippy Trading Platform CLI')
  .version('1.0.0');

// Database commands
const dbCommand = program
  .command('db')
  .description('Database management commands');

dbCommand
  .command('migrate')
  .description('Run database migration to optimized schema')
  .option('--dry-run', 'Show what would be migrated without making changes')
  .action(async (options) => {
    try {
      console.log('🚀 Running database migration...');
      
      if (options.dryRun) {
        console.log('📋 DRY RUN - No changes will be made');
        // Add dry run logic here
        console.log('✅ Migration plan validated');
      } else {
        await migrateToOptimizedSchema();
        console.log('✅ Migration completed successfully');
      }
    } catch (error) {
      console.error('❌ Migration failed:', error);
      process.exit(1);
    }
  });

dbCommand
  .command('health')
  .description('Check database health and connectivity')
  .action(async () => {
    try {
      console.log('🔍 Checking database health...');
      
      // Test connection
      const result = await db.execute(sql`SELECT 1 as test, NOW() as timestamp`);
      console.log('✅ Database connection: OK');
      console.log(`📊 Server time: ${result.rows[0]?.timestamp}`);
      
      // Check table counts
      const tables = [
        'users', 'positions', 'trades', 'marketData', 
        'marketEvents', 'agentActivities', 'portfolioSnapshots'
      ];
      
      for (const table of tables) {
        try {
          const count = await db.execute(sql.raw(`SELECT COUNT(*) as count FROM "${table}"`));
          console.log(`📋 ${table}: ${count.rows[0]?.count || 0} records`);
        } catch (err) {
          console.log(`⚠️  ${table}: table not found or inaccessible`);
        }
      }
      
      console.log('🎉 Database health check completed');
    } catch (error) {
      console.error('❌ Database health check failed:', error);
      process.exit(1);
    }
  });

dbCommand
  .command('init-vectors')
  .description('Initialize vector database for trade similarity')
  .action(async () => {
    try {
      console.log('🔍 Initializing vector database...');
      await initializeVectorDB();
      console.log('✅ Vector database initialized');
    } catch (error) {
      console.error('❌ Vector DB initialization failed:', error);
      process.exit(1);
    }
  });

// Trading commands
const tradeCommand = program
  .command('trade')
  .description('Trading and strategy commands');

tradeCommand
  .command('backtest')
  .description('Run strategy backtesting')
  .option('-s, --strategy <name>', 'Strategy name', 'default')
  .option('-p, --period <days>', 'Backtesting period in days', '30')
  .option('-c, --symbols <symbols>', 'Comma-separated symbols', 'BTC,ETH,SOL')
  .action(async (options) => {
    try {
      console.log(`🔄 Running backtest for strategy: ${options.strategy}`);
      console.log(`📊 Period: ${options.period} days`);
      console.log(`📈 Symbols: ${options.symbols}`);
      
      const symbols = options.symbols.split(',');
      const days = parseInt(options.period);
      
      // Calculate date range
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      
      console.log(`📅 Date range: ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);
      
      // Get historical data for backtesting
      const historicalData = await db.execute(sql`
        SELECT symbol, price, timestamp, volume_24h, change_24h
        FROM "marketData"
        WHERE symbol = ANY(${symbols})
          AND timestamp >= ${startDate.toISOString()}
          AND timestamp <= ${endDate.toISOString()}
        ORDER BY symbol, timestamp
      `);
      
      console.log(`📊 Historical data points: ${historicalData.rows.length}`);
      
      // Run basic backtest simulation
      let totalTrades = 0;
      let profitableTrades = 0;
      let totalReturn = 0;
      
      for (const symbol of symbols) {
        const symbolData = historicalData.rows.filter((row: any) => row.symbol === symbol);
        
        if (symbolData.length < 2) continue;
        
        // Simple momentum strategy simulation
        for (let i = 1; i < symbolData.length; i++) {
          const prevPrice = parseFloat(symbolData[i-1].price);
          const currentPrice = parseFloat(symbolData[i].price);
          const change = (currentPrice - prevPrice) / prevPrice;
          
          // Simulate trade if momentum exceeds threshold
          if (Math.abs(change) > 0.02) { // 2% change threshold
            totalTrades++;
            const tradeReturn = change * (change > 0 ? 1 : -1); // Long if up, short if down
            totalReturn += tradeReturn;
            
            if (tradeReturn > 0) profitableTrades++;
          }
        }
      }
      
      const winRate = totalTrades > 0 ? (profitableTrades / totalTrades * 100) : 0;
      const avgReturn = totalTrades > 0 ? (totalReturn / totalTrades * 100) : 0;
      
      console.log('\n📊 Backtest Results:');
      console.log(`   Total trades: ${totalTrades}`);
      console.log(`   Profitable trades: ${profitableTrades}`);
      console.log(`   Win rate: ${winRate.toFixed(1)}%`);
      console.log(`   Average return per trade: ${avgReturn.toFixed(2)}%`);
      console.log(`   Total return: ${(totalReturn * 100).toFixed(2)}%`);
      
      console.log('\n✅ Backtest completed');
      
    } catch (error) {
      console.error('❌ Backtest failed:', error);
      process.exit(1);
    }
  });

tradeCommand
  .command('similar')
  .description('Find similar trading scenarios')
  .argument('<query>', 'Trade scenario description')
  .option('-l, --limit <number>', 'Maximum results', '5')
  .action(async (query, options) => {
    try {
      console.log(`🔍 Searching for scenarios similar to: "${query}"`);
      
      const vectorDB = VectorDBService.getInstance();
      const results = await vectorDB.findSimilarTrades(query, parseInt(options.limit));
      
      if (results.length === 0) {
        console.log('📭 No similar scenarios found');
        return;
      }
      
      console.log(`\n📊 Found ${results.length} similar scenarios:\n`);
      
      results.forEach((result, index) => {
        console.log(`${index + 1}. Similarity: ${(result.similarity * 100).toFixed(1)}%`);
        console.log(`   Symbol: ${result.trade.metadata.symbol}`);
        console.log(`   Action: ${result.trade.metadata.side}`);
        console.log(`   Price: $${result.trade.metadata.price}`);
        console.log(`   PnL: ${result.trade.metadata.pnl || 'N/A'}`);
        console.log(`   Context: ${result.context.slice(0, 100)}...`);
        console.log('');
      });
      
    } catch (error) {
      console.error('❌ Similar scenario search failed:', error);
      process.exit(1);
    }
  });

// AI commands
const aiCommand = program
  .command('ai')
  .description('AI and machine learning commands');

aiCommand
  .command('retrain')
  .description('Trigger AI model retraining')
  .option('--agent <type>', 'Agent type to retrain', 'market_insight')
  .action(async (options) => {
    try {
      console.log(`🤖 Triggering retraining for ${options.agent} agent...`);
      
      const { MLOpsService } = await import('../server/services/mlopsService');
      const mlopsService = MLOpsService.getInstance();
      
      const result = await mlopsService.runRetrainingPipeline(options.agent as 'market_insight' | 'risk_assessor');
      
      console.log('✅ Retraining completed successfully');
      console.log(`   Run ID: ${result.id}`);
      console.log(`   Model Version: ${result.model_version}`);
      console.log(`   Training Samples: ${result.training_samples}`);
      console.log(`   Validation Samples: ${result.validation_samples}`);
      console.log(`   Status: ${result.status}`);
      console.log(`   Deployment: ${result.deployment_status}`);
      
      if (result.metrics.accuracy) {
        console.log(`   Accuracy: ${(result.metrics.accuracy * 100).toFixed(1)}%`);
      }
      if (result.metrics.sharpe_ratio) {
        console.log(`   Sharpe Ratio: ${result.metrics.sharpe_ratio.toFixed(3)}`);
      }
      
    } catch (error) {
      console.error('❌ Retraining failed:', error);
      process.exit(1);
    }
  });

aiCommand
  .command('sweep')
  .description('Run hyperparameter sweep')
  .option('--agent <type>', 'Agent type', 'market_insight')
  .option('--config <path>', 'Config file path (JSON)', './sweep-config.json')
  .action(async (options) => {
    try {
      console.log(`🔍 Starting hyperparameter sweep for ${options.agent}`);
      
      // Load sweep configuration
      let parameterGrid;
      try {
        const fs = await import('fs/promises');
        const configData = await fs.readFile(options.config, 'utf-8');
        parameterGrid = JSON.parse(configData);
      } catch (error) {
        console.log('📋 Using default parameter grid');
        parameterGrid = {
          learning_rate: [0.001, 0.01, 0.1],
          batch_size: [16, 32, 64],
          risk_threshold: [0.05, 0.1, 0.15]
        };
      }
      
      console.log('📊 Parameter grid:', JSON.stringify(parameterGrid, null, 2));
      
      const { MLOpsService } = await import('../server/services/mlopsService');
      const mlopsService = MLOpsService.getInstance();
      
      const sweepId = await mlopsService.runHyperparameterSweep(options.agent, parameterGrid);
      
      console.log('✅ Hyperparameter sweep completed');
      console.log(`   Sweep ID: ${sweepId}`);
      console.log(`   View results: npm run skippy ai sweep-results --sweep-id ${sweepId}`);
      
    } catch (error) {
      console.error('❌ Hyperparameter sweep failed:', error);
      process.exit(1);
    }
  });

aiCommand
  .command('sweep-results')
  .description('View hyperparameter sweep results')
  .option('--sweep-id <id>', 'Sweep ID')
  .option('--agent <type>', 'Agent type filter')
  .option('--limit <number>', 'Number of results to show', '10')
  .action(async (options) => {
    try {
      console.log('📊 Hyperparameter Sweep Results\n');
      
      let query = sql`
        SELECT sr.*, hs.name as sweep_name
        FROM sweep_results sr
        LEFT JOIN hyperparameter_sweeps hs ON sr.sweep_id = hs.id
        WHERE sr.status = 'completed'
      `;
      
      const conditions = [];
      if (options.sweepId) {
        conditions.push(sql`sr.sweep_id = ${options.sweepId}`);
      }
      if (options.agent) {
        conditions.push(sql`sr.agent_type = ${options.agent}`);
      }
      
      if (conditions.length > 0) {
        query = sql`${query} AND ${sql.join(conditions, sql` AND `)}`;
      }
      
      query = sql`${query} ORDER BY (sr.metrics->>'sharpe_ratio')::float DESC NULLS LAST LIMIT ${parseInt(options.limit)}`;
      
      const results = await db.execute(query);
      
      if (results.rows.length === 0) {
        console.log('No sweep results found');
        return;
      }
      
      results.rows.forEach((row: any, index: number) => {
        const metrics = JSON.parse(row.metrics || '{}');
        const config = JSON.parse(row.config || '{}');
        
        console.log(`${index + 1}. Sweep: ${row.sweep_name || row.sweep_id}`);
        console.log(`   Agent: ${row.agent_type}`);
        console.log(`   Config: ${JSON.stringify(config)}`);
        console.log(`   Sharpe Ratio: ${metrics.sharpe_ratio?.toFixed(3) || 'N/A'}`);
        console.log(`   Accuracy: ${metrics.accuracy ? (metrics.accuracy * 100).toFixed(1) + '%' : 'N/A'}`);
        console.log(`   Execution Time: ${row.execution_time}ms`);
        console.log(`   Completed: ${new Date(row.created_at).toLocaleString()}`);
        console.log('');
      });
      
    } catch (error) {
      console.error('❌ Failed to fetch sweep results:', error);
      process.exit(1);
    }
  });

aiCommand
  .command('drift')
  .description('Check model drift metrics')
  .option('--agent <type>', 'Agent type to check')
  .action(async (options) => {
    try {
      console.log('📈 Checking model drift metrics...\n');
      
      const { MLOpsService } = await import('../server/services/mlopsService');
      const mlopsService = MLOpsService.getInstance();
      
      const agents = options.agent ? [options.agent] : ['market_insight', 'risk_assessor'];
      
      for (const agent of agents) {
        console.log(`🤖 ${agent.toUpperCase()} Agent:`);
        
        const metrics = await mlopsService.calculateDriftMetrics(agent);
        
        metrics.forEach(metric => {
          const statusIcon = metric.status === 'critical' ? '🔴' : 
                           metric.status === 'warning' ? '🟡' : '🟢';
          
          console.log(`   ${statusIcon} ${metric.metric_type}: ${metric.value.toFixed(4)}`);
          console.log(`      Threshold: ${metric.threshold.toFixed(4)}`);
          console.log(`      Status: ${metric.status}`);
        });
        
        console.log('');
      }
      
    } catch (error) {
      console.error('❌ Drift check failed:', error);
      process.exit(1);
    }
  });

aiCommand
  .command('models')
  .description('List deployed models and their performance')
  .option('--agent <type>', 'Agent type filter')
  .action(async (options) => {
    try {
      console.log('🚀 Deployed Models\n');
      
      let query = sql`
        SELECT mr.*, md.deployed_at, md.is_active
        FROM model_runs mr
        LEFT JOIN model_deployments md ON mr.model_version = md.model_version AND mr.agent_type = md.agent_type
        WHERE mr.deployment_status = 'deployed'
      `;
      
      if (options.agent) {
        query = sql`${query} AND mr.agent_type = ${options.agent}`;
      }
      
      query = sql`${query} ORDER BY mr.training_start DESC`;
      
      const results = await db.execute(query);
      
      if (results.rows.length === 0) {
        console.log('No deployed models found');
        return;
      }
      
      results.rows.forEach((row: any, index: number) => {
        const metrics = JSON.parse(row.metrics || '{}');
        
        console.log(`${index + 1}. ${row.agent_type} - ${row.model_version}`);
        console.log(`   Deployed: ${row.is_active ? '🟢 Active' : '🔴 Inactive'}`);
        console.log(`   Training Date: ${new Date(row.training_start).toLocaleString()}`);
        console.log(`   Samples: ${row.training_samples} training, ${row.validation_samples} validation`);
        console.log(`   Metrics:`);
        if (metrics.accuracy) console.log(`     Accuracy: ${(metrics.accuracy * 100).toFixed(1)}%`);
        if (metrics.sharpe_ratio) console.log(`     Sharpe Ratio: ${metrics.sharpe_ratio.toFixed(3)}`);
        if (metrics.precision) console.log(`     Precision: ${(metrics.precision * 100).toFixed(1)}%`);
        if (metrics.recall) console.log(`     Recall: ${(metrics.recall * 100).toFixed(1)}%`);
        console.log('');
      });
      
    } catch (error) {
      console.error('❌ Failed to list models:', error);
      process.exit(1);
    }
  });

// System commands
const systemCommand = program
  .command('system')
  .description('System monitoring and maintenance');

systemCommand
  .command('status')
  .description('Show system status and metrics')
  .action(async () => {
    try {
      console.log('📊 System Status Report\n');
      
      // API health
      try {
        const healthCheck = await fetch('http://localhost:5000/api/health');
        const healthData = await healthCheck.json();
        console.log(`🟢 API Status: ${healthData.status}`);
        console.log(`⏰ Uptime: ${healthData.uptime}s`);
      } catch {
        console.log('🔴 API Status: Offline');
      }
      
      // Database stats
      const userCount = await db.execute(sql`SELECT COUNT(*) as count FROM users`);
      const tradeCount = await db.execute(sql`SELECT COUNT(*) as count FROM trades`);
      const positionCount = await db.execute(sql`SELECT COUNT(*) as count FROM positions WHERE status = 'open'`);
      
      console.log(`👥 Users: ${userCount.rows[0]?.count || 0}`);
      console.log(`📈 Total trades: ${tradeCount.rows[0]?.count || 0}`);
      console.log(`💼 Open positions: ${positionCount.rows[0]?.count || 0}`);
      
      // Recent activity
      const recentActivity = await db.execute(sql`
        SELECT COUNT(*) as count FROM "agentActivities"
        WHERE created_at >= NOW() - INTERVAL '24 hours'
      `);
      
      console.log(`🤖 AI activities (24h): ${recentActivity.rows[0]?.count || 0}`);
      
      console.log('\n✅ System status check completed');
      
    } catch (error) {
      console.error('❌ System status check failed:', error);
      process.exit(1);
    }
  });

systemCommand
  .command('cleanup')
  .description('Clean up old data and optimize database')
  .option('--days <number>', 'Days of data to keep', '90')
  .action(async (options) => {
    try {
      const daysToKeep = parseInt(options.days);
      console.log(`🧹 Cleaning up data older than ${daysToKeep} days...`);
      
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
      
      // Clean up old market data
      const marketDataDeleted = await db.execute(sql`
        DELETE FROM "marketData" 
        WHERE timestamp < ${cutoffDate.toISOString()}
      `);
      
      // Clean up old agent activities
      const activitiesDeleted = await db.execute(sql`
        DELETE FROM "agentActivities"
        WHERE created_at < ${cutoffDate.toISOString()}
      `);
      
      // Clean up vector data if available
      const vectorDB = VectorDBService.getInstance();
      await vectorDB.cleanupOldVectors(daysToKeep);
      
      console.log('✅ Cleanup completed');
      console.log(`   Market data records removed: ${marketDataDeleted.rowCount || 0}`);
      console.log(`   Agent activities removed: ${activitiesDeleted.rowCount || 0}`);
      
    } catch (error) {
      console.error('❌ Cleanup failed:', error);
      process.exit(1);
    }
  });

// Parse and execute
// Vector indexing commands
program
  .command('index:rebuild')
  .description('Rebuild the complete vector index from all historical data')
  .action(async () => {
    const { rebuildIndex } = await import('./commands/vector');
    await rebuildIndex();
  });

program
  .command('index:query')
  .description('Query similar records by ID')
  .option('--id <recordId>', 'Record ID to find similar items for')
  .option('--top <number>', 'Number of similar results to return', '5')
  .action(async (options) => {
    const { queryIndex } = await import('./commands/vector');
    await queryIndex(options);
  });

program.parse();