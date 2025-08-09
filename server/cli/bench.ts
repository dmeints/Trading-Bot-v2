#!/usr/bin/env tsx

import { Command } from 'commander';
import { stevieRealBenchmark } from '../services/stevieRealBenchmark';
import { logger } from '../utils/logger';
import { execSync } from 'child_process';

const program = new Command();

program
  .name('bench')
  .description('Skippy algorithm benchmarking CLI')
  .version('1.0.0');

program
  .command('run')
  .description('Run algorithm benchmark')
  .option('--strategy <strategy>', 'Strategy name', 'stevie')
  .option('--version <version>', 'Algorithm version', '1.6')
  .option('--symbols <symbols>', 'Trading symbols (comma-separated)', 'BTCUSDT,ETHUSDT')
  .option('--timeframe <timeframe>', 'Timeframe', '5m')
  .option('--from <from>', 'Start date (ISO)', '2024-01-01')
  .option('--to <to>', 'End date (ISO)', '2024-01-02')
  .option('--fee-bps <feeBps>', 'Fee in basis points', '2')
  .option('--slip-bps <slipBps>', 'Slippage in basis points', '1')
  .option('--rng-seed <seed>', 'Random seed for reproducibility', '42')
  .action(async (options) => {
    try {
      logger.info(`[CLI] Starting benchmark: ${options.strategy} ${options.version}`);
      
      const symbols = options.symbols.split(',').map((s: string) => s.trim());
      const config = {
        version: options.version,
        testPeriodDays: Math.ceil((new Date(options.to).getTime() - new Date(options.from).getTime()) / (24 * 60 * 60 * 1000)),
        initialCapital: 10000,
        symbols,
        compareToVersion: undefined
      };

      const result = await stevieRealBenchmark.runRealAlgorithmBenchmark(config);
      
      console.log('\n=== BENCHMARK RESULTS ===');
      console.log(`Run ID: ${result.runId}`);
      console.log(`Version: ${result.version}`);
      console.log(`Cash Reserve Score: ${result.cashReserveGrowthScore}/100`);
      console.log(`Total Return: ${(result.algorithmPerformance.totalReturn * 100).toFixed(2)}%`);
      console.log(`Sharpe Ratio: ${result.algorithmPerformance.sharpeRatio.toFixed(2)}`);
      console.log(`Win Rate: ${(result.algorithmPerformance.winRate * 100).toFixed(1)}%`);
      console.log(`Max Drawdown: ${(result.algorithmPerformance.maxDrawdown * 100).toFixed(2)}%`);
      
      if (result.recommendations.length > 0) {
        console.log('\nRecommendations:');
        result.recommendations.forEach((rec, i) => {
          console.log(`  ${i + 1}. ${rec}`);
        });
      }
      
      console.log(`\nArtifacts saved to: ./artifacts/${result.runId}/`);
      
    } catch (error) {
      logger.error('[CLI] Benchmark failed:', error);
      process.exit(1);
    }
  });

program
  .command('compare')
  .description('Compare two benchmark runs')
  .argument('<runIdA>', 'First run ID')
  .argument('<runIdB>', 'Second run ID')
  .action(async (runIdA, runIdB) => {
    try {
      // TODO: Implement comparison logic
      console.log(`Comparing ${runIdA} vs ${runIdB}`);
      console.log('Comparison feature coming soon...');
    } catch (error) {
      logger.error('[CLI] Comparison failed:', error);
      process.exit(1);
    }
  });

program
  .command('history')
  .description('List recent benchmark runs')
  .option('--limit <limit>', 'Number of results', '10')
  .action(async (options) => {
    try {
      // TODO: Query database for recent runs
      console.log(`Showing last ${options.limit} benchmark runs:`);
      console.log('History feature coming soon...');
    } catch (error) {
      logger.error('[CLI] History failed:', error);
      process.exit(1);
    }
  });

if (require.main === module) {
  program.parse();
}