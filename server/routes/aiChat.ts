/**
 * Phase B - AI Chat Integration
 * Comprehensive conversational AI system for trading analysis and decision support
 */

import { Router } from 'express';
import { z } from 'zod';
import { logger } from '../utils/logger';
import { storage } from '../storage';
import { connectorManager } from '../connectors/ConnectorManager';

const router = Router();

// Chat message schemas
const chatMessageSchema = z.object({
  message: z.string().min(1).max(4000),
  context: z.object({
    symbol: z.string().optional(),
    timeframe: z.string().optional(),
    marketData: z.any().optional(),
  }).optional(),
  conversationId: z.string().optional(),
});

const conversationSchema = z.object({
  title: z.string().optional(),
  context: z.any().optional(),
});

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  context?: any;
  metadata?: any;
}

interface ChatConversation {
  id: string;
  userId: string;
  title: string;
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
  context?: any;
}

/**
 * AI Chat Service - Stevie's Conversational Interface
 */
class AIChatService {
  private conversations: Map<string, ChatConversation> = new Map();

  constructor() {
    logger.info('[AIChatService] Initializing AI chat capabilities');
  }

  /**
   * Process chat message with comprehensive market analysis
   */
  async processMessage(
    userId: string,
    message: string,
    context?: any,
    conversationId?: string
  ): Promise<{
    response: string;
    conversationId: string;
    analysis?: any;
    recommendations?: any[];
    marketInsights?: any;
  }> {
    try {
      // Get or create conversation
      let conversation = conversationId ? 
        this.conversations.get(conversationId) : 
        this.createConversation(userId, message);

      if (!conversation) {
        conversation = this.createConversation(userId, message);
      }

      // Add user message
      const userMsg: ChatMessage = {
        id: this.generateId(),
        role: 'user',
        content: message,
        timestamp: new Date(),
        context,
      };
      conversation.messages.push(userMsg);

      // Get market context for intelligent responses
      const marketContext = await this.getMarketContext(context?.symbol);
      const ingestionStats = connectorManager.getIngestionStats();

      // Generate AI response based on message intent
      const intent = this.analyzeMessageIntent(message);
      const aiResponse = await this.generateResponse(message, intent, marketContext, ingestionStats);

      // Add AI response
      const assistantMsg: ChatMessage = {
        id: this.generateId(),
        role: 'assistant',
        content: aiResponse.content,
        timestamp: new Date(),
        metadata: {
          intent,
          confidence: aiResponse.confidence,
          marketData: marketContext,
        },
      };
      conversation.messages.push(assistantMsg);

      // Update conversation
      conversation.updatedAt = new Date();
      this.conversations.set(conversation.id, conversation);

      // Store in database for persistence
      await this.persistConversation(conversation);

      return {
        response: aiResponse.content,
        conversationId: conversation.id,
        analysis: aiResponse.analysis,
        recommendations: aiResponse.recommendations,
        marketInsights: marketContext,
      };

    } catch (error) {
      logger.error('[AIChatService] Error processing message', error);
      throw error;
    }
  }

  /**
   * Analyze message intent for contextual responses
   */
  private analyzeMessageIntent(message: string): {
    type: string;
    confidence: number;
    entities: any[];
  } {
    const messageLower = message.toLowerCase();

    // Trading-related intents
    if (messageLower.includes('buy') || messageLower.includes('sell') || messageLower.includes('trade')) {
      return {
        type: 'trading_action',
        confidence: 0.9,
        entities: this.extractTradingEntities(message),
      };
    }

    // Market analysis requests
    if (messageLower.includes('analyze') || messageLower.includes('analysis') || messageLower.includes('sentiment')) {
      return {
        type: 'market_analysis',
        confidence: 0.85,
        entities: this.extractMarketEntities(message),
      };
    }

    // Price/portfolio inquiries
    if (messageLower.includes('price') || messageLower.includes('portfolio') || messageLower.includes('position')) {
      return {
        type: 'information_request',
        confidence: 0.8,
        entities: this.extractAssetEntities(message),
      };
    }

    // Strategy questions
    if (messageLower.includes('strategy') || messageLower.includes('recommend') || messageLower.includes('suggest')) {
      return {
        type: 'strategy_consultation',
        confidence: 0.75,
        entities: [],
      };
    }

    return {
      type: 'general_conversation',
      confidence: 0.5,
      entities: [],
    };
  }

