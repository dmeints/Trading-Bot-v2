/**
 * Stevie v1.4 - Enhanced LLM Explanation Routes
 * API endpoints for detailed trading explanations and market insights
 */

import { Router, Request, Response } from 'express';
import { StevieExplanationService } from '../services/stevieExplanationService';

const router = Router();
const stevieService = new StevieExplanationService();

/**
 * GET /api/stevie/explain/:symbol
 * Get detailed explanation for a trading decision
 */
router.get('/explain/:symbol', async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;
    const { timestamp, signal, confidence } = req.query;

    const decision = {
      signal: parseFloat(signal as string) || 0,
      confidence: parseFloat(confidence as string) || 0.5
    };

    const explanation = await stevieService.explainTradeDecision(
      symbol.toUpperCase(),
      parseInt(timestamp as string) || Date.now(),
      decision
    );

    res.json({
      success: true,
      data: explanation
    });

  } catch (error) {
    console.error('Stevie explanation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate explanation'
    });
  }
});

/**
 * GET /api/stevie/market-outlook
 * Get comprehensive market outlook for multiple symbols
 */
router.get('/market-outlook', async (req: Request, res: Response) => {
  try {
    const { symbols } = req.query;
    const symbolList = symbols ? 
      (symbols as string).split(',').map(s => s.trim().toUpperCase()) : 
      ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'];

    const outlook = await stevieService.generateMarketOutlook(symbolList);

    res.json({
      success: true,
      data: outlook
    });

  } catch (error) {
    console.error('Market outlook error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate market outlook'
    });
  }
});

/**
 * POST /api/stevie/chat
 * Interactive chat with Stevie for trading questions
 */
router.post('/chat', async (req: Request, res: Response) => {
  try {
    const { message, symbol, context } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        error: 'Message is required'
      });
    }

    // For now, route specific questions to appropriate explanations
    let response;

    if (message.toLowerCase().includes('why') && symbol) {
      // Trade explanation request
      const mockDecision = { signal: 0.3, confidence: 0.7 }; // Would come from actual decision
      const explanation = await stevieService.explainTradeDecision(
        symbol.toUpperCase(),
        Date.now(),
        mockDecision
      );
      response = explanation.explanation.summary;
    } else if (message.toLowerCase().includes('market') || message.toLowerCase().includes('outlook')) {
      // Market outlook request
      const outlook = await stevieService.generateMarketOutlook(['BTCUSDT', 'ETHUSDT']);
      response = outlook.overallOutlook;
    } else {
      // Generic response
      response = "I'd be happy to help explain trading decisions or provide market insights! Ask me about specific trades or request a market outlook.";
    }

    res.json({
      success: true,
      data: {
        message: response,
        timestamp: Date.now(),
        context: context || {}
      }
    });

  } catch (error) {
    console.error('Stevie chat error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process chat request'
    });
  }
});

/**
 * GET /api/stevie/health
 * Health check for Stevie explanation services
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    // Test basic functionality
    const testExplanation = await stevieService.explainTradeDecision(
      'BTCUSDT',
      Date.now(),
      { signal: 0.1, confidence: 0.6 }
    );

    res.json({
      success: true,
      data: {
        status: 'healthy',
        features: {
          explanations: !!testExplanation,
          llmIntegration: process.env.OPENAI_API_KEY ? 'enabled' : 'disabled',
          featureService: 'connected',
          vectorService: 'connected'
        },
        timestamp: Date.now()
      }
    });

  } catch (error) {
    console.error('Stevie health check error:', error);
    res.status(503).json({
      success: false,
      error: 'Service unhealthy',
      details: error.message
    });
  }
});

export default router;