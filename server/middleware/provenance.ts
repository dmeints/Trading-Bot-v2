
import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { logger } from '../utils/logger';

interface ProvenanceRecord {
  id: string;
  hash: string;
  timestamp: number;
  endpoint: string;
  method: string;
  featureWindow?: any;
  context?: any;
  decision?: any;
  userId?: string;
  metadata?: Record<string, any>;
}

class ProvenanceTracker {
  private records: ProvenanceRecord[] = [];
  private maxRecords: number = 10000;

  generateHash(data: any): string {
    const serialized = JSON.stringify(data, Object.keys(data).sort());
    return crypto.createHash('sha256').update(serialized).digest('hex');
  }

  track(record: Omit<ProvenanceRecord, 'id' | 'timestamp'>): string {
    const id = `prov_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = Date.now();

    const provenanceRecord: ProvenanceRecord = {
      id,
      timestamp,
      ...record
    };

    this.records.push(provenanceRecord);

    // Maintain max records limit
    if (this.records.length > this.maxRecords) {
      this.records.shift();
    }

    logger.info(`[Provenance] Tracked decision`, {
      id,
      hash: record.hash,
      endpoint: record.endpoint
    });

    return id;
  }

  getRecords(limit: number = 50): ProvenanceRecord[] {
    return this.records.slice(-limit);
  }

  getRecord(id: string): ProvenanceRecord | null {
    return this.records.find(r => r.id === id) || null;
  }

  searchByHash(hash: string): ProvenanceRecord[] {
    return this.records.filter(r => r.hash === hash);
  }

  getStats(): Record<string, any> {
    const endpointCounts: Record<string, number> = {};
    const methodCounts: Record<string, number> = {};

    for (const record of this.records) {
      endpointCounts[record.endpoint] = (endpointCounts[record.endpoint] || 0) + 1;
      methodCounts[record.method] = (methodCounts[record.method] || 0) + 1;
    }

    return {
      totalRecords: this.records.length,
      maxRecords: this.maxRecords,
      endpointCounts,
      methodCounts,
      oldestRecord: this.records.length > 0 ? this.records[0].timestamp : null,
      newestRecord: this.records.length > 0 ? this.records[this.records.length - 1].timestamp : null
    };
  }
}

const provenanceTracker = new ProvenanceTracker();

export const provenanceMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // Store original end method
  const originalEnd = res.end;

  res.end = function(chunk?: any, encoding?: any, cb?: any) {
    // Only track specific endpoints that make decisions
    const shouldTrack = req.path.includes('/api/router/') || 
                       req.path.includes('/api/exec/') ||
                       req.path.includes('/api/strategy/');

    if (shouldTrack && res.statusCode < 400) {
      try {
        // Extract feature window and context from request
        const featureWindow = req.body?.features || (req as any).featureWindow;
        const context = req.body?.context || (req as any).context;
        const decision = chunk ? JSON.parse(chunk.toString()) : null;

        // Create hash of input data
        const hashData = {
          featureWindow,
          context,
          timestamp: Date.now(),
          endpoint: req.path,
          method: req.method
        };

        const hash = provenanceTracker.generateHash(hashData);

        // Track the decision
        provenanceTracker.track({
          hash,
          endpoint: req.path,
          method: req.method,
          featureWindow,
          context,
          decision,
          userId: (req as any).user?.id,
          metadata: {
            userAgent: req.get('User-Agent'),
            ip: req.ip,
            statusCode: res.statusCode
          }
        });

      } catch (error) {
        logger.warn('[Provenance] Failed to track decision', error);
      }
    }

    // Call original end method
    originalEnd.call(this, chunk, encoding, cb);
  };

  next();
};

export { provenanceTracker };
