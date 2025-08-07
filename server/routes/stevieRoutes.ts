/**
 * Stevie AI Companion Routes
 * 
 * Handles all interactions with Stevie, the AI trading personality
 */

import express from 'express';
import { z } from 'zod';
import { isAuthenticated } from '../replitAuth';
import SteviePersonality from '../services/steviePersonality';
import { stevieLLM } from '../services/stevieLLMInterface';
import { stevieRL } from '../services/stevieRL';
import StevieUIPersonality from '../services/stevieUIPersonality';
import { storage } from '../storage';
import { logger } from '../utils/logger';
import OpenAI from 'openai';

const router = express.Router();

// Initialize OpenAI for Stevie's LLM capabilities
let openai: OpenAI | null = null;
try {
  if (process.env.OPENAI_API_KEY) {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
} catch (error) {
  logger.warn('OpenAI not initialized for Stevie', { error });
}

const chatRequestSchema = z.object({
  message: z.string().min(1).max(1000),
  context: z.object({
    currentSymbol: z.string().optional(),
    portfolioValue: z.number().optional(),
    recentTrade: z.object({
      symbol: z.string(),
      profit: z.number(),
      side: z.string()
    }).optional()
  }).optional()
});

// Get Stevie's personality info
router.get('/personality', (req, res) => {
  try {
    const persona = SteviePersonality.getPersonaInfo();
    res.json({
      success: true,
      data: persona,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error getting Stevie personality', { error });
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get personality info' 
    });
  }
});

// Get daily trading tip from Stevie
router.get('/daily-tip', isAuthenticated, (req, res) => {
  try {
    const tip = SteviePersonality.getDailyTip();
    res.json({
      success: true,
      data: { tip },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error getting daily tip', { error });
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get daily tip' 
    });
  }
});

// Get contextual greeting based on user status
router.get('/greeting', isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    
    // Get user context for personalized greeting
    const user = await storage.getUser(userId);
    const positions = await storage.getUserPositions(userId);
    
    // Generate contextual greeting
    const greeting = SteviePersonality.getGreetingMessage();
    
    // Add context about user's portfolio if available
    let enhancedContent = greeting.content;
    if (positions.length > 0) {
      const totalValue = positions.reduce((sum, pos) => 
        sum + (Number(pos.quantity) * Number(pos.currentPrice)), 0
      );
      
      if (totalValue > 1000) {
        enhancedContent += ` I see your portfolio is looking strong at $${totalValue.toFixed(2)}!`;
      }
    }
    
    res.json({
      success: true,
      data: { 
        message: enhancedContent,
        type: greeting.type,
        persona: user?.firstName || 'Trader'
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Error generating greeting', { error });
    res.status(500).json({ 
      success: false, 
      error: 'Failed to generate greeting' 
    });
  }
});

// Main chat endpoint with Stevie
router.post('/chat', isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const { message, context } = chatRequestSchema.parse(req.body);
    
    // Use advanced LLM interface for sophisticated conversation
    const response = await stevieLLM.processConversation(userId, message);
    
    // Log the interaction for learning
    logger.info('Stevie chat interaction', {
      userId,
      messageLength: message.length,
      responseLength: response.length,
      context
    });
    
    res.json({
      success: true,
      data: {
        message: response,
        persona: 'Stevie',
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    logger.error('Error in Stevie chat', { error });
    res.status(500).json({ 
      success: false, 
      error: 'Failed to process chat message' 
    });
  }
});

// Advanced LLM endpoints for specific queries
router.post('/explain-trade', isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const { tradeId } = z.object({ tradeId: z.string() }).parse(req.body);
    
    const explanation = await stevieLLM.processConversation(
      userId, 
      `Please explain the decision-making process behind my trade with ID ${tradeId}. What factors influenced this trade?`
    );
    
    res.json({
      success: true,
      data: { explanation },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error explaining trade', { error });
    res.status(500).json({ success: false, error: 'Failed to explain trade' });
  }
});

router.get('/portfolio-summary', isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    
    const summary = await stevieLLM.processConversation(
      userId,
      'Please provide a comprehensive summary of my portfolio performance including key metrics and insights.'
    );
    
    res.json({
      success: true,
      data: { summary },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error generating portfolio summary', { error });
    res.status(500).json({ success: false, error: 'Failed to generate portfolio summary' });
  }
});

router.post('/strategy-suggestions', isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const { drawdownPeriod } = z.object({ 
      drawdownPeriod: z.string().optional().default('7d')
    }).parse(req.body);
    
    const suggestions = await stevieLLM.processConversation(
      userId,
      `Based on my recent ${drawdownPeriod} drawdown, what specific strategy tweaks do you recommend?`
    );
    
    res.json({
      success: true,
      data: { suggestions },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error generating strategy suggestions', { error });
    res.status(500).json({ success: false, error: 'Failed to generate strategy suggestions' });
  }
});

// RL Training endpoints
router.post('/rl/train', isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const { episodes } = z.object({ 
      episodes: z.number().min(10).max(1000).default(100)
    }).parse(req.body);
    
    logger.info(`[StevieRL] Starting training for user ${userId}`);
    const metrics = await stevieRL.trainOnHistoricalData(userId, episodes);
    
    res.json({
      success: true,
      data: {
        message: `Training completed! Stevie learned from ${episodes} episodes.`,
        metrics,
        agentStatus: stevieRL.getAgentStatus()
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error training RL agent', { error });
    res.status(500).json({ success: false, error: 'Failed to train RL agent' });
  }
});

router.get('/rl/status', isAuthenticated, (req, res) => {
  try {
    const status = stevieRL.getAgentStatus();
    
    res.json({
      success: true,
      data: status,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error getting RL status', { error });
    res.status(500).json({ success: false, error: 'Failed to get RL status' });
  }
});

// UI Personality endpoints
router.post('/ui/notification', isAuthenticated, async (req: any, res) => {
  try {
    const { type, symbol, amount, price, confidence } = z.object({
      type: z.enum(['buy', 'sell']),
      symbol: z.string(),
      amount: z.number(),
      price: z.number(),
      confidence: z.number().optional()
    }).parse(req.body);
    
    const notification = StevieUIPersonality.getTradeNotification(
      type, symbol, amount, price, confidence
    );
    
    res.json({
      success: true,
      data: notification,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error generating UI notification', { error });
    res.status(500).json({ success: false, error: 'Failed to generate notification' });
  }
});

router.post('/ui/risk-alert', isAuthenticated, async (req: any, res) => {
  try {
    const { level, reason, portfolioValue } = z.object({
      level: z.enum(['low', 'medium', 'high']),
      reason: z.string(),
      portfolioValue: z.number()
    }).parse(req.body);
    
    const alert = StevieUIPersonality.getRiskWarningNotification(
      level, reason, portfolioValue
    );
    
    res.json({
      success: true,
      data: alert,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error generating risk alert', { error });
    res.status(500).json({ success: false, error: 'Failed to generate risk alert' });
  }
});

router.get('/ui/quick-tip', (req, res) => {
  try {
    const tip = StevieUIPersonality.getQuickTip();
    
    res.json({
      success: true,
      data: { tip },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error getting quick tip', { error });
    res.status(500).json({ success: false, error: 'Failed to get quick tip' });
  }
});

// Get risk warning from Stevie
router.post('/risk-warning', isAuthenticated, async (req: any, res) => {
  try {
    const { riskLevel, context } = z.object({
      riskLevel: z.enum(['low', 'medium', 'high']),
      context: z.record(z.any()).optional()
    }).parse(req.body);
    
    const warning = SteviePersonality.getRiskWarningMessage(riskLevel, context);
    
    res.json({
      success: true,
      data: warning,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Error generating risk warning', { error });
    res.status(500).json({ 
      success: false, 
      error: 'Failed to generate risk warning' 
    });
  }
});

// Trade success celebration from Stevie
router.post('/celebrate-trade', isAuthenticated, async (req: any, res) => {
  try {
    const { profit, symbol } = z.object({
      profit: z.number(),
      symbol: z.string()
    }).parse(req.body);
    
    const celebration = SteviePersonality.getTradeSuccessMessage(profit, symbol);
    
    res.json({
      success: true,
      data: celebration,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Error generating trade celebration', { error });
    res.status(500).json({ 
      success: false, 
      error: 'Failed to generate celebration' 
    });
  }
});

// Market analysis with Stevie's perspective
router.post('/market-analysis', isAuthenticated, async (req: any, res) => {
  try {
    const { analysis } = z.object({
      analysis: z.object({
        sentiment: z.enum(['bullish', 'bearish', 'neutral']),
        confidence: z.number().min(0).max(1),
        signals: z.array(z.string()).optional()
      })
    }).parse(req.body);
    
    const stevieAnalysis = SteviePersonality.getMarketAnalysisMessage(analysis);
    
    res.json({
      success: true,
      data: stevieAnalysis,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Error generating market analysis', { error });
    res.status(500).json({ 
      success: false, 
      error: 'Failed to generate market analysis' 
    });
  }
});

// Get encouragement from Stevie
router.post('/encouragement', isAuthenticated, async (req: any, res) => {
  try {
    const { type } = z.object({
      type: z.enum(['loss', 'streak', 'learning'])
    }).parse(req.body);
    
    const encouragement = SteviePersonality.getEncouragementMessage(type);
    
    res.json({
      success: true,
      data: encouragement,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Error generating encouragement', { error });
    res.status(500).json({ 
      success: false, 
      error: 'Failed to generate encouragement' 
    });
  }
});

// Feedback endpoints
router.post('/feedback', isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const feedback = z.object({
      interactionType: z.enum(['chat', 'trade_suggestion', 'risk_alert', 'market_analysis']),
      feedback: z.enum(['positive', 'negative', 'neutral']),
      rating: z.number().min(1).max(5),
      comment: z.string().optional()
    }).parse(req.body);

    const { stevieFeedback } = await import('../services/stevieFeedback');
    await stevieFeedback.recordFeedback({
      userId,
      ...feedback,
      context: {}
    });

    res.json({
      success: true,
      data: { message: 'Feedback recorded successfully' },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error recording feedback', { error });
    res.status(500).json({ success: false, error: 'Failed to record feedback' });
  }
});

router.get('/weekly-report', isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const { stevieFeedback } = await import('../services/stevieFeedback');
    
    const report = await stevieFeedback.generateWeeklyReport(userId);
    const formattedMessage = stevieFeedback.formatWeeklyReportMessage(report);

    res.json({
      success: true,
      data: {
        report,
        formattedMessage
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error generating weekly report', { error });
    res.status(500).json({ success: false, error: 'Failed to generate weekly report' });
  }
});

// Benchmarking endpoints
router.post('/benchmark/run', isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const { stevieBenchmark } = await import('../services/stevieBenchmark');
    
    logger.info(`[Benchmark] Starting benchmark for user ${userId}`);
    const report = await stevieBenchmark.runBenchmark(userId);
    const formattedReport = stevieBenchmark.formatBenchmarkReport(report);

    res.json({
      success: true,
      data: {
        report,
        formattedReport,
        summary: {
          version: report.version,
          overallScore: report.overallScore,
          scoreImprovement: report.scoreImprovement,
          topRecommendations: report.topRecommendations.slice(0, 2)
        }
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error running benchmark', { error });
    res.status(500).json({ success: false, error: 'Failed to run benchmark' });
  }
});

router.post('/benchmark/update-version', isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const { version } = z.object({ version: z.string() }).parse(req.body);
    const { stevieBenchmark } = await import('../services/stevieBenchmark');
    
    const report = await stevieBenchmark.updateVersion(version, userId);
    const formattedReport = stevieBenchmark.formatBenchmarkReport(report);

    res.json({
      success: true,
      data: {
        message: `Stevie updated to version ${version}`,
        report,
        formattedReport,
        improvement: report.scoreImprovement
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error updating benchmark version', { error });
    res.status(500).json({ success: false, error: 'Failed to update version' });
  }
});

router.get('/benchmark/history', isAuthenticated, (req, res) => {
  try {
    const { stevieBenchmark } = require('../services/stevieBenchmark');
    const history = stevieBenchmark.getBenchmarkHistory();
    const latest = stevieBenchmark.getLatestBenchmark();

    res.json({
      success: true,
      data: {
        history,
        latest,
        totalVersions: history.length
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error getting benchmark history', { error });
    res.status(500).json({ success: false, error: 'Failed to get benchmark history' });
  }
});

router.get('/benchmark/latest', isAuthenticated, (req, res) => {
  try {
    const { stevieBenchmark } = require('../services/stevieBenchmark');
    const latest = stevieBenchmark.getLatestBenchmark();

    if (!latest) {
      return res.json({
        success: true,
        data: { message: 'No benchmark results available. Run your first benchmark!' },
        timestamp: new Date().toISOString()
      });
    }

    const formattedReport = stevieBenchmark.formatBenchmarkReport(latest);

    res.json({
      success: true,
      data: {
        report: latest,
        formattedReport,
        summary: {
          version: latest.version,
          overallScore: latest.overallScore,
          topRecommendations: latest.topRecommendations.slice(0, 2)
        }
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error getting latest benchmark', { error });
    res.status(500).json({ success: false, error: 'Failed to get latest benchmark' });
  }
});

// Advanced benchmarking endpoints
router.post('/benchmark/advanced/run', isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const { version = '1.1' } = req.body || {};
    const { stevieAdvancedBenchmark } = await import('../services/stevieAdvancedBenchmark');
    
    logger.info(`[AdvancedBenchmark] Starting comprehensive benchmark suite v${version}`, { userId });
    const report = await stevieAdvancedBenchmark.runComprehensiveBenchmark(userId, version);

    res.json({
      success: true,
      data: {
        message: `Advanced benchmark completed for Stevie v${version}`,
        report,
        summary: {
          version: report.version,
          overallScore: report.summary.overallScore,
          totalTrades: report.backtestResult.trades.length,
          sharpeRatio: report.backtestResult.metrics.sharpeRatio,
          maxDrawdown: report.backtestResult.metrics.maxDrawdown,
          winRate: report.backtestResult.metrics.winRate,
          consistency: report.walkForwardResult.consistency,
          bestParams: report.optimizationResult.bestParams,
          topRecommendations: report.summary.recommendations
        }
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error running advanced benchmark', { error });
    res.status(500).json({ success: false, error: 'Failed to run advanced benchmark' });
  }
});

router.get('/benchmark/advanced/latest', isAuthenticated, async (req, res) => {
  try {
    const { stevieAdvancedBenchmark } = await import('../services/stevieAdvancedBenchmark');
    const latest = await stevieAdvancedBenchmark.getLatestReport();

    if (!latest) {
      return res.json({
        success: true,
        data: { message: 'No advanced benchmark results available. Run your first advanced benchmark!' },
        timestamp: new Date().toISOString()
      });
    }

    res.json({
      success: true,
      data: {
        report: latest,
        summary: {
          version: latest.version,
          overallScore: latest.summary.overallScore,
          totalTrades: latest.backtestResult.trades.length,
          keyMetrics: latest.summary.keyMetrics,
          topRecommendations: latest.summary.recommendations,
          visualizations: Object.keys(latest.visualizations).length
        }
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error getting latest advanced benchmark', { error });
    res.status(500).json({ success: false, error: 'Failed to get latest advanced benchmark' });
  }
});

export default router;