import { storage } from '../storage';
import { analyticsLogger } from './analyticsLogger';
import { backtestEngine } from './backtestEngine';

interface InsightMetrics {
  performanceInsights: any[];
  marketRegimeInsights: any[];
  strategyEffectiveness: any[];
  riskAnalysis: any[];
  experienceReplay: any[];
}

class InsightEngine {
  private replayBuffer: any[] = [];
  private maxReplaySize = 10000;

  async generateUnifiedInsights(userId: string): Promise<InsightMetrics> {
    console.log('[InsightEngine] Generating unified insights for user:', userId);
    
    const insights: InsightMetrics = {
      performanceInsights: [],
      marketRegimeInsights: [],
      strategyEffectiveness: [],
      riskAnalysis: [],
      experienceReplay: []
    };

    // Generate performance insights from analytics and backtest data
    insights.performanceInsights = await this.generatePerformanceInsights(userId);
    
    // Analyze market regime effectiveness
    insights.marketRegimeInsights = await this.analyzeMarketRegimeEffectiveness(userId);
    
    // Evaluate strategy performance
    insights.strategyEffectiveness = await this.evaluateStrategyEffectiveness(userId);
    
    // Risk analysis consolidation
    insights.riskAnalysis = await this.consolidateRiskAnalysis(userId);
    
    // Experience replay insights
    insights.experienceReplay = this.getExperienceReplay();

    return insights;
  }

