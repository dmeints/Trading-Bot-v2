/**
 * PHASE 5: ONLINE TRAINER - CONTINUOUS LEARNING & DRIFT SAFETY
 * Micro-batch retraining with feature drift monitoring and auto-rollback
 */

import { featureService, FeatureVector } from '../services/featureService';
import { marketDataService } from '../services/marketData';
import { simulationEngine } from '../services/simulationEngine';
import { logger } from '../utils/logger';
import fs from 'fs/promises';
import path from 'path';

export interface DriftMetrics {
  timestamp: number;
  symbol: string;
  featureDrift: Record<string, number>;
  distributionShift: number;
  performanceDrift: number;
  alertLevel: 'green' | 'yellow' | 'red';
  rollbackRecommended: boolean;
}

export interface OnlineTrainingState {
  isTraining: boolean;
  batchSize: number;
  retrainingInterval: number;
  driftThreshold: number;
  rollbackThreshold: number;
  lastTrainingTime: number;
  modelsInProduction: string[];
  rollbackHistory: Array<{
    timestamp: number;
    reason: string;
    previousModel: string;
    currentModel: string;
  }>;
}

export class OnlineTrainer {
  private state: OnlineTrainingState = {
    isTraining: false,
    batchSize: 100,
    retrainingInterval: 60 * 60 * 1000, // 1 hour
    driftThreshold: 0.15, // 15% feature drift threshold
    rollbackThreshold: 0.25, // 25% performance drop
    lastTrainingTime: 0,
    modelsInProduction: [],
    rollbackHistory: []
  };

  private driftHistory: DriftMetrics[] = [];
  private featureBaselines: Map<string, Map<string, number>> = new Map();
  private performanceBaselines: Map<string, number> = new Map();
  private trainingTimer?: NodeJS.Timeout;

  async initialize(): Promise<void> {
    logger.info('🔄 Initializing online training system...');
    
    // Load existing state
    await this.loadState();
    
    // Initialize feature baselines
    await this.initializeBaselines();
    
    // Start continuous monitoring
    this.startContinuousMonitoring();
    
    logger.info('✅ Online training system initialized', {
      batchSize: this.state.batchSize,
      interval: this.state.retrainingInterval / (60 * 1000) + 'min',
      driftThreshold: (this.state.driftThreshold * 100) + '%'
    });
  }

  private async initializeBaselines(): Promise<void> {
    const symbols = ['BTC', 'ETH', 'SOL', 'ADA', 'DOT'];
    
    for (const symbol of symbols) {
      try {
        // Get recent features to establish baseline
        const features = await featureService.getFeatures(symbol);
        this.setFeatureBaseline(symbol, features);
        
        // Set initial performance baseline (would come from current model performance)
        this.performanceBaselines.set(symbol, 1.5); // Default Sharpe ratio baseline
        
      } catch (error) {
        logger.error(`Failed to initialize baseline for ${symbol}:`, error as Record<string, any>);
      }
    }
    
    logger.info(`📊 Feature baselines initialized for ${this.featureBaselines.size} symbols`);
  }

  private setFeatureBaseline(symbol: string, features: FeatureVector): void {
    const baseline = new Map<string, number>();
    
    // Store key feature statistics
    baseline.set('price_volatility', features.volatility_24h);
    baseline.set('volume_ratio', features.volume_ratio);
    baseline.set('rsi', features.rsi_14);
    baseline.set('sentiment', features.sentiment_score);
    baseline.set('funding_rate', features.funding_rate);
    baseline.set('btc_correlation', features.btc_correlation);
    baseline.set('fear_greed', features.fear_greed_index);
    
    this.featureBaselines.set(symbol, baseline);
  }

  private startContinuousMonitoring(): void {
    // Clear existing timer
    if (this.trainingTimer) {
      clearInterval(this.trainingTimer);
    }
    
    // Schedule periodic retraining
    this.trainingTimer = setInterval(async () => {
      try {
        await this.runMicroBatchTraining();
      } catch (error) {
        logger.error('Scheduled training failed:', error as Record<string, any>);
      }
    }, this.state.retrainingInterval);
    
    logger.info(`⏰ Continuous monitoring started (${this.state.retrainingInterval / (60 * 1000)}min intervals)`);
  }

