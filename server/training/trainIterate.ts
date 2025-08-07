/**
 * PHASE 3: TRAIN ITERATE - AUTOMATED IMPROVEMENT CYCLES
 * Orchestrates continuous training and benchmarking with version bumping
 */

import { simulationEngine } from '../services/simulationEngine';
import { difficultyScheduler } from './difficultyScheduler';
import { logger } from '../utils/logger';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';

const execAsync = promisify(exec);

export interface TrainingIteration {
  iteration: number;
  version: string;
  startTime: number;
  endTime: number;
  performance: {
    winRate: number;
    sharpeRatio: number;
    totalReturn: number;
    maxDrawdown: number;
  };
  improvementFromPrevious: number;
  trainingDuration: number;
  benchmarkDuration: number;
  status: 'success' | 'failed' | 'plateau';
}

export class TrainingIterator {
  private currentIteration = 0;
  private isRunning = false;
  private iterations: TrainingIteration[] = [];
  
  async startIterativeTraining(maxIterations: number = 50, plateauThreshold: number = 0.005): Promise<void> {
    this.isRunning = true;
    logger.info('🔄 Starting iterative training process', {
      maxIterations,
      plateauThreshold: plateauThreshold * 100 + '%'
    });

    await difficultyScheduler.initialize();
    
    let previousPerformance = 0;
    let plateauCount = 0;
    const maxPlateau = 5; // Stop after 5 consecutive plateaus
    
    for (let i = 0; i < maxIterations && this.isRunning; i++) {
      try {
        const iteration = await this.runSingleIteration(i + 1, previousPerformance);
        this.iterations.push(iteration);
        
        // Check for improvement
        const improvement = iteration.improvementFromPrevious;
        
        if (improvement < plateauThreshold) {
          plateauCount++;
          logger.warn(`📉 Plateau detected (${plateauCount}/${maxPlateau})`, {
            improvement: (improvement * 100).toFixed(3) + '%',
            threshold: (plateauThreshold * 100).toFixed(3) + '%'
          });
          
          if (plateauCount >= maxPlateau) {
            logger.info('🛑 Training stopped due to performance plateau');
            break;
          }
        } else {
          plateauCount = 0; // Reset plateau counter
          logger.info('📈 Performance improvement detected', {
            improvement: (improvement * 100).toFixed(2) + '%'
          });
        }
        
        previousPerformance = iteration.performance.sharpeRatio;
        
        // Save progress
        await this.saveIterationResults();
        
        // Brief pause between iterations
        await this.sleep(5000);
        
      } catch (error) {
        logger.error(`Training iteration ${i + 1} failed:`, error as Record<string, any>);
        break;
      }
    }
    
    this.isRunning = false;
    await this.generateFinalReport();
    logger.info('✅ Iterative training completed', {
      totalIterations: this.iterations.length,
      bestPerformance: this.getBestIteration()?.performance.sharpeRatio.toFixed(2) || 'N/A'
    });
  }

  private async runSingleIteration(iteration: number, previousPerformance: number): Promise<TrainingIteration> {
    const startTime = Date.now();
    
    logger.info(`🎯 Starting iteration ${iteration}`);
    
    // 1. Get current version and generate difficulty config
    const currentVersion = await this.getCurrentVersion();
    const improvement = iteration === 1 ? 0.1 : (Math.random() - 0.4) * 0.2; // Simulate improvement
    const newVersion = await difficultyScheduler.getNextVersion(currentVersion, improvement);
    const difficultyConfig = await difficultyScheduler.generateDifficultyConfig(newVersion, previousPerformance);
    
    // 2. Run behavior cloning if needed
    const behaviorCloningDuration = await this.runBehaviorCloning();
    
    // 3. Run advanced RL training
    const rlTrainingDuration = await this.runRLTraining(difficultyConfig.version);
    
    // 4. Run comprehensive benchmark
    const benchmarkStart = Date.now();
    const benchmarkResults = await this.runBenchmark(difficultyConfig);
    const benchmarkDuration = Date.now() - benchmarkStart;
    
    // 5. Calculate performance metrics
    const performance = {
      winRate: benchmarkResults.winRate,
      sharpeRatio: benchmarkResults.sharpeRatio,
      totalReturn: benchmarkResults.totalReturn,
      maxDrawdown: benchmarkResults.maxDrawdown
    };
    
    const improvementFromPrevious = previousPerformance > 0 ? 
      (performance.sharpeRatio - previousPerformance) / previousPerformance : 0.1;
    
    // 6. Update progression tracking
    await difficultyScheduler.updateProgression(
      parseFloat(newVersion.split('.')[0] + '.' + newVersion.split('.')[1]),
      improvementFromPrevious
    );
    
    const endTime = Date.now();
    const totalDuration = endTime - startTime;
    
    const result: TrainingIteration = {
      iteration,
      version: newVersion,
      startTime,
      endTime,
      performance,
      improvementFromPrevious,
      trainingDuration: behaviorCloningDuration + rlTrainingDuration,
      benchmarkDuration,
      status: improvementFromPrevious > 0.005 ? 'success' : 
               improvementFromPrevious < -0.01 ? 'failed' : 'plateau'
    };
    
    logger.info(`✅ Iteration ${iteration} completed`, {
      version: newVersion,
      performance: performance.sharpeRatio.toFixed(3),
      improvement: (improvementFromPrevious * 100).toFixed(2) + '%',
      duration: (totalDuration / 1000).toFixed(1) + 's'
    });
    
    return result;
  }

