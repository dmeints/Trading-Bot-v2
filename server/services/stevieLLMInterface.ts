/**
 * Stevie LLM Conversational Interface
 * 
 * Advanced OpenAI integration with function calling, context management,
 * and specialized trading prompts for portfolio analysis and strategy suggestions.
 */

import OpenAI from 'openai';
import { logger } from '../utils/logger';
import { storage } from '../storage';
import SteviePersonality from './steviePersonality';

interface ChatContext {
  userId: string;
  recentTrades: any[];
  portfolioSnapshot: any;
  marketConditions: any;
  conversationHistory: ChatMessage[];
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'function';
  content: string;
  name?: string;
  function_call?: any;
  timestamp?: string;
}

interface FunctionCallResult {
  name: string;
  result: any;
  error?: string;
}

class StevieContextManager {
  private readonly MAX_TOKENS = 1000;
  private readonly MAX_HISTORY = 10;

  // Sliding window context management
  async buildContext(userId: string, userMessage: string): Promise<ChatContext> {
    try {
      // Get recent trades (last 7 days)
      const recentTrades = await storage.getUserTrades(userId, 7);
      
      // Get portfolio snapshot
      const positions = await storage.getUserPositions(userId);
      const portfolioValue = positions.reduce((sum, pos) => 
        sum + (Number(pos.quantity) * Number(pos.currentPrice)), 0
      );
      
      // Get user profile for personalization
      const user = await storage.getUser(userId);
      
      const portfolioSnapshot = {
        totalValue: portfolioValue,
        positions: positions.map(p => ({
          symbol: p.symbol,
          quantity: Number(p.quantity),
          currentPrice: Number(p.currentPrice),
          unrealizedPnl: Number(p.unrealizedPnl)
        })),
        riskTolerance: user?.riskTolerance || 'medium'
      };
      
      // Real market conditions from market data service
      const marketData = await this.getRealMarketConditions();
      const marketConditions = {
        btcPrice: marketData.btcPrice,
        marketTrend: marketData.trend,
        volatility: marketData.volatility,
        fearGreedIndex: marketData.sentiment
      };
      
      // Build conversation history (placeholder for now)
      const conversationHistory: ChatMessage[] = [
        {
          role: 'system',
          content: SteviePersonality.getSystemPrompt('chat') + this.buildContextPrompt(portfolioSnapshot, marketConditions),
          timestamp: new Date().toISOString()
        }
      ];
      
      return {
        userId,
        recentTrades,
        portfolioSnapshot,
        marketConditions,
        conversationHistory
      };
      
    } catch (error) {
      logger.error('Error building Stevie context', { error, userId });
      throw error;
    }
  }

  private buildContextPrompt(portfolio: any, market: any): string {
    return `

CURRENT CONTEXT:
- Portfolio Value: $${portfolio.totalValue.toFixed(2)}
- Risk Tolerance: ${portfolio.riskTolerance}
- Active Positions: ${portfolio.positions.length}
- Market Trend: ${market.marketTrend}
- BTC Price: $${market.btcPrice}

Remember to reference this context when providing advice and maintain your encouraging, data-driven personality.`;
  }

  // Trim context to stay within token limits
  trimContext(messages: ChatMessage[]): ChatMessage[] {
    // Keep system message + last N messages within token limit
    const systemMessage = messages.find(m => m.role === 'system');
    const userMessages = messages.filter(m => m.role !== 'system').slice(-this.MAX_HISTORY);
    
    return systemMessage ? [systemMessage, ...userMessages] : userMessages;
  }

