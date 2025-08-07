#!/usr/bin/env tsx

/**
 * STEVIE V1.4 LEGACY BENCHMARK TEST
 * Matches the format and scope of original Stevie v1.x and v2.x benchmarks
 * Tests core trading functionality, AI performance, and system reliability
 */

import axios from 'axios';
import fs from 'fs';
import { performance } from 'perf_hooks';

interface LegacyBenchmarkResult {
  testName: string;
  success: boolean;
  responseTime: number;
  score: number;
  details?: any;
  error?: string;
}

interface LegacyBenchmarkReport {
  version: string;
  timestamp: number;
  overallScore: number;
  totalTests: number;
  passedTests: number;
  averageResponseTime: number;
  categories: {
    aiPerformance: number;
    tradingEngine: number;
    marketData: number;
    riskManagement: number;
    userInterface: number;
    systemReliability: number;
  };
  results: LegacyBenchmarkResult[];
  recommendations: string[];
}

class StevieV14LegacyBenchmark {
  private baseUrl = 'http://localhost:5000';
  private results: LegacyBenchmarkResult[] = [];

  async runLegacyBenchmark(): Promise<LegacyBenchmarkReport> {
    console.log('🎯 STEVIE V1.4 LEGACY BENCHMARK (v1/v2 Format)');
    console.log('Testing core functionality with original test structure\n');

    // Core functionality tests (matching v1/v2 structure)
    await this.testAIPerformance();
    await this.testTradingEngine();
    await this.testMarketData();
    await this.testRiskManagement();
    await this.testUserInterface();
    await this.testSystemReliability();

    return this.generateLegacyReport();
  }

  async testAIPerformance(): Promise<void> {
    console.log('🧠 Testing AI Performance...');

    // Test 1: AI Recommendations
    await this.testEndpoint(
      'AI Recommendations',
      async () => {
        const response = await axios.get(`${this.baseUrl}/api/ai/recommendations`);
        return { success: true, data: response.data };
      },
      (result) => result.data !== undefined ? 85 : 0
    );

    // Test 2: Market Analysis
    await this.testEndpoint(
      'Market Analysis',
      async () => {
        const response = await axios.post(`${this.baseUrl}/api/ai/analyze`, {
          symbol: 'BTC/USD',
          timeframe: '1h',
          indicators: ['RSI', 'MACD', 'MA']
        });
        return { success: true, data: response.data };
      },
      (result) => result.data?.analysis ? 90 : 0
    );

    // Test 3: Stevie Chat Interface
    await this.testEndpoint(
      'Stevie Chat',
      async () => {
        const response = await axios.post(`${this.baseUrl}/api/stevie/chat`, {
          message: 'What is the current BTC trend?'
        });
        return { success: true, data: response.data };
      },
      (result) => result.data?.response ? 80 : 0
    );

    // Test 4: Pattern Recognition
    await this.testEndpoint(
      'Pattern Recognition',
      async () => {
        const response = await axios.get(`${this.baseUrl}/api/ai/patterns?symbol=BTC-USD`);
        return { success: true, data: response.data };
      },
      (result) => result.data ? 75 : 0
    );
  }

  async testTradingEngine(): Promise<void> {
    console.log('💰 Testing Trading Engine...');

    // Test 1: Trade Execution
    await this.testEndpoint(
      'Trade Execution',
      async () => {
        const response = await axios.post(`${this.baseUrl}/api/trading/execute`, {
          symbol: 'BTC/USD',
          action: 'buy',
          amount: 0.01,
          type: 'market'
        });
        return { success: true, data: response.data };
      },
      (result) => result.data?.success ? 95 : 0
    );

    // Test 2: Portfolio Management
    await this.testEndpoint(
      'Portfolio Summary',
      async () => {
        const response = await axios.get(`${this.baseUrl}/api/portfolio/summary`);
        return { success: true, data: response.data };
      },
      (result) => result.data?.success ? 90 : 0
    );

    // Test 3: Trade History
    await this.testEndpoint(
      'Trade History',
      async () => {
        const response = await axios.get(`${this.baseUrl}/api/trading/trades`);
        return { success: true, data: response.data };
      },
      (result) => Array.isArray(result.data) ? 85 : 0
    );

    // Test 4: Position Management
    await this.testEndpoint(
      'Position Management',
      async () => {
        const response = await axios.get(`${this.baseUrl}/api/portfolio/positions`);
        return { success: true, data: response.data };
      },
      (result) => result.data ? 80 : 0
    );
  }

