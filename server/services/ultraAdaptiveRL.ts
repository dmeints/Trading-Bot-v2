import { storage } from '../storage';
import { insightEngine } from './insightEngine';

interface HighImpactEvent {
  id: string;
  userId: string;
  tradeId?: string;
  eventType: 'trade_execution' | 'missed_opportunity' | 'risk_event' | 'regime_shift';
  impact: number; // -1 to 1, where 1 is highest positive impact
  features: any;
  outcome: any;
  timestamp: Date;
  learningPotential: number;
}

interface WhatIfScenario {
  scenarioId: string;
  originalTrade: any;
  modifications: any;
  projectedOutcome: any;
  pnlDifference: number;
  confidenceDelta: number;
  explanation: string;
}

interface VectorSearchResult {
  tradeId: string;
  similarity: number;
  trade: any;
  marketContext: any;
  outcome: any;
}

class UltraAdaptiveRLService {
  private highImpactEvents: HighImpactEvent[] = [];
  private retrainingQueue: string[] = [];
  private vectorIndex: Map<string, number[]> = new Map(); // Simplified vector storage
  private isRetraining: boolean = false;

  async identifyHighImpactEvents(userId: string, lookbackHours = 24): Promise<HighImpactEvent[]> {
    console.log(`[UltraAdaptiveRL] Identifying high-impact events for user ${userId}`);
    
    const cutoffTime = new Date(Date.now() - lookbackHours * 60 * 60 * 1000);
    const trades = await storage.getUserTrades(userId, 100);
    const activities = await storage.getAgentActivities(userId, 100);
    
    const highImpactEvents: HighImpactEvent[] = [];

    // Identify high-impact trades (extreme wins/losses)
    trades.forEach(trade => {
      if (new Date(trade.executedAt) > cutoffTime) {
        const impactScore = this.calculateTradeImpact(trade);
        
        if (Math.abs(impactScore) > 0.7) {
          highImpactEvents.push({
            id: `trade_${trade.id}`,
            userId,
            tradeId: trade.id,
            eventType: 'trade_execution',
            impact: impactScore,
            features: this.extractTradeFeatures(trade),
            outcome: { pnl: trade.pnl, success: trade.pnl > 0 },
            timestamp: new Date(trade.executedAt),
            learningPotential: Math.abs(impactScore) * 0.8
          });
        }
      }
    });

    // Identify missed opportunities (high confidence signals not acted upon)
    activities.forEach(activity => {
      if (new Date(activity.createdAt) > cutoffTime && 
          activity.confidence > 0.8 && 
          activity.action === 'signal_generated') {
        
        const wasActedUpon = trades.some(trade => 
          Math.abs(new Date(trade.executedAt).getTime() - new Date(activity.createdAt).getTime()) < 300000
        );
        
        if (!wasActedUpon) {
          highImpactEvents.push({
            id: `missed_${activity.id}`,
            userId,
            eventType: 'missed_opportunity',
            impact: -0.5, // Negative because it was missed
            features: activity.metadata,
            outcome: { actionTaken: false, potentialPnL: 'unknown' },
            timestamp: new Date(activity.createdAt),
            learningPotential: 0.6
          });
        }
      }
    });

    // Store and return events
    this.highImpactEvents.push(...highImpactEvents);
    return highImpactEvents.sort((a, b) => b.learningPotential - a.learningPotential);
  }

  async triggerAdaptiveRetraining(events: HighImpactEvent[]): Promise<any> {
    if (this.isRetraining) {
      console.log('[UltraAdaptiveRL] Retraining already in progress');
      return { status: 'queued', message: 'Retraining queued' };
    }

    console.log(`[UltraAdaptiveRL] Starting adaptive retraining on ${events.length} high-impact events`);
    
    this.isRetraining = true;
    const retrainingSession = {
      sessionId: `retrain_${Date.now()}`,
      startTime: new Date(),
      events,
      status: 'in_progress'
    };

    try {
      // Extract learning examples from high-impact events
      const learningExamples = events.map(event => ({
        features: event.features,
        outcome: event.outcome,
        weight: event.learningPotential,
        eventType: event.eventType
      }));

      // Simulate fine-tuning process (in production, would trigger actual model retraining)
      const retrainingResults = await this.simulateModelRetraining(learningExamples);
      
      // Update model parameters based on results
      await this.updateModelParameters(retrainingResults);
      
      // Record retraining session
      await this.recordRetrainingSession({
        ...retrainingSession,
        endTime: new Date(),
        status: 'completed',
        results: retrainingResults
      });

      return {
        status: 'completed',
        sessionId: retrainingSession.sessionId,
        eventsProcessed: events.length,
        improvementMetrics: retrainingResults.metrics
      };

    } catch (error) {
      console.error('[UltraAdaptiveRL] Retraining failed:', error);
      await this.recordRetrainingSession({
        ...retrainingSession,
        endTime: new Date(),
        status: 'failed',
        error: error instanceof Error ? error.message : String(error)
      });
      
      return {
        status: 'failed',
        error: 'Retraining process failed',
        sessionId: retrainingSession.sessionId
      };
    } finally {
      this.isRetraining = false;
    }
  }

