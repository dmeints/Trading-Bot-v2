
/**
 * Chaos Injection - Verify graceful degradation
 */

import { EventEmitter } from 'events';
import { logger } from '../utils/logger';

export type ChaosType = 'ws_flap' | 'api_timeout' | 'l2_gap' | 'depth_spike' | 'network_partition';

export interface ChaosEvent {
  id: string;
  type: ChaosType;
  target: string;
  startTime: number;
  endTime?: number;
  parameters: Record<string, any>;
  impact: {
    systems: string[];
    severity: 'low' | 'medium' | 'high';
    recoveryTime?: number;
  };
}

export interface ChaosInjectionRequest {
  type: ChaosType;
  target?: string;
  duration?: number;
  parameters?: Record<string, any>;
}

export class Chaos extends EventEmitter {
  private activeEvents = new Map<string, ChaosEvent>();
  private eventHistory: ChaosEvent[] = [];
  private isEnabled = process.env.NODE_ENV === 'development';

  constructor() {
    super();
    logger.info(`[Chaos] Chaos injection ${this.isEnabled ? 'enabled' : 'disabled'}`);
  }

  inject(request: ChaosInjectionRequest): ChaosEvent {
    if (!this.isEnabled) {
      throw new Error('Chaos injection disabled in production');
    }

    const event: ChaosEvent = {
      id: `chaos_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`,
      type: request.type,
      target: request.target || 'system',
      startTime: Date.now(),
      parameters: request.parameters || {},
      impact: this.calculateImpact(request.type)
    };

    this.activeEvents.set(event.id, event);
    
    // Schedule auto-recovery
    const duration = request.duration || 30000; // 30s default
    setTimeout(() => {
      this.recover(event.id);
    }, duration);

    this.executeInjection(event);
    
    logger.warn(`[Chaos] Injected ${event.type} chaos event`, {
      id: event.id,
      target: event.target,
      duration
    });

    this.emit('chaosInjected', event);
    return event;
  }

  private executeInjection(event: ChaosEvent): void {
    switch (event.type) {
      case 'ws_flap':
        this.injectWebSocketFlap(event);
        break;
      case 'api_timeout':
        this.injectApiTimeout(event);
        break;
      case 'l2_gap':
        this.injectL2Gap(event);
        break;
      case 'depth_spike':
        this.injectDepthSpike(event);
        break;
      case 'network_partition':
        this.injectNetworkPartition(event);
        break;
    }
  }

  private injectWebSocketFlap(event: ChaosEvent): void {
    // Simulate WebSocket connection instability
    const flapCount = event.parameters.flapCount || 5;
    const interval = event.parameters.interval || 2000;

    let currentFlap = 0;
    const flapInterval = setInterval(() => {
      currentFlap++;
      
      logger.warn(`[Chaos] WebSocket flap ${currentFlap}/${flapCount}`);
      this.emit('wsFlap', { event, flapNumber: currentFlap });
      
      // Simulate connection drop and reconnect
      this.simulateConnectionDrop(event.target);
      
      if (currentFlap >= flapCount) {
        clearInterval(flapInterval);
      }
    }, interval);
  }

  private injectApiTimeout(event: ChaosEvent): void {
    // Simulate API call timeouts
    const timeoutMs = event.parameters.timeoutMs || 10000;
    
    logger.warn(`[Chaos] Injecting API timeouts for ${timeoutMs}ms`);
    
    // Set global timeout flag that other services can check
    global.chaosApiTimeout = true;
    
    setTimeout(() => {
      global.chaosApiTimeout = false;
      logger.info('[Chaos] API timeout chaos recovered');
    }, timeoutMs);
    
    this.emit('apiTimeout', { event, timeoutMs });
  }

  private injectL2Gap(event: ChaosEvent): void {
    // Simulate order book sequence gaps
    const gapSize = event.parameters.gapSize || 100;
    
    logger.warn(`[Chaos] Injecting L2 sequence gap of ${gapSize}`);
    
    // Emit gap event that BookMaintainer can listen for
    this.emit('l2Gap', { 
      event, 
      gapSize,
      symbol: event.target || 'BTCUSDT'
    });
  }

