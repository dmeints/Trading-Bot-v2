#!/usr/bin/env tsx

/**
 * STEVIE V1.4 COMPREHENSIVE BENCHMARK TEST
 * Tests all 6 exceptional enhancements with production validation
 * 
 * Enhancement Areas:
 * 1. Real-Time Learning & Adaptation
 * 2. Enhanced Stevie Personality & Memory  
 * 3. Advanced Risk Intelligence
 * 4. Multi-Timeframe Strategies
 * 5. Market Intelligence
 * 6. Production Monitoring & Excellence
 */

import axios from 'axios';
import fs from 'fs';
import { performance } from 'perf_hooks';

interface BenchmarkResult {
  enhancement: string;
  endpoint: string;
  success: boolean;
  responseTime: number;
  dataQuality: number;
  functionalityScore: number;
  error?: string;
  response?: any;
}

interface ComprehensiveBenchmark {
  timestamp: number;
  version: string;
  totalTests: number;
  passedTests: number;
  averageResponseTime: number;
  overallScore: number;
  enhancementScores: Record<string, number>;
  results: BenchmarkResult[];
  systemHealthCheck: any;
  recommendations: string[];
}

class StevieV14BenchmarkSuite {
  private baseUrl = 'http://localhost:5000';
  private results: BenchmarkResult[] = [];
  private testData = {
    marketData: {
      symbol: 'BTC/USD',
      price: 45000,
      rsi: 55,
      sma20: 45000,
      sma50: 43000,
      volume: 2500000,
      volatility: 0.05
    },
    userProfile: {
      experienceLevel: 'intermediate',
      riskTolerance: 0.6,
      learningPreferences: ['technical_analysis', 'fundamental_analysis'],
      tradingStyle: 'momentum'
    },
    tradeData: {
      tradeId: 'test_trade_001',
      symbol: 'BTC/USD',
      action: 'buy' as const,
      entryPrice: 44500,
      exitPrice: 45500,
      confidence: 0.75,
      profit: 1000
    }
  };

  async runComprehensiveBenchmark(): Promise<ComprehensiveBenchmark> {
    console.log('🚀 STEVIE V1.4 COMPREHENSIVE BENCHMARK TEST STARTING...\n');

    // Test all 6 exceptional enhancements
    await this.testRealTimeLearning();
    await this.testSteviePersonality();
    await this.testAdvancedRisk();
    await this.testMultiTimeframe();
    await this.testMarketIntelligence();
    await this.testProductionMonitoring();

    // System integration tests
    await this.testSystemIntegration();

    return this.generateBenchmarkReport();
  }

  async testRealTimeLearning(): Promise<void> {
    console.log('📊 Testing Real-Time Learning & Adaptation...');

    // Test 1: Market Regime Detection
    await this.testEndpoint(
      'Real-Time Learning',
      'POST /api/learning/regime',
      async () => {
        const response = await axios.post(`${this.baseUrl}/api/learning/regime`, {
          symbol: this.testData.marketData.symbol,
          rsi: this.testData.marketData.rsi,
          sma20: this.testData.marketData.sma20,
          sma50: this.testData.marketData.sma50,
          volume: this.testData.marketData.volume,
          volatility: this.testData.marketData.volatility
        });
        return response.data;
      }
    );

    // Test 2: Trade Outcome Learning
    await this.testEndpoint(
      'Real-Time Learning',
      'POST /api/learning/outcome',
      async () => {
        const response = await axios.post(`${this.baseUrl}/api/learning/outcome`, {
          ...this.testData.tradeData,
          features: {
            sentimentSignal: 0.3,
            technicalSignal: 0.7,
            derivativesSignal: 0.1
          }
        });
        return response.data;
      }
    );

    // Test 3: Parameter Optimization
    await this.testEndpoint(
      'Real-Time Learning',
      'POST /api/learning/optimize',
      async () => {
        const response = await axios.post(`${this.baseUrl}/api/learning/optimize`, {
          strategy: 'momentum',
          performanceWindow: 30
        });
        return response.data;
      }
    );

    // Test 4: Adaptive Strategy Selection
    await this.testEndpoint(
      'Real-Time Learning',
      'GET /api/learning/strategy/bull',
      async () => {
        const response = await axios.get(`${this.baseUrl}/api/learning/strategy/bull`);
        return response.data;
      }
    );
  }

