/**
 * Provenance Guard Middleware
 * Ensures all API responses include data provenance
 */

import { Request, Response, NextFunction } from "express";
import { logger } from "../utils/logger";

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

export async function validateProvenance(): Promise<boolean> {
  try {
    // Check for mock data fingerprints
    const mockScanResult = await runMockScan();
    if (!mockScanResult.passed) {
      logger.error('[ProvenanceGuard] Mock data detected', mockScanResult.issues);
      return false;
    }

    // Validate external data source connectivity
    const connectivityCheck = await validateDataSources();
    if (!connectivityCheck.passed) {
      logger.error('[ProvenanceGuard] Data source validation failed', connectivityCheck.failures);
      return false;
    }

    logger.info('[ProvenanceGuard] Provenance validation passed');
    return true;
  } catch (error) {
    logger.error('[ProvenanceGuard] Validation error', { error });
    return false;
  }
}

async function runMockScan(): Promise<{ passed: boolean; issues: string[] }> {
  const { spawnSync } = await import('child_process');
  const result = spawnSync('node', ['tools/audit_mock_scan.js'], {
    stdio: 'pipe',
    encoding: 'utf8'
  });

  return {
    passed: result.status === 0,
    issues: result.status !== 0 ? [result.stderr || result.stdout] : []
  };
}

async function validateDataSources(): Promise<{ passed: boolean; failures: string[] }> {
  const failures: string[] = [];

  // Check critical data sources
  const sources = [
    { name: 'binance', url: 'https://api.binance.com/api/v3/time' },
    { name: 'coingecko', url: 'https://api.coingecko.com/api/v3/ping' }
  ];

  for (const source of sources) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(source.url, {
        method: 'GET',
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        failures.push(`${source.name}: HTTP ${response.status}`);
      }
    } catch (error) {
      failures.push(`${source.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  return {
    passed: failures.length === 0,
    failures
  };
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