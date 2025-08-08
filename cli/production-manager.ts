#!/usr/bin/env tsx

/**
 * CLI TOOL: PRODUCTION MANAGEMENT
 * Command-line interface for production deployment and shadow trading
 * Part of Phase 9: Production Pipeline with Shadow Mode and Monitoring
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { shadowTradingService } from '../server/services/shadowTradingService.js';
import { deploymentPipelineService } from '../server/services/deploymentPipelineService.js';

const program = new Command();

program
  .name('production-manager')
  .description('Stevie Production Management CLI')
  .version('1.0.0');

// Initialize production services
program
  .command('init')
  .description('Initialize production management services')
  .action(async () => {
    console.log(chalk.blue.bold('\n🚀 Initializing Production Management...\n'));

    try {
      console.log(chalk.cyan('🔧 Initializing shadow trading service...'));
      await shadowTradingService.initialize();
      console.log(chalk.green('✅ Shadow trading service ready'));
      
      console.log(chalk.cyan('🔧 Initializing deployment pipeline...'));
      await deploymentPipelineService.initialize();
      console.log(chalk.green('✅ Deployment pipeline ready'));
      
      console.log(chalk.green.bold('\n✅ Production management initialized successfully!'));
      
      // Show status
      const shadowDashboard = shadowTradingService.getShadowDashboard();
      const pipelineDashboard = deploymentPipelineService.getPipelineDashboard();
      
      console.log(chalk.cyan('\n📊 Current Status:'));
      console.log(chalk.yellow(`  Shadow Trading: ${shadowDashboard.healthStatus}`));
      console.log(chalk.yellow(`  Pipeline Status: ${pipelineDashboard.systemHealth}`));
      console.log(chalk.yellow(`  Environments: ${pipelineDashboard.environments.length}`));
      
    } catch (error) {
      console.log(chalk.red.bold('❌ Production initialization failed'));
      console.log(chalk.red((error as Error).message));
    }
  });

// Shadow trading commands
program
  .command('shadow')
  .description('Shadow trading management')
  .addCommand(createShadowCommands());

// Deployment commands
program
  .command('deploy')
  .description('Deployment management')
  .addCommand(createDeploymentCommands());

// Create shadow trading subcommands
function createShadowCommands() {
  const shadowCmd = new Command('shadow');
  
  // Start shadow session
  shadowCmd
    .command('start')
    .description('Start a shadow trading session')
    .option('-m, --models <models>', 'Comma-separated model versions', 'tcn_model_1,lstm_model_1')
    .option('-t, --type <type>', 'Session type (shadow/production_candidate/ab_test)', 'shadow')
    .option('--target <sessionId>', 'Comparison target session ID')
    .action(async (options) => {
      console.log(chalk.blue.bold('\n🌟 Starting Shadow Trading Session...\n'));

      try {
        await shadowTradingService.initialize();
        
        const models = options.models.split(',');
        const sessionId = await shadowTradingService.startShadowSession(
          models,
          options.type,
          options.target
        );
        
        console.log(chalk.green(`✅ Shadow session started: ${sessionId}`));
        console.log(chalk.cyan(`  Type: ${options.type}`));
        console.log(chalk.cyan(`  Models: ${models.join(', ')}`));
        
        if (options.target) {
          console.log(chalk.cyan(`  Comparison Target: ${options.target}`));
        }
        
      } catch (error) {
        console.log(chalk.red.bold('❌ Failed to start shadow session'));
        console.log(chalk.red((error as Error).message));
      }
    });

  // Stop shadow session
  shadowCmd
    .command('stop')
    .description('Stop the active shadow trading session')
    .option('-s, --session <sessionId>', 'Specific session ID to stop')
    .action(async (options) => {
      console.log(chalk.blue.bold('\n🛑 Stopping Shadow Trading Session...\n'));

      try {
        await shadowTradingService.stopShadowSession(options.session);
        console.log(chalk.green('✅ Shadow session stopped'));
        
      } catch (error) {
        console.log(chalk.red.bold('❌ Failed to stop shadow session'));
        console.log(chalk.red((error as Error).message));
      }
    });

  // Shadow dashboard
  shadowCmd
    .command('dashboard')
    .description('Show shadow trading dashboard')
    .action(async () => {
      console.log(chalk.blue.bold('\n🌟 Shadow Trading Dashboard\n'));

      try {
        const dashboard = shadowTradingService.getShadowDashboard();
        
        console.log(chalk.cyan('📊 Current Status:'));
        console.log(chalk.yellow(`  Health: ${dashboard.healthStatus}`));
        console.log(chalk.yellow(`  Shadow Mode: ${dashboard.configuration.enableShadowMode ? 'Enabled' : 'Disabled'}`));
        console.log(chalk.yellow(`  A/B Testing: ${dashboard.configuration.enableABTesting ? 'Enabled' : 'Disabled'}`));
        
        if (dashboard.activeSession) {
          const session = dashboard.activeSession;
          console.log(chalk.cyan('\n🎯 Active Session:'));
          console.log(chalk.blue(`  ID: ${session.id}`));
          console.log(chalk.blue(`  Type: ${session.type}`));
          console.log(chalk.blue(`  Status: ${session.status}`));
          console.log(chalk.blue(`  Models: ${session.modelVersions.join(', ')}`));
          console.log(chalk.blue(`  Started: ${new Date(session.startTime).toLocaleString()}`));
          
          const metrics = session.performanceMetrics;
          console.log(chalk.cyan('\n📈 Performance Metrics:'));
          console.log(chalk.yellow(`  Total Trades: ${metrics.totalTrades}`));
          console.log(chalk.yellow(`  Win Rate: ${(metrics.winRate * 100).toFixed(1)}%`));
          console.log(chalk.yellow(`  Total P&L: $${metrics.totalPnL.toFixed(2)}`));
          console.log(chalk.yellow(`  Sharpe Ratio: ${metrics.sharpeRatio.toFixed(2)}`));
          console.log(chalk.yellow(`  Max Drawdown: ${(metrics.maxDrawdown * 100).toFixed(1)}%`));
          console.log(chalk.yellow(`  Avg Execution: ${metrics.avgExecutionTime.toFixed(0)}ms`));
        }
        
        if (dashboard.recentSessions.length > 0) {
          console.log(chalk.cyan('\n📝 Recent Sessions:'));
          dashboard.recentSessions.slice(0, 5).forEach(session => {
            const statusColor = session.status === 'completed' ? chalk.green : 
                               session.status === 'active' ? chalk.blue : chalk.gray;
            console.log(statusColor(`  ${session.id}: ${session.type} (${session.status})`));
          });
        }
        
        if (dashboard.abTestResults.length > 0) {
          console.log(chalk.cyan('\n🧪 A/B Test Results:'));
          dashboard.abTestResults.slice(-3).forEach(test => {
            const winnerColor = test.winner === 'treatment' ? chalk.green : 
                               test.winner === 'control' ? chalk.yellow : chalk.gray;
            console.log(winnerColor(`  ${test.testId}: Winner: ${test.winner} (${(test.winnerConfidence * 100).toFixed(1)}% confidence)`));
          });
        }
        
      } catch (error) {
        console.log(chalk.red.bold('❌ Failed to get shadow dashboard'));
        console.log(chalk.red((error as Error).message));
      }
    });

  // A/B testing
  shadowCmd
    .command('ab-test')
    .description('Start an A/B test')
    .option('-c, --control <models>', 'Control group models', 'tcn_model_1')
    .option('-t, --treatment <models>', 'Treatment group models', 'lstm_model_1')
    .option('-d, --duration <hours>', 'Test duration in hours', '24')
    .action(async (options) => {
      console.log(chalk.blue.bold('\n🧪 Starting A/B Test...\n'));

      try {
        await shadowTradingService.initialize();
        
        const controlModels = options.control.split(',');
        const treatmentModels = options.treatment.split(',');
        const duration = parseFloat(options.duration) * 60 * 60 * 1000; // Convert to ms
        
        const testId = await shadowTradingService.startABTest(
          controlModels,
          treatmentModels,
          duration
        );
        
        console.log(chalk.green(`✅ A/B test started: ${testId}`));
        console.log(chalk.cyan(`  Control: ${controlModels.join(', ')}`));
        console.log(chalk.cyan(`  Treatment: ${treatmentModels.join(', ')}`));
        console.log(chalk.cyan(`  Duration: ${options.duration} hours`));
        
      } catch (error) {
        console.log(chalk.red.bold('❌ Failed to start A/B test'));
        console.log(chalk.red((error as Error).message));
      }
    });

  return shadowCmd;
}

// Create deployment subcommands
function createDeploymentCommands() {
  const deployCmd = new Command('deploy');
  
  // Deploy to environment
  deployCmd
    .command('to')
    .description('Deploy to environment')
    .argument('<environment>', 'Target environment (dev/staging/production)')
    .argument('<version>', 'Version to deploy')
    .option('-s, --strategy <strategy>', 'Deployment strategy (blue_green/canary/rolling/immediate)', 'blue_green')
    .option('--canary <percentage>', 'Canary percentage for canary deployments', '10')
    .action(async (environment, version, options) => {
      console.log(chalk.blue.bold(`\n🚀 Deploying to ${environment.toUpperCase()}...\n`));

      try {
        await deploymentPipelineService.initialize();
        
        const config = {
          strategy: options.strategy,
          canaryPercentage: parseInt(options.canary)
        };
        
        const deploymentId = await deploymentPipelineService.deployToEnvironment(
          environment,
          version,
          config
        );
        
        console.log(chalk.green(`✅ Deployment started: ${deploymentId}`));
        console.log(chalk.cyan(`  Environment: ${environment}`));
        console.log(chalk.cyan(`  Version: ${version}`));
        console.log(chalk.cyan(`  Strategy: ${options.strategy}`));
        
        if (options.strategy === 'canary') {
          console.log(chalk.cyan(`  Canary Traffic: ${options.canary}%`));
        }
        
        console.log(chalk.yellow('\n⏳ Deployment in progress... Use "deploy status" to monitor'));
        
      } catch (error) {
        console.log(chalk.red.bold('❌ Deployment failed to start'));
        console.log(chalk.red((error as Error).message));
      }
    });

  // Deployment status
  deployCmd
    .command('status')
    .description('Show deployment status')
    .option('-d, --deployment <id>', 'Specific deployment ID')
    .action(async (options) => {
      console.log(chalk.blue.bold('\n📊 Deployment Status\n'));

      try {
        const dashboard = deploymentPipelineService.getPipelineDashboard();
        
        console.log(chalk.cyan('🌍 Environments:'));
        dashboard.environments.forEach(env => {
          const statusColor = env.status === 'active' ? chalk.green : 
                             env.status === 'deploying' ? chalk.yellow : chalk.gray;
          console.log(statusColor(`  ${env.name.toUpperCase()}: ${env.status} (${env.currentVersion})`));
          console.log(chalk.gray(`    CPU: ${env.resources.cpu}% | Memory: ${env.resources.memory}MB | Disk: ${env.resources.disk}MB`));
          if (env.lastDeployment > 0) {
            console.log(chalk.gray(`    Last Deployment: ${new Date(env.lastDeployment).toLocaleString()}`));
          }
        });
        
        if (dashboard.activeDeployment) {
          const deployment = dashboard.activeDeployment;
          console.log(chalk.cyan('\n⚡ Active Deployment:'));
          console.log(chalk.blue(`  ID: ${deployment.id}`));
          console.log(chalk.blue(`  Environment: ${deployment.environment}`));
          console.log(chalk.blue(`  Version: ${deployment.version}`));
          console.log(chalk.blue(`  Strategy: ${deployment.strategy}`));
          console.log(chalk.blue(`  Status: ${deployment.status}`));
          console.log(chalk.blue(`  Started: ${new Date(deployment.startTime).toLocaleString()}`));
          
          if (deployment.healthChecks.length > 0) {
            console.log(chalk.cyan('\n🔍 Health Checks:'));
            deployment.healthChecks.slice(-5).forEach(check => {
              const statusColor = check.status === 'passed' ? chalk.green : 
                                 check.status === 'failed' ? chalk.red : chalk.yellow;
              console.log(statusColor(`  ${check.name}: ${check.status} (${check.duration}ms)`));
              if (check.errorMessage) {
                console.log(chalk.red(`    Error: ${check.errorMessage}`));
              }
            });
          }
          
          const metrics = deployment.metrics;
          console.log(chalk.cyan('\n📈 Current Metrics:'));
          console.log(chalk.yellow(`  Error Rate: ${(metrics.errorRate * 100).toFixed(2)}%`));
          console.log(chalk.yellow(`  Response Time: ${metrics.responseTime.toFixed(0)}ms`));
          console.log(chalk.yellow(`  Throughput: ${metrics.throughput.toFixed(0)} req/s`));
          console.log(chalk.yellow(`  CPU Usage: ${metrics.cpuUsage.toFixed(1)}%`));
          console.log(chalk.yellow(`  Memory Usage: ${metrics.memoryUsage.toFixed(1)}%`));
          console.log(chalk.yellow(`  Successful Trades: ${metrics.successfulTrades}`));
          console.log(chalk.yellow(`  Failed Trades: ${metrics.failedTrades}`));
        }
        
        if (dashboard.recentDeployments.length > 0) {
          console.log(chalk.cyan('\n📝 Recent Deployments:'));
          dashboard.recentDeployments.slice(0, 5).forEach(deployment => {
            const statusColor = deployment.status === 'deployed' ? chalk.green : 
                               deployment.status === 'failed' ? chalk.red :
                               deployment.status === 'deploying' ? chalk.yellow : chalk.gray;
            
            const duration = deployment.endTime ? 
              `(${Math.round((deployment.endTime - deployment.startTime) / 1000)}s)` : 
              '(in progress)';
            
            console.log(statusColor(`  ${deployment.id}: ${deployment.environment} ${deployment.version} ${duration}`));
          });
        }
        
      } catch (error) {
        console.log(chalk.red.bold('❌ Failed to get deployment status'));
        console.log(chalk.red((error as Error).message));
      }
    });

  // Rollback deployment
  deployCmd
    .command('rollback')
    .description('Rollback a deployment')
    .argument('<deploymentId>', 'Deployment ID to rollback')
    .option('-r, --reason <reason>', 'Rollback reason', 'Manual rollback via CLI')
    .action(async (deploymentId, options) => {
      console.log(chalk.blue.bold('\n🔄 Rolling Back Deployment...\n'));

      try {
        await deploymentPipelineService.rollbackDeployment(deploymentId, options.reason);
        
        console.log(chalk.green(`✅ Rollback completed: ${deploymentId}`));
        console.log(chalk.cyan(`  Reason: ${options.reason}`));
        
      } catch (error) {
        console.log(chalk.red.bold('❌ Rollback failed'));
        console.log(chalk.red((error as Error).message));
      }
    });

  return deployCmd;
}

// Production readiness check
program
  .command('readiness-check')
  .description('Comprehensive production readiness assessment')
  .action(async () => {
    console.log(chalk.blue.bold('\n🔍 Production Readiness Assessment\n'));

    try {
      await shadowTradingService.initialize();
      await deploymentPipelineService.initialize();
      
      const checks = [];
      
      // Shadow trading readiness
      console.log(chalk.cyan('🌟 Shadow Trading System:'));
      const shadowDashboard = shadowTradingService.getShadowDashboard();
      
      const shadowReady = shadowDashboard.healthStatus === 'healthy' || shadowDashboard.healthStatus === 'inactive';
      checks.push({ name: 'Shadow Trading', status: shadowReady });
      console.log(shadowReady ? chalk.green('  ✅ Ready') : chalk.red('  ❌ Not Ready'));
      console.log(chalk.gray(`    Status: ${shadowDashboard.healthStatus}`));
      console.log(chalk.gray(`    Configuration: ${shadowDashboard.configuration.enableShadowMode ? 'Enabled' : 'Disabled'}`));
      
      // Deployment pipeline readiness
      console.log(chalk.cyan('\n🚀 Deployment Pipeline:'));
      const pipelineDashboard = deploymentPipelineService.getPipelineDashboard();
      
      const pipelineReady = pipelineDashboard.systemHealth === 'healthy' || pipelineDashboard.systemHealth === 'idle';
      checks.push({ name: 'Deployment Pipeline', status: pipelineReady });
      console.log(pipelineReady ? chalk.green('  ✅ Ready') : chalk.red('  ❌ Not Ready'));
      console.log(chalk.gray(`    Status: ${pipelineDashboard.systemHealth}`));
      
      // Environment readiness
      console.log(chalk.cyan('\n🌍 Environment Status:'));
      let envReady = true;
      pipelineDashboard.environments.forEach(env => {
        const ready = env.status === 'active' || env.status === 'inactive';
        if (!ready) envReady = false;
        
        const statusColor = ready ? chalk.green : chalk.red;
        console.log(statusColor(`  ${env.name.toUpperCase()}: ${ready ? '✅' : '❌'} ${env.status}`));
      });
      checks.push({ name: 'Environments', status: envReady });
      
      // Overall assessment
      const overallReady = checks.every(check => check.status);
      const readyCount = checks.filter(check => check.status).length;
      
      console.log(chalk.cyan('\n🎯 Overall Assessment:'));
      console.log(overallReady ? 
        chalk.green.bold('  ✅ PRODUCTION READY') : 
        chalk.red.bold('  ❌ NOT PRODUCTION READY')
      );
      console.log(chalk.yellow(`  Readiness Score: ${readyCount}/${checks.length} systems ready`));
      
      if (!overallReady) {
        console.log(chalk.red('\n🔧 Required Actions:'));
        checks.filter(check => !check.status).forEach(check => {
          console.log(chalk.red(`  - Fix ${check.name} system`));
        });
      } else {
        console.log(chalk.green('\n🎉 System is ready for production deployment!'));
        console.log(chalk.cyan('  Next steps:'));
        console.log(chalk.yellow('  1. Run final validation tests'));
        console.log(chalk.yellow('  2. Schedule production deployment'));
        console.log(chalk.yellow('  3. Monitor shadow trading performance'));
        console.log(chalk.yellow('  4. Execute gradual rollout strategy'));
      }
      
    } catch (error) {
      console.log(chalk.red.bold('❌ Readiness check failed'));
      console.log(chalk.red((error as Error).message));
    }
  });

// Production monitor
program
  .command('monitor')
  .description('Monitor production systems in real-time')
  .option('-d, --duration <seconds>', 'Monitoring duration in seconds', '300')
  .action(async (options) => {
    console.log(chalk.blue.bold('\n👁️  Production Systems Monitor\n'));

    try {
      await shadowTradingService.initialize();
      await deploymentPipelineService.initialize();
      
      const duration = parseInt(options.duration) * 1000;
      console.log(chalk.cyan(`Monitoring for ${options.duration} seconds...`));
      console.log(chalk.yellow('Press Ctrl+C to stop'));
      
      // Set up event listeners
      shadowTradingService.on('shadowTradeExecuted', (data) => {
        console.log(chalk.blue(`🌟 Shadow Trade: ${data.signal.symbol} ${data.signal.signal} (${data.signal.confidence.toFixed(2)} confidence)`));
      });
      
      shadowTradingService.on('shadowAlert', (alert) => {
        const alertColor = alert.severity === 'critical' ? chalk.red : chalk.yellow;
        console.log(alertColor(`🚨 Shadow Alert [${alert.severity.toUpperCase()}]: ${alert.message}`));
      });
      
      deploymentPipelineService.on('deploymentStarted', (deployment) => {
        console.log(chalk.green(`🚀 Deployment Started: ${deployment.id} (${deployment.environment})`));
      });
      
      deploymentPipelineService.on('deploymentCompleted', (deployment) => {
        console.log(chalk.green(`✅ Deployment Completed: ${deployment.id}`));
      });
      
      deploymentPipelineService.on('deploymentFailed', (deployment) => {
        console.log(chalk.red(`❌ Deployment Failed: ${deployment.id}`));
      });
      
      // Periodic status updates
      const statusInterval = setInterval(() => {
        const shadowStatus = shadowTradingService.getShadowDashboard();
        const pipelineStatus = deploymentPipelineService.getPipelineDashboard();
        
        console.log(chalk.gray(`📊 Status Update: Shadow=${shadowStatus.healthStatus} | Pipeline=${pipelineStatus.systemHealth} | ${new Date().toLocaleTimeString()}`));
      }, 30000); // Every 30 seconds
      
      // Set timeout
      setTimeout(() => {
        clearInterval(statusInterval);
        console.log(chalk.green.bold('\n✅ Monitoring completed'));
        process.exit(0);
      }, duration);
      
      // Keep alive
      await new Promise(() => {});
      
    } catch (error) {
      console.log(chalk.red.bold('❌ Monitoring failed'));
      console.log(chalk.red((error as Error).message));
    }
  });

program.parse();