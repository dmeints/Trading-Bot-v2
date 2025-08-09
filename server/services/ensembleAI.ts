import OpenAI from "openai";
import { storage } from "../storage";
import type { InsertSentimentData, InsertMarketRegime, InsertEventAnalysis } from "@shared/schema";

const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || process.env.API_KEY || "default_key" 
});

export interface EnsembleResponse {
  action: 'buy' | 'sell' | 'hold';
  confidence: number;
  reasoning: string;
  riskLevel: 'low' | 'medium' | 'high';
  targetPrice?: number;
  stopLoss?: number;
  timeframe: string;
  contributors: AgentContribution[];
}

export interface AgentContribution {
  agentType: string;
  weight: number;
  confidence: number;
  recommendation: 'buy' | 'sell' | 'hold';
  data?: any;
}

export class EnsembleAIOrchestrator {
  private agents: Map<string, EnhancedAIAgent> = new Map();
  private modelPerformance: Map<string, number> = new Map();

  constructor() {
    // Initialize enhanced AI agents
    this.agents.set('market_analyst', new MarketAnalystAgent());
    this.agents.set('sentiment_analyst', new SentimentAnalystAgent());
    this.agents.set('news_analyst', new NewsAnalystAgent());
    this.agents.set('risk_assessor', new RiskAssessorAgent());
    this.agents.set('pattern_recognition', new PatternRecognitionAgent());
    this.agents.set('volatility_predictor', new VolatilityPredictorAgent());
    this.agents.set('correlation_analyzer', new CorrelationAnalyzer());
    this.agents.set('regime_detector', new MarketRegimeDetector());
    
    // Initialize performance tracking
    this.initializePerformanceTracking();
  }

  async generateEnsembleRecommendation(symbol: string, marketData: any): Promise<EnsembleResponse> {
    const agentResponses = await this.runAllAgents(symbol, marketData);
    
    // Calculate weighted ensemble decision
    const ensemble = await this.calculateEnsembleDecision(agentResponses);
    
    // Update model performance based on feedback
    await this.updatePerformanceMetrics(agentResponses, ensemble);
    
    return ensemble;
  }

  private async runAllAgents(symbol: string, marketData: any): Promise<AgentContribution[]> {
    const promises = Array.from(this.agents.entries()).map(async ([agentType, agent]) => {
      try {
        const response = await agent.analyze(symbol, marketData);
        return {
          agentType,
          weight: this.modelPerformance.get(agentType) || 0.5,
          confidence: response.confidence,
          recommendation: response.recommendation as 'buy' | 'sell' | 'hold',
          data: response.data
        };
      } catch (error) {
        console.error(`Error in ${agentType}:`, error);
        return {
          agentType,
          weight: 0,
          confidence: 0,
          recommendation: 'hold' as const,
          data: null
        };
      }
    });

    return await Promise.all(promises);
  }

  private async calculateEnsembleDecision(contributions: AgentContribution[]): Promise<EnsembleResponse> {
    let buyScore = 0;
    let sellScore = 0;
    let holdScore = 0;
    let totalWeight = 0;
    let averageConfidence = 0;
    let riskScore = 0;

    contributions.forEach(contribution => {
      const weight = contribution.weight * contribution.confidence;
      totalWeight += weight;
      averageConfidence += contribution.confidence;

      switch (contribution.recommendation) {
        case 'buy':
          buyScore += weight;
          break;
        case 'sell':
          sellScore += weight;
          break;
        default:
          holdScore += weight;
      }
    });

    averageConfidence = averageConfidence / contributions.length;
    
    // Determine action based on weighted scores
    let action: 'buy' | 'sell' | 'hold' = 'hold';
    if (buyScore > sellScore && buyScore > holdScore) {
      action = 'buy';
    } else if (sellScore > buyScore && sellScore > holdScore) {
      action = 'sell';
    }

    // Calculate overall confidence
    const maxScore = Math.max(buyScore, sellScore, holdScore);
    const confidence = totalWeight > 0 ? (maxScore / totalWeight) * averageConfidence : 0;

    // Assess risk level
    const riskLevel = this.assessRiskLevel(contributions, confidence);

    return {
      action,
      confidence,
      reasoning: this.generateReasoning(contributions, action),
      riskLevel,
      timeframe: '24h',
      contributors: contributions
    };
  }

