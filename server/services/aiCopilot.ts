import OpenAI from 'openai';
import { storage } from '../storage';
import { env } from '../config/env';

interface CopilotResponse {
  answer: string;
  confidence: number;
  sources: string[];
  followUpQuestions: string[];
}

interface TradeExplanation {
  symbol: string;
  action: string;
  reasoning: string;
  confidence: number;
  featureImportances: any[];
  marketContext: any;
}

class AICopilotService {
  private openai: OpenAI | null = null;
  private conversationHistory: Map<string, any[]> = new Map();

  constructor() {
    if (env.OPENAI_API_KEY) {
      this.openai = new OpenAI({
        apiKey: env.OPENAI_API_KEY
      });
    }
  }

  async askQuestion(userId: string, question: string, context?: any): Promise<CopilotResponse> {
    if (!this.openai) {
      throw new Error('OpenAI API key not configured');
    }

    console.log(`[AICopilot] Processing question for user ${userId}: ${question}`);

    // Get relevant context
    const contextData = await this.gatherContext(userId, question, context);
    
    // Get conversation history
    const history = this.conversationHistory.get(userId) || [];
    
    // Build system prompt
    const systemPrompt = this.buildSystemPrompt(contextData);
    
    // Build conversation messages
    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.slice(-10), // Keep last 10 exchanges
      { role: 'user', content: question }
    ];

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: messages as any,
        max_tokens: 1000,
        temperature: 0.7,
      });

      const answer = response.choices[0]?.message?.content || 'I apologize, but I could not generate a response.';

      // Store conversation
      this.updateConversationHistory(userId, question, answer);

      // Generate follow-up questions
      const followUpQuestions = this.generateFollowUpQuestions(question, answer, contextData);

      const copilotResponse: CopilotResponse = {
        answer,
        confidence: this.calculateConfidence(answer, contextData),
        sources: this.extractSources(contextData),
        followUpQuestions
      };

      return copilotResponse;

    } catch (error) {
      console.error('[AICopilot] Error processing question:', error);
      throw new Error('Failed to process question');
    }
  }

  async explainTrade(tradeId: string, userId: string): Promise<TradeExplanation> {
    console.log(`[AICopilot] Explaining trade ${tradeId} for user ${userId}`);

    // Get trade details
    const trades = await storage.getUserTrades(userId, 100);
    const trade = trades.find(t => t.id === tradeId);
    
    if (!trade) {
      throw new Error(`Trade ${tradeId} not found`);
    }

    // Get market context at time of trade
    const marketContext = await this.getTradeMarketContext(trade);
    
    // Get AI decision reasoning
    const aiActivities = await storage.getAgentActivities(userId, 20);
    const relatedActivity = aiActivities.find(activity => 
      Math.abs(new Date(activity.createdAt).getTime() - new Date(trade.executedAt).getTime()) < 300000 // 5 minutes
    );

    // Generate feature importances
    const featureImportances = await this.generateFeatureImportances(trade, marketContext);

    // Generate explanation
    const reasoning = await this.generateTradeReasoning(trade, marketContext, relatedActivity);

    return {
      symbol: trade.symbol,
      action: trade.type,
      reasoning,
      confidence: relatedActivity?.confidence || 0.7,
      featureImportances,
      marketContext
    };
  }

  async provideParameterRecommendations(userId: string, strategy: string): Promise<any> {
    console.log(`[AICopilot] Generating parameter recommendations for ${strategy}`);

    // Get user's trading history
    const trades = await storage.getUserTrades(userId, 200);
    const performance = this.analyzePerformance(trades);
    
    // Get current market conditions
    const marketConditions = await this.getCurrentMarketConditions();
    
    // Generate recommendations based on performance and market
    const recommendations = await this.generateParameterRecommendations(
      strategy, 
      performance, 
      marketConditions
    );

    return recommendations;
  }

  async generateLiveTradeCommentary(tradeSignal: any): Promise<string> {
    if (!this.openai) {
      return `Trade signal: ${tradeSignal.action} ${tradeSignal.symbol} at confidence ${tradeSignal.confidence}`;
    }

    const prompt = `
    Generate a concise, insightful commentary for this live trade signal:
    
    Symbol: ${tradeSignal.symbol}
    Action: ${tradeSignal.action}
    Confidence: ${tradeSignal.confidence}
    Price: ${tradeSignal.price}
    Market Context: ${JSON.stringify(tradeSignal.marketContext)}
    
    Provide a 1-2 sentence explanation that a trader would find valuable.
    `;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 150,
        temperature: 0.8,
      });

      return response.choices[0]?.message?.content || 'Trade signal processed';
    } catch (error) {
      console.error('[AICopilot] Error generating commentary:', error);
      return `${tradeSignal.action} ${tradeSignal.symbol} - confidence ${Math.round(tradeSignal.confidence * 100)}%`;
    }
  }

  private async gatherContext(userId: string, question: string, additionalContext?: any): Promise<any> {
    const context: any = {
      user: await storage.getUser(userId),
      recentTrades: [],
      portfolio: null,
      aiActivities: [],
      marketData: null
    };

    // Get recent trades if question is about trading
    if (this.isTradeRelatedQuestion(question)) {
      context.recentTrades = await storage.getUserTrades(userId, 20);
    }

    // Get portfolio if question is about portfolio/performance
    if (this.isPortfolioRelatedQuestion(question)) {
      context.portfolio = await storage.getPortfolioSummary(userId);
    }

    // Get AI activities if question is about AI decisions
    if (this.isAIRelatedQuestion(question)) {
      context.aiActivities = await storage.getAgentActivities(userId, 20);
    }

    // Add additional context
    if (additionalContext) {
      context.additional = additionalContext;
    }

    return context;
  }

  private buildSystemPrompt(context: any): string {
    return `
    You are Skippy's AI Trading Copilot, an intelligent assistant that helps users understand their trading activity and make better decisions.

    Context about the user:
    - User ID: ${context.user?.id || 'Unknown'}
    - Trading Experience: ${context.user?.experience || 'Unknown'}
    - Recent Trades: ${context.recentTrades?.length || 0} trades available
    - Portfolio Value: $${context.portfolio?.totalValue || 'Unknown'}
    - Recent AI Activities: ${context.aiActivities?.length || 0} activities

    Your capabilities:
    1. Explain trading decisions and their reasoning
    2. Analyze trading performance and patterns  
    3. Provide parameter optimization suggestions
    4. Answer questions about market conditions and strategies
    5. Offer educational trading insights

    Guidelines:
    - Be concise but informative
    - Use specific data when available
    - Acknowledge limitations when data is unavailable
    - Focus on actionable insights
    - Maintain a helpful, professional tone
    `;
  }

  private updateConversationHistory(userId: string, question: string, answer: string): void {
    const history = this.conversationHistory.get(userId) || [];
    history.push(
      { role: 'user', content: question },
      { role: 'assistant', content: answer }
    );
    
    // Keep only last 20 messages
    if (history.length > 20) {
      history.splice(0, history.length - 20);
    }
    
    this.conversationHistory.set(userId, history);
  }

  private generateFollowUpQuestions(question: string, answer: string, context: any): string[] {
    const questions = [];
    
    if (question.toLowerCase().includes('trade')) {
      questions.push('What market conditions influenced this decision?');
      questions.push('How can I improve my trading strategy?');
    }
    
    if (question.toLowerCase().includes('performance')) {
      questions.push('What are my best performing time periods?');
      questions.push('Which strategies work best in current market conditions?');
    }
    
    if (question.toLowerCase().includes('risk')) {
      questions.push('How can I optimize my risk management?');
      questions.push('What position sizes work best for my risk tolerance?');
    }

    return questions.slice(0, 3);
  }

  private calculateConfidence(answer: string, context: any): number {
    let confidence = 0.7; // Base confidence
    
    // Increase confidence if we have relevant data
    if (context.recentTrades && context.recentTrades.length > 0) confidence += 0.1;
    if (context.portfolio) confidence += 0.1;
    if (context.aiActivities && context.aiActivities.length > 0) confidence += 0.1;
    
    // Decrease confidence for very short or generic answers
    if (answer.length < 100) confidence -= 0.1;
    if (answer.includes('I don\'t have enough information')) confidence -= 0.2;

    return Math.max(0.3, Math.min(0.95, confidence));
  }

  private extractSources(context: any): string[] {
    const sources = [];
    
    if (context.recentTrades?.length > 0) sources.push('Recent Trading History');
    if (context.portfolio) sources.push('Portfolio Summary');
    if (context.aiActivities?.length > 0) sources.push('AI Decision Log');
    if (context.additional) sources.push('Real-time Market Data');

    return sources;
  }

  private async getTradeMarketContext(trade: any): Promise<any> {
    // Get market conditions at the time of trade
    return {
      price: trade.executedPrice,
      timestamp: trade.executedAt,
      symbol: trade.symbol,
      volume: trade.quantity,
      marketTrend: 'Unknown', // Would get from historical data
      volatility: 'Moderate', // Would calculate from price data
      sentiment: 'Neutral' // Would get from sentiment analysis
    };
  }

  private async generateFeatureImportances(trade: any, marketContext: any): Promise<any[]> {
    // Generate mock feature importances - in production, these would come from ML models
    return [
      { feature: 'Price Momentum', importance: 0.3, value: 'Positive' },
      { feature: 'Volume Profile', importance: 0.25, value: 'Above Average' },
      { feature: 'Market Sentiment', importance: 0.2, value: marketContext.sentiment },
      { feature: 'Technical Indicators', importance: 0.15, value: 'Bullish' },
      { feature: 'News Impact', importance: 0.1, value: 'Neutral' }
    ];
  }

  private async generateTradeReasoning(trade: any, marketContext: any, aiActivity: any): Promise<string> {
    if (!this.openai) {
      return `Trade executed based on algorithmic analysis. ${trade.type.toUpperCase()} ${trade.symbol} at $${trade.executedPrice} with confidence ${aiActivity?.confidence || 0.7}`;
    }

    const prompt = `
    Explain this trading decision in 2-3 sentences:
    
    Trade: ${trade.type.toUpperCase()} ${trade.symbol}
    Price: $${trade.executedPrice}
    Quantity: ${trade.quantity}
    PnL: $${trade.pnl}
    AI Confidence: ${aiActivity?.confidence || 0.7}
    AI Reasoning: ${aiActivity?.reasoning || 'Standard algorithmic analysis'}
    Market Context: ${JSON.stringify(marketContext)}
    
    Provide clear reasoning that explains why this trade was made.
    `;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 200,
        temperature: 0.6,
      });

      return response.choices[0]?.message?.content || 'Trade executed based on algorithmic analysis';
    } catch (error) {
      console.error('[AICopilot] Error generating trade reasoning:', error);
      return `Trade executed based on algorithmic analysis with ${Math.round((aiActivity?.confidence || 0.7) * 100)}% confidence`;
    }
  }

  private analyzePerformance(trades: any[]): any {
    if (trades.length === 0) {
      return { winRate: 0, avgPnL: 0, totalTrades: 0, sharpeRatio: 0 };
    }

    const winningTrades = trades.filter(t => t.pnl > 0);
    const winRate = winningTrades.length / trades.length;
    const totalPnL = trades.reduce((sum, t) => sum + t.pnl, 0);
    const avgPnL = totalPnL / trades.length;

    return {
      winRate,
      avgPnL,
      totalTrades: trades.length,
      totalPnL,
      sharpeRatio: this.calculateSharpeRatio(trades)
    };
  }

  private calculateSharpeRatio(trades: any[]): number {
    if (trades.length < 2) return 0;
    
    const returns = trades.map(t => t.pnl / 1000); // Normalize returns
    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);
    
    return stdDev === 0 ? 0 : avgReturn / stdDev;
  }

  private async getCurrentMarketConditions(): Promise<any> {
    // Get current market conditions - simplified implementation
    return {
      volatility: 'Moderate',
      trend: 'Bullish',
      sentiment: 'Positive',
      liquidity: 'High',
      riskAppetite: 'Moderate'
    };
  }

  private async generateParameterRecommendations(strategy: string, performance: any, marketConditions: any): Promise<any> {
    const recommendations = {
      strategy,
      currentPerformance: performance,
      marketConditions,
      recommendations: []
    };

    // Generate strategy-specific recommendations
    if (strategy === 'momentum') {
      if (performance.winRate < 0.5) {
        recommendations.recommendations.push({
          parameter: 'lookback_period',
          current: 14,
          recommended: 21,
          reason: 'Longer lookback may reduce false signals'
        });
      }
    }

    if (performance.sharpeRatio < 1.0) {
      recommendations.recommendations.push({
        parameter: 'position_size',
        current: '2%',
        recommended: '1.5%',
        reason: 'Reduce position size to improve risk-adjusted returns'
      });
    }

    if (marketConditions.volatility === 'High') {
      recommendations.recommendations.push({
        parameter: 'stop_loss',
        current: '3%',
        recommended: '2%',
        reason: 'Tighter stops recommended in high volatility environment'
      });
    }

    return recommendations;
  }

  private isTradeRelatedQuestion(question: string): boolean {
    const tradeKeywords = ['trade', 'buy', 'sell', 'position', 'order', 'execute'];
    return tradeKeywords.some(keyword => question.toLowerCase().includes(keyword));
  }

  private isPortfolioRelatedQuestion(question: string): boolean {
    const portfolioKeywords = ['portfolio', 'performance', 'profit', 'loss', 'return', 'balance'];
    return portfolioKeywords.some(keyword => question.toLowerCase().includes(keyword));
  }

  private isAIRelatedQuestion(question: string): boolean {
    const aiKeywords = ['ai', 'algorithm', 'model', 'confidence', 'decision', 'reasoning'];
    return aiKeywords.some(keyword => question.toLowerCase().includes(keyword));
  }
}

export const aiCopilot = new AICopilotService();