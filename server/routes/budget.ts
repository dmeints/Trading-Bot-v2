import { Router } from 'express';
import { budgeter as originalBudgeter } from '../services/Budgeter.js';
import { logger } from '../utils/logger.js';

const router = Router();
const budgeter = new originalBudgeter();

// GET /api/budget/status - Get current budget status for all providers
router.get('/status', (req, res) => {
  try {
    const providerStatus = budgeter.getStatus();
    
    const summary = {
      success: true,
      timestamp: new Date().toISOString(),
      providers: providerStatus.map(provider => ({
        provider: provider.provider,
        calls: provider.calls,
        costUSD: parseFloat(provider.costUSD.toFixed(4)),
        rateRemaining: provider.rateRemaining,
        resetAt: new Date(provider.resetAt).toISOString(),
        lastCall: provider.lastCall ? new Date(provider.lastCall).toISOString() : null,
        utilizationPercent: provider.rateRemaining > 0 
          ? ((provider.calls / (provider.calls + provider.rateRemaining)) * 100).toFixed(2) 
          : '100.00'
      })),
      totalCost: providerStatus.reduce((sum, p) => sum + p.costUSD, 0).toFixed(4),
      totalCalls: providerStatus.reduce((sum, p) => sum + p.calls, 0),
      healthyProviders: providerStatus.filter(p => p.rateRemaining > 10).length,
      totalProviders: providerStatus.length
    };
    
    res.json(summary);
    
    logger.debug('[Budget] Status retrieved for all providers');
  } catch (error) {
    logger.error('[Budget] Failed to get status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve budget status',
      timestamp: new Date().toISOString()
    });
  }
});

// GET /api/budget/status/:provider - Get status for specific provider
router.get('/status/:provider', (req, res) => {
  try {
    const { provider } = req.params;
    const status = budgeter.getProviderStatus(provider);
    
    if (!status) {
      return res.status(404).json({
        success: false,
        error: `Provider '${provider}' not found`,
        timestamp: new Date().toISOString()
      });
    }
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      provider: {
        provider: status.provider,
        calls: status.calls,
        costUSD: parseFloat(status.costUSD.toFixed(4)),
        rateRemaining: status.rateRemaining,
        resetAt: new Date(status.resetAt).toISOString(),
        lastCall: status.lastCall ? new Date(status.lastCall).toISOString() : null,
        utilizationPercent: status.rateRemaining > 0 
          ? ((status.calls / (status.calls + status.rateRemaining)) * 100).toFixed(2) 
          : '100.00'
      }
    });
    
    logger.debug(`[Budget] Status retrieved for provider: ${provider}`);
  } catch (error) {
    logger.error(`[Budget] Failed to get status for provider ${req.params.provider}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve provider budget status',
      timestamp: new Date().toISOString()
    });
  }
});

// POST /api/budget/check - Check if request would be allowed
router.post('/check', (req, res) => {
  try {
    const { provider, kind, estimatedCost } = req.body;
    
    if (!provider || !kind) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: provider, kind',
        timestamp: new Date().toISOString()
      });
    }
    
    const result = budgeter.checkBudget({ provider, kind, estimatedCost });
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      check: result
    });
    
    logger.debug(`[Budget] Budget check: ${provider}/${kind} = ${result.allowed ? 'ALLOWED' : 'BLOCKED'}`);
  } catch (error) {
    logger.error('[Budget] Failed to check budget:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check budget',
      timestamp: new Date().toISOString()
    });
  }
});

// PUT /api/budget/limits/:provider - Update provider limits (admin only)
router.put('/limits/:provider', (req, res) => {
  try {
    const { provider } = req.params;
    const updates = req.body;
    
    budgeter.updateLimits(provider, updates);
    
    res.json({
      success: true,
      message: `Limits updated for provider: ${provider}`,
      updates,
      timestamp: new Date().toISOString()
    });
    
    logger.info(`[Budget] Limits updated for provider ${provider}:`, updates);
  } catch (error) {
    logger.error(`[Budget] Failed to update limits for provider ${req.params.provider}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to update provider limits',
      timestamp: new Date().toISOString()
    });
  }
});

export default router;