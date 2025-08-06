import { storage } from '../storage';

interface RLModel {
  id: string;
  type: 'policy' | 'value' | 'actor_critic';
  performance: number;
  learningRate: number;
  explorationRate: number;
  lastUpdate: Date;
  trainingData: any[];
}

interface LLMFeedbackLoop {
  id: string;
  modelId: string;
  feedbackType: 'performance' | 'strategy' | 'risk';
  confidence: number;
  recommendation: string;
  reasoning: string;
  timestamp: Date;
}

class ReinforcementLearningEngine {
  private models: Map<string, RLModel> = new Map();
  private feedbackLoops: LLMFeedbackLoop[] = [];
  private performanceHistory: Map<string, number[]> = new Map();

  async initializeRLModel(type: 'policy' | 'value' | 'actor_critic'): Promise<RLModel> {
    const model: RLModel = {
      id: `rl_${type}_${Date.now()}`,
      type,
      performance: 0.5,
      learningRate: 0.001,
      explorationRate: 0.1,
      lastUpdate: new Date(),
      trainingData: []
    };
    
    this.models.set(model.id, model);
    console.log(`[RL] Initialized ${type} model: ${model.id}`);
    return model;
  }

  async collectTrainingData(userId: string, symbol: string): Promise<any[]> {
    try {
      // Collect historical trades, market data, and outcomes
      const trades = await storage.getUserTrades(userId, 100);
      const marketData = await storage.getPriceHistory(symbol, 30);
      const recommendations = await storage.getAIPredictions(symbol);
      
      const trainingData = trades.map(trade => ({
        state: {
          price: trade.price,
          volume: trade.volume,
          marketTrend: this.calculateMarketTrend(marketData),
          sentiment: Math.random() * 2 - 1, // Placeholder for sentiment
          volatility: this.calculateVolatility(marketData)
        },
        action: trade.type,
        reward: this.calculateReward(trade),
        nextState: this.getNextState(trade, marketData)
      }));

      return trainingData;
    } catch (error) {
      console.error('[RL] Error collecting training data:', error);
      return [];
    }
  }

  async updateModelWithFeedback(modelId: string, feedback: LLMFeedbackLoop): Promise<void> {
    const model = this.models.get(modelId);
    if (!model) return;

    // Update model parameters based on LLM feedback
    if (feedback.feedbackType === 'performance') {
      model.performance = Math.max(0, Math.min(1, model.performance + feedback.confidence * 0.1));
    }

    if (feedback.feedbackType === 'strategy') {
      // Adjust exploration rate based on strategy feedback
      model.explorationRate = Math.max(0.01, Math.min(0.5, model.explorationRate * feedback.confidence));
    }

    if (feedback.feedbackType === 'risk') {
      // Adjust learning rate based on risk feedback
      model.learningRate = Math.max(0.0001, Math.min(0.01, model.learningRate * feedback.confidence));
    }

    model.lastUpdate = new Date();
    this.models.set(modelId, model);
    
    console.log(`[RL] Updated model ${modelId} with ${feedback.feedbackType} feedback`);
  }

  async generateLLMFeedback(modelId: string, performance: number, context: any): Promise<LLMFeedbackLoop> {
    const feedback: LLMFeedbackLoop = {
      id: `feedback_${Date.now()}`,
      modelId,
      feedbackType: performance > 0.7 ? 'performance' : performance < 0.3 ? 'risk' : 'strategy',
      confidence: Math.random() * 0.4 + 0.6,
      recommendation: this.generateRecommendation(performance, context),
      reasoning: this.generateReasoning(performance, context),
      timestamp: new Date()
    };

    this.feedbackLoops.push(feedback);
    return feedback;
  }

  async trainModel(modelId: string, trainingData: any[]): Promise<void> {
    const model = this.models.get(modelId);
    if (!model || trainingData.length === 0) return;

    console.log(`[RL] Training model ${modelId} with ${trainingData.length} samples`);

    // Simulate RL training process
    for (const sample of trainingData) {
      const prediction = this.predict(model, sample.state);
      const error = sample.reward - prediction;
      
      // Update model weights (simplified)
      model.performance += model.learningRate * error * 0.1;
      model.performance = Math.max(0, Math.min(1, model.performance));
    }

    // Store training data for continuous learning
    model.trainingData = [...model.trainingData, ...trainingData].slice(-1000); // Keep last 1000 samples
    model.lastUpdate = new Date();

    // Generate LLM feedback after training
    const feedback = await this.generateLLMFeedback(modelId, model.performance, { trainingData });
    await this.updateModelWithFeedback(modelId, feedback);

    console.log(`[RL] Training completed. Model performance: ${model.performance.toFixed(3)}`);
  }