  async runMicroBatchTraining(): Promise<void> {
    if (this.state.isTraining) {
      logger.warn('Training already in progress, skipping...');
      return;
    }

    this.state.isTraining = true;
    const startTime = Date.now();
    
    logger.info('🎯 Starting micro-batch training...');
    
    try {
      // 1. Collect drift metrics for all symbols
      const driftResults = await this.assessFeatureDrift();
      
      // 2. Check if rollback is needed
      const rollbackNeeded = driftResults.some(drift => drift.rollbackRecommended);
      
      if (rollbackNeeded) {
        await this.handleRollback(driftResults);
        return;
      }
      
      // 3. Collect recent training data
      const trainingData = await this.collectRecentData();
      
      if (trainingData.length < this.state.batchSize) {
        logger.info(`Insufficient data for training (${trainingData.length}/${this.state.batchSize})`);
        return;
      }
      
      // 4. Run incremental training
      await this.runIncrementalTraining(trainingData);
      
      // 5. Validate new model performance
      const validationResults = await this.validateNewModel();
      
      if (validationResults.approved) {
        await this.deployNewModel(validationResults.modelPath);
        logger.info('✅ Model successfully updated and deployed');
      } else {
        logger.warn('❌ New model failed validation, keeping previous version');
      }
      
      // 6. Update state
      this.state.lastTrainingTime = Date.now();
      await this.saveState();
      
    } catch (error) {
      logger.error('Micro-batch training failed:', error as Record<string, any>);
    } finally {
      this.state.isTraining = false;
      const duration = Date.now() - startTime;
      logger.info(`🏁 Training completed in ${duration}ms`);
    }
  }

  private async assessFeatureDrift(): Promise<DriftMetrics[]> {
    const symbols = ['BTC', 'ETH', 'SOL', 'ADA', 'DOT'];
    const results: DriftMetrics[] = [];
    
    for (const symbol of symbols) {
      try {
        const currentFeatures = await featureService.getFeatures(symbol);
        const baseline = this.featureBaselines.get(symbol);
        
        if (!baseline) {
          logger.warn(`No baseline found for ${symbol}, skipping drift assessment`);
          continue;
        }
        
        const drift = this.calculateFeatureDrift(currentFeatures, baseline);
        const performanceDrift = await this.calculatePerformanceDrift(symbol);
        
        const driftMetrics: DriftMetrics = {
          timestamp: Date.now(),
          symbol,
          featureDrift: drift.individual,
          distributionShift: drift.overall,
          performanceDrift,
          alertLevel: this.determineAlertLevel(drift.overall, performanceDrift),
          rollbackRecommended: drift.overall > this.state.rollbackThreshold || 
                              performanceDrift > this.state.rollbackThreshold
        };
        
        results.push(driftMetrics);
        this.driftHistory.push(driftMetrics);
        
        // Keep only last 1000 drift measurements
        if (this.driftHistory.length > 1000) {
          this.driftHistory = this.driftHistory.slice(-1000);
        }
        
      } catch (error) {
        logger.error(`Drift assessment failed for ${symbol}:`, error as Record<string, any>);
      }
    }
    
    return results;
  }

  private calculateFeatureDrift(current: FeatureVector, baseline: Map<string, number>): {
    individual: Record<string, number>;
    overall: number;
  } {
    const individual: Record<string, number> = {};
    let totalDrift = 0;
    let featureCount = 0;
    
    // Compare each feature to baseline
    const featureMap: Record<string, number> = {
      'price_volatility': current.volatility_24h,
      'volume_ratio': current.volume_ratio,
      'rsi': current.rsi_14,
      'sentiment': current.sentiment_score,
      'funding_rate': current.funding_rate,
      'btc_correlation': current.btc_correlation,
      'fear_greed': current.fear_greed_index
    };
    
    for (const [feature, currentValue] of Object.entries(featureMap)) {
      const baselineValue = baseline.get(feature);
      if (baselineValue !== undefined && baselineValue !== 0) {
        const drift = Math.abs((currentValue - baselineValue) / baselineValue);
        individual[feature] = drift;
        totalDrift += drift;
        featureCount++;
      }
    }
    
    return {
      individual,
      overall: featureCount > 0 ? totalDrift / featureCount : 0
    };
  }