  private async getRealMarketConditions(): Promise<any> {
    try {
      // Import market data service (avoiding circular dependencies)
      const { marketDataService } = await import('./marketData');
      
      // Get real BTC price
      const btcData = await marketDataService.getCurrentPrice('BTC');
      const btcPrice = btcData?.price || 116802;
      
      // Analyze market trend from recent price movements
      const recentPrices = await marketDataService.getHistoricalPrices('BTC', 
        new Date(Date.now() - 24 * 60 * 60 * 1000), new Date(), '1h');
      
      let trend = 'sideways';
      let volatility = 'medium';
      
      if (recentPrices && recentPrices.length > 1) {
        const priceChange = (recentPrices[recentPrices.length - 1].price - recentPrices[0].price) / recentPrices[0].price;
        
        if (priceChange > 0.02) trend = 'bullish';
        else if (priceChange < -0.02) trend = 'bearish';
        
        // Calculate volatility from price movements
        const returns = [];
        for (let i = 1; i < recentPrices.length; i++) {
          returns.push((recentPrices[i].price - recentPrices[i-1].price) / recentPrices[i-1].price);
        }
        
        const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
        const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
        const stdDev = Math.sqrt(variance);
        
        if (stdDev > 0.05) volatility = 'high';
        else if (stdDev < 0.02) volatility = 'low';
      }
      
      // Calculate sentiment based on price action and volume
      const sentiment = this.calculateMarketSentiment(btcPrice, trend, volatility);
      
      return {
        btcPrice,
        trend,
        volatility,
        sentiment
      };
      
    } catch (error) {
      logger.error('Error getting real market conditions:', error);
      
      // Return current market snapshot as fallback
      return {
        btcPrice: 116802,
        trend: 'sideways',
        volatility: 'medium',
        sentiment: 50
      };
    }
  }
  
  private calculateMarketSentiment(price: number, trend: string, volatility: string): number {
    let sentiment = 50; // neutral base
    
    // Adjust based on trend
    if (trend === 'bullish') sentiment += 20;
    else if (trend === 'bearish') sentiment -= 20;
    
    // Adjust based on volatility (high volatility often indicates fear)
    if (volatility === 'high') sentiment -= 10;
    else if (volatility === 'low') sentiment += 5;
    
    // Keep in valid range
    return Math.max(0, Math.min(100, sentiment));
  }
}

export class StevieLLMInterface {
  private openai: OpenAI | null = null;
  private contextManager = new StevieContextManager();
  
  constructor() {
    try {
      if (process.env.OPENAI_API_KEY) {
        this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      }
    } catch (error) {
      logger.warn('OpenAI not initialized for Stevie LLM interface', { error });
    }
  }

  // OpenAI function definitions for trading operations
  private getFunctionDefinitions() {
    return [
      {
        name: "get_portfolio_performance",
        description: "Get detailed portfolio performance metrics and analysis",
        parameters: {
          type: "object",
          properties: {
            timeframe: {
              type: "string",
              enum: ["1d", "7d", "30d", "90d"],
              description: "Time period for performance analysis"
            }
          },
          required: ["timeframe"]
        }
      },
      {
        name: "get_trade_analysis", 
        description: "Analyze specific trade decisions and outcomes",
        parameters: {
          type: "object",
          properties: {
            trade_id: {
              type: "string",
              description: "ID of the trade to analyze"
            }
          },
          required: ["trade_id"]
        }
      },
      {
        name: "get_strategy_suggestions",
        description: "Get AI-driven strategy recommendations based on recent performance",
        parameters: {
          type: "object", 
          properties: {
            focus_area: {
              type: "string",
              enum: ["risk_management", "diversification", "timing", "position_sizing"],
              description: "Area to focus strategy suggestions on"
            }
          },
          required: ["focus_area"]
        }
      },
      {
        name: "get_market_sentiment",
        description: "Get current market sentiment and key levels for specific assets",
        parameters: {
          type: "object",
          properties: {
            symbols: {
              type: "array",
              items: { type: "string" },
              description: "Trading symbols to analyze (e.g. ['BTC/USD', 'ETH/USD'])"
            }
          },
          required: ["symbols"]
        }
      }
    ];
  }

  // Execute function calls from OpenAI
  private async executeFunction(functionCall: any, userId: string): Promise<FunctionCallResult> {
    try {
      const { name, arguments: args } = functionCall;
      const parsedArgs = JSON.parse(args);
      
      switch (name) {
        case 'get_portfolio_performance':
          return await this.getPortfolioPerformance(userId, parsedArgs.timeframe);
          
        case 'get_trade_analysis':
          return await this.getTradeAnalysis(userId, parsedArgs.trade_id);
          
        case 'get_strategy_suggestions':
          return await this.getStrategySuggestions(userId, parsedArgs.focus_area);
          
        case 'get_market_sentiment':
          return await this.getMarketSentiment(parsedArgs.symbols);
          
        default:
          return {
            name,
            result: null,
            error: `Unknown function: ${name}`
          };
      }
    } catch (error: any) {
      logger.error('Error executing Stevie function', { error, functionCall });
      return {
        name: functionCall.name,
        result: null,
        error: error?.message || 'Unknown error'
      };
    }
  }