  private injectDepthSpike(event: ChaosEvent): void {
    // Simulate extreme order book depth changes
    const spikeMultiplier = event.parameters.spikeMultiplier || 10;
    
    logger.warn(`[Chaos] Injecting depth spike with ${spikeMultiplier}x multiplier`);
    
    this.emit('depthSpike', {
      event,
      spikeMultiplier,
      symbol: event.target || 'BTCUSDT'
    });
  }

  private injectNetworkPartition(event: ChaosEvent): void {
    // Simulate network connectivity issues
    const affectedSystems = event.parameters.systems || ['external_apis'];
    
    logger.warn(`[Chaos] Injecting network partition affecting:`, affectedSystems);
    
    global.chaosNetworkPartition = affectedSystems;
    
    this.emit('networkPartition', {
      event,
      affectedSystems
    });
  }

  private simulateConnectionDrop(target: string): void {
    // Emit connection drop event
    this.emit('connectionDrop', { target, timestamp: Date.now() });
    
    // Simulate reconnection after delay
    setTimeout(() => {
      this.emit('connectionRestore', { target, timestamp: Date.now() });
    }, 1000 + Math.random() * 3000);
  }

  private calculateImpact(type: ChaosType): ChaosEvent['impact'] {
    const impacts: Record<ChaosType, ChaosEvent['impact']> = {
      ws_flap: {
        systems: ['websocket', 'realtime_data'],
        severity: 'medium'
      },
      api_timeout: {
        systems: ['external_apis', 'data_ingestion'],
        severity: 'high'
      },
      l2_gap: {
        systems: ['order_book', 'microstructure'],
        severity: 'medium'
      },
      depth_spike: {
        systems: ['order_book', 'risk_management'],
        severity: 'low'
      },
      network_partition: {
        systems: ['all_external'],
        severity: 'high'
      }
    };

    return impacts[type];
  }

  recover(eventId: string): void {
    const event = this.activeEvents.get(eventId);
    if (!event) return;

    event.endTime = Date.now();
    event.impact.recoveryTime = event.endTime - event.startTime;
    
    this.activeEvents.delete(eventId);
    this.eventHistory.push(event);
    
    // Clean up chaos effects
    this.cleanupChaosEffects(event);
    
    logger.info(`[Chaos] Recovered from ${event.type} chaos event`, {
      id: eventId,
      recoveryTime: event.impact.recoveryTime
    });

    this.emit('chaosRecovered', event);
  }

  private cleanupChaosEffects(event: ChaosEvent): void {
    switch (event.type) {
      case 'api_timeout':
        global.chaosApiTimeout = false;
        break;
      case 'network_partition':
        global.chaosNetworkPartition = undefined;
        break;
    }
  }

  getActiveEvents(): ChaosEvent[] {
    return Array.from(this.activeEvents.values());
  }

  getEventHistory(limit: number = 50): ChaosEvent[] {
    return this.eventHistory.slice(-limit);
  }

  getSystemHealth(): { healthy: boolean; affectedSystems: string[] } {
    const affectedSystems = new Set<string>();
    
    for (const event of this.activeEvents.values()) {
      for (const system of event.impact.systems) {
        affectedSystems.add(system);
      }
    }

    return {
      healthy: this.activeEvents.size === 0,
      affectedSystems: Array.from(affectedSystems)
    };
  }

  forceRecoverAll(): void {
    const activeIds = Array.from(this.activeEvents.keys());
    for (const id of activeIds) {
      this.recover(id);
    }
    
    logger.info('[Chaos] Force recovered all active chaos events');
  }

  enable(): void {
    this.isEnabled = true;
    logger.info('[Chaos] Chaos injection enabled');
  }

  disable(): void {
    this.forceRecoverAll();
    this.isEnabled = false;
    logger.info('[Chaos] Chaos injection disabled');
  }
}

export const chaos = new Chaos();
