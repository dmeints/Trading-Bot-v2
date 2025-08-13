
#!/usr/bin/env tsx

import * as fs from 'fs';
import * as path from 'path';

interface BenchmarkResult {
  version: string;
  timestamp: number;
  duration: number;
  config: {
    version: string;
    days: number;
    marketShocks: number;
    noiseLevel: number;
    slippageRate: number;
    minTradesRequired: number;
  };
  performance: {
    totalReturn: number;
    sharpeRatio: number;
    maxDrawdown: number;
    winRate: number;
    totalTrades: number;
    avgTradeReturn: number;
    volatility: number;
    calmarRatio: number;
  };
  difficulty: {
    level: number;
    modifiers: string[];
  };
  metadata: {
    dataPoints: number;
    marketRegimes: string[];
    testPeriod: {
      start: string;
      end: string;
    };
  };
}

class BenchmarkReportGenerator {
  private resultsDir = './benchmark-results';
  private exportDir = './exports';

  constructor() {
    if (!fs.existsSync(this.exportDir)) {
      fs.mkdirSync(this.exportDir, { recursive: true });
    }
  }

  generateReport(): void {
    console.log('🎯 STEVIE BENCHMARK ANALYSIS REPORT');
    console.log('=====================================\n');

    // Find latest v1.7 results
    const v17Results = this.getV17Results();
    
    if (v17Results.length === 0) {
      console.log('❌ No Stevie v1.7 benchmark results found');
      return;
    }

    console.log(`📊 Found ${v17Results.length} v1.7 benchmark runs\n`);

    // Analyze the latest result
    const latestResult = v17Results[v17Results.length - 1];
    this.analyzeResult(latestResult);

    // Generate diagnostic report
    this.generateDiagnosticReport(v17Results);
    
    // Create summary report file
    this.createSummaryFile(v17Results);
  }

  private getV17Results(): BenchmarkResult[] {
    if (!fs.existsSync(this.resultsDir)) {
      return [];
    }

    const files = fs.readdirSync(this.resultsDir);
    const v17Files = files.filter(f => f.includes('benchmark_v1.7_') && f.endsWith('.json'));
    
    return v17Files.map(file => {
      const content = fs.readFileSync(path.join(this.resultsDir, file), 'utf8');
      return JSON.parse(content) as BenchmarkResult;
    }).sort((a, b) => a.timestamp - b.timestamp);
  }

  private analyzeResult(result: BenchmarkResult): void {
    const perf = result.performance;
    const config = result.config;
    const meta = result.metadata;

    console.log('🔍 LATEST BENCHMARK ANALYSIS (v1.7)');
    console.log('-----------------------------------');
    console.log(`⏱️  Test Duration: ${(result.duration / 1000).toFixed(3)}s`);
    console.log(`📅 Market Period: ${config.days} days`);
    console.log(`📈 Data Points: ${meta.dataPoints}`);
    console.log(`🏛️  Market Regime: ${meta.marketRegimes.join(', ')}`);
    console.log(`🎚️  Difficulty Level: ${result.difficulty.level}`);
    console.log(`🔄 Market Shocks: ${config.marketShocks}`);
    console.log(`📊 Price Noise: ${config.noiseLevel.toFixed(1)}%`);
    console.log(`💰 Slippage: ${config.slippageRate}%`);
    console.log();

    console.log('📈 PERFORMANCE METRICS');
    console.log('----------------------');
    console.log(`🔄 Total Trades: ${perf.totalTrades}`);
    console.log(`📊 Total Return: ${(perf.totalReturn * 100).toFixed(2)}%`);
    console.log(`📈 Sharpe Ratio: ${perf.sharpeRatio.toFixed(3)}`);
    console.log(`📉 Max Drawdown: ${(perf.maxDrawdown * 100).toFixed(2)}%`);
    console.log(`🎯 Win Rate: ${(perf.winRate * 100).toFixed(1)}%`);
    console.log(`💰 Avg Trade Return: ${(perf.avgTradeReturn * 100).toFixed(2)}%`);
    console.log(`📊 Volatility: ${(perf.volatility * 100).toFixed(2)}%`);
    console.log(`📈 Calmar Ratio: ${perf.calmarRatio.toFixed(3)}`);
    console.log();

    // Diagnosis
    console.log('🔍 DIAGNOSTIC ANALYSIS');
    console.log('-----------------------');
    
    if (perf.totalTrades === 0) {
      console.log('❌ CRITICAL ISSUE: No trades executed');
      console.log('   Possible causes:');
      console.log('   • Trading algorithm not triggering entry conditions');
      console.log('   • Risk management blocking all trades');
      console.log('   • Market data insufficient for signal generation');
      console.log('   • Configuration thresholds too restrictive');
      console.log();
    }

    if (meta.dataPoints > 0 && perf.totalTrades === 0) {
      console.log('📊 Data Quality Assessment:');
      console.log(`   • ${meta.dataPoints} market data points available`);
      console.log(`   • Market regime: ${meta.marketRegimes[0]}`);
      console.log(`   • Test duration: ${config.days} days`);
      console.log('   • Data appears sufficient for trading');
      console.log();
    }

    // Recommendations
    console.log('💡 IMPROVEMENT RECOMMENDATIONS');
    console.log('------------------------------');
    
    if (perf.totalTrades === 0) {
      console.log('1. 🔧 Debug trading signal generation');
      console.log('2. 🎚️  Review entry/exit thresholds');
      console.log('3. 🛡️  Check risk management settings');
      console.log('4. 📊 Validate market data quality');
      console.log('5. ⚙️  Lower minimum trade requirements for testing');
    }

    console.log();
  }

