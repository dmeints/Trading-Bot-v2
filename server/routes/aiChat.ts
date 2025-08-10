import { Router } from 'express';
import { logger } from '../utils/logger.js';

const aiChatRouter = Router();

// Initialize OpenAI client dynamically
let openai: any = null;

async function initializeOpenAI() {
  if (!process.env.OPENAI_API_KEY || openai) return;
  
  try {
    const { default: OpenAI } = await import('openai');
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  } catch (error) {
    logger.warn('OpenAI import failed, chat will be limited', { error: String(error) });
  }
}

/**
 * POST /api/ai/chat
 * Chat with Stevie AI - intelligent trading companion
 */
aiChatRouter.post('/chat', async (req, res) => {
  try {
    await initializeOpenAI();
    const { message, context } = req.body;

    if (!message?.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Message is required',
      });
    }

    if (!openai) {
      // Fallback response when OpenAI is not available
      return res.json({
        success: true,
        message: "Hey! I'm Stevie, your AI trading companion. I'm currently running in demo mode since OpenAI isn't configured. I can still help you understand the platform and provide basic trading insights based on the current market data!",
        confidence: 0.7,
        timestamp: new Date().toISOString(),
      });
    }

    // Build context-aware system prompt for Stevie
    const systemPrompt = `You are Stevie, an enthusiastic and data-driven AI trading companion for cryptocurrency markets. You have access to real-time market data and portfolio information.

PERSONALITY TRAITS:
- Enthusiastic but professional 
- Data-driven and analytical
- Encouraging but realistic about risks
- Use occasional trading/crypto slang appropriately
- Always provide actionable insights

CURRENT CONTEXT:
${context?.marketData ? `Market Data: BTC price is $${context.marketData.price?.toLocaleString()}` : 'No current market data available'}
${context?.portfolioData ? `Portfolio: Total value $${context.portfolioData.totalValue?.toLocaleString()}, ${context.portfolioData.positions?.length || 0} positions` : 'No portfolio data available'}
${context?.recommendations?.length ? `Active Recommendations: ${context.recommendations.length} signals available` : 'No active recommendations'}

RESPONSE FORMAT:
- Provide clear, actionable analysis
- Include confidence levels when making predictions
- Suggest specific trading signals (BUY/SELL/HOLD) when appropriate
- Always mention risk considerations
- Keep responses concise but informative (max 200 words)

CAPABILITIES:
- Market analysis and trend identification  
- Portfolio performance evaluation
- Risk assessment and position sizing
- Trading opportunity identification
- Technical and fundamental analysis
- Sentiment analysis from news/social data

Remember: This is paper trading mode. Always emphasize learning and risk management.`;

    // Call OpenAI API
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message },
      ],
      max_tokens: 300,
      temperature: 0.7,
      functions: [
        {
          name: 'provide_trading_signal',
          description: 'Provide a trading signal with confidence level',
          parameters: {
            type: 'object',
            properties: {
              signal: {
                type: 'string',
                enum: ['BUY', 'SELL', 'HOLD'],
                description: 'Trading signal recommendation',
              },
              confidence: {
                type: 'number',
                minimum: 0,
                maximum: 1,
                description: 'Confidence level (0-1)',
              },
              reasoning: {
                type: 'string',
                description: 'Brief reasoning for the signal',
              },
            },
            required: ['signal', 'confidence', 'reasoning'],
          },
        },
      ],
      function_call: 'auto',
    });

    const assistantMessage = completion.choices[0]?.message;
    let response = assistantMessage?.content || 'Sorry, I had trouble processing that request.';
    let tradingSignal: string | undefined;
    let confidence: number | undefined;

    // Handle function call response
    if (assistantMessage?.function_call?.name === 'provide_trading_signal') {
      try {
        const functionArgs = JSON.parse(assistantMessage.function_call.arguments || '{}');
        tradingSignal = functionArgs.signal;
        confidence = functionArgs.confidence;
        response += `\n\n${functionArgs.reasoning}`;
      } catch (error) {
        logger.error('Error parsing function call arguments:', error);
      }
    }

    // Extract confidence from response if not from function call
    if (!confidence) {
      const confidenceMatch = response.match(/(\d+)%\s*confidence/i);
      if (confidenceMatch) {
        confidence = parseInt(confidenceMatch[1]) / 100;
      } else {
        // Default confidence based on response certainty indicators
        confidence = response.includes('definitely') || response.includes('clearly') ? 0.8 :
                    response.includes('likely') || response.includes('probably') ? 0.7 :
                    response.includes('might') || response.includes('could') ? 0.6 : 0.5;
      }
    }

    // Log the interaction for learning
    logger.info('Stevie AI Chat Interaction', {
      userMessage: message.substring(0, 100),
      responseLength: response.length,
      tradingSignal,
      confidence,
      hasContext: !!(context?.marketData || context?.portfolioData),
    } as any);

    res.json({
      success: true,
      message: response,
      confidence,
      tradingSignal,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    logger.error('AI Chat error:', error as any);
    res.status(500).json({
      success: false,
      error: 'Failed to process chat message',
    });
  }
});

/**
 * GET /api/ai/chat/history
 * Get recent chat history (placeholder for future implementation)
 */
aiChatRouter.get('/chat/history', async (req, res) => {
  try {
    // For now, return empty history - could be implemented with database storage
    res.json({
      success: true,
      data: {
        messages: [],
        totalMessages: 0,
      },
    });
  } catch (error) {
    logger.error('Chat history error:', error as any);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve chat history',
    });
  }
});

export { aiChatRouter };