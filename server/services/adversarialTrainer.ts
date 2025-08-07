/**
 * ADVERSARIAL TRAINING SERVICE
 * Flash crash scenarios, extreme market stress testing, and robust model training
 */

import { performance } from 'perf_hooks';
import fs from 'fs';
import path from 'path';

interface AdversarialScenario {
  name: string;
  type: 'flash_crash' | 'black_swan' | 'liquidity_crisis' | 'regulatory_shock' | 'exchange_hack';
  severity: 'low' | 'medium' | 'high' | 'extreme';
  parameters: {
    priceDropPercent?: number;
    durationMinutes?: number;
    volumeMultiplier?: number;
    spreadWidening?: number;
    cascadingEffect?: boolean;
    recoveryTime?: number;
  };
  historicalExample?: string;
  probability: number; // Annual probability 0-1
}

interface StressTestResult {
  scenario: AdversarialScenario;
  modelPerformance: {
    totalReturn: number;
    maxDrawdown: number;
    recoveryTime: number; // Time to recover from drawdown
    tradesExecuted: number;
    worstTrade: number;
    avgTradeReturn: number;
    sharpeRatio: number;
    calmarRatio: number;
  };
  behaviorAnalysis: {
    panicSelling: boolean;
    doubledDown: boolean;
    stoppedTrading: boolean;
    adaptedQuickly: boolean;
    recoveryStrategy: string;
  };
  robustnessScore: number; // 0-100
  lessonsLearned: string[];
}

interface AdversarialTrainingConfig {
  scenarios: AdversarialScenario[];
  trainingEpisodes: number;
  baselineMarketDays: number;
  stressIntensityRamp: boolean;
  adaptiveThresholds: boolean;
  robustnessTarget: number; // Target robustness score
}

export class AdversarialTrainer {
  private knownScenarios: AdversarialScenario[] = [
    {
      name: 'Flash Crash 2020',
      type: 'flash_crash',
      severity: 'extreme',
      parameters: {
        priceDropPercent: 60,
        durationMinutes: 30,
        volumeMultiplier: 10,
        spreadWidening: 5,
        cascadingEffect: true,
        recoveryTime: 240
      },
      historicalExample: 'March 12, 2020 - COVID-19 panic crash',
      probability: 0.05
    },
    {
      name: 'Exchange Hack Crisis',
      type: 'exchange_hack',
      severity: 'high',
      parameters: {
        priceDropPercent: 25,
        durationMinutes: 180,
        volumeMultiplier: 3,
        spreadWidening: 8,
        cascadingEffect: true,
        recoveryTime: 1440
      },
      historicalExample: 'FTX collapse November 2022',
      probability: 0.1
    },
    {
      name: 'Regulatory Ban Shock',
      type: 'regulatory_shock',
      severity: 'high',
      parameters: {
        priceDropPercent: 40,
        durationMinutes: 60,
        volumeMultiplier: 5,
        spreadWidening: 3,
        cascadingEffect: false,
        recoveryTime: 2880
      },
      historicalExample: 'China mining ban 2021',
      probability: 0.15
    },
    {
      name: 'Liquidity Evaporation',
      type: 'liquidity_crisis',
      severity: 'medium',
      parameters: {
        priceDropPercent: 15,
        durationMinutes: 120,
        volumeMultiplier: 0.2,
        spreadWidening: 15,
        cascadingEffect: false,
        recoveryTime: 720
      },
      historicalExample: 'Weekend liquidity crunch patterns',
      probability: 0.3
    },
    {
      name: 'Terra Luna Collapse',
      type: 'black_swan',
      severity: 'extreme',
      parameters: {
        priceDropPercent: 95,
        durationMinutes: 4320, // 3 days
        volumeMultiplier: 20,
        spreadWidening: 50,
        cascadingEffect: true,
        recoveryTime: -1 // Never recovered
      },
      historicalExample: 'UST/LUNA death spiral May 2022',
      probability: 0.02
    }
  ];

  private resultsDir = './adversarial-results';

  constructor() {
    if (!fs.existsSync(this.resultsDir)) {
      fs.mkdirSync(this.resultsDir, { recursive: true });
    }
  }

