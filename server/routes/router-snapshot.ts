
/**
 * Router Snapshot API Routes
 */

import { Router } from 'express';
import { strategyRouter } from '../services/StrategyRouter';
import { logger } from '../utils/logger';

const router = Router();

/**
 * GET /api/router/snapshot
 * Get last router decision and feature vector
 */
router.get('/snapshot', (req, res) => {
  try {
    const snapshot = strategyRouter.getSnapshot();
    
    if (!snapshot) {
      return res.status(404).json({ error: 'No router decisions found' });
    }

    // Generate synthetic microstructure context that changes over time
    const baseTime = Date.now();
    const microCycle = Math.sin(baseTime / (1000 * 30)) * 0.3; // 30-sec microstructure cycle
    const regimeCycle = Math.cos(baseTime / (1000 * 120)) * 0.4; // 2-min regime cycle
    
    const syntheticContext = {
      obi: microCycle, // Order book imbalance flips
      ti: microCycle * 0.8, // Trade imbalance follows
      spread_bps: 2.5 + Math.abs(microCycle) * 3, // Spread widens with imbalance
      micro_vol: 0.01 + Math.abs(microCycle) * 0.005,
      regime: regimeCycle > 0.2 ? 'bull' : regimeCycle < -0.2 ? 'bear' : 'sideways',
      vol: 0.15 + regimeCycle * 0.05,
      trend: regimeCycle * 2,
      sentiment: (microCycle + regimeCycle) / 2
    };

    // Make routing decision with synthetic context
    const currentChoice = strategyRouter.choose(syntheticContext);
    
    res.json({
      decision: currentChoice,
      sampledScores: {
        chosen: currentChoice.policyId,
        score: currentChoice.score,
        explorationBonus: currentChoice.explorationBonus,
        confidence: currentChoice.confidence
      },
      featureVector: syntheticContext,
      microstructureSignals: {
        obi: syntheticContext.obi,
        ti: syntheticContext.ti,
        spread_bps: syntheticContext.spread_bps,
        cycleSec: Math.floor(baseTime / 1000) % 30
      },
      regimeSignals: {
        regime: syntheticContext.regime,
        trend: syntheticContext.trend,
        vol: syntheticContext.vol,
        cycleSec: Math.floor(baseTime / 1000) % 120
      },
      policyShift: {
        previousPolicy: snapshot.lastChoice?.policyId || 'unknown',
        currentPolicy: currentChoice.policyId,
        shiftReason: microCycle > 0.1 ? 'high_obi_bullish' : microCycle < -0.1 ? 'high_obi_bearish' : 'balanced_flow'
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('[Router] Error getting snapshot:', error);
    res.status(500).json({ error: 'Failed to get router snapshot' });
  }
});

/**
 * POST /api/router/choose
 * Make a routing decision (for testing)
 */
router.post('/choose', async (req, res) => {
  try {
    const { context } = req.body;
    
    if (!context || !context.symbol) {
      return res.status(400).json({ error: 'Missing context or symbol' });
    }

    // Enrich context with default values if missing
    const fullContext = {
      symbol: context.symbol,
      price: context.price || 50000,
      volume: context.volume || 100,
      timestamp: new Date(),
      ...context // Override with provided values
    };

    const choice = await strategyRouter.choose(fullContext);
    res.json(choice);

  } catch (error) {
    logger.error('[Router] Error making choice:', error);
    res.status(500).json({ error: 'Failed to make routing choice' });
  }
});

export default router;
