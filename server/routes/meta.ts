
import express from 'express';
import { logger } from '../utils/logger';

const router = express.Router();

// Mock meta-monitor state
let metaState = {
  routerPrior: 0.5,
  sizingCap: 0.05,
  lastNudges: null as any,
  qualityHistory: [] as any[]
};

// GET /api/meta/quality
router.get('/quality', async (req, res) => {
  try {
    // Dynamic quality metrics that change over time
    const baseTime = Date.now();
    const qualityCycle = Math.sin(baseTime / (1000 * 60 * 2)) * 0.1; // 2-min cycle
    const driftCycle = Math.abs(Math.cos(baseTime / (1000 * 90))) * 0.15; // 90-sec drift cycle
    
    const quality = {
      dataQuality: 0.94 + qualityCycle,
      modelDrift: 0.12 + driftCycle,
      featureDrift: 0.08 + (driftCycle * 0.5),
      brierScore: 0.25 + Math.abs(qualityCycle) * 0.1,
      regretVsHold: 0.01 + driftCycle * 0.02,
      calibration: 0.8 - Math.abs(qualityCycle) * 0.2,
      reliability: 0.75 + qualityCycle * 0.1,
      nudges: generateDynamicNudges(qualityCycle, driftCycle),
      currentPriors: {
        routerPrior: metaState.routerPrior,
        sizingCap: metaState.sizingCap
      },
      bounds: {
        maxRouterPriorDelta: 0.05,
        maxSizingCapDelta: 0.02,
        nudgeFrequencyMin: 30 // seconds
      },
      lastUpdate: new Date().toISOString()
    };
    
    // Store in history
    metaState.qualityHistory.push({
      timestamp: Date.now(),
      quality: quality.dataQuality,
      drift: quality.modelDrift
    });
    
    // Keep only recent history
    if (metaState.qualityHistory.length > 50) {
      metaState.qualityHistory = metaState.qualityHistory.slice(-50);
    }
    
    res.json(quality);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// POST /api/meta/apply-nudges
router.post('/apply-nudges', async (req, res) => {
  try {
    const { nudges } = req.body;
    
    if (!nudges || !Array.isArray(nudges)) {
      return res.status(400).json({ error: 'Invalid nudges format' });
    }

    const results = [];
    let appliedCount = 0;

    for (const nudge of nudges) {
      const result = applyNudgeWithBounds(nudge);
      results.push(result);
      if (result.applied) appliedCount++;
    }

    metaState.lastNudges = {
      timestamp: Date.now(),
      nudges: results,
      appliedCount
    };

    logger.info('[MetaMonitor] Applied nudges', {
      total: nudges.length,
      applied: appliedCount,
      newRouterPrior: metaState.routerPrior,
      newSizingCap: metaState.sizingCap
    });

    res.json({
      success: true,
      applied: appliedCount,
      total: nudges.length,
      results,
      newState: {
        routerPrior: metaState.routerPrior,
        sizingCap: metaState.sizingCap
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('[MetaMonitor] Error applying nudges:', error);
    res.status(500).json({ error: String(error) });
  }
});

/**
 * Generate dynamic nudges based on quality cycles
 */
function generateDynamicNudges(qualityCycle: number, driftCycle: number) {
  const nudges = [];
  
  // Router prior adjustment based on quality
  if (Math.abs(qualityCycle) > 0.05) {
    nudges.push({
      type: 'router_prior',
      current: metaState.routerPrior,
      suggested: metaState.routerPrior + (qualityCycle > 0 ? 0.02 : -0.02),
      reason: qualityCycle > 0 ? 'quality_improving' : 'quality_degrading',
      urgency: Math.abs(qualityCycle) > 0.08 ? 'high' : 'medium'
    });
  }
  
  // Sizing cap adjustment based on drift
  if (driftCycle > 0.1) {
    nudges.push({
      type: 'sizing_cap',
      current: metaState.sizingCap,
      suggested: Math.max(0.01, metaState.sizingCap - 0.01),
      reason: 'high_model_drift',
      urgency: driftCycle > 0.13 ? 'high' : 'medium'
    });
  }
  
  return nudges;
}

/**
 * Apply nudge with bounds checking
 */
function applyNudgeWithBounds(nudge: any) {
  const maxRouterPriorDelta = 0.05;
  const maxSizingCapDelta = 0.02;
  const minRouterPrior = 0.1;
  const maxRouterPrior = 0.9;
  const minSizingCap = 0.01;
  const maxSizingCap = 0.1;

  let applied = false;
  let reason = '';
  let newValue = null;

  try {
    if (nudge.type === 'router_prior') {
      const delta = nudge.suggested - metaState.routerPrior;
      const boundedDelta = Math.max(-maxRouterPriorDelta, Math.min(maxRouterPriorDelta, delta));
      newValue = Math.max(minRouterPrior, Math.min(maxRouterPrior, metaState.routerPrior + boundedDelta));
      
      if (Math.abs(boundedDelta) > 0.001) {
        metaState.routerPrior = newValue;
        applied = true;
        reason = `Applied bounded delta: ${boundedDelta.toFixed(4)}`;
      } else {
        reason = 'Delta too small after bounding';
      }
    } 
    else if (nudge.type === 'sizing_cap') {
      const delta = nudge.suggested - metaState.sizingCap;
      const boundedDelta = Math.max(-maxSizingCapDelta, Math.min(maxSizingCapDelta, delta));
      newValue = Math.max(minSizingCap, Math.min(maxSizingCap, metaState.sizingCap + boundedDelta));
      
      if (Math.abs(boundedDelta) > 0.001) {
        metaState.sizingCap = newValue;
        applied = true;
        reason = `Applied bounded delta: ${boundedDelta.toFixed(4)}`;
      } else {
        reason = 'Delta too small after bounding';
      }
    } 
    else {
      reason = 'Unknown nudge type';
    }
  } catch (error) {
    reason = `Error: ${error.message}`;
  }

  return {
    type: nudge.type,
    applied,
    reason,
    originalValue: nudge.current,
    suggestedValue: nudge.suggested,
    appliedValue: newValue,
    bounded: applied && Math.abs(nudge.suggested - newValue) > 0.001
  };
}

export default router;
import express from 'express';
import { metaMonitor } from '../services/MetaMonitor.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

router.get('/quality', (req, res) => {
  try {
    const quality = metaMonitor.getQualityMetrics();
    res.json(quality);
  } catch (error) {
    logger.error('Error getting quality metrics:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: String(error)
    });
  }
});

router.post('/apply-nudges', (req, res) => {
  try {
    const result = metaMonitor.applyNudges();
    res.json(result);
  } catch (error) {
    logger.error('Error applying nudges:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: String(error)
    });
  }
});

export default router;
