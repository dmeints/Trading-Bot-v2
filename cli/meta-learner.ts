#!/usr/bin/env tsx

/**
 * CLI TOOL: META-LEARNING MANAGEMENT
 * Command-line interface for Stevie's meta-learning and online adaptation system
 * Part of Phase 8: Meta-learning and Online Adaptation
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { metaLearningService } from '../server/services/metaLearningService.js';
import { featureEngineeringService } from '../server/services/featureEngineering.js';

const program = new Command();

program
  .name('meta-learner')
  .description('Stevie Meta-Learning & Adaptation CLI')
  .version('1.0.0');

// Initialize and test meta-learning system
program
  .command('init')
  .description('Initialize the meta-learning system')
  .action(async () => {
    console.log(chalk.blue.bold('\n🧠 Initializing Meta-Learning System...\n'));

    try {
      await metaLearningService.initialize();
      
      console.log(chalk.green('✅ Meta-learning service initialized successfully'));
      
      // Show initial state
      console.log(chalk.cyan('\n📊 Initial State:'));
      const dashboard = metaLearningService.getMetaLearningDashboard();
      
      console.log(chalk.yellow(`  Models tracked: ${Object.keys(dashboard.modelPerformance).length}`));
      console.log(chalk.yellow(`  Ensemble weights: ${Object.keys(dashboard.ensembleWeights).length} models`));
      console.log(chalk.yellow(`  Current regime: ${dashboard.currentRegime?.name || 'Detecting...'}`));
      
      console.log(chalk.cyan('\n🎯 Ensemble Weights:'));
      for (const [modelId, weight] of Object.entries(dashboard.ensembleWeights)) {
        console.log(chalk.yellow(`  ${modelId}: ${(weight * 100).toFixed(1)}%`));
      }
      
    } catch (error) {
      console.log(chalk.red.bold('❌ Meta-learning initialization failed'));
      console.log(chalk.red((error as Error).message));
    }
  });

// Show performance dashboard
program
  .command('dashboard')
  .description('Show meta-learning performance dashboard')
  .action(async () => {
    console.log(chalk.blue.bold('\n🎯 Meta-Learning Performance Dashboard\n'));

    try {
      const dashboard = metaLearningService.getMetaLearningDashboard();
      
      console.log(chalk.cyan('📈 Model Performance (4h window):'));
      for (const [key, metrics] of Object.entries(dashboard.modelPerformance)) {
        const modelName = key.replace('_4h', '');
        const accuracyColor = metrics.accuracy > 0.6 ? chalk.green : metrics.accuracy > 0.5 ? chalk.yellow : chalk.red;
        const sharpeColor = metrics.sharpeRatio > 1 ? chalk.green : metrics.sharpeRatio > 0 ? chalk.yellow : chalk.red;
        
        console.log(chalk.blue(`\n  ${modelName}:`));
        console.log(accuracyColor(`    Accuracy: ${(metrics.accuracy * 100).toFixed(1)}%`));
        console.log(sharpeColor(`    Sharpe Ratio: ${metrics.sharpeRatio.toFixed(2)}`));
        console.log(chalk.gray(`    Win Rate: ${(metrics.winRate * 100).toFixed(1)}%`));
        console.log(chalk.gray(`    Max Drawdown: ${(metrics.maxDrawdown * 100).toFixed(1)}%`));
        console.log(chalk.gray(`    Sample Size: ${metrics.sampleSize}`));
        console.log(chalk.gray(`    Last Updated: ${new Date(metrics.lastUpdated).toLocaleTimeString()}`));
      }
      
      console.log(chalk.cyan('\n🎛️  Current Ensemble Weights:'));
      for (const [modelId, weight] of Object.entries(dashboard.ensembleWeights)) {
        const weightBar = '█'.repeat(Math.round(weight * 20));
        const weightColor = weight > 0.4 ? chalk.green : weight > 0.25 ? chalk.yellow : chalk.gray;
        console.log(weightColor(`  ${modelId.padEnd(20)} ${weightBar} ${(weight * 100).toFixed(1)}%`));
      }
      
      if (dashboard.currentRegime) {
        console.log(chalk.cyan('\n🌊 Current Market Regime:'));
        const regime = dashboard.currentRegime;
        console.log(chalk.yellow(`  Name: ${regime.name}`));
        console.log(chalk.yellow(`  Volatility: ${regime.characteristics.volatility}`));
        console.log(chalk.yellow(`  Trend: ${regime.characteristics.trend}`));
        console.log(chalk.yellow(`  Confidence: ${(regime.confidence * 100).toFixed(1)}%`));
        console.log(chalk.yellow(`  Detected: ${new Date(regime.detectedAt).toLocaleString()}`));
        console.log(chalk.yellow(`  Optimal Models: ${regime.optimalModels.join(', ')}`));
      }
      
      if (dashboard.recentAdaptations.length > 0) {
        console.log(chalk.cyan('\n🔄 Recent Adaptations:'));
        dashboard.recentAdaptations.slice(-5).forEach(adaptation => {
          const triggerColor = adaptation.trigger === 'performance' ? chalk.red :
                              adaptation.trigger === 'drift' ? chalk.yellow :
                              adaptation.trigger === 'regime_change' ? chalk.blue : chalk.gray;
          
          console.log(triggerColor(`  ${adaptation.modelId}: ${adaptation.trigger} (${new Date(adaptation.timestamp).toLocaleTimeString()})`));
        });
      }
      
    } catch (error) {
      console.log(chalk.red.bold('❌ Failed to get dashboard'));
      console.log(chalk.red((error as Error).message));
    }
  });

// Monitor regime changes
program
  .command('monitor-regimes')
  .description('Monitor market regime changes in real-time')
  .option('-d, --duration <seconds>', 'Monitoring duration in seconds', '300')
  .action(async (options) => {
    console.log(chalk.blue.bold('\n🌊 Monitoring Market Regime Changes...\n'));

    try {
      await metaLearningService.initialize();
      
      const duration = parseInt(options.duration) * 1000;
      console.log(chalk.cyan(`Monitoring for ${options.duration} seconds...`));
      console.log(chalk.yellow('Press Ctrl+C to stop'));
      
      // Listen to regime changes
      metaLearningService.on('regimeChange', (regime) => {
        console.log(chalk.green.bold(`\n🌊 NEW REGIME DETECTED: ${regime.name}`));
        console.log(chalk.cyan(`  Characteristics:`));
        console.log(chalk.yellow(`    Volatility: ${regime.characteristics.volatility}`));
        console.log(chalk.yellow(`    Trend: ${regime.characteristics.trend}`));
        console.log(chalk.yellow(`    Volume: ${regime.characteristics.volume}`));
        console.log(chalk.yellow(`    Correlation: ${regime.characteristics.correlation}`));
        console.log(chalk.cyan(`  Optimal Models: ${regime.optimalModels.join(', ')}`));
        console.log(chalk.gray(`  Confidence: ${(regime.confidence * 100).toFixed(1)}%`));
        console.log(chalk.gray(`  Time: ${new Date(regime.detectedAt).toLocaleString()}`));
      });
      
      // Listen to ensemble weight updates
      metaLearningService.on('ensembleWeightsUpdated', (weights) => {
        console.log(chalk.blue('\n🎛️  Ensemble weights updated:'));
        for (const [modelId, weight] of Object.entries(weights)) {
          console.log(chalk.yellow(`    ${modelId}: ${(weight * 100).toFixed(1)}%`));
        }
      });
      
      // Listen to model adaptations
      metaLearningService.on('modelAdapted', (data) => {
        const triggerColor = data.trigger === 'performance' ? chalk.red :
                           data.trigger === 'drift' ? chalk.yellow :
                           data.trigger === 'regime_change' ? chalk.blue : chalk.gray;
        
        console.log(triggerColor(`\n🔄 Model adapted: ${data.modelId} (${data.trigger})`));
        console.log(chalk.gray(`  Time: ${new Date(data.timestamp).toLocaleTimeString()}`));
      });
      
      // Show initial regime
      const currentRegime = metaLearningService.getCurrentRegime();
      if (currentRegime) {
        console.log(chalk.green(`\n📊 Current regime: ${currentRegime.name}`));
      }
      
      // Set timeout
      setTimeout(() => {
        console.log(chalk.green.bold('\n✅ Monitoring completed'));
        process.exit(0);
      }, duration);
      
      // Keep alive
      await new Promise(() => {});
      
    } catch (error) {
      console.log(chalk.red.bold('❌ Regime monitoring failed'));
      console.log(chalk.red((error as Error).message));
    }
  });

// Simulate model performance updates
program
  .command('simulate-performance')
  .description('Simulate model performance updates for testing')
  .option('-n, --samples <number>', 'Number of performance samples to simulate', '50')
  .option('-s, --symbol <symbol>', 'Symbol to simulate', 'BTC')
  .action(async (options) => {
    console.log(chalk.blue.bold('\n🎮 Simulating Model Performance Updates...\n'));

    try {
      await metaLearningService.initialize();
      
      const samples = parseInt(options.samples);
      const symbol = options.symbol;
      
      console.log(chalk.cyan(`Simulating ${samples} performance updates for ${symbol}...`));
      
      for (let i = 0; i < samples; i++) {
        // Generate synthetic features
        const features = await featureEngineeringService.generateFeatureVector(symbol, Date.now(), '4h');
        
        // Simulate different model predictions
        const models = ['tcn_model_1', 'lstm_model_1', 'transformer_model_1'];
        
        for (const modelId of models) {
          // Generate synthetic prediction
          const prediction = {
            symbol,
            timestamp: Date.now(),
            timeframe: '4h' as const,
            prediction: (Math.random() - 0.5) * 0.1, // ±5% prediction
            confidence: 0.6 + Math.random() * 0.3, // 60-90% confidence
            probability: { up: 0.6, down: 0.3, sideways: 0.1 },
            features: ['volatility_24h', 'rsi_14', 'macd'],
            modelVersion: '1.0.0'
          };
          
          // Generate synthetic actual return
          const actualReturn = (Math.random() - 0.5) * 0.08; // ±4% actual return
          
          // Update performance
          await metaLearningService.updateModelPerformance(modelId, prediction, actualReturn, features);
        }
        
        if (i % 10 === 0) {
          console.log(chalk.yellow(`  Processed ${i + 1}/${samples} samples...`));
        }
        
        // Small delay
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      console.log(chalk.green.bold('\n✅ Performance simulation completed!'));
      
      // Show updated performance
      console.log(chalk.cyan('\n📊 Updated Performance Metrics:'));
      const dashboard = metaLearningService.getMetaLearningDashboard();
      
      for (const [key, metrics] of Object.entries(dashboard.modelPerformance)) {
        const modelName = key.replace('_4h', '');
        console.log(chalk.blue(`\n  ${modelName}:`));
        console.log(chalk.yellow(`    Accuracy: ${(metrics.accuracy * 100).toFixed(1)}%`));
        console.log(chalk.yellow(`    Sharpe Ratio: ${metrics.sharpeRatio.toFixed(2)}`));
        console.log(chalk.yellow(`    Sample Size: ${metrics.sampleSize}`));
      }
      
      console.log(chalk.cyan('\n🎛️  Updated Ensemble Weights:'));
      for (const [modelId, weight] of Object.entries(dashboard.ensembleWeights)) {
        console.log(chalk.yellow(`  ${modelId}: ${(weight * 100).toFixed(1)}%`));
      }
      
    } catch (error) {
      console.log(chalk.red.bold('❌ Performance simulation failed'));
      console.log(chalk.red((error as Error).message));
    }
  });

// Force model adaptation
program
  .command('force-adapt')
  .description('Force adaptation for a specific model')
  .option('-m, --model <modelId>', 'Model ID to adapt', 'tcn_model_1')
  .action(async (options) => {
    console.log(chalk.blue.bold('\n🔄 Forcing Model Adaptation...\n'));

    try {
      await metaLearningService.initialize();
      
      const modelId = options.model;
      console.log(chalk.cyan(`Forcing adaptation for ${modelId}...`));
      
      // Get current performance
      const beforeMetrics = metaLearningService.getModelPerformance(modelId);
      if (beforeMetrics) {
        console.log(chalk.yellow('\n📊 Before Adaptation:'));
        console.log(chalk.gray(`  Accuracy: ${(beforeMetrics.accuracy * 100).toFixed(1)}%`));
        console.log(chalk.gray(`  Sharpe Ratio: ${beforeMetrics.sharpeRatio.toFixed(2)}`));
        console.log(chalk.gray(`  Sample Size: ${beforeMetrics.sampleSize}`));
      }
      
      // Force adaptation
      await metaLearningService.forceAdaptation(modelId);
      
      console.log(chalk.green(`✅ Adaptation triggered for ${modelId}`));
      
      // Show learning state
      const learningState = metaLearningService.getOnlineLearningState(modelId);
      if (learningState) {
        console.log(chalk.cyan('\n🎓 Learning State:'));
        console.log(chalk.yellow(`  Buffer Size: ${learningState.recentSamples.length}/${learningState.bufferSize}`));
        console.log(chalk.yellow(`  Adaptation Rate: ${learningState.adaptationRate}`));
        console.log(chalk.yellow(`  Forgetting Factor: ${learningState.forgettingFactor}`));
        console.log(chalk.yellow(`  Last Adaptation: ${new Date(learningState.lastAdaptation).toLocaleString()}`));
        console.log(chalk.yellow(`  Trigger: ${learningState.adaptationTrigger}`));
      }
      
    } catch (error) {
      console.log(chalk.red.bold('❌ Model adaptation failed'));
      console.log(chalk.red((error as Error).message));
    }
  });

// Show hyperparameter optimization status
program
  .command('hyperparams')
  .description('Show hyperparameter optimization status')
  .option('-m, --model-type <type>', 'Model type to show', 'tcn')
  .action(async (options) => {
    console.log(chalk.blue.bold('\n⚙️  Hyperparameter Optimization Status\n'));

    try {
      const modelType = options.modelType;
      const config = metaLearningService.getHyperparameterConfig(modelType);
      
      if (!config) {
        console.log(chalk.red(`❌ No configuration found for model type: ${modelType}`));
        return;
      }
      
      console.log(chalk.cyan(`📊 ${modelType.toUpperCase()} Model Configuration:`));
      
      console.log(chalk.yellow('\n🎯 Current Parameters:'));
      console.log(chalk.blue(`  Learning Rate: ${config.parameters.learningRate.current} (${config.parameters.learningRate.min} - ${config.parameters.learningRate.max})`));
      console.log(chalk.blue(`  Batch Size: ${config.parameters.batchSize.current} (options: ${config.parameters.batchSize.values.join(', ')})`));
      console.log(chalk.blue(`  Hidden Size: ${config.parameters.hiddenSize.current} (${config.parameters.hiddenSize.min} - ${config.parameters.hiddenSize.max})`));
      console.log(chalk.blue(`  Num Layers: ${config.parameters.numLayers.current} (${config.parameters.numLayers.min} - ${config.parameters.numLayers.max})`));
      console.log(chalk.blue(`  Dropout: ${config.parameters.dropout.current} (${config.parameters.dropout.min} - ${config.parameters.dropout.max})`));
      console.log(chalk.blue(`  L2 Regularization: ${config.parameters.l2Reg.current} (${config.parameters.l2Reg.min} - ${config.parameters.l2Reg.max})`));
      
      if (config.optimizationHistory.length > 0) {
        console.log(chalk.cyan('\n📈 Optimization History:'));
        const recentRuns = config.optimizationHistory.slice(-5);
        
        recentRuns.forEach((run, i) => {
          const performanceColor = run.performance > 0.5 ? chalk.green : run.performance > 0 ? chalk.yellow : chalk.red;
          console.log(chalk.gray(`\n  Run ${config.optimizationHistory.length - recentRuns.length + i + 1}:`));
          console.log(performanceColor(`    Performance: ${run.performance.toFixed(4)}`));
          console.log(chalk.blue(`    Learning Rate: ${run.params.learningRate}`));
          console.log(chalk.blue(`    Batch Size: ${run.params.batchSize}`));
          console.log(chalk.blue(`    Dropout: ${run.params.dropout}`));
          console.log(chalk.gray(`    Time: ${new Date(run.timestamp).toLocaleString()}`));
        });
        
        const bestRun = config.optimizationHistory.reduce((best, run) => 
          run.performance > best.performance ? run : best
        );
        
        console.log(chalk.green.bold('\n🏆 Best Performance:'));
        console.log(chalk.green(`  Score: ${bestRun.performance.toFixed(4)}`));
        console.log(chalk.yellow(`  Learning Rate: ${bestRun.params.learningRate}`));
        console.log(chalk.yellow(`  Batch Size: ${bestRun.params.batchSize}`));
        console.log(chalk.yellow(`  Dropout: ${bestRun.params.dropout}`));
      } else {
        console.log(chalk.gray('\n📈 No optimization history yet'));
      }
      
    } catch (error) {
      console.log(chalk.red.bold('❌ Failed to get hyperparameter status'));
      console.log(chalk.red((error as Error).message));
    }
  });

program.parse();