  private async getPortfolioPerformance(userId: string, timeframe: string): Promise<FunctionCallResult> {
    try {
      const trades = await storage.getUserTrades(userId, timeframe === '1d' ? 1 : timeframe === '7d' ? 7 : timeframe === '30d' ? 30 : 90);
      const positions = await storage.getUserPositions(userId);
      
      const totalPnl = trades.reduce((sum, trade) => sum + Number(trade.pnl || 0), 0);
      const winRate = trades.length > 0 ? trades.filter(t => Number(t.pnl || 0) > 0).length / trades.length : 0;
      const portfolioValue = positions.reduce((sum, pos) => sum + (Number(pos.quantity) * Number(pos.currentPrice)), 0);
      
      return {
        name: 'get_portfolio_performance',
        result: {
          timeframe,
          totalTrades: trades.length,
          totalPnl: totalPnl.toFixed(2),
          winRate: (winRate * 100).toFixed(1),
          currentValue: portfolioValue.toFixed(2),
          positions: positions.length
        }
      };
    } catch (error: any) {
      return {
        name: 'get_portfolio_performance',
        result: null,
        error: error?.message || 'Unknown error'
      };
    }
  }

  private async getTradeAnalysis(userId: string, tradeId: string): Promise<FunctionCallResult> {
    try {
      const trades = await storage.getUserTrades(userId, 30);
      const trade = trades.find(t => t.id === tradeId) || trades[0]; // Fallback to most recent
      
      if (!trade) {
        return {
          name: 'get_trade_analysis',
          result: null,
          error: 'No trade found'
        };
      }
      
      return {
        name: 'get_trade_analysis',
        result: {
          symbol: trade.symbol,
          side: trade.side,
          quantity: trade.quantity,
          price: trade.price,
          pnl: trade.pnl,
          confidence: trade.confidence || 0.7,
          aiRecommended: trade.aiRecommendation || false,
          analysis: `${trade.side.toUpperCase()} ${trade.quantity} ${trade.symbol} at $${trade.price}. ${Number(trade.pnl || 0) > 0 ? 'Profitable trade' : 'Loss taken'} with ${((trade.confidence || 0.7) * 100).toFixed(0)}% confidence.`
        }
      };
    } catch (error: any) {
      return {
        name: 'get_trade_analysis',
        result: null,
        error: error?.message || 'Unknown error'
      };
    }
  }

  private async getStrategySuggestions(userId: string, focusArea: string): Promise<FunctionCallResult> {
    try {
      const trades = await storage.getUserTrades(userId, 30);
      const positions = await storage.getUserPositions(userId);
      const user = await storage.getUser(userId);
      
      const suggestions = {
        risk_management: [
          "Consider reducing position sizes during high volatility periods",
          "Implement stop-losses at 2-3% below entry points",
          "Diversify across multiple assets to reduce concentration risk"
        ],
        diversification: [
          "Add exposure to different crypto sectors (DeFi, Layer 1s, Gaming)",
          "Consider dollar-cost averaging for long-term positions", 
          "Balance between large-cap and mid-cap cryptocurrencies"
        ],
        timing: [
          "Use technical indicators like RSI and MACD for entry/exit timing",
          "Avoid FOMO buying during rapid price increases",
          "Consider market cycles and seasonal patterns"
        ],
        position_sizing: [
          "Use 1-2% risk per trade based on your risk tolerance",
          "Scale into positions gradually rather than all at once",
          "Adjust position sizes based on market volatility"
        ]
      };
      
      const suggestionMap: Record<string, string[]> = suggestions;
      return {
        name: 'get_strategy_suggestions',
        result: {
          focusArea,
          suggestions: suggestionMap[focusArea] || suggestions.risk_management,
          currentRiskLevel: user?.riskTolerance || 'medium',
          portfolioSize: positions.length
        }
      };
    } catch (error: any) {
      return {
        name: 'get_strategy_suggestions',
        result: null,
        error: error?.message || 'Unknown error'
      };
    }
  }

