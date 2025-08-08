/**
 * RISK ALERT SERVICE
 * Real-time risk monitoring and alert system for Stevie
 * 
 * Features:
 * - Real-time risk monitoring
 * - Alert escalation and notification
 * - Risk dashboard metrics
 * - Emergency stop mechanisms
 * - Risk reporting and analytics
 */

import { EventEmitter } from 'events';
import { logger } from '../utils/logger.js';
import { riskManagementService, type RiskAlert, type PortfolioRisk } from './riskManagement.js';

export interface AlertRule {
  id: string;
  name: string;
  condition: (risk: PortfolioRisk) => boolean;
  level: 'warning' | 'critical' | 'emergency';
  message: string;
  action: string;
  cooldownMs: number;
  enabled: boolean;
}

export interface AlertHistory {
  alert: RiskAlert;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: number;
  resolved: boolean;
  resolvedAt?: number;
}

export class RiskAlertService extends EventEmitter {
  private isInitialized = false;
  private alertRules: Map<string, AlertRule> = new Map();
  private activeAlerts: Map<string, RiskAlert> = new Map();
  private alertHistory: AlertHistory[] = [];
  private lastAlertTimes: Map<string, number> = new Map();
  private monitoringInterval?: NodeJS.Timeout;

  constructor() {
    super();
    this.initializeDefaultRules();
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      logger.info('[RiskAlerts] Initializing risk alert service');
      
      // Start monitoring
      this.startMonitoring();
      
      // Listen to risk management events
      riskManagementService.on('positionAdded', this.onPositionChange.bind(this));
      riskManagementService.on('positionClosed', this.onPositionChange.bind(this));
      riskManagementService.on('positionExit', this.onPositionExit.bind(this));
      
      this.isInitialized = true;
      logger.info('[RiskAlerts] Risk alert service initialized');
      
    } catch (error) {
      logger.error('[RiskAlerts] Initialization failed:', error as Error);
      throw error;
    }
  }

  private initializeDefaultRules(): void {
    // Daily loss limit rule
    this.addAlertRule({
      id: 'daily_loss_limit',
      name: 'Daily Loss Limit',
      condition: (risk) => Math.abs(risk.dailyPnL / risk.totalValue) >= 0.02,
      level: 'emergency',
      message: 'Daily loss limit of 2% exceeded',
      action: 'STOP_ALL_TRADING',
      cooldownMs: 300000, // 5 minutes
      enabled: true
    });

    // Maximum drawdown rule
    this.addAlertRule({
      id: 'max_drawdown',
      name: 'Maximum Drawdown',
      condition: (risk) => risk.maxDrawdown >= 0.15,
      level: 'critical',
      message: 'Maximum drawdown of 15% exceeded',
      action: 'REDUCE_RISK_EXPOSURE',
      cooldownMs: 600000, // 10 minutes
      enabled: true
    });

    // High concentration risk
    this.addAlertRule({
      id: 'concentration_risk',
      name: 'Concentration Risk',
      condition: (risk) => risk.concentrationRisk >= 0.4,
      level: 'warning',
      message: 'High concentration risk detected',
      action: 'DIVERSIFY_POSITIONS',
      cooldownMs: 1800000, // 30 minutes
      enabled: true
    });

    // High leverage rule
    this.addAlertRule({
      id: 'high_leverage',
      name: 'High Leverage',
      condition: (risk) => risk.leverageRatio >= 2.0,
      level: 'critical',
      message: 'Leverage ratio exceeds 2:1',
      action: 'REDUCE_POSITIONS',
      cooldownMs: 300000, // 5 minutes
      enabled: true
    });

    // Volatility spike rule
    this.addAlertRule({
      id: 'volatility_spike',
      name: 'Volatility Spike',
      condition: (risk) => risk.volatility >= 0.8,
      level: 'warning',
      message: 'High volatility detected',
      action: 'REDUCE_POSITION_SIZES',
      cooldownMs: 900000, // 15 minutes
      enabled: true
    });

    // Sharpe ratio deterioration
    this.addAlertRule({
      id: 'poor_sharpe',
      name: 'Poor Sharpe Ratio',
      condition: (risk) => risk.sharpeRatio <= -1.0,
      level: 'warning',
      message: 'Sharpe ratio indicates poor risk-adjusted returns',
      action: 'REVIEW_STRATEGY',
      cooldownMs: 3600000, // 1 hour
      enabled: true
    });

    logger.info(`[RiskAlerts] Initialized ${this.alertRules.size} default alert rules`);
  }

  addAlertRule(rule: AlertRule): void {
    this.alertRules.set(rule.id, rule);
    logger.info(`[RiskAlerts] Added rule: ${rule.name}`);
  }

  removeAlertRule(ruleId: string): boolean {
    const removed = this.alertRules.delete(ruleId);
    if (removed) {
      logger.info(`[RiskAlerts] Removed rule: ${ruleId}`);
    }
    return removed;
  }

  private startMonitoring(): void {
    // Monitor every 30 seconds
    this.monitoringInterval = setInterval(() => {
      this.checkAlertRules();
    }, 30000);
    
    logger.info('[RiskAlerts] Monitoring started');
  }

  private checkAlertRules(): void {
    try {
      const portfolioRisk = riskManagementService.getPortfolioRisk();
      
      for (const [ruleId, rule] of Array.from(this.alertRules.entries())) {
        if (!rule.enabled) continue;
        
        // Check cooldown
        const lastAlertTime = this.lastAlertTimes.get(ruleId) || 0;
        if (Date.now() - lastAlertTime < rule.cooldownMs) continue;
        
        // Check condition
        if (rule.condition(portfolioRisk)) {
          this.triggerAlert(rule, portfolioRisk);
        }
      }
      
    } catch (error) {
      logger.error('[RiskAlerts] Error checking alert rules:', error as Error);
    }
  }

  private triggerAlert(rule: AlertRule, portfolioRisk: PortfolioRisk): void {
    const alert: RiskAlert = {
      level: rule.level,
      type: rule.id as any,
      message: rule.message,
      timestamp: Date.now(),
      action: rule.action,
      metrics: {
        portfolioValue: portfolioRisk.totalValue,
        totalExposure: portfolioRisk.totalExposure,
        dailyPnL: portfolioRisk.dailyPnL,
        maxDrawdown: portfolioRisk.maxDrawdown,
        sharpeRatio: portfolioRisk.sharpeRatio,
        volatility: portfolioRisk.volatility,
        leverageRatio: portfolioRisk.leverageRatio
      }
    };
    
    // Store active alert
    this.activeAlerts.set(rule.id, alert);
    
    // Add to history
    this.alertHistory.push({
      alert,
      acknowledged: false,
      resolved: false
    });
    
    // Update last alert time
    this.lastAlertTimes.set(rule.id, Date.now());
    
    // Log alert
    logger.warn(`[RiskAlerts] ${rule.level.toUpperCase()}: ${rule.message}`, {
      action: rule.action,
      metrics: alert.metrics
    });
    
    // Emit alert event
    this.emit('riskAlert', alert);
    
    // Take automated action for emergency alerts
    if (rule.level === 'emergency') {
      this.executeEmergencyAction(rule.action);
    }
  }

  private executeEmergencyAction(action: string): void {
    logger.error(`[RiskAlerts] EMERGENCY ACTION: ${action}`);
    
    switch (action) {
      case 'STOP_ALL_TRADING':
        // Emit emergency stop event
        this.emit('emergencyStop', { reason: 'Daily loss limit exceeded' });
        break;
        
      case 'LIQUIDATE_ALL_POSITIONS':
        // Emit liquidation event
        this.emit('emergencyLiquidation', { reason: 'Risk limits exceeded' });
        break;
        
      default:
        logger.warn(`[RiskAlerts] Unknown emergency action: ${action}`);
    }
  }

  private onPositionChange(): void {
    // Force immediate risk check when positions change
    setTimeout(() => this.checkAlertRules(), 1000);
  }

  private onPositionExit(position: any, reason: string): void {
    if (reason === 'stop_loss') {
      const alert: RiskAlert = {
        level: 'warning',
        type: 'position_size',
        message: `Stop-loss triggered for ${position.symbol}`,
        timestamp: Date.now(),
        action: 'POSITION_CLOSED',
        position
      };
      
      this.alertHistory.push({
        alert,
        acknowledged: false,
        resolved: true,
        resolvedAt: Date.now()
      });
      
      this.emit('riskAlert', alert);
    }
  }

  acknowledgeAlert(ruleId: string, acknowledgedBy: string): boolean {
    const alert = this.activeAlerts.get(ruleId);
    if (!alert) return false;
    
    // Find in history and mark as acknowledged
    const historyEntry = this.alertHistory
      .slice()
      .reverse()
      .find(h => h.alert.type === ruleId && !h.acknowledged);
    
    if (historyEntry) {
      historyEntry.acknowledged = true;
      historyEntry.acknowledgedBy = acknowledgedBy;
      historyEntry.acknowledgedAt = Date.now();
      
      logger.info(`[RiskAlerts] Alert acknowledged: ${ruleId} by ${acknowledgedBy}`);
      return true;
    }
    
    return false;
  }

  resolveAlert(ruleId: string): boolean {
    const alert = this.activeAlerts.get(ruleId);
    if (!alert) return false;
    
    // Remove from active alerts
    this.activeAlerts.delete(ruleId);
    
    // Mark as resolved in history
    const historyEntry = this.alertHistory
      .slice()
      .reverse()
      .find(h => h.alert.type === ruleId && !h.resolved);
    
    if (historyEntry) {
      historyEntry.resolved = true;
      historyEntry.resolvedAt = Date.now();
      
      logger.info(`[RiskAlerts] Alert resolved: ${ruleId}`);
      return true;
    }
    
    return false;
  }

  getActiveAlerts(): RiskAlert[] {
    return Array.from(this.activeAlerts.values());
  }

  getAlertHistory(limit: number = 100): AlertHistory[] {
    return this.alertHistory
      .slice(-limit)
      .reverse();
  }

  getRiskDashboard(): {
    portfolioRisk: PortfolioRisk;
    activeAlerts: RiskAlert[];
    alertCounts: { warning: number; critical: number; emergency: number };
    recentAlerts: AlertHistory[];
  } {
    const portfolioRisk = riskManagementService.getPortfolioRisk();
    const activeAlerts = this.getActiveAlerts();
    
    const alertCounts = {
      warning: activeAlerts.filter(a => a.level === 'warning').length,
      critical: activeAlerts.filter(a => a.level === 'critical').length,
      emergency: activeAlerts.filter(a => a.level === 'emergency').length
    };
    
    const recentAlerts = this.getAlertHistory(20);
    
    return {
      portfolioRisk,
      activeAlerts,
      alertCounts,
      recentAlerts
    };
  }

  cleanup(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }
    
    this.removeAllListeners();
    logger.info('[RiskAlerts] Service cleaned up');
  }
}

// Singleton instance
export const riskAlertService = new RiskAlertService();