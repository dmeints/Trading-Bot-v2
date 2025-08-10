import OpenAI from "openai";
import { storage } from "../storage";
import { MarketInsightAgent } from "./marketInsightAgent";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || process.env.API_KEY || "default_key" 
});

export interface AgentResponse {
  agentType: string;
  confidence: number;
  data: any;
  activity: string;
}

export class AIAgentOrchestrator {
  private agents: Map<string, AIAgent> = new Map();

  constructor() {
    // Consolidated to unified Market Insight Agent + Risk Assessor
    this.agents.set('market_insight', new MarketInsightAgent());
    this.agents.set('risk_assessor', new RiskAssessorAgent());
  }

  async runAgent(agentType: string, data: any): Promise<AgentResponse> {
    const agent = this.agents.get(agentType);
    if (!agent) {
      throw new Error(`Unknown agent type: ${agentType}`);
    }

    const response = await agent.process(data);
    
    // Log agent activity
    await storage.logAgentActivity({
      agentType,
      activity: response.activity,
      confidence: response.confidence,
      data: response.data,
    });

    return response;
  }

  async runAllAgents(marketData: any): Promise<AgentResponse[]> {
    const promises = Array.from(this.agents.keys()).map(agentType => 
      this.runAgent(agentType, marketData)
    );
    return await Promise.all(promises);
  }

  getAgentStatus(): Array<{ type: string; status: string; lastActivity: string }> {
    return Array.from(this.agents.keys()).map(type => ({
      type,
      status: 'active',
      lastActivity: 'Processing data...',
    }));
  }
}

abstract class AIAgent {
  abstract process(data: any): Promise<AgentResponse>;
}

class MarketAnalystAgent extends AIAgent {
  async process(marketData: any): Promise<AgentResponse> {
    try {
      // Get REAL comprehensive market data from our data sources
      const { dataIngestionService } = await import('./dataIngestion');
      const { sentimentAnalyzer } = await import('./sentimentAnalyzer');
      
      const symbol = marketData?.symbol || 'BTC';
      
      // Fetch real data from CoinGecko/Binance
      const ohlcvData = await dataIngestionService.getLatestOHLCV?.(symbol, 24) || [];
      
      // Get real sentiment from Twitter/Reddit/News
      const sentimentData = await sentimentAnalyzer.getAggregatedSentiment(symbol);
      
      // Get on-chain metrics from Etherscan/Blockchair  
      const onChainCollector = dataIngestionService.collectors?.get('onchain');
      const onChainData = await onChainCollector?.collectCurrentMetrics?.([symbol]);

      const prompt = `Analyze the following REAL cryptocurrency market data:

OHLCV Data (Last 24 hours): ${JSON.stringify(ohlcvData.slice(-5))}
Current Price: ${ohlcvData[ohlcvData.length - 1]?.close || 'N/A'}

Real Sentiment Analysis:
- Overall Sentiment: ${sentimentData.overallSentiment.toFixed(3)} (${sentimentData.overallSentiment > 0 ? 'Bullish' : 'Bearish'})
- Confidence: ${sentimentData.confidence.toFixed(3)}
- Sources: ${sentimentData.breakdown.map(b => `${b.source}: ${b.sentiment.toFixed(2)}`).join(', ')}

On-Chain Data: ${JSON.stringify(onChainData)}

Provide technical analysis with:
- Price trends based on REAL data
- Volume analysis from actual exchange data
- Support/resistance levels from price action
- Market sentiment integration from social data
      
      Respond in JSON format with: {
        "trend": "bullish|bearish|sideways",
        "confidence": 0.0-1.0,
        "key_levels": {"support": number, "resistance": number},
        "momentum": "strong|moderate|weak",
        "analysis": "detailed explanation including sentiment and on-chain factors"
      }`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are an expert cryptocurrency analyst with access to REAL market data from CoinGecko, Binance, Twitter, Reddit, and on-chain sources. Provide analysis based on actual data, not hypotheticals."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" },
      });

      const analysis = JSON.parse(response.choices[0].message.content || '{}');

      return {
        agentType: 'market_analyst',
        confidence: analysis.confidence || 0.5,
        data: analysis,
        activity: `Analyzing market trends - ${analysis.trend || 'unknown'} trend detected`,
      };
    } catch (error) {
      console.error('Market Analyst error:', error);
      return {
        agentType: 'market_analyst',
        confidence: 0.1,
        data: { error: 'Analysis failed' },
        activity: 'Error in market analysis',
      };
    }
  }
}