  async testSteviePersonality(): Promise<void> {
    console.log('🧠 Testing Enhanced Stevie Personality & Memory...');

    // Test 1: User Profile Initialization
    await this.testEndpoint(
      'Stevie Personality',
      'POST /api/stevie/profile',
      async () => {
        const response = await axios.post(`${this.baseUrl}/api/stevie/profile`, this.testData.userProfile);
        return response.data;
      }
    );

    // Test 2: Enhanced Chat Interface
    await this.testEndpoint(
      'Stevie Personality',
      'POST /api/stevie/chat-enhanced',
      async () => {
        const response = await axios.post(`${this.baseUrl}/api/stevie/chat-enhanced`, {
          message: 'What should I know about current BTC market conditions?',
          context: { symbol: 'BTC/USD', marketCondition: 'volatile' }
        });
        return response.data;
      }
    );

    // Test 3: Trade Memory Storage
    await this.testEndpoint(
      'Stevie Personality',
      'POST /api/stevie/memory/trade',
      async () => {
        const response = await axios.post(`${this.baseUrl}/api/stevie/memory/trade`, {
          ...this.testData.tradeData,
          reasoning: 'Bullish breakout pattern with strong volume confirmation'
        });
        return response.data;
      }
    );

    // Test 4: Pattern Recognition
    await this.testEndpoint(
      'Stevie Personality',
      'GET /api/stevie/patterns/BTC-USD',
      async () => {
        const response = await axios.get(`${this.baseUrl}/api/stevie/patterns/BTC-USD`);
        return response.data;
      }
    );
  }

  async testAdvancedRisk(): Promise<void> {
    console.log('🛡️ Testing Advanced Risk Intelligence...');

    // Test 1: Multi-Dimensional Risk Assessment
    await this.testEndpoint(
      'Advanced Risk',
      'POST /api/risk/assess',
      async () => {
        const response = await axios.post(`${this.baseUrl}/api/risk/assess`, {
          symbol: this.testData.marketData.symbol,
          price: this.testData.marketData.price,
          position: { size: 0.1, direction: 'long' },
          portfolio: { totalValue: 10000 },
          marketData: { 
            volatility: this.testData.marketData.volatility,
            liquidity: 0.8 
          }
        });
        return response.data;
      }
    );

    // Test 2: Dynamic Position Sizing
    await this.testEndpoint(
      'Advanced Risk',
      'POST /api/risk/position-size',
      async () => {
        const response = await axios.post(`${this.baseUrl}/api/risk/position-size`, {
          symbol: this.testData.marketData.symbol,
          accountSize: 10000,
          riskPerTrade: 0.02,
          entryPrice: 44500,
          stopLoss: 43500,
          marketVolatility: 0.05
        });
        return response.data;
      }
    );

    // Test 3: Black Swan Detection
    await this.testEndpoint(
      'Advanced Risk',
      'POST /api/risk/black-swan',
      async () => {
        const response = await axios.post(`${this.baseUrl}/api/risk/black-swan`, {
          symbol: this.testData.marketData.symbol,
          timeframe: '1h',
          lookbackPeriods: 168
        });
        return response.data;
      }
    );

    // Test 4: Liquidity-Aware Ordering
    await this.testEndpoint(
      'Advanced Risk',
      'POST /api/risk/liquidity-order',
      async () => {
        const response = await axios.post(`${this.baseUrl}/api/risk/liquidity-order`, {
          symbol: this.testData.marketData.symbol,
          orderSize: 5000,
          maxSlippage: 0.001,
          timeLimit: 300
        });
        return response.data;
      }
    );
  }

