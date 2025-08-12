
import { Router } from 'express';
import { FeatureFlagsService } from '../services/flags';
import { logger } from '../utils/logger';

const router = Router();
const featureFlags = FeatureFlagsService.getInstance();

// Get feature flags
router.get('/', (req, res) => {
  try {
    const flags = featureFlags.getFlags();
    res.json(flags);
  } catch (error) {
    logger.error('[FeatureFlags] Get flags error:', error);
    res.status(500).json({ error: 'Failed to get feature flags' });
  }
});

// Set feature flags (auth-guarded in dev)
router.post('/', (req, res) => {
  try {
    // In production, this should be properly authenticated
    const isDev = process.env.NODE_ENV === 'development';
    if (!isDev) {
      return res.status(403).json({ error: 'Feature flag modification not allowed in production' });
    }

    const newFlags = req.body;
    const success = featureFlags.setFlags(newFlags);
    
    if (success) {
      res.json({ success: true, flags: featureFlags.getFlags() });
    } else {
      res.status(500).json({ error: 'Failed to set feature flags' });
    }
  } catch (error) {
    logger.error('[FeatureFlags] Set flags error:', error);
    res.status(500).json({ error: 'Failed to set feature flags' });
  }
});

// Reset feature flag overrides
router.post('/reset', (req, res) => {
  try {
    const isDev = process.env.NODE_ENV === 'development';
    if (!isDev) {
      return res.status(403).json({ error: 'Feature flag reset not allowed in production' });
    }

    featureFlags.resetOverrides();
    res.json({ success: true, flags: featureFlags.getFlags() });
  } catch (error) {
    logger.error('[FeatureFlags] Reset flags error:', error);
    res.status(500).json({ error: 'Failed to reset feature flags' });
  }
});

export default router;
