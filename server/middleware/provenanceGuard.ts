/**
 * Provenance Guard Middleware
 * Ensures all API responses include data provenance
 */

import { Request, Response, NextFunction } from "express";

export function requireProvenance(req: Request, res: Response, next: NextFunction) {
  const send = res.json.bind(res);
  
  res.json = (body: any) => {
    const ok = body && (body.provenance || (body.headline && body.provenance));
    
    if (!ok) {
      res.status(500);
      return send({
        error: "Missing provenance",
        path: req.path,
        timestamp: new Date().toISOString()
      });
    }
    
    return send(body);
  };
  
  next();
}

export function addProvenance(data: any, options: { 
  runId?: string; 
  datasetId?: string; 
  commit?: string; 
} = {}): any {
  return {
    ...data,
    provenance: {
      runId: options.runId,
      datasetId: options.datasetId,
      commit: options.commit || 'dev-' + Date.now(),
      generatedAt: new Date().toISOString()
    }
  };
}

export function validateProvenance(data: any): boolean {
  return data && data.provenance && data.provenance.generatedAt;
}

export function scanForMockData(data: any): string[] {
  const mockPatterns = [
    /mock/i, /faker/i, /dummy/i, /stub/i, /sample/i, /lorem/i
  ];
  
  const violations: string[] = [];
  const dataStr = JSON.stringify(data);
  
  for (const pattern of mockPatterns) {
    if (pattern.test(dataStr)) {
      violations.push(`Pattern ${pattern} found in data`);
    }
  }
  
  return violations;
}