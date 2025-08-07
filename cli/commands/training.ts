#!/usr/bin/env node
/**
 * STEVIE TRAINING DAY CLI COMMANDS
 * Complete training loop commands for benchmark hardening
 */

import { Command } from 'commander';
import { StevieVersionedBenchmark } from '../../server/training/benchmarkTest';
import { StevieTrainingDay } from '../../server/training/trainIterate';
import { StevieTrainingReporter } from '../../server/training/trainingReporter';
import SteveDifficultyScheduler from '../../server/training/difficultyScheduler';

const trainingCommand = new Command('training');

trainingCommand
  .description('Stevie Training Day - Versioned iterative benchmark hardening loop');

// Benchmark command
trainingCommand
  .command('benchmark')
  .alias('bench')
  .description('Run versioned benchmark test')
  .option('--version <version>', 'Benchmark version (e.g., 1.1)', '1.1')
  .option('--days <days>', 'Test duration in days', '7')
  .option('--shocks <shocks>', 'Number of market shocks', '0')
  .option('--noise <noise>', 'Price noise level (%)', '2')
  .option('--slippage <slippage>', 'Slippage rate (%)', '0.1')
  .action(async (options) => {
    console.log('🎯 Running Stevie Versioned Benchmark');
    
    const benchmark = new StevieVersionedBenchmark();
    
    const config = {
      version: options.version,
      days: parseInt(options.days),
      marketShocks: parseInt(options.shocks),
      noiseLevel: parseFloat(options.noise),
      slippageRate: parseFloat(options.slippage),
      minTradesRequired: 5
    };
    
    try {
      const result = await benchmark.runBenchmark(config);
      console.log(`\n✅ Benchmark completed successfully`);
      console.log(`📊 Performance: ${result.performance.totalReturn.toFixed(2)}%`);
      console.log(`📄 Results saved to: benchmark-results/`);
    } catch (error) {
      console.error('❌ Benchmark failed:', error);
      process.exit(1);
    }
  });

// Training Day main command
trainingCommand
  .command('day')
  .alias('iterate')
  .description('Start complete Training Day iterative loop')
  .option('--initial-days <days>', 'Initial test duration', '7')
  .option('--initial-version <version>', 'Starting Stevie version', '1.4.0')
  .option('--max-iterations <max>', 'Maximum iterations', '20')
  .option('--min-improvement <improvement>', 'Minimum improvement threshold', '0.005')
  .option('--epochs <epochs>', 'Training epochs per iteration', '50')
  .action(async (options) => {
    console.log('🚀 STEVIE TRAINING DAY INITIATED');
    
    const trainingDay = new StevieTrainingDay();
    
    const config = {
      initialDays: parseInt(options.initialDays),
      initialVersion: options.initialVersion,
      maxIterations: parseInt(options.maxIterations),
      minImprovement: parseFloat(options.minImprovement),
      retrainEpochs: parseInt(options.epochs)
    };
    
    try {
      const report = await trainingDay.startTrainingDay(config);
      console.log(`\n🎓 Training Day completed!`);
      console.log(`🏷️ Final Version: Stevie v${report.finalVersion}`);
      console.log(`📊 Overall Improvement: ${(report.performanceTrend.overallImprovement * 100).toFixed(2)}%`);
      console.log(`📄 Full report saved to: training-results/`);
    } catch (error) {
      console.error('❌ Training Day failed:', error);
      process.exit(1);
    }
  });

// Difficulty scheduler command
trainingCommand
  .command('difficulty')
  .alias('diff')
  .description('Analyze difficulty progression')
  .option('--start-version <version>', 'Starting version', '1.1')
  .option('--versions <count>', 'Number of versions to show', '10')
  .action(async (options) => {
    console.log('🎚️ Stevie Difficulty Analysis');
    
    const scheduler = new SteveDifficultyScheduler();
    const roadmap = scheduler.getVersionRoadmap(options.startVersion, parseInt(options.versions));
    
    console.log('\n📋 Difficulty Progression:');
    console.log('Version | Days | Shocks | Noise | Slippage | Description');
    console.log('--------|------|--------|-------|----------|-------------');
    
    roadmap.forEach(config => {
      const description = scheduler.getDifficultyDescription(config.version);
      console.log(`${config.version.padEnd(7)} | ${config.days.toString().padStart(4)} | ${config.marketShocks.toString().padStart(6)} | ${config.noiseLevel.toFixed(1).padStart(5)}% | ${config.slippageRate.toFixed(2).padStart(8)}% | ${description}`);
    });
  });

// Report command
trainingCommand
  .command('report')
  .description('Generate training analysis report')
  .option('--session <sessionId>', 'Specific session to analyze')
  .option('--plot', 'Include ASCII plots')
  .option('--summary', 'Show summary of all sessions')
  .action(async (options) => {
    const reporter = new StevieTrainingReporter();
    
    if (options.summary) {
      await reporter.generateSummaryReport();
    } else {
      await reporter.generateReport(options.session, options.plot);
    }
  });

// Version increment command
trainingCommand
  .command('version')
  .description('Version management utilities')
  .option('--current <version>', 'Current version to increment', '1.1')
  .option('--count <count>', 'Number of increments to show', '5')
  .action(async (options) => {
    const scheduler = new SteveDifficultyScheduler();
    
    console.log('🔢 Version Progression:');
    let version = options.current;
    
    for (let i = 0; i < parseInt(options.count); i++) {
      const description = scheduler.getDifficultyDescription(version);
      const milestone = scheduler.isMajorMilestone(version);
      
      console.log(`${version} - ${description}${milestone ? ' 🎯 MILESTONE' : ''}`);
      version = scheduler.increase(version);
    }
  });

// Quick benchmark run command
trainingCommand
  .command('quick')
  .description('Quick benchmark test with current settings')
  .action(async () => {
    console.log('⚡ Quick Stevie Benchmark Test');
    
    const benchmark = new StevieVersionedBenchmark();
    
    const config = {
      version: '1.4.0',
      days: 3, // Quick 3-day test
      marketShocks: 1,
      noiseLevel: 5,
      slippageRate: 0.1,
      minTradesRequired: 3
    };
    
    try {
      const result = await benchmark.runBenchmark(config);
      console.log(`\n⚡ Quick test completed`);
      console.log(`📈 Return: ${result.performance.totalReturn.toFixed(2)}%`);
      console.log(`🎯 Win Rate: ${result.performance.winRate.toFixed(1)}%`);
      console.log(`📊 Sharpe: ${result.performance.sharpeRatio.toFixed(3)}`);
    } catch (error) {
      console.error('❌ Quick test failed:', error);
    }
  });

export { trainingCommand };