  private async runBehaviorCloning(): Promise<number> {
    const start = Date.now();
    
    try {
      // Check if behavior cloning model needs updating
      const modelExists = await this.fileExists('./models/behavior_cloning_model.h5');
      const dataExists = await this.fileExists('./data/historical');
      
      if (!dataExists) {
        logger.warn('Historical data not found, running data ingestion first');
        await execAsync('tsx scripts/loadAllData.ts');
      }
      
      if (!modelExists) {
        logger.info('🧠 Running behavior cloning pretraining...');
        await execAsync('python server/rl/behaviorClone.py');
      }
      
      return Date.now() - start;
    } catch (error) {
      logger.error('Behavior cloning failed:', error as Record<string, any>);
      return Date.now() - start;
    }
  }

  private async runRLTraining(version: string): Promise<number> {
    const start = Date.now();
    
    try {
      logger.info(`🤖 Running RL training for version ${version}`);
      
      // Run PPO training with version-specific config
      const trainingConfig = {
        version,
        episodes: 1000,
        learning_rate: 0.0003,
        batch_size: 64,
        gamma: 0.99
      };
      
      // Save training config
      await fs.writeFile(
        `./models/training_config_${version}.json`,
        JSON.stringify(trainingConfig, null, 2)
      );
      
      // Execute RL training (would be actual Python/ML training in real implementation)
      logger.info('RL training simulation completed');
      
      return Date.now() - start;
    } catch (error) {
      logger.error('RL training failed:', error as Record<string, any>);
      return Date.now() - start;
    }
  }

  private async runBenchmark(difficultyConfig: any): Promise<{
    winRate: number;
    sharpeRatio: number;
    totalReturn: number;
    maxDrawdown: number;
  }> {
    logger.info(`📊 Running benchmark with difficulty config`);
    
    // Create simulation configuration
    const simulationConfigs = [
      {
        symbol: 'BTC',
        startTime: Date.now() - (difficultyConfig.days * 24 * 60 * 60 * 1000),
        endTime: Date.now(),
        initialBalance: 10000,
        timeStep: 60 * 60 * 1000, // 1 hour steps
        riskPerTrade: 0.02,
        maxPositionSize: 0.5,
        commission: 0.001
      },
      {
        symbol: 'ETH',
        startTime: Date.now() - (difficultyConfig.days * 24 * 60 * 60 * 1000),
        endTime: Date.now(),
        initialBalance: 10000,
        timeStep: 60 * 60 * 1000,
        riskPerTrade: 0.02,
        maxPositionSize: 0.5,
        commission: 0.001
      }
    ];

    // Run simulations
    const results = await simulationEngine.runBatchSimulation(simulationConfigs);
    const stats = await simulationEngine.getSimulationStatistics(results);
    
    // Apply difficulty modifiers
    const baseResults = {
      winRate: stats.avgWinRate,
      sharpeRatio: stats.avgSharpe,
      totalReturn: stats.avgReturn,
      maxDrawdown: 15 // Estimate
    };
    
    // Adjust for difficulty (noise, slippage, etc.)
    const adjustedResults = {
      winRate: Math.max(0, baseResults.winRate - difficultyConfig.noiseLevel),
      sharpeRatio: Math.max(0, baseResults.sharpeRatio - difficultyConfig.slippageRate * 100),
      totalReturn: baseResults.totalReturn * (1 - difficultyConfig.slippageRate),
      maxDrawdown: baseResults.maxDrawdown * difficultyConfig.volatilityMultiplier
    };
    
    logger.info('📈 Benchmark completed', {
      winRate: adjustedResults.winRate.toFixed(1) + '%',
      sharpe: adjustedResults.sharpeRatio.toFixed(2),
      return: adjustedResults.totalReturn.toFixed(2) + '%'
    });
    
    return adjustedResults;
  }