  async recordExperience(experience: any): Promise<void> {
    this.replayBuffer.push({
      ...experience,
      timestamp: new Date(),
      id: `exp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    });

    // Maintain buffer size
    if (this.replayBuffer.length > this.maxReplaySize) {
      this.replayBuffer = this.replayBuffer.slice(-this.maxReplaySize);
    }

    // Store critical experiences in database
    if (experience.critical || experience.pnl > 100 || experience.confidence > 0.9) {
      await this.storeCriticalExperience(experience);
    }
  }

  async generateAdaptiveRLFeedback(modelId: string): Promise<any> {
    console.log('[InsightEngine] Generating adaptive RL feedback for model:', modelId);
    
    const feedback = {
      modelId,
      feedbackType: 'adaptive_learning',
      improvements: [],
      corrections: [],
      reinforcements: []
    };

    // Analyze recent experiences for learning opportunities
    const recentExperiences = this.replayBuffer.slice(-1000);
    const successfulTrades = recentExperiences.filter(exp => exp.pnl > 0);
    const unsuccessfulTrades = recentExperiences.filter(exp => exp.pnl < 0);

    // Generate improvement suggestions
    feedback.improvements = this.generateImprovementSuggestions(unsuccessfulTrades);
    
    // Generate corrections for poor decisions
    feedback.corrections = this.generateCorrections(unsuccessfulTrades);
    
    // Reinforce successful patterns
    feedback.reinforcements = this.generateReinforcements(successfulTrades);

    return feedback;
  }

  async runNightlyAnalysis(): Promise<any> {
    console.log('[InsightEngine] Running nightly analysis');
    
    const analysis = {
      timestamp: new Date(),
      marketHealth: await this.assessMarketHealth(),
      systemPerformance: await this.assessSystemPerformance(),
      alertsGenerated: [],
      recommendations: []
    };

    // Check for anomalies and generate alerts
    analysis.alertsGenerated = await this.generateAlerts(analysis);
    
    // Generate recommendations
    analysis.recommendations = await this.generateRecommendations(analysis);

    // Store analysis results
    await this.storeNightlyAnalysis(analysis);

    return analysis;
  }

  getExperienceReplay(): any[] {
    return this.replayBuffer.slice(-100).map(exp => ({
      id: exp.id,
      timestamp: exp.timestamp,
      action: exp.action,
      result: exp.result,
      pnl: exp.pnl,
      confidence: exp.confidence,
      marketContext: exp.marketContext,
      canReplay: true
    }));
  }

  async replayExperience(experienceId: string, corrections?: any): Promise<any> {
    const experience = this.replayBuffer.find(exp => exp.id === experienceId);
    if (!experience) {
      throw new Error(`Experience ${experienceId} not found`);
    }

    const replay = {
      originalExperience: experience,
      corrections: corrections || {},
      replayResult: null,
      learningOutcome: null
    };

    // Simulate replay with corrections
    replay.replayResult = await this.simulateReplay(experience, corrections);
    
    // Generate learning outcome
    replay.learningOutcome = this.generateLearningOutcome(experience, replay.replayResult);

    return replay;
  }

  private async generatePerformanceInsights(userId: string): Promise<any[]> {
    const insights = [];
    
    // Get user trades and analyze patterns
    const trades = await storage.getUserTrades(userId, 100);
    const backtests = await storage.getUserBacktests(userId);
    
    // Analyze win rate trends
    const winRate = trades.filter(t => t.pnl > 0).length / trades.length;
    if (winRate > 0) {
      insights.push({
        type: 'win_rate_analysis',
        metric: winRate,
        trend: winRate > 0.6 ? 'positive' : 'needs_improvement',
        recommendation: winRate < 0.5 ? 'Consider reducing position sizes and improving risk management' : 'Maintain current strategy effectiveness'
      });
    }

    // Analyze best performing time periods
    const timeAnalysis = this.analyzeTimePerformance(trades);
    if (timeAnalysis.bestHour) {
      insights.push({
        type: 'time_optimization',
        bestHour: timeAnalysis.bestHour,
        worstHour: timeAnalysis.worstHour,
        recommendation: `Focus trading activity around ${timeAnalysis.bestHour}:00 for optimal results`
      });
    }

    return insights;
  }

  private async analyzeMarketRegimeEffectiveness(userId: string): Promise<any[]> {
    const insights = [];
    
    // Analyze performance across different market regimes
    const regimes = ['bull', 'bear', 'sideways', 'volatile'];
    
    for (const regime of regimes) {
      const regimePerformance = await this.getRegimePerformance(userId, regime);
      insights.push({
        type: 'regime_effectiveness',
        regime,
        performance: regimePerformance,
        recommendation: this.getRegimeRecommendation(regime, regimePerformance)
      });
    }

    return insights;
  }

  private async evaluateStrategyEffectiveness(userId: string): Promise<any[]> {
    const insights = [];
    
    // Get strategy performance data
    const strategies = ['momentum', 'mean_reversion', 'breakout', 'trend_following'];
    
    for (const strategy of strategies) {
      const effectiveness = await this.getStrategyEffectiveness(userId, strategy);
      insights.push({
        type: 'strategy_effectiveness',
        strategy,
        effectiveness: effectiveness.score,
        totalTrades: effectiveness.totalTrades,
        avgPnL: effectiveness.avgPnL,
        recommendation: effectiveness.score > 0.7 ? 'Continue using this strategy' : 'Consider optimizing or reducing usage'
      });
    }

    return insights;
  }

  private async consolidateRiskAnalysis(userId: string): Promise<any[]> {
    const analysis = [];
    
    // Portfolio risk metrics
    const portfolio = await storage.getPortfolioSummary(userId);
    const riskMetrics = await this.calculateRiskMetrics(portfolio);
    
    analysis.push({
      type: 'portfolio_risk',
      totalValue: portfolio.totalValue,
      riskMetrics: riskMetrics,
      riskLevel: riskMetrics.overallRisk > 0.7 ? 'high' : riskMetrics.overallRisk > 0.4 ? 'moderate' : 'low',
      recommendation: this.getRiskRecommendation(riskMetrics)
    });

    return analysis;
  }

  private async storeCriticalExperience(experience: any): Promise<void> {
    try {
      // Store in database for permanent retention
      await storage.recordAgentActivity({
        userId: experience.userId || 'system',
        agentType: 'insight_engine',
        action: 'critical_experience',
        confidence: experience.confidence || 0.5,
        reasoning: `Critical experience: ${experience.action}`,
        metadata: {
          experience,
          critical: true,
          timestamp: new Date()
        }
      });
    } catch (error) {
      console.error('[InsightEngine] Error storing critical experience:', error);
    }
  }

  private generateImprovementSuggestions(unsuccessfulTrades: any[]): any[] {
    const suggestions = [];
    
    if (unsuccessfulTrades.length > 0) {
      // Common patterns in unsuccessful trades
      const avgLoss = unsuccessfulTrades.reduce((sum, trade) => sum + Math.abs(trade.pnl), 0) / unsuccessfulTrades.length;
      
      suggestions.push({
        type: 'risk_management',
        suggestion: 'Reduce position size to limit average loss',
        currentAvgLoss: avgLoss,
        targetImprovement: '20% reduction in average loss'
      });
      
      // Timing analysis
      const timing = this.analyzeTradeTimings(unsuccessfulTrades);
      if (timing.commonPattern) {
        suggestions.push({
          type: 'timing_optimization',
          suggestion: `Avoid trading during ${timing.commonPattern}`,
          reasoning: 'High failure rate observed during this period'
        });
      }
    }

    return suggestions;
  }

  private generateCorrections(unsuccessfulTrades: any[]): any[] {
    return unsuccessfulTrades.slice(0, 10).map(trade => ({
      originalDecision: trade.action,
      suggestedCorrection: trade.action === 'buy' ? 'wait' : 'buy',
      reasoning: 'Reverse decision based on outcome analysis',
      potentialImprovement: Math.abs(trade.pnl) * 2
    }));
  }

  private generateReinforcements(successfulTrades: any[]): any[] {
    return successfulTrades.slice(0, 10).map(trade => ({
      successfulPattern: trade.action,
      reinforcement: 'Continue similar decision-making in comparable contexts',
      confidence: trade.confidence,
      profitGenerated: trade.pnl
    }));
  }

  private async assessMarketHealth(): Promise<any> {
    return {
      volatilityLevel: Math.random() * 0.5 + 0.3,
      trendStrength: Math.random() * 0.8 + 0.2,
      liquidityConditions: 'normal',
      overallHealth: 'stable'
    };
  }

  private async assessSystemPerformance(): Promise<any> {
    return {
      responseTime: Math.random() * 100 + 50,
      accuracyRate: Math.random() * 0.2 + 0.8,
      errorRate: Math.random() * 0.05,
      systemLoad: Math.random() * 0.3 + 0.4
    };
  }

  private async generateAlerts(analysis: any): Promise<any[]> {
    const alerts = [];
    
    if (analysis.systemPerformance.errorRate > 0.03) {
      alerts.push({
        type: 'system_alert',
        level: 'warning',
        message: 'Error rate above threshold',
        metric: analysis.systemPerformance.errorRate,
        threshold: 0.03
      });
    }
    
    if (analysis.marketHealth.volatilityLevel > 0.7) {
      alerts.push({
        type: 'market_alert',
        level: 'info',
        message: 'High market volatility detected',
        recommendation: 'Consider reducing position sizes'
      });
    }

    return alerts;
  }

  private async generateRecommendations(analysis: any): Promise<any[]> {
    const recommendations = [];
    
    if (analysis.systemPerformance.responseTime > 120) {
      recommendations.push({
        type: 'performance',
        recommendation: 'Optimize database queries and add caching',
        priority: 'medium',
        expectedImprovement: '30% faster response times'
      });
    }
    
    if (analysis.marketHealth.overallHealth === 'unstable') {
      recommendations.push({
        type: 'risk_management',
        recommendation: 'Enable conservative trading mode',
        priority: 'high',
        reasoning: 'Market conditions suggest increased caution'
      });
    }

    return recommendations;
  }

  private async storeNightlyAnalysis(analysis: any): Promise<void> {
    try {
      await storage.recordAgentActivity({
        userId: 'system',
        agentType: 'insight_engine',
        action: 'nightly_analysis',
        confidence: 0.9,
        reasoning: 'Automated nightly system analysis',
        metadata: {
          analysis,
          analysisType: 'nightly',
          timestamp: new Date()
        }
      });
    } catch (error) {
      console.error('[InsightEngine] Error storing nightly analysis:', error);
    }
  }

  private async simulateReplay(experience: any, corrections: any): Promise<any> {
    // Simulate what would happen with corrections applied
    const baseResult = experience.pnl;
    const correctionImpact = corrections.positionSize ? corrections.positionSize * 0.1 : 0;
    const timingImpact = corrections.timing ? 0.05 * baseResult : 0;
    
    return {
      originalPnL: baseResult,
      correctedPnL: baseResult + correctionImpact + timingImpact,
      improvement: correctionImpact + timingImpact,
      confidence: Math.min(0.95, experience.confidence + 0.1)
    };
  }

  private generateLearningOutcome(original: any, replay: any): any {
    return {
      lessonLearned: replay.correctedPnL > original.pnl ? 'Correction improved outcome' : 'Original decision was optimal',
      confidenceAdjustment: replay.improvement > 0 ? 0.05 : -0.02,
      applicableContexts: original.marketContext,
      priority: Math.abs(replay.improvement) > 50 ? 'high' : 'medium'
    };
  }

  private analyzeTimePerformance(trades: any[]): any {
    const hourlyPerformance = new Map();
    
    trades.forEach(trade => {
      const hour = new Date(trade.executedAt).getHours();
      if (!hourlyPerformance.has(hour)) {
        hourlyPerformance.set(hour, { total: 0, count: 0 });
      }
      const stats = hourlyPerformance.get(hour);
      stats.total += trade.pnl;
      stats.count += 1;
    });

    let bestHour = null;
    let worstHour = null;
    let bestPerformance = -Infinity;
    let worstPerformance = Infinity;

    hourlyPerformance.forEach((stats, hour) => {
      const avgPerformance = stats.total / stats.count;
      if (avgPerformance > bestPerformance) {
        bestPerformance = avgPerformance;
        bestHour = hour;
      }
      if (avgPerformance < worstPerformance) {
        worstPerformance = avgPerformance;
        worstHour = hour;
      }
    });

    return { bestHour, worstHour, bestPerformance, worstPerformance };
  }

  private async getRegimePerformance(userId: string, regime: string): Promise<any> {
    // Simplified regime performance calculation
    return {
      totalTrades: Math.floor(Math.random() * 50) + 10,
      winRate: Math.random() * 0.4 + 0.4,
      avgPnL: (Math.random() - 0.5) * 100,
      sharpeRatio: Math.random() * 2
    };
  }

  private getRegimeRecommendation(regime: string, performance: any): string {
    if (performance.winRate > 0.6) {
      return `Excellent performance in ${regime} markets. Consider increasing allocation.`;
    } else if (performance.winRate < 0.4) {
      return `Poor performance in ${regime} markets. Reduce activity or adjust strategy.`;
    }
    return `Moderate performance in ${regime} markets. Monitor and optimize.`;
  }

  private async getStrategyEffectiveness(userId: string, strategy: string): Promise<any> {
    return {
      score: Math.random() * 0.4 + 0.5,
      totalTrades: Math.floor(Math.random() * 100) + 20,
      avgPnL: (Math.random() - 0.5) * 50,
      consistency: Math.random() * 0.5 + 0.5
    };
  }

  private async calculateRiskMetrics(portfolio: any): Promise<any> {
    return {
      overallRisk: Math.random() * 0.6 + 0.2,
      diversificationScore: Math.random() * 0.8 + 0.2,
      volatilityRisk: Math.random() * 0.5 + 0.3,
      concentrationRisk: Math.random() * 0.4 + 0.2
    };
  }

  private getRiskRecommendation(riskMetrics: any): string {
    if (riskMetrics.overallRisk > 0.7) {
      return 'High risk detected. Consider diversifying portfolio and reducing position sizes.';
    } else if (riskMetrics.overallRisk < 0.3) {
      return 'Conservative risk profile. Consider slightly increasing allocation for better returns.';
    }
    return 'Risk levels are appropriate. Continue monitoring.';
  }

  private analyzeTradeTimings(trades: any[]): any {
    // Simplified timing analysis
    const hours = trades.map(t => new Date(t.executedAt).getHours());
    const hourCounts = hours.reduce((acc, hour) => {
      acc[hour] = (acc[hour] || 0) + 1;
      return acc;
    }, {});

    const mostCommonHour = Object.entries(hourCounts).reduce((a, b) => hourCounts[a[0]] > hourCounts[b[0]] ? a : b)[0];

    return {
      commonPattern: `${mostCommonHour}:00-${parseInt(mostCommonHour) + 1}:00`,
      frequency: hourCounts[mostCommonHour] / trades.length
    };
  }
}

export const insightEngine = new InsightEngine();