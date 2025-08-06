import { insightEngine } from './insightEngine';
import { aiCopilot } from './aiCopilot';

interface OnChainMetrics {
  whaleTransfers: number;
  defiLiquidity: number;
  networkActivity: number;
  stakingRatio: number;
  exchangeInflows: number;
  exchangeOutflows: number;
}

interface SentimentData {
  twitter: number;
  reddit: number;
  telegram: number;
  news: number;
  overall: number;
  timestamp: Date;
}

interface CrossDomainSignal {
  id: string;
  type: 'on_chain_alert' | 'sentiment_shift' | 'correlation_alert' | 'regime_change';
  priority: 'low' | 'medium' | 'high' | 'critical';
  data: any;
  confidence: number;
  timestamp: Date;
  triggered: boolean;
}

class CrossDomainSynergiesService {
  private onChainDataCache: Map<string, OnChainMetrics> = new Map();
  private sentimentDataCache: Map<string, SentimentData> = new Map();
  private crossDomainSignals: CrossDomainSignal[] = [];
  private correlationMatrix: Map<string, Map<string, number>> = new Map();

  async enrichWithOnChainData(symbol: string): Promise<OnChainMetrics> {
    console.log(`[CrossDomainSynergies] Enriching ${symbol} with on-chain data`);
    
    // Simulate on-chain data fetching (in production, would connect to blockchain APIs)
    const onChainMetrics: OnChainMetrics = {
      whaleTransfers: Math.floor(Math.random() * 100) + 10,
      defiLiquidity: Math.random() * 1000000 + 500000,
      networkActivity: Math.random() * 10000 + 1000,
      stakingRatio: Math.random() * 0.3 + 0.4, // 40-70%
      exchangeInflows: Math.random() * 500000 + 100000,
      exchangeOutflows: Math.random() * 500000 + 100000
    };

    this.onChainDataCache.set(symbol, onChainMetrics);
    
    // Check for whale alert triggers
    if (onChainMetrics.whaleTransfers > 80) {
      await this.triggerCrossDomainSignal({
        type: 'on_chain_alert',
        priority: 'high',
        data: {
          symbol,
          alertType: 'whale_activity',
          transfers: onChainMetrics.whaleTransfers,
          message: `Unusual whale activity detected: ${onChainMetrics.whaleTransfers} large transfers`
        },
        confidence: 0.85
      });
    }

    // Check for liquidity changes
    if (onChainMetrics.defiLiquidity < 300000) {
      await this.triggerCrossDomainSignal({
        type: 'on_chain_alert',
        priority: 'medium',
        data: {
          symbol,
          alertType: 'liquidity_low',
          liquidity: onChainMetrics.defiLiquidity,
          message: `Low DeFi liquidity detected: $${onChainMetrics.defiLiquidity.toLocaleString()}`
        },
        confidence: 0.75
      });
    }

    return onChainMetrics;
  }

  async integrateSocialSentiment(symbol: string): Promise<SentimentData> {
    console.log(`[CrossDomainSynergies] Integrating social sentiment for ${symbol}`);
    
    // Simulate sentiment data aggregation (in production, would connect to social APIs)
    const sentimentData: SentimentData = {
      twitter: (Math.random() - 0.5) * 2, // -1 to 1
      reddit: (Math.random() - 0.5) * 2,
      telegram: (Math.random() - 0.5) * 2,
      news: (Math.random() - 0.5) * 2,
      overall: 0,
      timestamp: new Date()
    };

    // Calculate overall sentiment
    sentimentData.overall = (sentimentData.twitter + sentimentData.reddit + 
                            sentimentData.telegram + sentimentData.news) / 4;

    this.sentimentDataCache.set(symbol, sentimentData);

    // Check for sentiment shifts
    const previousSentiment = await this.getPreviousSentiment(symbol);
    if (previousSentiment && Math.abs(sentimentData.overall - previousSentiment.overall) > 0.5) {
      const shift = sentimentData.overall > previousSentiment.overall ? 'positive' : 'negative';
      
      await this.triggerCrossDomainSignal({
        type: 'sentiment_shift',
        priority: 'medium',
        data: {
          symbol,
          shiftType: shift,
          magnitude: Math.abs(sentimentData.overall - previousSentiment.overall),
          currentSentiment: sentimentData.overall,
          previousSentiment: previousSentiment.overall,
          timestamp: new Date().toISOString(),
          explanation: `Social sentiment turned ${shift} at ${new Date().toLocaleTimeString()}`
        },
        confidence: 0.8
      });
    }

    return sentimentData;
  }

