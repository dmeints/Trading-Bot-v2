
/**
 * CLI Commands for Safe Promotion Pipeline
 * Command-line interface for shadow mode and gradual ramp-up
 */

import { Command } from 'commander';
import { logger } from '../../server/utils/logger';
import * as fs from 'fs/promises';

export function registerSafePromotionCommands(program: Command): void {
  const safeCmd = program
    .command('safe-promotion')
    .description('Safe promotion pipeline commands');

  // Shadow mode commands
  safeCmd
    .command('shadow-start')
    .description('Start shadow mode validation')
    .option('--hours <n>', 'Validation period in hours', '24')
    .option('--samples <n>', 'Required samples', '100')
    .option('--config <file>', 'Configuration file path')
    .action(async (options) => {
      try {
        console.log('🔒 Starting Shadow Mode Validation...\n');
        
        let config: any = {
          validationPeriodHours: parseInt(options.hours),
          requiredSamples: parseInt(options.samples)
        };
        
        // Load custom config if provided
        if (options.config) {
          const configFile = await fs.readFile(options.config, 'utf-8');
          const customConfig = JSON.parse(configFile);
          config = { ...config, ...customConfig };
        }
        
        console.log('📋 Configuration:');
        console.log(`   Validation Period: ${config.validationPeriodHours}h`);
        console.log(`   Required Samples: ${config.requiredSamples}`);
        console.log('');
        
        // Start shadow mode via API
        const response = await fetch('http://localhost:5000/api/safe-promotion/shadow/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(config)
        });
        
        const result = await response.json();
        
        if (result.success) {
          console.log('✅ Shadow Mode Started Successfully!');
          console.log(`📊 Status: ${result.status.isRunning ? 'Running' : 'Stopped'}`);
          console.log(`🕒 Start Time: ${result.status.startTime}`);
        } else {
          console.error('❌ Failed to start shadow mode:', result.error);
          process.exit(1);
        }
        
      } catch (error) {
        console.error('❌ Shadow mode start failed:', error.message);
        process.exit(1);
      }
    });

  // Shadow status command
  safeCmd
    .command('shadow-status')
    .description('Get shadow mode validation status')
    .action(async () => {
      try {
        console.log('🔍 Checking Shadow Mode Status...\n');
        
        const response = await fetch('http://localhost:5000/api/safe-promotion/status');
        const result = await response.json();
        
        if (result.success && result.system.shadowMode.status) {
          const status = result.system.shadowMode.status;
          
          console.log('📊 Shadow Mode Status:');
          console.log(`   Running: ${status.isRunning ? '✅ Yes' : '❌ No'}`);
          
          if (status.isRunning) {
            console.log(`   Elapsed Time: ${status.elapsedHours.toFixed(1)}h`);
            console.log(`   Samples Collected: ${status.samplesCollected}`);
            console.log(`   Completed Trades: ${status.completedTrades}`);
            console.log(`   Required Samples: ${status.requiredSamples}`);
            console.log(`   Progress: ${((status.completedTrades / status.requiredSamples) * 100).toFixed(1)}%`);
          }
        } else {
          console.log('📊 Shadow Mode: Not running');
        }
        
      } catch (error) {
        console.error('❌ Failed to get status:', error.message);
        process.exit(1);
      }
    });

  // Shadow result command
  safeCmd
    .command('shadow-result')
    .description('Get shadow mode validation result')
    .option('--output <file>', 'Output file for detailed results')
    .action(async (options) => {
      try {
        console.log('📋 Getting Shadow Mode Results...\n');
        
        const response = await fetch('http://localhost:5000/api/safe-promotion/shadow/result');
        const data = await response.json();
        
        if (!data.success) {
          console.error('❌ Failed to get results:', data.error);
          process.exit(1);
        }
        
        const result = data.result;
        
        console.log('📊 Validation Results:');
        console.log(`   Approval Status: ${result.approved ? '✅ Approved' : '❌ Rejected'}`);
        console.log(`   Confidence: ${(result.confidence * 100).toFixed(1)}%`);
        console.log(`   Samples Processed: ${result.samplesProcessed}`);
        console.log(`   Validation Period: ${result.validationPeriodHours.toFixed(1)}h\n`);
        
        console.log('🎯 Performance Metrics:');
        console.log(`   Coverage: ${(result.performanceMetrics.coverage * 100).toFixed(1)}% ${result.thresholdChecks.coverageCheck ? '✅' : '❌'}`);
        console.log(`   Coverage Gap: ${(result.performanceMetrics.coverageGap * 100).toFixed(1)}% ${result.thresholdChecks.gapCheck ? '✅' : '❌'}`);
        console.log(`   Sharpe Ratio: ${result.performanceMetrics.sharpeRatio.toFixed(2)} ${result.thresholdChecks.sharpeCheck ? '✅' : '❌'}`);
        console.log(`   Win Rate: ${(result.performanceMetrics.winRate * 100).toFixed(1)}%`);
        console.log(`   Max Drawdown: ${(result.performanceMetrics.maxDrawdown * 100).toFixed(1)}% ${result.thresholdChecks.drawdownCheck ? '✅' : '❌'}`);
        console.log(`   Avg Interval Width: ${(result.performanceMetrics.avgIntervalWidth * 100).toFixed(1)}% ${result.thresholdChecks.widthCheck ? '✅' : '❌'}\n`);
        
        if (result.issues.length > 0) {
          console.log('⚠️  Issues:');
          result.issues.forEach(issue => console.log(`   • ${issue}`));
          console.log('');
        }
        
        if (result.recommendations.length > 0) {
          console.log('💡 Recommendations:');
          result.recommendations.forEach(rec => console.log(`   • ${rec}`));
          console.log('');
        }
        
        if (result.approved) {
          console.log('🚀 Ready for live promotion! Use: npm run cli safe-promotion promote-init');
        } else {
          console.log('🔄 Continue shadow mode validation or adjust parameters.');
        }
        
        // Save detailed results if requested
        if (options.output) {
          await fs.writeFile(options.output, JSON.stringify(result, null, 2));
          console.log(`💾 Detailed results saved to ${options.output}`);
        }
        
      } catch (error) {
        console.error('❌ Failed to get results:', error.message);
        process.exit(1);
      }
    });

  // Initialize promotion command
  safeCmd
    .command('promote-init')
    .description('Initialize live promotion after shadow mode approval')
    .option('--initial <n>', 'Initial notional percentage', '0.005')
    .option('--max <n>', 'Maximum notional percentage', '0.02')
    .option('--steps <list>', 'Comma-separated ramp-up steps', '0.005,0.01,0.015,0.02')
    .action(async (options) => {
      try {
        console.log('🚀 Initializing Live Promotion...\n');
        
        const rampUpSteps = options.steps.split(',').map(s => parseFloat(s.trim()));
        
        const config = {
          initialNotional: parseFloat(options.initial),
          maxNotional: parseFloat(options.max),
          rampUpSteps
        };
        
        console.log('📋 Promotion Configuration:');
        console.log(`   Initial Notional: ${(config.initialNotional * 100).toFixed(2)}%`);
        console.log(`   Maximum Notional: ${(config.maxNotional * 100).toFixed(2)}%`);
        console.log(`   Ramp-up Steps: ${rampUpSteps.map(s => (s * 100).toFixed(2) + '%').join(' → ')}\n`);
        
        const response = await fetch('http://localhost:5000/api/safe-promotion/promotion/initialize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(config)
        });
        
        const result = await response.json();
        
        if (result.success) {
          console.log('✅ Live Promotion Initialized Successfully!');
          console.log(`📊 Current Step: ${result.promotionStatus.currentStep + 1}`);
          console.log(`💰 Current Notional: ${(result.promotionStatus.currentNotional * 100).toFixed(2)}%`);
          console.log(`🎯 Status: ${result.promotionStatus.isLive ? 'Live Trading Active' : 'Inactive'}`);
        } else {
          console.error('❌ Promotion initialization failed:', result.error);
          process.exit(1);
        }
        
      } catch (error) {
        console.error('❌ Promotion initialization failed:', error.message);
        process.exit(1);
      }
    });

  // Promotion status command
  safeCmd
    .command('promote-status')
    .description('Get live promotion status')
    .action(async () => {
      try {
        console.log('📊 Checking Promotion Status...\n');
        
        const response = await fetch('http://localhost:5000/api/safe-promotion/promotion/status');
        const result = await response.json();
        
        if (result.success && result.promotionStatus) {
          const status = result.promotionStatus;
          
          console.log('🚀 Live Promotion Status:');
          console.log(`   Active: ${status.isLive ? '✅ Yes' : '❌ No'}`);
          console.log(`   Current Step: ${status.currentStep + 1}`);
          console.log(`   Current Notional: ${(status.currentNotional * 100).toFixed(2)}%`);
          console.log(`   Can Advance: ${status.canAdvance ? '✅ Yes' : '❌ No'}`);
          console.log(`   Needs Rollback: ${status.needsRollback ? '⚠️  Yes' : '✅ No'}\n`);
          
          console.log('📈 Step Performance:');
          console.log(`   Trades in Step: ${status.stepPerformance.tradesInStep}`);
          console.log(`   Sharpe Ratio: ${status.stepPerformance.sharpeRatio.toFixed(2)}`);
          console.log(`   Win Rate: ${(status.stepPerformance.winRate * 100).toFixed(1)}%`);
          console.log(`   Max Drawdown: ${(status.stepPerformance.maxDrawdown * 100).toFixed(1)}%`);
          console.log(`   Consecutive Losses: ${status.stepPerformance.consecutiveLosses}\n`);
          
          console.log('🎯 Next Step Requirements:');
          console.log(`   Trades Required: ${status.nextStepRequirements.minTrades}`);
          console.log(`   Current Trades: ${status.nextStepRequirements.currentTrades}`);
          console.log(`   Performance Met: ${status.nextStepRequirements.performanceMet ? '✅ Yes' : '❌ No'}`);
          
        } else {
          console.log('📊 Live Promotion: Not active');
        }
        
      } catch (error) {
        console.error('❌ Failed to get promotion status:', error.message);
        process.exit(1);
      }
    });

  // Advance promotion command
  safeCmd
    .command('promote-advance')
    .description('Advance to next promotion step')
    .option('--force', 'Force advancement without meeting requirements')
    .action(async (options) => {
      try {
        console.log('⬆️  Advancing Promotion Step...\n');
        
        const response = await fetch('http://localhost:5000/api/safe-promotion/promotion/advance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ adminOverride: options.force || false })
        });
        
        const result = await response.json();
        
        if (result.success) {
          if (result.advanced) {
            console.log('✅ Promotion Step Advanced!');
            console.log(`📊 New Step: ${result.promotionStatus.currentStep + 1}`);
            console.log(`💰 New Notional: ${(result.promotionStatus.currentNotional * 100).toFixed(2)}%`);
          } else {
            console.log('⚠️  Cannot advance step - requirements not met');
            console.log('   Use --force flag to override, or wait for requirements');
          }
        } else {
          console.error('❌ Failed to advance step:', result.error);
          process.exit(1);
        }
        
      } catch (error) {
        console.error('❌ Step advancement failed:', error.message);
        process.exit(1);
      }
    });

  // Rollback promotion command
  safeCmd
    .command('promote-rollback')
    .description('Rollback promotion to previous step')
    .option('--reason <text>', 'Rollback reason', 'Manual rollback via CLI')
    .action(async (options) => {
      try {
        console.log('⬇️  Rolling Back Promotion...\n');
        
        const response = await fetch('http://localhost:5000/api/safe-promotion/promotion/rollback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: options.reason })
        });
        
        const result = await response.json();
        
        if (result.success) {
          console.log('✅ Promotion Rolled Back!');
          console.log(`📊 Current Step: ${result.promotionStatus.currentStep + 1}`);
          console.log(`💰 Current Notional: ${(result.promotionStatus.currentNotional * 100).toFixed(2)}%`);
          console.log(`📝 Reason: ${options.reason}`);
        } else {
          console.error('❌ Rollback failed:', result.error);
          process.exit(1);
        }
        
      } catch (error) {
        console.error('❌ Rollback failed:', error.message);
        process.exit(1);
      }
    });

  // Stop promotion command
  safeCmd
    .command('promote-stop')
    .description('Stop live trading and return to shadow mode')
    .action(async () => {
      try {
        console.log('🛑 Stopping Live Trading...\n');
        
        const response = await fetch('http://localhost:5000/api/safe-promotion/promotion/stop', {
          method: 'POST'
        });
        
        const result = await response.json();
        
        if (result.success) {
          console.log('✅ Live Trading Stopped!');
          console.log('🔒 Returned to shadow mode');
          console.log('📝 Use shadow-start to begin new validation cycle');
        } else {
          console.error('❌ Failed to stop live trading:', result.error);
          process.exit(1);
        }
        
      } catch (error) {
        console.error('❌ Stop command failed:', error.message);
        process.exit(1);
      }
    });
}