  private async calculatePerformanceDrift(symbol: string): Promise<number> {
    const baseline = this.performanceBaselines.get(symbol);
    if (!baseline) return 0;
    
    // Would calculate current model performance vs baseline
    // For now, simulate some performance drift
    const simulatedCurrentPerf = baseline * (0.8 + Math.random() * 0.4); // 80% to 120% of baseline
    
    return Math.abs((simulatedCurrentPerf - baseline) / baseline);
  }

  private determineAlertLevel(distributionShift: number, performanceDrift: number): 'green' | 'yellow' | 'red' {
    const maxDrift = Math.max(distributionShift, performanceDrift);
    
    if (maxDrift > this.state.rollbackThreshold) return 'red';
    if (maxDrift > this.state.driftThreshold) return 'yellow';
    return 'green';
  }

  private async handleRollback(driftResults: DriftMetrics[]): Promise<void> {
    const criticalSymbols = driftResults.filter(d => d.rollbackRecommended).map(d => d.symbol);
    
    logger.warn('🚨 Critical drift detected, initiating rollback', {
      symbols: criticalSymbols,
      driftLevels: driftResults.map(d => ({ 
        symbol: d.symbol, 
        shift: (d.distributionShift * 100).toFixed(1) + '%',
        performance: (d.performanceDrift * 100).toFixed(1) + '%' 
      }))
    });
    
    // Find previous stable model
    const previousModel = await this.getPreviousStableModel();
    
    if (previousModel) {
      await this.rollbackToModel(previousModel, `Critical drift in ${criticalSymbols.join(', ')}`);
      
      // Reset baselines to previous stable state
      await this.resetBaselines();
      
      logger.info('✅ Rollback completed successfully');
    } else {
      logger.error('❌ No previous stable model found for rollback');
    }
  }

  private async collectRecentData(): Promise<any[]> {
    // Collect recent market data, trades, and performance metrics
    const trainingData: any[] = [];
    
    try {
      const symbols = ['BTC', 'ETH', 'SOL'];
      const endTime = Date.now();
      const startTime = endTime - (4 * 60 * 60 * 1000); // Last 4 hours
      
      for (const symbol of symbols) {
        const features = await featureService.getFeatures(symbol);
        
        // Simulate recent trading data
        for (let i = 0; i < this.state.batchSize / symbols.length; i++) {
          trainingData.push({
            timestamp: startTime + (i * 60000), // Every minute
            symbol,
            features,
            action: Math.floor(Math.random() * 3), // 0=hold, 1=buy, 2=sell
            reward: (Math.random() - 0.5) * 0.02 // ±1% reward
          });
        }
      }
      
      logger.info(`📦 Collected ${trainingData.length} training samples`);
      
    } catch (error) {
      logger.error('Failed to collect training data:', error as Record<string, any>);
    }
    
    return trainingData;
  }

  private async runIncrementalTraining(data: any[]): Promise<void> {
    logger.info('🧠 Running incremental model training...');
    
    // Save training data for Python script
    const dataPath = './tmp/incremental_training_data.json';
    await fs.mkdir(path.dirname(dataPath), { recursive: true });
    await fs.writeFile(dataPath, JSON.stringify(data, null, 2));
    
    // In real implementation, would call incremental learning algorithm
    // For now, simulate training process
    await this.sleep(2000); // Simulate training time
    
    logger.info('✅ Incremental training completed');
  }