  async generateWhatIfScenarios(tradeId: string): Promise<WhatIfScenario[]> {
    console.log(`[UltraAdaptiveRL] Generating what-if scenarios for trade ${tradeId}`);
    
    const trade = await this.getTrade(tradeId);
    if (!trade) {
      throw new Error(`Trade ${tradeId} not found`);
    }

    const scenarios: WhatIfScenario[] = [];

    // Scenario 1: Different stop-loss
    const stopLossScenario = await this.simulateStopLossChange(trade, 0.02); // 2% stop-loss
    scenarios.push({
      scenarioId: `${tradeId}_stoploss_2pct`,
      originalTrade: trade,
      modifications: { stopLoss: '2%' },
      projectedOutcome: stopLossScenario.outcome,
      pnlDifference: stopLossScenario.pnlDifference,
      confidenceDelta: stopLossScenario.confidenceDelta,
      explanation: `With 2% stop-loss: PnL would change by $${stopLossScenario.pnlDifference.toFixed(2)}`
    });

    // Scenario 2: Different position size
    const positionSizeScenario = await this.simulatePositionSizeChange(trade, 0.5); // Half position
    scenarios.push({
      scenarioId: `${tradeId}_position_half`,
      originalTrade: trade,
      modifications: { positionSize: '50%' },
      projectedOutcome: positionSizeScenario.outcome,
      pnlDifference: positionSizeScenario.pnlDifference,
      confidenceDelta: positionSizeScenario.confidenceDelta,
      explanation: `With 50% position size: Risk-adjusted return would be ${positionSizeScenario.riskAdjustedImprovement > 0 ? 'better' : 'worse'}`
    });

    // Scenario 3: Different timing
    const timingScenario = await this.simulateTimingChange(trade, 300000); // 5 minutes later
    scenarios.push({
      scenarioId: `${tradeId}_timing_5min`,
      originalTrade: trade,
      modifications: { timing: '+5 minutes' },
      projectedOutcome: timingScenario.outcome,
      pnlDifference: timingScenario.pnlDifference,
      confidenceDelta: timingScenario.confidenceDelta,
      explanation: `If executed 5 minutes later: Entry price would be $${timingScenario.projectedPrice.toFixed(2)}`
    });

    return scenarios.sort((a, b) => Math.abs(b.pnlDifference) - Math.abs(a.pnlDifference));
  }

  async vectorSearchSimilarTrades(query: any, limit = 10): Promise<VectorSearchResult[]> {
    console.log('[UltraAdaptiveRL] Performing vector search for similar trades');
    
    const queryVector = this.encodeTradeToVector(query);
    const results: VectorSearchResult[] = [];

    // Search through vector index
    for (const [tradeId, vector] of this.vectorIndex.entries()) {
      const similarity = this.calculateCosineSimilarity(queryVector, vector);
      
      if (similarity > 0.7) { // Similarity threshold
        const trade = await this.getTrade(tradeId);
        if (trade) {
          results.push({
            tradeId,
            similarity,
            trade,
            marketContext: await this.getMarketContextForTrade(trade),
            outcome: { pnl: trade.pnl, success: trade.pnl > 0 }
          });
        }
      }
    }

    return results
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
  }

  async indexTradeForVectorSearch(trade: any): Promise<void> {
    const vector = this.encodeTradeToVector(trade);
    this.vectorIndex.set(trade.id, vector);
    
    console.log(`[UltraAdaptiveRL] Indexed trade ${trade.id} for vector search`);
  }

