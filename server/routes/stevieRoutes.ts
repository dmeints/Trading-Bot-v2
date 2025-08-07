/**
 * Stevie AI Companion Routes
 * 
 * Handles all interactions with Stevie, the AI trading personality
 */

import express from 'express';
import { z } from 'zod';
import { isAuthenticated } from '../replitAuth';
import SteviePersonality from '../services/steviePersonality';
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
    
    // Get user profile for personalization
    const user = await storage.getUser(userId);
    const marketData = {}; // Would get from market data service
    
    let response: string;
    
    if (openai) {
      // Use OpenAI for sophisticated responses
      const systemPrompt = SteviePersonality.getSystemPrompt('chat');
      const userContext = `User: ${user?.firstName || 'Trader'}, Risk Tolerance: ${user?.riskTolerance || 'medium'}`;
      
      try {
        const completion = await openai.chat.completions.create({
          model: "gpt-4o", // Latest model as per blueprint
          messages: [
            { role: "system", content: `${systemPrompt}\n\n${userContext}` },
            { role: "user", content: message }
          ],
          max_tokens: 300,
          temperature: 0.7
        });
        
        response = completion.choices[0].message.content || 
          "Hmm, I'm processing a lot right now. Can you try that question again?";
          
      } catch (aiError) {
        logger.error('OpenAI error in Stevie chat', { aiError });
        // Fallback to personality-driven response
        response = await SteviePersonality.generateContextualResponse(
          message, marketData, user
        );
      }
    } else {
      // Use personality-driven responses without OpenAI
      response = await SteviePersonality.generateContextualResponse(
        message, marketData, user
      );
    }
    
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

export default router;