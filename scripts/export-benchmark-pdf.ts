
#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

interface BenchmarkResult {
  version: string;
  timestamp: number;
  performance: any;
  difficulty: any;
  metadata: any;
}

class BenchmarkPDFExporter {
  private resultsDir = './benchmark-results';
  private exportDir = './exports';

  constructor() {
    if (!fs.existsSync(this.exportDir)) {
      fs.mkdirSync(this.exportDir, { recursive: true });
    }
  }

  async exportToPDF(): Promise<void> {
    console.log('🔍 Collecting benchmark results...');
    
    // Get the latest benchmark result
    const latestPath = path.join(this.resultsDir, 'latest.json');
    if (!fs.existsSync(latestPath)) {
      throw new Error('No benchmark results found. Run benchmark first.');
    }

    const result: BenchmarkResult = JSON.parse(fs.readFileSync(latestPath, 'utf8'));
    
    // Generate comprehensive markdown report
    const markdownContent = this.generateMarkdownReport(result);
    
    // Save markdown file
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const mdPath = path.join(this.exportDir, `stevie-benchmark-report-${timestamp}.md`);
    fs.writeFileSync(mdPath, markdownContent);
    
    console.log(`📄 Markdown report saved: ${mdPath}`);
    
    // Convert to PDF using pandoc if available, otherwise provide instructions
    try {
      const pdfPath = path.join(this.exportDir, `stevie-benchmark-report-${timestamp}.pdf`);
      execSync(`pandoc "${mdPath}" -o "${pdfPath}" --pdf-engine=wkhtmltopdf`);
      console.log(`📊 PDF report generated: ${pdfPath}`);
    } catch (error) {
      console.log('⚠️  PDF conversion requires pandoc. Markdown report is available.');
      console.log('📥 To convert to PDF manually, use: pandoc ' + mdPath + ' -o report.pdf');
    }
  }

  private generateMarkdownReport(result: BenchmarkResult): string {
    const date = new Date(result.timestamp).toLocaleDateString();
    const time = new Date(result.timestamp).toLocaleTimeString();
    
    return `
# Stevie Algorithm Benchmark Report

**Generated:** ${date} ${time}  
**Version:** ${result.version}  
**Test Duration:** ${(result.performance?.duration || 0) / 1000}s  

---

## 📊 Performance Summary

| Metric | Value |
|--------|-------|
| **Total Return** | ${result.performance?.totalReturn?.toFixed(2) || 'N/A'}% |
| **Sharpe Ratio** | ${result.performance?.sharpeRatio?.toFixed(3) || 'N/A'} |
| **Maximum Drawdown** | ${result.performance?.maxDrawdown?.toFixed(2) || 'N/A'}% |
| **Win Rate** | ${result.performance?.winRate?.toFixed(1) || 'N/A'}% |
| **Total Trades** | ${result.performance?.totalTrades || 'N/A'} |
| **Average Trade Return** | ${result.performance?.avgTradeReturn?.toFixed(2) || 'N/A'}% |
| **Volatility** | ${result.performance?.volatility?.toFixed(2) || 'N/A'}% |
| **Calmar Ratio** | ${result.performance?.calmarRatio?.toFixed(3) || 'N/A'} |

---

## 🎯 Test Configuration

| Parameter | Value |
|-----------|-------|
| **Difficulty Level** | ${result.difficulty?.level || 'N/A'} |
| **Market Regimes** | ${result.metadata?.marketRegimes?.join(', ') || 'N/A'} |
| **Data Points** | ${result.metadata?.dataPoints?.toLocaleString() || 'N/A'} |
| **Test Period** | ${result.metadata?.testPeriod?.start?.split('T')[0] || 'N/A'} to ${result.metadata?.testPeriod?.end?.split('T')[0] || 'N/A'} |

---

## 🎚️ Difficulty Modifiers

${result.difficulty?.modifiers?.map((mod: string) => `- ${mod}`).join('\n') || 'None'}

---

## 📈 Stevie Algorithm Math

### Core Trading Logic

Stevie uses a multi-factor momentum strategy with RSI filtering:

**Signal Generation:**
- **RSI Signal:** Buy when RSI < 30, Sell when RSI > 70
- **Momentum Signal:** Buy when SMA(20) > SMA(50), Sell otherwise
- **Combined Signal:** Both conditions must align for trade execution

**Position Sizing:**
- **Kelly Criterion:** Optimal bet size = (bp - q) / b
  - bp = probability of winning × average win
  - q = probability of losing  
  - b = average win / average loss ratio

**Risk Management:**
- **Maximum Drawdown Control:** Stop trading if drawdown exceeds threshold
- **Volatility Targeting:** Adjust position size based on realized volatility
- **Slippage Modeling:** Buy price = market × (1 + slippage), Sell price = market × (1 - slippage)

### Mathematical Variables

| Variable | Description | Current Value |
|----------|-------------|---------------|
| **RSI_THRESHOLD_LOW** | Oversold level for buy signals | 30 |
| **RSI_THRESHOLD_HIGH** | Overbought level for sell signals | 70 |
| **SMA_FAST** | Fast moving average period | 20 |
| **SMA_SLOW** | Slow moving average period | 50 |
| **MAX_DRAWDOWN** | Maximum acceptable drawdown | 20% |
| **SLIPPAGE_RATE** | Expected execution slippage | ${result.performance?.slippageRate || 0.1}% |

### Performance Equations

**Sharpe Ratio:** (Mean Return - Risk Free Rate) / Standard Deviation of Returns
**Calmar Ratio:** Annual Return / Maximum Drawdown
**Win Rate:** (Winning Trades / Total Trades) × 100

---

## 🔬 Algorithm Performance Analysis

Based on the benchmark results, Stevie's algorithm demonstrates:

${this.generatePerformanceAnalysis(result.performance)}

---

## 📋 Recommendations

${this.generateRecommendations(result.performance)}

---

## 📊 Historical Context

This benchmark represents Stevie's performance under controlled market conditions with realistic slippage and noise modeling. The algorithm's adaptive learning capabilities continue to evolve with each training session.

**Next Steps:**
1. Deploy to paper trading environment
2. Monitor real-time performance
3. Collect feedback for further optimization
4. Scale to full production deployment

---

*Report generated automatically by Skippy Benchmark System*
`;
  }

