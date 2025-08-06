/**
 * Data Fusion Intelligence Engine - Revolutionary Multi-Source Intelligence
 * 
 * Combines sentiment analysis with market regime detection, correlation analysis
 * for portfolio optimization, and hybrid crowd-AI ensemble scoring
 */

import { storage } from '../storage';
import { logger } from '../utils/logger';

export interface SentimentRegimeMatrix {
  marketRegime: string;
  sentimentThreshold: {
    bullish: number;
    bearish: number;
    neutral: number;
  };
  correlationStrength: number;
  historicalAccuracy: number;
}

export interface CorrelationAlert {
  asset1: string;
  asset2: string;
  correlation: number;
  threshold: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  recommendedAction: string;
}

export interface CrowdAIEnsembleScore {
  symbol: string;
  aiScore: number;
  communityScore: number;
  hybridScore: number;
  confidence: number;
  reasoning: string[];
}

export class DataFusionEngine {
  private sentimentRegimeMatrices: Map<string, SentimentRegimeMatrix> = new Map();
  private correlationThresholds = {
    normal: 0.7,
    stress: 0.85,
    crisis: 0.95
  };

  constructor() {
    this.initializeSentimentRegimeMatrices();
  }

  private initializeSentimentRegimeMatrices() {
    const matrices: SentimentRegimeMatrix[] = [
      {
        marketRegime: 'bull',
        sentimentThreshold: { bullish: 0.6, bearish: 0.2, neutral: 0.4 },
        correlationStrength: 0.75,
        historicalAccuracy: 0.82
      },
      {
        marketRegime: 'bear',
        sentimentThreshold: { bullish: 0.3, bearish: 0.7, neutral: 0.5 },
        correlationStrength: 0.85,
        historicalAccuracy: 0.78
      },
      {
        marketRegime: 'sideways',
        sentimentThreshold: { bullish: 0.45, bearish: 0.45, neutral: 0.6 },
        correlationStrength: 0.65,
        historicalAccuracy: 0.71
      },
      {
        marketRegime: 'volatile',
        sentimentThreshold: { bullish: 0.8, bearish: 0.8, neutral: 0.3 },
        correlationStrength: 0.90,
        historicalAccuracy: 0.85
      }
    ];

    matrices.forEach(matrix => {
      this.sentimentRegimeMatrices.set(matrix.marketRegime, matrix);
    });
  }

  async createSentimentRegimeCorrelationMatrix(symbol: string): Promise<any> {
    try {
      const currentRegime = await storage.getCurrentMarketRegime(symbol);
      const sentimentData = await storage.getSentimentData(symbol);
      
      if (!currentRegime || !sentimentData.length) {
        return this.getDefaultMatrix(symbol);
      }

      const matrix = this.sentimentRegimeMatrices.get(currentRegime.regime);
      if (!matrix) {
        return this.getDefaultMatrix(symbol);
      }

      // Calculate dynamic thresholds based on current sentiment
      const averageSentiment = sentimentData.reduce((sum, data) => sum + data.sentiment, 0) / sentimentData.length;
      const sentimentVolatility = this.calculateSentimentVolatility(sentimentData);
      
      const dynamicThresholds = {
        bullish: matrix.sentimentThreshold.bullish * (1 + averageSentiment * 0.2),
        bearish: matrix.sentimentThreshold.bearish * (1 - averageSentiment * 0.2),
        neutral: matrix.sentimentThreshold.neutral * (1 + sentimentVolatility * 0.1)
      };

      // Create correlation matrix with regime-adjusted sentiment
      const correlationMatrix = {
        symbol,
        regime: currentRegime.regime,
        sentimentThresholds: dynamicThresholds,
        currentSentiment: averageSentiment,
        sentimentVolatility,
        regimeConfidence: currentRegime.confidence,
        correlationStrength: matrix.correlationStrength,
        predictedDirection: this.predictDirectionFromSentimentRegime(averageSentiment, currentRegime.regime, dynamicThresholds),
        riskAdjustment: this.calculateRiskAdjustment(currentRegime.regime, sentimentVolatility)
      };

      await storage.storeSentimentRegimeMatrix(correlationMatrix);

      logger.info(`Created sentiment-regime correlation matrix`, { symbol, regime: currentRegime.regime });

      return correlationMatrix;

    } catch (error) {
      logger.error(`Failed to create sentiment-regime correlation matrix`, { symbol, error });
      return this.getDefaultMatrix(symbol);
    }
  }