  private assessRiskLevel(contributions: AgentContribution[], confidence: number): 'low' | 'medium' | 'high' {
    const volatilityAgent = contributions.find(c => c.agentType === 'volatility_predictor');
    const riskAgent = contributions.find(c => c.agentType === 'risk_assessor');
    
    let riskScore = 0;
    if (volatilityAgent && volatilityAgent.data?.volatility) {
      riskScore += volatilityAgent.data.volatility;
    }
    if (riskAgent && riskAgent.data?.riskScore) {
      riskScore += riskAgent.data.riskScore;
    }
    
    // Factor in confidence - lower confidence = higher risk
    riskScore += (1 - confidence) * 0.5;
    
    if (riskScore < 0.3) return 'low';
    if (riskScore < 0.7) return 'medium';
    return 'high';
  }

  private generateReasoning(contributions: AgentContribution[], action: string): string {
    const topContributors = contributions
      .filter(c => c.confidence > 0.6)
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 3);

    const reasons = topContributors.map(c => 
      `${c.agentType}: ${c.recommendation} (confidence: ${(c.confidence * 100).toFixed(1)}%)`
    );

    return `Ensemble decision to ${action} based on: ${reasons.join(', ')}`;
  }

  private async updatePerformanceMetrics(contributions: AgentContribution[], ensemble: EnsembleResponse): Promise<void> {
    // This would be called later with actual trade outcomes to update model performance
    // For now, we maintain baseline performance scores
    contributions.forEach(contribution => {
      const currentPerf = this.modelPerformance.get(contribution.agentType) || 0.5;
      // Gradually adjust performance based on confidence and agreement with ensemble
      const agreement = contribution.recommendation === ensemble.action ? 1 : 0;
      const newPerf = currentPerf * 0.95 + (agreement * contribution.confidence) * 0.05;
      this.modelPerformance.set(contribution.agentType, Math.max(0.1, Math.min(1.0, newPerf)));
    });
  }

  private initializePerformanceTracking(): void {
    // Initialize all agents with baseline performance
    const agents = ['market_analyst', 'sentiment_analyst', 'news_analyst', 'risk_assessor', 
                   'pattern_recognition', 'volatility_predictor', 'correlation_analyzer', 'regime_detector'];
    agents.forEach(agent => {
      this.modelPerformance.set(agent, 0.5); // Start with neutral performance
    });
  }

  async trainOnOutcome(symbol: string, action: string, outcome: 'success' | 'failure', actualReturn: number): Promise<void> {
    // Update model performance based on actual trading outcomes
    const recentContributions = await this.getRecentContributions(symbol);
    
    recentContributions.forEach(contribution => {
      const currentPerf = this.modelPerformance.get(contribution.agentType) || 0.5;
      const performance = outcome === 'success' ? Math.min(actualReturn, 1) : -Math.abs(actualReturn);
      const newPerf = currentPerf * 0.9 + performance * 0.1;
      this.modelPerformance.set(contribution.agentType, Math.max(0.1, Math.min(1.0, newPerf)));
    });
  }

  private async getRecentContributions(symbol: string): Promise<AgentContribution[]> {
    try {
      const activities = await storage.getAgentActivities('ensemble_orchestrator');
      return activities
        .filter(activity => activity.data?.symbol === symbol)
        .slice(-10) // Last 10 contributions
        .map(activity => ({
          agentType: activity.data?.agentType || 'unknown',
          weight: activity.confidence,
          confidence: activity.confidence,
          recommendation: activity.data?.recommendation || 'hold',
          data: activity.data
        }));
    } catch (error) {
      console.error('[EnsembleAI] Error fetching recent contributions:', error);
      return [];
    }
  }

  getModelPerformance(): Record<string, number> {
    return Object.fromEntries(this.modelPerformance);
  }

  private async getRecentSentimentData(symbol: string, limit: number = 10) {
    try {
      const activities = await storage.getAgentActivities('sentiment_analyst');
      return activities
        .filter(activity => activity.data?.symbol === symbol)
        .slice(-limit)
        .map(activity => ({
          timestamp: activity.timestamp,
          symbol: activity.data?.symbol || symbol,
          score: activity.confidence || 0.5,
          source: activity.data?.source || 'sentiment_analyst',
          volume: activity.data?.volume || 0
        }));
    } catch (error) {
      console.error('[EnsembleAI] Error fetching sentiment data:', error);
      return [];
    }
  }
}

// Base class for enhanced AI agents
abstract class EnhancedAIAgent {
  abstract analyze(symbol: string, data: any): Promise<{
    recommendation: 'buy' | 'sell' | 'hold';
    confidence: number;
    data: any;
  }>;
}

