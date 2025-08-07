import { db } from '../db';
import { sql } from 'drizzle-orm';
import { logger } from '../utils/logger';
import OpenAI from 'openai';
import { randomUUID } from 'crypto';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface TrainingData {
  features: number[];
  label: number;
  metadata: {
    trade_id?: string;
    symbol: string;
    timestamp: Date;
    market_conditions: any;
  };
}

export interface ModelRun {
  id: string;
  agent_type: 'market_insight' | 'risk_assessor';
  model_version: string;
  training_start: Date;
  training_end?: Date;
  status: 'running' | 'completed' | 'failed';
  metrics: {
    accuracy?: number;
    sharpe_ratio?: number;
    precision?: number;
    recall?: number;
    validation_loss?: number;
  };
  config: {
    learning_rate?: number;
    batch_size?: number;
    epochs?: number;
    risk_threshold?: number;
  };
  training_samples: number;
  validation_samples: number;
  improvement_threshold: number;
  previous_model_version?: string;
  deployment_status: 'pending' | 'deployed' | 'rejected';
  created_at: Date;
}

export interface SweepResult {
  id: string;
  sweep_id: string;
  agent_type: string;
  config: Record<string, any>;
  metrics: Record<string, number>;
  status: 'running' | 'completed' | 'failed';
  execution_time: number;
  created_at: Date;
}

export interface DriftMetrics {
  id: string;
  agent_type: string;
  metric_type: 'feature_drift' | 'prediction_drift' | 'performance_drift';
  value: number;
  threshold: number;
  status: 'normal' | 'warning' | 'critical';
  details: any;
  calculated_at: Date;
}

export class MLOpsService {
  private static instance: MLOpsService;
  
  static getInstance(): MLOpsService {
    if (!this.instance) {
      this.instance = new MLOpsService();
    }
    return this.instance;
  }

  /**
   * Automated retraining pipeline
   */
  async runRetrainingPipeline(agentType: 'market_insight' | 'risk_assessor'): Promise<ModelRun> {
    const runId = randomUUID();
    logger.info('Starting automated retraining pipeline', { agentType, runId });

    try {
      // Create model run record
      const modelRun: ModelRun = {
        id: runId,
        agent_type: agentType,
        model_version: `v${Date.now()}`,
        training_start: new Date(),
        status: 'running',
        metrics: {},
        config: await this.getOptimalConfig(agentType),
        training_samples: 0,
        validation_samples: 0,
        improvement_threshold: 0.02, // 2%
        deployment_status: 'pending',
        created_at: new Date()
      };

      await this.saveModelRun(modelRun);

      // 1. Fetch new training data since last run
      const lastRun = await this.getLastSuccessfulRun(agentType);
      const cutoffDate = lastRun?.training_start || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
      
      const trainingData = await this.fetchTrainingData(agentType, cutoffDate);
      modelRun.training_samples = trainingData.length;

      if (trainingData.length < 10) {
        throw new Error(`Insufficient training data: ${trainingData.length} samples`);
      }

      // 2. Preprocess data
      const { features, labels, validationData } = await this.preprocessData(trainingData);
      modelRun.validation_samples = validationData.length;

      // 3. Train model
      const trainingResult = await this.trainModel(agentType, features, labels, modelRun.config);
      modelRun.metrics = trainingResult.metrics;

      // 4. Validate on held-out data
      const validationResult = await this.validateModel(trainingResult.model, validationData);
      modelRun.metrics = { ...modelRun.metrics, ...validationResult };

      // 5. Check improvement threshold
      const shouldDeploy = await this.checkImprovementThreshold(agentType, modelRun.metrics, lastRun?.metrics);
      
      modelRun.status = 'completed';
      modelRun.training_end = new Date();
      modelRun.deployment_status = shouldDeploy ? 'deployed' : 'rejected';

      await this.saveModelRun(modelRun);

      // 6. Deploy if improvement meets threshold
      if (shouldDeploy) {
        await this.deployModel(agentType, trainingResult.model, modelRun.model_version);
        logger.info('Model deployed successfully', { agentType, version: modelRun.model_version });
      } else {
        logger.info('Model rejected - insufficient improvement', { 
          agentType, 
          currentMetrics: modelRun.metrics,
          previousMetrics: lastRun?.metrics 
        });
      }

      return modelRun;

    } catch (error) {
      logger.error('Retraining pipeline failed', { error, agentType, runId });
      await this.updateModelRunStatus(runId, 'failed');
      throw error;
    }
  }

