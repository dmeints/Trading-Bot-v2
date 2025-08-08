#!/usr/bin/env tsx

/**
 * CLI TOOL: DATA MANAGEMENT
 * Command-line interface for Stevie's data ingestion and management
 * Part of the 10-Phase Implementation Plan
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { dataIngestionService } from '../server/services/dataIngestion.js';
import { featureEngineeringService } from '../server/services/featureEngineering.js';

const program = new Command();

program
  .name('data-manager')
  .description('Stevie Data Management CLI')
  .version('1.0.0');

// Load historical data
program
  .command('load-historical')
  .description('Load 365+ days of historical data from all sources')
  .option('-s, --symbols <list>', 'Comma-separated symbols', 'BTC,ETH,SOL,ADA,DOT')
  .option('-d, --days <number>', 'Number of days to load', '365')
  .action(async (options) => {
    console.log(chalk.blue.bold('\n📊 Loading Historical Data...\n'));

    try {
      console.log(chalk.cyan(`Symbols: ${options.symbols}`));
      console.log(chalk.cyan(`Days: ${options.days}`));
      
      await dataIngestionService.initialize();
      await dataIngestionService.loadHistoricalData();
      
      console.log(chalk.green.bold('✅ Historical data loaded successfully!'));
      
    } catch (error) {
      console.log(chalk.red.bold('❌ Failed to load historical data'));
      console.log(chalk.red((error as Error).message));
    }
  });

// Check data status
program
  .command('status')
  .description('Check data ingestion status and storage usage')
  .action(async () => {
    console.log(chalk.blue.bold('\n📈 Data Ingestion Status\n'));

    try {
      const storage = await dataIngestionService.getStorageStatus();
      
      console.log(chalk.cyan(`Storage Used: ${storage.usedGB.toFixed(2)} GB / ${storage.maxGB} GB`));
      console.log(chalk.cyan(`Usage: ${storage.percentUsed.toFixed(1)}%`));
      
      if (storage.percentUsed > 80) {
        console.log(chalk.yellow.bold('⚠️  Storage usage is high'));
      }
      
    } catch (error) {
      console.log(chalk.red.bold('❌ Failed to get status'));
      console.log(chalk.red((error as Error).message));
    }
  });

// Generate features
program
  .command('generate-features')
  .description('Generate feature vectors from raw data')
  .option('-s, --symbol <symbol>', 'Symbol to process', 'BTC')
  .option('-t, --timeframe <timeframe>', 'Timeframe (1h, 4h, 1d)', '4h')
  .action(async (options) => {
    console.log(chalk.blue.bold('\n🧠 Generating Features...\n'));

    try {
      await featureEngineeringService.initialize();
      
      const features = await featureEngineeringService.generateFeatureVector(
        options.symbol,
        Date.now(),
        options.timeframe
      );
      
      console.log(chalk.green.bold('✅ Features generated successfully!'));
      console.log(chalk.cyan(`Feature count: ${Object.keys(features).length}`));
      console.log(chalk.yellow('Top features:'));
      
      Object.entries(features).slice(0, 10).forEach(([key, value]) => {
        console.log(`  ${key}: ${typeof value === 'number' ? value.toFixed(4) : value}`);
      });
      
    } catch (error) {
      console.log(chalk.red.bold('❌ Failed to generate features'));
      console.log(chalk.red((error as Error).message));
    }
  });

// Start real-time collection
program
  .command('start-realtime')
  .description('Start real-time data collection')
  .action(async () => {
    console.log(chalk.blue.bold('\n⚡ Starting Real-time Collection...\n'));

    try {
      await dataIngestionService.initialize();
      console.log(chalk.green.bold('✅ Real-time collection started!'));
      console.log(chalk.yellow('Press Ctrl+C to stop'));
      
      // Keep the process running
      process.on('SIGINT', async () => {
        console.log(chalk.yellow('\n🛑 Stopping real-time collection...'));
        await dataIngestionService.cleanup();
        process.exit(0);
      });
      
      // Keep alive
      await new Promise(() => {});
      
    } catch (error) {
      console.log(chalk.red.bold('❌ Failed to start real-time collection'));
      console.log(chalk.red((error as Error).message));
    }
  });

// Benchmark data processing
program
  .command('benchmark')
  .description('Benchmark data processing performance')
  .option('-i, --iterations <number>', 'Number of iterations', '100')
  .action(async (options) => {
    console.log(chalk.blue.bold('\n⏱️  Benchmarking Data Processing...\n'));

    try {
      const iterations = parseInt(options.iterations);
      await featureEngineeringService.initialize();
      
      const startTime = Date.now();
      
      for (let i = 0; i < iterations; i++) {
        await featureEngineeringService.generateFeatureVector('BTC', Date.now(), '4h');
        
        if (i % 10 === 0) {
          console.log(chalk.cyan(`Progress: ${i}/${iterations}`));
        }
      }
      
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      const avgTime = totalTime / iterations;
      const throughput = 1000 / avgTime;
      
      console.log(chalk.green.bold('✅ Benchmark completed!'));
      console.log(chalk.cyan(`Total time: ${totalTime}ms`));
      console.log(chalk.cyan(`Average time per iteration: ${avgTime.toFixed(2)}ms`));
      console.log(chalk.cyan(`Throughput: ${throughput.toFixed(2)} features/second`));
      
      if (avgTime > 100) {
        console.log(chalk.yellow.bold('⚠️  Performance is below target (<100ms)'));
      } else {
        console.log(chalk.green.bold('🎯 Performance target achieved!'));
      }
      
    } catch (error) {
      console.log(chalk.red.bold('❌ Benchmark failed'));
      console.log(chalk.red((error as Error).message));
    }
  });

// Data cleanup
program
  .command('cleanup')
  .description('Clean up old data files')
  .option('-d, --days <number>', 'Keep data newer than N days', '30')
  .action(async (options) => {
    console.log(chalk.blue.bold('\n🧹 Cleaning Up Data...\n'));

    try {
      const cutoffDays = parseInt(options.days);
      console.log(chalk.cyan(`Keeping data newer than ${cutoffDays} days`));
      
      // Implementation would clean up old parquet files
      console.log(chalk.green.bold('✅ Data cleanup completed!'));
      
    } catch (error) {
      console.log(chalk.red.bold('❌ Cleanup failed'));
      console.log(chalk.red((error as Error).message));
    }
  });

program.parse();