  private calculateSentimentVolatility(sentimentData: any[]): number {
    if (sentimentData.length < 2) return 0;

    const sentiments = sentimentData.map(d => d.sentiment);
    const mean = sentiments.reduce((sum, s) => sum + s, 0) / sentiments.length;
    const variance = sentiments.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / sentiments.length;
    
    return Math.sqrt(variance);
  }

  private predictDirectionFromSentimentRegime(sentiment: number, regime: string, thresholds: any): string {
    if (sentiment > thresholds.bullish) {
      return regime === 'bear' ? 'weak_bullish' : 'bullish';
    } else if (sentiment < -thresholds.bearish) {
      return regime === 'bull' ? 'weak_bearish' : 'bearish';
    } else {
      return 'neutral';
    }
  }

  private calculateRiskAdjustment(regime: string, sentimentVolatility: number): number {
    const baseRisk = {
      'bull': 0.8,
      'bear': 1.2,
      'sideways': 1.0,
      'volatile': 1.5
    };

    const volatilityMultiplier = 1 + (sentimentVolatility * 2);
    return (baseRisk[regime as keyof typeof baseRisk] || 1.0) * volatilityMultiplier;
  }

  async analyzeCorrelationAlerts(): Promise<CorrelationAlert[]> {
    try {
      const alerts: CorrelationAlert[] = [];
      const correlations = await storage.getAllCorrelationData();
      
      for (const correlation of correlations) {
        const alert = this.evaluateCorrelationRisk(correlation);
        if (alert) {
          alerts.push(alert);
        }
      }

      // Sort by risk level (critical first)
      alerts.sort((a, b) => {
        const riskOrder = { 'critical': 4, 'high': 3, 'medium': 2, 'low': 1 };
        return riskOrder[b.riskLevel] - riskOrder[a.riskLevel];
      });

      logger.info(`Generated correlation alerts`, { alertCount: alerts.length });

      return alerts;

    } catch (error) {
      logger.error(`Failed to analyze correlation alerts`, { error });
      return [];
    }
  }

  private evaluateCorrelationRisk(correlation: any): CorrelationAlert | null {
    const absCorrelation = Math.abs(correlation.correlation);
    
    let riskLevel: 'low' | 'medium' | 'high' | 'critical';
    let threshold: number;
    let recommendedAction: string;

    if (absCorrelation >= this.correlationThresholds.crisis) {
      riskLevel = 'critical';
      threshold = this.correlationThresholds.crisis;
      recommendedAction = 'Immediate diversification required - positions are dangerously correlated';
    } else if (absCorrelation >= this.correlationThresholds.stress) {
      riskLevel = 'high';
      threshold = this.correlationThresholds.stress;
      recommendedAction = 'Consider rebalancing - correlation approaching stress levels';
    } else if (absCorrelation >= this.correlationThresholds.normal) {
      riskLevel = 'medium';
      threshold = this.correlationThresholds.normal;
      recommendedAction = 'Monitor closely - correlation above normal levels';
    } else {
      return null; // No alert needed for low correlations
    }

    return {
      asset1: correlation.asset1,
      asset2: correlation.asset2,
      correlation: correlation.correlation,
      threshold,
      riskLevel,
      recommendedAction
    };
  }

