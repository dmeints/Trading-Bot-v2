/**
 * Alerting Integration - Connect alerts to monitoring systems
 */

import { alertingService } from './alertingService';
import { logger } from '../utils/logger';

// Integration with existing monitoring services
export class AlertingIntegration {
  
  // Health monitoring integration
  static async monitorSystemHealth(): Promise<void> {
    try {
      const healthResponse = await fetch('http://localhost:5000/api/health');
      
      if (!healthResponse.ok) {
        await alertingService.systemHealthAlert(
          'degraded',
          `Health endpoint returned ${healthResponse.status}`
        );
      }
    } catch (error) {
      await alertingService.systemHealthAlert(
        'outage',
        `Health endpoint unreachable: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  // Trading system integration
  static async monitorTradingSystem(): Promise<void> {
    try {
      // Check for excessive losses
      const metricsResponse = await fetch('http://localhost:5000/api/metrics');
      
      if (metricsResponse.ok) {
        const metricsText = await metricsResponse.text();
        
        // Parse Prometheus metrics for trading alerts
        if (metricsText.includes('trading_pnl_total') && metricsText.includes('-')) {
          // Detect significant losses - would need actual metric parsing
          const lossThreshold = -1000; // $1000 loss threshold
          // This is simplified - in production, parse actual metrics
        }
      }
    } catch (error) {
      logger.error('Failed to monitor trading system', { error });
    }
  }

  // Database monitoring integration
  static async monitorDatabase(): Promise<void> {
    try {
      // Simple database connectivity check
      const { db } = await import('../db');
      await db.execute(`SELECT 1`);
    } catch (error) {
      await alertingService.criticalAlert(
        'Database Connection Failed',
        `Database is unreachable: ${error instanceof Error ? error.message : String(error)}`,
        'Database Monitor'
      );
    }
  }

  // Start monitoring intervals
  static startMonitoring(): void {
    // Health check every 2 minutes
    setInterval(() => {
      AlertingIntegration.monitorSystemHealth().catch(err => 
        logger.error('Health monitoring failed', { error: err })
      );
    }, 2 * 60 * 1000);

    // Trading system check every 5 minutes
    setInterval(() => {
      AlertingIntegration.monitorTradingSystem().catch(err =>
        logger.error('Trading monitoring failed', { error: err })
      );
    }, 5 * 60 * 1000);

    // Database check every 10 minutes
    setInterval(() => {
      AlertingIntegration.monitorDatabase().catch(err =>
        logger.error('Database monitoring failed', { error: err })
      );
    }, 10 * 60 * 1000);

    logger.info('Alerting monitoring started');
  }
}

// Example usage in emergency scenarios
export async function triggerEmergencyAlert(reason: string): Promise<void> {
  await alertingService.criticalAlert(
    'EMERGENCY STOP ACTIVATED',
    `Trading has been halted: ${reason}`,
    'Emergency System'
  );
}