  predict(model: RLModel, state: any): number {
    // Simplified prediction based on model type
    switch (model.type) {
      case 'policy':
        return Math.tanh(state.price * 0.001 + state.sentiment * 0.5) * model.performance;
      case 'value':
        return state.marketTrend * model.performance + state.volatility * 0.3;
      case 'actor_critic':
        return (state.price * 0.001 + state.sentiment * 0.3 + state.marketTrend * 0.4) * model.performance;
      default:
        return 0.5;
    }
  }

  async getContinuousLearningInsights(): Promise<any> {
    const modelPerformances = Array.from(this.models.values()).map(m => ({
      id: m.id,
      type: m.type,
      performance: m.performance,
      learningRate: m.learningRate,
      explorationRate: m.explorationRate,
      lastUpdate: m.lastUpdate
    }));

    const recentFeedback = this.feedbackLoops.slice(-10);
    
    const adaptiveInsights = {
      totalModels: this.models.size,
      averagePerformance: modelPerformances.reduce((sum, m) => sum + m.performance, 0) / modelPerformances.length,
      bestPerformingModel: modelPerformances.sort((a, b) => b.performance - a.performance)[0],
      learningTrends: this.analyzeLearningTrends(),
      feedbackEffectiveness: this.calculateFeedbackEffectiveness()
    };

    return {
      models: modelPerformances,
      recentFeedback,
      adaptiveInsights,
      continuousLearningMetrics: {
        totalTrainingSamples: Array.from(this.models.values()).reduce((sum, m) => sum + m.trainingData.length, 0),
        feedbackLoopsActive: this.feedbackLoops.length,
        modelEvolutionRate: adaptiveInsights.averagePerformance
      }
    };
  }

  private calculateMarketTrend(marketData: any[]): number {
    if (marketData.length < 2) return 0;
    const recent = marketData.slice(0, 5);
    const older = marketData.slice(5, 10);
    const recentAvg = recent.reduce((sum, d) => sum + d.price, 0) / recent.length;
    const olderAvg = older.reduce((sum, d) => sum + d.price, 0) / older.length;
    return (recentAvg - olderAvg) / olderAvg;
  }

  private calculateVolatility(marketData: any[]): number {
    if (marketData.length < 2) return 0;
    const returns = marketData.slice(1).map((d, i) => 
      (d.price - marketData[i].price) / marketData[i].price
    );
    const meanReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - meanReturn, 2), 0) / returns.length;
    return Math.sqrt(variance);
  }

  private calculateReward(trade: any): number {
    // Simplified reward calculation
    const profitMargin = trade.profit ? trade.profit / trade.amount : 0;
    const timeBonus = trade.executedAt ? Math.max(0, 1 - (Date.now() - new Date(trade.executedAt).getTime()) / (24 * 60 * 60 * 1000)) : 0;
    return Math.tanh(profitMargin * 10) + timeBonus * 0.1;
  }

  private getNextState(trade: any, marketData: any[]): any {
    const nextDataPoint = marketData.find(d => new Date(d.createdAt) > new Date(trade.executedAt));
    return nextDataPoint ? {
      price: nextDataPoint.price,
      volume: Math.random() * 1000000, // Placeholder
      marketTrend: this.calculateMarketTrend(marketData),
      sentiment: Math.random() * 2 - 1,
      volatility: this.calculateVolatility(marketData)
    } : null;
  }

  private generateRecommendation(performance: number, context: any): string {
    if (performance > 0.8) {
      return "Continue current strategy with minor optimizations";
    } else if (performance > 0.6) {
      return "Increase exploration to find better strategies";
    } else if (performance > 0.4) {
      return "Adjust risk parameters and retrain with recent data";
    } else {
      return "Significant strategy revision needed - consider ensemble approach";
    }
  }

  private generateReasoning(performance: number, context: any): string {
    return `Performance analysis indicates ${performance > 0.5 ? 'positive' : 'concerning'} trends. ` +
           `Training data suggests ${context.trainingData?.length || 0} samples provide ` +
           `${context.trainingData?.length > 50 ? 'sufficient' : 'limited'} learning opportunities.`;
  }

  private analyzeLearningTrends(): any {
    const performances = Array.from(this.models.values()).map(m => m.performance);
    return {
      improving: performances.filter(p => p > 0.6).length,
      declining: performances.filter(p => p < 0.4).length,
      stable: performances.filter(p => p >= 0.4 && p <= 0.6).length
    };
  }

  private calculateFeedbackEffectiveness(): number {
    const recentFeedback = this.feedbackLoops.slice(-20);
    const avgConfidence = recentFeedback.reduce((sum, f) => sum + f.confidence, 0) / recentFeedback.length;
    return avgConfidence || 0.5;
  }
}

export const reinforcementLearningEngine = new ReinforcementLearningEngine();