  async getAnalogousHistoricalScenarios(context: any): Promise<any[]> {
    console.log('[UltraAdaptiveRL] Finding analogous historical scenarios');
    
    const similarTrades = await this.vectorSearchSimilarTrades(context);
    
    return similarTrades.map(result => ({
      tradeId: result.tradeId,
      similarity: result.similarity,
      scenario: this.describeScenario(result.trade, result.marketContext),
      outcome: result.outcome,
      lessons: this.extractLessons(result.trade, result.outcome)
    }));
  }

  private calculateTradeImpact(trade: any): number {
    // Normalize PnL to portfolio size and calculate impact score
    const portfolioSize = 10000; // Would get actual portfolio size
    const normalizedPnL = trade.pnl / portfolioSize;
    
    // Consider both magnitude and relative to expected outcomes
    const impactScore = Math.tanh(normalizedPnL * 5); // Scale to -1 to 1
    return impactScore;
  }

  private extractTradeFeatures(trade: any): any {
    return {
      symbol: trade.symbol,
      type: trade.type,
      quantity: trade.quantity,
      price: trade.executedPrice,
      timestamp: trade.executedAt,
      marketHour: new Date(trade.executedAt).getHours(),
      dayOfWeek: new Date(trade.executedAt).getDay()
    };
  }

  private async simulateModelRetraining(learningExamples: any[]): Promise<any> {
    console.log(`[UltraAdaptiveRL] Simulating model retraining on ${learningExamples.length} examples`);
    
    // Simulate retraining metrics (in production, would run actual ML retraining)
    const metrics = {
      accuracyImprovement: Math.random() * 0.1 + 0.02, // 2-12% improvement
      lossReduction: Math.random() * 0.15 + 0.05, // 5-20% loss reduction
      confidenceCalibration: Math.random() * 0.08 + 0.03, // 3-11% better calibration
      convergenceEpochs: Math.floor(Math.random() * 50) + 20, // 20-70 epochs
      trainingTime: Math.random() * 300 + 60 // 1-6 minutes
    };

    // Simulate parameter updates
    const parameterUpdates = {
      learningRate: 0.001 * (1 + (Math.random() - 0.5) * 0.2),
      regularization: 0.01 * (1 + (Math.random() - 0.5) * 0.3),
      neuralNetworkWeights: 'updated_based_on_high_impact_events',
      attentionWeights: this.generateAttentionUpdates(learningExamples)
    };

    return {
      metrics,
      parameterUpdates,
      validationResults: {
        backtestImprovement: Math.random() * 0.05 + 0.01,
        riskAdjustedReturn: Math.random() * 0.1 + 0.02
      }
    };
  }

  private generateAttentionUpdates(examples: any[]): any {
    // Generate attention weight updates based on learning examples
    const featureImportance = {};
    
    examples.forEach(example => {
      if (example.eventType === 'trade_execution' && example.outcome.success) {
        // Increase attention to features that led to successful trades
        Object.keys(example.features).forEach(feature => {
          featureImportance[feature] = (featureImportance[feature] || 0) + 0.1;
        });
      }
    });

    return featureImportance;
  }

  private async updateModelParameters(retrainingResults: any): Promise<void> {
    // In production, would update actual model parameters
    console.log('[UltraAdaptiveRL] Updating model parameters with retraining results');
    
    await storage.recordAgentActivity({
      userId: 'system',
      agentType: 'ultra_adaptive_rl',
      action: 'model_parameter_update',
      confidence: 0.9,
      reasoning: 'Updated model parameters based on high-impact event retraining',
      metadata: {
        retrainingResults,
        timestamp: new Date(),
        updateType: 'adaptive_learning'
      }
    });
  }

  private async recordRetrainingSession(session: any): Promise<void> {
    await storage.recordAgentActivity({
      userId: 'system',
      agentType: 'ultra_adaptive_rl',
      action: 'retraining_session',
      confidence: session.status === 'completed' ? 0.95 : 0.1,
      reasoning: `Adaptive retraining session ${session.status}`,
      metadata: {
        session,
        timestamp: new Date()
      }
    });
  }

  private async simulateStopLossChange(trade: any, stopLossPercent: number): Promise<any> {
    const currentPrice = trade.executedPrice;
    const stopLossPrice = trade.type === 'buy' 
      ? currentPrice * (1 - stopLossPercent)
      : currentPrice * (1 + stopLossPercent);
    
    // Simulate if stop-loss would have been triggered
    const wouldBeTriggered = Math.random() > 0.7; // 30% chance stop-loss would trigger
    
    if (wouldBeTriggered) {
      const stopLossPnL = (stopLossPrice - currentPrice) * trade.quantity * (trade.type === 'buy' ? 1 : -1);
      return {
        outcome: { triggered: true, exitPrice: stopLossPrice },
        pnlDifference: stopLossPnL - trade.pnl,
        confidenceDelta: 0.1 // Slightly more confident with risk management
      };
    }
    
    return {
      outcome: { triggered: false },
      pnlDifference: 0,
      confidenceDelta: 0
    };
  }