class MarketAnalystAgent extends EnhancedAIAgent {
  async analyze(symbol: string, marketData: any) {
    try {
      const prompt = `Analyze ${symbol} market data: ${JSON.stringify(marketData)}
      
      Focus on:
      - Price trends and momentum
      - Volume patterns
      - Support/resistance levels
      - Technical indicators
      
      Provide: recommendation (buy/sell/hold), confidence (0-1), key insights`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
      });

      const analysis = response.choices[0]?.message?.content || '';
      const recommendation = this.extractRecommendation(analysis);
      const confidence = this.extractConfidence(analysis);

      return {
        recommendation,
        confidence,
        data: { analysis, technicalIndicators: marketData }
      };
    } catch (error) {
      return { recommendation: 'hold' as const, confidence: 0, data: null };
    }
  }

  private extractRecommendation(text: string): 'buy' | 'sell' | 'hold' {
    const lower = text.toLowerCase();
    if (lower.includes('buy') && !lower.includes('don\'t buy')) return 'buy';
    if (lower.includes('sell') && !lower.includes('don\'t sell')) return 'sell';
    return 'hold';
  }

  private extractConfidence(text: string): number {
    const match = text.match(/confidence[:\s]+(\d+(?:\.\d+)?)/i);
    if (match) return Math.min(parseFloat(match[1]), 1);
    
    // Fallback: estimate confidence from language
    const lower = text.toLowerCase();
    if (lower.includes('strong') || lower.includes('very likely')) return 0.8;
    if (lower.includes('likely') || lower.includes('probable')) return 0.7;
    if (lower.includes('possible') || lower.includes('might')) return 0.5;
    if (lower.includes('unlikely') || lower.includes('weak')) return 0.3;
    return 0.6; // default
  }
}

class SentimentAnalystAgent extends EnhancedAIAgent {
  async analyze(symbol: string, marketData: any) {
    try {
      // Fetch recent sentiment data from storage
      const sentimentData = await this.getRecentSentimentData(symbol, 10);
      
      const prompt = `Analyze sentiment for ${symbol}:
      Market Data: ${JSON.stringify(marketData)}
      Recent Sentiment: ${JSON.stringify(sentimentData)}
      
      Consider:
      - Social media sentiment trends
      - News sentiment impact
      - Fear & Greed index
      - Community discussions
      
      Provide recommendation and confidence based on sentiment analysis.`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
      });

      const analysis = response.choices[0]?.message?.content || '';
      
      return {
        recommendation: this.extractRecommendation(analysis),
        confidence: this.extractConfidence(analysis),
        data: { sentimentAnalysis: analysis, sentimentData }
      };
    } catch (error) {
      return { recommendation: 'hold' as const, confidence: 0, data: null };
    }
  }

  private extractRecommendation(text: string): 'buy' | 'sell' | 'hold' {
    const lower = text.toLowerCase();
    if (lower.includes('positive sentiment') || lower.includes('bullish sentiment')) return 'buy';
    if (lower.includes('negative sentiment') || lower.includes('bearish sentiment')) return 'sell';
    return 'hold';
  }

  private extractConfidence(text: string): number {
    const match = text.match(/confidence[:\s]+(\d+(?:\.\d+)?)/i);
    return match ? Math.min(parseFloat(match[1]), 1) : 0.6;
  }
}

class NewsAnalystAgent extends EnhancedAIAgent {
  async analyze(symbol: string, marketData: any) {
    try {
      const prompt = `Analyze news impact for ${symbol}:
      
      Consider:
      - Recent regulatory announcements
      - Partnership news
      - Technical developments
      - Market adoption news
      
      Assess potential price impact and provide trading recommendation.`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
      });

      const analysis = response.choices[0]?.message?.content || '';
      
      return {
        recommendation: this.extractRecommendation(analysis),
        confidence: this.extractConfidence(analysis),
        data: { newsAnalysis: analysis }
      };
    } catch (error) {
      return { recommendation: 'hold' as const, confidence: 0, data: null };
    }
  }

  private extractRecommendation(text: string): 'buy' | 'sell' | 'hold' {
    const lower = text.toLowerCase();
    if (lower.includes('positive news') || lower.includes('bullish development')) return 'buy';
    if (lower.includes('negative news') || lower.includes('bearish development')) return 'sell';
    return 'hold';
  }

  private extractConfidence(text: string): number {
    const match = text.match(/confidence[:\s]+(\d+(?:\.\d+)?)/i);
    return match ? Math.min(parseFloat(match[1]), 1) : 0.5;
  }
}

