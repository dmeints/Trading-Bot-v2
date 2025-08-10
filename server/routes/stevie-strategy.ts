/**
 * Stevie Strategy API Routes
 * Core strategy decision and testing endpoints
 */

import { Router, Request, Response } from 'express';
import { rateLimiters } from '../middleware/rateLimiter';
import { logger } from '../utils/logger';
import { decide } from '../strategy/stevie';
import { defaultStevieConfig } from '../../shared/src/stevie/config';
import { scoreTrade } from '../strategy/scorecard';
import { defaultScoreConfig } from '../../shared/src/stevie/score_config';

const router = Router();

/**
 * Get trading decision for symbol
 */
router.post('/decide', rateLimiters.features, async (req: Request, res: Response) => {
  try {
    const { symbol, timeframe = '5m', score7d = 0 } = req.body;
    
    if (!symbol) {
      return res.status(400).json({ error: 'Symbol is required' });
    }

    console.log(`[StevieStrategy] Getting decision for ${symbol}`);

    // Fetch comprehensive features for the symbol
    const featuresResponse = await fetch(`http://localhost:5000/api/comprehensive/comprehensive/${symbol}?hours=1`);
    
    if (!featuresResponse.ok) {
      throw new Error(`Failed to fetch features: ${featuresResponse.statusText}`);
    }
    
    const featuresData = await featuresResponse.json();
    
    // Transform comprehensive features to Stevie format
    const features = {
      bars: [
        // Mock OHLCV data - in production this would come from market_bars table
        {
          ts: Date.now() - 60000,
          o: 118600,
          h: 118650,
          l: 118580,
          c: 118620,
          v: 1000000
        },
        {
          ts: Date.now(),
          o: 118620,
          h: 118640,
          l: 118610,
          c: 118631,
          v: 1200000
        }
      ],
      micro: null, // Not implemented yet
      costs: null, // Not implemented yet
      social: featuresData.social ? {
        z: featuresData.social.z || 0,
        delta: featuresData.social.sentiment_score || 0,
        spike: featuresData.social.spike || false
      } : null,
      onchain: featuresData.onchain ? {
        gas_spike_flag: featuresData.onchain.gas_spike_flag || false,
        bias: featuresData.onchain.bias || 0
      } : null,
      macro: featuresData.macro ? {
        blackout: featuresData.macro.blackout || false
      } : null,
      regime: null, // Not fully implemented - would use vol_pct from regime detection
      provenance: {
        datasetId: featuresData.metadata?.datasetId,
        commit: 'dev-' + Date.now(),
        generatedAt: new Date().toISOString()
      }
    };

    // Get trading decision
    const decision = decide(features, null, defaultStevieConfig, score7d);
    
    const response = {
      symbol,
      timestamp: new Date().toISOString(),
      decision,
      features: {
        social_score: featuresData.social?.sentiment_score,
        social_confidence: featuresData.social?.confidence,
        onchain_bias: featuresData.onchain?.bias,
        macro_blackout: featuresData.macro?.blackout,
        regime_vol_pct: featuresData.regime?.vol_pct
      },
      config: defaultStevieConfig,
      provenance: features.provenance
    };

    console.log(`[StevieStrategy] Decision for ${symbol}: ${decision.type} (${decision.type === 'HOLD' ? decision.reason : decision.tag})`);
    
    res.json(response);
    
  } catch (error) {
    logger.error('[StevieStrategy] Decision failed', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ 
      error: 'Strategy decision failed', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

/**
 * Score a trade
 */
router.post('/score', rateLimiters.features, async (req: Request, res: Response) => {
  try {
    const { trade } = req.body;
    
    if (!trade) {
      return res.status(400).json({ error: 'Trade data is required' });
    }

    const provenance = {
      commit: 'dev-' + Date.now(),
      generatedAt: new Date().toISOString()
    };

    const score = scoreTrade(trade, defaultScoreConfig, provenance);
    
    res.json({
      trade_id: trade.symbol + '_' + trade.entryTs,
      score,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('[StevieStrategy] Trade scoring failed', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ 
      error: 'Trade scoring failed', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

/**
 * Test strategy with synthetic scenario
 */
router.post('/test', rateLimiters.features, async (req: Request, res: Response) => {
  try {
    const { scenario } = req.body;
    
    const testScenarios = {
      'breakout': {
        regime: { vol_pct: 80, trend_strength: 0.8, liquidity_tier: 1 as const },
        social: { z: 1.2, delta: 0.9, spike: false },
        onchain: { gas_spike_flag: false, bias: 0.1 },
        macro: { blackout: false }
      },
      'mean_revert': {
        regime: { vol_pct: 30, trend_strength: 0.2, liquidity_tier: 2 as const },
        social: { z: -0.5, delta: -0.2, spike: false },
        onchain: { gas_spike_flag: false, bias: -0.05 },
        macro: { blackout: false }
      },
      'blackout': {
        regime: { vol_pct: 50, trend_strength: 0.5, liquidity_tier: 2 as const },
        social: { z: 0.8, delta: 0.7, spike: false },
        onchain: { gas_spike_flag: false, bias: 0 },
        macro: { blackout: true }
      },
      'gas_spike': {
        regime: { vol_pct: 60, trend_strength: 0.6, liquidity_tier: 1 as const },
        social: { z: 0.9, delta: 0.8, spike: false },
        onchain: { gas_spike_flag: true, bias: 0.2 },
        macro: { blackout: false }
      }
    };

    const testCase = testScenarios[scenario as keyof typeof testScenarios];
    if (!testCase) {
      return res.status(400).json({ error: 'Invalid test scenario', available: Object.keys(testScenarios) });
    }

    const testFeatures = {
      bars: [
        { ts: Date.now() - 60000, o: 100, h: 102, l: 98, c: 101, v: 1000 },
        { ts: Date.now(), o: 101, h: 103, l: 99, c: 102, v: 1200 }
      ],
      micro: { spread_bps: 5, imbalance_1: 0.1, micro_vol_ewma: 0.02, trade_run_len: 3 },
      costs: { curve: [{ sizePct: 0.5, bps: 6 }] },
      ...testCase,
      provenance: {
        commit: 'test-' + Date.now(),
        generatedAt: new Date().toISOString()
      }
    };

    const decision = decide(testFeatures, null, defaultStevieConfig, 0);
    
    res.json({
      scenario,
      test_features: testCase,
      decision,
      expected_behavior: {
        'breakout': 'Should enter IOC trade with breakout sizing',
        'mean_revert': 'Should enter limit maker trade',
        'blackout': 'Should HOLD due to macro blackout',
        'gas_spike': 'Should HOLD due to gas spike'
      }[scenario],
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('[StevieStrategy] Test failed', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ 
      error: 'Strategy test failed', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

/**
 * Get current strategy configuration
 */
router.get('/config', rateLimiters.features, async (req: Request, res: Response) => {
  try {
    res.json({
      config: defaultStevieConfig,
      score_config: defaultScoreConfig,
      timestamp: new Date().toISOString(),
      provenance: {
        commit: 'config-v1.0',
        generatedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('[StevieStrategy] Config retrieval failed', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ error: 'Failed to retrieve configuration' });
  }
});

export default router;