  async testMarketData(): Promise<void> {
    console.log('📈 Testing Market Data...');

    // Test 1: Real-time Prices
    await this.testEndpoint(
      'Real-time Prices',
      async () => {
        const response = await axios.get(`${this.baseUrl}/api/market/price/BTC-USD`);
        return { success: true, data: response.data };
      },
      (result) => result.data?.price ? 95 : 0
    );

    // Test 2: Market Overview
    await this.testEndpoint(
      'Market Overview',
      async () => {
        const response = await axios.get(`${this.baseUrl}/api/market/overview`);
        return { success: true, data: response.data };
      },
      (result) => result.data?.success ? 90 : 0
    );

    // Test 3: Technical Indicators
    await this.testEndpoint(
      'Technical Indicators',
      async () => {
        const response = await axios.get(`${this.baseUrl}/api/market/indicators/BTC-USD`);
        return { success: true, data: response.data };
      },
      (result) => result.data ? 85 : 0
    );

    // Test 4: Market News
    await this.testEndpoint(
      'Market News',
      async () => {
        const response = await axios.get(`${this.baseUrl}/api/market/news`);
        return { success: true, data: response.data };
      },
      (result) => result.data ? 75 : 0
    );
  }

  async testRiskManagement(): Promise<void> {
    console.log('🛡️ Testing Risk Management...');

    // Test 1: Risk Assessment
    await this.testEndpoint(
      'Risk Assessment',
      async () => {
        const response = await axios.post(`${this.baseUrl}/api/risk/assess`, {
          symbol: 'BTC/USD',
          position: { size: 0.1, direction: 'long' },
          portfolio: { totalValue: 10000 }
        });
        return { success: true, data: response.data };
      },
      (result) => result.data ? 90 : 0
    );

    // Test 2: Position Sizing
    await this.testEndpoint(
      'Position Sizing',
      async () => {
        const response = await axios.post(`${this.baseUrl}/api/risk/position-size`, {
          symbol: 'BTC/USD',
          accountSize: 10000,
          riskPerTrade: 0.02
        });
        return { success: true, data: response.data };
      },
      (result) => result.data ? 85 : 0
    );

    // Test 3: Stop Loss Calculation
    await this.testEndpoint(
      'Stop Loss Calculation',
      async () => {
        const response = await axios.post(`${this.baseUrl}/api/risk/stop-loss`, {
          symbol: 'BTC/USD',
          entryPrice: 45000,
          riskTolerance: 0.02
        });
        return { success: true, data: response.data };
      },
      (result) => result.data ? 80 : 0
    );

    // Test 4: Portfolio Risk
    await this.testEndpoint(
      'Portfolio Risk',
      async () => {
        const response = await axios.get(`${this.baseUrl}/api/risk/portfolio`);
        return { success: true, data: response.data };
      },
      (result) => result.data ? 85 : 0
    );
  }

