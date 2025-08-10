#!/usr/bin/env tsx

/**
 * CLI TOOL: PAPER RUN BURN-IN MANAGEMENT
 * Command-line interface for managing paper trade burn-in sessions and reporting
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { paperTradeBridge, type BurnInReport } from '../server/services/paperTradeBridge.js';
import { logger } from '../server/utils/logger.js';
import fs from 'fs/promises'; // Import fs/promises

const program = new Command();

program
  .name('paperrun-cli')
  .description('Paper Trade Burn-In Management CLI')
  .version('1.0.0');

// Start burn-in session
program
  .command('start')
  .description('Start a new paper trade burn-in session')
  .option('-d, --duration <days>', 'Burn-in duration in days', '7')
  .option('-s, --symbols <list>', 'Comma-separated symbols', 'BTC,ETH,SOL')
  .option('-c, --capital <amount>', 'Initial capital', '100000')
  .option('-v, --verbose', 'Verbose output')
  .action(async (options) => {
    console.log(chalk.blue.bold('\n🔥 Starting Paper Trade Burn-In...\n'));

    try {
      await paperTradeBridge.initialize();

      const sessionConfig = {
        symbols: options.symbols.split(',').map((s: string) => s.trim().toUpperCase()),
        initialCapital: parseFloat(options.capital),
        strategy: 'burn_in_test'
      };

      // Update bridge config
      paperTradeBridge.updateConfig({
        burnInDurationDays: parseInt(options.duration),
        reportingEnabled: true
      });

      const sessionId = await paperTradeBridge.startBurnIn(sessionConfig);

      console.log(chalk.green.bold('✅ Burn-in session started successfully!'));
      console.log(chalk.yellow(`📊 Session ID: ${sessionId}`));
      console.log(chalk.cyan(`⏱️  Duration: ${options.duration} days`));
      console.log(chalk.cyan(`💰 Initial Capital: $${parseFloat(options.capital).toLocaleString()}`));
      console.log(chalk.cyan(`📈 Symbols: ${sessionConfig.symbols.join(', ')}`));

      if (options.verbose) {
        console.log(chalk.gray('\nMonitoring metrics aggregation every minute...'));
        console.log(chalk.gray('Use "paperrun-cli status <sessionId>" to check progress'));
      }

    } catch (error) {
      console.log(chalk.red.bold('❌ Failed to start burn-in session'));
      console.log(chalk.red((error as Error).message));
      process.exit(1);
    }
  });

// Check burn-in status
program
  .command('status')
  .description('Check burn-in session status')
  .argument('[sessionId]', 'Session ID to check (latest if not provided)')
  .option('-v, --verbose', 'Verbose output with detailed metrics')
  .option('-j, --json', 'Output in JSON format')
  .action(async (sessionId, options) => {
    try {
      await paperTradeBridge.initialize();

      let report: BurnInReport | null = null;

      if (sessionId) {
        report = paperTradeBridge.getBurnInReport(sessionId);
      } else {
        // Get latest active session
        const activeSessions = paperTradeBridge.getActiveSessions();
        if (activeSessions.length > 0) {
          const latestSession = activeSessions[activeSessions.length - 1];
          report = paperTradeBridge.getBurnInReport(latestSession.id);
          sessionId = latestSession.id;
        }
      }

      if (!report) {
        console.log(chalk.yellow('No active burn-in session found'));
        return;
      }

      if (options.json) {
        console.log(JSON.stringify(report, null, 2));
        return;
      }

      console.log(chalk.blue.bold('\n📊 Paper Trade Burn-In Status\n'));

      // Status overview
      const statusColor = report.status === 'active' ? chalk.green : 
                         report.status === 'completed' ? chalk.blue : chalk.red;

      console.log(chalk.cyan(`Session ID: ${report.sessionId}`));
      console.log(`Status: ${statusColor(report.status.toUpperCase())}`);
      console.log(chalk.cyan(`Duration: ${report.duration} days`));

      if (report.status === 'active') {
        const elapsed = Math.floor((Date.now() - new Date(report.startDate).getTime()) / (24 * 60 * 60 * 1000));
        const remaining = Math.max(0, report.duration - elapsed);
        console.log(chalk.yellow(`Progress: ${elapsed}/${report.duration} days (${remaining} days remaining)`));
      }

      // Performance summary
      console.log(chalk.green(`\n📈 Performance Summary:`));
      console.log(`  Total Trades: ${report.summary.totalTrades}`);
      console.log(`  Total P&L: $${report.summary.totalPnL.toFixed(2)}`);
      console.log(`  Final Balance: $${report.summary.finalBalance.toLocaleString()}`);
      console.log(`  Win Rate: ${(report.summary.winRate * 100).toFixed(1)}%`);
      console.log(`  Sharpe Ratio: ${report.summary.sharpeRatio.toFixed(2)}`);
      console.log(`  Profit Factor: ${report.summary.profitFactor.toFixed(2)}`);
      console.log(`  Max Drawdown: ${(report.summary.maxDrawdown * 100).toFixed(1)}%`);

      // Risk metrics
      if (options.verbose) {
        console.log(chalk.red(`\n⚠️  Risk Metrics:`));
        console.log(`  VaR 95%: $${report.riskMetrics.var95.toFixed(2)}`);
        console.log(`  VaR 99%: $${report.riskMetrics.var99.toFixed(2)}`);
        console.log(`  Expected Shortfall: $${report.riskMetrics.expectedShortfall.toFixed(2)}`);
        console.log(`  Recovery Factor: ${report.riskMetrics.recoveryFactor.toFixed(2)}`);
      }

      // Execution quality
      console.log(chalk.magenta(`\n⚡ Execution Quality:`));
      console.log(`  Avg Slippage: ${(report.executionQuality.avgSlippage * 100).toFixed(3)}%`);
      console.log(`  Fill Rate: ${(report.executionQuality.fillRate * 100).toFixed(1)}%`);
      console.log(`  Avg Latency: ${report.executionQuality.latencyP95.toFixed(0)}ms`);

      // Live parity check
      const parityStatus = 
        report.liveParityCheck.logicMatch && 
        report.liveParityCheck.riskMatch && 
        report.liveParityCheck.executionMatch;

      const parityColor = parityStatus ? chalk.green : chalk.red;
      console.log(chalk.blue(`\n🔍 Live Parity Check:`));
      console.log(`  Status: ${parityColor(parityStatus ? 'PASS' : 'FAIL')}`);
      console.log(`  Logic Match: ${report.liveParityCheck.logicMatch ? '✅' : '❌'}`);
      console.log(`  Risk Match: ${report.liveParityCheck.riskMatch ? '✅' : '❌'}`);
      console.log(`  Execution Match: ${report.liveParityCheck.executionMatch ? '✅' : '❌'}`);

      if (report.liveParityCheck.deviations.length > 0) {
        console.log(chalk.yellow(`\n⚠️  Deviations (${report.liveParityCheck.deviations.length}):`));
        report.liveParityCheck.deviations.slice(0, 5).forEach(deviation => {
          console.log(chalk.gray(`  • ${deviation}`));
        });
        if (report.liveParityCheck.deviations.length > 5) {
          console.log(chalk.gray(`  ... and ${report.liveParityCheck.deviations.length - 5} more`));
        }
      }

      // Daily aggregates (last 3 days)
      if (options.verbose && report.dailyAggregates.length > 0) {
        console.log(chalk.cyan(`\n📅 Recent Daily Performance:`));
        const recentAggregates = report.dailyAggregates.slice(-3);

        for (const aggregate of recentAggregates) {
          console.log(`\n  ${aggregate.date}:`);
          console.log(`    Trades: ${aggregate.metrics.totalTrades}`);
          console.log(`    P&L: $${aggregate.metrics.pnl.toFixed(2)}`);
          console.log(`    Win Rate: ${(aggregate.metrics.winRate * 100).toFixed(1)}%`);
          console.log(`    Sharpe: ${aggregate.metrics.sharpeRatio.toFixed(2)}`);
        }
      }

      // Recommendations
      if (report.recommendations.length > 0) {
        console.log(chalk.yellow(`\n💡 Recommendations:`));
        report.recommendations.forEach(rec => {
          console.log(`  • ${rec}`);
        });
      }

    } catch (error) {
      console.log(chalk.red.bold('❌ Failed to get burn-in status'));
      console.log(chalk.red((error as Error).message));
      process.exit(1);
    }
  });

// Stop burn-in session
program
  .command('stop')
  .description('Stop active burn-in session')
  .argument('[sessionId]', 'Session ID to stop (latest if not provided)')
  .option('-r, --reason <reason>', 'Reason for stopping', 'Manual stop')
  .action(async (sessionId, options) => {
    console.log(chalk.yellow.bold('\n🛑 Stopping Paper Trade Burn-In...\n'));

    try {
      await paperTradeBridge.initialize();

      if (!sessionId) {
        const activeSessions = paperTradeBridge.getActiveSessions();
        if (activeSessions.length === 0) {
          console.log(chalk.yellow('No active burn-in sessions found'));
          return;
        }
        sessionId = activeSessions[activeSessions.length - 1].id;
      }

      const finalReport = await paperTradeBridge.stopBurnIn(sessionId);

      console.log(chalk.green.bold('✅ Burn-in session stopped successfully'));
      console.log(chalk.yellow(`📊 Session ID: ${sessionId}`));
      console.log(chalk.cyan(`📋 Final Report Generated`));
      console.log(chalk.cyan(`💰 Final P&L: $${finalReport.summary.totalPnL.toFixed(2)}`);
      console.log(chalk.cyan(`📈 Total Trades: ${finalReport.summary.totalTrades}`));

      console.log(chalk.gray(`\nReason: ${options.reason}`));

    } catch (error) {
      console.log(chalk.red.bold('❌ Failed to stop burn-in session'));
      console.log(chalk.red((error as Error).message));
      process.exit(1);
    }
  });

// Generate detailed report
program
  .command('report')
  .description('Generate detailed burn-in report')
  .argument('<sessionId>', 'Session ID')
  .option('-f, --format <format>', 'Output format (text|json|csv)', 'text')
  .option('-o, --output <file>', 'Output file path')
  .action(async (sessionId, options) => {
    try {
      await paperTradeBridge.initialize();

      if (options.format === 'text') {
        const report = await paperTradeBridge.generateCliReport(sessionId);

        if (options.output) {
          await fs.writeFile(options.output, report);
          console.log(chalk.green(`Report saved to ${options.output}`));
        } else {
          console.log(report);
        }

      } else if (options.format === 'json') {
        const report = paperTradeBridge.getBurnInReport(sessionId);
        if (!report) {
          console.log(chalk.red('Session not found'));
          return;
        }

        const jsonReport = JSON.stringify(report, null, 2);

        if (options.output) {
          await fs.writeFile(options.output, jsonReport);
          console.log(chalk.green(`JSON report saved to ${options.output}`));
        } else {
          console.log(jsonReport);
        }

      } else if (options.format === 'csv') {
        const metrics = paperTradeBridge.getTradeMetrics(sessionId);
        if (metrics.length === 0) {
          console.log(chalk.yellow('No trade metrics found'));
          return;
        }

        // Generate CSV header
        const csvHeader = [
          'timestamp', 'symbol', 'side', 'quantity', 'price', 'fillPrice', 
          'slippage', 'latency', 'pnl', 'fees', 'positionSize', 'riskScore'
        ].join(',');

        // Generate CSV rows
        const csvRows = metrics.map(m => [
          new Date(m.timestamp).toISOString(),
          m.symbol,
          m.side,
          m.quantity,
          m.price,
          m.execution.fillPrice,
          m.execution.slippage,
          m.execution.latencyMs,
          m.pnl.total,
          m.pnl.fees,
          m.risk.positionSize,
          m.risk.riskScore
        ].join(','));

        const csvContent = [csvHeader, ...csvRows].join('\n');

        if (options.output) {
          await fs.writeFile(options.output, csvContent);
          console.log(chalk.green(`CSV report saved to ${options.output}`));
        } else {
          console.log(csvContent);
        }
      }

    } catch (error) {
      console.log(chalk.red.bold('❌ Failed to generate report'));
      console.log(chalk.red((error as Error).message));
      process.exit(1);
    }
  });

// List all burn-in sessions
program
  .command('list')
  .description('List all burn-in sessions')
  .option('-a, --all', 'Show all sessions including completed')
  .option('-j, --json', 'Output in JSON format')
  .action(async (options) => {
    try {
      await paperTradeBridge.initialize();

      const allReports = paperTradeBridge.getAllBurnInReports();
      const reports = options.all ? allReports : allReports.filter(r => r.status === 'active');

      if (options.json) {
        console.log(JSON.stringify(reports, null, 2));
        return;
      }

      if (reports.length === 0) {
        console.log(chalk.yellow('No burn-in sessions found'));
        return;
      }

      console.log(chalk.blue.bold('\n📋 Paper Trade Burn-In Sessions\n'));

      reports.forEach((report, index) => {
        const statusColor = report.status === 'active' ? chalk.green : 
                           report.status === 'completed' ? chalk.blue : chalk.red;

        console.log(`${index + 1}. ${chalk.cyan(report.sessionId)}`);
        console.log(`   Status: ${statusColor(report.status.toUpperCase())}`);
        console.log(`   Duration: ${report.duration} days`);
        console.log(`   Start: ${new Date(report.startDate).toLocaleDateString()}`);
        console.log(`   Trades: ${report.summary.totalTrades} | P&L: $${report.summary.totalPnL.toFixed(2)}`);
        console.log(`   Win Rate: ${(report.summary.winRate * 100).toFixed(1)}% | Sharpe: ${report.summary.sharpeRatio.toFixed(2)}`);
        console.log();
      });

    } catch (error) {
      console.log(chalk.red.bold('❌ Failed to list burn-in sessions'));
      console.log(chalk.red((error as Error).message));
      process.exit(1);
    }
  });

// Live metrics streaming
program
  .command('stream')
  .description('Stream live burn-in metrics')
  .argument('[sessionId]', 'Session ID to stream (latest if not provided)')
  .option('-i, --interval <seconds>', 'Update interval in seconds', '5')
  .action(async (sessionId, options) => {
    try {
      await paperTradeBridge.initialize();

      if (!sessionId) {
        const activeSessions = paperTradeBridge.getActiveSessions();
        if (activeSessions.length === 0) {
          console.log(chalk.yellow('No active burn-in sessions found'));
          return;
        }
        sessionId = activeSessions[activeSessions.length - 1].id;
      }

      const interval = parseInt(options.interval) * 1000;

      console.log(chalk.blue.bold(`📡 Streaming metrics for session ${sessionId}\n`));
      console.log(chalk.gray(`Update interval: ${options.interval} seconds`));
      console.log(chalk.gray('Press Ctrl+C to stop\n'));

      const streamMetrics = () => {
        const report = paperTradeBridge.getBurnInReport(sessionId);
        if (!report) {
          console.log(chalk.red('Session not found'));
          process.exit(1);
        }

        const metrics = paperTradeBridge.getTradeMetrics(sessionId);
        const recentMetrics = metrics.slice(-10); // Last 10 trades

        // Clear screen and show header
        process.stdout.write('\x1b[2J\x1b[0f');
        console.log(chalk.blue.bold(`📡 Live Metrics - Session ${sessionId}`));
        console.log(chalk.gray(`Last updated: ${new Date().toLocaleTimeString()}\n`));

        // Real-time summary
        console.log(chalk.green('📊 Real-time Summary:'));
        console.log(`  Total Trades: ${report.summary.totalTrades}`);
        console.log(`  Current P&L: $${report.summary.totalPnL.toFixed(2)}`);
        console.log(`  Win Rate: ${(report.summary.winRate * 100).toFixed(1)}%`);
        console.log(`  Sharpe Ratio: ${report.summary.sharpeRatio.toFixed(2)}`);

        // Recent trades
        if (recentMetrics.length > 0) {
          console.log(chalk.cyan('\n🔄 Recent Trades:'));
          recentMetrics.forEach((metric, i) => {
            const pnlColor = metric.pnl.total >= 0 ? chalk.green : chalk.red;
            const time = new Date(metric.timestamp).toLocaleTimeString();
            console.log(`  ${i + 1}. ${time} ${metric.symbol} ${metric.side.toUpperCase()} ${pnlColor(`$${metric.pnl.total.toFixed(2)}`)}`);
          });
        }

        console.log(chalk.gray('\nPress Ctrl+C to stop streaming'));
      };

      // Initial display
      streamMetrics();

      // Set up streaming interval
      const streamInterval = setInterval(streamMetrics, interval);

      // Handle graceful exit
      process.on('SIGINT', () => {
        clearInterval(streamInterval);
        console.log(chalk.yellow('\n\n📡 Streaming stopped'));
        process.exit(0);
      });

    } catch (error) {
      console.log(chalk.red.bold('❌ Failed to stream metrics'));
      console.log(chalk.red((error as Error).message));
      process.exit(1);
    }
  });

program.parse();