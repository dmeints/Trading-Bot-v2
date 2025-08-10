/**
 * Anti-Mock Audit Tools
 * Detects and prevents fabricated/mock data infiltration
 */

import { createHash } from 'crypto';

export interface ProvenanceCheck {
  datasetId: string;
  commit: string;
  timestamp: string;
  source: 'api' | 'database' | 'calculation';
  hash: string;
  valid: boolean;
  reason?: string;
}

export interface MockScanResult {
  suspicious: boolean;
  confidence: number;
  flags: MockFlag[];
  entropy: number;
  patterns: string[];
}

export interface MockFlag {
  type: 'pattern' | 'entropy' | 'timestamp' | 'value' | 'sequence';
  severity: 'low' | 'medium' | 'high';
  description: string;
  evidence: any;
}

/**
 * Calculate Shannon entropy of data to detect synthetic patterns
 */
export function calculateEntropy(data: (string | number)[]): number {
  if (data.length === 0) return 0;
  
  const frequency: Record<string, number> = {};
  const stringData = data.map(d => String(d));
  
  // Count frequencies
  for (const item of stringData) {
    frequency[item] = (frequency[item] || 0) + 1;
  }
  
  // Calculate entropy
  let entropy = 0;
  const totalCount = data.length;
  
  for (const count of Object.values(frequency)) {
    const probability = count / totalCount;
    entropy -= probability * Math.log2(probability);
  }
  
  return entropy;
}

/**
 * Scan data for mock/synthetic patterns
 */
export function scanForMockData(
  data: any[],
  expectedEntropy: { min: number; max: number } = { min: 2.0, max: 8.0 }
): MockScanResult {
  const flags: MockFlag[] = [];
  let suspicious = false;
  
  if (data.length === 0) {
    return { suspicious: false, confidence: 0, flags: [], entropy: 0, patterns: [] };
  }

  // Check 1: Entropy analysis
  const numericData = data.filter(d => typeof d === 'number' || !isNaN(Number(d)));
  const entropy = calculateEntropy(numericData);
  
  if (entropy < expectedEntropy.min) {
    flags.push({
      type: 'entropy',
      severity: 'high',
      description: `Entropy too low (${entropy.toFixed(2)} < ${expectedEntropy.min}), indicates repetitive/synthetic data`,
      evidence: { entropy, expected: expectedEntropy.min }
    });
    suspicious = true;
  }

  // Check 2: Perfect sequence detection
  const sortedNumbers = numericData.map(d => parseFloat(String(d))).sort((a, b) => a - b);
  let isSequential = true;
  let expectedStep = 0;
  
  if (sortedNumbers.length > 2) {
    expectedStep = sortedNumbers[1] - sortedNumbers[0];
    for (let i = 2; i < sortedNumbers.length; i++) {
      if (Math.abs((sortedNumbers[i] - sortedNumbers[i-1]) - expectedStep) > expectedStep * 0.01) {
        isSequential = false;
        break;
      }
    }
    
    if (isSequential && expectedStep > 0) {
      flags.push({
        type: 'sequence',
        severity: 'high',
        description: 'Perfect arithmetic sequence detected, likely synthetic',
        evidence: { step: expectedStep, count: sortedNumbers.length }
      });
      suspicious = true;
    }
  }

  // Check 3: Repeated exact values (beyond statistical expectation)
  const valueCounts: Record<string, number> = {};
  data.forEach(d => {
    const key = String(d);
    valueCounts[key] = (valueCounts[key] || 0) + 1;
  });
  
  const maxRepeats = Math.max(...Object.values(valueCounts));
  const expectedMaxRepeats = Math.ceil(Math.sqrt(data.length)); // Rough statistical expectation
  
  if (maxRepeats > expectedMaxRepeats * 2) {
    const repeatedValue = Object.keys(valueCounts).find(k => valueCounts[k] === maxRepeats);
    flags.push({
      type: 'value',
      severity: 'medium',
      description: `Value "${repeatedValue}" appears ${maxRepeats} times, exceeds statistical expectation`,
      evidence: { value: repeatedValue, count: maxRepeats, expected: expectedMaxRepeats }
    });
  }

  // Check 4: Timestamp patterns (if data contains timestamps)
  const timestamps = data.filter(d => d instanceof Date || (typeof d === 'string' && !isNaN(Date.parse(d))));
  if (timestamps.length > 1) {
    const timestampMs = timestamps.map(t => new Date(t).getTime()).sort((a, b) => a - b);
    const intervals = [];
    
    for (let i = 1; i < timestampMs.length; i++) {
      intervals.push(timestampMs[i] - timestampMs[i-1]);
    }
    
    // Check for perfectly regular intervals
    const avgInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
    const regularIntervals = intervals.filter(interval => Math.abs(interval - avgInterval) < avgInterval * 0.001).length;
    
    if (regularIntervals / intervals.length > 0.95) {
      flags.push({
        type: 'timestamp',
        severity: 'medium',
        description: 'Timestamps too regular, may indicate synthetic generation',
        evidence: { regularRatio: regularIntervals / intervals.length, avgInterval }
      });
    }
  }

  // Check 5: Common mock patterns
  const dataStrings = data.map(d => String(d).toLowerCase());
  const mockPatterns = [
    'test', 'mock', 'fake', 'sample', 'dummy', 'placeholder', 
    'lorem', 'ipsum', 'example', 'demo', '123456', 'abcdef'
  ];
  
  const foundPatterns = mockPatterns.filter(pattern => 
    dataStrings.some(str => str.includes(pattern))
  );
  
  if (foundPatterns.length > 0) {
    flags.push({
      type: 'pattern',
      severity: 'high',
      description: 'Mock data patterns detected in values',
      evidence: { patterns: foundPatterns }
    });
    suspicious = true;
  }

  // Calculate overall confidence
  const highSeverityFlags = flags.filter(f => f.severity === 'high').length;
  const mediumSeverityFlags = flags.filter(f => f.severity === 'medium').length;
  const confidence = Math.min(1.0, (highSeverityFlags * 0.6 + mediumSeverityFlags * 0.3));

  return {
    suspicious: suspicious || confidence > 0.5,
    confidence,
    flags,
    entropy,
    patterns: foundPatterns
  };
}