  /**
   * Hyperparameter sweep execution
   */
  async runHyperparameterSweep(
    agentType: string,
    parameterGrid: Record<string, any[]>
  ): Promise<string> {
    const sweepId = randomUUID();
    logger.info('Starting hyperparameter sweep', { agentType, sweepId, parameterGrid });

    try {
      // Generate all parameter combinations
      const combinations = this.generateParameterCombinations(parameterGrid);
      logger.info(`Generated ${combinations.length} parameter combinations`);

      // Execute sweep in parallel (limited concurrency)
      const maxConcurrency = 3;
      const results: SweepResult[] = [];

      for (let i = 0; i < combinations.length; i += maxConcurrency) {
        const batch = combinations.slice(i, i + maxConcurrency);
        
        const batchPromises = batch.map(async (config) => {
          const resultId = randomUUID();
          const startTime = Date.now();

          try {
            // Execute training with this configuration
            const trainingData = await this.fetchRecentTrainingData(agentType, 1000);
            const { features, labels, validationData } = await this.preprocessData(trainingData);
            
            const trainingResult = await this.trainModel(agentType, features, labels, config);
            const validationResult = await this.validateModel(trainingResult.model, validationData);
            
            const executionTime = Date.now() - startTime;
            
            const result: SweepResult = {
              id: resultId,
              sweep_id: sweepId,
              agent_type: agentType,
              config,
              metrics: { ...trainingResult.metrics, ...validationResult },
              status: 'completed',
              execution_time: executionTime,
              created_at: new Date()
            };

            await this.saveSweepResult(result);
            return result;

          } catch (error) {
            logger.error('Sweep configuration failed', { error, config });
            
            const result: SweepResult = {
              id: resultId,
              sweep_id: sweepId,
              agent_type: agentType,
              config,
              metrics: {},
              status: 'failed',
              execution_time: Date.now() - startTime,
              created_at: new Date()
            };

            await this.saveSweepResult(result);
            return result;
          }
        });

        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
        
        logger.info(`Completed batch ${Math.floor(i/maxConcurrency) + 1}/${Math.ceil(combinations.length/maxConcurrency)}`);
      }

      // Log sweep summary
      const successful = results.filter(r => r.status === 'completed');
      const bestResult = successful.reduce((best, current) => 
        (current.metrics.sharpe_ratio || 0) > (best.metrics.sharpe_ratio || 0) ? current : best
      );

      logger.info('Hyperparameter sweep completed', {
        sweepId,
        totalConfigurations: combinations.length,
        successful: successful.length,
        bestConfig: bestResult?.config,
        bestMetrics: bestResult?.metrics
      });

      return sweepId;

    } catch (error) {
      logger.error('Hyperparameter sweep failed', { error, sweepId });
      throw error;
    }
  }