  async runAdversarialTraining(config: AdversarialTrainingConfig): Promise<{
    overallRobustness: number;
    scenarioResults: StressTestResult[];
    adaptations: string[];
    finalModelPath: string;
  }> {
    console.log('🔥 ADVERSARIAL TRAINING INITIATED');
    console.log(`Training Episodes: ${config.trainingEpisodes}`);
    console.log(`Scenarios: ${config.scenarios.length}`);
    
    const results: StressTestResult[] = [];
    const adaptations: string[] = [];
    let overallRobustness = 0;

    for (let episode = 1; episode <= config.trainingEpisodes; episode++) {
      console.log(`\n--- EPISODE ${episode}/${config.trainingEpisodes} ---`);
      
      // Select random scenario with probability weighting
      const scenario = this.selectWeightedScenario(config.scenarios);
      console.log(`Testing scenario: ${scenario.name} (${scenario.severity})`);
      
      // Run stress test
      const result = await this.runStressTest(scenario, episode);
      results.push(result);
      
      // Analyze and adapt
      if (result.robustnessScore < config.robustnessTarget) {
        const adaptation = await this.generateAdaptation(result);
        adaptations.push(adaptation);
        console.log(`🧬 Adaptation: ${adaptation}`);
      }
      
      console.log(`Robustness Score: ${result.robustnessScore}/100`);
    }

    // Calculate overall robustness
    overallRobustness = results.reduce((sum, r) => sum + r.robustnessScore, 0) / results.length;
    
    // Save comprehensive results
    const finalModelPath = await this.saveTrainingResults({
      overallRobustness,
      scenarioResults: results,
      adaptations,
      config
    });

    console.log(`\n🎓 ADVERSARIAL TRAINING COMPLETE`);
    console.log(`Overall Robustness: ${overallRobustness.toFixed(1)}/100`);
    console.log(`Adaptations Made: ${adaptations.length}`);
    console.log(`Model Saved: ${finalModelPath}`);

    return {
      overallRobustness,
      scenarioResults: results,
      adaptations,
      finalModelPath
    };
  }

  private selectWeightedScenario(scenarios: AdversarialScenario[]): AdversarialScenario {
    const totalWeight = scenarios.reduce((sum, s) => sum + s.probability, 0);
    let random = Math.random() * totalWeight;
    
    for (const scenario of scenarios) {
      random -= scenario.probability;
      if (random <= 0) return scenario;
    }
    
    return scenarios[scenarios.length - 1]; // Fallback
  }

  private async runStressTest(scenario: AdversarialScenario, episode: number): Promise<StressTestResult> {
    const startTime = performance.now();
    
    // Generate adversarial market data
    const marketData = this.generateAdversarialMarketData(scenario);
    
    // Simulate model performance under stress
    const modelPerformance = await this.simulateModelUnderStress(marketData, scenario);
    
    // Analyze model behavior
    const behaviorAnalysis = this.analyzeBehaviorUnderStress(modelPerformance, scenario);
    
    // Calculate robustness score
    const robustnessScore = this.calculateRobustnessScore(modelPerformance, scenario);
    
    // Extract lessons learned
    const lessonsLearned = this.extractLessonsLearned(modelPerformance, behaviorAnalysis, scenario);
    
    const duration = performance.now() - startTime;
    console.log(`   Completed in ${(duration / 1000).toFixed(2)}s`);

    return {
      scenario,
      modelPerformance,
      behaviorAnalysis,
      robustnessScore,
      lessonsLearned
    };
  }

  private generateAdversarialMarketData(scenario: AdversarialScenario): Array<{
    timestamp: number;
    price: number;
    volume: number;
    spread: number;
    orderBookDepth: number;
  }> {
    const data: any[] = [];
    const basePrice = 50000; // Starting price
    const params = scenario.parameters;
    
    // Pre-stress period (normal market)
    for (let i = 0; i < 1440; i++) { // 24 hours
      data.push({
        timestamp: i,
        price: basePrice + Math.sin(i / 100) * 500 + (Math.random() - 0.5) * 200,
        volume: 1000 + Math.random() * 500,
        spread: 0.1 + Math.random() * 0.05,
        orderBookDepth: 10000 + Math.random() * 5000
      });
    }
    
    // Stress period
    const stressDuration = params.durationMinutes || 60;
    const priceDropPercent = params.priceDropPercent || 20;
    const volumeMultiplier = params.volumeMultiplier || 3;
    
    for (let i = 0; i < stressDuration; i++) {
      const stressProgress = i / stressDuration;
      const currentPrice = basePrice * (1 - (priceDropPercent / 100) * Math.pow(stressProgress, 0.5));
      
      data.push({
        timestamp: 1440 + i,
        price: currentPrice + (Math.random() - 0.8) * currentPrice * 0.1, // More negative volatility
        volume: 1000 * volumeMultiplier * (1 + Math.random()),
        spread: (0.1 + Math.random() * 0.05) * (params.spreadWidening || 1),
        orderBookDepth: 10000 / (params.spreadWidening || 1) * (1 - stressProgress * 0.8)
      });
    }
    
    // Recovery period
    const recoveryTime = params.recoveryTime || 480;
    if (recoveryTime > 0) {
      const crashPrice = basePrice * (1 - priceDropPercent / 100);
      
      for (let i = 0; i < recoveryTime; i++) {
        const recoveryProgress = i / recoveryTime;
        const recoveredPrice = crashPrice + (basePrice - crashPrice) * Math.pow(recoveryProgress, 2);
        
        data.push({
          timestamp: 1440 + stressDuration + i,
          price: recoveredPrice + (Math.random() - 0.5) * recoveredPrice * 0.05,
          volume: 1000 * (1 + recoveryProgress) * (1 + Math.random() * 0.5),
          spread: 0.1 + Math.random() * 0.05 * (2 - recoveryProgress),
          orderBookDepth: 10000 * recoveryProgress + Math.random() * 5000
        });
      }
    }
    
    return data;
  }