  async testMultiTimeframe(): Promise<void> {
    console.log('📊 Testing Multi-Timeframe Strategies...');

    // Test 1: Strategy Orchestration
    await this.testEndpoint(
      'Multi-Timeframe',
      'POST /api/timeframes/orchestrate',
      async () => {
        const response = await axios.post(`${this.baseUrl}/api/timeframes/orchestrate`, {
          symbol: this.testData.marketData.symbol,
          strategies: {
            '1m': { type: 'scalping', allocation: 0.2 },
            '5m': { type: 'momentum', allocation: 0.5 },
            '1h': { type: 'trend_following', allocation: 0.3 }
          }
        });
        return response.data;
      }
    );

    // Test 2: Multi-Timeframe Analysis
    await this.testEndpoint(
      'Multi-Timeframe',
      'GET /api/timeframes/analysis/BTC-USD',
      async () => {
        const response = await axios.get(`${this.baseUrl}/api/timeframes/analysis/BTC-USD`);
        return response.data;
      }
    );

    // Test 3: Performance Tracking
    await this.testEndpoint(
      'Multi-Timeframe',
      'POST /api/timeframes/performance',
      async () => {
        const response = await axios.post(`${this.baseUrl}/api/timeframes/performance`, {
          strategyId: 'momentum_5m',
          performance: {
            totalTrades: 45,
            winRate: 0.62,
            avgProfit: 0.008,
            maxDrawdown: 0.15,
            sharpeRatio: 1.3
          }
        });
        return response.data;
      }
    );

    // Test 4: Allocation Optimization
    await this.testEndpoint(
      'Multi-Timeframe',
      'GET /api/timeframes/allocation',
      async () => {
        const response = await axios.get(`${this.baseUrl}/api/timeframes/allocation?symbol=BTC-USD`);
        return response.data;
      }
    );
  }

  async testMarketIntelligence(): Promise<void> {
    console.log('🔍 Testing Market Intelligence...');

    // Test 1: Order Flow Analysis
    await this.testEndpoint(
      'Market Intelligence',
      'GET /api/intelligence/order-flow/BTC-USD',
      async () => {
        const response = await axios.get(`${this.baseUrl}/api/intelligence/order-flow/BTC-USD`);
        return response.data;
      }
    );

    // Test 2: Whale Movement Tracking
    await this.testEndpoint(
      'Market Intelligence',
      'GET /api/intelligence/whales/BTC-USD',
      async () => {
        const response = await axios.get(`${this.baseUrl}/api/intelligence/whales/BTC-USD`);
        return response.data;
      }
    );

    // Test 3: Arbitrage Detection
    await this.testEndpoint(
      'Market Intelligence',
      'GET /api/intelligence/arbitrage',
      async () => {
        const response = await axios.get(`${this.baseUrl}/api/intelligence/arbitrage?symbol=BTC-USD`);
        return response.data;
      }
    );

    // Test 4: Options Flow Analysis
    await this.testEndpoint(
      'Market Intelligence',
      'GET /api/intelligence/options/BTC-USD',
      async () => {
        const response = await axios.get(`${this.baseUrl}/api/intelligence/options/BTC-USD`);
        return response.data;
      }
    );

    // Test 5: Intelligence Summary
    await this.testEndpoint(
      'Market Intelligence',
      'GET /api/intelligence/summary/BTC-USD',
      async () => {
        const response = await axios.get(`${this.baseUrl}/api/intelligence/summary/BTC-USD`);
        return response.data;
      }
    );
  }

  async testProductionMonitoring(): Promise<void> {
    console.log('📈 Testing Production Monitoring & Excellence...');

    // Test 1: System Health Dashboard
    await this.testEndpoint(
      'Production Monitoring',
      'GET /api/monitoring/health',
      async () => {
        const response = await axios.get(`${this.baseUrl}/api/monitoring/health`);
        return response.data;
      }
    );

    // Test 2: Performance Dashboard
    await this.testEndpoint(
      'Production Monitoring',
      'GET /api/monitoring/performance',
      async () => {
        const response = await axios.get(`${this.baseUrl}/api/monitoring/performance?period=24h`);
        return response.data;
      }
    );

    // Test 3: A/B Testing Framework
    await this.testEndpoint(
      'Production Monitoring',
      'POST /api/monitoring/ab-test',
      async () => {
        const response = await axios.post(`${this.baseUrl}/api/monitoring/ab-test`, {
          testName: 'risk_threshold_optimization',
          variants: {
            control: { riskThreshold: 0.02 },
            variant_a: { riskThreshold: 0.025 },
            variant_b: { riskThreshold: 0.015 }
          },
          duration: 7
        });
        return response.data;
      }
    );

    // Test 4: Automated Reporting
    await this.testEndpoint(
      'Production Monitoring',
      'POST /api/monitoring/report',
      async () => {
        const response = await axios.post(`${this.baseUrl}/api/monitoring/report`, {
          reportType: 'daily_performance',
          metrics: ['pnl', 'win_rate', 'max_drawdown', 'sharpe_ratio'],
          format: 'detailed'
        });
        return response.data;
      }
    );

    // Test 5: Performance Optimization
    await this.testEndpoint(
      'Production Monitoring',
      'POST /api/monitoring/optimize',
      async () => {
        const response = await axios.post(`${this.baseUrl}/api/monitoring/optimize`, {
          optimizationType: 'parameter_tuning',
          targetMetric: 'sharpe_ratio',
          constraints: { maxDrawdown: 0.2, minWinRate: 0.55 }
        });
        return response.data;
      }
    );

    // Test 6: Predictive Alerts Setup
    await this.testEndpoint(
      'Production Monitoring',
      'POST /api/monitoring/alerts/setup',
      async () => {
        const response = await axios.post(`${this.baseUrl}/api/monitoring/alerts/setup`, {
          alertType: 'performance_degradation',
          threshold: 0.1,
          lookbackPeriod: 24,
          severity: 'medium'
        });
        return response.data;
      }
    );
  }