  private generatePerformanceAnalysis(performance: any): string {
    if (!performance) return "No performance data available.";

    const analysis = [];
    
    if (performance.sharpeRatio > 1.5) {
      analysis.push("✅ **Excellent Risk-Adjusted Returns** - Sharpe ratio above 1.5 indicates strong performance");
    } else if (performance.sharpeRatio > 1.0) {
      analysis.push("🟡 **Good Risk-Adjusted Returns** - Sharpe ratio above 1.0 is acceptable");
    } else {
      analysis.push("🔴 **Poor Risk-Adjusted Returns** - Sharpe ratio needs improvement");
    }

    if (performance.maxDrawdown < 10) {
      analysis.push("✅ **Low Drawdown Risk** - Maximum drawdown under 10%");
    } else if (performance.maxDrawdown < 20) {
      analysis.push("🟡 **Moderate Drawdown Risk** - Maximum drawdown manageable");
    } else {
      analysis.push("🔴 **High Drawdown Risk** - Consider reducing position sizing");
    }

    if (performance.winRate > 60) {
      analysis.push("✅ **High Win Rate** - Algorithm shows good trade selection");
    } else if (performance.winRate > 50) {
      analysis.push("🟡 **Average Win Rate** - Performance is acceptable");
    } else {
      analysis.push("🔴 **Low Win Rate** - Algorithm may need recalibration");
    }

    return analysis.join('\n\n');
  }

  private generateRecommendations(performance: any): string {
    if (!performance) return "No performance data available for recommendations.";

    const recommendations = [];

    if (performance.sharpeRatio < 1.0) {
      recommendations.push("📈 **Improve Risk-Adjusted Returns:** Consider adjusting position sizing or signal thresholds");
    }

    if (performance.maxDrawdown > 15) {
      recommendations.push("🛡️ **Reduce Drawdown:** Implement stricter stop-loss rules or reduce leverage");
    }

    if (performance.totalTrades < 10) {
      recommendations.push("🔄 **Increase Trading Frequency:** Consider more sensitive signal parameters");
    }

    if (performance.volatility > 25) {
      recommendations.push("📊 **Reduce Volatility:** Implement volatility targeting in position sizing");
    }

    if (recommendations.length === 0) {
      recommendations.push("🎉 **Algorithm Performing Well:** Consider deployment to live paper trading");
    }

    return recommendations.join('\n\n');
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const exporter = new BenchmarkPDFExporter();
  exporter.exportToPDF().catch(console.error);
}

export { BenchmarkPDFExporter };
