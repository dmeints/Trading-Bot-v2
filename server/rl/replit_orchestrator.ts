/**
 * Replit Multi-Instance Orchestration
 * Coordinate parallel training across multiple Replit instances
 */

import { logger } from '../utils/logger';
import * as fs from 'fs/promises';
import * as path from 'path';
import axios from 'axios';
import { spawn, ChildProcess } from 'child_process';

interface ReplitInstance {
  id: string;
  url: string;
  status: 'idle' | 'training' | 'completed' | 'failed';
  assignedTask: TrainingTask | null;
  lastHeartbeat: Date;
  performance: {
    fitness: number;
    trainingSteps: number;
    modelPath?: string;
  } | null;
}

interface TrainingTask {
  taskId: string;
  taskType: 'symbol_slice' | 'time_slice' | 'hyperparameter_trial';
  config: {
    symbols?: string[];
    timeRange?: { start: Date; end: Date };
    hyperparams?: Record<string, any>;
    trainingSteps: number;
  };
  priority: number;
  createdAt: Date;
}

interface OrchestrationResult {
  totalInstances: number;
  completedTasks: number;
  bestPerformance: {
    fitness: number;
    instanceId: string;
    modelPath: string;
  };
  aggregatedModels: string[];
  executionTime: number;
}

export class ReplitOrchestrationManager {
  private instances: Map<string, ReplitInstance> = new Map();
  private taskQueue: TrainingTask[] = [];
  private completedTasks: TrainingTask[] = [];
  private orchestrationResults: OrchestrationResult[] = [];
  private isOrchestrating = false;

  constructor(private maxInstances: number = 3) {
    logger.info(`[Orchestrator] Initialized for max ${maxInstances} instances`);
    this.initializeSharedVolume();
  }

  /**
   * Initialize shared volume for caching data
   */
  private async initializeSharedVolume(): Promise<void> {
    try {
      await fs.mkdir('shared_volume', { recursive: true });
      await fs.mkdir('shared_volume/models', { recursive: true });
      await fs.mkdir('shared_volume/data', { recursive: true });
      await fs.mkdir('shared_volume/results', { recursive: true });
      
      logger.info('[Orchestrator] Shared volume initialized');
    } catch (error) {
      logger.error('[Orchestrator] Failed to initialize shared volume', { error });
    }
  }

  /**
   * Register a Replit instance for orchestration
   */
  registerInstance(instanceId: string, url: string): void {
    const instance: ReplitInstance = {
      id: instanceId,
      url,
      status: 'idle',
      assignedTask: null,
      lastHeartbeat: new Date(),
      performance: null
    };

    this.instances.set(instanceId, instance);
    logger.info(`[Orchestrator] Registered instance: ${instanceId} at ${url}`);
  }

  /**
   * Start distributed training orchestration
   */
  async startOrchestration(
    symbols: string[] = ['BTC/USD', 'ETH/USD', 'SOL/USD'],
    timeRanges: Array<{ start: Date; end: Date }> = []
  ): Promise<OrchestrationResult> {
    if (this.isOrchestrating) {
      throw new Error('Orchestration already in progress');
    }

    this.isOrchestrating = true;
    const startTime = Date.now();
    
    logger.info('[Orchestrator] Starting distributed training orchestration');

    try {
      // Step 1: Prepare shared data
      await this.prepareSharedData(symbols, timeRanges);

      // Step 2: Generate training tasks
      const tasks = await this.generateTrainingTasks(symbols, timeRanges);
      this.taskQueue = tasks;

      logger.info(`[Orchestrator] Generated ${tasks.length} training tasks`);

      // Step 3: Distribute tasks to instances
      await this.distributeTasks();

      // Step 4: Monitor training progress
      await this.monitorTraining();

      // Step 5: Aggregate results
      const result = await this.aggregateResults();
      
      const executionTime = Date.now() - startTime;
      result.executionTime = executionTime;

      this.orchestrationResults.push(result);
      await this.saveOrchestrationResults(result);

      logger.info(`[Orchestrator] Orchestration completed in ${executionTime}ms`);
      return result;

    } finally {
      this.isOrchestrating = false;
    }
  }

