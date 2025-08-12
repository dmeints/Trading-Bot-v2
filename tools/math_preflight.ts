
// tools/math_preflight.ts
import { preflightAdapters } from './preflight_adapters.js';

interface MathValidationResult {
  passed: boolean;
  checks: Record<string, boolean>;
  warnings: string[];
  confidence: number;
  source: string;
}

class MathPreflight {
  private readonly EPSILON = 1e-10;
  private readonly RISK_THRESHOLDS = {
    maxSharpe: 3.0,        // Suspiciously high Sharpe
    minSharpe: -2.0,       // Suspiciously low Sharpe
    maxDrawdown: 0.50,     // 50% max allowed drawdown
    minWinRate: 0.20,      // 20% minimum win rate
    maxWinRate: 0.95,      // 95% maximum (suspicious)
    maxVolatility: 0.80,   // 80% annualized volatility
    minTrades: 10          // Minimum trades for significance
  };

  async validateMetricConsistency(): Promise<MathValidationResult> {
    console.log('🔢 Starting mathematical preflight validation...');
    
    const checks: Record<string, boolean> = {};
    const warnings: string[] = [];
    let confidence = 1.0;
    let source = 'unknown';

    try {
      // Get real metrics from preflight adapters
      const metricsResult = await preflightAdapters.getLatestMetrics();
      const metrics = metricsResult.data;
      source = metricsResult.provenance.source;
      confidence = metricsResult.provenance.confidence || 0.5;

      // 1. Sharpe Ratio Sanity Check
      const sharpeValid = this.validateSharpeRatio(metrics.sharpe_ratio);
      checks.sharpe_ratio_valid = sharpeValid;
      
      if (!sharpeValid) {
        warnings.push(`Sharpe ratio ${metrics.sharpe_ratio} outside reasonable bounds`);
      }

      // 2. Drawdown Consistency
      const drawdownValid = this.validateDrawdown(metrics.max_drawdown);
      checks.drawdown_valid = drawdownValid;
      
      if (!drawdownValid) {
        warnings.push(`Max drawdown ${metrics.max_drawdown} exceeds safety threshold`);
      }

      // 3. Win Rate Sanity
      const winRateValid = this.validateWinRate(metrics.win_rate);
      checks.win_rate_valid = winRateValid;
      
      if (!winRateValid) {
        warnings.push(`Win rate ${metrics.win_rate} outside realistic range`);
      }

      // 4. Sample Size Check
      const sampleSizeValid = this.validateSampleSize(metrics.total_trades);
      checks.sample_size_valid = sampleSizeValid;
      
      if (!sampleSizeValid) {
        warnings.push(`Insufficient trades (${metrics.total_trades}) for statistical significance`);
      }

      // 5. Return-Risk Consistency
      const returnRiskValid = this.validateReturnRiskConsistency(metrics);
      checks.return_risk_consistent = returnRiskValid;
      
      if (!returnRiskValid) {
        warnings.push('Return and risk metrics show inconsistencies');
      }

      // 6. Correlation Bounds
      if (metrics.correlation_matrix) {
        const correlationValid = this.validateCorrelationMatrix(metrics.correlation_matrix);
        checks.correlation_valid = correlationValid;
        
        if (!correlationValid) {
          warnings.push('Correlation matrix contains invalid values');
        }
      }

      // 7. Portfolio Math Check
      if (metrics.portfolio_weights && metrics.asset_returns) {
        const portfolioValid = this.validatePortfolioMath(
          metrics.portfolio_weights,
          metrics.asset_returns
        );
        checks.portfolio_math_valid = portfolioValid;
        
        if (!portfolioValid) {
          warnings.push('Portfolio weights and returns show mathematical inconsistencies');
        }
      }

      // 8. Volatility Bounds
      if (metrics.volatility !== undefined) {
        const volatilityValid = this.validateVolatility(metrics.volatility);
        checks.volatility_valid = volatilityValid;
        
        if (!volatilityValid) {
          warnings.push(`Volatility ${metrics.volatility} outside reasonable bounds`);
        }
      }

      // Calculate overall pass status
      const passedChecks = Object.values(checks).filter(Boolean).length;
      const totalChecks = Object.keys(checks).length;
      const passed = passedChecks === totalChecks;

      console.log(`✅ Math validation: ${passedChecks}/${totalChecks} checks passed`);
      
      if (warnings.length > 0) {
        console.warn('⚠️ Math validation warnings:', warnings);
      }

      return {
        passed,
        checks,
        warnings,
        confidence,
        source
      };

    } catch (error) {
      console.error('❌ Math preflight validation failed:', error);
      
      return {
        passed: false,
        checks: { validation_error: false },
        warnings: [`Validation error: ${error.message}`],
        confidence: 0,
        source: 'error'
      };
    }
  }

  private validateSharpeRatio(sharpe: number): boolean {
    if (isNaN(sharpe) || !isFinite(sharpe)) return false;
    return sharpe >= this.RISK_THRESHOLDS.minSharpe && 
           sharpe <= this.RISK_THRESHOLDS.maxSharpe;
  }

  private validateDrawdown(drawdown: number): boolean {
    if (isNaN(drawdown) || !isFinite(drawdown)) return false;
    // Drawdown should be negative or zero, but often reported as positive
    const absDrawdown = Math.abs(drawdown);
    return absDrawdown >= 0 && absDrawdown <= this.RISK_THRESHOLDS.maxDrawdown;
  }

  private validateWinRate(winRate: number): boolean {
    if (isNaN(winRate) || !isFinite(winRate)) return false;
    return winRate >= this.RISK_THRESHOLDS.minWinRate && 
           winRate <= this.RISK_THRESHOLDS.maxWinRate;
  }