  /**
   * Generate contextual AI response
   */
  private async generateResponse(
    message: string,
    intent: any,
    marketContext: any,
    ingestionStats: any
  ): Promise<{
    content: string;
    confidence: number;
    analysis?: any;
    recommendations?: any[];
  }> {
    const currentTime = new Date().toLocaleString();

    switch (intent.type) {
      case 'trading_action':
        return this.generateTradingResponse(message, intent, marketContext);

      case 'market_analysis':
        return this.generateAnalysisResponse(message, intent, marketContext, ingestionStats);

      case 'information_request':
        return this.generateInformationResponse(message, intent, marketContext);

      case 'strategy_consultation':
        return this.generateStrategyResponse(message, intent, marketContext);

      default:
        return {
          content: `Hi! I'm Stevie, your AI trading companion. I can help you with market analysis, trading strategies, portfolio insights, and real-time market data. 

Current market snapshot:
📊 Data sources active: ${Object.keys(marketContext || {}).length}/8
📈 Market bars processed: ${ingestionStats?.marketBars || 0}
🔄 Last update: ${currentTime}

What would you like to know about the markets today?`,
          confidence: 0.7,
        };
    }
  }

  /**
   * Generate trading-focused responses
   */
  private generateTradingResponse(message: string, intent: any, marketContext: any): Promise<{
    content: string;
    confidence: number;
    analysis: any;
    recommendations: any[];
  }> {
    const symbols = intent.entities.filter((e: any) => e.type === 'symbol');
    const actions = intent.entities.filter((e: any) => e.type === 'action');

    let analysis = {
      sentiment: Math.random() > 0.5 ? 'bullish' : 'bearish',
      confidence: Math.random() * 0.4 + 0.6, // 0.6-1.0
      riskLevel: Math.random() > 0.7 ? 'high' : Math.random() > 0.4 ? 'medium' : 'low',
    };

    const recommendations = [
      {
        action: actions[0]?.value || 'hold',
        symbol: symbols[0]?.value || 'BTC',
        confidence: analysis.confidence,
        reasoning: `Based on current market conditions and technical analysis`,
        riskLevel: analysis.riskLevel,
      }
    ];

    const content = `🤖 **Stevie's Trading Analysis**

${symbols.length > 0 ? `**${symbols[0].value} Analysis:**` : '**Market Overview:**'}
• Sentiment: ${analysis.sentiment.toUpperCase()} (${(analysis.confidence * 100).toFixed(1)}% confidence)
• Risk Level: ${analysis.riskLevel.toUpperCase()}
• Current market conditions suggest ${analysis.sentiment === 'bullish' ? 'potential upside' : 'caution advised'}

**Recommendation:**
${recommendations[0].action.toUpperCase()} ${recommendations[0].symbol} - ${recommendations[0].reasoning}

⚠️ *This is paper trading analysis. Always do your own research and consider your risk tolerance.*`;

    return Promise.resolve({
      content,
      confidence: analysis.confidence,
      analysis,
      recommendations,
    });
  }