  /**
   * Prepare shared data that all instances can access
   */
  private async prepareSharedData(symbols: string[], timeRanges: Array<{ start: Date; end: Date }>): Promise<void> {
    logger.info('[Orchestrator] Preparing shared data');

    // Generate market data for each symbol
    for (const symbol of symbols) {
      const marketData = this.generateMarketData(symbol);
      const dataPath = path.join('shared_volume/data', `${symbol.replace('/', '_')}.json`);
      
      await fs.writeFile(dataPath, JSON.stringify(marketData, null, 2));
      logger.info(`[Orchestrator] Cached data for ${symbol}: ${marketData.length} points`);
    }

    // Create shared configuration
    const sharedConfig = {
      symbols,
      timeRanges,
      trainingConfig: {
        totalTimesteps: 500000,
        evaluationEpisodes: 100,
        saveBestModel: true
      },
      dataPath: 'shared_volume/data',
      modelsPath: 'shared_volume/models',
      resultsPath: 'shared_volume/results'
    };

    await fs.writeFile(
      'shared_volume/orchestration_config.json',
      JSON.stringify(sharedConfig, null, 2)
    );
  }

  /**
   * Generate market data (simplified for demo)
   */
  private generateMarketData(symbol: string, days: number = 365): any[] {
    const basePrice = symbol.includes('BTC') ? 50000 : symbol.includes('ETH') ? 3000 : 100;
    const data = [];
    let price = basePrice;

    for (let i = 0; i < days; i++) {
      const dailyReturn = (Math.random() - 0.48) * 0.03; // Slight bullish bias
      price *= (1 + dailyReturn);
      
      const high = price * (1 + Math.random() * 0.02);
      const low = price * (1 - Math.random() * 0.02);
      const volume = Math.random() * 1000000;

      data.push({
        timestamp: new Date(Date.now() - (days - i) * 24 * 60 * 60 * 1000).toISOString(),
        open: price,
        high,
        low,
        close: price,
        volume
      });
    }

    return data;
  }

  /**
   * Generate training tasks for distribution
   */
  private async generateTrainingTasks(
    symbols: string[], 
    timeRanges: Array<{ start: Date; end: Date }>
  ): Promise<TrainingTask[]> {
    const tasks: TrainingTask[] = [];

    // Symbol-based task distribution
    symbols.forEach((symbol, index) => {
      tasks.push({
        taskId: `symbol_${symbol.replace('/', '_')}_${index}`,
        taskType: 'symbol_slice',
        config: {
          symbols: [symbol],
          trainingSteps: 500000
        },
        priority: 1,
        createdAt: new Date()
      });
    });

    // Time-based task distribution (if time ranges provided)
    timeRanges.forEach((range, index) => {
      tasks.push({
        taskId: `time_slice_${index}`,
        taskType: 'time_slice',
        config: {
          symbols: symbols,
          timeRange: range,
          trainingSteps: 300000
        },
        priority: 2,
        createdAt: new Date()
      });
    });

    // Hyperparameter variation tasks
    const hyperparamVariations = [
      { learning_rate: 0.0001, gamma: 0.99, clip_range: 0.2 },
      { learning_rate: 0.0005, gamma: 0.95, clip_range: 0.3 },
      { learning_rate: 0.0003, gamma: 0.999, clip_range: 0.1 }
    ];

    hyperparamVariations.forEach((params, index) => {
      tasks.push({
        taskId: `hyperparam_${index}`,
        taskType: 'hyperparameter_trial',
        config: {
          symbols: symbols,
          hyperparams: params,
          trainingSteps: 400000
        },
        priority: 3,
        createdAt: new Date()
      });
    });

    return tasks;
  }

  /**
   * Distribute tasks to available instances
   */
  private async distributeTasks(): Promise<void> {
    logger.info('[Orchestrator] Distributing tasks to instances');

    // Sort tasks by priority
    this.taskQueue.sort((a, b) => a.priority - b.priority);

    for (const [instanceId, instance] of this.instances) {
      if (instance.status === 'idle' && this.taskQueue.length > 0) {
        const task = this.taskQueue.shift()!;
        
        try {
          await this.assignTaskToInstance(instanceId, task);
          logger.info(`[Orchestrator] Assigned task ${task.taskId} to instance ${instanceId}`);
        } catch (error) {
          logger.error(`[Orchestrator] Failed to assign task to ${instanceId}`, { error });
          // Put task back in queue
          this.taskQueue.unshift(task);
        }
      }
    }
  }