/**
 * Verify data provenance with cryptographic hash validation
 */
export function verifyProvenance(
  data: any,
  expectedProvenance: ProvenanceCheck
): ProvenanceCheck {
  // Generate hash of current data
  const dataString = JSON.stringify(data, Object.keys(data).sort());
  const hash = createHash('sha256').update(dataString).digest('hex').slice(0, 16);
  
  // Validate timestamp (shouldn't be in future or too old)
  const timestamp = new Date(expectedProvenance.timestamp);
  const now = new Date();
  const ageMs = now.getTime() - timestamp.getTime();
  const maxAgeMs = 24 * 60 * 60 * 1000; // 24 hours
  
  let valid = true;
  let reason = '';
  
  // Check hash match
  if (hash !== expectedProvenance.hash) {
    valid = false;
    reason = `Hash mismatch: expected ${expectedProvenance.hash}, got ${hash}`;
  }
  
  // Check timestamp validity
  if (timestamp > now) {
    valid = false;
    reason = `Future timestamp: ${timestamp.toISOString()}`;
  } else if (ageMs > maxAgeMs) {
    valid = false;
    reason = `Data too old: ${Math.floor(ageMs / (60 * 60 * 1000))} hours`;
  }
  
  // Check commit format
  if (!/^[a-f0-9]{7,40}$/.test(expectedProvenance.commit)) {
    valid = false;
    reason = `Invalid commit format: ${expectedProvenance.commit}`;
  }

  return {
    ...expectedProvenance,
    hash,
    valid,
    reason: valid ? undefined : reason
  };
}

/**
 * Generate data fingerprint for tamper detection
 */
export function generateDataFingerprint(data: any): string {
  const sorted = JSON.stringify(data, Object.keys(data).sort());
  return createHash('sha256').update(sorted).digest('hex').slice(0, 12);
}