  async testSystemIntegration(): Promise<void> {
    console.log('🔗 Testing System Integration...');

    // Test unified enhancement status
    await this.testEndpoint(
      'System Integration',
      'GET /api/enhancements/status',
      async () => {
        const response = await axios.get(`${this.baseUrl}/api/enhancements/status`);
        return response.data;
      }
    );
  }

  async testEndpoint(
    enhancement: string, 
    endpoint: string, 
    testFn: () => Promise<any>
  ): Promise<void> {
    const startTime = performance.now();
    
    try {
      const response = await testFn();
      const responseTime = performance.now() - startTime;
      
      const dataQuality = this.assessDataQuality(response);
      const functionalityScore = this.assessFunctionality(response, enhancement);
      
      this.results.push({
        enhancement,
        endpoint,
        success: true,
        responseTime,
        dataQuality,
        functionalityScore,
        response
      });
      
      console.log(`  ✅ ${endpoint} - ${responseTime.toFixed(0)}ms - Quality: ${dataQuality.toFixed(2)}`);
    } catch (error: any) {
      const responseTime = performance.now() - startTime;
      
      this.results.push({
        enhancement,
        endpoint,
        success: false,
        responseTime,
        dataQuality: 0,
        functionalityScore: 0,
        error: error.message || 'Unknown error'
      });
      
      console.log(`  ❌ ${endpoint} - ${responseTime.toFixed(0)}ms - Error: ${error.message || 'Unknown error'}`);
    }
    
    // Brief delay between tests
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  private assessDataQuality(response: any): number {
    if (!response) return 0;
    
    let score = 0.5; // Base score for successful response
    
    // Check for data completeness
    if (response.success !== undefined) score += 0.2;
    if (response.data) score += 0.2;
    if (response.timestamp || response.data?.timestamp) score += 0.1;
    
    return Math.min(1.0, score);
  }

  private assessFunctionality(response: any, enhancement: string): number {
    if (!response) return 0;
    
    let score = 0.5; // Base score
    
    // Enhancement-specific functionality checks
    switch (enhancement) {
      case 'Real-Time Learning':
        if (response.data?.regime || response.data?.strategy || response.success) score += 0.3;
        if (response.data?.confidence !== undefined) score += 0.2;
        break;
        
      case 'Stevie Personality':
        if (response.data?.profile || response.data?.response || response.success) score += 0.3;
        if (response.data?.personality || response.data?.memory) score += 0.2;
        break;
        
      case 'Advanced Risk':
        if (response.data?.riskScore || response.data?.positionSize || response.success) score += 0.3;
        if (response.data?.factors || response.data?.recommendations) score += 0.2;
        break;
        
      case 'Multi-Timeframe':
        if (response.data?.shortTerm || response.data?.mediumTerm || response.success) score += 0.3;
        if (response.data?.allocation || response.data?.signals) score += 0.2;
        break;
        
      case 'Market Intelligence':
        if (response.data?.orderFlow || response.data?.whaleActivity || response.success) score += 0.3;
        if (response.data?.arbitrageOpportunities || response.data?.optionsSignals) score += 0.2;
        break;
        
      case 'Production Monitoring':
        if (response.data?.systemHealth || response.data?.performance || response.success) score += 0.3;
        if (response.data?.overallScore || response.data?.metrics) score += 0.2;
        break;
        
      default:
        if (response.success) score += 0.3;
        if (response.data) score += 0.2;
    }
    
    return Math.min(1.0, score);
  }

  private generateBenchmarkReport(): ComprehensiveBenchmark {
    const passedTests = this.results.filter(r => r.success).length;
    const totalTests = this.results.length;
    const averageResponseTime = this.results.reduce((sum, r) => sum + r.responseTime, 0) / totalTests;
    
    // Calculate enhancement-specific scores
    const enhancementScores: Record<string, number> = {};
    const enhancements = [...new Set(this.results.map(r => r.enhancement))];
    
    enhancements.forEach(enhancement => {
      const enhancementResults = this.results.filter(r => r.enhancement === enhancement);
      const avgFunctionality = enhancementResults.reduce((sum, r) => sum + r.functionalityScore, 0) / enhancementResults.length;
      const avgDataQuality = enhancementResults.reduce((sum, r) => sum + r.dataQuality, 0) / enhancementResults.length;
      const successRate = enhancementResults.filter(r => r.success).length / enhancementResults.length;
      
      enhancementScores[enhancement] = (avgFunctionality * 0.4 + avgDataQuality * 0.3 + successRate * 0.3);
    });
    
    const overallScore = Object.values(enhancementScores).reduce((sum, score) => sum + score, 0) / Object.keys(enhancementScores).length;
    
    // Generate recommendations
    const recommendations = this.generateRecommendations();
    
    const report: ComprehensiveBenchmark = {
      timestamp: Date.now(),
      version: '1.4.0-exceptional-enhancements',
      totalTests,
      passedTests,
      averageResponseTime,
      overallScore,
      enhancementScores,
      results: this.results,
      systemHealthCheck: this.results.find(r => r.endpoint.includes('/api/enhancements/status'))?.response,
      recommendations
    };
    
    return report;
  }

  private generateRecommendations(): string[] {
    const recommendations: string[] = [];
    const failedTests = this.results.filter(r => !r.success);
    
    if (failedTests.length > 0) {
      recommendations.push(`Fix ${failedTests.length} failed endpoints for complete functionality`);
    }
    
    const slowTests = this.results.filter(r => r.responseTime > 1000);
    if (slowTests.length > 0) {
      recommendations.push(`Optimize ${slowTests.length} endpoints with >1s response time`);
    }
    
    const lowQualityTests = this.results.filter(r => r.dataQuality < 0.7);
    if (lowQualityTests.length > 0) {
      recommendations.push(`Improve data quality for ${lowQualityTests.length} endpoints`);
    }
    
    if (recommendations.length === 0) {
      recommendations.push('All systems performing optimally - ready for production deployment');
    }
    
    return recommendations;
  }
}

// Main execution function
async function runBenchmark() {
  const benchmark = new StevieV14BenchmarkSuite();
  const report = await benchmark.runComprehensiveBenchmark();
  
  // Save detailed report
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `stevie_v14_benchmark_${timestamp.slice(0, 19)}.json`;
  
  fs.writeFileSync(filename, JSON.stringify(report, null, 2));
  
  // Print summary
  console.log('\n📊 STEVIE V1.4 COMPREHENSIVE BENCHMARK RESULTS');
  console.log('='.repeat(60));
  console.log(`🎯 Overall Score: ${(report.overallScore * 100).toFixed(1)}%`);
  console.log(`✅ Tests Passed: ${report.passedTests}/${report.totalTests} (${((report.passedTests/report.totalTests)*100).toFixed(1)}%)`);
  console.log(`⚡ Avg Response Time: ${report.averageResponseTime.toFixed(0)}ms`);
  console.log(`📅 Version: ${report.version}`);
  
  console.log('\n🚀 Enhancement Scores:');
  Object.entries(report.enhancementScores).forEach(([enhancement, score]) => {
    const emoji = score > 0.8 ? '🟢' : score > 0.6 ? '🟡' : '🔴';
    console.log(`  ${emoji} ${enhancement}: ${(score * 100).toFixed(1)}%`);
  });
  
  if (report.recommendations.length > 0) {
    console.log('\n💡 Recommendations:');
    report.recommendations.forEach(rec => console.log(`  • ${rec}`));
  }
  
  console.log(`\n📄 Detailed report saved: ${filename}`);
  console.log('\n🏆 STEVIE V1.4 EXCEPTIONAL ENHANCEMENTS BENCHMARK COMPLETE');
  
  return report;
}

// Run benchmark if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runBenchmark().catch(console.error);
}

export { runBenchmark, StevieV14BenchmarkSuite };