  private async getCurrentVersion(): Promise<string> {
    try {
      const difficulty = await difficultyScheduler.getCurrentDifficulty();
      return difficulty.config?.version || '1.0.0';
    } catch {
      return '1.0.0';
    }
  }

  private async saveIterationResults(): Promise<void> {
    const resultsPath = './benchmark-results/training-iterations.json';
    await fs.writeFile(resultsPath, JSON.stringify(this.iterations, null, 2));
  }

  private async generateFinalReport(): Promise<void> {
    const bestIteration = this.getBestIteration();
    const totalDuration = this.iterations.reduce((sum, iter) => sum + (iter.endTime - iter.startTime), 0);
    
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        totalIterations: this.iterations.length,
        totalDuration: totalDuration,
        bestIteration: bestIteration?.iteration || 0,
        bestPerformance: bestIteration?.performance || null,
        finalVersion: this.iterations[this.iterations.length - 1]?.version || 'unknown',
        averageImprovement: this.iterations.reduce((sum, iter) => sum + iter.improvementFromPrevious, 0) / this.iterations.length
      },
      iterations: this.iterations,
      recommendations: this.generateRecommendations()
    };
    
    const reportPath = './benchmark-results/training-final-report.json';
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    
    logger.info('📋 Final training report generated', {
      path: reportPath,
      bestSharpe: bestIteration?.performance.sharpeRatio.toFixed(2) || 'N/A'
    });
  }

  private getBestIteration(): TrainingIteration | null {
    return this.iterations.reduce((best, current) => 
      !best || current.performance.sharpeRatio > best.performance.sharpeRatio ? current : best
    , null as TrainingIteration | null);
  }

  private generateRecommendations(): string[] {
    const recommendations: string[] = [];
    
    if (this.iterations.length === 0) {
      return ['No iterations completed - check system configuration'];
    }
    
    const avgImprovement = this.iterations.reduce((sum, iter) => sum + iter.improvementFromPrevious, 0) / this.iterations.length;
    const bestPerformance = this.getBestIteration();
    
    if (avgImprovement < 0.001) {
      recommendations.push('Consider adjusting hyperparameters or training methodology');
      recommendations.push('Review difficulty progression settings');
    }
    
    if (bestPerformance && bestPerformance.performance.sharpeRatio > 2.0) {
      recommendations.push('Excellent performance achieved - consider production deployment');
    } else if (bestPerformance && bestPerformance.performance.sharpeRatio < 1.0) {
      recommendations.push('Performance below target - review training data and features');
    }
    
    const successfulIterations = this.iterations.filter(iter => iter.status === 'success').length;
    const successRate = successfulIterations / this.iterations.length;
    
    if (successRate < 0.3) {
      recommendations.push('Low success rate - consider simplifying difficulty progression');
    }
    
    return recommendations;
  }

  private async fileExists(filepath: string): Promise<boolean> {
    try {
      await fs.access(filepath);
      return true;
    } catch {
      return false;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  stopTraining(): void {
    this.isRunning = false;
    logger.info('🛑 Training stopped by user');
  }

  getIterationHistory(): TrainingIteration[] {
    return [...this.iterations];
  }

  async getTrainingStatus(): Promise<{
    isRunning: boolean;
    currentIteration: number;
    totalIterations: number;
    bestPerformance: number | null;
  }> {
    const best = this.getBestIteration();
    
    return {
      isRunning: this.isRunning,
      currentIteration: this.currentIteration,
      totalIterations: this.iterations.length,
      bestPerformance: best?.performance.sharpeRatio || null
    };
  }
}

export const trainingIterator = new TrainingIterator();