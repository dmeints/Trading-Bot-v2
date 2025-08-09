/**
 * Decision Engine - Combines personality responses with trading analysis
 */

import { PersonalityResponse } from '../interfaces/ISteviePersonality';
import { MarketAnalysis, TradingSuggestion } from '../interfaces/IStevieAlgorithm';
import { logger } from '../../utils/logger';

export interface DecisionEngineConfig {
  personality: any;
  algorithmConfig: any;
}

export interface SynthesisInput {
  personalityResponse: PersonalityResponse;
  marketAnalysis?: MarketAnalysis;
  tradingSuggestion?: TradingSuggestion;
  userMessage: string;
  context?: any;
}

export interface StevieResponse {
  message: string;
  tradingSuggestion?: TradingSuggestion;
  marketAnalysis?: MarketAnalysis;
  confidence: number;
  reasoning: string;
  personality: {
    tone: string;
    style: string;
  };
}

export class DecisionEngine {
  private config: DecisionEngineConfig;
  
  constructor(config: DecisionEngineConfig) {
    this.config = config;
  }
  
  async synthesizeResponse(input: SynthesisInput): Promise<StevieResponse> {
    try {
      logger.info('[DecisionEngine] Synthesizing response', { 
        hasPersonality: !!input.personalityResponse,
        hasMarketAnalysis: !!input.marketAnalysis,
        hasTradingSuggestion: !!input.tradingSuggestion
      });
      
      // Start with personality response as base
      let finalMessage = input.personalityResponse.message;
      let finalConfidence = input.personalityResponse.confidence;
      let reasoning = input.personalityResponse.reasoning || 'Personality-based response';
      
      // Enhance with market analysis if available
      if (input.marketAnalysis) {
        const marketInsight = this.generateMarketInsight(input.marketAnalysis);
        finalMessage = this.combineWithMarketAnalysis(finalMessage, marketInsight);
        finalConfidence = this.adjustConfidenceWithMarketData(finalConfidence, input.marketAnalysis);
        reasoning += ' + Market analysis integration';
      }
      
      // Add trading suggestion if available and appropriate
      if (input.tradingSuggestion && this.shouldIncludeTradingSuggestion(input)) {
        const tradingInsight = this.generateTradingInsight(input.tradingSuggestion);
        finalMessage = this.combineWithTradingSuggestion(finalMessage, tradingInsight);
        finalConfidence = this.adjustConfidenceWithTradingData(finalConfidence, input.tradingSuggestion);
        reasoning += ' + Trading suggestion integration';
      }
      
      // Ensure response maintains Stevie's personality
      finalMessage = this.applyPersonalityFilter(finalMessage, input.personalityResponse.tone);
      
      return {
        message: finalMessage,
        tradingSuggestion: input.tradingSuggestion,
        marketAnalysis: input.marketAnalysis,
        confidence: Math.min(0.95, finalConfidence),
        reasoning,
        personality: {
          tone: input.personalityResponse.tone,
          style: this.getPersonalityStyle(input.personalityResponse.tone)
        }
      };
      
    } catch (error) {
      logger.error('[DecisionEngine] Error synthesizing response', { error });
      return this.getFallbackResponse(input);
    }
  }
  
  private generateMarketInsight(analysis: MarketAnalysis): string {
    const trendDescription = this.describeTrend(analysis.trend, analysis.strength);
    const sentimentDescription = this.describeSentiment(analysis.sentiment);
    
    return `Current market shows ${trendDescription} with ${sentimentDescription}. ` +
           `Key levels: Support at ${analysis.keyLevels.support[0]}, Resistance at ${analysis.keyLevels.resistance[0]}.`;
  }
  
  private generateTradingInsight(suggestion: TradingSuggestion): string {
    const actionText = this.formatAction(suggestion.action, suggestion.confidence);
    const riskText = this.formatRiskLevel(suggestion.riskLevel);
    
    let insight = `${actionText} ${suggestion.reasoning}`;
    
    if (suggestion.positionSize) {
      insight += ` Consider position size of ${(suggestion.positionSize * 100).toFixed(1)}% of portfolio.`;
    }
    
    insight += ` ${riskText}`;
    
    return insight;
  }
  
  private combineWithMarketAnalysis(personalityMessage: string, marketInsight: string): string {
    // Intelligently combine personality response with market analysis
    if (personalityMessage.endsWith('?')) {
      return `${personalityMessage.slice(0, -1)}. ${marketInsight}`;
    }
    
    return `${personalityMessage}\n\n${marketInsight}`;
  }
  
