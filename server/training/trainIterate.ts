#!/usr/bin/env tsx

/**
 * STEVIE ITERATIVE TRAINING LOOP - "TRAINING DAY"
 * Automated benchmark → train → improve loop with version tracking
 */

import { StevieVersionedBenchmark, BenchmarkConfig, BenchmarkResult } from './benchmarkTest';
import SteveDifficultyScheduler from './difficultyScheduler';
import { performance } from 'perf_hooks';
import fs from 'fs';
import path from 'path';

interface TrainingIteration {
  iterationNumber: number;
  stevieVersion: string;
  benchmarkVersion: string;
  difficulty: any;
  performance: {
    totalReturn: number;
    sharpeRatio: number;
    maxDrawdown: number;
    winRate: number;
    improvement: number;
  };
  trainingTime: number;
  status: 'success' | 'failed' | 'insufficient_improvement' | 'max_iterations_reached';
  metadata: any;
}

interface TrainingDayReport {
  sessionId: string;
  startTime: number;
  endTime: number;
  initialVersion: string;
  finalVersion: string;
  totalIterations: number;
  successfulIterations: number;
  iterations: TrainingIteration[];
  stoppingCriteria: {
    reason: string;
    finalImprovement: number;
    threshold: number;
  };
  performanceTrend: {
    bestIteration: TrainingIteration;
    worstIteration: TrainingIteration;
    overallImprovement: number;
    averageImprovement: number;
  };
  recommendations: string[];
}

export class StevieTrainingDay {
  private benchmark: StevieVersionedBenchmark;
  private scheduler: SteveDifficultyScheduler;
  private sessionId: string;
  private resultsDir = './training-results';

  constructor() {
    this.benchmark = new StevieVersionedBenchmark();
    this.scheduler = new SteveDifficultyScheduler();
    this.sessionId = `training_${Date.now()}`;
    
    if (!fs.existsSync(this.resultsDir)) {
      fs.mkdirSync(this.resultsDir, { recursive: true });
    }
  }

  async startTrainingDay(config: {
    initialDays: number;
    initialVersion: string;
    maxIterations: number;
    minImprovement: number;
    retrainEpochs?: number;
  }): Promise<TrainingDayReport> {
    
    console.log('🚀 STEVIE TRAINING DAY INITIATED');
    console.log('='.repeat(50));
    console.log(`📝 Session ID: ${this.sessionId}`);
    console.log(`🎯 Starting Version: Stevie v${config.initialVersion}`);
    console.log(`🎚️ Initial Difficulty: ${config.initialDays} days`);
    console.log(`🔄 Max Iterations: ${config.maxIterations}`);
    console.log(`📊 Min Improvement: ${(config.minImprovement * 100).toFixed(1)}%`);
    console.log('='.repeat(50));

    const startTime = performance.now();
    const iterations: TrainingIteration[] = [];
    
    let currentVersion = config.initialVersion;
    let benchmarkVersion = '1.1';
    let previousPerformance = 0;
    let consecutiveFailures = 0;
    
    for (let i = 1; i <= config.maxIterations; i++) {
      console.log(`\n🔄 ITERATION ${i}/${config.maxIterations}`);
      console.log(`🏷️ Stevie Version: ${currentVersion}`);
      console.log(`🎯 Benchmark Version: ${benchmarkVersion}`);
      
      const iterationStart = performance.now();
      
      try {
        // 1. Run benchmark test
        const difficultyConfig = this.scheduler.getDifficultyConfig(benchmarkVersion);
        const benchmarkConfig: BenchmarkConfig = {
          version: benchmarkVersion,
          days: Math.max(config.initialDays, difficultyConfig.days),
          marketShocks: difficultyConfig.marketShocks,
          noiseLevel: difficultyConfig.noiseLevel,
          slippageRate: difficultyConfig.slippageRate,
          minTradesRequired: 5
        };

        console.log(`⚡ Running benchmark with difficulty level ${difficultyConfig.days} days...`);
        const benchmarkResult = await this.benchmark.runBenchmark(benchmarkConfig);
        
        // 2. Calculate improvement
        const currentPerformance = benchmarkResult.performance.totalReturn;
        const improvement = i === 1 ? 0 : (currentPerformance - previousPerformance) / Math.abs(previousPerformance);
        
        console.log(`📈 Performance: ${currentPerformance.toFixed(2)}% (${improvement >= 0 ? '+' : ''}${(improvement * 100).toFixed(2)}% vs previous)`);
        
        // 3. Check improvement criteria
        const iteration: TrainingIteration = {
          iterationNumber: i,
          stevieVersion: currentVersion,
          benchmarkVersion: benchmarkVersion,
          difficulty: difficultyConfig,
          performance: {
            totalReturn: currentPerformance,
            sharpeRatio: benchmarkResult.performance.sharpeRatio,
            maxDrawdown: benchmarkResult.performance.maxDrawdown,
            winRate: benchmarkResult.performance.winRate,
            improvement: improvement
          },
          trainingTime: performance.now() - iterationStart,
          status: 'success',
          metadata: {
            totalTrades: benchmarkResult.performance.totalTrades,
            difficultyLevel: benchmarkResult.difficulty.level,
            marketRegimes: benchmarkResult.metadata.marketRegimes
          }
        };

        if (i > 1 && improvement < config.minImprovement) {
          consecutiveFailures++;
          iteration.status = 'insufficient_improvement';
          
          console.log(`⚠️ Insufficient improvement: ${(improvement * 100).toFixed(3)}% < ${(config.minImprovement * 100).toFixed(1)}%`);
          
          if (consecutiveFailures >= 3) {
            iterations.push(iteration);
            console.log('🛑 Stopping: 3 consecutive insufficient improvements');
            break;
          }
        } else {
          consecutiveFailures = 0;
        }

        iterations.push(iteration);
        previousPerformance = currentPerformance;

        // 4. Scale difficulty and increment versions
        if (improvement >= config.minImprovement || i === 1) {
          benchmarkVersion = this.scheduler.increase(benchmarkVersion);
          currentVersion = this.incrementStevieVersion(currentVersion);
          
          // 5. Retrain Stevie (simulated)
          console.log(`🧠 Retraining Stevie v${currentVersion}...`);
          await this.retrainStevie(config.retrainEpochs || 50);
          
          console.log(`✅ Training successful - upgraded to Stevie v${currentVersion}`);
        }
        
      } catch (error) {
        console.error(`❌ Iteration ${i} failed:`, error);
        iterations.push({
          iterationNumber: i,
          stevieVersion: currentVersion,
          benchmarkVersion: benchmarkVersion,
          difficulty: {},
          performance: { totalReturn: 0, sharpeRatio: 0, maxDrawdown: 0, winRate: 0, improvement: -1 },
          trainingTime: performance.now() - iterationStart,
          status: 'failed',
          metadata: { error: error instanceof Error ? error.message : String(error) }
        });
        
        consecutiveFailures++;
        if (consecutiveFailures >= 2) {
          console.log('🛑 Stopping: 2 consecutive failures');
          break;
        }
      }
    }

    const endTime = performance.now();
    
    // Generate comprehensive report
    const report = this.generateTrainingReport({
      sessionId: this.sessionId,
      startTime: startTime,
      endTime: endTime,
      initialVersion: config.initialVersion,
      finalVersion: currentVersion,
      iterations: iterations,
      config: config
    });

    // Save and display report
    await this.saveTrainingReport(report);
    this.displayTrainingReport(report);

    return report;
  }