  private async simulateModelUnderStress(marketData: any[], scenario: AdversarialScenario): Promise<StressTestResult['modelPerformance']> {
    // Simulate trading model behavior under adversarial conditions
    let portfolioValue = 100000;
    let maxPortfolioValue = portfolioValue;
    let minPortfolioValue = portfolioValue;
    let tradesExecuted = 0;
    let totalReturn = 0;
    let worstTrade = 0;
    const tradeReturns: number[] = [];
    
    let position = 0; // Current position size
    let lastTradeTime = -1000;
    
    for (let i = 1; i < marketData.length; i++) {
      const current = marketData[i];
      const previous = marketData[i - 1];
      const priceChange = (current.price - previous.price) / previous.price;
      
      // P&L from existing position
      if (position !== 0) {
        const pnl = portfolioValue * (position / 100) * priceChange;
        portfolioValue += pnl;
        
        // Track portfolio extremes
        if (portfolioValue > maxPortfolioValue) maxPortfolioValue = portfolioValue;
        if (portfolioValue < minPortfolioValue) minPortfolioValue = portfolioValue;
      }
      
      // Trading decision logic (simplified model behavior under stress)
      const shouldTrade = this.shouldTradeUnderStress(current, previous, scenario, i);
      
      if (shouldTrade && i - lastTradeTime > 5) { // Minimum 5 periods between trades
        const tradeSize = this.calculateStressTradeSize(current, scenario, portfolioValue);
        
        // Close existing position and open new one
        if (position !== 0) {
          const exitPnL = portfolioValue * (position / 100) * 0.001; // Small exit cost
          portfolioValue += exitPnL;
          tradeReturns.push((exitPnL / portfolioValue) * 100);
          if (exitPnL < worstTrade) worstTrade = exitPnL;
        }
        
        position = tradeSize;
        tradesExecuted++;
        lastTradeTime = i;
      }
    }
    
    // Close final position
    if (position !== 0) {
      tradesExecuted++;
    }
    
    totalReturn = ((portfolioValue - 100000) / 100000) * 100;
    const maxDrawdown = ((maxPortfolioValue - minPortfolioValue) / maxPortfolioValue) * 100;
    const avgTradeReturn = tradeReturns.length > 0 ? tradeReturns.reduce((a, b) => a + b, 0) / tradeReturns.length : 0;
    
    // Calculate Sharpe and Calmar ratios
    const returnVolatility = tradeReturns.length > 0 ? Math.sqrt(
      tradeReturns.reduce((sum, r) => sum + Math.pow(r, 2), 0) / tradeReturns.length
    ) : 0;
    const sharpeRatio = returnVolatility > 0 ? avgTradeReturn / returnVolatility : 0;
    const calmarRatio = maxDrawdown > 0 ? totalReturn / maxDrawdown : 0;
    
    // Recovery time calculation
    let recoveryTime = -1;
    for (let i = marketData.length - 1; i >= 0; i--) {
      if (portfolioValue >= maxPortfolioValue * 0.95) {
        recoveryTime = marketData.length - i;
        break;
      }
    }
    if (recoveryTime === -1) recoveryTime = marketData.length;
    
    return {
      totalReturn: Math.round(totalReturn * 100) / 100,
      maxDrawdown: Math.round(maxDrawdown * 100) / 100,
      recoveryTime,
      tradesExecuted,
      worstTrade: Math.round(worstTrade * 100) / 100,
      avgTradeReturn: Math.round(avgTradeReturn * 100) / 100,
      sharpeRatio: Math.round(sharpeRatio * 100) / 100,
      calmarRatio: Math.round(calmarRatio * 100) / 100
    };
  }

