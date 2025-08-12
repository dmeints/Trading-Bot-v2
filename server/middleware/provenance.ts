
import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import crypto from 'crypto';

interface ProvenanceRecord {
  id: string;
  timestamp: Date;
  endpoint: string;
  inputContext: any;
  strategyChoice?: any;
  uncertaintyWidth?: number;
  guardOutcome?: any;
  orderRequest?: any;
  executionResult?: any;
  contentHash: string;
  userId?: string;
}

class ProvenanceTracker {
  private static instance: ProvenanceTracker;
  private auditLogs: ProvenanceRecord[] = [];

  public static getInstance(): ProvenanceTracker {
    if (!ProvenanceTracker.instance) {
      ProvenanceTracker.instance = new ProvenanceTracker();
    }
    return ProvenanceTracker.instance;
  }

  captureProvenance(data: Partial<ProvenanceRecord>): string {
    const record: ProvenanceRecord = {
      id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`,
      timestamp: new Date(),
      endpoint: data.endpoint || 'unknown',
      inputContext: data.inputContext || {},
      strategyChoice: data.strategyChoice,
      uncertaintyWidth: data.uncertaintyWidth,
      guardOutcome: data.guardOutcome,
      orderRequest: data.orderRequest,
      executionResult: data.executionResult,
      contentHash: this.generateContentHash(data),
      userId: data.userId
    };

    this.auditLogs.push(record);
    
    // Keep only last 1000 records in memory
    if (this.auditLogs.length > 1000) {
      this.auditLogs = this.auditLogs.slice(-1000);
    }

    logger.info(`[Provenance] Captured audit record: ${record.id}`);
    return record.id;
  }

  private generateContentHash(data: any): string {
    const content = JSON.stringify(data, Object.keys(data).sort());
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  getAuditLogs(limit: number = 10): ProvenanceRecord[] {
    return this.auditLogs.slice(-limit).reverse();
  }

  getAuditById(id: string): ProvenanceRecord | undefined {
    return this.auditLogs.find(log => log.id === id);
  }
}

const provenanceTracker = ProvenanceTracker.getInstance();

export const provenanceMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // Capture request context
  const originalJson = res.json.bind(res);
  const requestContext = {
    method: req.method,
    url: req.url,
    body: req.body,
    query: req.query,
    timestamp: new Date(),
    userAgent: req.headers['user-agent'],
    ip: req.ip
  };

  // Override res.json to capture response
  res.json = function(data: any) {
    // Only capture provenance for execution endpoints
    if (req.url.includes('/exec/plan-and-execute')) {
      provenanceTracker.captureProvenance({
        endpoint: req.url,
        inputContext: requestContext,
        executionResult: data,
        userId: (req as any).user?.claims?.sub
      });
    }
    
    return originalJson(data);
  };

  next();
};

export { provenanceTracker };