  private incrementStevieVersion(currentVersion: string): string {
    const [major, minor, patch = 0] = currentVersion.split('.').map(Number);
    
    // Training iterations increment patch version: 1.4.0 → 1.4.1 → 1.4.2
    return `${major}.${minor}.${patch + 1}`;
  }

  private async retrainStevie(epochs: number): Promise<void> {
    // Simulate training time (in real implementation, this would call actual ML training)
    const trainingTime = Math.random() * 2000 + 1000; // 1-3 seconds
    await new Promise(resolve => setTimeout(resolve, trainingTime));
    
    console.log(`   📚 Completed ${epochs} epochs in ${(trainingTime/1000).toFixed(1)}s`);
  }

  private generateTrainingReport(data: any): TrainingDayReport {
    const successfulIterations = data.iterations.filter((i: any) => i.status === 'success');
    const performances = successfulIterations.map((i: any) => i.performance.totalReturn);
    
    let bestIteration = successfulIterations[0];
    let worstIteration = successfulIterations[0];
    
    for (const iteration of successfulIterations) {
      if (iteration.performance.totalReturn > bestIteration?.performance.totalReturn) {
        bestIteration = iteration;
      }
      if (iteration.performance.totalReturn < worstIteration?.performance.totalReturn) {
        worstIteration = iteration;
      }
    }

    const overallImprovement = performances.length >= 2 ? 
      (performances[performances.length - 1] - performances[0]) / Math.abs(performances[0]) : 0;
    
    const averageImprovement = data.iterations
      .filter((i: any) => i.iterationNumber > 1)
      .reduce((sum: number, i: any) => sum + i.performance.improvement, 0) / 
      Math.max(1, data.iterations.length - 1);

    const lastIteration = data.iterations[data.iterations.length - 1];
    const stoppingReason = lastIteration?.status === 'insufficient_improvement' ? 
      'Insufficient improvement' :
      lastIteration?.status === 'failed' ? 
      'Training failures' : 
      'Maximum iterations reached';

    return {
      sessionId: data.sessionId,
      startTime: data.startTime,
      endTime: data.endTime,
      initialVersion: data.initialVersion,
      finalVersion: data.finalVersion,
      totalIterations: data.iterations.length,
      successfulIterations: successfulIterations.length,
      iterations: data.iterations,
      stoppingCriteria: {
        reason: stoppingReason,
        finalImprovement: lastIteration?.performance.improvement || 0,
        threshold: data.config.minImprovement
      },
      performanceTrend: {
        bestIteration: bestIteration || data.iterations[0],
        worstIteration: worstIteration || data.iterations[0],
        overallImprovement,
        averageImprovement
      },
      recommendations: this.generateRecommendations(data.iterations, overallImprovement)
    };
  }