class RiskAssessorAgent extends EnhancedAIAgent {
  async analyze(symbol: string, marketData: any) {
    try {
      const prompt = `Risk assessment for ${symbol}:
      Market Data: ${JSON.stringify(marketData)}
      
      Analyze:
      - Market volatility
      - Liquidity conditions
      - Correlation risks
      - Portfolio concentration
      
      Provide risk-adjusted recommendation.`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
      });

      const analysis = response.choices[0]?.message?.content || '';
      const riskScore = this.extractRiskScore(analysis);
      
      return {
        recommendation: riskScore > 0.7 ? 'sell' : riskScore < 0.3 ? 'buy' : 'hold',
        confidence: this.extractConfidence(analysis),
        data: { riskAnalysis: analysis, riskScore }
      };
    } catch (error) {
      return { recommendation: 'hold' as const, confidence: 0, data: null };
    }
  }

  private extractRiskScore(text: string): number {
    const match = text.match(/risk[:\s]+(\d+(?:\.\d+)?)/i);
    return match ? Math.min(parseFloat(match[1]), 1) : 0.5;
  }

  private extractConfidence(text: string): number {
    const match = text.match(/confidence[:\s]+(\d+(?:\.\d+)?)/i);
    return match ? Math.min(parseFloat(match[1]), 1) : 0.6;
  }
}

class PatternRecognitionAgent extends EnhancedAIAgent {
  async analyze(symbol: string, marketData: any) {
    // Implement pattern recognition logic
    const patterns = this.detectPatterns(marketData);
    
    return {
      recommendation: patterns.bullish > patterns.bearish ? 'buy' : patterns.bearish > patterns.bullish ? 'sell' : 'hold',
      confidence: Math.max(patterns.bullish, patterns.bearish, 0.3),
      data: { patterns }
    };
  }

  private detectPatterns(marketData: any): { bullish: number; bearish: number } {
    // Simple pattern detection - in reality this would be much more sophisticated
    const price = parseFloat(marketData.price || 0);
    const change = parseFloat(marketData.change24h || 0);
    
    let bullish = 0;
    let bearish = 0;
    
    if (change > 5) bullish += 0.3;
    if (change < -5) bearish += 0.3;
    if (change > 0 && change < 2) bullish += 0.1;
    if (change < 0 && change > -2) bearish += 0.1;
    
    return { bullish, bearish };
  }
}

class VolatilityPredictorAgent extends EnhancedAIAgent {
  async analyze(symbol: string, marketData: any) {
    const volatility = this.calculateVolatility(marketData);
    
    return {
      recommendation: volatility > 0.8 ? 'sell' : volatility < 0.3 ? 'buy' : 'hold',
      confidence: 0.7,
      data: { volatility, prediction: 'Based on historical volatility patterns' }
    };
  }

  private calculateVolatility(marketData: any): number {
    // Simple volatility calculation - in reality this would use historical price data
    const change = Math.abs(parseFloat(marketData.change24h || 0));
    return Math.min(change / 20, 1); // Normalize to 0-1 scale
  }
}

class CorrelationAnalyzer extends EnhancedAIAgent {
  async analyze(symbol: string, marketData: any) {
    const correlations = await this.analyzeCorrelations(symbol);
    
    return {
      recommendation: 'hold', // Correlation analysis typically informs risk, not direct trading
      confidence: 0.6,
      data: { correlations, analysis: 'Cross-asset correlation analysis' }
    };
  }

  private async analyzeCorrelations(symbol: string): Promise<any> {
    // Placeholder until storage method is implemented
    return { message: 'No correlation data available' };
  }
}

class MarketRegimeDetector extends EnhancedAIAgent {
  async analyze(symbol: string, marketData: any) {
    const regime = await this.detectMarketRegime(symbol, marketData);
    
    return {
      recommendation: regime === 'bull' ? 'buy' : regime === 'bear' ? 'sell' : 'hold',
      confidence: 0.7,
      data: { regime, analysis: 'Market regime classification' }
    };
  }

  private async detectMarketRegime(symbol: string, marketData: any): Promise<string> {
    const change = parseFloat(marketData.change24h || 0);
    
    if (change > 10) return 'bull';
    if (change < -10) return 'bear';
    if (Math.abs(change) > 5) return 'volatile';
    return 'sideways';
  }
}

export const ensembleOrchestrator = new EnsembleAIOrchestrator();