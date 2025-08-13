
import { logger } from '../utils/logger';

type ChaosType = 'ws_flap' | 'api_timeout' | 'l2_gap' | 'depth_spike' | 'network_partition' | 'memory_pressure';

interface ChaosInjection {
  type: ChaosType;
  startTime: number;
  duration: number;
  severity: number;
  metadata?: Record<string, any>;
}

export class Chaos {
  private activeInjections: Map<string, ChaosInjection> = new Map();
  private injectionHistory: ChaosInjection[] = [];
  private enabled: boolean = process.env.NODE_ENV === 'development';

  async inject(type: ChaosType, options?: { duration?: number; severity?: number }): Promise<string> {
    if (!this.enabled) {
      throw new Error('Chaos engineering only available in development mode');
    }

    const injectionId = `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const injection: ChaosInjection = {
      type,
      startTime: Date.now(),
      duration: options?.duration || this.getDefaultDuration(type),
      severity: options?.severity || 0.5,
      metadata: this.getInjectionMetadata(type)
    };

    this.activeInjections.set(injectionId, injection);
    this.injectionHistory.push(injection);

    logger.warn(`[Chaos] Injecting ${type} for ${injection.duration}ms`, {
      injectionId,
      severity: injection.severity
    });

    // Execute the chaos injection
    await this.executeInjection(type, injection);

    // Auto-cleanup after duration
    setTimeout(() => {
      this.activeInjections.delete(injectionId);
      logger.info(`[Chaos] Injection ${injectionId} completed`);
    }, injection.duration);

    return injectionId;
  }

  private async executeInjection(type: ChaosType, injection: ChaosInjection): Promise<void> {
    switch (type) {
      case 'ws_flap':
        await this.injectWebSocketFlap(injection);
        break;
      case 'api_timeout':
        await this.injectApiTimeout(injection);
        break;
      case 'l2_gap':
        await this.injectL2Gap(injection);
        break;
      case 'depth_spike':
        await this.injectDepthSpike(injection);
        break;
      case 'network_partition':
        await this.injectNetworkPartition(injection);
        break;
      case 'memory_pressure':
        await this.injectMemoryPressure(injection);
        break;
    }
  }

  private async injectWebSocketFlap(injection: ChaosInjection): Promise<void> {
    // Simulate WebSocket connection instability
    const flapCount = Math.floor(injection.severity * 10) + 1;
    const interval = injection.duration / flapCount;

    for (let i = 0; i < flapCount; i++) {
      setTimeout(() => {
        logger.warn(`[Chaos] WebSocket flap ${i + 1}/${flapCount}`);
        // In real implementation, would disconnect/reconnect WebSocket clients
      }, i * interval);
    }
  }

  private async injectApiTimeout(injection: ChaosInjection): Promise<void> {
    // Simulate API response delays
    const delayMs = injection.severity * 5000; // Up to 5s delay
    logger.warn(`[Chaos] Injecting API timeout of ${delayMs}ms`);
    
    // Store delay for middleware to use
    global.chaosApiDelay = delayMs;
    
    setTimeout(() => {
      global.chaosApiDelay = 0;
    }, injection.duration);
  }

  private async injectL2Gap(injection: ChaosInjection): Promise<void> {
    // Simulate order book data gaps
    const gapSize = injection.severity * 50; // Up to 50% of book depth
    logger.warn(`[Chaos] Injecting L2 gap of ${gapSize}%`);
    
    global.chaosL2Gap = gapSize;
    
    setTimeout(() => {
      global.chaosL2Gap = 0;
    }, injection.duration);
  }

  private async injectDepthSpike(injection: ChaosInjection): Promise<void> {
    // Simulate sudden depth spikes in order book
    const spikeMultiplier = 1 + injection.severity * 10; // Up to 10x normal depth
    logger.warn(`[Chaos] Injecting depth spike of ${spikeMultiplier}x`);
    
    global.chaosDepthSpike = spikeMultiplier;
    
    setTimeout(() => {
      global.chaosDepthSpike = 1;
    }, injection.duration);
  }

  private async injectNetworkPartition(injection: ChaosInjection): Promise<void> {
    // Simulate network partitioning
    logger.warn(`[Chaos] Simulating network partition`);
    global.chaosNetworkPartition = true;
    
    setTimeout(() => {
      global.chaosNetworkPartition = false;
    }, injection.duration);
  }

  private async injectMemoryPressure(injection: ChaosInjection): Promise<void> {
    // Simulate memory pressure
    const pressureSize = injection.severity * 100; // MB
    logger.warn(`[Chaos] Injecting memory pressure of ${pressureSize}MB`);
    
    const memoryHog: any[] = [];
    const chunkSize = 1024 * 1024; // 1MB chunks
    
    for (let i = 0; i < pressureSize; i++) {
      memoryHog.push(new Array(chunkSize / 4).fill(Math.random()));
    }
    
    setTimeout(() => {
      memoryHog.length = 0; // Release memory
    }, injection.duration);
  }

  private getDefaultDuration(type: ChaosType): number {
    const durations: Record<ChaosType, number> = {
      'ws_flap': 30000,      // 30s
      'api_timeout': 60000,   // 1m
      'l2_gap': 15000,        // 15s
      'depth_spike': 20000,   // 20s
      'network_partition': 45000, // 45s
      'memory_pressure': 30000    // 30s
    };
    return durations[type] || 30000;
  }

  private getInjectionMetadata(type: ChaosType): Record<string, any> {
    return {
      environment: process.env.NODE_ENV,
      timestamp: Date.now(),
      type,
      source: 'chaos-engineering'
    };
  }

  getActiveInjections(): ChaosInjection[] {
    return Array.from(this.activeInjections.values());
  }

  getInjectionHistory(limit: number = 50): ChaosInjection[] {
    return this.injectionHistory.slice(-limit);
  }

  stopInjection(injectionId: string): boolean {
    const removed = this.activeInjections.delete(injectionId);
    if (removed) {
      logger.info(`[Chaos] Stopped injection ${injectionId}`);
    }
    return removed;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  getStats(): Record<string, any> {
    return {
      enabled: this.enabled,
      activeInjections: this.activeInjections.size,
      totalHistoryCount: this.injectionHistory.length,
      injectionTypes: [...new Set(this.injectionHistory.map(i => i.type))],
      lastInjection: this.injectionHistory[this.injectionHistory.length - 1]
    };
  }
}

export const chaos = new Chaos();