  private generateRecommendations(iterations: TrainingIteration[], overallImprovement: number): string[] {
    const recommendations: string[] = [];
    const successRate = iterations.filter(i => i.status === 'success').length / iterations.length;
    
    if (successRate < 0.5) {
      recommendations.push('Consider reducing initial difficulty or extending training epochs');
    }
    
    if (overallImprovement < 0) {
      recommendations.push('Model may be overfitting - consider regularization or simpler architecture');
    } else if (overallImprovement > 0.2) {
      recommendations.push('Excellent learning progress - consider more aggressive difficulty scaling');
    }
    
    const avgTrainingTime = iterations.reduce((sum, i) => sum + i.trainingTime, 0) / iterations.length;
    if (avgTrainingTime > 30000) { // 30 seconds
      recommendations.push('Training time is high - consider optimizing hyperparameters or reducing model complexity');
    }
    
    if (recommendations.length === 0) {
      recommendations.push('Training performance is balanced - continue with current parameters');
    }
    
    return recommendations;
  }

  private async saveTrainingReport(report: TrainingDayReport): Promise<void> {
    const filename = `training_day_${this.sessionId}.json`;
    const filepath = path.join(this.resultsDir, filename);
    
    fs.writeFileSync(filepath, JSON.stringify(report, null, 2));
    
    // Save latest report
    const latestPath = path.join(this.resultsDir, 'latest_training_day.json');
    fs.writeFileSync(latestPath, JSON.stringify(report, null, 2));
    
    console.log(`\n📄 Training report saved: ${filename}`);
  }

  private displayTrainingReport(report: TrainingDayReport): void {
    const duration = (report.endTime - report.startTime) / 1000;
    
    console.log('\n🎓 TRAINING DAY COMPLETE');
    console.log('='.repeat(60));
    console.log(`🏷️ Session: ${report.sessionId}`);
    console.log(`⏱️ Duration: ${(duration / 60).toFixed(1)} minutes`);
    console.log(`🚀 Version Progression: ${report.initialVersion} → ${report.finalVersion}`);
    console.log(`🔄 Total Iterations: ${report.totalIterations}`);
    console.log(`✅ Successful: ${report.successfulIterations}/${report.totalIterations}`);
    console.log(`🛑 Stopping Reason: ${report.stoppingCriteria.reason}`);
    console.log(`📈 Overall Improvement: ${(report.performanceTrend.overallImprovement * 100).toFixed(2)}%`);
    
    console.log('\n📊 PERFORMANCE SUMMARY');
    console.log('-'.repeat(40));
    console.log(`🏆 Best Performance: ${report.performanceTrend.bestIteration.performance.totalReturn.toFixed(2)}% (v${report.performanceTrend.bestIteration.stevieVersion})`);
    console.log(`📉 Worst Performance: ${report.performanceTrend.worstIteration.performance.totalReturn.toFixed(2)}% (v${report.performanceTrend.worstIteration.stevieVersion})`);
    console.log(`📊 Average Improvement: ${(report.performanceTrend.averageImprovement * 100).toFixed(2)}%`);
    
    console.log('\n💡 RECOMMENDATIONS');
    console.log('-'.repeat(40));
    report.recommendations.forEach((rec, i) => {
      console.log(`${i + 1}. ${rec}`);
    });
    
    console.log('\n📈 ITERATION BREAKDOWN');
    console.log('-'.repeat(40));
    report.iterations.forEach(iteration => {
      const status = iteration.status === 'success' ? '✅' : 
                    iteration.status === 'failed' ? '❌' : '⚠️';
      const improvement = iteration.iterationNumber > 1 ? 
        `(${iteration.performance.improvement >= 0 ? '+' : ''}${(iteration.performance.improvement * 100).toFixed(1)}%)` : '';
      
      console.log(`${status} Iteration ${iteration.iterationNumber}: Stevie v${iteration.stevieVersion} - ${iteration.performance.totalReturn.toFixed(1)}% ${improvement}`);
    });
    
    console.log('='.repeat(60));
  }
}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  
  const config = {
    initialDays: parseInt(args.find(arg => arg.startsWith('--initial-days='))?.split('=')[1] || '7'),
    initialVersion: args.find(arg => arg.startsWith('--initial-version='))?.split('=')[1] || '1.4.0',
    maxIterations: parseInt(args.find(arg => arg.startsWith('--max-iterations='))?.split('=')[1] || '20'),
    minImprovement: parseFloat(args.find(arg => arg.startsWith('--min-improvement='))?.split('=')[1] || '0.005'),
    retrainEpochs: parseInt(args.find(arg => arg.startsWith('--epochs='))?.split('=')[1] || '50')
  };
  
  const trainingDay = new StevieTrainingDay();
  trainingDay.startTrainingDay(config).catch(console.error);
}

export type { TrainingIteration, TrainingDayReport };