  private combineWithTradingSuggestion(currentMessage: string, tradingInsight: string): string {
    return `${currentMessage}\n\n**Trading Insight**: ${tradingInsight}`;
  }
  
  private shouldIncludeTradingSuggestion(input: SynthesisInput): boolean {
    // Only include trading suggestions if:
    // 1. User is asking for trading advice
    // 2. Confidence is high enough
    // 3. Market analysis supports the suggestion
    
    const messageIndicatesTrading = ['buy', 'sell', 'trade', 'should i', 'recommend'].some(
      keyword => input.userMessage.toLowerCase().includes(keyword)
    );
    
    const highConfidence = input.tradingSuggestion!.confidence > 0.6;
    const marketSupports = !input.marketAnalysis || 
                          input.marketAnalysis.confidence > 0.5;
    
    return messageIndicatesTrading && highConfidence && marketSupports;
  }
  
  private adjustConfidenceWithMarketData(baseConfidence: number, analysis: MarketAnalysis): number {
    // Adjust confidence based on market data quality and clarity
    let adjustment = 0;
    
    if (analysis.confidence > 0.8) adjustment += 0.1;
    if (analysis.confidence < 0.4) adjustment -= 0.1;
    
    if (analysis.technicalSignals.length > 3) adjustment += 0.05;
    
    return Math.max(0.1, Math.min(0.95, baseConfidence + adjustment));
  }
  
  private adjustConfidenceWithTradingData(baseConfidence: number, suggestion: TradingSuggestion): number {
    // Adjust confidence based on trading suggestion quality
    let adjustment = 0;
    
    if (suggestion.confidence > 0.8) adjustment += 0.1;
    if (suggestion.confidence < 0.5) adjustment -= 0.1;
    
    if (suggestion.riskLevel === 'low') adjustment += 0.05;
    if (suggestion.riskLevel === 'high') adjustment -= 0.05;
    
    return Math.max(0.1, Math.min(0.95, baseConfidence + adjustment));
  }
  
  private applyPersonalityFilter(message: string, tone: string): string {
    // Ensure the final message maintains the intended personality tone
    const personalityPrefixes = {
      encouraging: "Here's what I think: ",
      analytical: "Based on my analysis: ",
      cautious: "Important to consider: ",
      excited: "This is interesting! ",
      neutral: ""
    };
    
    const prefix = personalityPrefixes[tone as keyof typeof personalityPrefixes] || "";
    
    if (prefix && !message.startsWith(prefix)) {
      return `${prefix}${message}`;
    }
    
    return message;
  }
  
  private describeTrend(trend: string, strength: number): string {
    const strengthDescriptor = strength > 0.7 ? 'strong' : strength > 0.4 ? 'moderate' : 'weak';
    return `${strengthDescriptor} ${trend} momentum`;
  }
  
  private describeSentiment(sentiment: any): string {
    const overall = (sentiment.social + sentiment.news + sentiment.onchain) / 3;
    
    if (overall > 0.2) return 'positive sentiment';
    if (overall < -0.2) return 'negative sentiment';
    return 'neutral sentiment';
  }
  
  private formatAction(action: string, confidence: number): string {
    const confidenceDescriptor = confidence > 0.8 ? 'strongly suggest' : 
                                confidence > 0.6 ? 'suggest' : 
                                'might consider';
    
    return `I ${confidenceDescriptor} you ${action}`;
  }
  
  private formatRiskLevel(riskLevel: string): string {
    const riskDescriptions = {
      low: 'This appears to be a relatively low-risk opportunity.',
      medium: 'Consider this a moderate-risk trade - size your position accordingly.',
      high: 'This is a higher-risk trade - only use money you can afford to lose.'
    };
    
    return riskDescriptions[riskLevel as keyof typeof riskDescriptions] || 
           'Please manage your risk appropriately.';
  }
  
  private getPersonalityStyle(tone: string): string {
    const styles = {
      encouraging: 'supportive',
      analytical: 'data-driven',
      cautious: 'risk-aware',
      excited: 'enthusiastic',
      neutral: 'balanced'
    };
    
    return styles[tone as keyof typeof styles] || 'balanced';
  }
  
  private getFallbackResponse(input: SynthesisInput): StevieResponse {
    return {
      message: input.personalityResponse.message || "I'm here to help, but I'm having some technical difficulties right now.",
      confidence: 0.3,
      reasoning: 'Fallback response due to synthesis error',
      personality: {
        tone: 'neutral',
        style: 'brief'
      }
    };
  }
}