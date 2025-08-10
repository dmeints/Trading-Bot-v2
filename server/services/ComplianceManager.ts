import { logger } from '../utils/logger.js';
import { EventEmitter } from 'events';
import crypto from 'crypto';

interface ComplianceEvent {
  id: string;
  timestamp: Date;
  eventType: 'trade' | 'order' | 'position' | 'access' | 'system';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  details: Record<string, any>;
  userId?: string;
  resolved: boolean;
  resolvedAt?: Date;
  resolvedBy?: string;
}

interface AuditRecord {
  id: string;
  timestamp: Date;
  action: string;
  resource: string;
  userId: string;
  ipAddress: string;
  userAgent: string;
  details: Record<string, any>;
  hash: string; // Tamper-proof hash
  previousHash?: string; // Chain integrity
}

interface TradeSurveillanceRule {
  id: string;
  name: string;
  description: string;
  ruleType: 'volume' | 'price' | 'frequency' | 'concentration' | 'timing';
  parameters: Record<string, any>;
  severity: 'low' | 'medium' | 'high' | 'critical';
  enabled: boolean;
  createdAt: Date;
}

interface SurveillanceAlert {
  id: string;
  ruleId: string;
  ruleName: string;
  timestamp: Date;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  affectedTrades: string[];
  riskScore: number;
  status: 'open' | 'investigating' | 'closed' | 'false_positive';
  assignedTo?: string;
  resolvedAt?: Date;
}

interface RegulatoryReport {
  id: string;
  reportType: 'daily_trading' | 'position_report' | 'risk_metrics' | 'client_activity';
  period: {
    startDate: Date;
    endDate: Date;
  };
  generatedAt: Date;
  generatedBy: string;
  status: 'pending' | 'generated' | 'submitted' | 'acknowledged';
  data: Record<string, any>;
  fileHash: string;
  submittedAt?: Date;
}

interface UserRole {
  id: string;
  name: string;
  permissions: string[];
  description: string;
}