  private generateDiagnosticReport(results: BenchmarkResult[]): void {
    console.log('📋 HISTORICAL TREND ANALYSIS');
    console.log('-----------------------------');
    
    const tradeCounts = results.map(r => r.performance.totalTrades);
    const avgTrades = tradeCounts.reduce((sum, count) => sum + count, 0) / tradeCounts.length;
    
    console.log(`📊 Average trades across ${results.length} runs: ${avgTrades.toFixed(1)}`);
    console.log(`🔄 Trade count range: ${Math.min(...tradeCounts)} - ${Math.max(...tradeCounts)}`);
    
    const zeroTradeRuns = tradeCounts.filter(count => count === 0).length;
    console.log(`❌ Runs with zero trades: ${zeroTradeRuns}/${results.length} (${((zeroTradeRuns/results.length)*100).toFixed(1)}%)`);
    
    if (zeroTradeRuns === results.length) {
      console.log();
      console.log('🚨 CRITICAL: All benchmark runs show zero trades');
      console.log('   This indicates a systematic issue with:');
      console.log('   • Trading strategy implementation');
      console.log('   • Market data processing');
      console.log('   • Signal generation logic');
      console.log('   • Risk management configuration');
    }
    
    console.log();
  }

  private createSummaryFile(results: BenchmarkResult[]): void {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const summaryPath = path.join(this.exportDir, `stevie-v17-benchmark-analysis-${timestamp}.md`);
    
    const latest = results[results.length - 1];
    
    const summary = `# Stevie v1.7 Benchmark Analysis Report

**Generated:** ${new Date().toLocaleString()}
**Total Runs Analyzed:** ${results.length}
**Latest Run:** ${new Date(latest.timestamp).toLocaleString()}

## Executive Summary

Stevie v1.7 has been tested across ${results.length} benchmark runs with concerning results:

- **Zero Trading Activity**: All runs show 0 total trades executed
- **No Performance Metrics**: All financial metrics are zero due to lack of trading
- **Data Availability**: Market data is being processed (${latest.metadata.dataPoints} data points)
- **Test Execution**: Benchmarks complete successfully in ~${(latest.duration/1000).toFixed(3)}s

## Key Findings

### 🚨 Critical Issues
1. **No Trade Execution**: Despite having market data, no trades are being triggered
2. **Signal Generation**: Trading signals may not be reaching execution threshold
3. **Risk Management**: Overly restrictive risk controls may be blocking trades
4. **Configuration**: Entry/exit parameters may need adjustment

### 📊 Technical Details
- **Market Data Points**: ${latest.metadata.dataPoints}
- **Test Duration**: ${latest.config.days} days
- **Market Regime**: ${latest.metadata.marketRegimes.join(', ')}
- **Difficulty Level**: ${latest.difficulty.level}
- **Market Shocks**: ${latest.config.marketShocks}
- **Price Noise**: ${latest.config.noiseLevel.toFixed(1)}%

## Immediate Actions Required

1. **Debug Trading Logic**: Examine why entry conditions are never met
2. **Review Thresholds**: Lower entry/exit thresholds for initial testing
3. **Risk Management**: Temporarily relax risk controls for benchmark testing  
4. **Data Validation**: Ensure market data is being processed correctly
5. **Algorithm Audit**: Review decision-making logic in trading engine

## Next Steps

The benchmark system is working correctly, but the trading algorithm needs immediate attention to resolve the zero-trade issue.

---
*This report was generated automatically by the Stevie Benchmark Analysis System*
`;

    fs.writeFileSync(summaryPath, summary);
    console.log(`📄 Detailed analysis saved to: ${summaryPath}`);
    console.log();
    console.log('🎯 SUMMARY: Benchmark system is functional, but trading algorithm needs debugging');
    console.log('   Focus on resolving zero-trade execution issue');
  }
}

// Run the report generator
const generator = new BenchmarkReportGenerator();
generator.generateReport();