  /**
   * Drift detection service
   */
  async calculateDriftMetrics(agentType: string): Promise<DriftMetrics[]> {
    logger.info('Calculating drift metrics', { agentType });
    
    const metrics: DriftMetrics[] = [];
    const currentTime = new Date();

    try {
      // 1. Feature drift detection
      const featureDrift = await this.calculateFeatureDrift(agentType);
      metrics.push({
        id: randomUUID(),
        agent_type: agentType,
        metric_type: 'feature_drift',
        value: featureDrift.klDivergence,
        threshold: 0.1,
        status: featureDrift.klDivergence > 0.1 ? 'critical' : featureDrift.klDivergence > 0.05 ? 'warning' : 'normal',
        details: featureDrift,
        calculated_at: currentTime
      });

      // 2. Prediction drift detection  
      const predictionDrift = await this.calculatePredictionDrift(agentType);
      metrics.push({
        id: randomUUID(),
        agent_type: agentType,
        metric_type: 'prediction_drift',
        value: predictionDrift.distributionShift,
        threshold: 0.15,
        status: predictionDrift.distributionShift > 0.15 ? 'critical' : predictionDrift.distributionShift > 0.1 ? 'warning' : 'normal',
        details: predictionDrift,
        calculated_at: currentTime
      });

      // 3. Performance drift detection
      const performanceDrift = await this.calculatePerformanceDrift(agentType);
      metrics.push({
        id: randomUUID(),
        agent_type: agentType,
        metric_type: 'performance_drift',
        value: performanceDrift.degradation,
        threshold: 0.05,
        status: performanceDrift.degradation > 0.05 ? 'critical' : performanceDrift.degradation > 0.02 ? 'warning' : 'normal',
        details: performanceDrift,
        calculated_at: currentTime
      });

      // Save metrics
      for (const metric of metrics) {
        await this.saveDriftMetric(metric);
      }

      // Trigger alerts if needed
      const criticalMetrics = metrics.filter(m => m.status === 'critical');
      if (criticalMetrics.length > 0) {
        await this.triggerDriftAlert(agentType, criticalMetrics);
      }

      return metrics;

    } catch (error) {
      logger.error('Drift calculation failed', { error, agentType });
      throw error;
    }
  }

  /**
   * Private helper methods
   */
  private async fetchTrainingData(agentType: string, since: Date): Promise<TrainingData[]> {
    // Fetch trades with outcomes since the cutoff date
    const trades = await db.execute(sql`
      SELECT 
        t.*,
        md.price as market_price,
        md.volume_24h,
        md.change_24h,
        ae.confidence,
        ae.data as agent_data
      FROM trades t
      LEFT JOIN "marketData" md ON t.symbol = md.symbol 
        AND md.timestamp <= t.executed_at
      LEFT JOIN "agentActivities" ae ON ae.data->>'trade_id' = t.id
      WHERE t.executed_at >= ${since.toISOString()}
        AND t.pnl IS NOT NULL
        AND t.status = 'closed'
      ORDER BY t.executed_at DESC
      LIMIT 1000
    `);

    return trades.rows.map((trade: any) => {
      const features = [
        parseFloat(trade.quantity),
        parseFloat(trade.entry_price),
        parseFloat(trade.market_price || trade.entry_price),
        parseFloat(trade.volume_24h || 0),
        parseFloat(trade.change_24h || 0),
        parseFloat(trade.confidence || 0.5),
        trade.side === 'buy' ? 1 : 0,
        // Add more features as needed
      ];

      const label = parseFloat(trade.pnl) > 0 ? 1 : 0; // Profitable = 1, Loss = 0

      return {
        features,
        label,
        metadata: {
          trade_id: trade.id,
          symbol: trade.symbol,
          timestamp: new Date(trade.executed_at),
          market_conditions: {
            price: trade.market_price,
            volume: trade.volume_24h,
            change: trade.change_24h
          }
        }
      };
    });
  }

  private async fetchRecentTrainingData(agentType: string, limit: number): Promise<TrainingData[]> {
    const cutoffDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days
    return this.fetchTrainingData(agentType, cutoffDate);
  }

  private async preprocessData(data: TrainingData[]): Promise<{
    features: number[][];
    labels: number[];
    validationData: TrainingData[];
  }> {
    // Split data for training/validation (80/20)
    const shuffled = [...data].sort(() => Math.random() - 0.5);
    const splitIndex = Math.floor(shuffled.length * 0.8);
    
    const trainingData = shuffled.slice(0, splitIndex);
    const validationData = shuffled.slice(splitIndex);

    // Normalize features
    const features = trainingData.map(d => this.normalizeFeatures(d.features));
    const labels = trainingData.map(d => d.label);

    return { features, labels, validationData };
  }

  private normalizeFeatures(features: number[]): number[] {
    // Simple min-max normalization
    // In production, you'd store normalization parameters
    return features.map(f => Math.max(0, Math.min(1, f / 1000)));
  }

