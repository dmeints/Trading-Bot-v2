import { Router } from 'express';
import { featureFlagService } from '../services/featureFlags';
import { isAuthenticated } from '../replitAuth';
import { adminAuthGuard, AdminRequest } from '../middleware/adminAuth';
import { rateLimiters } from '../middleware/rateLimiter';

const router = Router();

// Check if a feature flag is enabled for the current user
router.get('/check/:flagId', isAuthenticated, async (req: any, res) => {
  try {
    const { flagId } = req.params;
    const userId = req.user.claims.sub;
    const environment = process.env.NODE_ENV || 'development';

    const enabled = await featureFlagService.isEnabled(flagId, userId, environment);
    res.json({ flagId, enabled });
  } catch (error) {
    console.error('[FeatureFlags] Error checking flag:', error);
    res.status(500).json({ error: 'Failed to check feature flag' });
  }
});

// Get all feature flags (admin only)
router.get('/all', rateLimiters.admin, adminAuthGuard, async (req: AdminRequest, res) => {
  try {
    const flags = await featureFlagService.getAllFlags();
    res.json(flags);
  } catch (error) {
    console.error('[FeatureFlags] Error getting all flags:', error);
    res.status(500).json({ error: 'Failed to get feature flags' });
  }
});

// Get a specific feature flag (admin only)
router.get('/:flagId', rateLimiters.admin, adminAuthGuard, async (req: AdminRequest, res) => {
  try {
    const { flagId } = req.params;
    const flag = await featureFlagService.getFlag(flagId);
    
    if (!flag) {
      return res.status(404).json({ error: 'Feature flag not found' });
    }
    
    res.json(flag);
  } catch (error) {
    console.error('[FeatureFlags] Error getting flag:', error);
    res.status(500).json({ error: 'Failed to get feature flag' });
  }
});

// Create a new feature flag (admin only)
router.post('/', rateLimiters.admin, adminAuthGuard, async (req: AdminRequest, res) => {
  try {
    const { name, description, enabled, rolloutPercentage, userGroups, environments } = req.body;
    
    if (!name || !description) {
      return res.status(400).json({ error: 'Name and description are required' });
    }

    const flagId = await featureFlagService.createFlag({
      name,
      description,
      enabled: enabled !== undefined ? enabled : true,
      rolloutPercentage: rolloutPercentage || 100,
      userGroups: userGroups || [],
      environments: environments || ['development', 'production']
    });

    res.json({ success: true, flagId });
  } catch (error) {
    console.error('[FeatureFlags] Error creating flag:', error);
    res.status(500).json({ error: 'Failed to create feature flag' });
  }
});

// Update a feature flag (admin only)
router.put('/:flagId', rateLimiters.admin, adminAuthGuard, async (req: AdminRequest, res) => {
  try {
    const { flagId } = req.params;
    const updates = req.body;
    
    const success = await featureFlagService.updateFlag(flagId, updates);
    
    if (!success) {
      return res.status(404).json({ error: 'Feature flag not found' });
    }
    
    res.json({ success: true, message: 'Feature flag updated' });
  } catch (error) {
    console.error('[FeatureFlags] Error updating flag:', error);
    res.status(500).json({ error: 'Failed to update feature flag' });
  }
});

// Toggle a feature flag (admin only)
router.post('/:flagId/toggle', rateLimiters.admin, adminAuthGuard, async (req: AdminRequest, res) => {
  try {
    const { flagId } = req.params;
    const success = await featureFlagService.toggleFlag(flagId);
    
    if (!success) {
      return res.status(404).json({ error: 'Feature flag not found' });
    }
    
    const flag = await featureFlagService.getFlag(flagId);
    res.json({ 
      success: true, 
      message: `Feature flag ${flag?.enabled ? 'enabled' : 'disabled'}`,
      enabled: flag?.enabled
    });
  } catch (error) {
    console.error('[FeatureFlags] Error toggling flag:', error);
    res.status(500).json({ error: 'Failed to toggle feature flag' });
  }
});

// Set rollout percentage (admin only)
router.put('/:flagId/rollout', rateLimiters.admin, adminAuthGuard, async (req: AdminRequest, res) => {
  try {
    const { flagId } = req.params;
    const { percentage } = req.body;
    
    if (percentage === undefined || percentage < 0 || percentage > 100) {
      return res.status(400).json({ error: 'Percentage must be between 0 and 100' });
    }
    
    const success = await featureFlagService.setRolloutPercentage(flagId, percentage);
    
    if (!success) {
      return res.status(404).json({ error: 'Feature flag not found' });
    }
    
    res.json({ success: true, message: `Rollout percentage set to ${percentage}%` });
  } catch (error) {
    console.error('[FeatureFlags] Error setting rollout:', error);
    res.status(500).json({ error: 'Failed to set rollout percentage' });
  }
});

// Delete a feature flag (admin only)
router.delete('/:flagId', rateLimiters.admin, adminAuthGuard, async (req: AdminRequest, res) => {
  try {
    const { flagId } = req.params;
    const success = await featureFlagService.deleteFlag(flagId);
    
    if (!success) {
      return res.status(404).json({ error: 'Feature flag not found' });
    }
    
    res.json({ success: true, message: 'Feature flag deleted' });
  } catch (error) {
    console.error('[FeatureFlags] Error deleting flag:', error);
    res.status(500).json({ error: 'Failed to delete feature flag' });
  }
});

// Batch check multiple feature flags
router.post('/batch-check', isAuthenticated, async (req: any, res) => {
  try {
    const { flagIds } = req.body;
    const userId = req.user.claims.sub;
    const environment = process.env.NODE_ENV || 'development';

    if (!Array.isArray(flagIds)) {
      return res.status(400).json({ error: 'flagIds must be an array' });
    }

    const results: { [key: string]: boolean } = {};
    
    for (const flagId of flagIds) {
      results[flagId] = await featureFlagService.isEnabled(flagId, userId, environment);
    }

    res.json({ results });
  } catch (error) {
    console.error('[FeatureFlags] Error batch checking flags:', error);
    res.status(500).json({ error: 'Failed to batch check feature flags' });
  }
});

export default router;