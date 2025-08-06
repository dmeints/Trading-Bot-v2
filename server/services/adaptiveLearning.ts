/**
 * Adaptive Learning Engine - Revolutionary AI Performance Amplification
 * 
 * Implements cross-agent knowledge sharing, dynamic agent selection,
 * and continuous model confidence weight updates
 */

import { storage } from '../storage';
import { logger } from '../utils/logger';

export interface AgentPerformanceMetrics {
  agentType: string;
  accuracy: number;
  confidence: number;
  predictions: number;
  successRate: number;
  marketRegime: string;
  lastUpdated: Date;
}

export interface CrossAgentInsight {
  sourceAgent: string;
  targetAgent: string;
  insight: string;
  confidence: number;
  marketCondition: string;
  impact: number;
}

export class AdaptiveLearningEngine {
  private performanceHistory: Map<string, AgentPerformanceMetrics[]> = new Map();
  private confidenceWeights: Map<string, number> = new Map();
  private crossAgentInsights: CrossAgentInsight[] = [];

  constructor() {
    this.initializeConfidenceWeights();
  }

  private initializeConfidenceWeights() {
    const defaultWeights = {
      'market_analyst': 0.85,
      'news_analyst': 0.75,
      'trading_agent': 0.80,
      'risk_assessor': 0.90,
      'sentiment_analyst': 0.70
    };

    Object.entries(defaultWeights).forEach(([agent, weight]) => {
      this.confidenceWeights.set(agent, weight);
    });
  }

  async updateAgentPerformance(
    agentType: string, 
    prediction: any, 
    actualOutcome: any, 
    marketRegime: string
  ): Promise<void> {
    try {
      const accuracy = this.calculateAccuracy(prediction, actualOutcome);
      const currentMetrics = await this.getAgentMetrics(agentType);
      
      // Update confidence weights based on performance
      const currentWeight = this.confidenceWeights.get(agentType) || 0.5;
      const adaptiveWeight = this.calculateAdaptiveWeight(currentWeight, accuracy);
      this.confidenceWeights.set(agentType, adaptiveWeight);

      // Store performance metrics
      const metrics: AgentPerformanceMetrics = {
        agentType,
        accuracy,
        confidence: adaptiveWeight,
        predictions: (currentMetrics?.predictions || 0) + 1,
        successRate: this.calculateRunningSuccessRate(agentType, accuracy),
        marketRegime,
        lastUpdated: new Date()
      };

      await this.storePerformanceMetrics(metrics);
      
      // Generate cross-agent insights
      await this.generateCrossAgentInsights(agentType, prediction, accuracy, marketRegime);

      logger.info(`Updated ${agentType} performance`, {
        accuracy,
        newWeight: adaptiveWeight,
        marketRegime
      });

    } catch (error) {
      logger.error(`Failed to update agent performance`, { agentType, error });
    }
  }

  private calculateAccuracy(prediction: any, actualOutcome: any): number {
    if (!prediction || !actualOutcome) return 0;

    // For price predictions
    if (prediction.targetPrice && actualOutcome.actualPrice) {
      const error = Math.abs(prediction.targetPrice - actualOutcome.actualPrice) / actualOutcome.actualPrice;
      return Math.max(0, 1 - error);
    }

    // For directional predictions
    if (prediction.direction && actualOutcome.direction) {
      return prediction.direction === actualOutcome.direction ? 1 : 0;
    }

    // For confidence-based predictions
    if (prediction.confidence !== undefined && actualOutcome.success !== undefined) {
      return actualOutcome.success ? prediction.confidence : (1 - prediction.confidence);
    }

    return 0.5; // Default neutral accuracy
  }

  private calculateAdaptiveWeight(currentWeight: number, recentAccuracy: number): number {
    const learningRate = 0.1;
    const momentum = 0.9;
    
    // Adaptive weight adjustment with momentum
    const targetWeight = recentAccuracy;
    const weightChange = learningRate * (targetWeight - currentWeight);
    const newWeight = currentWeight + (momentum * weightChange);
    
    // Ensure weights stay within reasonable bounds
    return Math.max(0.1, Math.min(0.99, newWeight));
  }

  private calculateRunningSuccessRate(agentType: string, newAccuracy: number): number {
    const history = this.performanceHistory.get(agentType) || [];
    const recentHistory = history.slice(-20); // Last 20 predictions
    const totalAccuracy = recentHistory.reduce((sum, m) => sum + m.accuracy, 0) + newAccuracy;
    return totalAccuracy / (recentHistory.length + 1);
  }