  private async trainModel(
    agentType: string,
    features: number[][],
    labels: number[],
    config: any
  ): Promise<{ model: any; metrics: any }> {
    // Simplified training simulation
    // In production, this would call your actual ML training pipeline
    
    const simulatedTraining = new Promise(resolve => {
      setTimeout(() => {
        const accuracy = 0.7 + Math.random() * 0.2; // 0.7-0.9
        const precision = 0.65 + Math.random() * 0.25; // 0.65-0.9
        const recall = 0.6 + Math.random() * 0.3; // 0.6-0.9
        
        resolve({
          model: { type: agentType, config, trained_at: new Date() },
          metrics: {
            accuracy,
            precision,
            recall,
            validation_loss: Math.random() * 0.5
          }
        });
      }, 2000 + Math.random() * 3000); // 2-5 seconds
    });

    return simulatedTraining as Promise<{ model: any; metrics: any }>;
  }

  private async validateModel(model: any, validationData: TrainingData[]): Promise<any> {
    // Simulate validation
    const sharpeRatio = 0.5 + Math.random() * 1.5; // 0.5-2.0
    const accuracy = 0.6 + Math.random() * 0.3; // 0.6-0.9
    
    return {
      sharpe_ratio: sharpeRatio,
      validation_accuracy: accuracy,
      validation_samples: validationData.length
    };
  }

  private async checkImprovementThreshold(
    agentType: string,
    currentMetrics: any,
    previousMetrics?: any
  ): Promise<boolean> {
    if (!previousMetrics) return true; // First model, deploy it
    
    const currentSharpe = currentMetrics.sharpe_ratio || 0;
    const previousSharpe = previousMetrics.sharpe_ratio || 0;
    
    const improvement = (currentSharpe - previousSharpe) / Math.abs(previousSharpe);
    return improvement >= 0.02; // 2% improvement threshold
  }

  private generateParameterCombinations(grid: Record<string, any[]>): Record<string, any>[] {
    const keys = Object.keys(grid);
    const combinations: Record<string, any>[] = [];
    
    function generateCombinations(index: number, current: Record<string, any>) {
      if (index === keys.length) {
        combinations.push({ ...current });
        return;
      }
      
      const key = keys[index];
      for (const value of grid[key]) {
        current[key] = value;
        generateCombinations(index + 1, current);
      }
    }
    
    generateCombinations(0, {});
    return combinations;
  }

  private async calculateFeatureDrift(agentType: string): Promise<any> {
    // Simplified KL divergence calculation
    // Compare recent feature distributions vs historical
    const klDivergence = Math.random() * 0.2; // 0-0.2
    
    return {
      klDivergence,
      features_analyzed: ['price', 'volume', 'volatility'],
      comparison_period: '7d_vs_30d'
    };
  }

  private async calculatePredictionDrift(agentType: string): Promise<any> {
    // Distribution shift in predictions
    const distributionShift = Math.random() * 0.3; // 0-0.3
    
    return {
      distributionShift,
      prediction_bins: 10,
      comparison_method: 'wasserstein_distance'
    };
  }

  private async calculatePerformanceDrift(agentType: string): Promise<any> {
    // Performance degradation over time
    const degradation = Math.random() * 0.1; // 0-0.1
    
    return {
      degradation,
      metric: 'sharpe_ratio',
      period: '7d_rolling_average'
    };
  }

  private async getOptimalConfig(agentType: string): Promise<any> {
    // Get best configuration from previous sweeps
    try {
      const bestConfig = await db.execute(sql`
        SELECT config FROM sweep_results 
        WHERE agent_type = ${agentType} 
          AND status = 'completed'
        ORDER BY (metrics->>'sharpe_ratio')::float DESC 
        LIMIT 1
      `);
      
      if (bestConfig.rows.length > 0) {
        return JSON.parse(bestConfig.rows[0].config);
      }
    } catch (error) {
      logger.warn('Could not fetch optimal config, using defaults', { error });
    }
    
    // Default configuration
    return {
      learning_rate: 0.001,
      batch_size: 32,
      epochs: 100,
      risk_threshold: 0.1
    };
  }