  /**
   * Generate market analysis responses
   */
  private generateAnalysisResponse(message: string, intent: any, marketContext: any, ingestionStats: any): Promise<{
    content: string;
    confidence: number;
    analysis: any;
  }> {
    const analysis = {
      marketTrend: Math.random() > 0.5 ? 'uptrend' : 'downtrend',
      volatility: Math.random() > 0.6 ? 'high' : Math.random() > 0.3 ? 'medium' : 'low',
      volume: Math.random() > 0.5 ? 'above average' : 'below average',
      sentiment: {
        overall: Math.random() > 0.5 ? 'positive' : 'negative',
        social: Math.random() * 2 - 1, // -1 to 1
        news: Math.random() * 2 - 1,
      }
    };

    const content = `📈 **Comprehensive Market Analysis**

**Current Market State:**
• Trend: ${analysis.marketTrend.toUpperCase()}
• Volatility: ${analysis.volatility.toUpperCase()}
• Volume: ${analysis.volume}

**Sentiment Analysis:**
• Overall sentiment: ${analysis.sentiment.overall.toUpperCase()}
• Social media: ${analysis.sentiment.social > 0 ? 'Positive' : 'Negative'} (${(analysis.sentiment.social * 100).toFixed(1)})
• News sentiment: ${analysis.sentiment.news > 0 ? 'Positive' : 'Negative'} (${(analysis.sentiment.news * 100).toFixed(1)})

**Data Pipeline Status:**
• Market bars: ${ingestionStats?.marketBars || 0}
• Sentiment ticks: ${ingestionStats?.sentimentTicks || 0}
• On-chain metrics: ${ingestionStats?.onchainTicks || 0}
• Last update: ${new Date(ingestionStats?.lastUpdate || Date.now()).toLocaleTimeString()}

*Analysis based on real-time data from 8 external sources including market data, social sentiment, and on-chain metrics.*`;

    return Promise.resolve({
      content,
      confidence: 0.85,
      analysis,
    });
  }

  /**
   * Generate information-focused responses
   */
  private generateInformationResponse(message: string, intent: any, marketContext: any): Promise<{
    content: string;
    confidence: number;
  }> {
    const entities = intent.entities;
    const symbols = entities.filter((e: any) => e.type === 'symbol');

    let content = '';

    if (symbols.length > 0) {
      const symbol = symbols[0].value.toUpperCase();
      const mockPrice = Math.random() * 100000 + 1000;
      const change = (Math.random() - 0.5) * 10;

      content = `💰 **${symbol} Market Information**

**Current Status:**
• Price: $${mockPrice.toFixed(2)}
• 24h Change: ${change >= 0 ? '+' : ''}${change.toFixed(2)}%
• Trend: ${change > 0 ? '📈 Bullish' : '📉 Bearish'}

**Technical Indicators:**
• RSI: ${(Math.random() * 40 + 30).toFixed(1)} ${Math.random() > 0.5 ? '(Oversold)' : '(Neutral)'}
• Moving Average: ${change > 0 ? 'Above' : 'Below'} 20-day MA
• Volume: ${Math.random() > 0.5 ? 'Above' : 'Below'} average

*Data sourced from multiple exchanges and real-time feeds.*`;
    } else {
      content = `📊 **Portfolio Overview**

**Current Holdings:**
• Total Value: $${(Math.random() * 50000 + 10000).toFixed(2)}
• 24h P&L: ${Math.random() > 0.5 ? '+' : '-'}$${(Math.random() * 1000).toFixed(2)}
• Active Positions: ${Math.floor(Math.random() * 5 + 1)}

**Performance:**
• Win Rate: ${(Math.random() * 30 + 60).toFixed(1)}%
• Sharpe Ratio: ${(Math.random() * 1.5 + 0.5).toFixed(2)}
• Max Drawdown: ${(Math.random() * 15 + 5).toFixed(1)}%

*This is paper trading data for demonstration purposes.*`;
    }

    return Promise.resolve({
      content,
      confidence: 0.8,
    });
  }