  /**
   * Assign task to specific instance
   */
  private async assignTaskToInstance(instanceId: string, task: TrainingTask): Promise<void> {
    const instance = this.instances.get(instanceId);
    if (!instance) {
      throw new Error(`Instance ${instanceId} not found`);
    }

    // Create training script for this task
    const trainingScript = this.generateTrainingScript(task);
    const scriptPath = path.join('shared_volume', `training_script_${task.taskId}.py`);
    
    await fs.writeFile(scriptPath, trainingScript);

    // Update instance state
    instance.assignedTask = task;
    instance.status = 'training';
    instance.lastHeartbeat = new Date();

    // Start training process (simulated)
    this.startTrainingProcess(instanceId, task, scriptPath);
  }

  /**
   * Generate training script for task
   */
  private generateTrainingScript(task: TrainingTask): string {
    return `#!/usr/bin/env python3
"""
Generated training script for task: ${task.taskId}
Task type: ${task.taskType}
"""

import json
import sys
import time
import random
import os

# Simulate training process
def train_model():
    print(f"Starting training for task: ${task.taskId}")
    
    # Load shared configuration
    with open('shared_volume/orchestration_config.json', 'r') as f:
        config = json.load(f)
    
    print(f"Training configuration loaded")
    print(f"Task config: ${JSON.stringify(task.config)}")
    
    # Simulate training steps
    training_steps = ${task.config.trainingSteps}
    
    for step in range(0, training_steps, 10000):
        time.sleep(0.01)  # Simulate computation time
        
        if step % 50000 == 0:
            progress = (step / training_steps) * 100
            print(f"Training progress: {progress:.1f}% ({step}/{training_steps})")
    
    # Simulate final performance
    fitness = random.uniform(0.3, 0.9)
    
    # Save results
    result = {
        'task_id': '${task.taskId}',
        'fitness': fitness,
        'training_steps': training_steps,
        'completed_at': time.time(),
        'model_path': f'shared_volume/models/model_${task.taskId}.zip'
    }
    
    with open(f'shared_volume/results/result_${task.taskId}.json', 'w') as f:
        json.dump(result, f, indent=2)
    
    print(f"Training completed. Fitness: {fitness:.4f}")
    print(f"Results saved to shared_volume/results/result_${task.taskId}.json")

if __name__ == "__main__":
    try:
        train_model()
        sys.exit(0)
    except Exception as e:
        print(f"Training failed: {e}")
        sys.exit(1)
`;
  }

  /**
   * Start training process for instance
   */
  private startTrainingProcess(instanceId: string, task: TrainingTask, scriptPath: string): void {
    // Simulate async training process
    setTimeout(async () => {
      try {
        // Execute training script
        const process = spawn('python3', [scriptPath], {
          stdio: ['pipe', 'pipe', 'pipe']
        });

        let output = '';
        process.stdout.on('data', (data) => {
          output += data.toString();
        });

        process.on('close', async (code) => {
          const instance = this.instances.get(instanceId);
          if (!instance) return;

          if (code === 0) {
            // Training successful
            instance.status = 'completed';
            this.completedTasks.push(task);

            // Read results
            try {
              const resultPath = path.join('shared_volume/results', `result_${task.taskId}.json`);
              const resultData = await fs.readFile(resultPath, 'utf-8');
              const result = JSON.parse(resultData);

              instance.performance = {
                fitness: result.fitness,
                trainingSteps: result.training_steps,
                modelPath: result.model_path
              };

              logger.info(`[Orchestrator] Instance ${instanceId} completed task ${task.taskId} with fitness ${result.fitness.toFixed(4)}`);
            } catch (error) {
              logger.error(`[Orchestrator] Failed to read results for ${instanceId}`, { error });
            }
          } else {
            // Training failed
            instance.status = 'failed';
            logger.error(`[Orchestrator] Instance ${instanceId} failed task ${task.taskId}`);
          }

          // Assign next task if available
          if (this.taskQueue.length > 0 && instance.status !== 'failed') {
            const nextTask = this.taskQueue.shift()!;
            await this.assignTaskToInstance(instanceId, nextTask);
          }
        });

      } catch (error) {
        logger.error(`[Orchestrator] Error starting training process for ${instanceId}`, { error });
        const instance = this.instances.get(instanceId);
        if (instance) {
          instance.status = 'failed';
        }
      }
    }, 1000); // Start after 1 second
  }