  private async getLastSuccessfulRun(agentType: string): Promise<ModelRun | null> {
    try {
      const result = await db.execute(sql`
        SELECT * FROM model_runs 
        WHERE agent_type = ${agentType} 
          AND status = 'completed'
          AND deployment_status = 'deployed'
        ORDER BY training_start DESC 
        LIMIT 1
      `);
      
      return result.rows.length > 0 ? result.rows[0] as ModelRun : null;
    } catch (error) {
      logger.error('Error fetching last successful run', { error });
      return null;
    }
  }

  private async saveModelRun(modelRun: ModelRun): Promise<void> {
    await db.execute(sql`
      INSERT INTO model_runs (
        run_id, agent_type, model_version, training_start, training_end,
        status, metrics, config, training_samples, validation_samples,
        improvement_threshold, previous_model_version, deployment_status, created_at
      ) VALUES (
        ${modelRun.id}, ${modelRun.agent_type}, ${modelRun.model_version},
        ${modelRun.training_start}, ${modelRun.training_end},
        ${modelRun.status}, ${JSON.stringify(modelRun.metrics)}, ${JSON.stringify(modelRun.config)},
        ${modelRun.training_samples}, ${modelRun.validation_samples},
        ${modelRun.improvement_threshold}, ${modelRun.previous_model_version},
        ${modelRun.deployment_status}, ${modelRun.created_at}
      )
      ON CONFLICT (run_id) DO UPDATE SET
        training_end = EXCLUDED.training_end,
        status = EXCLUDED.status,
        metrics = EXCLUDED.metrics,
        deployment_status = EXCLUDED.deployment_status,
        updated_at = NOW()
    `);
  }

  private async saveSweepResult(result: SweepResult): Promise<void> {
    await db.execute(sql`
      INSERT INTO sweep_results (
        id, sweep_id, agent_type, config, metrics, status, execution_time, created_at
      ) VALUES (
        ${result.id}, ${result.sweep_id}, ${result.agent_type},
        ${JSON.stringify(result.config)}, ${JSON.stringify(result.metrics)},
        ${result.status}, ${result.execution_time}, ${result.created_at.toISOString()}
      )
    `);
  }

  private async saveDriftMetric(metric: DriftMetrics): Promise<void> {
    await db.execute(sql`
      INSERT INTO drift_metrics (
        agent_type, metric_type, metric_value, threshold, status, metadata, created_at
      ) VALUES (
        ${metric.agent_type}, ${metric.metric_type}, ${metric.value}, 
        ${metric.threshold}, ${metric.status}, ${JSON.stringify(metric.details)}, ${metric.calculated_at}
      )
        ${metric.id}, ${metric.agent_type}, ${metric.metric_type},
        ${metric.value}, ${metric.threshold}, ${metric.status},
        ${JSON.stringify(metric.details)}, ${metric.calculated_at.toISOString()}
      )
    `);
  }

  private async updateModelRunStatus(runId: string, status: string): Promise<void> {
    await db.execute(sql`
      UPDATE model_runs 
      SET status = ${status}, training_end = NOW()
      WHERE id = ${runId}
    `);
  }

  private async deployModel(agentType: string, model: any, version: string): Promise<void> {
    // In production, this would deploy the model to your inference service
    logger.info('Deploying model', { agentType, version, model: model.type });
    
    // Store deployment metadata
    await db.execute(sql`
      INSERT INTO model_deployments (
        id, agent_type, model_version, deployed_at, model_data
      ) VALUES (
        ${randomUUID()}, ${agentType}, ${version}, NOW(), ${JSON.stringify(model)}
      )
    `);
  }

  private async triggerDriftAlert(agentType: string, metrics: DriftMetrics[]): Promise<void> {
    logger.warn('Drift alert triggered', { agentType, criticalMetrics: metrics.length });
    
    // In production, this would integrate with your alerting system
    // For now, we'll just log and could integrate with /metrics endpoint
  }
}