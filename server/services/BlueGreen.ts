
import { logger } from '../utils/logger';

interface SLOMetrics {
  p95LatencyMs: number;
  errorRate: number;
  qosScore: number;
  timestamp: number;
}

type DeploymentState = 'candidate' | 'canary' | 'partial' | 'active' | 'rollback';

interface DeploymentConfig {
  version: string;
  state: DeploymentState;
  trafficPercent: number;
  startedAt: number;
  slos: SLOMetrics;
  rollbackThreshold: {
    maxErrorRate: number;
    maxLatencyMs: number;
    minQosScore: number;
  };
}

export class BlueGreen {
  private currentDeployment: DeploymentConfig;
  private metrics: SLOMetrics[] = [];

  constructor() {
    this.currentDeployment = {
      version: '1.0.0',
      state: 'active',
      trafficPercent: 100,
      startedAt: Date.now(),
      slos: {
        p95LatencyMs: 50,
        errorRate: 0.001,
        qosScore: 0.95,
        timestamp: Date.now()
      },
      rollbackThreshold: {
        maxErrorRate: 0.05,
        maxLatencyMs: 200,
        minQosScore: 0.8
      }
    };
  }

  async deployCandidate(version: string): Promise<void> {
    logger.info(`[BlueGreen] Deploying candidate version ${version}`);
    
    this.currentDeployment = {
      version,
      state: 'candidate',
      trafficPercent: 0,
      startedAt: Date.now(),
      slos: this.generateMockSLOs(),
      rollbackThreshold: this.currentDeployment.rollbackThreshold
    };

    // Auto-promote to canary after validation
    setTimeout(() => this.promoteToCanary(), 5000);
  }

  private async promoteToCanary(): Promise<void> {
    if (this.currentDeployment.state !== 'candidate') return;

    logger.info(`[BlueGreen] Promoting to canary (1% traffic)`);
    this.currentDeployment.state = 'canary';
    this.currentDeployment.trafficPercent = 1;

    // Monitor and auto-promote if healthy
    setTimeout(() => this.checkAndPromote(), 10000);
  }

  private async checkAndPromote(): Promise<void> {
    const currentSLOs = this.generateMockSLOs();
    this.currentDeployment.slos = currentSLOs;
    
    const isHealthy = this.evaluateHealth(currentSLOs);
    
    if (isHealthy && this.currentDeployment.state === 'canary') {
      logger.info(`[BlueGreen] Promoting to partial (25% traffic)`);
      this.currentDeployment.state = 'partial';
      this.currentDeployment.trafficPercent = 25;
      
      setTimeout(() => this.checkAndPromote(), 15000);
    } else if (isHealthy && this.currentDeployment.state === 'partial') {
      logger.info(`[BlueGreen] Promoting to active (100% traffic)`);
      this.currentDeployment.state = 'active';
      this.currentDeployment.trafficPercent = 100;
    } else if (!isHealthy) {
      await this.rollback();
    }
  }

  private evaluateHealth(slos: SLOMetrics): boolean {
    const { rollbackThreshold } = this.currentDeployment;
    
    return (
      slos.errorRate <= rollbackThreshold.maxErrorRate &&
      slos.p95LatencyMs <= rollbackThreshold.maxLatencyMs &&
      slos.qosScore >= rollbackThreshold.minQosScore
    );
  }

  private async rollback(): Promise<void> {
    logger.warn(`[BlueGreen] Rolling back deployment due to SLO violations`);
    this.currentDeployment.state = 'rollback';
    this.currentDeployment.trafficPercent = 0;
  }

  private generateMockSLOs(): SLOMetrics {
    // Simulate realistic metrics with some variance
    return {
      p95LatencyMs: 45 + Math.random() * 30,
      errorRate: 0.001 + Math.random() * 0.004,
      qosScore: 0.92 + Math.random() * 0.06,
      timestamp: Date.now()
    };
  }

  getStatus(): DeploymentConfig {
    return {
      ...this.currentDeployment,
      slos: this.generateMockSLOs()
    };
  }

  getMetricsHistory(): SLOMetrics[] {
    return this.metrics.slice(-50); // Last 50 measurements
  }
}
