
/**
 * CLI Commands for Conformal Prediction Tuning Pipeline
 * Command-line interface for hyperparameter optimization
 */

import { Command } from 'commander';
import { logger } from '../../server/utils/logger';
import { CoarseGridSearch } from '../../server/tuning/coarse_grid_search';
import { OptunaOptimizer } from '../../server/tuning/optuna_optimizer';
import { WalkForwardValidator } from '../../server/tuning/walkforward_validator';
import * as fs from 'fs/promises';

export function registerConformalTuningCommands(program: Command): void {
  const conformalCmd = program
    .command('conformal')
    .description('Conformal prediction tuning pipeline commands');

  // Grid search command
  conformalCmd
    .command('grid-search')
    .description('Run coarse grid search optimization')
    .option('--data <file>', 'Path to training data JSON file')
    .option('--validation <file>', 'Path to validation data JSON file') 
    .option('--output <file>', 'Output file for results')
    .option('--max-iterations <n>', 'Maximum iterations', '500')
    .option('--convergence <n>', 'Convergence threshold', '0.001')
    .action(async (options) => {
      try {
        console.log('🔍 Starting Conformal Prediction Grid Search...\n');
        
        if (!options.data || !options.validation) {
          throw new Error('Both --data and --validation files are required');
        }
        
        // Load data
        const trainingData = JSON.parse(await fs.readFile(options.data, 'utf-8'));
        const validationData = JSON.parse(await fs.readFile(options.validation, 'utf-8'));
        
        console.log(`📊 Loaded ${trainingData.length} training samples`);
        console.log(`📊 Loaded ${validationData.length} validation samples\n`);
        
        // Run grid search
        const gridSearch = new CoarseGridSearch({
          maxIterations: parseInt(options.maxIterations),
          convergenceThreshold: parseFloat(options.convergence)
        });
        
        const result = await gridSearch.runSearch(trainingData, validationData);
        
        // Display results
        console.log('✅ Grid Search Completed!\n');
        console.log('🏆 Best Parameters:');
        console.log(`   Alpha: ${result.bestParams.alpha}`);
        console.log(`   Window Size: ${result.bestParams.windowSize}`);
        console.log(`   Kernel Bandwidth: ${result.bestParams.kernelBandwidth}`);
        console.log(`   Min Samples: ${result.bestParams.minSamples}\n`);
        
        console.log('📈 Performance:');
        console.log(`   Best Score: ${result.bestScore.toFixed(4)}`);
        console.log(`   Iterations: ${result.iterationsCompleted}`);
        console.log(`   Duration: ${(result.searchDuration / 1000).toFixed(1)}s\n`);
        
        // Save results
        if (options.output) {
          await fs.writeFile(options.output, JSON.stringify(result, null, 2));
          console.log(`💾 Results saved to ${options.output}`);
        }
        
      } catch (error) {
        console.error('❌ Grid search failed:', error.message);
        process.exit(1);
      }
    });

  // Optuna optimization command
  conformalCmd
    .command('optuna')
    .description('Run Optuna Bayesian optimization')
    .option('--data <file>', 'Path to training data JSON file')
    .option('--validation <file>', 'Path to validation data JSON file')
    .option('--output <file>', 'Output file for results')
    .option('--trials <n>', 'Number of trials', '100')
    .option('--timeout <n>', 'Timeout in seconds', '3600')
    .option('--sampler <type>', 'Sampler type', 'TPESampler')
    .action(async (options) => {
      try {
        console.log('🧠 Starting Optuna Hyperparameter Optimization...\n');
        
        if (!options.data || !options.validation) {
          throw new Error('Both --data and --validation files are required');
        }
        
        // Load data
        const trainingData = JSON.parse(await fs.readFile(options.data, 'utf-8'));
        const validationData = JSON.parse(await fs.readFile(options.validation, 'utf-8'));
        
        console.log(`📊 Loaded ${trainingData.length} training samples`);
        console.log(`📊 Loaded ${validationData.length} validation samples\n`);
        
        // Run Optuna optimization
        const optimizer = new OptunaOptimizer({
          nTrials: parseInt(options.trials),
          timeout: parseInt(options.timeout),
          sampler: options.sampler as any
        });
        
        const result = await optimizer.optimize(trainingData, validationData);
        
        // Display results
        console.log('✅ Optuna Optimization Completed!\n');
        console.log('🏆 Best Parameters:');
        console.log(`   Alpha: ${result.bestParams.alpha}`);
        console.log(`   Window Size: ${result.bestParams.windowSize}`);
        console.log(`   Kernel Bandwidth: ${result.bestParams.kernelBandwidth}`);
        console.log(`   Min Samples: ${result.bestParams.minSamples}\n`);
        
        console.log('📈 Study Statistics:');
        console.log(`   Best Value: ${result.bestValue.toFixed(4)}`);
        console.log(`   Total Trials: ${result.nTrials}`);
        console.log(`   Completed: ${result.studyStats.completedTrials}`);
        console.log(`   Pruned: ${result.studyStats.prunedTrials}`);
        console.log(`   Failed: ${result.studyStats.failedTrials}\n`);
        
        // Save results
        if (options.output) {
          await fs.writeFile(options.output, JSON.stringify(result, null, 2));
          console.log(`💾 Results saved to ${options.output}`);
        }
        
      } catch (error) {
        console.error('❌ Optuna optimization failed:', error.message);
        process.exit(1);
      }
    });

  // Walk-forward validation command
  conformalCmd
    .command('validate')
    .description('Run walk-forward validation with stress testing')
    .option('--data <file>', 'Path to historical data JSON file')
    .option('--params <file>', 'Path to conformal parameters JSON file')
    .option('--output <file>', 'Output file for results')
    .option('--window <n>', 'Validation window size', '1000')
    .option('--step <n>', 'Step size', '100')
    .action(async (options) => {
      try {
        console.log('🔬 Starting Walk-Forward Validation...\n');
        
        if (!options.data || !options.params) {
          throw new Error('Both --data and --params files are required');
        }
        
        // Load data and parameters
        const historicalData = JSON.parse(await fs.readFile(options.data, 'utf-8'));
        const conformalParams = JSON.parse(await fs.readFile(options.params, 'utf-8'));
        
        console.log(`📊 Loaded ${historicalData.length} historical samples`);
        console.log('🎛️  Parameters:');
        console.log(`   Alpha: ${conformalParams.alpha}`);
        console.log(`   Window Size: ${conformalParams.windowSize}`);
        console.log(`   Kernel Bandwidth: ${conformalParams.kernelBandwidth}`);
        console.log(`   Min Samples: ${conformalParams.minSamples}\n`);
        
        // Run walk-forward validation
        const validator = new WalkForwardValidator({
          windowSize: parseInt(options.window),
          stepSize: parseInt(options.step)
        });
        
        const result = await validator.validate(conformalParams, historicalData);
        
        // Display results
        console.log('✅ Walk-Forward Validation Completed!\n');
        console.log('📊 Overall Metrics:');
        console.log(`   Average Coverage: ${(result.overallMetrics.avgCoverage * 100).toFixed(1)}%`);
        console.log(`   Coverage Gap: ${(result.overallMetrics.avgCoverageGap * 100).toFixed(1)}%`);
        console.log(`   Avg Interval Width: ${(result.overallMetrics.avgIntervalWidth * 100).toFixed(1)}%`);
        console.log(`   Sharpe Ratio: ${result.overallMetrics.sharpeRatio.toFixed(2)}`);
        console.log(`   Win Rate: ${(result.overallMetrics.winRate * 100).toFixed(1)}%\n`);
        
        console.log('🧪 Stress Test Results:');
        for (const stressResult of result.stressTestResults) {
          const status = stressResult.passedTest ? '✅' : '❌';
          console.log(`   ${status} ${stressResult.scenario}: ${(stressResult.degradation * 100).toFixed(1)}% degradation`);
        }
        
        console.log('\n🎯 Recommendation:');
        console.log(`   Approved: ${result.recommendation.approved ? '✅' : '❌'}`);
        console.log(`   Confidence: ${(result.recommendation.confidence * 100).toFixed(1)}%`);
        
        if (result.recommendation.issues.length > 0) {
          console.log('\n⚠️  Issues:');
          result.recommendation.issues.forEach(issue => console.log(`   • ${issue}`));
        }
        
        if (result.recommendation.suggestions.length > 0) {
          console.log('\n💡 Suggestions:');
          result.recommendation.suggestions.forEach(suggestion => console.log(`   • ${suggestion}`));
        }
        
        // Save results
        if (options.output) {
          await fs.writeFile(options.output, JSON.stringify(result, null, 2));
          console.log(`\n💾 Results saved to ${options.output}`);
        }
        
      } catch (error) {
        console.error('❌ Walk-forward validation failed:', error.message);
        process.exit(1);
      }
    });

  // Generate test data command
  conformalCmd
    .command('generate-data')
    .description('Generate synthetic test data for tuning')
    .option('--samples <n>', 'Number of samples', '1000')
    .option('--features <n>', 'Number of features', '10')
    .option('--output <file>', 'Output file for data')
    .option('--noise <n>', 'Noise level', '0.1')
    .action(async (options) => {
      try {
        console.log('🎲 Generating synthetic test data...\n');
        
        const numSamples = parseInt(options.samples);
        const numFeatures = parseInt(options.features);
        const noiseLevel = parseFloat(options.noise);
        
        const data = [];
        const startDate = new Date('2024-01-01');
        
        for (let i = 0; i < numSamples; i++) {
          const features = Array.from({ length: numFeatures }, () => Math.random() * 2 - 1);
          const signal = features.reduce((sum, f) => sum + f, 0) / numFeatures;
          const noise = (Math.random() - 0.5) * noiseLevel;
          const actualReturn = signal * 0.02 + noise;
          
          const timestamp = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
          
          data.push({
            features,
            actualReturn,
            timestamp
          });
        }
        
        console.log(`✅ Generated ${numSamples} samples with ${numFeatures} features`);
        console.log(`📊 Return range: [${Math.min(...data.map(d => d.actualReturn)).toFixed(4)}, ${Math.max(...data.map(d => d.actualReturn)).toFixed(4)}]`);
        
        if (options.output) {
          await fs.writeFile(options.output, JSON.stringify(data, null, 2));
          console.log(`💾 Data saved to ${options.output}`);
        } else {
          console.log('📋 Use --output to save the generated data');
        }
        
      } catch (error) {
        console.error('❌ Data generation failed:', error.message);
        process.exit(1);
      }
    });
}
