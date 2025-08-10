/**
 * Provenance Guard Middleware
 * Adds data provenance and anti-mock validation to API responses
 */

import { createHash } from 'crypto';

export interface ProvenanceMetadata {
  commit: string;
  generatedAt: string;
  datasetId?: string;
  sourceType: 'database' | 'external_api' | 'computation' | 'file_system';
  integrity?: {
    checksum: string;
    entropy: number;
    validationPassed: boolean;
  };
}

/**
 * Add provenance metadata to any data object
 */
export function addProvenance<T>(
  data: T, 
  sourceType: ProvenanceMetadata['sourceType'],
  datasetId?: string
): T & { provenance: ProvenanceMetadata } {
  
  const dataString = JSON.stringify(data);
  const checksum = createHash('sha256').update(dataString).digest('hex').slice(0, 12);
  
  // Calculate entropy (simplified - count unique characters / total)
  const uniqueChars = new Set(dataString).size;
  const entropy = uniqueChars / dataString.length;
  
  // Basic validation - check for obvious mock patterns
  const validationPassed = !containsMockPatterns(dataString);
  
  const provenance: ProvenanceMetadata = {
    commit: process.env.GIT_COMMIT || 'development',
    generatedAt: new Date().toISOString(),
    datasetId,
    sourceType,
    integrity: {
      checksum,
      entropy: Math.round(entropy * 1000) / 1000,
      validationPassed
    }
  };

  return {
    ...data,
    provenance
  };
}

/**
 * Check for common mock data patterns
 */
function containsMockPatterns(dataString: string): boolean {
  const mockPatterns = [
    /mock|fake|test|placeholder|example/i,
    /lorem ipsum/i,
    /foo|bar|baz/i,
    /123.*456.*789/,
    /pattern_\d+/,
    /sample|demo/i,
    /\$?0+(\.0+)?$/, // All zeros
    /9{3,}/, // Many 9s
    /1{3,}/, // Many 1s
    /null|undefined|NaN/i
  ];
  
  return mockPatterns.some(pattern => pattern.test(dataString));
}

/**
 * Validate data integrity using provenance metadata
 */
export function validateProvenance<T>(
  dataWithProvenance: T & { provenance: ProvenanceMetadata }
): { isValid: boolean; issues: string[] } {
  const issues: string[] = [];
  const { provenance, ...data } = dataWithProvenance;
  
  // Verify checksum
  const dataString = JSON.stringify(data);
  const expectedChecksum = createHash('sha256').update(dataString).digest('hex').slice(0, 12);
  
  if (provenance.integrity?.checksum !== expectedChecksum) {
    issues.push('Data integrity checksum mismatch');
  }
  
  // Check entropy (too low suggests synthetic data)
  if (provenance.integrity?.entropy && provenance.integrity.entropy < 0.1) {
    issues.push('Data entropy too low - possible synthetic data');
  }
  
  // Check validation flag
  if (provenance.integrity?.validationPassed === false) {
    issues.push('Data failed mock pattern validation');
  }
  
  // Check timestamp recency for external data
  if (provenance.sourceType === 'external_api') {
    const generatedAt = new Date(provenance.generatedAt);
    const ageMs = Date.now() - generatedAt.getTime();
    const ageHours = ageMs / (1000 * 60 * 60);
    
    if (ageHours > 24) {
      issues.push(`Data is ${Math.round(ageHours)}h old - may be stale`);
    }
  }
  
  return {
    isValid: issues.length === 0,
    issues
  };
}

/**
 * Runtime scan for mock data infiltration
 */
export function scanForMockData(obj: any, path = ''): Array<{ path: string; issue: string }> {
  const issues: Array<{ path: string; issue: string }> = [];
  
  if (obj === null || obj === undefined) {
    return issues;
  }
  
  if (typeof obj === 'string') {
    if (containsMockPatterns(obj)) {
      issues.push({ path, issue: `Mock pattern detected: "${obj}"` });
    }
  } else if (typeof obj === 'number') {
    // Check for obvious mock numbers
    if (obj === 123 || obj === 456 || obj === 999 || obj === 0) {
      issues.push({ path, issue: `Suspicious mock number: ${obj}` });
    }
  } else if (Array.isArray(obj)) {
    obj.forEach((item, index) => {
      issues.push(...scanForMockData(item, `${path}[${index}]`));
    });
  } else if (typeof obj === 'object') {
    Object.keys(obj).forEach(key => {
      issues.push(...scanForMockData(obj[key], path ? `${path}.${key}` : key));
    });
  }
  
  return issues;
}

/**
 * Express middleware to add provenance to response
 */
export function provenanceMiddleware(sourceType: ProvenanceMetadata['sourceType']) {
  return (req: any, res: any, next: any) => {
    const originalJson = res.json;
    
    res.json = function(data: any) {
      const dataWithProvenance = addProvenance(data, sourceType);
      return originalJson.call(this, dataWithProvenance);
    };
    
    next();
  };
}