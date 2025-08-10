
/**
 * Phase 5 - Live Deployment Validator
 * Ensures system is ready for live trading deployment
 */

import { paperTradeBridge, PaperTradeBridge } from './paperTradeBridge';
import { logger } from '../utils/logger';

export class LiveDeploymentValidator {
  private paperTradeBridge: PaperTradeBridge;
  private validationResults: Map<string, boolean> = new Map();

  constructor() {
    this.paperTradeBridge = paperTradeBridge;
  }

  async validateLiveReadiness(): Promise<{
    isReady: boolean;
    checks: Record<string, { passed: boolean; details: string }>;
    recommendations: string[];
  }> {
    const checks: Record<string, { passed: boolean; details: string }> = {};
    const recommendations: string[] = [];

    // 1. Paper Trading Burn-in Validation
    const burnInReport = await this.paperTradeBridge.getBurnInReport();
    checks.paperTradingBurnIn = {
      passed: burnInReport.validation.hasMinimumTrades && 
              burnInReport.validation.hasPositiveWinRate && 
              burnInReport.validation.parityAcceptable,
      details: `${burnInReport.totalTrades} trades, ${(burnInReport.winRate * 100).toFixed(1)}% win rate, ${(burnInReport.parityScore * 100).toFixed(1)}% parity`
    };

    if (!checks.paperTradingBurnIn.passed) {
      recommendations.push('Complete additional paper trading to meet minimum requirements');
    }

    // 2. Risk Controls Validation
    checks.riskControls = await this.validateRiskControls();
    if (!checks.riskControls.passed) {
      recommendations.push('Configure and test all risk control mechanisms');
    }

    // 3. API Connectivity Validation
    checks.apiConnectivity = await this.validateApiConnectivity();
    if (!checks.apiConnectivity.passed) {
      recommendations.push('Ensure all external API connections are stable and authenticated');
    }

    // 4. Database Health Validation
    checks.databaseHealth = await this.validateDatabaseHealth();
    if (!checks.databaseHealth.passed) {
      recommendations.push('Resolve database connectivity or performance issues');
    }

    // 5. Monitoring Systems Validation
    checks.monitoringSystems = await this.validateMonitoringSystems();
    if (!checks.monitoringSystems.passed) {
      recommendations.push('Set up comprehensive monitoring and alerting systems');
    }

    // 6. Emergency Controls Validation
    checks.emergencyControls = await this.validateEmergencyControls();
    if (!checks.emergencyControls.passed) {
      recommendations.push('Test and verify all emergency stop mechanisms');
    }

    // 7. Compliance Checks Validation
    checks.complianceChecks = await this.validateComplianceChecks();
    if (!checks.complianceChecks.passed) {
      recommendations.push('Complete compliance audit and documentation');
    }

    const isReady = Object.values(checks).every(check => check.passed);

    logger.log({
      timestamp: new Date().toISOString(),
      method: 'SYSTEM',
      url: '/live-deployment-validation',
      ip: 'system',
      userAgent: 'LiveDeploymentValidator'
    });

    return {
      isReady,
      checks,
      recommendations
    };
  }

  private async validateRiskControls(): Promise<{ passed: boolean; details: string }> {
    try {
      // Check if risk management systems are active
      const response = await fetch('http://localhost:5000/api/portfolio/risk-metrics');
      if (!response.ok) {
        throw new Error('Risk metrics endpoint not responding');
      }

      const riskData = await response.json();
      const hasRiskLimits = riskData.data && 
                           typeof riskData.data.maxPositionSize === 'number' &&
                           typeof riskData.data.maxDailyLoss === 'number';

      return {
        passed: hasRiskLimits,
        details: hasRiskLimits ? 'Risk controls active with position and loss limits' : 'Risk controls not properly configured'
      };
    } catch (error) {
      return {
        passed: false,
        details: `Risk control validation failed: ${error}`
      };
    }
  }