  async correlateOnChainWithRL(symbol: string, rlSignal: any): Promise<any> {
    console.log(`[CrossDomainSynergies] Correlating on-chain data with RL signal for ${symbol}`);
    
    const onChainData = await this.enrichWithOnChainData(symbol);
    const sentimentData = await this.integrateSocialSentiment(symbol);
    
    // Calculate correlation score
    const correlationScore = this.calculateCorrelationScore(onChainData, sentimentData, rlSignal);
    
    // Enhanced regime classification
    const enrichedRegime = this.classifyEnrichedRegime(onChainData, sentimentData, rlSignal);
    
    const correlatedSignal = {
      symbol,
      originalRLSignal: rlSignal,
      onChainMetrics: onChainData,
      sentimentMetrics: sentimentData,
      correlationScore,
      enrichedRegime,
      enhancedConfidence: Math.min(0.95, rlSignal.confidence + correlationScore * 0.2),
      recommendations: this.generateCrossCorrelationRecommendations(correlationScore, enrichedRegime),
      timestamp: new Date()
    };

    // Record correlation for future analysis
    this.updateCorrelationMatrix(symbol, onChainData, sentimentData, rlSignal);

    return correlatedSignal;
  }

  async generateCopilotExplanation(event: any): Promise<string> {
    console.log('[CrossDomainSynergies] Generating copilot explanation for cross-domain event');
    
    let explanation = '';

    if (event.type === 'sentiment_shift') {
      const data = event.data;
      explanation = `Social sentiment turned ${data.shiftType} at ${new Date(data.timestamp).toLocaleTimeString()}. ` +
                   `Skippy detected this shift and ${data.shiftType === 'positive' ? 'increased' : 'reduced'} risk by 20% ` +
                   `to capitalize on the ${data.shiftType === 'positive' ? 'bullish' : 'bearish'} sentiment momentum.`;
    } else if (event.type === 'on_chain_alert') {
      const data = event.data;
      if (data.alertType === 'whale_activity') {
        explanation = `Large whale transactions detected (${data.transfers} transfers). ` +
                     `This often precedes significant price movements. Skippy adjusted position sizing ` +
                     `to account for potential volatility increase.`;
      } else if (data.alertType === 'liquidity_low') {
        explanation = `DeFi liquidity dropped to $${data.liquidity.toLocaleString()}. ` +
                     `Lower liquidity can lead to higher slippage. Skippy reduced trade sizes ` +
                     `and increased spread tolerance to maintain execution quality.`;
      }
    } else if (event.type === 'correlation_alert') {
      explanation = `Cross-market correlation detected between ${event.data.primarySymbol} and ` +
                   `${event.data.correlatedSymbol} (${(event.data.correlation * 100).toFixed(1)}% correlation). ` +
                   `Skippy leveraged this relationship for improved market timing and risk management.`;
    }

    return explanation || 'Cross-domain signal detected and integrated into trading decision.';
  }

  async getEnrichedMarketContext(symbol: string): Promise<any> {
    const onChainData = this.onChainDataCache.get(symbol) || await this.enrichWithOnChainData(symbol);
    const sentimentData = this.sentimentDataCache.get(symbol) || await this.integrateSocialSentiment(symbol);
    
    return {
      symbol,
      onChain: {
        whaleActivity: this.interpretWhaleActivity(onChainData.whaleTransfers),
        liquidityHealth: this.interpretLiquidity(onChainData.defiLiquidity),
        networkStrength: this.interpretNetworkActivity(onChainData.networkActivity),
        stakingStatus: this.interpretStaking(onChainData.stakingRatio)
      },
      sentiment: {
        overall: this.interpretSentiment(sentimentData.overall),
        sources: {
          twitter: sentimentData.twitter,
          reddit: sentimentData.reddit,
          telegram: sentimentData.telegram,
          news: sentimentData.news
        },
        trend: await this.calculateSentimentTrend(symbol)
      },
      crossCorrelations: await this.getActiveCorrelations(symbol),
      enrichedInsights: await this.generateEnrichedInsights(symbol, onChainData, sentimentData)
    };
  }