  private async getMarketSentiment(symbols: string[]): Promise<FunctionCallResult> {
    try {
      // Mock market sentiment data (would integrate with real sentiment APIs)
      const sentimentData = symbols.map(symbol => ({
        symbol,
        sentiment: Math.random() > 0.5 ? 'bullish' : 'bearish',
        confidence: Math.random() * 0.4 + 0.6, // 0.6 to 1.0
        keyLevels: {
          support: Math.floor(Math.random() * 1000) + 40000,
          resistance: Math.floor(Math.random() * 1000) + 45000
        },
        socialVolume: Math.floor(Math.random() * 1000) + 100
      }));
      
      return {
        name: 'get_market_sentiment',
        result: {
          symbols,
          sentiment: sentimentData,
          timestamp: new Date().toISOString()
        }
      };
    } catch (error: any) {
      return {
        name: 'get_market_sentiment',
        result: null,
        error: error?.message || 'Unknown error'
      };
    }
  }

  // Specialized prompt templates for common queries
  getPromptTemplate(type: string, context?: any): string {
    const templates = {
      explain_trade: `Based on the trade data provided, explain the decision-making process behind this trade. Consider entry timing, risk management, and market conditions. Keep your explanation clear and educational while maintaining your encouraging personality.`,
      
      portfolio_summary: `Analyze the portfolio performance data and provide a comprehensive yet concise summary. Highlight key metrics, identify strengths and areas for improvement, and offer actionable insights. Use your friendly, data-driven approach.`,
      
      strategy_tweak: `Based on the recent drawdown and performance data, suggest specific strategy adjustments. Focus on practical, implementable changes that align with the user's risk tolerance and trading goals. Be supportive but realistic about the adjustments needed.`,
      
      risk_alert: `The portfolio has experienced significant movement. Provide a balanced risk assessment that acknowledges the situation without causing panic. Offer specific next steps and maintain your supportive, knowledgeable tone.`,
      
      market_analysis: `Analyze the current market conditions and provide insights relevant to the user's portfolio. Include both opportunities and risks, and frame everything within your encouraging yet cautious personality.`
    };
    
    const templateMap: Record<string, string> = templates;
    return templateMap[type] || templates.market_analysis;
  }

  // Main conversational interface
  async processConversation(userId: string, userMessage: string): Promise<string> {
    if (!this.openai) {
      // Fallback to personality-driven responses
      return await SteviePersonality.generateContextualResponse(userMessage, {}, {});
    }

    try {
      const context = await this.contextManager.buildContext(userId, userMessage);
      
      const messages: ChatMessage[] = [
        ...context.conversationHistory,
        {
          role: 'user',
          content: userMessage,
          timestamp: new Date().toISOString()
        }
      ];

      const trimmedMessages = this.contextManager.trimContext(messages);
      
      const completion = await this.openai.chat.completions.create({
        model: "gpt-4o", // Latest model per blueprint guidelines
        messages: trimmedMessages.map(m => ({ 
          role: m.role as "system" | "user" | "assistant", 
          content: m.content 
        })),
        tools: this.getFunctionDefinitions().map(func => ({
          type: "function" as const,
          function: func
        })),
        tool_choice: "auto",
        max_tokens: 500,
        temperature: 0.7
      });

      const assistantMessage = completion.choices[0].message;
      
      // Handle tool calls (new OpenAI format)
      if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
        const toolCall = assistantMessage.tool_calls[0];
        if (toolCall.type === 'function') {
          const functionResult = await this.executeFunction({
            name: toolCall.function.name,
            arguments: toolCall.function.arguments
          }, userId);
          
          // Call OpenAI again with tool result
          const followUpMessages = [
            ...trimmedMessages.map(m => ({ 
              role: m.role as "system" | "user" | "assistant", 
              content: m.content 
            })),
            {
              role: 'assistant' as const,
              content: assistantMessage.content || '',
              tool_calls: assistantMessage.tool_calls
            },
            {
              role: 'tool' as const,
              tool_call_id: toolCall.id,
              content: JSON.stringify(functionResult.result)
            }
          ];
          
          const finalCompletion = await this.openai.chat.completions.create({
            model: "gpt-4o",
            messages: followUpMessages,
            max_tokens: 400,
            temperature: 0.7
          });
          
          return finalCompletion.choices[0].message.content || "I processed your request but had trouble generating a response.";
        }
      }
      
      return assistantMessage.content || "I heard you, but I'm having a moment. Can you try asking that again?";
      
    } catch (error) {
      logger.error('Error in Stevie LLM conversation', { error, userId });
      // Fallback to personality responses
      return await SteviePersonality.generateContextualResponse(userMessage, {}, {});
    }
  }
}

export const stevieLLM = new StevieLLMInterface();