  private shouldTradeUnderStress(current: any, previous: any, scenario: AdversarialScenario, timeIndex: number): boolean {
    const priceChange = Math.abs((current.price - previous.price) / previous.price);
    const isHighVolatility = priceChange > 0.05; // 5% move
    const isLowLiquidity = current.orderBookDepth < 5000;
    const isHighSpread = current.spread > 0.2;
    
    // More conservative trading during stress
    if (scenario.severity === 'extreme' && (isHighVolatility || isLowLiquidity)) {
      return Math.random() < 0.1; // Only 10% chance to trade
    }
    
    if (scenario.severity === 'high' && (isHighVolatility || isHighSpread)) {
      return Math.random() < 0.3; // 30% chance to trade
    }
    
    // Normal conditions
    return Math.random() < 0.6; // 60% base trading probability
  }

  private calculateStressTradeSize(current: any, scenario: AdversarialScenario, portfolioValue: number): number {
    const baseSize = 5; // 5% base position
    
    // Reduce size during stress
    const severityMultiplier = {
      'low': 1.0,
      'medium': 0.7,
      'high': 0.5,
      'extreme': 0.3
    }[scenario.severity];
    
    // Reduce size for low liquidity
    const liquidityMultiplier = Math.max(0.2, current.orderBookDepth / 10000);
    
    // Reduce size for high spreads
    const spreadMultiplier = Math.max(0.5, 1 / (current.spread * 10 + 1));
    
    const adjustedSize = baseSize * severityMultiplier * liquidityMultiplier * spreadMultiplier;
    
    return Math.max(0.5, Math.min(10, adjustedSize)) * (Math.random() < 0.5 ? 1 : -1); // Long or short
  }

  private analyzeBehaviorUnderStress(performance: StressTestResult['modelPerformance'], scenario: AdversarialScenario): StressTestResult['behaviorAnalysis'] {
    const panicSelling = performance.worstTrade < -5 && performance.tradesExecuted > 10;
    const doubledDown = performance.maxDrawdown > 20 && performance.tradesExecuted < 5;
    const stoppedTrading = performance.tradesExecuted < 3;
    const adaptedQuickly = performance.recoveryTime < (scenario.parameters.durationMinutes || 60) * 2;
    
    let recoveryStrategy = 'unknown';
    if (performance.totalReturn > -5) {
      recoveryStrategy = 'defensive';
    } else if (performance.totalReturn < -20) {
      recoveryStrategy = 'aggressive';
    } else {
      recoveryStrategy = 'balanced';
    }
    
    return {
      panicSelling,
      doubledDown,
      stoppedTrading,
      adaptedQuickly,
      recoveryStrategy
    };
  }

  private calculateRobustnessScore(performance: StressTestResult['modelPerformance'], scenario: AdversarialScenario): number {
    const returnScore = Math.max(0, Math.min(50, 50 + performance.totalReturn)); // -50% to +50% maps to 0-100
    const drawdownScore = Math.max(0, 50 - performance.maxDrawdown); // Lower drawdown = higher score
    const recoveryScore = scenario.parameters.recoveryTime ? Math.max(0, 25 - (performance.recoveryTime / scenario.parameters.recoveryTime) * 25) : 20;
    const adaptationScore = performance.tradesExecuted > 0 ? 25 : 0; // Did model keep trading?
    
    const severityPenaltyMap = {
      'low': 1.0,
      'medium': 0.9,
      'high': 0.8,
      'extreme': 0.7
    };
    const severityPenalty = severityPenaltyMap[scenario.severity];
    
    const rawScore = returnScore * 0.3 + drawdownScore * 0.4 + recoveryScore * 0.2 + adaptationScore * 0.1;
    return Math.round(rawScore * severityPenalty);
  }