  async generateCrowdAIEnsembleScore(symbol: string): Promise<CrowdAIEnsembleScore> {
    try {
      // Get AI predictions
      const aiPredictions = await storage.getAIPredictions(symbol);
      const aiScore = this.calculateAIScore(aiPredictions);

      // Get community signals
      const communitySignals = await storage.getCommunitySignals(symbol);
      const communityScore = this.calculateCommunityScore(communitySignals);

      // Calculate hybrid score with dynamic weighting
      const aiWeight = await this.calculateAIWeight(symbol);
      const communityWeight = 1 - aiWeight;
      
      const hybridScore = (aiScore * aiWeight) + (communityScore * communityWeight);
      
      // Calculate confidence based on agreement between AI and community
      const confidence = this.calculateEnsembleConfidence(aiScore, communityScore);

      // Generate reasoning
      const reasoning = this.generateEnsembleReasoning(aiScore, communityScore, aiWeight, communityWeight);

      const ensembleScore: CrowdAIEnsembleScore = {
        symbol,
        aiScore,
        communityScore,
        hybridScore,
        confidence,
        reasoning
      };

      await storage.storeCrowdAIEnsembleScore(ensembleScore);

      logger.info(`Generated crowd-AI ensemble score`, { symbol, hybridScore, confidence });

      return ensembleScore;

    } catch (error) {
      logger.error(`Failed to generate crowd-AI ensemble score`, { symbol, error });
      return {
        symbol,
        aiScore: 0.5,
        communityScore: 0.5,
        hybridScore: 0.5,
        confidence: 0.3,
        reasoning: ['Insufficient data for ensemble scoring']
      };
    }
  }

  private calculateAIScore(predictions: any[]): number {
    if (!predictions.length) return 0.5;

    const weightedSum = predictions.reduce((sum, pred) => {
      return sum + (pred.score * pred.confidence);
    }, 0);

    const totalWeight = predictions.reduce((sum, pred) => sum + pred.confidence, 0);

    return totalWeight > 0 ? weightedSum / totalWeight : 0.5;
  }

  private calculateCommunityScore(signals: any[]): number {
    if (!signals.length) return 0.5;

    const weightedSum = signals.reduce((sum, signal) => {
      const userWeight = signal.userReputation || 1;
      return sum + (signal.score * userWeight);
    }, 0);

    const totalWeight = signals.reduce((sum, signal) => sum + (signal.userReputation || 1), 0);

    return totalWeight > 0 ? weightedSum / totalWeight : 0.5;
  }

  private async calculateAIWeight(symbol: string): Promise<number> {
    try {
      // Get recent AI performance for this symbol
      const aiPerformance = await storage.getAIPerformanceForSymbol(symbol);
      const communityPerformance = await storage.getCommunityPerformanceForSymbol(symbol);

      if (!aiPerformance || !communityPerformance) {
        return 0.6; // Default slightly favor AI
      }

      // Dynamic weighting based on recent performance
      const aiAccuracy = aiPerformance.accuracy || 0.5;
      const communityAccuracy = communityPerformance.accuracy || 0.5;

      const totalAccuracy = aiAccuracy + communityAccuracy;
      return totalAccuracy > 0 ? aiAccuracy / totalAccuracy : 0.6;

    } catch (error) {
      logger.error(`Failed to calculate AI weight`, { symbol, error });
      return 0.6;
    }
  }

  private calculateEnsembleConfidence(aiScore: number, communityScore: number): number {
    // Higher confidence when AI and community agree
    const agreement = 1 - Math.abs(aiScore - communityScore);
    
    // Boost confidence when both scores are extreme (high conviction)
    const extremeBoost = Math.max(0, (Math.abs(aiScore - 0.5) + Math.abs(communityScore - 0.5)) - 0.5);
    
    return Math.min(0.95, agreement * 0.7 + extremeBoost * 0.3);
  }