  private async validateApiConnectivity(): Promise<{ passed: boolean; details: string }> {
    try {
      const response = await fetch('http://localhost:5000/api/connectors/status');
      if (!response.ok) {
        throw new Error('Connectors status endpoint not responding');
      }

      const connectorsData = await response.json();
      const activeConnectors = connectorsData.data?.filter((c: any) => c.status === 'connected').length || 0;

      return {
        passed: activeConnectors >= 5, // Minimum 5 active data sources
        details: `${activeConnectors} active connectors out of required minimum 5`
      };
    } catch (error) {
      return {
        passed: false,
        details: `API connectivity validation failed: ${error}`
      };
    }
  }

  private async validateDatabaseHealth(): Promise<{ passed: boolean; details: string }> {
    try {
      const response = await fetch('http://localhost:5000/api/health');
      if (!response.ok) {
        throw new Error('Health endpoint not responding');
      }

      const healthData = await response.json();
      const dbHealthy = healthData.database === 'healthy';

      return {
        passed: dbHealthy,
        details: dbHealthy ? 'Database connection and performance optimal' : 'Database issues detected'
      };
    } catch (error) {
      return {
        passed: false,
        details: `Database health validation failed: ${error}`
      };
    }
  }

  private async validateMonitoringSystems(): Promise<{ passed: boolean; details: string }> {
    try {
      const response = await fetch('http://localhost:5000/api/system/monitoring/status');
      if (!response.ok) {
        throw new Error('Monitoring status endpoint not responding');
      }

      const monitoringData = await response.json();
      const alertsConfigured = monitoringData.data?.alerts?.configured || false;
      const metricsActive = monitoringData.data?.metrics?.active || false;

      return {
        passed: alertsConfigured && metricsActive,
        details: `Alerts: ${alertsConfigured ? 'configured' : 'missing'}, Metrics: ${metricsActive ? 'active' : 'inactive'}`
      };
    } catch (error) {
      return {
        passed: false,
        details: `Monitoring systems validation failed: ${error}`
      };
    }
  }

  private async validateEmergencyControls(): Promise<{ passed: boolean; details: string }> {
    try {
      // Test emergency controls without actually triggering them
      const response = await fetch('http://localhost:5000/api/trading/emergency/status');
      if (!response.ok) {
        throw new Error('Emergency controls endpoint not responding');
      }

      const emergencyData = await response.json();
      const killSwitchAvailable = emergencyData.data?.killSwitch?.available || false;
      const positionClosingReady = emergencyData.data?.positionClosing?.ready || false;

      return {
        passed: killSwitchAvailable && positionClosingReady,
        details: `Kill switch: ${killSwitchAvailable ? 'available' : 'missing'}, Position closing: ${positionClosingReady ? 'ready' : 'not ready'}`
      };
    } catch (error) {
      return {
        passed: false,
        details: `Emergency controls validation failed: ${error}`
      };
    }
  }

  private async validateComplianceChecks(): Promise<{ passed: boolean; details: string }> {
    try {
      const response = await fetch('http://localhost:5000/api/compliance/audit-status');
      if (!response.ok) {
        throw new Error('Compliance audit endpoint not responding');
      }

      const complianceData = await response.json();
      const auditTrailActive = complianceData.data?.auditTrail?.active || false;
      const surveillanceRules = complianceData.data?.surveillance?.rulesActive || 0;

      return {
        passed: auditTrailActive && surveillanceRules >= 3,
        details: `Audit trail: ${auditTrailActive ? 'active' : 'inactive'}, Surveillance rules: ${surveillanceRules}/3 minimum`
      };
    } catch (error) {
      return {
        passed: false,
        details: `Compliance validation failed: ${error}`
      };
    }
  }

  async generateLiveDeploymentReport(): Promise<string> {
    const validation = await this.validateLiveReadiness();
    const timestamp = new Date().toISOString();
    
    const reportPath = `./artifacts/live-deployment-report-${Date.now()}.json`;
    const report = {
      timestamp,
      validation,
      systemInfo: {
        nodeVersion: process.version,
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage()
      }
    };

    const fs = await import('fs/promises');
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));

    return reportPath;
  }
}

export const liveDeploymentValidator = new LiveDeploymentValidator();
