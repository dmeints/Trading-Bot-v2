
export interface ModelVersion {
  id: string;
  version: string;
  timestamp: Date;
  performance: Record<string, number>;
  active: boolean;
}

export class ModelRegistry {
  getCurrentVersion(): ModelVersion {
    return {
      id: 'baseline',
      version: '1.0.0',
      timestamp: new Date(),
      performance: { sharpe: 1.2, returns: 0.15 },
      active: true
    };
  }

  rollback(version: string): boolean {
    return true;
  }
}

export const modelRegistry = new ModelRegistry();
/**
 * Model Registry - Version router/policies with rollback capability
 */

import { logger } from '../utils/logger';

export interface ModelMetadata {
  id: string;
  name: string;
  version: string;
  type: 'router' | 'policy' | 'feature' | 'ensemble';
  description: string;
  author: string;
  createdAt: number;
  trainedAt?: number;
  deployedAt?: number;
  status: 'training' | 'ready' | 'deployed' | 'deprecated' | 'failed';
  metrics: {
    sharpe?: number;
    cvar?: number;
    calibration?: number;
    winRate?: number;
    maxDrawdown?: number;
    totalTrades?: number;
  };
  config: Record<string, any>;
  checksum: string;
  rollbackId?: string; // Previous version for rollback
}

export interface PromotionRequest {
  id: string;
  reason: string;
  approver: string;
}

export interface RollbackRequest {
  reason: string;
  targetId?: string; // If not provided, use previous version
  approver: string;
}

export class ModelRegistry {
  private models = new Map<string, ModelMetadata>();
  private currentModel: ModelMetadata | null = null;
  private deploymentHistory: Array<{ model: ModelMetadata; timestamp: number; action: 'promote' | 'rollback' }> = [];

  constructor() {
    this.initializeRegistry();
  }

  private initializeRegistry(): void {
    // Initialize with a baseline model
    const baselineModel: ModelMetadata = {
      id: 'baseline_v1.0',
      name: 'Baseline Strategy',
      version: '1.0.0',
      type: 'router',
      description: 'Simple baseline routing strategy',
      author: 'system',
      createdAt: Date.now(),
      deployedAt: Date.now(),
      status: 'deployed',
      metrics: {
        sharpe: 0.8,
        cvar: -0.05,
        calibration: 0.75,
        winRate: 0.52,
        maxDrawdown: -0.15,
        totalTrades: 1000
      },
      config: {
        strategy: 'baseline',
        riskTolerance: 'medium',
        rebalanceFreq: 'daily'
      },
      checksum: this.calculateChecksum('baseline_v1.0')
    };

    this.models.set(baselineModel.id, baselineModel);
    this.currentModel = baselineModel;
    
    logger.info('[ModelRegistry] Initialized with baseline model');
  }

  register(model: Omit<ModelMetadata, 'id' | 'createdAt' | 'checksum'>): ModelMetadata {
    const id = `${model.name.toLowerCase().replace(/\s+/g, '_')}_${model.version}_${Date.now()}`;
    
    const fullModel: ModelMetadata = {
      ...model,
      id,
      createdAt: Date.now(),
      checksum: this.calculateChecksum(id),
      status: 'ready'
    };

    this.models.set(id, fullModel);
    
    logger.info(`[ModelRegistry] Registered model ${id}`, {
      type: model.type,
      version: model.version
    });

    return fullModel;
  }

  promote(request: PromotionRequest): ModelMetadata {
    const model = this.models.get(request.id);
    if (!model) {
      throw new Error(`Model ${request.id} not found`);
    }

    if (model.status !== 'ready') {
      throw new Error(`Model ${request.id} is not ready for promotion (status: ${model.status})`);
    }

    // Validate model metrics
    this.validatePromotion(model);

    // Update current model rollback reference
    if (this.currentModel) {
      this.currentModel.status = 'deprecated';
      model.rollbackId = this.currentModel.id;
    }

    // Promote new model
    model.status = 'deployed';
    model.deployedAt = Date.now();
    this.currentModel = model;

    // Record deployment
    this.deploymentHistory.push({
      model: { ...model },
      timestamp: Date.now(),
      action: 'promote'
    });

    logger.info(`[ModelRegistry] Promoted model ${request.id}`, {
      reason: request.reason,
      approver: request.approver,
      metrics: model.metrics
    });

    return model;
  }

