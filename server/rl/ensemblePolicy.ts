/**
 * Ensemble Policy Manager
 * Combines multiple trained models for robust trading decisions
 */

import { logger } from '../utils/logger';
import { spawn } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';

interface ModelPrediction {
  modelId: string;
  action: number;
  confidence: number;
  actionProbs: number[];
}

interface EnsembleDecision {
  finalAction: number;
  confidence: number;
  individualPredictions: ModelPrediction[];
  consensusLevel: number;
  timestamp: Date;
}

interface EnsembleModel {
  id: string;
  modelPath: string;
  weight: number;
  performance: {
    sharpeRatio: number;
    winRate: number;
    fitness: number;
  };
  isLoaded: boolean;
}

export class EnsemblePolicyManager {
  private models: Map<string, EnsembleModel> = new Map();
  private decisionHistory: EnsembleDecision[] = [];
  private readonly maxHistorySize: number = 1000;

  constructor() {
    this.initializeEnsemble();
  }

  /**
   * Initialize ensemble with multiple models
   */
  private async initializeEnsemble(): Promise<void> {
    logger.info('[Ensemble] Initializing ensemble policy manager');

    // Load available trained models
    const modelConfigs = [
      {
        id: 'ppo_baseline',
        modelPath: 'models/ppo_stevie.zip',
        weight: 0.4,
        performance: { sharpeRatio: 0.3, winRate: 0.55, fitness: 0.8 }
      },
      {
        id: 'dqn_baseline', 
        modelPath: 'models/dqn_stevie.zip',
        weight: 0.3,
        performance: { sharpeRatio: 0.25, winRate: 0.52, fitness: 0.7 }
      },
      {
        id: 'behavior_cloned',
        modelPath: 'models/behavior_cloning_model.pth',
        weight: 0.3,
        performance: { sharpeRatio: 0.2, winRate: 0.6, fitness: 0.6 }
      }
    ];

    for (const config of modelConfigs) {
      const model: EnsembleModel = {
        ...config,
        isLoaded: false
      };
      this.models.set(config.id, model);
    }

    logger.info(`[Ensemble] Configured ${this.models.size} models for ensemble`);
    await this.loadBestPBTModel();
  }

  /**
   * Load best model from PBT training
   */
  private async loadBestPBTModel(): Promise<void> {
    try {
      const pbtSummaryPath = 'pbt_results/pbt_summary.json';
      const exists = await fs.access(pbtSummaryPath).then(() => true).catch(() => false);
      
      if (exists) {
        const summary = JSON.parse(await fs.readFile(pbtSummaryPath, 'utf-8'));
        const bestModel = summary.bestOverallModel;
        
        if (bestModel && bestModel.modelPath) {
          const pbtModel: EnsembleModel = {
            id: 'pbt_best',
            modelPath: bestModel.modelPath,
            weight: 0.5, // Higher weight for evolved model
            performance: {
              sharpeRatio: bestModel.sharpeRatio,
              winRate: bestModel.winRate,
              fitness: bestModel.fitness
            },
            isLoaded: false
          };
          
          this.models.set('pbt_best', pbtModel);
          
          // Rebalance weights to accommodate PBT model
          this.rebalanceWeights();
          
          logger.info('[Ensemble] Added PBT best model to ensemble');
        }
      }
    } catch (error) {
      logger.warn('[Ensemble] Could not load PBT best model', { error });
    }
  }

  /**
   * Rebalance ensemble weights
   */
  private rebalanceWeights(): void {
    const models = Array.from(this.models.values());
    const totalPerformance = models.reduce((sum, model) => sum + model.performance.fitness, 0);
    
    // Weight based on performance
    models.forEach(model => {
      model.weight = model.performance.fitness / totalPerformance;
    });
    
    logger.info('[Ensemble] Rebalanced model weights based on performance');
  }

  /**
   * Get ensemble prediction for trading decision
   */
  async getEnsembleDecision(state: number[]): Promise<EnsembleDecision> {
    const predictions: ModelPrediction[] = [];
    
    // Get predictions from all models
    for (const [modelId, model] of this.models) {
      try {
        const prediction = await this.getModelPrediction(modelId, model, state);
        predictions.push(prediction);
      } catch (error) {
        logger.warn(`[Ensemble] Failed to get prediction from ${modelId}`, { error });
      }
    }

    if (predictions.length === 0) {
      throw new Error('No model predictions available');
    }

    // Combine predictions using weighted voting
    const decision = this.combineEnsemblePredictions(predictions);
    
    // Store decision in history
    this.decisionHistory.push(decision);
    if (this.decisionHistory.length > this.maxHistorySize) {
      this.decisionHistory = this.decisionHistory.slice(-this.maxHistorySize);
    }

    return decision;
  }