  async selectOptimalAgent(marketRegime: string, predictionType: string): Promise<string> {
    try {
      const agentScores = new Map<string, number>();
      
      for (const [agentType, baseWeight] of this.confidenceWeights) {
        const recentMetrics = await this.getRecentAgentMetrics(agentType, marketRegime);
        const regimeBonus = this.getRegimeSpecificBonus(agentType, marketRegime);
        const crossAgentBonus = this.getCrossAgentBonus(agentType);
        
        const totalScore = baseWeight * (1 + regimeBonus + crossAgentBonus) * 
                          (recentMetrics?.successRate || 0.5);
        
        agentScores.set(agentType, totalScore);
      }

      // Select agent with highest score
      const scoresArray = Array.from(agentScores.entries());
      const optimalAgent = scoresArray.length > 0 ? 
        scoresArray.reduce((best, current) => current[1] > best[1] ? current : best)[0] :
        'trading_agent';

      logger.info(`Selected optimal agent`, { 
        agent: optimalAgent, 
        marketRegime, 
        predictionType,
        scores: Array.from(agentScores.entries()).reduce((obj, [key, value]) => {
          obj[key] = value;
          return obj;
        }, {} as Record<string, number>)
      });

      return optimalAgent;

    } catch (error) {
      logger.error(`Failed to select optimal agent`, { error });
      return 'trading_agent'; // Fallback
    }
  }

  private getRegimeSpecificBonus(agentType: string, marketRegime: string): number {
    const regimeBonuses: Record<string, Record<string, number>> = {
      'bull': {
        'market_analyst': 0.2,
        'sentiment_analyst': 0.15,
        'trading_agent': 0.1
      },
      'bear': {
        'risk_assessor': 0.25,
        'news_analyst': 0.2,
        'market_analyst': 0.1
      },
      'sideways': {
        'trading_agent': 0.2,
        'market_analyst': 0.15
      },
      'volatile': {
        'risk_assessor': 0.3,
        'sentiment_analyst': 0.2
      }
    };

    return regimeBonuses[marketRegime]?.[agentType] || 0;
  }

  private getCrossAgentBonus(agentType: string): number {
    const relevantInsights = this.crossAgentInsights.filter(
      insight => insight.targetAgent === agentType
    );
    
    return relevantInsights.reduce((bonus, insight) => 
      bonus + (insight.impact * insight.confidence), 0
    ) / Math.max(1, relevantInsights.length);
  }

  async generateCrossAgentInsights(
    sourceAgent: string, 
    prediction: any, 
    accuracy: number, 
    marketRegime: string
  ): Promise<void> {
    try {
      // Market Analyst → Risk Assessor
      if (sourceAgent === 'market_analyst' && accuracy > 0.8) {
        this.crossAgentInsights.push({
          sourceAgent,
          targetAgent: 'risk_assessor',
          insight: `High-confidence market analysis suggests ${prediction.direction} movement`,
          confidence: accuracy,
          marketCondition: marketRegime,
          impact: 0.15
        });
      }

      // News Analyst → Sentiment Analyst
      if (sourceAgent === 'news_analyst' && prediction.sentiment) {
        this.crossAgentInsights.push({
          sourceAgent,
          targetAgent: 'sentiment_analyst',
          insight: `News sentiment ${prediction.sentiment} correlates with market movement`,
          confidence: accuracy,
          marketCondition: marketRegime,
          impact: 0.12
        });
      }

      // Risk Assessor → Trading Agent
      if (sourceAgent === 'risk_assessor' && prediction.riskLevel) {
        this.crossAgentInsights.push({
          sourceAgent,
          targetAgent: 'trading_agent',
          insight: `Risk level ${prediction.riskLevel} suggests position sizing adjustment`,
          confidence: accuracy,
          marketCondition: marketRegime,
          impact: 0.20
        });
      }

      // Keep only recent insights (last 100)
      this.crossAgentInsights = this.crossAgentInsights.slice(-100);

    } catch (error) {
      logger.error(`Failed to generate cross-agent insights`, { error });
    }
  }

  async getAgentConfidenceWeight(agentType: string): Promise<number> {
    return this.confidenceWeights.get(agentType) || 0.5;
  }

  async getAgentMetrics(agentType: string): Promise<AgentPerformanceMetrics | null> {
    try {
      const metrics = await storage.getAgentPerformanceMetrics(agentType);
      return metrics || null;
    } catch (error) {
      logger.error(`Failed to get agent metrics`, { agentType, error });
      return null;
    }
  }

  private async getRecentAgentMetrics(agentType: string, marketRegime: string): Promise<AgentPerformanceMetrics | null> {
    try {
      return await storage.getRecentAgentMetrics(agentType, marketRegime);
    } catch (error) {
      logger.error(`Failed to get recent agent metrics`, { agentType, marketRegime, error });
      return null;
    }
  }

  private async storePerformanceMetrics(metrics: AgentPerformanceMetrics): Promise<void> {
    try {
      await storage.storeAgentPerformanceMetrics(metrics);
      
      // Update in-memory history
      const history = this.performanceHistory.get(metrics.agentType) || [];
      history.push(metrics);
      
      // Keep only last 50 entries per agent
      if (history.length > 50) {
        history.shift();
      }
      
      this.performanceHistory.set(metrics.agentType, history);
    } catch (error) {
      logger.error(`Failed to store performance metrics`, { metrics, error });
    }
  }

  getCrossAgentInsights(): CrossAgentInsight[] {
    return [...this.crossAgentInsights];
  }

  getConfidenceWeights(): Record<string, number> {
    return Array.from(this.confidenceWeights.entries()).reduce((obj, [key, value]) => {
      obj[key] = value;
      return obj;
    }, {} as Record<string, number>);
  }
}

export const adaptiveLearningEngine = new AdaptiveLearningEngine();