  private validateSampleSize(trades: number): boolean {
    return Number.isInteger(trades) && trades >= this.RISK_THRESHOLDS.minTrades;
  }

  private validateReturnRiskConsistency(metrics: any): boolean {
    // Check if returns and volatility are mathematically consistent
    if (metrics.annualized_return === undefined || metrics.volatility === undefined) {
      return true; // Can't validate without both
    }

    const expectedSharpe = metrics.annualized_return / metrics.volatility;
    const actualSharpe = metrics.sharpe_ratio;
    
    // Allow 10% tolerance for calculation differences
    const tolerance = 0.1;
    return Math.abs(expectedSharpe - actualSharpe) <= tolerance * Math.abs(actualSharpe);
  }

  private validateCorrelationMatrix(matrix: number[][]): boolean {
    if (!Array.isArray(matrix) || matrix.length === 0) return false;

    // Check if square matrix
    const n = matrix.length;
    if (!matrix.every(row => Array.isArray(row) && row.length === n)) {
      return false;
    }

    // Check diagonal elements are 1
    for (let i = 0; i < n; i++) {
      if (Math.abs(matrix[i][i] - 1.0) > this.EPSILON) {
        return false;
      }
    }

    // Check symmetry and bounds
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const value = matrix[i][j];
        
        // Check bounds [-1, 1]
        if (value < -1 - this.EPSILON || value > 1 + this.EPSILON) {
          return false;
        }
        
        // Check symmetry
        if (Math.abs(matrix[i][j] - matrix[j][i]) > this.EPSILON) {
          return false;
        }
      }
    }

    return true;
  }

  private validatePortfolioMath(weights: number[], returns: number[]): boolean {
    if (!Array.isArray(weights) || !Array.isArray(returns)) return false;
    if (weights.length !== returns.length) return false;

    // Check weights sum to 1 (within tolerance)
    const weightSum = weights.reduce((sum, w) => sum + w, 0);
    if (Math.abs(weightSum - 1.0) > 0.01) return false;

    // Check no weight is negative (for long-only portfolio)
    if (weights.some(w => w < -this.EPSILON)) return false;

    // Check returns are finite
    if (returns.some(r => !isFinite(r))) return false;

    return true;
  }

  private validateVolatility(volatility: number): boolean {
    if (isNaN(volatility) || !isFinite(volatility)) return false;
    return volatility >= 0 && volatility <= this.RISK_THRESHOLDS.maxVolatility;
  }

  // Additional statistical tests
  async runStatisticalTests(): Promise<Record<string, boolean>> {
    try {
      const metricsResult = await preflightAdapters.getLatestMetrics();
      const metrics = metricsResult.data;

      const tests: Record<string, boolean> = {};

      // Jarque-Bera test for normality (simplified)
      if (metrics.returns_series) {
        tests.returns_normality = this.jarqueBeraTest(metrics.returns_series);
      }

      // Ljung-Box test for autocorrelation (simplified)
      if (metrics.returns_series) {
        tests.no_autocorrelation = this.ljungBoxTest(metrics.returns_series);
      }

      return tests;
    } catch (error) {
      console.warn('Statistical tests failed:', error);
      return {};
    }
  }

  private jarqueBeraTest(returns: number[]): boolean {
    if (returns.length < 20) return true; // Skip for small samples

    const n = returns.length;
    const mean = returns.reduce((sum, r) => sum + r, 0) / n;
    
    // Calculate moments
    let variance = 0;
    let skewness = 0;
    let kurtosis = 0;

    for (const r of returns) {
      const deviation = r - mean;
      variance += deviation * deviation;
      skewness += deviation * deviation * deviation;
      kurtosis += deviation * deviation * deviation * deviation;
    }

    variance /= n;
    const stdDev = Math.sqrt(variance);
    skewness = (skewness / n) / Math.pow(stdDev, 3);
    kurtosis = (kurtosis / n) / Math.pow(stdDev, 4) - 3;

    // Jarque-Bera statistic
    const jb = (n / 6) * (skewness * skewness + (kurtosis * kurtosis) / 4);
    
    // Critical value for 5% significance (approximately 6)
    return jb < 6;
  }

  private ljungBoxTest(returns: number[], lags: number = 10): boolean {
    if (returns.length < lags * 2) return true; // Skip for small samples

    const n = returns.length;
    const mean = returns.reduce((sum, r) => sum + r, 0) / n;
    
    // Calculate autocorrelations
    let lbStatistic = 0;
    
    for (let k = 1; k <= lags; k++) {
      let autocorr = 0;
      let denominator = 0;
      
      for (let i = 0; i < n - k; i++) {
        autocorr += (returns[i] - mean) * (returns[i + k] - mean);
      }
      
      for (let i = 0; i < n; i++) {
        denominator += (returns[i] - mean) * (returns[i] - mean);
      }
      
      if (denominator > 0) {
        const rho = autocorr / denominator;
        lbStatistic += (rho * rho) / (n - k);
      }
    }
    
    lbStatistic *= n * (n + 2);
    
    // Critical value for 5% significance with 'lags' degrees of freedom (approximation)
    const criticalValue = 16.9; // Chi-square critical value for 10 df at 5%
    
    return lbStatistic < criticalValue;
  }
}

// Execute if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const mathPreflight = new MathPreflight();
  mathPreflight.validateMetricConsistency()
    .then(result => {
      console.log('\n📊 Math Validation Results:', result);
      process.exit(result.passed ? 0 : 1);
    })
    .catch(error => {
      console.error('💥 Math validation failed:', error);
      process.exit(1);
    });
}

export default MathPreflight;
export { MathPreflight };
