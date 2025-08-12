
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { logger } from '../server/utils/logger';

export interface WorkerConfig {
  id: string;
  hyperparams: {
    learningRate: number;
    batchSize: number;
    entropy_coef: number;
    clipRange: number;
    gamma: number;
  };
  performance: number;
  generation: number;
  parent?: string;
}

export interface PBTLineage {
  workerId: string;
  generation: number;
  parent?: string;
  performance: number;
  hyperparams: any;
  timestamp: Date;
  action: 'init' | 'exploit' | 'explore' | 'survive';
}

export class PopulationBasedTraining {
  private workers: Map<string, WorkerConfig> = new Map();
  private lineage: PBTLineage[] = [];
  private populationSize: number = 8;
  private exploitPercent: number = 0.25; // Top 25%
  private explorePercent: number = 0.25; // Bottom 25%
  private generation: number = 0;
  private dataDir: string = '.data/pbt';

  constructor(populationSize: number = 8) {
    this.populationSize = populationSize;
    this.ensureDataDir();
    this.initializePopulation();
  }

  private ensureDataDir(): void {
    if (!existsSync(this.dataDir)) {
      mkdirSync(this.dataDir, { recursive: true });
    }
  }

  private initializePopulation(): void {
    for (let i = 0; i < this.populationSize; i++) {
      const workerId = `worker_${i}`;
      const config: WorkerConfig = {
        id: workerId,
        hyperparams: this.generateRandomHyperparams(),
        performance: 0,
        generation: 0
      };
      
      this.workers.set(workerId, config);
      this.addLineage(workerId, 'init', config);
    }
    
    logger.info(`[PBT] Initialized population of ${this.populationSize} workers`);
  }

  private generateRandomHyperparams() {
    return {
      learningRate: 0.0001 + Math.random() * 0.01, // 1e-4 to 1e-2
      batchSize: 32 + Math.floor(Math.random() * 3) * 32, // 32, 64, 96, 128
      entropy_coef: 0.001 + Math.random() * 0.1, // 1e-3 to 0.1
      clipRange: 0.1 + Math.random() * 0.2, // 0.1 to 0.3
      gamma: 0.95 + Math.random() * 0.049 // 0.95 to 0.999
    };
  }

  evolvePopulation(): void {
    this.generation++;
    
    // Simulate performance evaluation for each worker
    for (const [workerId, config] of this.workers.entries()) {
      config.performance = this.evaluateWorker(config);
    }
    
    // Sort workers by performance
    const sortedWorkers = Array.from(this.workers.values())
      .sort((a, b) => b.performance - a.performance);
    
    const topK = Math.floor(this.populationSize * this.exploitPercent);
    const bottomK = Math.floor(this.populationSize * this.explorePercent);
    
    const topPerformers = sortedWorkers.slice(0, topK);
    const bottomPerformers = sortedWorkers.slice(-bottomK);
    
    // Exploit: bottom performers copy from top performers
    for (let i = 0; i < bottomK; i++) {
      const loser = bottomPerformers[i];
      const winner = topPerformers[Math.floor(Math.random() * topK)];
      
      // Copy weights and hyperparams (mock)
      loser.hyperparams = { ...winner.hyperparams };
      loser.parent = winner.id;
      loser.generation = this.generation;
      
      this.addLineage(loser.id, 'exploit', loser);
    }
    
    // Explore: jitter hyperparams of exploited workers
    for (const loser of bottomPerformers) {
      this.jitterHyperparams(loser);
      this.addLineage(loser.id, 'explore', loser);
    }
    
    // Survivors continue unchanged
    const survivors = sortedWorkers.slice(topK, -bottomK);
    for (const survivor of survivors) {
      this.addLineage(survivor.id, 'survive', survivor);
    }
    
    logger.info(`[PBT] Generation ${this.generation}: Best=${topPerformers[0].performance.toFixed(4)}, Worst=${bottomPerformers[bottomPerformers.length - 1].performance.toFixed(4)}`);
    
    this.saveLineage();
  }

  private evaluateWorker(config: WorkerConfig): number {
    // Mock evaluation: simulate training performance
    // In practice, this would run actual training and return validation score
    const basePerformance = Math.random() * 0.1; // 0-10% return
    
    // Hyperparameter influence (simplified)
    const lrPenalty = Math.abs(config.hyperparams.learningRate - 0.003) * 10;
    const clipPenalty = Math.abs(config.hyperparams.clipRange - 0.2) * 5;
    
    return basePerformance - lrPenalty - clipPenalty + Math.random() * 0.02; // Add noise
  }

  private jitterHyperparams(config: WorkerConfig): void {
    const jitterScale = 0.2; // 20% jitter
    
    config.hyperparams.learningRate *= (1 + (Math.random() - 0.5) * jitterScale);
    config.hyperparams.learningRate = Math.max(0.0001, Math.min(0.01, config.hyperparams.learningRate));
    
    config.hyperparams.entropy_coef *= (1 + (Math.random() - 0.5) * jitterScale);
    config.hyperparams.entropy_coef = Math.max(0.001, Math.min(0.1, config.hyperparams.entropy_coef));
    
    config.hyperparams.clipRange *= (1 + (Math.random() - 0.5) * jitterScale);
    config.hyperparams.clipRange = Math.max(0.05, Math.min(0.5, config.hyperparams.clipRange));
    
    config.hyperparams.gamma *= (1 + (Math.random() - 0.5) * jitterScale * 0.1);
    config.hyperparams.gamma = Math.max(0.9, Math.min(0.999, config.hyperparams.gamma));
  }

  private addLineage(workerId: string, action: 'init' | 'exploit' | 'explore' | 'survive', config: WorkerConfig): void {
    this.lineage.push({
      workerId,
      generation: this.generation,
      parent: config.parent,
      performance: config.performance,
      hyperparams: { ...config.hyperparams },
      timestamp: new Date(),
      action
    });
  }

  private saveLineage(): void {
    const lineagePath = join(this.dataDir, 'lineage.json');
    writeFileSync(lineagePath, JSON.stringify(this.lineage, null, 2));
  }

  getLineage(): PBTLineage[] {
    return [...this.lineage];
  }

  getBestWorker(): WorkerConfig | null {
    if (this.workers.size === 0) return null;
    
    return Array.from(this.workers.values())
      .reduce((best, current) => current.performance > best.performance ? current : best);
  }

  getWorkers(): WorkerConfig[] {
    return Array.from(this.workers.values());
  }
}

export const pbtManager = new PopulationBasedTraining();
