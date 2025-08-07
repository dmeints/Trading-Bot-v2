/**
 * PHASE 6: TA ROUTES - API ENDPOINTS FOR TECHNICAL ANALYSIS & SENTIMENT
 * REST endpoints for ChatGPT TA and sentiment analysis integration
 */

import express from 'express';
import { taService } from '../services/taService';
import { logger } from '../utils/logger';

const router = express.Router();

// Get full technical + sentiment analysis
router.get('/analysis/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    
    if (!symbol) {
      return res.status(400).json({ error: 'Symbol is required' });
    }

    const analysis = await taService.getFullAnalysis(symbol.toUpperCase());
    
    res.json({
      success: true,
      symbol: symbol.toUpperCase(),
      analysis,
      timestamp: Date.now()
    });
    
  } catch (error) {
    logger.error('TA analysis request failed:', error as Record<string, any>);
    res.status(500).json({
      success: false,
      error: 'Failed to generate analysis',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Chat interface for "Ask Stevie TA"
router.post('/chat', async (req, res) => {
  try {
    const { symbol, question } = req.body;
    
    if (!symbol || !question) {
      return res.status(400).json({ 
        error: 'Both symbol and question are required' 
      });
    }

    const response = await taService.chatAnalysis(symbol.toUpperCase(), question);
    
    res.json({
      success: true,
      symbol: symbol.toUpperCase(),
      question,
      response,
      timestamp: Date.now()
    });
    
  } catch (error) {
    logger.error('TA chat request failed:', error as Record<string, any>);
    res.status(500).json({
      success: false,
      error: 'Failed to process chat request',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get technical analysis only
router.get('/technical/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const analysis = await taService.getFullAnalysis(symbol.toUpperCase());
    
    res.json({
      success: true,
      symbol: symbol.toUpperCase(),
      technical: analysis.technical,
      timestamp: Date.now()
    });
    
  } catch (error) {
    logger.error('Technical analysis request failed:', error as Record<string, any>);
    res.status(500).json({
      success: false,
      error: 'Failed to generate technical analysis'
    });
  }
});

// Get sentiment analysis only
router.get('/sentiment/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const analysis = await taService.getFullAnalysis(symbol.toUpperCase());
    
    res.json({
      success: true,
      symbol: symbol.toUpperCase(),
      sentiment: analysis.sentiment,
      timestamp: Date.now()
    });
    
  } catch (error) {
    logger.error('Sentiment analysis request failed:', error as Record<string, any>);
    res.status(500).json({
      success: false,
      error: 'Failed to generate sentiment analysis'
    });
  }
});

// Batch analysis for multiple symbols
router.post('/batch-analysis', async (req, res) => {
  try {
    const { symbols } = req.body;
    
    if (!Array.isArray(symbols) || symbols.length === 0) {
      return res.status(400).json({
        error: 'Symbols array is required and cannot be empty'
      });
    }

    if (symbols.length > 10) {
      return res.status(400).json({
        error: 'Maximum 10 symbols allowed per batch request'
      });
    }

    const results = await Promise.allSettled(
      symbols.map(symbol => taService.getFullAnalysis(symbol.toUpperCase()))
    );
    
    const analysis = results.map((result, index) => ({
      symbol: symbols[index].toUpperCase(),
      success: result.status === 'fulfilled',
      data: result.status === 'fulfilled' ? result.value : null,
      error: result.status === 'rejected' ? result.reason?.message : null
    }));

    res.json({
      success: true,
      batchAnalysis: analysis,
      timestamp: Date.now()
    });
    
  } catch (error) {
    logger.error('Batch analysis request failed:', error as Record<string, any>);
    res.status(500).json({
      success: false,
      error: 'Failed to process batch analysis'
    });
  }
});

// Clear analysis cache
router.post('/cache/clear', async (req, res) => {
  try {
    taService.clearCache();
    
    res.json({
      success: true,
      message: 'TA service cache cleared',
      timestamp: Date.now()
    });
    
  } catch (error) {
    logger.error('Cache clear failed:', error as Record<string, any>);
    res.status(500).json({
      success: false,
      error: 'Failed to clear cache'
    });
  }
});

export default router;