  private generateEnsembleReasoning(aiScore: number, communityScore: number, aiWeight: number, communityWeight: number): string[] {
    const reasoning: string[] = [];

    if (Math.abs(aiScore - communityScore) < 0.1) {
      reasoning.push('Strong consensus between AI and community analysis');
    } else if (aiScore > communityScore + 0.2) {
      reasoning.push('AI analysis more bullish than community sentiment');
    } else if (communityScore > aiScore + 0.2) {
      reasoning.push('Community sentiment more bullish than AI analysis');
    }

    if (aiWeight > 0.7) {
      reasoning.push('AI models showing superior recent performance');
    } else if (communityWeight > 0.7) {
      reasoning.push('Community signals outperforming AI recently');
    } else {
      reasoning.push('Balanced weighting between AI and community insights');
    }

    return reasoning;
  }

  async optimizePortfolioWeights(portfolioSymbols: string[]): Promise<Record<string, number>> {
    try {
      const optimizedWeights: Record<string, number> = {};
      const correlationMatrix = await this.buildCorrelationMatrix(portfolioSymbols);
      
      // Simple mean-variance optimization with correlation constraints
      for (const symbol of portfolioSymbols) {
        const baseWeight = 1 / portfolioSymbols.length; // Equal weight starting point
        const correlationPenalty = this.calculateCorrelationPenalty(symbol, portfolioSymbols, correlationMatrix);
        const riskAdjustment = await this.getRiskAdjustment(symbol);
        
        optimizedWeights[symbol] = Math.max(0.05, baseWeight * (1 - correlationPenalty) * riskAdjustment);
      }

      // Normalize weights to sum to 1
      const totalWeight = Object.values(optimizedWeights).reduce((sum, w) => sum + w, 0);
      Object.keys(optimizedWeights).forEach(symbol => {
        optimizedWeights[symbol] /= totalWeight;
      });

      logger.info(`Optimized portfolio weights`, { optimizedWeights });

      return optimizedWeights;

    } catch (error) {
      logger.error(`Failed to optimize portfolio weights`, { error });
      // Return equal weights as fallback
      const equalWeight = 1 / portfolioSymbols.length;
      return portfolioSymbols.reduce((acc, symbol) => {
        acc[symbol] = equalWeight;
        return acc;
      }, {} as Record<string, number>);
    }
  }

  private async buildCorrelationMatrix(symbols: string[]): Promise<Record<string, Record<string, number>>> {
    const matrix: Record<string, Record<string, number>> = {};
    
    for (const symbol1 of symbols) {
      matrix[symbol1] = {};
      for (const symbol2 of symbols) {
        if (symbol1 === symbol2) {
          matrix[symbol1][symbol2] = 1.0;
        } else {
          const correlation = await storage.getCorrelation(symbol1, symbol2);
          matrix[symbol1][symbol2] = correlation?.correlation || 0;
        }
      }
    }

    return matrix;
  }

  private calculateCorrelationPenalty(symbol: string, allSymbols: string[], correlationMatrix: Record<string, Record<string, number>>): number {
    const correlations = allSymbols
      .filter(s => s !== symbol)
      .map(s => Math.abs(correlationMatrix[symbol]?.[s] || 0));
    
    const avgCorrelation = correlations.reduce((sum, c) => sum + c, 0) / correlations.length;
    
    // Higher average correlation = higher penalty
    return Math.min(0.5, avgCorrelation * 0.7);
  }

  private async getRiskAdjustment(symbol: string): Promise<number> {
    try {
      const riskMetrics = await storage.getAssetRiskMetrics(symbol);
      if (!riskMetrics) return 1.0;

      // Lower volatility = higher weight allowance
      const volatilityAdjustment = 1 / (1 + riskMetrics.volatility);
      
      return Math.max(0.5, Math.min(1.5, volatilityAdjustment));

    } catch (error) {
      return 1.0;
    }
  }

  private getDefaultMatrix(symbol: string): any {
    return {
      symbol,
      regime: 'sideways',
      sentimentThresholds: { bullish: 0.6, bearish: 0.4, neutral: 0.5 },
      currentSentiment: 0.1,
      sentimentVolatility: 0.2,
      regimeConfidence: 0.5,
      correlationStrength: 0.65,
      predictedDirection: 'neutral',
      riskAdjustment: 1.0
    };
  }
}

export const dataFusionEngine = new DataFusionEngine();