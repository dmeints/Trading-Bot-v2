/**
 * TAPE REPLAY SYSTEM
 * Record and replay trading "tape" for live↔sim parity validation
 */

interface TapeEntry {
  timestamp: number;
  features: number[];
  bookSnapshot: {
    bids: Array<[number, number]>;
    asks: Array<[number, number]>;
  };
  action: {
    side: 'buy' | 'sell';
    size: number;
    confidence: number;
  };
  result: {
    executionPrice: number;
    fees: number;
    latency: number;
    venue: string;
  };
  sessionId: string;
}

interface ReplayResult {
  originalAction: TapeEntry['action'];
  replayAction: TapeEntry['action'];
  parity: boolean;
  drift: number;
  tolerance: number;
}

export class TapeRunner {
  private tape: TapeEntry[] = [];
  private replayResults: ReplayResult[] = [];
  private tolerance: number = 0.05; // 5% tolerance
  private maxTapeSize: number = 10000;
  private alertCallback?: (drift: number, entry: TapeEntry) => void;

  constructor(config?: {
    tolerance?: number;
    maxTapeSize?: number;
    alertCallback?: (drift: number, entry: TapeEntry) => void;
  }) {
    if (config?.tolerance) this.tolerance = config.tolerance;
    if (config?.maxTapeSize) this.maxTapeSize = config.maxTapeSize;
    if (config?.alertCallback) this.alertCallback = config.alertCallback;
  }

  /**
   * Record a trading action to tape
   */
  recordToTape(
    features: number[],
    bookSnapshot: TapeEntry['bookSnapshot'],
    action: TapeEntry['action'],
    result: TapeEntry['result'],
    sessionId: string = 'default'
  ): void {
    const entry: TapeEntry = {
      timestamp: Date.now(),
      features: [...features],
      bookSnapshot: {
        bids: [...bookSnapshot.bids],
        asks: [...bookSnapshot.asks]
      },
      action: { ...action },
      result: { ...result },
      sessionId
    };

    this.tape.push(entry);

    // Maintain tape size
    if (this.tape.length > this.maxTapeSize) {
      this.tape.shift();
    }
  }

  /**
   * Replay a window of tape entries
   */
  async replayWindow(
    startTime: number,
    endTime: number,
    replayFunction: (features: number[], bookSnapshot: TapeEntry['bookSnapshot']) => Promise<TapeEntry['action']>
  ): Promise<ReplayResult[]> {
    const windowEntries = this.tape.filter(
      entry => entry.timestamp >= startTime && entry.timestamp <= endTime
    );

    const results: ReplayResult[] = [];

    for (const entry of windowEntries) {
      try {
        // Replay the decision
        const replayAction = await replayFunction(entry.features, entry.bookSnapshot);
        
        // Compare with original action
        const drift = this.calculateDrift(entry.action, replayAction);
        const parity = drift <= this.tolerance;

        const result: ReplayResult = {
          originalAction: entry.action,
          replayAction,
          parity,
          drift,
          tolerance: this.tolerance
        };

        results.push(result);
        this.replayResults.push(result);

        // Alert on significant drift
        if (!parity && this.alertCallback) {
          this.alertCallback(drift, entry);
        }

      } catch (error) {
        console.error('Replay error for entry:', entry.timestamp, error);
      }
    }

    // Cleanup old replay results
    if (this.replayResults.length > this.maxTapeSize) {
      this.replayResults = this.replayResults.slice(-this.maxTapeSize);
    }

    return results;
  }

  /**
   * Calculate drift between original and replay actions
   */
  private calculateDrift(original: TapeEntry['action'], replay: TapeEntry['action']): number {
    // Side mismatch is major drift
    if (original.side !== replay.side) {
      return 1.0; // 100% drift
    }

    // Size drift
    const sizeDrift = Math.abs(original.size - replay.size) / Math.max(original.size, 0.001);
    
    // Confidence drift
    const confidenceDrift = Math.abs(original.confidence - replay.confidence);

    // Combined drift (weighted)
    return sizeDrift * 0.7 + confidenceDrift * 0.3;
  }

  /**
   * Assert action parity within tolerance
   */
  assertParity(
    original: TapeEntry['action'],
    replay: TapeEntry['action'],
    customTolerance?: number
  ): {
    passed: boolean;
    drift: number;
    details: string;
  } {
    const drift = this.calculateDrift(original, replay);
    const tolerance = customTolerance || this.tolerance;
    const passed = drift <= tolerance;

    const details = passed 
      ? `Parity check passed: drift ${(drift * 100).toFixed(2)}% <= ${(tolerance * 100).toFixed(2)}%`
      : `Parity check failed: drift ${(drift * 100).toFixed(2)}% > ${(tolerance * 100).toFixed(2)}%`;

    return { passed, drift, details };
  }

  /**
   * Get tape statistics
   */
  getTapeStats(): {
    totalEntries: number;
    timeRange: { start: number; end: number } | null;
    replayCount: number;
    parityRate: number;
    avgDrift: number;
    sessionsCount: number;
  } {
    const timeRange = this.tape.length > 0 
      ? {
          start: this.tape[0].timestamp,
          end: this.tape[this.tape.length - 1].timestamp
        }
      : null;

    const parityResults = this.replayResults.filter(r => r.parity);
    const parityRate = this.replayResults.length > 0 
      ? parityResults.length / this.replayResults.length 
      : 0;

    const avgDrift = this.replayResults.length > 0
      ? this.replayResults.reduce((sum, r) => sum + r.drift, 0) / this.replayResults.length
      : 0;

    const uniqueSessions = new Set(this.tape.map(entry => entry.sessionId));

    return {
      totalEntries: this.tape.length,
      timeRange,
      replayCount: this.replayResults.length,
      parityRate,
      avgDrift,
      sessionsCount: uniqueSessions.size
    };
  }

  /**
   * Export tape for analysis
   */
  exportTape(sessionId?: string): TapeEntry[] {
    if (sessionId) {
      return this.tape.filter(entry => entry.sessionId === sessionId);
    }
    return [...this.tape];
  }

  /**
   * Import tape from external source
   */
  importTape(entries: TapeEntry[]): void {
    this.tape = [...entries];
    
    // Maintain size limit
    if (this.tape.length > this.maxTapeSize) {
      this.tape = this.tape.slice(-this.maxTapeSize);
    }
  }

  /**
   * Clear tape and replay results
   */
  clearTape(): void {
    this.tape = [];
    this.replayResults = [];
  }

  /**
   * Get recent drift alerts
   */
  getRecentDriftAlerts(limit: number = 50): Array<{
    timestamp: number;
    drift: number;
    tolerance: number;
    originalAction: TapeEntry['action'];
    replayAction: TapeEntry['action'];
  }> {
    return this.replayResults
      .filter(result => !result.parity)
      .slice(-limit)
      .map(result => ({
        timestamp: Date.now(), // Would store actual timestamp
        drift: result.drift,
        tolerance: result.tolerance,
        originalAction: result.originalAction,
        replayAction: result.replayAction
      }));
  }
}

export default TapeRunner;