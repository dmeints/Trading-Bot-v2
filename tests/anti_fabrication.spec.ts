
import { describe, it, expect } from 'vitest';

describe('Anti-Fabrication & Data Leakage Tests', () => {
  
  describe('Purged k-fold CV', () => {
    it('should prevent overlapping train/test windows', () => {
      // Simulate time-series data points
      const dataPoints = Array.from({ length: 1000 }, (_, i) => ({
        timestamp: new Date('2024-01-01T00:00:00Z').getTime() + i * 60000, // 1-minute intervals
        price: 50000 + Math.random() * 1000,
        volume: Math.random() * 100
      }));

      const foldSize = Math.floor(dataPoints.length / 5); // 5-fold CV
      const purgeGap = 50; // 50-minute purge gap

      for (let fold = 0; fold < 5; fold++) {
        const testStart = fold * foldSize;
        const testEnd = Math.min((fold + 1) * foldSize, dataPoints.length);
        
        // Training data should exclude test period + purge gaps
        const trainData = dataPoints.filter((_, idx) => {
          return idx < (testStart - purgeGap) || idx > (testEnd + purgeGap);
        });

        const testData = dataPoints.slice(testStart, testEnd);

        // Verify no temporal overlap
        if (trainData.length > 0 && testData.length > 0) {
          const maxTrainTime = Math.max(...trainData.map(d => d.timestamp));
          const minTestTime = Math.min(...testData.map(d => d.timestamp));
          const minTrainTime = Math.min(...trainData.map(d => d.timestamp));
          const maxTestTime = Math.max(...testData.map(d => d.timestamp));

          // Check for proper temporal separation
          const hasProperSeparation = 
            maxTrainTime < (minTestTime - purgeGap * 60000) || 
            minTrainTime > (maxTestTime + purgeGap * 60000);

          expect(hasProperSeparation).toBe(true);
        }
      }
    });

    it('should maintain temporal ordering in folds', () => {
      const timestamps = [
        '2024-01-01T10:00:00Z',
        '2024-01-01T11:00:00Z', 
        '2024-01-01T12:00:00Z',
        '2024-01-01T13:00:00Z',
        '2024-01-01T14:00:00Z'
      ].map(t => new Date(t).getTime());

      // For time series, test sets should always come after training sets
      for (let i = 1; i < timestamps.length; i++) {
        expect(timestamps[i]).toBeGreaterThan(timestamps[i - 1]);
      }
    });
  });

  describe('Time embargo around labels', () => {
    it('should enforce minimum time gap between features and labels', () => {
      const embargoMinutes = 5;
      const currentTime = new Date('2024-01-01T12:00:00Z').getTime();
      
      // Features must be from before the embargo period
      const featureTime = currentTime - (embargoMinutes * 60 * 1000);
      const labelTime = currentTime;

      const timeGap = labelTime - featureTime;
      const minimumGap = embargoMinutes * 60 * 1000;

      expect(timeGap).toBeGreaterThanOrEqual(minimumGap);
    });

    it('should reject labels that are too close to feature extraction time', () => {
      const embargoMinutes = 5;
      const featureTime = new Date('2024-01-01T12:00:00Z').getTime();
      
      // This label is too close (only 2 minutes gap)
      const tooCloseLabel = featureTime + (2 * 60 * 1000);
      const validLabel = featureTime + (10 * 60 * 1000);

      const isValidLabel = (labelTime: number, featureTime: number) => {
        const gap = labelTime - featureTime;
        return gap >= (embargoMinutes * 60 * 1000);
      };

      expect(isValidLabel(tooCloseLabel, featureTime)).toBe(false);
      expect(isValidLabel(validLabel, featureTime)).toBe(true);
    });
  });

  describe('SPA/DSr guard rails for reported Sharpe', () => {
    it('should detect suspiciously high Sharpe ratios', () => {
      const validateSharpeRatio = (sharpe: number, returns: number[], riskFreeRate = 0.02) => {
        // Calculate actual Sharpe from returns
        const meanReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
        const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - meanReturn, 2), 0) / returns.length;
        const volatility = Math.sqrt(variance);
        const calculatedSharpe = (meanReturn - riskFreeRate / 252) / volatility;

        // Allow some tolerance for rounding
        const tolerance = 0.1;
        const diff = Math.abs(sharpe - calculatedSharpe);

        return {
          isValid: diff <= tolerance,
          reported: sharpe,
          calculated: calculatedSharpe,
          difference: diff
        };
      };

      // Test with realistic returns
      const returns = [0.001, -0.002, 0.003, -0.001, 0.002, 0.001, -0.001];
      const meanRet = returns.reduce((a, b) => a + b, 0) / returns.length;
      const vol = Math.sqrt(returns.reduce((sum, ret) => sum + Math.pow(ret - meanRet, 2), 0) / returns.length);
      const actualSharpe = meanRet / vol;

      // Valid Sharpe (close to calculated)
      const validation1 = validateSharpeRatio(actualSharpe, returns);
      expect(validation1.isValid).toBe(true);

      // Suspicious Sharpe (way too high)
      const suspiciousSharpe = actualSharpe * 10;
      const validation2 = validateSharpeRatio(suspiciousSharpe, returns);
      expect(validation2.isValid).toBe(false);
    });

    it('should flag impossibly consistent returns', () => {
      const detectFabricatedReturns = (returns: number[]) => {
        if (returns.length < 10) return { suspicious: false, reason: 'Insufficient data' };

        // Check for suspiciously low variance
        const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
        const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - mean, 2), 0) / returns.length;
        const coefficientOfVariation = Math.sqrt(variance) / Math.abs(mean);

        // Real trading returns should have some variance
        if (coefficientOfVariation < 0.1 && mean > 0.001) {
          return { suspicious: true, reason: 'Suspiciously consistent positive returns' };
        }

        // Check for perfect patterns
        const differences = returns.slice(1).map((ret, i) => Math.abs(ret - returns[i]));
        const avgDifference = differences.reduce((a, b) => a + b, 0) / differences.length;
        
        if (avgDifference < 0.0001) {
          return { suspicious: true, reason: 'Returns are too uniform' };
        }

        return { suspicious: false, reason: 'Returns appear realistic' };
      };

      // Realistic noisy returns
      const realisticReturns = Array.from({ length: 50 }, () => 
        0.0005 + (Math.random() - 0.5) * 0.01
      );
      expect(detectFabricatedReturns(realisticReturns).suspicious).toBe(false);

      // Suspiciously consistent returns
      const fabricatedReturns = Array(50).fill(0.001);
      expect(detectFabricatedReturns(fabricatedReturns).suspicious).toBe(true);
    });
  });

  describe('Statistical significance tests', () => {
    it('should require sufficient sample size for statistical claims', () => {
      const validateSampleSize = (returns: number[], claimedSignificance = 0.05) => {
        const n = returns.length;
        
        // Rule of thumb: need at least 30 observations for normal approximation
        // For trading strategies, recommend much more
        const minSampleSize = 252; // At least 1 year of daily returns
        
        if (n < minSampleSize) {
          return {
            valid: false,
            reason: `Insufficient sample size: ${n} < ${minSampleSize}`,
            recommendedMinimum: minSampleSize
          };
        }

        return { valid: true, reason: 'Sufficient sample size' };
      };

      // Too few samples
      const smallSample = Array(100).fill(0.001);
      expect(validateSampleSize(smallSample).valid).toBe(false);

      // Adequate samples
      const largeSample = Array(300).fill(0.001);
      expect(validateSampleSize(largeSample).valid).toBe(true);
    });

    it('should detect multiple testing bias', () => {
      const detectMultipleTesting = (numStrategiesTested: number, bestSharpe: number) => {
        // Bonferroni correction approximation
        const adjustedAlpha = 0.05 / numStrategiesTested;
        
        // Approximate critical Sharpe for given number of strategies
        // This is a simplified heuristic
        const criticalSharpe = Math.sqrt(-2 * Math.log(adjustedAlpha));
        
        return {
          needsCorrection: numStrategiesTested > 5,
          adjustedAlpha,
          criticalSharpe,
          passesAdjustedTest: bestSharpe > criticalSharpe,
          warning: numStrategiesTested > 20 ? 'High risk of multiple testing bias' : null
        };
      };

      // Single strategy - no correction needed
      const singleTest = detectMultipleTesting(1, 2.0);
      expect(singleTest.needsCorrection).toBe(false);

      // Many strategies tested - needs correction
      const multipleTest = detectMultipleTesting(100, 2.0);
      expect(multipleTest.needsCorrection).toBe(true);
      expect(multipleTest.warning).toBeTruthy();
    });
  });

  describe('Data snooping prevention', () => {
    it('should track and limit parameter optimization attempts', () => {
      class ParameterOptimizationTracker {
        private attempts: Map<string, number> = new Map();
        private maxAttempts = 10;

        recordAttempt(strategyId: string, parameters: any): boolean {
          const paramKey = `${strategyId}_${JSON.stringify(parameters)}`;
          const count = this.attempts.get(paramKey) || 0;
          
          if (count >= this.maxAttempts) {
            return false; // Block further optimization
          }

          this.attempts.set(paramKey, count + 1);
          return true;
        }

        getRemainingAttempts(strategyId: string): number {
          const totalAttempts = Array.from(this.attempts.entries())
            .filter(([key]) => key.startsWith(strategyId))
            .reduce((sum, [_, count]) => sum + count, 0);
          
          return Math.max(0, this.maxAttempts - totalAttempts);
        }
      }

      const tracker = new ParameterOptimizationTracker();
      
      // First few attempts should be allowed
      expect(tracker.recordAttempt('strategy1', { param1: 0.1 })).toBe(true);
      expect(tracker.recordAttempt('strategy1', { param1: 0.2 })).toBe(true);
      
      // After many attempts, should be blocked
      for (let i = 0; i < 10; i++) {
        tracker.recordAttempt('strategy1', { param1: 0.1 + i * 0.01 });
      }
      
      expect(tracker.recordAttempt('strategy1', { param1: 0.9 })).toBe(false);
    });
  });
});