interface UserAccess {
  userId: string;
  roles: string[];
  permissions: string[];
  lastLogin: Date;
  loginAttempts: number;
  locked: boolean;
  mfaEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class ComplianceManager extends EventEmitter {
  private complianceEvents: Map<string, ComplianceEvent>;
  private auditTrail: AuditRecord[];
  private surveillanceRules: Map<string, TradeSurveillanceRule>;
  private surveillanceAlerts: Map<string, SurveillanceAlert>;
  private regulatoryReports: Map<string, RegulatoryReport>;
  private userRoles: Map<string, UserRole>;
  private userAccess: Map<string, UserAccess>;
  private lastAuditHash: string;

  constructor() {
    super();
    this.complianceEvents = new Map();
    this.auditTrail = [];
    this.surveillanceRules = new Map();
    this.surveillanceAlerts = new Map();
    this.regulatoryReports = new Map();
    this.userRoles = new Map();
    this.userAccess = new Map();
    this.lastAuditHash = '';

    this.initializeDefaultRoles();
    this.initializeSurveillanceRules();

    logger.info('[ComplianceManager] Initialized with comprehensive compliance and surveillance capabilities');
  }

  private initializeDefaultRoles(): void {
    const defaultRoles: UserRole[] = [
      {
        id: 'admin',
        name: 'Administrator',
        permissions: [
          'system:admin', 'trading:full', 'portfolio:full', 'compliance:full',
          'reports:full', 'users:full', 'api:full'
        ],
        description: 'Full system administration access'
      },
      {
        id: 'trader',
        name: 'Trader',
        permissions: [
          'trading:execute', 'portfolio:view', 'portfolio:manage',
          'market:view', 'reports:trading'
        ],
        description: 'Trading execution and portfolio management'
      },
      {
        id: 'analyst',
        name: 'Analyst',
        permissions: [
          'trading:view', 'portfolio:view', 'market:view',
          'reports:view', 'analytics:view'
        ],
        description: 'Market analysis and reporting access'
      },
      {
        id: 'compliance',
        name: 'Compliance Officer',
        permissions: [
          'compliance:full', 'reports:compliance', 'surveillance:view',
          'audit:view', 'trading:view', 'portfolio:view'
        ],
        description: 'Compliance monitoring and regulatory reporting'
      },
      {
        id: 'viewer',
        name: 'Viewer',
        permissions: [
          'trading:view', 'portfolio:view', 'market:view'
        ],
        description: 'Read-only access to trading information'
      }
    ];

    for (const role of defaultRoles) {
      this.userRoles.set(role.id, role);
    }
  }

  private initializeSurveillanceRules(): void {
    const defaultRules: TradeSurveillanceRule[] = [
      {
        id: 'high_volume_trading',
        name: 'High Volume Trading',
        description: 'Detects unusually high trading volume in short periods',
        ruleType: 'volume',
        parameters: {
          thresholdMultiplier: 5, // 5x normal volume
          timeWindow: 300, // 5 minutes
          minVolume: 100000 // $100k minimum
        },
        severity: 'medium',
        enabled: true,
        createdAt: new Date()
      },
      {
        id: 'price_manipulation',
        name: 'Price Manipulation Detection',
        description: 'Identifies potential price manipulation patterns',
        ruleType: 'price',
        parameters: {
          priceImpact: 0.05, // 5% price impact
          timeWindow: 60, // 1 minute
          minTradeSize: 50000 // $50k minimum
        },
        severity: 'high',
        enabled: true,
        createdAt: new Date()
      },
      {
        id: 'rapid_fire_trading',
        name: 'Rapid Fire Trading',
        description: 'Detects excessive trading frequency',
        ruleType: 'frequency',
        parameters: {
          maxTradesPerMinute: 10,
          consecutiveMinutes: 5
        },
        severity: 'medium',
        enabled: true,
        createdAt: new Date()
      },
      {
        id: 'position_concentration',
        name: 'Position Concentration Risk',
        description: 'Monitors for excessive position concentration',
        ruleType: 'concentration',
        parameters: {
          maxSingleAssetPercent: 0.25, // 25%
          maxSectorPercent: 0.40 // 40%
        },
        severity: 'high',
        enabled: true,
        createdAt: new Date()
      },
      {
        id: 'after_hours_trading',
        name: 'After Hours Trading',
        description: 'Monitors trading activity outside normal hours',
        ruleType: 'timing',
        parameters: {
          normalHours: { start: 9, end: 16 }, // 9 AM - 4 PM UTC
          suspiciousVolume: 10000 // $10k threshold
        },
        severity: 'low',
        enabled: true,
        createdAt: new Date()
      }
    ];

    for (const rule of defaultRules) {
      this.surveillanceRules.set(rule.id, rule);
    }
  }

  async recordAuditEvent(
    action: string,
    resource: string,
    userId: string,
    details: Record<string, any> = {},
    ipAddress: string = 'unknown',
    userAgent: string = 'unknown'
  ): Promise<void> {
    const id = crypto.randomUUID();
    const timestamp = new Date();

    // Create tamper-proof hash
    const dataToHash = `${id}:${timestamp.toISOString()}:${action}:${resource}:${userId}:${JSON.stringify(details)}:${this.lastAuditHash}`;
    const hash = crypto.createHash('sha256').update(dataToHash).digest('hex');

    const auditRecord: AuditRecord = {
      id,
      timestamp,
      action,
      resource,
      userId,
      ipAddress,
      userAgent,
      details,
      hash,
      previousHash: this.lastAuditHash || undefined
    };

    this.auditTrail.push(auditRecord);
    this.lastAuditHash = hash;

    // Emit event for real-time monitoring
    this.emit('auditEvent', auditRecord);

    logger.info('[ComplianceManager] Audit event recorded:', {
      id,
      action,
      resource,
      userId
    });
  }

  async recordComplianceEvent(
    eventType: ComplianceEvent['eventType'],
    severity: ComplianceEvent['severity'],
    description: string,
    details: Record<string, any> = {},
    userId?: string
  ): Promise<string> {
    const id = crypto.randomUUID();
    const timestamp = new Date();

    const complianceEvent: ComplianceEvent = {
      id,
      timestamp,
      eventType,
      severity,
      description,
      details,
      userId,
      resolved: false
    };

    this.complianceEvents.set(id, complianceEvent);

    // Auto-escalate critical events
    if (severity === 'critical') {
      await this.escalateEvent(id);
    }

    this.emit('complianceEvent', complianceEvent);

    logger.warn('[ComplianceManager] Compliance event recorded:', {
      id,
      eventType,
      severity,
      description
    });

    return id;
  }

  async runTradeSurveillance(tradeData: {
    tradeId: string;
    userId: string;
    symbol: string;
    quantity: number;
    price: number;
    value: number;
    timestamp: Date;
    orderType: string;
  }): Promise<SurveillanceAlert[]> {
    const alerts: SurveillanceAlert[] = [];

    for (const [ruleId, rule] of this.surveillanceRules.entries()) {
      if (!rule.enabled) continue;

      const violationDetected = await this.evaluateSurveillanceRule(rule, tradeData);
      
      if (violationDetected) {
        const alertId = crypto.randomUUID();
        const alert: SurveillanceAlert = {
          id: alertId,
          ruleId,
          ruleName: rule.name,
          timestamp: new Date(),
          severity: rule.severity,
          description: `${rule.name}: ${violationDetected.description}`,
          affectedTrades: [tradeData.tradeId],
          riskScore: violationDetected.riskScore,
          status: 'open'
        };

        this.surveillanceAlerts.set(alertId, alert);
        alerts.push(alert);

        // Record compliance event
        await this.recordComplianceEvent(
          'trade',
          rule.severity,
          `Trade surveillance alert: ${rule.name}`,
          { 
            alertId,
            tradeId: tradeData.tradeId,
            ruleId,
            riskScore: violationDetected.riskScore
          },
          tradeData.userId
        );

        logger.warn('[ComplianceManager] Surveillance alert generated:', {
          alertId,
          ruleName: rule.name,
          severity: rule.severity,
          tradeId: tradeData.tradeId
        });
      }
    }

    return alerts;
  }

  private async evaluateSurveillanceRule(
    rule: TradeSurveillanceRule,
    tradeData: any
  ): Promise<{ description: string; riskScore: number } | null> {
    switch (rule.ruleType) {
      case 'volume':
        return this.evaluateVolumeRule(rule, tradeData);
      case 'price':
        return this.evaluatePriceRule(rule, tradeData);
      case 'frequency':
        return this.evaluateFrequencyRule(rule, tradeData);
      case 'concentration':
        return this.evaluateConcentrationRule(rule, tradeData);
      case 'timing':
        return this.evaluateTimingRule(rule, tradeData);
      default:
        return null;
    }
  }

  private async evaluateVolumeRule(
    rule: TradeSurveillanceRule,
    tradeData: any
  ): Promise<{ description: string; riskScore: number } | null> {
    const { thresholdMultiplier, timeWindow, minVolume } = rule.parameters;
    
    if (tradeData.value < minVolume) return null;

    // Simulate historical volume comparison
    const avgVolume = 20000; // Simulated average volume
    const volumeRatio = tradeData.value / avgVolume;

    if (volumeRatio > thresholdMultiplier) {
      return {
        description: `Trade volume ${volumeRatio.toFixed(1)}x higher than normal average`,
        riskScore: Math.min(volumeRatio * 10, 100)
      };
    }

    return null;
  }

  private async evaluatePriceRule(
    rule: TradeSurveillanceRule,
    tradeData: any
  ): Promise<{ description: string; riskScore: number } | null> {
    const { priceImpact, minTradeSize } = rule.parameters;
    
    if (tradeData.value < minTradeSize) return null;

    // Simulate market price comparison
    const marketPrice = tradeData.price * (1 + (Math.random() - 0.5) * 0.001); // ±0.1% from trade price
    const impactPercent = Math.abs(tradeData.price - marketPrice) / marketPrice;

    if (impactPercent > priceImpact) {
      return {
        description: `Trade price deviates ${(impactPercent * 100).toFixed(2)}% from market price`,
        riskScore: impactPercent * 200
      };
    }

    return null;
  }

  private async evaluateFrequencyRule(
    rule: TradeSurveillanceRule,
    tradeData: any
  ): Promise<{ description: string; riskScore: number } | null> {
    // Simulate trade frequency analysis
    const tradesLastMinute = Math.floor(Math.random() * 15); // Simulated recent trades
    const { maxTradesPerMinute } = rule.parameters;

    if (tradesLastMinute > maxTradesPerMinute) {
      return {
        description: `${tradesLastMinute} trades in last minute exceeds limit of ${maxTradesPerMinute}`,
        riskScore: (tradesLastMinute / maxTradesPerMinute) * 50
      };
    }

    return null;
  }

  private async evaluateConcentrationRule(
    rule: TradeSurveillanceRule,
    tradeData: any
  ): Promise<{ description: string; riskScore: number } | null> {
    // Simulate position concentration analysis
    const portfolioValue = 1000000; // $1M portfolio
    const assetAllocation = tradeData.value / portfolioValue;
    const { maxSingleAssetPercent } = rule.parameters;

    if (assetAllocation > maxSingleAssetPercent) {
      return {
        description: `Asset allocation ${(assetAllocation * 100).toFixed(1)}% exceeds limit of ${(maxSingleAssetPercent * 100).toFixed(1)}%`,
        riskScore: (assetAllocation / maxSingleAssetPercent) * 60
      };
    }

    return null;
  }

  private async evaluateTimingRule(
    rule: TradeSurveillanceRule,
    tradeData: any
  ): Promise<{ description: string; riskScore: number } | null> {
    const { normalHours, suspiciousVolume } = rule.parameters;
    const tradeHour = tradeData.timestamp.getUTCHours();

    if ((tradeHour < normalHours.start || tradeHour > normalHours.end) && 
        tradeData.value > suspiciousVolume) {
      return {
        description: `Large trade (${tradeData.value.toLocaleString()}) executed outside normal hours`,
        riskScore: 25
      };
    }

    return null;
  }

  async generateRegulatoryReport(
    reportType: RegulatoryReport['reportType'],
    startDate: Date,
    endDate: Date,
    generatedBy: string
  ): Promise<string> {
    const reportId = crypto.randomUUID();
    
    // Generate report data based on type
    let reportData: Record<string, any> = {};
    
    switch (reportType) {
      case 'daily_trading':
        reportData = await this.generateDailyTradingReport(startDate, endDate);
        break;
      case 'position_report':
        reportData = await this.generatePositionReport();
        break;
      case 'risk_metrics':
        reportData = await this.generateRiskMetricsReport();
        break;
      case 'client_activity':
        reportData = await this.generateClientActivityReport(startDate, endDate);
        break;
    }

    // Create hash for integrity
    const dataHash = crypto.createHash('sha256')
      .update(JSON.stringify(reportData))
      .digest('hex');

    const report: RegulatoryReport = {
      id: reportId,
      reportType,
      period: { startDate, endDate },
      generatedAt: new Date(),
      generatedBy,
      status: 'generated',
      data: reportData,
      fileHash: dataHash
    };

    this.regulatoryReports.set(reportId, report);

    // Record audit event
    await this.recordAuditEvent(
      'generate_report',
      'regulatory_report',
      generatedBy,
      { reportId, reportType, period: { startDate, endDate } }
    );

    logger.info('[ComplianceManager] Regulatory report generated:', {
      reportId,
      reportType,
      generatedBy
    });

    return reportId;
  }

  private async generateDailyTradingReport(startDate: Date, endDate: Date): Promise<Record<string, any>> {
    return {
      summary: {
        totalTrades: 125,
        totalVolume: 2450000,
        uniqueAssets: 8,
        avgTradeSize: 19600
      },
      trades: [
        {
          timestamp: new Date().toISOString(),
          symbol: 'BTC',
          quantity: 1.5,
          price: 65000,
          value: 97500,
          side: 'buy'
        }
        // Additional trades would be included
      ],
      compliance: {
        alertsGenerated: 3,
        rulesTriggered: ['high_volume_trading', 'after_hours_trading'],
        riskScore: 15.5
      }
    };
  }

  private async generatePositionReport(): Promise<Record<string, any>> {
    return {
      timestamp: new Date().toISOString(),
      positions: [
        {
          symbol: 'BTC',
          quantity: 15.5,
          marketValue: 1007500,
          allocation: 0.45,
          unrealizedPnL: 25000
        },
        {
          symbol: 'ETH',
          quantity: 85.2,
          marketValue: 298200,
          allocation: 0.35,
          unrealizedPnL: -5500
        }
      ],
      summary: {
        totalValue: 2240000,
        totalPnL: 45500,
        riskMetrics: {
          var95: -67200,
          volatility: 0.045,
          beta: 1.15
        }
      }
    };
  }

  private async generateRiskMetricsReport(): Promise<Record<string, any>> {
    return {
      timestamp: new Date().toISOString(),
      portfolio: {
        value: 2240000,
        var95: -67200,
        cvar95: -89600,
        volatility: 0.045,
        sharpeRatio: 1.35,
        maxDrawdown: -0.12
      },
      limits: {
        positionLimits: {
          singleAsset: 0.25,
          sector: 0.40,
          overall: 1.0
        },
        riskLimits: {
          var95: -100000,
          maxDrawdown: -0.15,
          leverage: 2.0
        }
      },
      violations: []
    };
  }

  private async generateClientActivityReport(startDate: Date, endDate: Date): Promise<Record<string, any>> {
    return {
      period: { startDate, endDate },
      clients: [
        {
          clientId: 'client_001',
          tradesCount: 45,
          totalVolume: 890000,
          avgTradeSize: 19778,
          pnl: 25500,
          riskScore: 12.5
        }
      ],
      summary: {
        totalClients: 1,
        totalTrades: 45,
        totalVolume: 890000,
        compliance: {
          alerts: 1,
          investigations: 0,
          violations: 0
        }
      }
    };
  }

  async createUserAccess(
    userId: string,
    roles: string[],
    additionalPermissions: string[] = []
  ): Promise<void> {
    // Validate roles exist
    for (const roleId of roles) {
      if (!this.userRoles.has(roleId)) {
        throw new Error(`Role '${roleId}' does not exist`);
      }
    }

    // Compile permissions from roles
    const rolePermissions = roles.flatMap(roleId => 
      this.userRoles.get(roleId)?.permissions || []
    );

    const allPermissions = [...new Set([...rolePermissions, ...additionalPermissions])];

    const userAccess: UserAccess = {
      userId,
      roles,
      permissions: allPermissions,
      lastLogin: new Date(),
      loginAttempts: 0,
      locked: false,
      mfaEnabled: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.userAccess.set(userId, userAccess);

    await this.recordAuditEvent(
      'create_user_access',
      'user_access',
      'system',
      { userId, roles, permissions: allPermissions.length }
    );

    logger.info('[ComplianceManager] User access created:', {
      userId,
      roles,
      permissionsCount: allPermissions.length
    });
  }

  async checkPermission(userId: string, permission: string): Promise<boolean> {
    const userAccess = this.userAccess.get(userId);
    if (!userAccess || userAccess.locked) {
      return false;
    }

    return userAccess.permissions.includes(permission) || 
           userAccess.permissions.includes('system:admin');
  }

  private async escalateEvent(eventId: string): Promise<void> {
    const event = this.complianceEvents.get(eventId);
    if (!event) return;

    // Simulate escalation to compliance team
    logger.error('[ComplianceManager] CRITICAL EVENT ESCALATED:', {
      eventId,
      description: event.description,
      timestamp: event.timestamp
    });

    this.emit('criticalEvent', event);
  }

  // Getters for data access
  getComplianceEvents(): ComplianceEvent[] {
    return Array.from(this.complianceEvents.values());
  }

  getAuditTrail(limit: number = 100): AuditRecord[] {
    return this.auditTrail.slice(-limit);
  }

  getSurveillanceAlerts(): SurveillanceAlert[] {
    return Array.from(this.surveillanceAlerts.values());
  }

  getRegulatoryReports(): RegulatoryReport[] {
    return Array.from(this.regulatoryReports.values());
  }

  getUserRoles(): UserRole[] {
    return Array.from(this.userRoles.values());
  }

  getSurveillanceRules(): TradeSurveillanceRule[] {
    return Array.from(this.surveillanceRules.values());
  }

  async verifyAuditIntegrity(): Promise<{ valid: boolean; issues: string[] }> {
    const issues: string[] = [];
    let previousHash = '';

    for (let i = 0; i < this.auditTrail.length; i++) {
      const record = this.auditTrail[i];
      
      // Verify hash chain
      if (record.previousHash !== previousHash) {
        issues.push(`Hash chain broken at record ${i}: expected ${previousHash}, got ${record.previousHash}`);
      }

      // Verify record hash
      const expectedHash = crypto.createHash('sha256')
        .update(`${record.id}:${record.timestamp.toISOString()}:${record.action}:${record.resource}:${record.userId}:${JSON.stringify(record.details)}:${previousHash}`)
        .digest('hex');

      if (record.hash !== expectedHash) {
        issues.push(`Record hash mismatch at ${i}: record may have been tampered with`);
      }

      previousHash = record.hash;
    }

    return {
      valid: issues.length === 0,
      issues
    };
  }
}