#!/usr/bin/env tsx

/**
 * CLI TOOL: PAPER RUN MANAGEMENT
 * Command-line interface for starting, monitoring, and managing paper runs
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ExchangeService, { ExchangeConfig, PaperRunConfig } from '../server/services/exchangeService';
import { trainingIterator } from '../server/training/trainIterate';
import { onlineTrainer } from '../server/training/onlineTrainer';

const program = new Command();

// Initialize exchange service
const defaultConfig: ExchangeConfig = {
  mode: 'paper',
  exchange: 'mock',
  testnet: true,
  maxPositionSize: 0.1,
  riskPerTrade: 0.02,
  killSwitchEnabled: true,
  killSwitchConditions: {
    maxDailyLoss: 5,
    maxDrawdown: 10,
    minWinRate: 40
  }
};

const exchangeService = new ExchangeService(defaultConfig);

program
  .name('paperrun')
  .description('Stevie Paper Run Management CLI')
  .version('1.0.0');

// Start paper run
program
  .command('start')
  .description('Start a new paper run')
  .option('-d, --duration <days>', 'Duration in days', '30')
  .option('-b, --balance <amount>', 'Initial balance', '10000')
  .option('-s, --symbols <list>', 'Comma-separated symbols', 'BTC,ETH,SOL')
  .option('-w, --warmup <days>', 'Warmup period in days', '7')
  .option('-c, --canary <percentage>', 'Canary percentage (0-100)', '0')
  .action(async (options) => {
    console.log(chalk.blue.bold('\n🚀 Starting Paper Run...\n'));

    const config: PaperRunConfig = {
      duration: parseInt(options.duration),
      initialBalance: parseFloat(options.balance),
      symbols: options.symbols.split(',').map((s: string) => s.trim().toUpperCase()),
      warmupDays: parseInt(options.warmup),
      canaryPercentage: parseInt(options.canary),
      monitoringInterval: 60000 // 1 minute
    };

    try {
      await exchangeService.initialize();
      const runId = await exchangeService.startPaperRun(config);
      
      console.log(chalk.green.bold('✅ Paper run started successfully!'));
      console.log(chalk.yellow(`📊 Run ID: ${runId}`));
      console.log(chalk.cyan(`💰 Initial Balance: $${config.initialBalance.toLocaleString()}`));
      console.log(chalk.cyan(`⏱️  Duration: ${config.duration} days`));
      console.log(chalk.cyan(`📈 Symbols: ${config.symbols.join(', ')}`));
      
      if (config.canaryPercentage > 0) {
        console.log(chalk.magenta(`🐤 Canary Deployment: ${config.canaryPercentage}%`));
      }
      
    } catch (error) {
      console.log(chalk.red.bold('❌ Failed to start paper run'));
      console.log(chalk.red((error as Error).message));
    }
  });

// Check status
program
  .command('status')
  .description('Check current paper run status')
  .action(async () => {
    console.log(chalk.blue.bold('\n📊 Paper Run Status\n'));

    try {
      const currentRun = await exchangeService.getCurrentRun();
      
      if (!currentRun) {
        console.log(chalk.yellow('No active paper run'));
        return;
      }

      console.log(chalk.cyan(`Run ID: ${currentRun.runId}`));
      console.log(chalk.cyan(`Status: ${currentRun.status.toUpperCase()}`));
      console.log(chalk.cyan(`Duration: ${Math.floor((Date.now() - currentRun.startTime) / (24 * 60 * 60 * 1000))} days elapsed`));
      
      const perf = currentRun.performance;
      console.log(chalk.green(`\n📈 Performance:`));
      console.log(`  Total Return: ${perf.totalReturn.toFixed(2)}%`);
      console.log(`  Sharpe Ratio: ${perf.sharpeRatio.toFixed(2)}`);
      console.log(`  Win Rate: ${perf.winRate.toFixed(1)}%`);
      console.log(`  Total Trades: ${perf.totalTrades}`);
      console.log(`  Final Balance: $${perf.finalBalance.toLocaleString()}`);
      
      if (currentRun.killSwitchTriggered) {
        console.log(chalk.red.bold('\n🚨 KILL SWITCH TRIGGERED'));
        console.log(chalk.red(`Reason: ${currentRun.killSwitchTriggered.reason}`));
      }
      
    } catch (error) {
      console.log(chalk.red.bold('❌ Failed to get status'));
      console.log(chalk.red((error as Error).message));
    }
  });

// Stop paper run
program
  .command('stop')
  .description('Stop current paper run')
  .option('-r, --reason <reason>', 'Reason for stopping', 'Manual stop')
  .action(async (options) => {
    console.log(chalk.yellow.bold('\n🛑 Stopping Paper Run...\n'));

    try {
      await exchangeService.stopCurrentRun(options.reason);
      console.log(chalk.green.bold('✅ Paper run stopped successfully'));
      
    } catch (error) {
      console.log(chalk.red.bold('❌ Failed to stop paper run'));
      console.log(chalk.red((error as Error).message));
    }
  });

// View positions
program
  .command('positions')
  .description('View current positions')
  .action(async () => {
    console.log(chalk.blue.bold('\n💼 Current Positions\n'));

    try {
      const positions = await exchangeService.getPositions();
      const positionsArray = Array.from(positions.values());
      
      if (positionsArray.length === 0) {
        console.log(chalk.yellow('No open positions'));
        return;
      }

      positionsArray.forEach(position => {
        console.log(chalk.cyan(`${position.symbol}:`));
        console.log(`  Size: ${position.size.toFixed(4)}`);
        console.log(`  Avg Price: $${position.avgPrice.toFixed(2)}`);
        console.log(`  Value: $${(position.size * position.avgPrice).toFixed(2)}`);
        console.log();
      });
      
    } catch (error) {
      console.log(chalk.red.bold('❌ Failed to get positions'));
      console.log(chalk.red((error as Error).message));
    }
  });

// View history
program
  .command('history')
  .description('View paper run history')
  .option('-l, --limit <number>', 'Limit number of results', '10')
  .action(async (options) => {
    console.log(chalk.blue.bold('\n📚 Paper Run History\n'));

    try {
      const history = await exchangeService.getRunHistory();
      const limit = parseInt(options.limit);
      const limitedHistory = history.slice(0, limit);
      
      if (limitedHistory.length === 0) {
        console.log(chalk.yellow('No paper run history'));
        return;
      }

      limitedHistory.forEach((run, index) => {
        const date = new Date(run.startTime).toLocaleDateString();
        const duration = Math.floor(run.duration);
        const status = run.status.toUpperCase();
        const returns = run.performance.totalReturn.toFixed(2);
        
        console.log(chalk.cyan(`${index + 1}. ${run.runId}`));
        console.log(`   Date: ${date} | Duration: ${duration}d | Status: ${status}`);
        console.log(`   Return: ${returns}% | Sharpe: ${run.performance.sharpeRatio.toFixed(2)} | Win Rate: ${run.performance.winRate.toFixed(1)}%`);
        console.log();
      });
      
    } catch (error) {
      console.log(chalk.red.bold('❌ Failed to get history'));
      console.log(chalk.red((error as Error).message));
    }
  });

// Training commands
program
  .command('train')
  .description('Start iterative training process')
  .option('-i, --iterations <number>', 'Max iterations', '50')
  .option('-t, --threshold <number>', 'Plateau threshold', '0.005')
  .action(async (options) => {
    console.log(chalk.blue.bold('\n🎯 Starting Iterative Training...\n'));

    try {
      const maxIterations = parseInt(options.iterations);
      const threshold = parseFloat(options.threshold);
      
      await trainingIterator.startIterativeTraining(maxIterations, threshold);
      
    } catch (error) {
      console.log(chalk.red.bold('❌ Training failed'));
      console.log(chalk.red((error as Error).message));
    }
  });

// Online training commands
program
  .command('online-train')
  .description('Manage online training system')
  .option('--start', 'Start online training')
  .option('--stop', 'Stop online training')  
  .option('--status', 'Check training status')
  .option('--trigger', 'Manually trigger training')
  .action(async (options) => {
    try {
      if (options.start) {
        console.log(chalk.blue.bold('\n🔄 Starting Online Training...\n'));
        await onlineTrainer.initialize();
        console.log(chalk.green.bold('✅ Online training started'));
        
      } else if (options.stop) {
        console.log(chalk.yellow.bold('\n🛑 Stopping Online Training...\n'));
        await onlineTrainer.shutdown();
        console.log(chalk.green.bold('✅ Online training stopped'));
        
      } else if (options.status) {
        console.log(chalk.blue.bold('\n📊 Online Training Status\n'));
        const driftStatus = await onlineTrainer.getDriftStatus();
        
        console.log(`Alert Counts: Green: ${driftStatus.alertCount.green}, Yellow: ${driftStatus.alertCount.yellow}, Red: ${driftStatus.alertCount.red}`);
        console.log(`Recent Rollbacks: ${driftStatus.recentRollbacks.length}`);
        
      } else if (options.trigger) {
        console.log(chalk.blue.bold('\n⚡ Triggering Manual Training...\n'));
        await onlineTrainer.forceTriggerTraining();
        console.log(chalk.green.bold('✅ Manual training completed'));
        
      } else {
        console.log(chalk.yellow('Please specify an action: --start, --stop, --status, or --trigger'));
      }
      
    } catch (error) {
      console.log(chalk.red.bold('❌ Online training command failed'));
      console.log(chalk.red((error as Error).message));
    }
  });

// Canary deployment
program
  .command('canary')
  .description('Start canary deployment')
  .option('-p, --percentage <percent>', 'Canary percentage', '25')
  .option('-d, --duration <days>', 'Duration in days', '7')
  .option('-b, --balance <amount>', 'Initial balance', '5000')
  .action(async (options) => {
    console.log(chalk.blue.bold('\n🐤 Starting Canary Deployment...\n'));

    const config: PaperRunConfig = {
      duration: parseInt(options.duration),
      initialBalance: parseFloat(options.balance),
      symbols: ['BTC', 'ETH', 'SOL'],
      warmupDays: 2,
      canaryPercentage: parseInt(options.percentage),
      monitoringInterval: 60000
    };

    try {
      await exchangeService.initialize();
      const runId = await exchangeService.startPaperRun(config);
      
      console.log(chalk.green.bold('✅ Canary deployment started!'));
      console.log(chalk.yellow(`📊 Run ID: ${runId}`));
      console.log(chalk.magenta(`🐤 Canary Size: ${config.canaryPercentage}%`));
      console.log(chalk.cyan(`⏱️  Duration: ${config.duration} days`));
      
    } catch (error) {
      console.log(chalk.red.bold('❌ Failed to start canary deployment'));
      console.log(chalk.red((error as Error).message));
    }
  });

program.parse();