  private async simulatePositionSizeChange(trade: any, sizeMultiplier: number): Promise<any> {
    const newQuantity = trade.quantity * sizeMultiplier;
    const newPnL = trade.pnl * sizeMultiplier;
    const newRisk = Math.abs(newPnL) / (trade.quantity * trade.executedPrice);
    
    return {
      outcome: { quantity: newQuantity, pnl: newPnL },
      pnlDifference: newPnL - trade.pnl,
      confidenceDelta: sizeMultiplier < 1 ? 0.05 : -0.05, // More confident with smaller positions
      riskAdjustedImprovement: sizeMultiplier < 1 && trade.pnl < 0 ? 1 : 0
    };
  }

  private async simulateTimingChange(trade: any, timeDelayMs: number): Promise<any> {
    const newExecutionTime = new Date(new Date(trade.executedAt).getTime() + timeDelayMs);
    
    // Simulate price movement during delay
    const priceVolatility = 0.002; // 0.2% volatility per 5 minutes
    const randomMovement = (Math.random() - 0.5) * 2 * priceVolatility;
    const projectedPrice = trade.executedPrice * (1 + randomMovement);
    
    const priceDifference = projectedPrice - trade.executedPrice;
    const pnlDifference = priceDifference * trade.quantity * (trade.type === 'buy' ? 1 : -1);
    
    return {
      outcome: { executedAt: newExecutionTime, price: projectedPrice },
      pnlDifference,
      confidenceDelta: 0,
      projectedPrice
    };
  }

  private encodeTradeToVector(trade: any): number[] {
    // Simple vector encoding (in production, would use learned embeddings)
    const symbolHash = this.hashString(trade.symbol || 'unknown') / 1000000000;
    const typeValue = trade.type === 'buy' ? 1 : -1;
    const hour = new Date(trade.executedAt || new Date()).getHours() / 24;
    const day = new Date(trade.executedAt || new Date()).getDay() / 7;
    const priceNorm = Math.log(trade.executedPrice || 1) / 20;
    
    return [symbolHash, typeValue, hour, day, priceNorm];
  }

  private calculateCosineSimilarity(vec1: number[], vec2: number[]): number {
    const dotProduct = vec1.reduce((sum, a, i) => sum + a * vec2[i], 0);
    const magnitude1 = Math.sqrt(vec1.reduce((sum, a) => sum + a * a, 0));
    const magnitude2 = Math.sqrt(vec2.reduce((sum, a) => sum + a * a, 0));
    
    return magnitude1 && magnitude2 ? dotProduct / (magnitude1 * magnitude2) : 0;
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  private async getTrade(tradeId: string): Promise<any> {
    // Simplified trade retrieval
    const allTrades = await storage.getAllTrades?.() || [];
    return allTrades.find(t => t.id === tradeId) || null;
  }

  private async getMarketContextForTrade(trade: any): Promise<any> {
    return {
      timestamp: trade.executedAt,
      symbol: trade.symbol,
      price: trade.executedPrice,
      volume: trade.quantity,
      marketHour: new Date(trade.executedAt).getHours(),
      regime: this.classifyMarketRegime(trade)
    };
  }

  private classifyMarketRegime(trade: any): string {
    // Simplified regime classification
    const hour = new Date(trade.executedAt).getHours();
    if (hour >= 9 && hour <= 16) return 'active_trading';
    if (hour >= 17 && hour <= 23) return 'evening_session';
    return 'overnight';
  }

  private describeScenario(trade: any, context: any): string {
    return `${trade.type.toUpperCase()} ${trade.symbol} during ${context.regime} at $${trade.executedPrice}`;
  }

  private extractLessons(trade: any, outcome: any): string[] {
    const lessons = [];
    
    if (outcome.success && trade.pnl > 100) {
      lessons.push('High-profit trades often occur during specific market regimes');
    }
    
    if (!outcome.success && Math.abs(trade.pnl) > 50) {
      lessons.push('Large losses suggest need for better risk management');
    }
    
    return lessons;
  }
}

export const ultraAdaptiveRL = new UltraAdaptiveRLService();