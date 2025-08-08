#!/usr/bin/env tsx

/**
 * CLI TOOL: RISK MANAGEMENT
 * Command-line interface for Stevie's risk management system
 * Part of Phase 5: Risk Management Implementation
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { riskManagementService } from '../server/services/riskManagement.js';
import { riskAlertService } from '../server/services/riskAlertService.js';
import { featureEngineeringService } from '../server/services/featureEngineering.js';
import { modelZoo } from '../server/services/modelZoo.js';

const program = new Command();

program
  .name('risk-manager')
  .description('Stevie Risk Management CLI')
  .version('1.0.0');

// Test risk management system
program
  .command('test-system')
  .description('Test the risk management system with sample data')
  .action(async () => {
    console.log(chalk.blue.bold('\n🛡️  Testing Risk Management System...\n'));

    try {
      await riskManagementService.initialize();
      await riskAlertService.initialize();
      
      console.log(chalk.green('✅ Risk management system initialized'));
      
      // Test position sizing
      console.log(chalk.cyan('\n📊 Testing Position Sizing:'));
      
      const features = await featureEngineeringService.generateFeatureVector('BTC', Date.now(), '4h');
      const prediction = {
        symbol: 'BTC',
        timestamp: Date.now(),
        timeframe: '4h' as const,
        prediction: 0.3,
        confidence: 0.85,
        probability: { up: 0.85, down: 0.10, sideways: 0.05 },
        features: ['volatility_24h', 'rsi_14', 'macd'],
        modelVersion: '1.0.0'
      };
      
      const sizeResult = riskManagementService.calculatePositionSize('BTC', prediction, 50000, features);
      
      console.log(chalk.yellow(`  Recommended Size: ${sizeResult.recommendedSize.toFixed(6)} BTC`));
      console.log(chalk.yellow(`  Max Allowed: ${sizeResult.maxAllowedSize.toFixed(6)} BTC`));
      console.log(chalk.yellow(`  Risk Amount: $${sizeResult.riskAmount.toFixed(2)}`));
      console.log(chalk.yellow(`  Confidence: ${(sizeResult.confidence * 100).toFixed(1)}%`));
      console.log(chalk.yellow(`  Reasoning: ${sizeResult.reasoning}`));
      
      if (sizeResult.alerts.length > 0) {
        console.log(chalk.red(`  Alerts: ${sizeResult.alerts.length}`));
        sizeResult.alerts.forEach(alert => {
          console.log(chalk.red(`    - ${alert.level}: ${alert.message}`));
        });
      }
      
      // Test position management
      console.log(chalk.cyan('\n📈 Testing Position Management:'));
      
      const position = riskManagementService.addPosition('BTC', 'long', 0.1, 50000, 0.85);
      console.log(chalk.green(`  Added position: ${position.id}`));
      console.log(chalk.yellow(`  Entry: $${position.entryPrice}`));
      console.log(chalk.yellow(`  Stop Loss: $${position.stopLoss.toFixed(2)}`));
      console.log(chalk.yellow(`  Take Profit: $${position.takeProfit.toFixed(2)}`));
      
      // Update position with price movement
      riskManagementService.updatePosition(position.id, 51000);
      console.log(chalk.green(`  Updated position price to $51,000`));
      
      const updatedPosition = riskManagementService.getPositions()[0];
      console.log(chalk.yellow(`  Unrealized P&L: $${updatedPosition.unrealizedPnL.toFixed(2)}`));
      
      // Test portfolio risk
      console.log(chalk.cyan('\n⚖️  Portfolio Risk Metrics:'));
      
      const portfolioRisk = riskManagementService.getPortfolioRisk();
      console.log(chalk.yellow(`  Total Value: $${portfolioRisk.totalValue.toFixed(2)}`));
      console.log(chalk.yellow(`  Total Exposure: $${portfolioRisk.totalExposure.toFixed(2)}`));
      console.log(chalk.yellow(`  Daily P&L: $${portfolioRisk.dailyPnL.toFixed(2)}`));
      console.log(chalk.yellow(`  Max Drawdown: ${(portfolioRisk.maxDrawdown * 100).toFixed(2)}%`));
      console.log(chalk.yellow(`  Sharpe Ratio: ${portfolioRisk.sharpeRatio.toFixed(2)}`));
      console.log(chalk.yellow(`  Leverage Ratio: ${portfolioRisk.leverageRatio.toFixed(2)}x`));
      
      console.log(chalk.green.bold('\n✅ Risk management system test completed!'));
      
    } catch (error) {
      console.log(chalk.red.bold('❌ Risk management test failed'));
      console.log(chalk.red((error as Error).message));
    }
  });

// Monitor risk alerts
program
  .command('monitor-alerts')
  .description('Monitor real-time risk alerts')
  .option('-d, --duration <seconds>', 'Monitoring duration in seconds', '60')
  .action(async (options) => {
    console.log(chalk.blue.bold('\n🚨 Monitoring Risk Alerts...\n'));

    try {
      await riskAlertService.initialize();
      
      const duration = parseInt(options.duration) * 1000;
      console.log(chalk.cyan(`Monitoring for ${options.duration} seconds...`));
      console.log(chalk.yellow('Press Ctrl+C to stop'));
      
      // Listen to alerts
      riskAlertService.on('riskAlert', (alert) => {
        const levelColor = alert.level === 'emergency' ? chalk.red.bold :
                          alert.level === 'critical' ? chalk.red :
                          chalk.yellow;
        
        console.log(levelColor(`\n🚨 ${alert.level.toUpperCase()}: ${alert.message}`));
        console.log(chalk.cyan(`   Action: ${alert.action}`));
        console.log(chalk.gray(`   Time: ${new Date(alert.timestamp).toLocaleTimeString()}`));
      });
      
      riskAlertService.on('emergencyStop', (data) => {
        console.log(chalk.red.bold(`\n🛑 EMERGENCY STOP: ${data.reason}`));
      });
      
      // Show current dashboard
      const dashboard = riskAlertService.getRiskDashboard();
      console.log(chalk.cyan('\n📊 Current Risk Dashboard:'));
      console.log(chalk.yellow(`  Active Alerts: ${dashboard.activeAlerts.length}`));
      console.log(chalk.yellow(`  - Warning: ${dashboard.alertCounts.warning}`));
      console.log(chalk.yellow(`  - Critical: ${dashboard.alertCounts.critical}`));
      console.log(chalk.yellow(`  - Emergency: ${dashboard.alertCounts.emergency}`));
      
      // Set timeout
      setTimeout(() => {
        console.log(chalk.green.bold('\n✅ Monitoring completed'));
        process.exit(0);
      }, duration);
      
      // Keep alive
      await new Promise(() => {});
      
    } catch (error) {
      console.log(chalk.red.bold('❌ Alert monitoring failed'));
      console.log(chalk.red((error as Error).message));
    }
  });

// Simulate risk scenarios
program
  .command('stress-test')
  .description('Run stress tests on the risk management system')
  .option('-s, --scenario <type>', 'Stress test scenario', 'market_crash')
  .action(async (options) => {
    console.log(chalk.blue.bold('\n🔬 Running Risk Stress Test...\n'));

    try {
      await riskManagementService.initialize();
      await riskAlertService.initialize();
      
      console.log(chalk.cyan(`Scenario: ${options.scenario}`));
      
      // Add multiple positions for stress testing
      console.log(chalk.yellow('\n📈 Setting up test portfolio:'));
      
      const positions = [
        { symbol: 'BTC', side: 'long', quantity: 0.5, price: 50000 },
        { symbol: 'ETH', side: 'long', quantity: 5.0, price: 3000 },
        { symbol: 'SOL', side: 'short', quantity: 100, price: 150 },
        { symbol: 'ADA', side: 'long', quantity: 10000, price: 0.5 }
      ];
      
      for (const pos of positions) {
        const position = riskManagementService.addPosition(
          pos.symbol, 
          pos.side as 'long' | 'short', 
          pos.quantity, 
          pos.price, 
          0.8
        );
        console.log(chalk.green(`  Added ${pos.symbol}: ${pos.side} ${pos.quantity} @ $${pos.price}`));
      }
      
      // Simulate stress scenario
      console.log(chalk.yellow('\n⚠️  Applying stress scenario:'));
      
      const allPositions = riskManagementService.getPositions();
      
      switch (options.scenario) {
        case 'market_crash':
          console.log(chalk.red('  Market Crash: -20% across all assets'));
          for (const position of allPositions) {
            const newPrice = position.entryPrice * 0.8;
            riskManagementService.updatePosition(position.id, newPrice);
          }
          break;
          
        case 'volatility_spike':
          console.log(chalk.red('  Volatility Spike: +50% price swings'));
          for (const position of allPositions) {
            const volatility = (Math.random() - 0.5) * 0.5; // ±25%
            const newPrice = position.entryPrice * (1 + volatility);
            riskManagementService.updatePosition(position.id, newPrice);
          }
          break;
          
        case 'liquidity_crisis':
          console.log(chalk.red('  Liquidity Crisis: Wide spreads and slippage'));
          // Would implement spread widening simulation
          break;
          
        default:
          console.log(chalk.red(`  Unknown scenario: ${options.scenario}`));
      }
      
      // Check results
      console.log(chalk.cyan('\n📊 Stress Test Results:'));
      
      const portfolioRisk = riskManagementService.getPortfolioRisk();
      const alerts = riskAlertService.getActiveAlerts();
      
      console.log(chalk.yellow(`  Portfolio Value: $${portfolioRisk.totalValue.toFixed(2)}`));
      console.log(chalk.yellow(`  Daily P&L: $${portfolioRisk.dailyPnL.toFixed(2)} (${(portfolioRisk.dailyPnL / portfolioRisk.totalValue * 100).toFixed(2)}%)`));
      console.log(chalk.yellow(`  Max Drawdown: ${(portfolioRisk.maxDrawdown * 100).toFixed(2)}%`));
      console.log(chalk.yellow(`  Active Alerts: ${alerts.length}`));
      
      if (alerts.length > 0) {
        console.log(chalk.red('\n🚨 Active Alerts:'));
        alerts.forEach(alert => {
          console.log(chalk.red(`  ${alert.level}: ${alert.message}`));
        });
      }
      
      console.log(chalk.green.bold('\n✅ Stress test completed!'));
      
    } catch (error) {
      console.log(chalk.red.bold('❌ Stress test failed'));
      console.log(chalk.red((error as Error).message));
    }
  });

// Risk configuration
program
  .command('configure')
  .description('Configure risk parameters')
  .option('--max-position <percent>', 'Maximum position size (0.01 = 1%)', '0.05')
  .option('--daily-limit <percent>', 'Daily loss limit (0.01 = 1%)', '0.02')
  .option('--stop-loss <percent>', 'Stop loss percentage', '0.03')
  .action(async (options) => {
    console.log(chalk.blue.bold('\n⚙️  Configuring Risk Parameters...\n'));

    try {
      await riskManagementService.initialize();
      
      const newParams = {
        maxPositionSize: parseFloat(options.maxPosition),
        dailyLossLimit: parseFloat(options.dailyLimit),
        stopLossPercent: parseFloat(options.stopLoss)
      };
      
      riskManagementService.updateRiskParameters(newParams);
      
      console.log(chalk.green('✅ Risk parameters updated:'));
      console.log(chalk.yellow(`  Max Position Size: ${(newParams.maxPositionSize * 100).toFixed(1)}%`));
      console.log(chalk.yellow(`  Daily Loss Limit: ${(newParams.dailyLossLimit * 100).toFixed(1)}%`));
      console.log(chalk.yellow(`  Stop Loss: ${(newParams.stopLossPercent * 100).toFixed(1)}%`));
      
    } catch (error) {
      console.log(chalk.red.bold('❌ Configuration failed'));
      console.log(chalk.red((error as Error).message));
    }
  });

// Portfolio status
program
  .command('status')
  .description('Show current portfolio and risk status')
  .action(async () => {
    console.log(chalk.blue.bold('\n📊 Portfolio Risk Status\n'));

    try {
      await riskManagementService.initialize();
      
      const positions = riskManagementService.getPositions();
      const portfolioRisk = riskManagementService.getPortfolioRisk();
      const riskParams = riskManagementService.getRiskParameters();
      
      console.log(chalk.cyan('💼 Portfolio Overview:'));
      console.log(chalk.yellow(`  Total Value: $${portfolioRisk.totalValue.toFixed(2)}`));
      console.log(chalk.yellow(`  Total Exposure: $${portfolioRisk.totalExposure.toFixed(2)}`));
      console.log(chalk.yellow(`  Number of Positions: ${positions.length}`));
      console.log(chalk.yellow(`  Daily P&L: $${portfolioRisk.dailyPnL.toFixed(2)}`));
      
      console.log(chalk.cyan('\n📈 Positions:'));
      if (positions.length === 0) {
        console.log(chalk.gray('  No active positions'));
      } else {
        positions.forEach(pos => {
          const pnlColor = pos.unrealizedPnL >= 0 ? chalk.green : chalk.red;
          console.log(chalk.yellow(`  ${pos.symbol} ${pos.side}: ${pos.quantity}`));
          console.log(chalk.gray(`    Entry: $${pos.entryPrice} | Current: $${pos.currentPrice}`));
          console.log(pnlColor(`    P&L: $${pos.unrealizedPnL.toFixed(2)}`));
        });
      }
      
      console.log(chalk.cyan('\n⚖️  Risk Metrics:'));
      console.log(chalk.yellow(`  Max Drawdown: ${(portfolioRisk.maxDrawdown * 100).toFixed(2)}%`));
      console.log(chalk.yellow(`  Sharpe Ratio: ${portfolioRisk.sharpeRatio.toFixed(2)}`));
      console.log(chalk.yellow(`  Volatility: ${(portfolioRisk.volatility * 100).toFixed(1)}%`));
      console.log(chalk.yellow(`  VaR (95%): ${(portfolioRisk.var95 * 100).toFixed(2)}%`));
      console.log(chalk.yellow(`  Concentration Risk: ${(portfolioRisk.concentrationRisk * 100).toFixed(1)}%`));
      
      console.log(chalk.cyan('\n🛡️  Risk Limits:'));
      console.log(chalk.yellow(`  Max Position Size: ${(riskParams.maxPositionSize * 100).toFixed(1)}%`));
      console.log(chalk.yellow(`  Daily Loss Limit: ${(riskParams.dailyLossLimit * 100).toFixed(1)}%`));
      console.log(chalk.yellow(`  Stop Loss: ${(riskParams.stopLossPercent * 100).toFixed(1)}%`));
      
      // Risk level assessment
      const riskLevel = portfolioRisk.maxDrawdown > 0.1 ? 'HIGH' :
                       portfolioRisk.maxDrawdown > 0.05 ? 'MEDIUM' : 'LOW';
      const riskColor = riskLevel === 'HIGH' ? chalk.red :
                       riskLevel === 'MEDIUM' ? chalk.yellow : chalk.green;
      
      console.log(chalk.cyan('\n🎯 Risk Assessment:'));
      console.log(riskColor(`  Current Risk Level: ${riskLevel}`));
      
    } catch (error) {
      console.log(chalk.red.bold('❌ Failed to get status'));
      console.log(chalk.red((error as Error).message));
    }
  });

program.parse();