  /**
   * Monitor training progress
   */
  private async monitorTraining(): Promise<void> {
    logger.info('[Orchestrator] Monitoring training progress');

    return new Promise((resolve) => {
      const checkProgress = () => {
        const activeInstances = Array.from(this.instances.values())
          .filter(instance => instance.status === 'training').length;

        const completedCount = this.completedTasks.length;
        const totalTasks = this.completedTasks.length + this.taskQueue.length + activeInstances;

        logger.info(`[Orchestrator] Progress: ${completedCount}/${totalTasks} tasks completed, ${activeInstances} active`);

        if (activeInstances === 0 && this.taskQueue.length === 0) {
          logger.info('[Orchestrator] All tasks completed');
          resolve();
          return;
        }

        setTimeout(checkProgress, 5000); // Check every 5 seconds
      };

      setTimeout(checkProgress, 1000); // Start checking after 1 second
    });
  }

  /**
   * Aggregate results from all instances
   */
  private async aggregateResults(): Promise<OrchestrationResult> {
    logger.info('[Orchestrator] Aggregating results from all instances');

    const completedInstances = Array.from(this.instances.values())
      .filter(instance => instance.performance !== null);

    if (completedInstances.length === 0) {
      throw new Error('No completed instances to aggregate');
    }

    // Find best performing instance
    const bestInstance = completedInstances.reduce((best, current) => 
      (current.performance!.fitness > best.performance!.fitness) ? current : best
    );

    // Collect all model paths
    const modelPaths = completedInstances
      .filter(instance => instance.performance?.modelPath)
      .map(instance => instance.performance!.modelPath!);

    // Create ensemble model (simplified)
    await this.createEnsembleModel(modelPaths);

    const result: OrchestrationResult = {
      totalInstances: this.instances.size,
      completedTasks: this.completedTasks.length,
      bestPerformance: {
        fitness: bestInstance.performance!.fitness,
        instanceId: bestInstance.id,
        modelPath: bestInstance.performance!.modelPath!
      },
      aggregatedModels: modelPaths,
      executionTime: 0 // Will be set by caller
    };

    return result;
  }

  /**
   * Create ensemble model from individual models
   */
  private async createEnsembleModel(modelPaths: string[]): Promise<void> {
    const ensembleConfig = {
      modelPaths,
      weights: modelPaths.map(() => 1.0 / modelPaths.length), // Equal weights
      ensembleMethod: 'voting',
      createdAt: new Date().toISOString()
    };

    const ensemblePath = 'shared_volume/models/ensemble_model.json';
    await fs.writeFile(ensemblePath, JSON.stringify(ensembleConfig, null, 2));

    logger.info(`[Orchestrator] Created ensemble model with ${modelPaths.length} components`);
  }

  /**
   * Save orchestration results
   */
  private async saveOrchestrationResults(result: OrchestrationResult): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const resultsPath = `orchestration_results_${timestamp}.json`;
    
    await fs.writeFile(resultsPath, JSON.stringify(result, null, 2));

    // Also create human-readable summary
    const summary = `
Replit Orchestration Results Summary
===================================

Execution Details:
- Total Instances: ${result.totalInstances}
- Completed Tasks: ${result.completedTasks}
- Execution Time: ${result.executionTime}ms

Best Performance:
- Instance: ${result.bestPerformance.instanceId}
- Fitness: ${result.bestPerformance.fitness.toFixed(4)}
- Model: ${result.bestPerformance.modelPath}

Aggregated Models: ${result.aggregatedModels.length}

Generated: ${new Date().toISOString()}
`;

    await fs.writeFile(`orchestration_summary_${timestamp}.txt`, summary);
    
    logger.info(`[Orchestrator] Results saved: ${resultsPath}`);
  }

  /**
   * Get orchestration status
   */
  getOrchestrationStatus(): {
    isRunning: boolean;
    instances: Array<{
      id: string;
      status: string;
      currentTask?: string;
      performance?: number;
    }>;
    queueSize: number;
    completedTasks: number;
  } {
    return {
      isRunning: this.isOrchestrating,
      instances: Array.from(this.instances.values()).map(instance => ({
        id: instance.id,
        status: instance.status,
        currentTask: instance.assignedTask?.taskId,
        performance: instance.performance?.fitness
      })),
      queueSize: this.taskQueue.length,
      completedTasks: this.completedTasks.length
    };
  }

  /**
   * Stop orchestration
   */
  stopOrchestration(): void {
    this.isOrchestrating = false;
    this.instances.forEach(instance => {
      if (instance.status === 'training') {
        instance.status = 'idle';
      }
    });
    
    logger.info('[Orchestrator] Orchestration stopped');
  }
}

export const replitOrchestrator = new ReplitOrchestrationManager();