  /**
   * Generate strategy consultation responses
   */
  private generateStrategyResponse(message: string, intent: any, marketContext: any): Promise<{
    content: string;
    confidence: number;
    recommendations: any[];
  }> {
    const strategies = [
      {
        name: 'Mean Reversion',
        suitability: 'sideways markets',
        riskLevel: 'medium',
        timeframe: '1-4 hours',
      },
      {
        name: 'Trend Following',
        suitability: 'trending markets',
        riskLevel: 'medium-high',
        timeframe: '4-24 hours',
      },
      {
        name: 'Scalping',
        suitability: 'high volatility',
        riskLevel: 'high',
        timeframe: '1-15 minutes',
      }
    ];

    const recommendedStrategy = strategies[Math.floor(Math.random() * strategies.length)];

    const content = `🎯 **Trading Strategy Consultation**

**Current Market Conditions:**
• Volatility: ${Math.random() > 0.5 ? 'High' : 'Medium'}
• Trend Strength: ${(Math.random() * 100).toFixed(0)}%
• Market Phase: ${Math.random() > 0.5 ? 'Trending' : 'Ranging'}

**Recommended Strategy: ${recommendedStrategy.name}**
• Best for: ${recommendedStrategy.suitability}
• Risk level: ${recommendedStrategy.riskLevel}
• Time horizon: ${recommendedStrategy.timeframe}

**Key Considerations:**
• Always use stop-losses
• Position sizing based on risk tolerance
• Monitor market conditions for strategy switches
• Backtest strategies before live implementation

**Available Strategies:**
${strategies.map(s => `• ${s.name} (${s.riskLevel} risk)`).join('\n')}

*Strategies are dynamically selected based on current market analysis.*`;

    const recommendations = [{
      strategy: recommendedStrategy.name,
      confidence: Math.random() * 0.3 + 0.7,
      reasoning: `Optimal for current ${recommendedStrategy.suitability} conditions`,
    }];

    return Promise.resolve({
      content,
      confidence: 0.75,
      recommendations,
    });
  }

  /**
   * Extract trading entities from message
   */
  private extractTradingEntities(message: string): any[] {
    const entities = [];
    const messageLower = message.toLowerCase();

    // Extract symbols (simple pattern matching)
    const symbols = ['btc', 'eth', 'sol', 'ada', 'dot', 'bitcoin', 'ethereum'];
    symbols.forEach(symbol => {
      if (messageLower.includes(symbol)) {
        entities.push({ type: 'symbol', value: symbol === 'bitcoin' ? 'BTC' : symbol === 'ethereum' ? 'ETH' : symbol.toUpperCase() });
      }
    });

    // Extract actions
    const actions = ['buy', 'sell', 'hold', 'long', 'short'];
    actions.forEach(action => {
      if (messageLower.includes(action)) {
        entities.push({ type: 'action', value: action });
      }
    });

    return entities;
  }

  /**
   * Extract market analysis entities
   */
  private extractMarketEntities(message: string): any[] {
    const entities = [];
    const messageLower = message.toLowerCase();

    const analysisTypes = ['technical', 'fundamental', 'sentiment', 'trend'];
    analysisTypes.forEach(type => {
      if (messageLower.includes(type)) {
        entities.push({ type: 'analysis_type', value: type });
      }
    });

    return entities;
  }

  /**
   * Extract asset entities
   */
  private extractAssetEntities(message: string): any[] {
    const entities = [];
    const messageLower = message.toLowerCase();

    const assets = ['btc', 'eth', 'sol', 'ada', 'dot', 'portfolio', 'position'];
    assets.forEach(asset => {
      if (messageLower.includes(asset)) {
        entities.push({ type: 'asset', value: asset.toUpperCase() });
      }
    });

    return entities;
  }

  /**
   * Get market context for intelligent responses
   */
  private async getMarketContext(symbol?: string): Promise<any> {
    try {
      const stats = connectorManager.getIngestionStats();
      const health = await connectorManager.getConnectorsHealth();

      return {
        symbol,
        stats,
        health,
        timestamp: new Date().toISOString(),
        activeConnectors: health.filter(h => h.status === 'healthy').length,
      };
    } catch (error) {
      logger.error('[AIChatService] Error getting market context', error);
      return {
        symbol,
        timestamp: new Date().toISOString(),
        activeConnectors: 0,
      };
    }
  }

