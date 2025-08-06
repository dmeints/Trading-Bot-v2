import { OpenAI } from 'openai';
import { storage } from '../storage';
import { InsertAgentActivity } from '@shared/schema';

export class MarketInsightAgent {
  private openai: OpenAI;
  private isProcessing = false;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async analyzeMarket(symbols: string[]): Promise<{
    technicalAnalysis: any;
    sentimentAnalysis: any;
    newsImpact: any;
    recommendations: any[];
  }> {
    if (this.isProcessing) {
      console.log('[MarketInsightAgent] Analysis already in progress');
      return this.getLastAnalysis();
    }

    this.isProcessing = true;

    try {
      // Get recent market data for context
      const marketData = await storage.getLatestMarketData();
      const recentTrades = await storage.getUserTrades('dev-user-123', 20);

      // Unified analysis combining technical, sentiment, and news
      const analysisPrompt = `
        As a professional market analyst, analyze the current cryptocurrency market:
        
        Market Data: ${JSON.stringify(marketData.slice(0, 5))}
        Recent Trading Activity: ${recentTrades.length} trades in portfolio
        
        Provide analysis covering:
        1. Technical Analysis: Price trends, support/resistance levels, momentum indicators
        2. Market Sentiment: Overall market mood, fear/greed indicators, social sentiment
        3. News Impact: Recent events affecting crypto markets, regulatory developments
        4. Trading Recommendations: Specific actionable insights with risk assessment
        
        Format response as JSON with clear, actionable insights.
        Focus on practical trading information rather than speculation.
      `;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are a professional cryptocurrency market analyst providing practical trading insights.'
          },
          {
            role: 'user',
            content: analysisPrompt
          }
        ],
        max_tokens: 1000,
        temperature: 0.3
      });

      const analysis = this.parseAnalysisResponse(response.choices[0].message.content || '');
      
      // Log activity
      await this.logActivity('market_analysis', `Analyzed ${symbols.length} symbols`, 0.85);

      this.isProcessing = false;
      return analysis;

    } catch (error) {
      console.error('[MarketInsightAgent] Analysis failed:', error);
      this.isProcessing = false;
      
      // Return fallback analysis based on market data
      const fallbackData = await storage.getLatestMarketData();
      return this.getFallbackAnalysis(fallbackData);
    }
  }

  private parseAnalysisResponse(content: string): any {
    try {
      // Try to parse JSON response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      console.error('[MarketInsightAgent] Failed to parse JSON response');
    }

    // Fallback: extract structured information from text
    return {
      technicalAnalysis: {
        trend: content.includes('bullish') ? 'bullish' : content.includes('bearish') ? 'bearish' : 'neutral',
        confidence: 0.7,
        summary: content.substring(0, 200) + '...'
      },
      sentimentAnalysis: {
        overall: 'neutral',
        confidence: 0.6,
        factors: ['Market uncertainty', 'Mixed signals']
      },
      newsImpact: {
        impact: 'low',
        summary: 'No major news events detected'
      },
      recommendations: [
        {
          action: 'hold',
          symbol: 'BTC',
          confidence: 0.7,
          reasoning: 'Awaiting clearer market direction'
        }
      ]
    };
  }

  private async getFallbackAnalysis(marketData: any[]): Promise<any> {
    // Simple technical analysis based on price data
    const btcData = marketData.find(d => d.symbol === 'BTC');
    const ethData = marketData.find(d => d.symbol === 'ETH');

    return {
      technicalAnalysis: {
        trend: 'neutral',
        confidence: 0.5,
        summary: `BTC: $${btcData?.price || 'N/A'}, ETH: $${ethData?.price || 'N/A'}`
      },
      sentimentAnalysis: {
        overall: 'neutral',
        confidence: 0.5,
        factors: ['Limited data available']
      },
      newsImpact: {
        impact: 'low',
        summary: 'No significant market-moving events identified'
      },
      recommendations: [
        {
          action: 'monitor',
          symbol: 'BTC',
          confidence: 0.6,
          reasoning: 'Maintain current positions, monitor for trend changes'
        }
      ]
    };
  }

  private async getLastAnalysis(): Promise<any> {
    // Return cached analysis to avoid concurrent processing
    return {
      technicalAnalysis: { trend: 'processing', confidence: 0.0 },
      sentimentAnalysis: { overall: 'processing', confidence: 0.0 },
      newsImpact: { impact: 'unknown', summary: 'Analysis in progress' },
      recommendations: []
    };
  }

  private async logActivity(activityType: string, description: string, confidence: number) {
    const activity: InsertAgentActivity = {
      agentType: 'market_insight',
      activity: description,
      confidence,
      data: {
        type: activityType,
        timestamp: new Date().toISOString()
      }
    };

    try {
      await storage.logAgentActivity(activity);
    } catch (error) {
      console.error('[MarketInsightAgent] Failed to log activity:', error);
    }
  }

  async getStatus(): Promise<{ status: string; lastActivity: string }> {
    try {
      const activities = await storage.getRecentAgentActivities(5);
      const lastActivity = activities.find(a => a.agentType === 'market_insight');
      
      return {
        status: this.isProcessing ? 'processing' : 'active',
        lastActivity: lastActivity?.createdAt?.toString() || new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'error',
        lastActivity: new Date().toISOString()
      };
    }
  }
}