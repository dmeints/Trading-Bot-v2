/**
 * Router Snapshot Routes
 */

import { Router } from 'express';
import { strategyRouter } from '../services/StrategyRouter';
import { logger } from '../utils/logger';

const router = Router();

/**
 * GET /api/router-snapshot
 * Get the last router decision with context and feature vector
 */
router.get('/', (req, res) => {
  try {
    const snapshot = strategyRouter.getLastDecision();

    if (!snapshot) {
      return res.status(404).json({ error: 'No router decisions recorded' });
    }

    // Extract feature vector from context for audit
    const featureVector = extractFeatureVector(snapshot.context);

    const enhancedSnapshot = {
      ...snapshot,
      feature_vector: featureVector,
      decision_metadata: {
        sampled_scores: snapshot.scores ? Object.fromEntries(snapshot.scores) : {},
        feature_count: Object.keys(featureVector).length,
        has_alpha_features: hasAlphaFeatures(featureVector)
      }
    };

    res.json(enhancedSnapshot);
  } catch (error) {
    logger.error('[RouterSnapshot] Error getting snapshot:', error);
    res.status(500).json({ error: 'Failed to get router snapshot' });
  }
});

/**
 * Extract feature vector from router context
 */
function extractFeatureVector(context: any): Record<string, number> {
  const features: Record<string, number> = {};

  // Basic features
  if (typeof context.price === 'number') features.price = context.price;
  if (typeof context.volume === 'number') features.volume = context.volume;
  if (typeof context.volatility === 'number') features.volatility = context.volatility;

  // Alpha pack features
  if (typeof context.obi === 'number') features.obi = context.obi;
  if (typeof context.ti === 'number') features.ti = context.ti;
  if (typeof context.spread_bps === 'number') features.spread_bps = context.spread_bps;
  if (typeof context.micro_vol === 'number') features.micro_vol = context.micro_vol;
  if (typeof context.sigmaHAR === 'number') features.sigmaHAR = context.sigmaHAR;
  if (typeof context.sigmaGARCH === 'number') features.sigmaGARCH = context.sigmaGARCH;
  if (typeof context.rr25 === 'number') features.rr25 = context.rr25;
  if (typeof context.fly25 === 'number') features.fly25 = context.fly25;
  if (typeof context.iv_term_slope === 'number') features.iv_term_slope = context.iv_term_slope;
  if (typeof context.skew_z === 'number') features.skew_z = context.skew_z;

  return features;
}

/**
 * Check if feature vector contains alpha features
 */
function hasAlphaFeatures(features: Record<string, number>): boolean {
  const alphaFeatureKeys = ['obi', 'ti', 'spread_bps', 'micro_vol', 'sigmaHAR', 'sigmaGARCH', 'rr25', 'fly25'];
  return alphaFeatureKeys.some(key => key in features);
}

export default router;