class NewsAnalystAgent extends AIAgent {
  async process(data: any): Promise<AgentResponse> {
    try {
      // Simulate news analysis - in production, this would fetch real news
      const sentiment = Math.random() > 0.5 ? 'bullish' : 'bearish';
      const confidence = 0.7 + Math.random() * 0.3;

      return {
        agentType: 'news_analyst',
        confidence,
        data: {
          sentiment,
          articles_processed: Math.floor(200 + Math.random() * 100),
          key_topics: ['regulation', 'adoption', 'technical_developments'],
        },
        activity: `Processing sentiment from ${Math.floor(200 + Math.random() * 100)} articles`,
      };
    } catch (error) {
      console.error('News Analyst error:', error);
      return {
        agentType: 'news_analyst',
        confidence: 0.1,
        data: { error: 'News analysis failed' },
        activity: 'Error in news analysis',
      };
    }
  }
}

class TradingAgent extends AIAgent {
  async process(data: any): Promise<AgentResponse> {
    try {
      const marketData = data.marketData || {};
      const userPreferences = data.userPreferences || { riskTolerance: 'medium' };

      const prompt = `Based on the market analysis and user preferences, generate trading recommendations:
      Market Data: ${JSON.stringify(marketData)}
      User Risk Tolerance: ${userPreferences.riskTolerance}
      
      Provide trading signals with entry/exit points and risk management.
      
      Respond in JSON format with: {
        "action": "buy|sell|hold",
        "confidence": 0.0-1.0,
        "entry_price": number,
        "target_price": number,
        "stop_loss": number,
        "position_size": "small|medium|large",
        "reasoning": "explanation"
      }`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are an expert trading agent that generates actionable trading recommendations based on market analysis and risk preferences."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" },
      });

      const recommendation = JSON.parse(response.choices[0].message.content || '{}');

      return {
        agentType: 'trading_agent',
        confidence: recommendation.confidence || 0.5,
        data: recommendation,
        activity: `Scanning opportunities - ${recommendation.action || 'hold'} signal generated`,
      };
    } catch (error) {
      console.error('Trading Agent error:', error);
      return {
        agentType: 'trading_agent',
        confidence: 0.1,
        data: { error: 'Trading analysis failed' },
        activity: 'Error in trading analysis',
      };
    }
  }
}

class RiskAssessorAgent extends AIAgent {
  async process(data: any): Promise<AgentResponse> {
    try {
      const portfolio = data.portfolio || {};
      const positions = data.positions || [];

      const totalExposure = positions.reduce((sum: number, pos: any) => sum + (pos.quantity * pos.currentPrice), 0);
      const riskScore = totalExposure > 50000 ? 'high' : totalExposure > 20000 ? 'medium' : 'low';

      return {
        agentType: 'risk_assessor',
        confidence: 0.9,
        data: {
          risk_score: riskScore,
          total_exposure: totalExposure,
          max_drawdown: Math.random() * 0.1,
          var_95: totalExposure * 0.05,
        },
        activity: `Monitoring exposure - Risk Score: ${riskScore}`,
      };
    } catch (error) {
      console.error('Risk Assessor error:', error);
      return {
        agentType: 'risk_assessor',
        confidence: 0.1,
        data: { error: 'Risk assessment failed' },
        activity: 'Error in risk assessment',
      };
    }
  }
}

class SentimentAnalystAgent extends AIAgent {
  async process(data: any): Promise<AgentResponse> {
    try {
      // Simulate sentiment analysis - in production, this would analyze social media, news, etc.
      const sentiments = ['bullish', 'bearish', 'neutral'];
      const sentiment = sentiments[Math.floor(Math.random() * sentiments.length)];
      const confidence = 0.6 + Math.random() * 0.4;

      return {
        agentType: 'sentiment_analyst',
        confidence,
        data: {
          overall_sentiment: sentiment,
          social_mentions: Math.floor(1000 + Math.random() * 5000),
          fear_greed_index: Math.floor(30 + Math.random() * 40),
        },
        activity: `Reading social signals - Sentiment: ${sentiment}`,
      };
    } catch (error) {
      console.error('Sentiment Analyst error:', error);
      return {
        agentType: 'sentiment_analyst',
        confidence: 0.1,
        data: { error: 'Sentiment analysis failed' },
        activity: 'Error in sentiment analysis',
      };
    }
  }
}

export const aiOrchestrator = new AIAgentOrchestrator();