  private async validateNewModel(): Promise<{ approved: boolean; modelPath: string; performance: number }> {
    logger.info('🔍 Validating new model...');
    
    // Run validation simulation
    const validationResults = {
      approved: Math.random() > 0.3, // 70% approval rate
      modelPath: `./models/online_model_${Date.now()}.h5`,
      performance: 1.2 + Math.random() * 0.8 // 1.2 to 2.0 Sharpe ratio
    };
    
    await this.sleep(1000); // Simulate validation time
    
    logger.info('📊 Model validation completed', {
      approved: validationResults.approved,
      performance: validationResults.performance.toFixed(2)
    });
    
    return validationResults;
  }

  private async deployNewModel(modelPath: string): Promise<void> {
    logger.info(`🚀 Deploying new model: ${modelPath}`);
    
    // Add to production models list
    this.state.modelsInProduction.push(modelPath);
    
    // Keep only last 5 models in production
    if (this.state.modelsInProduction.length > 5) {
      this.state.modelsInProduction = this.state.modelsInProduction.slice(-5);
    }
    
    // Update performance baselines with new model performance
    // This would be done with actual model evaluation
    
    logger.info('✅ Model deployment completed');
  }

  private async getPreviousStableModel(): Promise<string | null> {
    if (this.state.modelsInProduction.length > 1) {
      return this.state.modelsInProduction[this.state.modelsInProduction.length - 2];
    }
    return null;
  }

  private async rollbackToModel(modelPath: string, reason: string): Promise<void> {
    const currentModel = this.state.modelsInProduction[this.state.modelsInProduction.length - 1];
    
    // Record rollback
    this.state.rollbackHistory.push({
      timestamp: Date.now(),
      reason,
      previousModel: currentModel,
      currentModel: modelPath
    });
    
    // Keep only last 50 rollback entries
    if (this.state.rollbackHistory.length > 50) {
      this.state.rollbackHistory = this.state.rollbackHistory.slice(-50);
    }
    
    logger.info('↩️ Model rollback executed', { from: currentModel, to: modelPath, reason });
  }

  private async resetBaselines(): Promise<void> {
    // Reset feature baselines to stable state
    await this.initializeBaselines();
    logger.info('🔄 Feature baselines reset to stable state');
  }

  private async loadState(): Promise<void> {
    try {
      const statePath = './tmp/online_training_state.json';
      const data = await fs.readFile(statePath, 'utf8');
      this.state = { ...this.state, ...JSON.parse(data) };
    } catch {
      // Use default state
    }
  }

  private async saveState(): Promise<void> {
    try {
      const statePath = './tmp/online_training_state.json';
      await fs.mkdir(path.dirname(statePath), { recursive: true });
      await fs.writeFile(statePath, JSON.stringify(this.state, null, 2));
    } catch (error) {
      logger.error('Failed to save online training state:', error as Record<string, any>);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Public API methods
  
  async getDriftStatus(): Promise<{
    currentDrift: DriftMetrics[];
    alertCount: Record<'green' | 'yellow' | 'red', number>;
    recentRollbacks: typeof this.state.rollbackHistory;
  }> {
    const recent = this.driftHistory.slice(-10); // Last 10 measurements
    const alertCount = recent.reduce(
      (acc, drift) => {
        acc[drift.alertLevel]++;
        return acc;
      },
      { green: 0, yellow: 0, red: 0 }
    );
    
    return {
      currentDrift: recent,
      alertCount,
      recentRollbacks: this.state.rollbackHistory.slice(-10)
    };
  }

  async forceTriggerTraining(): Promise<void> {
    logger.info('🎯 Manual training triggered');
    await this.runMicroBatchTraining();
  }

  async adjustSettings(settings: Partial<OnlineTrainingState>): Promise<void> {
    this.state = { ...this.state, ...settings };
    await this.saveState();
    
    // Restart monitoring with new settings
    if (settings.retrainingInterval) {
      this.startContinuousMonitoring();
    }
    
    logger.info('⚙️ Online training settings updated', settings);
  }

  async shutdown(): Promise<void> {
    if (this.trainingTimer) {
      clearInterval(this.trainingTimer);
    }
    
    this.state.isTraining = false;
    await this.saveState();
    
    logger.info('🛑 Online training system shutdown');
  }
}

export const onlineTrainer = new OnlineTrainer();