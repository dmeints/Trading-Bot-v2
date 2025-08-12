
/**
 * Meta-Brain API Routes
 * Provides endpoints for meta-brain architecture access
 */

import { Router } from 'express';
import { logger } from '../utils/logger';
import { MetaBrain, createTradingMetaBrain } from '../brain/meta_brain';

const metaBrainRouter = Router();

// Global meta-brain instance
let metaBrain: MetaBrain | null = null;

// Initialize meta-brain
function initializeMetaBrain(): MetaBrain {
  if (!metaBrain) {
    metaBrain = createTradingMetaBrain(['breakout', 'meanRevert', 'news', 'momentum', 'pairs']);
    logger.info('[MetaBrainAPI] Initialized meta-brain system');
  }
  return metaBrain;
}

/**
 * GET /api/meta-brain/state
 * Get current meta-brain state
 */
metaBrainRouter.get('/state', (req, res) => {
  try {
    const brain = initializeMetaBrain();
    const state = brain.getState();
    
    res.json({
      success: true,
      data: state,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('[MetaBrainAPI] Error getting state', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to get meta-brain state'
    });
  }
});

/**
 * GET /api/meta-brain/diagnostics
 * Get comprehensive meta-brain diagnostics
 */
metaBrainRouter.get('/diagnostics', (req, res) => {
  try {
    const brain = initializeMetaBrain();
    const diagnostics = brain.getDiagnostics();
    
    res.json({
      success: true,
      data: diagnostics,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('[MetaBrainAPI] Error getting diagnostics', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to get meta-brain diagnostics'
    });
  }
});

/**
 * POST /api/meta-brain/decision
 * Make meta-brain decision
 */
metaBrainRouter.post('/decision', async (req, res) => {
  try {
    const { marketFeatures, target, strategyPerformances } = req.body;
    
    if (!marketFeatures || typeof target !== 'number') {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: marketFeatures, target'
      });
    }
    
    const brain = initializeMetaBrain();
    const decision = await brain.makeDecision(marketFeatures, target, strategyPerformances);
    
    res.json({
      success: true,
      data: decision,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('[MetaBrainAPI] Error making decision', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to make meta-brain decision'
    });
  }
});

/**
 * POST /api/meta-brain/feedback
 * Provide performance feedback to meta-brain
 */
metaBrainRouter.post('/feedback', (req, res) => {
  try {
    const { strategyId, reward } = req.body;
    
    if (!strategyId || typeof reward !== 'number') {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: strategyId, reward'
      });
    }
    
    const brain = initializeMetaBrain();
    brain.updateStrategyPerformance(strategyId, reward);
    
    res.json({
      success: true,
      message: 'Performance feedback recorded',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('[MetaBrainAPI] Error updating performance', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to update strategy performance'
    });
  }
});

/**
 * POST /api/meta-brain/reset
 * Reset meta-brain state (admin only)
 */
metaBrainRouter.post('/reset', (req, res) => {
  try {
    const brain = initializeMetaBrain();
    brain.reset();
    
    res.json({
      success: true,
      message: 'Meta-brain reset completed',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('[MetaBrainAPI] Error resetting meta-brain', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to reset meta-brain'
    });
  }
});

/**
 * GET /api/meta-brain/components/:component
 * Get specific component diagnostics
 */
metaBrainRouter.get('/components/:component', (req, res) => {
  try {
    const { component } = req.params;
    const brain = initializeMetaBrain();
    const diagnostics = brain.getDiagnostics();
    
    if (!diagnostics.components[component]) {
      return res.status(404).json({
        success: false,
        error: `Component '${component}' not found`
      });
    }
    
    res.json({
      success: true,
      data: {
        component,
        diagnostics: diagnostics.components[component]
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('[MetaBrainAPI] Error getting component diagnostics', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to get component diagnostics'
    });
  }
});

export { metaBrainRouter };