  private extractLessonsLearned(
    performance: StressTestResult['modelPerformance'],
    behavior: StressTestResult['behaviorAnalysis'],
    scenario: AdversarialScenario
  ): string[] {
    const lessons: string[] = [];
    
    if (behavior.panicSelling) {
      lessons.push('Implement emergency stop-loss protocols to prevent panic selling');
    }
    
    if (behavior.doubledDown && performance.totalReturn < -10) {
      lessons.push('Avoid doubling down during severe market stress');
    }
    
    if (behavior.stoppedTrading && scenario.severity !== 'extreme') {
      lessons.push('Maintain selective trading opportunities during medium stress events');
    }
    
    if (performance.maxDrawdown > 30) {
      lessons.push('Implement stronger position sizing controls for tail risk events');
    }
    
    if (!behavior.adaptedQuickly) {
      lessons.push('Develop faster market regime detection for quicker adaptation');
    }
    
    if (performance.sharpeRatio < -1) {
      lessons.push('Improve risk-adjusted returns by reducing position sizes during volatility spikes');
    }
    
    if (lessons.length === 0) {
      lessons.push('Model performed well under this stress scenario');
    }
    
    return lessons;
  }

  private async generateAdaptation(result: StressTestResult): Promise<string> {
    const scenario = result.scenario;
    const performance = result.modelPerformance;
    
    if (performance.maxDrawdown > 25) {
      return `Reduce max position size to ${Math.max(1, 5 - scenario.severity === 'extreme' ? 3 : 1)}% for ${scenario.type} scenarios`;
    }
    
    if (result.behaviorAnalysis.stoppedTrading && scenario.severity !== 'extreme') {
      return `Maintain minimum trading activity (1 trade per hour) during ${scenario.type} events`;
    }
    
    if (performance.recoveryTime > (scenario.parameters.durationMinutes || 60) * 3) {
      return `Implement accelerated recovery protocol for ${scenario.type} with faster position rebuilding`;
    }
    
    return `Increase robustness threshold for ${scenario.type} scenarios to ${result.robustnessScore + 10}%`;
  }

  private async saveTrainingResults(results: any): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `adversarial_training_${timestamp}.json`;
    const filepath = path.join(this.resultsDir, filename);
    
    fs.writeFileSync(filepath, JSON.stringify(results, null, 2));
    
    // Also save a summary report
    const summaryPath = path.join(this.resultsDir, `summary_${timestamp}.md`);
    const summary = this.generateTrainingSummary(results);
    fs.writeFileSync(summaryPath, summary);
    
    console.log(`📄 Results saved: ${filename}`);
    console.log(`📄 Summary saved: summary_${timestamp}.md`);
    
    return filepath;
  }

  private generateTrainingSummary(results: any): string {
    return `# Adversarial Training Summary

## Overall Results
- **Robustness Score**: ${results.overallRobustness.toFixed(1)}/100
- **Training Episodes**: ${results.scenarioResults.length}
- **Adaptations Made**: ${results.adaptations.length}

## Scenario Performance
${results.scenarioResults.map((r: StressTestResult) => `
### ${r.scenario.name} (${r.scenario.severity})
- Robustness: ${r.robustnessScore}/100
- Total Return: ${r.modelPerformance.totalReturn}%
- Max Drawdown: ${r.modelPerformance.maxDrawdown}%
- Recovery Time: ${r.modelPerformance.recoveryTime} periods
- Lessons: ${r.lessonsLearned.join(', ')}
`).join('\n')}

## Key Adaptations
${results.adaptations.map((a: string, i: number) => `${i + 1}. ${a}`).join('\n')}

## Recommendations
${results.overallRobustness < 70 ? '- Continue adversarial training with focus on extreme scenarios' : '- Model shows good robustness across scenarios'}
${results.scenarioResults.some((r: StressTestResult) => r.robustnessScore < 50) ? '- Implement additional safeguards for worst-performing scenarios' : '- Consider deploying model with current robustness level'}
`;
  }

  // Quick stress test for single scenario
  async quickStressTest(scenarioType: AdversarialScenario['type']): Promise<StressTestResult> {
    const scenario = this.knownScenarios.find(s => s.type === scenarioType) || this.knownScenarios[0];
    return await this.runStressTest(scenario, 1);
  }

  // Get recommended training configuration
  getRecommendedTrainingConfig(riskTolerance: 'conservative' | 'moderate' | 'aggressive'): AdversarialTrainingConfig {
    const baseScenarios = this.knownScenarios.slice();
    
    const config: AdversarialTrainingConfig = {
      scenarios: baseScenarios,
      trainingEpisodes: riskTolerance === 'aggressive' ? 50 : riskTolerance === 'moderate' ? 30 : 20,
      baselineMarketDays: 7,
      stressIntensityRamp: true,
      adaptiveThresholds: true,
      robustnessTarget: riskTolerance === 'aggressive' ? 60 : riskTolerance === 'moderate' ? 70 : 80
    };
    
    return config;
  }
}

export const adversarialTrainer = new AdversarialTrainer();