  rollback(request: RollbackRequest): ModelMetadata {
    if (!this.currentModel) {
      throw new Error('No current model to rollback from');
    }

    let targetModel: ModelMetadata;

    if (request.targetId) {
      const model = this.models.get(request.targetId);
      if (!model) {
        throw new Error(`Target model ${request.targetId} not found`);
      }
      targetModel = model;
    } else {
      // Use rollback reference
      if (!this.currentModel.rollbackId) {
        throw new Error('No rollback target available');
      }
      
      const model = this.models.get(this.currentModel.rollbackId);
      if (!model) {
        throw new Error(`Rollback target ${this.currentModel.rollbackId} not found`);
      }
      targetModel = model;
    }

    // Perform rollback
    this.currentModel.status = 'deprecated';
    targetModel.status = 'deployed';
    targetModel.deployedAt = Date.now();
    
    const previousModel = this.currentModel;
    this.currentModel = targetModel;

    // Record rollback
    this.deploymentHistory.push({
      model: { ...targetModel },
      timestamp: Date.now(),
      action: 'rollback'
    });

    logger.warn(`[ModelRegistry] Rolled back to model ${targetModel.id}`, {
      reason: request.reason,
      approver: request.approver,
      fromModel: previousModel.id
    });

    return targetModel;
  }

  private validatePromotion(model: ModelMetadata): void {
    const metrics = model.metrics;
    
    // Basic validation thresholds
    const thresholds = {
      minSharpe: 0.5,
      maxDrawdown: -0.30,
      minWinRate: 0.45,
      minTrades: 100
    };

    const issues: string[] = [];

    if (metrics.sharpe !== undefined && metrics.sharpe < thresholds.minSharpe) {
      issues.push(`Sharpe ratio ${metrics.sharpe} below threshold ${thresholds.minSharpe}`);
    }

    if (metrics.maxDrawdown !== undefined && metrics.maxDrawdown < thresholds.maxDrawdown) {
      issues.push(`Max drawdown ${metrics.maxDrawdown} exceeds threshold ${thresholds.maxDrawdown}`);
    }

    if (metrics.winRate !== undefined && metrics.winRate < thresholds.minWinRate) {
      issues.push(`Win rate ${metrics.winRate} below threshold ${thresholds.minWinRate}`);
    }

    if (metrics.totalTrades !== undefined && metrics.totalTrades < thresholds.minTrades) {
      issues.push(`Total trades ${metrics.totalTrades} below threshold ${thresholds.minTrades}`);
    }

    if (issues.length > 0) {
      throw new Error(`Model validation failed: ${issues.join('; ')}`);
    }
  }

  private calculateChecksum(id: string): string {
    // Simple checksum calculation
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      const char = id.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }

  getCurrent(): ModelMetadata | null {
    return this.currentModel;
  }

  getAll(): ModelMetadata[] {
    return Array.from(this.models.values()).sort((a, b) => b.createdAt - a.createdAt);
  }

  getById(id: string): ModelMetadata | undefined {
    return this.models.get(id);
  }

  getByType(type: ModelMetadata['type']): ModelMetadata[] {
    return Array.from(this.models.values())
      .filter(model => model.type === type)
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  getDeploymentHistory(limit: number = 20): Array<{ model: ModelMetadata; timestamp: number; action: 'promote' | 'rollback' }> {
    return this.deploymentHistory.slice(-limit);
  }

  updateMetrics(id: string, metrics: Partial<ModelMetadata['metrics']>): void {
    const model = this.models.get(id);
    if (model) {
      Object.assign(model.metrics, metrics);
      logger.info(`[ModelRegistry] Updated metrics for model ${id}`, metrics);
    }
  }

  deprecate(id: string, reason: string): void {
    const model = this.models.get(id);
    if (model && model.status !== 'deployed') {
      model.status = 'deprecated';
      logger.info(`[ModelRegistry] Deprecated model ${id}: ${reason}`);
    }
  }

  getStats(): {
    totalModels: number;
    currentModel: string | null;
    deploymentCount: number;
    rollbackCount: number;
  } {
    return {
      totalModels: this.models.size,
      currentModel: this.currentModel?.id || null,
      deploymentCount: this.deploymentHistory.filter(h => h.action === 'promote').length,
      rollbackCount: this.deploymentHistory.filter(h => h.action === 'rollback').length
    };
  }
}

export const modelRegistry = new ModelRegistry();