  async testUserInterface(): Promise<void> {
    console.log('🖥️ Testing User Interface...');

    // Test 1: User Preferences
    await this.testEndpoint(
      'User Preferences',
      async () => {
        const response = await axios.get(`${this.baseUrl}/api/preferences`);
        return { success: true, data: response.data };
      },
      (result) => result.data ? 90 : 0
    );

    // Test 2: Dashboard Data
    await this.testEndpoint(
      'Dashboard Data',
      async () => {
        const response = await axios.get(`${this.baseUrl}/api/dashboard`);
        return { success: true, data: response.data };
      },
      (result) => result.data ? 85 : 0
    );

    // Test 3: Notifications
    await this.testEndpoint(
      'Notifications',
      async () => {
        const response = await axios.get(`${this.baseUrl}/api/notifications`);
        return { success: true, data: response.data };
      },
      (result) => result.data ? 80 : 0
    );

    // Test 4: Settings Management
    await this.testEndpoint(
      'Settings Management',
      async () => {
        const response = await axios.get(`${this.baseUrl}/api/settings`);
        return { success: true, data: response.data };
      },
      (result) => result.data ? 75 : 0
    );
  }

  async testSystemReliability(): Promise<void> {
    console.log('⚡ Testing System Reliability...');

    // Test 1: System Health
    await this.testEndpoint(
      'System Health',
      async () => {
        const response = await axios.get(`${this.baseUrl}/api/health`);
        return { success: true, data: response.data };
      },
      (result) => result.data?.status ? 95 : 0
    );

    // Test 2: Database Connection
    await this.testEndpoint(
      'Database Connection',
      async () => {
        const response = await axios.get(`${this.baseUrl}/api/system/database`);
        return { success: true, data: response.data };
      },
      (result) => result.data ? 90 : 0
    );

    // Test 3: API Response Time
    await this.testEndpoint(
      'API Response Time',
      async () => {
        const start = performance.now();
        const response = await axios.get(`${this.baseUrl}/api/ping`);
        const responseTime = performance.now() - start;
        return { 
          success: true, 
          data: response.data,
          responseTime 
        };
      },
      (result) => (result.responseTime && result.responseTime < 100) ? 95 : 
                  (result.responseTime && result.responseTime < 200) ? 85 :
                  (result.responseTime && result.responseTime < 500) ? 75 : 50
    );

    // Test 4: Error Handling
    await this.testEndpoint(
      'Error Handling',
      async () => {
        try {
          await axios.get(`${this.baseUrl}/api/nonexistent-endpoint`);
          return { success: false, data: null };
        } catch (error: any) {
          // We expect this to fail gracefully
          return { 
            success: true, 
            data: { statusCode: error.response?.status } 
          };
        }
      },
      (result) => result.data?.statusCode === 404 ? 90 : 0
    );
  }

