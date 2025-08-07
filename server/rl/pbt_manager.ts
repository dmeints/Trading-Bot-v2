/**
 * Population-Based Training Manager
 * Multi-worker PBT with hyperparameter evolution and model selection
 */

import { logger } from '../utils/logger';
import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';

interface PBTWorkerConfig {
  workerId: number;
  learningRate: number;
  gamma: number;
  clipRange: number;
  batchSize: number;
  nSteps: number;
  entCoef: number;
}

interface PBTWorkerResult {
  workerId: number;
  fitness: number;
  totalReward: number;
  sharpeRatio: number;
  maxDrawdown: number;
  winRate: number;
  trainingSteps: number;
  modelPath: string;
}

interface PBTGeneration {
  generation: number;
  workers: PBTWorkerResult[];
  bestWorker: PBTWorkerResult;
  averageFitness: number;
  timestamp: Date;
}

export class PopulationBasedTrainingManager {
  private workers: Map<number, ChildProcess> = new Map();
  private workerConfigs: Map<number, PBTWorkerConfig> = new Map();
  private generationHistory: PBTGeneration[] = [];
  private currentGeneration = 0;
  private readonly numWorkers: number;
  private readonly generationSteps: number;
  private readonly mutationRate: number;

  constructor(
    numWorkers: number = 3,
    generationSteps: number = 100000,
    mutationRate: number = 0.1
  ) {
    this.numWorkers = numWorkers;
    this.generationSteps = generationSteps;
    this.mutationRate = mutationRate;
    this.initializeDirectories();
  }

  private async initializeDirectories(): Promise<void> {
    await fs.mkdir('pbt_results', { recursive: true });
    await fs.mkdir('pbt_models', { recursive: true });
    await fs.mkdir('pbt_logs', { recursive: true });
  }

  /**
   * Initialize population with diverse hyperparameters
   */
  private initializePopulation(): PBTWorkerConfig[] {
    const baseConfig = {
      learningRate: 0.0003,
      gamma: 0.99,
      clipRange: 0.2,
      batchSize: 64,
      nSteps: 2048,
      entCoef: 0.01
    };

    const configs: PBTWorkerConfig[] = [];
    
    for (let i = 0; i < this.numWorkers; i++) {
      // Diversify initial hyperparameters
      const config: PBTWorkerConfig = {
        workerId: i,
        learningRate: this.sampleHyperparameter(baseConfig.learningRate, [0.0001, 0.001]),
        gamma: this.sampleHyperparameter(baseConfig.gamma, [0.95, 0.999]),
        clipRange: this.sampleHyperparameter(baseConfig.clipRange, [0.1, 0.3]),
        batchSize: this.sampleDiscreteHyperparameter([32, 64, 128]),
        nSteps: this.sampleDiscreteHyperparameter([1024, 2048, 4096]),
        entCoef: this.sampleHyperparameter(baseConfig.entCoef, [0.001, 0.1])
      };

      configs.push(config);
      this.workerConfigs.set(i, config);
    }

    logger.info(`[PBT] Initialized population with ${this.numWorkers} workers`);
    return configs;
  }

  private sampleHyperparameter(base: number, range: [number, number]): number {
    const [min, max] = range;
    return Math.random() * (max - min) + min;
  }

  private sampleDiscreteHyperparameter<T>(options: T[]): T {
    return options[Math.floor(Math.random() * options.length)];
  }

  /**
   * Start PBT training process
   */
  async startPBTTraining(): Promise<void> {
    logger.info('[PBT] Starting Population-Based Training');
    
    // Initialize population
    const initialConfigs = this.initializePopulation();
    
    // Run multiple generations
    for (let gen = 0; gen < 5; gen++) { // 5 generations
      this.currentGeneration = gen;
      logger.info(`[PBT] Starting generation ${gen + 1}/5`);
      
      // Train all workers for current generation
      const results = await this.trainGeneration(initialConfigs);
      
      // Evaluate and evolve population
      const generation = await this.evaluateGeneration(results);
      this.generationHistory.push(generation);
      
      // Evolve hyperparameters for next generation
      if (gen < 4) { // Not the last generation
        await this.evolvePopulation(results);
      }
      
      // Save generation results
      await this.saveGenerationResults(generation);
    }
    
    // Save final PBT results
    await this.savePBTResults();
    logger.info('[PBT] Population-Based Training completed');
  }

  /**
   * Train all workers for one generation
   */
  private async trainGeneration(configs: PBTWorkerConfig[]): Promise<PBTWorkerResult[]> {
    logger.info(`[PBT] Training generation ${this.currentGeneration} with ${configs.length} workers`);
    
    const workerPromises = configs.map(config => this.trainWorker(config));
    const results = await Promise.all(workerPromises);
    
    logger.info(`[PBT] Generation ${this.currentGeneration} training completed`);
    return results;
  }