  /**
   * Get prediction from individual model
   */
  private async getModelPrediction(modelId: string, model: EnsembleModel, state: number[]): Promise<ModelPrediction> {
    return new Promise((resolve, reject) => {
      // Create Python script to get model prediction
      const pythonScript = `
import sys, json, numpy as np
sys.path.append('${__dirname}')

model_id = "${modelId}"
model_path = "${model.modelPath}"
state = ${JSON.stringify(state)}

try:
    if model_id.startswith('ppo') or model_id.startswith('dqn') or model_id == 'pbt_best':
        from stable_baselines3 import PPO, DQN
        
        if 'ppo' in model_id or model_id == 'pbt_best':
            model = PPO.load(model_path)
        else:
            model = DQN.load(model_path)
            
        # Get action probabilities
        obs = np.array(state, dtype=np.float32)
        action, _ = model.predict(obs, deterministic=False)
        
        # For discrete actions, create probability distribution
        action_probs = [0.0, 0.0, 0.0]
        action_probs[int(action)] = 0.8
        remaining_prob = 0.2 / 2
        for i in range(3):
            if i != int(action):
                action_probs[i] = remaining_prob
        
        confidence = max(action_probs)
        
    elif 'behavior' in model_id:
        import torch
        import torch.nn as nn
        
        # Load behavior cloning model
        checkpoint = torch.load(model_path, map_location='cpu')
        state_dim = len(state)
        
        class BehaviorCloningNetwork(nn.Module):
            def __init__(self, state_dim, action_dim=3):
                super().__init__()
                self.network = nn.Sequential(
                    nn.Linear(state_dim, 256),
                    nn.ReLU(),
                    nn.Dropout(0.2),
                    nn.Linear(256, 128),
                    nn.ReLU(), 
                    nn.Dropout(0.2),
                    nn.Linear(128, 64),
                    nn.ReLU(),
                    nn.Dropout(0.2),
                    nn.Linear(64, action_dim)
                )
            
            def forward(self, x):
                return self.network(x)
        
        model = BehaviorCloningNetwork(state_dim)
        model.load_state_dict(checkpoint['model_state_dict'])
        model.eval()
        
        with torch.no_grad():
            state_tensor = torch.FloatTensor(state).unsqueeze(0)
            outputs = model(state_tensor)
            action_probs = torch.softmax(outputs, dim=1).numpy()[0]
            action = int(np.argmax(action_probs))
            confidence = float(np.max(action_probs))
    
    else:
        raise ValueError(f"Unknown model type: {model_id}")
    
    result = {
        'modelId': model_id,
        'action': int(action),
        'confidence': float(confidence),
        'actionProbs': [float(p) for p in action_probs]
    }
    
    print(json.dumps(result))
    
except Exception as e:
    print(json.dumps({'error': str(e)}), file=sys.stderr)
    sys.exit(1)
`;

      const process = spawn('python3', ['-c', pythonScript], {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let output = '';
      let errorOutput = '';

      process.stdout.on('data', (data) => {
        output += data.toString();
      });

      process.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      process.on('close', (code) => {
        if (code === 0) {
          try {
            const result = JSON.parse(output.trim());
            if (result.error) {
              reject(new Error(result.error));
            } else {
              resolve(result as ModelPrediction);
            }
          } catch (error) {
            reject(new Error(`Failed to parse model output: ${error}`));
          }
        } else {
          reject(new Error(`Model prediction failed: ${errorOutput}`));
        }
      });
    });
  }

  /**
   * Combine predictions using weighted ensemble voting
   */
  private combineEnsemblePredictions(predictions: ModelPrediction[]): EnsembleDecision {
    const actionVotes = [0, 0, 0]; // Votes for Hold, Buy, Sell
    const weightedConfidences = [0, 0, 0];
    let totalWeight = 0;

    // Weighted voting
    predictions.forEach(prediction => {
      const model = this.models.get(prediction.modelId);
      const weight = model?.weight || 1.0;
      
      actionVotes[prediction.action] += weight;
      
      // Weight confidence by model performance
      prediction.actionProbs.forEach((prob, i) => {
        weightedConfidences[i] += prob * weight;
      });
      
      totalWeight += weight;
    });

    // Normalize
    weightedConfidences.forEach((conf, i) => {
      weightedConfidences[i] = conf / totalWeight;
    });

    // Determine final action
    const finalAction = actionVotes.indexOf(Math.max(...actionVotes));
    const confidence = weightedConfidences[finalAction];

    // Calculate consensus level (how much models agree)
    const maxVotes = Math.max(...actionVotes);
    const consensusLevel = maxVotes / predictions.length;

    const decision: EnsembleDecision = {
      finalAction,
      confidence,
      individualPredictions: predictions,
      consensusLevel,
      timestamp: new Date()
    };

    logger.info(`[Ensemble] Decision: Action=${finalAction}, Confidence=${confidence.toFixed(3)}, Consensus=${consensusLevel.toFixed(3)}`);
    
    return decision;
  }

  /**
   * Update model performance based on trading outcomes
   */
  async updateModelPerformance(modelId: string, tradeOutcome: {
    profit: number;
    return: number;
    successful: boolean;
  }): Promise<void> {
    const model = this.models.get(modelId);
    if (!model) return;

    // Update performance metrics (simple running average)
    const alpha = 0.1; // Learning rate for performance updates
    
    if (tradeOutcome.successful) {
      model.performance.winRate = model.performance.winRate * (1 - alpha) + alpha;
    } else {
      model.performance.winRate = model.performance.winRate * (1 - alpha);
    }

    // Update fitness based on risk-adjusted returns
    const returnScore = Math.min(tradeOutcome.return * 10, 1.0); // Cap at 1.0
    model.performance.fitness = model.performance.fitness * (1 - alpha) + returnScore * alpha;

    // Rebalance ensemble weights
    this.rebalanceWeights();

    logger.info(`[Ensemble] Updated ${modelId} performance: WinRate=${model.performance.winRate.toFixed(3)}, Fitness=${model.performance.fitness.toFixed(3)}`);
  }

  /**
   * Get ensemble statistics
   */
  getEnsembleStats(): {
    modelCount: number;
    totalDecisions: number;
    averageConsensus: number;
    averageConfidence: number;
    modelWeights: Record<string, number>;
  } {
    const recentDecisions = this.decisionHistory.slice(-100); // Last 100 decisions
    
    const averageConsensus = recentDecisions.length > 0 
      ? recentDecisions.reduce((sum, d) => sum + d.consensusLevel, 0) / recentDecisions.length 
      : 0;
      
    const averageConfidence = recentDecisions.length > 0
      ? recentDecisions.reduce((sum, d) => sum + d.confidence, 0) / recentDecisions.length
      : 0;

    const modelWeights: Record<string, number> = {};
    this.models.forEach((model, id) => {
      modelWeights[id] = model.weight;
    });

    return {
      modelCount: this.models.size,
      totalDecisions: this.decisionHistory.length,
      averageConsensus,
      averageConfidence,
      modelWeights
    };
  }

  /**
   * Save ensemble decision log
   */
  async saveDecisionLog(): Promise<void> {
    const logPath = 'ensemble_decisions.json';
    const stats = this.getEnsembleStats();
    
    const logData = {
      stats,
      recentDecisions: this.decisionHistory.slice(-50), // Last 50 decisions
      timestamp: new Date()
    };

    await fs.writeFile(logPath, JSON.stringify(logData, null, 2));
    logger.info(`[Ensemble] Decision log saved to ${logPath}`);
  }

  /**
   * Get model recommendations for action
   */
  getModelRecommendations(decision: EnsembleDecision): string[] {
    const recommendations: string[] = [];

    if (decision.consensusLevel < 0.6) {
      recommendations.push('Low consensus among models - consider waiting for clearer signal');
    }

    if (decision.confidence < 0.4) {
      recommendations.push('Low confidence prediction - use smaller position size');
    }

    if (decision.consensusLevel > 0.8 && decision.confidence > 0.7) {
      recommendations.push('High consensus and confidence - strong signal');
    }

    const actionNames = ['Hold', 'Buy', 'Sell'];
    const stronglyDisagreeing = decision.individualPredictions.filter(
      p => p.action !== decision.finalAction
    );

    if (stronglyDisagreeing.length > 0) {
      recommendations.push(
        `${stronglyDisagreeing.length} models suggest ${stronglyDisagreeing[0].action === 0 ? 'Hold' : 
          stronglyDisagreeing[0].action === 1 ? 'Buy' : 'Sell'} instead`
      );
    }

    return recommendations;
  }
}

export const ensemblePolicy = new EnsemblePolicyManager();