  async detectCrossMarketArbitrage(symbols: string[]): Promise<any[]> {
    console.log('[CrossDomainSynergies] Detecting cross-market arbitrage opportunities');
    
    const opportunities = [];
    
    for (let i = 0; i < symbols.length; i++) {
      for (let j = i + 1; j < symbols.length; j++) {
        const symbol1 = symbols[i];
        const symbol2 = symbols[j];
        
        const correlation = await this.calculateSymbolCorrelation(symbol1, symbol2);
        
        if (Math.abs(correlation) > 0.7) {
          const opportunity = {
            primarySymbol: symbol1,
            correlatedSymbol: symbol2,
            correlation,
            opportunityType: correlation > 0 ? 'momentum_follow' : 'mean_reversion',
            confidence: Math.abs(correlation) * 0.9,
            expectedReturn: Math.abs(correlation) * 0.05, // 0-5% expected return
            riskLevel: 1 - Math.abs(correlation),
            timeHorizon: correlation > 0 ? 'short_term' : 'medium_term'
          };
          
          opportunities.push(opportunity);
        }
      }
    }
    
    return opportunities.sort((a, b) => b.confidence - a.confidence);
  }

  private async triggerCrossDomainSignal(signalData: Partial<CrossDomainSignal>): Promise<void> {
    const signal: CrossDomainSignal = {
      id: `signal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: signalData.type!,
      priority: signalData.priority || 'medium',
      data: signalData.data,
      confidence: signalData.confidence || 0.7,
      timestamp: new Date(),
      triggered: false
    };

    this.crossDomainSignals.push(signal);
    
    // Trigger appropriate actions based on signal
    if (signal.priority === 'high' || signal.priority === 'critical') {
      await this.processHighPrioritySignal(signal);
    }

    console.log(`[CrossDomainSynergies] Triggered ${signal.type} signal with ${signal.priority} priority`);
  }

  private async processHighPrioritySignal(signal: CrossDomainSignal): Promise<void> {
    // Process high-priority cross-domain signals
    const explanation = await this.generateCopilotExplanation(signal);
    
    // Record the signal processing
    await insightEngine.recordExperience({
      action: 'cross_domain_signal_processed',
      result: 'signal_integrated',
      pnl: 0,
      confidence: signal.confidence,
      marketContext: {
        signalType: signal.type,
        priority: signal.priority,
        data: signal.data
      },
      critical: signal.priority === 'critical'
    });
  }

  private calculateCorrelationScore(onChain: OnChainMetrics, sentiment: SentimentData, rlSignal: any): number {
    let score = 0;
    
    // On-chain correlation factors
    if (onChain.whaleTransfers > 60) score += 0.2;
    if (onChain.defiLiquidity > 800000) score += 0.15;
    if (onChain.exchangeOutflows > onChain.exchangeInflows * 1.2) score += 0.1;
    
    // Sentiment correlation factors
    if (Math.abs(sentiment.overall) > 0.6) score += 0.25;
    if (sentiment.overall > 0 && rlSignal.action === 'buy') score += 0.2;
    if (sentiment.overall < 0 && rlSignal.action === 'sell') score += 0.2;
    
    return Math.min(1.0, score);
  }

  private classifyEnrichedRegime(onChain: OnChainMetrics, sentiment: SentimentData, rlSignal: any): string {
    const whaleActive = onChain.whaleTransfers > 70;
    const liquidityHigh = onChain.defiLiquidity > 700000;
    const sentimentPositive = sentiment.overall > 0.3;
    const sentimentNegative = sentiment.overall < -0.3;
    
    if (whaleActive && sentimentPositive) return 'whale_driven_bullish';
    if (whaleActive && sentimentNegative) return 'whale_driven_bearish';
    if (liquidityHigh && sentimentPositive) return 'liquid_bullish';
    if (!liquidityHigh && sentimentNegative) return 'illiquid_bearish';
    if (Math.abs(sentiment.overall) < 0.2) return 'sentiment_neutral';
    
    return 'mixed_signals';
  }

  private generateCrossCorrelationRecommendations(correlationScore: number, regime: string): string[] {
    const recommendations = [];
    
    if (correlationScore > 0.7) {
      recommendations.push('High cross-domain correlation detected - increase position confidence');
    }
    
    if (regime === 'whale_driven_bullish') {
      recommendations.push('Whale activity supports bullish thesis - consider position increase');
    } else if (regime === 'whale_driven_bearish') {
      recommendations.push('Whale selling pressure detected - reduce exposure or tighten stops');
    }
    
    if (regime === 'illiquid_bearish') {
      recommendations.push('Low liquidity + negative sentiment - avoid large orders, use smaller sizes');
    }
    
    if (regime === 'liquid_bullish') {
      recommendations.push('High liquidity + positive sentiment - favorable for larger position sizes');
    }
    
    return recommendations;
  }

  private updateCorrelationMatrix(symbol: string, onChain: OnChainMetrics, sentiment: SentimentData, rlSignal: any): void {
    if (!this.correlationMatrix.has(symbol)) {
      this.correlationMatrix.set(symbol, new Map());
    }
    
    const symbolCorrelations = this.correlationMatrix.get(symbol)!;
    symbolCorrelations.set('whale_sentiment', this.calculatePearsonCorrelation([onChain.whaleTransfers], [sentiment.overall * 100]));
    symbolCorrelations.set('liquidity_confidence', this.calculatePearsonCorrelation([onChain.defiLiquidity], [rlSignal.confidence * 10000]));
  }

  private calculatePearsonCorrelation(x: number[], y: number[]): number {
    if (x.length !== y.length || x.length === 0) return 0;
    
    const n = x.length;
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);
    const sumY2 = y.reduce((sum, yi) => sum + yi * yi, 0);
    
    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
    
    return denominator === 0 ? 0 : numerator / denominator;
  }

  private async getPreviousSentiment(symbol: string): Promise<SentimentData | null> {
    // Simplified: return cached sentiment as "previous"
    return this.sentimentDataCache.get(symbol) || null;
  }

  private interpretWhaleActivity(transfers: number): string {
    if (transfers > 80) return 'Very High';
    if (transfers > 60) return 'High';
    if (transfers > 40) return 'Moderate';
    if (transfers > 20) return 'Low';
    return 'Minimal';
  }

  private interpretLiquidity(liquidity: number): string {
    if (liquidity > 800000) return 'Excellent';
    if (liquidity > 600000) return 'Good';
    if (liquidity > 400000) return 'Adequate';
    if (liquidity > 200000) return 'Low';
    return 'Critical';
  }

  private interpretNetworkActivity(activity: number): string {
    if (activity > 8000) return 'Very High';
    if (activity > 6000) return 'High';
    if (activity > 4000) return 'Moderate';
    if (activity > 2000) return 'Low';
    return 'Minimal';
  }

  private interpretStaking(ratio: number): string {
    if (ratio > 0.6) return 'High Staking';
    if (ratio > 0.5) return 'Moderate Staking';
    if (ratio > 0.4) return 'Low Staking';
    return 'Minimal Staking';
  }

  private interpretSentiment(sentiment: number): string {
    if (sentiment > 0.6) return 'Very Positive';
    if (sentiment > 0.3) return 'Positive';
    if (sentiment > -0.3) return 'Neutral';
    if (sentiment > -0.6) return 'Negative';
    return 'Very Negative';
  }

  private async calculateSentimentTrend(symbol: string): Promise<string> {
    // Simplified trend calculation
    const current = this.sentimentDataCache.get(symbol);
    return current && current.overall > 0.2 ? 'Improving' : current && current.overall < -0.2 ? 'Declining' : 'Stable';
  }

  private async getActiveCorrelations(symbol: string): Promise<any[]> {
    const correlations = this.correlationMatrix.get(symbol);
    if (!correlations) return [];
    
    return Array.from(correlations.entries()).map(([key, value]) => ({
      type: key,
      correlation: value,
      strength: Math.abs(value) > 0.7 ? 'Strong' : Math.abs(value) > 0.4 ? 'Moderate' : 'Weak'
    }));
  }

  private async generateEnrichedInsights(symbol: string, onChain: OnChainMetrics, sentiment: SentimentData): Promise<string[]> {
    const insights = [];
    
    if (onChain.whaleTransfers > 75 && sentiment.overall > 0.5) {
      insights.push('Whale accumulation + positive sentiment suggests strong upward momentum');
    }
    
    if (onChain.defiLiquidity < 400000 && Math.abs(sentiment.overall) > 0.6) {
      insights.push('Low liquidity + strong sentiment creates high volatility environment');
    }
    
    if (onChain.exchangeOutflows > onChain.exchangeInflows * 1.5) {
      insights.push('Strong exchange outflows indicate HODLing behavior');
    }
    
    return insights;
  }

  private async calculateSymbolCorrelation(symbol1: string, symbol2: string): Promise<number> {
    // Simplified correlation calculation
    return (Math.random() - 0.5) * 2; // -1 to 1 correlation
  }
}

export const crossDomainSynergies = new CrossDomainSynergiesService();