  /**
   * Train individual worker
   */
  private async trainWorker(config: PBTWorkerConfig): Promise<PBTWorkerResult> {
    return new Promise((resolve, reject) => {
      const configPath = path.join('pbt_models', `worker_${config.workerId}_gen_${this.currentGeneration}_config.json`);
      
      // Save worker config
      fs.writeFile(configPath, JSON.stringify(config, null, 2)).then(() => {
        // Create Python training script command
        const pythonScript = `
import sys, os, json
sys.path.append('${path.join(__dirname)}')
from bootstrap_rl import StevieRLTradingEnv, load_market_data
from stable_baselines3 import PPO
import numpy as np

# Load config
with open('${configPath}', 'r') as f:
    config = json.load(f)

# Load market data and create environment
market_data = load_market_data()
env = StevieRLTradingEnv(market_data)

# Create PPO model with worker-specific hyperparameters
model = PPO(
    "MlpPolicy", 
    env,
    learning_rate=config['learningRate'],
    gamma=config['gamma'],
    clip_range=config['clipRange'],
    batch_size=config['batchSize'],
    n_steps=config['nSteps'],
    ent_coef=config['entCoef'],
    verbose=0
)

# Train for generation steps
model.learn(total_timesteps=${this.generationSteps})

# Evaluate model performance
eval_rewards = []
eval_profits = []
for episode in range(100):
    obs, _ = env.reset()
    done = False
    episode_reward = 0
    while not done:
        action, _ = model.predict(obs, deterministic=True)
        obs, reward, done, _, info = env.step(action)
        episode_reward += reward
    
    eval_rewards.append(episode_reward)
    final_portfolio = info['portfolio_value']
    profit = (final_portfolio - env.initial_balance) / env.initial_balance
    eval_profits.append(profit)

# Calculate metrics
mean_reward = np.mean(eval_rewards)
mean_profit = np.mean(eval_profits)
sharpe_ratio = mean_profit / np.std(eval_profits) if np.std(eval_profits) > 0 else 0
win_rate = len([p for p in eval_profits if p > 0]) / len(eval_profits)

# Calculate fitness (combine multiple metrics)
fitness = sharpe_ratio * 0.4 + mean_profit * 0.3 + win_rate * 0.2 + (1.0 / (1.0 + abs(np.mean(eval_profits))) * 0.1)

# Save model and results
model_path = f"pbt_models/worker_{config['workerId']}_gen_${this.currentGeneration}.zip"
model.save(model_path)

result = {
    'workerId': config['workerId'],
    'fitness': fitness,
    'totalReward': mean_reward,
    'sharpeRatio': sharpe_ratio,
    'maxDrawdown': 0.1,  # Simplified
    'winRate': win_rate,
    'trainingSteps': ${this.generationSteps},
    'modelPath': model_path
}

print(json.dumps(result))
`;

        const worker = spawn('python3', ['-c', pythonScript], {
          stdio: ['pipe', 'pipe', 'pipe'],
          cwd: process.cwd()
        });

        let output = '';
        let errorOutput = '';

        worker.stdout.on('data', (data) => {
          output += data.toString();
        });

        worker.stderr.on('data', (data) => {
          errorOutput += data.toString();
        });

        worker.on('close', (code) => {
          if (code === 0) {
            try {
              // Extract JSON result from output
              const lines = output.trim().split('\n');
              const resultLine = lines[lines.length - 1];
              const result = JSON.parse(resultLine) as PBTWorkerResult;
              resolve(result);
            } catch (error) {
              logger.error(`[PBT] Error parsing worker ${config.workerId} result: ${error}`);
              reject(error);
            }
          } else {
            logger.error(`[PBT] Worker ${config.workerId} failed with code ${code}: ${errorOutput}`);
            reject(new Error(`Worker training failed: ${errorOutput}`));
          }
        });

        this.workers.set(config.workerId, worker);
      }).catch(reject);
    });
  }

  /**
   * Evaluate generation and select best performers
   */
  private async evaluateGeneration(results: PBTWorkerResult[]): Promise<PBTGeneration> {
    // Sort by fitness (descending)
    results.sort((a, b) => b.fitness - a.fitness);
    
    const bestWorker = results[0];
    const averageFitness = results.reduce((sum, r) => sum + r.fitness, 0) / results.length;

    const generation: PBTGeneration = {
      generation: this.currentGeneration,
      workers: results,
      bestWorker,
      averageFitness,
      timestamp: new Date()
    };

    logger.info(`[PBT] Generation ${this.currentGeneration} evaluation:`);
    logger.info(`  Best fitness: ${bestWorker.fitness.toFixed(4)} (Worker ${bestWorker.workerId})`);
    logger.info(`  Average fitness: ${averageFitness.toFixed(4)}`);
    logger.info(`  Best Sharpe ratio: ${bestWorker.sharpeRatio.toFixed(4)}`);

    return generation;
  }