  async testEndpoint(
    testName: string,
    testFn: () => Promise<any>,
    scoreFn: (result: any) => number
  ): Promise<void> {
    const startTime = performance.now();
    
    try {
      const result = await testFn();
      const responseTime = performance.now() - startTime;
      const score = scoreFn(result);
      
      this.results.push({
        testName,
        success: true,
        responseTime,
        score,
        details: result
      });
      
      const status = score >= 80 ? '✅' : score >= 60 ? '🟡' : '❌';
      console.log(`  ${status} ${testName} - ${responseTime.toFixed(0)}ms - Score: ${score}`);
      
    } catch (error: any) {
      const responseTime = performance.now() - startTime;
      
      this.results.push({
        testName,
        success: false,
        responseTime,
        score: 0,
        error: error.message
      });
      
      console.log(`  ❌ ${testName} - ${responseTime.toFixed(0)}ms - Error: ${error.message}`);
    }
    
    // Brief delay between tests
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  private generateLegacyReport(): LegacyBenchmarkReport {
    const totalTests = this.results.length;
    const passedTests = this.results.filter(r => r.success).length;
    const averageResponseTime = this.results.reduce((sum, r) => sum + r.responseTime, 0) / totalTests;
    const overallScore = this.results.reduce((sum, r) => sum + r.score, 0) / totalTests;

    // Calculate category scores (matching v1/v2 structure)
    const categories = {
      aiPerformance: this.calculateCategoryScore(['AI Recommendations', 'Market Analysis', 'Stevie Chat', 'Pattern Recognition']),
      tradingEngine: this.calculateCategoryScore(['Trade Execution', 'Portfolio Summary', 'Trade History', 'Position Management']),
      marketData: this.calculateCategoryScore(['Real-time Prices', 'Market Overview', 'Technical Indicators', 'Market News']),
      riskManagement: this.calculateCategoryScore(['Risk Assessment', 'Position Sizing', 'Stop Loss Calculation', 'Portfolio Risk']),
      userInterface: this.calculateCategoryScore(['User Preferences', 'Dashboard Data', 'Notifications', 'Settings Management']),
      systemReliability: this.calculateCategoryScore(['System Health', 'Database Connection', 'API Response Time', 'Error Handling'])
    };

    const recommendations = this.generateRecommendations(categories);

    return {
      version: '1.4.0',
      timestamp: Date.now(),
      overallScore,
      totalTests,
      passedTests,
      averageResponseTime,
      categories,
      results: this.results,
      recommendations
    };
  }

  private calculateCategoryScore(testNames: string[]): number {
    const categoryResults = this.results.filter(r => testNames.includes(r.testName));
    if (categoryResults.length === 0) return 0;
    return categoryResults.reduce((sum, r) => sum + r.score, 0) / categoryResults.length;
  }

  private generateRecommendations(categories: any): string[] {
    const recommendations: string[] = [];
    
    Object.entries(categories).forEach(([category, score]) => {
      if ((score as number) < 70) {
        recommendations.push(`Improve ${category.replace(/([A-Z])/g, ' $1').toLowerCase()}`);
      }
    });

    const failedTests = this.results.filter(r => !r.success);
    if (failedTests.length > 0) {
      recommendations.push(`Fix ${failedTests.length} failing endpoints`);
    }

    const slowTests = this.results.filter(r => r.responseTime > 500);
    if (slowTests.length > 0) {
      recommendations.push(`Optimize ${slowTests.length} slow endpoints`);
    }

    if (recommendations.length === 0) {
      recommendations.push('System performing optimally');
    }

    return recommendations;
  }
}

// Main execution
async function runLegacyBenchmark() {
  const benchmark = new StevieV14LegacyBenchmark();
  const report = await benchmark.runLegacyBenchmark();
  
  // Save report
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `stevie_v14_legacy_benchmark_${timestamp.slice(0, 19)}.json`;
  fs.writeFileSync(filename, JSON.stringify(report, null, 2));
  
  // Display results (v1/v2 format)
  console.log('\n📊 STEVIE V1.4 BENCHMARK RESULTS (Legacy Format)');
  console.log('='.repeat(55));
  console.log(`🎯 Overall Score: ${report.overallScore.toFixed(1)}/100`);
  console.log(`✅ Tests Passed: ${report.passedTests}/${report.totalTests}`);
  console.log(`⚡ Avg Response: ${report.averageResponseTime.toFixed(0)}ms`);
  
  console.log('\n📂 Category Breakdown:');
  console.log(`  🧠 AI Performance: ${report.categories.aiPerformance.toFixed(1)}/100`);
  console.log(`  💰 Trading Engine: ${report.categories.tradingEngine.toFixed(1)}/100`);
  console.log(`  📈 Market Data: ${report.categories.marketData.toFixed(1)}/100`);
  console.log(`  🛡️ Risk Management: ${report.categories.riskManagement.toFixed(1)}/100`);
  console.log(`  🖥️ User Interface: ${report.categories.userInterface.toFixed(1)}/100`);
  console.log(`  ⚡ System Reliability: ${report.categories.systemReliability.toFixed(1)}/100`);
  
  console.log('\n💡 Recommendations:');
  report.recommendations.forEach(rec => console.log(`  • ${rec}`));
  
  console.log(`\n📄 Full report: ${filename}`);
  console.log('\n🏆 BENCHMARK COMPLETE');
  
  return report;
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runLegacyBenchmark().catch(console.error);
}

export { runLegacyBenchmark, StevieV14LegacyBenchmark };