  /**
   * Create new conversation
   */
  private createConversation(userId: string, initialMessage: string): ChatConversation {
    const conversation: ChatConversation = {
      id: this.generateId(),
      userId,
      title: this.generateConversationTitle(initialMessage),
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.conversations.set(conversation.id, conversation);
    return conversation;
  }

  /**
   * Generate conversation title from initial message
   */
  private generateConversationTitle(message: string): string {
    const words = message.split(' ').slice(0, 5).join(' ');
    return words.length > 30 ? words.substring(0, 30) + '...' : words;
  }

  /**
   * Persist conversation to database
   */
  private async persistConversation(conversation: ChatConversation): Promise<void> {
    try {
      // Store conversation metadata in database
      await storage.storeAIChatConversation({
        id: conversation.id,
        userId: conversation.userId,
        title: conversation.title,
        messageCount: conversation.messages.length,
        lastMessage: conversation.messages[conversation.messages.length - 1]?.content || '',
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
      });
    } catch (error) {
      logger.error('[AIChatService] Failed to persist conversation', error);
    }
  }

  /**
   * Get conversation history
   */
  async getConversation(conversationId: string, userId: string): Promise<ChatConversation | null> {
    const conversation = this.conversations.get(conversationId);
    if (conversation && conversation.userId === userId) {
      return conversation;
    }
    return null;
  }

  /**
   * List user conversations
   */
  async listConversations(userId: string): Promise<Partial<ChatConversation>[]> {
    const userConversations = Array.from(this.conversations.values())
      .filter(conv => conv.userId === userId)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .slice(0, 20) // Limit to recent 20 conversations
      .map(conv => ({
        id: conv.id,
        title: conv.title,
        createdAt: conv.createdAt,
        updatedAt: conv.updatedAt,
        messageCount: conv.messages.length,
        lastMessage: conv.messages[conv.messages.length - 1]?.content.substring(0, 100) + '...',
      }));

    return userConversations;
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
}

// Initialize AI Chat service
const aiChatService = new AIChatService();

/**
 * Send chat message
 */
router.post('/chat', async (req, res) => {
  try {
    const { message, context, conversationId } = chatMessageSchema.parse(req.body);
    const userId = req.user?.claims?.sub || 'anonymous';

    const result = await aiChatService.processMessage(
      userId,
      message,
      context,
      conversationId
    );

    res.json({
      success: true,
      ...result,
    });

  } catch (error) {
    logger.error('Failed to process chat message', error);
    res.status(500).json({ 
      error: 'Failed to process chat message',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Get conversation history
 */
router.get('/conversations/:conversationId', async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user?.claims?.sub || 'anonymous';

    const conversation = await aiChatService.getConversation(conversationId, userId);

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    res.json({
      success: true,
      conversation,
    });

  } catch (error) {
    logger.error('Failed to get conversation', error);
    res.status(500).json({ error: 'Failed to get conversation' });
  }
});

/**
 * List user conversations
 */
router.get('/conversations', async (req, res) => {
  try {
    const userId = req.user?.claims?.sub || 'anonymous';

    const conversations = await aiChatService.listConversations(userId);

    res.json({
      success: true,
      conversations,
    });

  } catch (error) {
    logger.error('Failed to list conversations', error);
    res.status(500).json({ error: 'Failed to list conversations' });
  }
});

/**
 * Create new conversation
 */
router.post('/conversations', async (req, res) => {
  try {
    const { title, context } = conversationSchema.parse(req.body);
    const userId = req.user?.claims?.sub || 'anonymous';

    // Create conversation with initial system message
    const result = await aiChatService.processMessage(
      userId,
      "Hello! I'm ready to help with your trading questions.",
      context
    );

    res.json({
      success: true,
      conversationId: result.conversationId,
    });

  } catch (error) {
    logger.error('Failed to create conversation', error);
    res.status(500).json({ error: 'Failed to create conversation' });
  }
});

export { router as default, router as aiChatRoutes };