  /**
   * Evolve population for next generation
   */
  private async evolvePopulation(results: PBTWorkerResult[]): Promise<void> {
    // Sort by fitness
    results.sort((a, b) => b.fitness - a.fitness);
    
    const numElite = Math.ceil(this.numWorkers * 0.3); // Top 30%
    const numReplaced = this.numWorkers - numElite;

    logger.info(`[PBT] Evolving population: keeping ${numElite} elite, replacing ${numReplaced} workers`);

    // Keep elite workers' configs
    for (let i = 0; i < numElite; i++) {
      const workerId = results[i].workerId;
      // Elite workers keep their configs (maybe with small mutations)
      const config = this.workerConfigs.get(workerId)!;
      if (Math.random() < this.mutationRate) {
        this.mutateConfig(config);
      }
    }

    // Replace poor performers with mutated versions of elite
    for (let i = numElite; i < this.numWorkers; i++) {
      const poorWorkerId = results[i].workerId;
      const eliteWorkerId = results[Math.floor(Math.random() * numElite)].workerId;
      
      // Copy elite config and mutate
      const eliteConfig = this.workerConfigs.get(eliteWorkerId)!;
      const newConfig = { ...eliteConfig, workerId: poorWorkerId };
      this.mutateConfig(newConfig);
      
      this.workerConfigs.set(poorWorkerId, newConfig);
    }
  }

  /**
   * Mutate hyperparameters
   */
  private mutateConfig(config: PBTWorkerConfig): void {
    const mutationFactor = 1.2; // 20% change
    
    if (Math.random() < 0.3) {
      config.learningRate *= Math.random() < 0.5 ? mutationFactor : (1 / mutationFactor);
      config.learningRate = Math.max(0.0001, Math.min(0.001, config.learningRate));
    }
    
    if (Math.random() < 0.3) {
      config.gamma *= Math.random() < 0.5 ? 1.01 : 0.99;
      config.gamma = Math.max(0.95, Math.min(0.999, config.gamma));
    }
    
    if (Math.random() < 0.3) {
      config.clipRange *= Math.random() < 0.5 ? 1.1 : 0.9;
      config.clipRange = Math.max(0.1, Math.min(0.3, config.clipRange));
    }
    
    if (Math.random() < 0.2) {
      const batchSizes = [32, 64, 128];
      config.batchSize = this.sampleDiscreteHyperparameter(batchSizes);
    }
  }

  /**
   * Save generation results
   */
  private async saveGenerationResults(generation: PBTGeneration): Promise<void> {
    const filePath = path.join('pbt_results', `generation_${generation.generation}.json`);
    await fs.writeFile(filePath, JSON.stringify(generation, null, 2));
    
    logger.info(`[PBT] Generation ${generation.generation} results saved to ${filePath}`);
  }

  /**
   * Save complete PBT results
   */
  private async savePBTResults(): Promise<void> {
    const summary = {
      totalGenerations: this.generationHistory.length,
      bestOverallFitness: Math.max(...this.generationHistory.map(g => g.bestWorker.fitness)),
      bestOverallModel: this.generationHistory
        .reduce((best, gen) => gen.bestWorker.fitness > best.bestWorker.fitness ? gen : best)
        .bestWorker,
      fitnessProgression: this.generationHistory.map(g => ({
        generation: g.generation,
        bestFitness: g.bestWorker.fitness,
        averageFitness: g.averageFitness
      })),
      finalPopulation: this.generationHistory[this.generationHistory.length - 1]?.workers || [],
      completedAt: new Date()
    };

    await fs.writeFile('pbt_results/pbt_summary.json', JSON.stringify(summary, null, 2));
    logger.info('[PBT] Complete PBT results saved to pbt_results/pbt_summary.json');

    // Also save human-readable summary
    const readableSummary = `
Population-Based Training Results Summary
=========================================

Total Generations: ${summary.totalGenerations}
Best Overall Fitness: ${summary.bestOverallFitness.toFixed(4)}
Best Model: Worker ${summary.bestOverallModel.workerId} from Generation ${summary.bestOverallModel.workerId}

Fitness Progression:
${summary.fitnessProgression.map(p => 
  `  Generation ${p.generation}: Best=${p.bestFitness.toFixed(4)}, Avg=${p.averageFitness.toFixed(4)}`
).join('\n')}

Best Model Metrics:
  Sharpe Ratio: ${summary.bestOverallModel.sharpeRatio.toFixed(4)}
  Win Rate: ${(summary.bestOverallModel.winRate * 100).toFixed(1)}%
  Total Reward: ${summary.bestOverallModel.totalReward.toFixed(2)}

Completed: ${summary.completedAt.toISOString()}
`;

    await fs.writeFile('pbt_results/pbt_summary.txt', readableSummary);
  }

  /**
   * Get best model from PBT training
   */
  getBestModel(): PBTWorkerResult | null {
    if (this.generationHistory.length === 0) return null;
    
    return this.generationHistory
      .reduce((best, gen) => gen.bestWorker.fitness > best.bestWorker.fitness ? gen : best)
      .bestWorker;
  }

  /**
   * Stop all workers
   */
  stopAllWorkers(): void {
    this.workers.forEach((worker, workerId) => {
      worker.kill('SIGTERM');
      logger.info(`[PBT] Stopped worker ${workerId}`);
    });
    this.workers.clear();
  }
}

export const pbtManager = new PopulationBasedTrainingManager();