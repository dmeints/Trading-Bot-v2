import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

export interface ProvenanceRecord {
  id: string;
  timestamp: Date;
  endpoint: string;
  inputHash: string;
  outputHash: string;
  context?: any;
  policyId?: string;
  order?: any;
}

export const provenanceMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const originalJson = res.json.bind(res);

  res.json = function(data: any) {
    const inputHash = crypto.createHash('sha256')
      .update(JSON.stringify(req.body || {}))
      .digest('hex');

    const outputHash = crypto.createHash('sha256')
      .update(JSON.stringify(data))
      .digest('hex');

    // Store provenance record (stub)
    const record: ProvenanceRecord = {
      id: `prov_${Date.now()}`,
      timestamp: new Date(),
      endpoint: req.path,
      inputHash,
      outputHash,
      context: req.body?.context,
      policyId: data?.policyId,
      order: data?.order
    };

    return originalJson(data);
  };

  next();
};