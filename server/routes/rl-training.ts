/**
 * RL Training API Routes
 * Endpoints for managing reinforcement learning training sessions
 */

import { Router } from 'express';
import { logger } from '../utils/logger';
import { rlAlgorithmIntegration } from '../training/rlAlgorithmIntegration';
import { stevieParameterOptimizer } from '../services/stevieParameterOptimizer';
import { stevieDecisionEngine } from '../services/stevieDecisionEngine';
import { advancedTrainingScenarios } from '../training/advancedTrainingScenarios';

const router = Router();

/**
 * Start RL training session
 * POST /api/rl-training/start
 */
router.post('/start', async (req, res) => {
  try {
    const userId = (req as any).user?.id || 'demo_user';
    const {
      maxEpisodes = 25,
      convergenceThreshold = 0.02,
      parametersToOptimize = ['volPctBreakout', 'socialGo', 'costCapBps', 'baseRiskPct']
    } = req.body;

    logger.info('[RLTraining] Starting training session request', {
      userId,
      maxEpisodes,
      parametersToOptimize
    });

    const episodeId = await rlAlgorithmIntegration.startTrainingSession(userId, {
      maxEpisodes,
      convergenceThreshold,
      parametersToOptimize
    });

    res.json({
      success: true,
      data: {
        episodeId,
        status: 'training_started',
        config: {
          maxEpisodes,
          convergenceThreshold,
          parametersToOptimize
        }
      }
    });

  } catch (error) {
    logger.error('[RLTraining] Failed to start training session', { error });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get training status
 * GET /api/rl-training/status
 */
router.get('/status', async (req, res) => {
  try {
    const status = rlAlgorithmIntegration.getTrainingStatus();
    const currentConfig = stevieDecisionEngine.getCurrentConfiguration();
    const optimizationHistory = stevieParameterOptimizer.getOptimizationHistory();

    res.json({
      success: true,
      data: {
        training: status,
        currentAlgorithmConfig: currentConfig,
        recentOptimizations: optimizationHistory.slice(-5), // Last 5 sessions
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('[RLTraining] Failed to get status', { error });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Stop training session
 * POST /api/rl-training/stop
 */
router.post('/stop', async (req, res) => {
  try {
    await rlAlgorithmIntegration.stopTraining();

    res.json({
      success: true,
      data: {
        status: 'training_stopped',
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('[RLTraining] Failed to stop training', { error });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get optimization targets
 * GET /api/rl-training/targets
 */
router.get('/targets', async (req, res) => {
  try {
    const targets = stevieParameterOptimizer.generateOptimizationTargets();
    const currentConfig = stevieDecisionEngine.getCurrentConfiguration();

    res.json({
      success: true,
      data: {
        optimizationTargets: targets,
        currentConfiguration: currentConfig,
        availableParameters: Object.keys(currentConfig),
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('[RLTraining] Failed to get optimization targets', { error });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Manual parameter update
 * POST /api/rl-training/update-parameter
 */
router.post('/update-parameter', async (req, res) => {
  try {
    const { parameter, value, reason = 'manual_update' } = req.body;

    if (!parameter || value === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Parameter and value are required'
      });
    }

    // Validate parameter exists in current config
    const currentConfig = stevieDecisionEngine.getCurrentConfiguration();
    if (!(parameter in currentConfig)) {
      return res.status(400).json({
        success: false,
        error: `Parameter '${parameter}' not found in current configuration`
      });
    }

    const oldValue = currentConfig[parameter];
    
    // Update configuration
    stevieDecisionEngine.updateConfiguration({ [parameter]: value });

    logger.info('[RLTraining] Manual parameter update', {
      parameter,
      oldValue,
      newValue: value,
      reason
    });

    res.json({
      success: true,
      data: {
        parameter,
        oldValue,
        newValue: value,
        reason,
        updatedConfig: stevieDecisionEngine.getCurrentConfiguration(),
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('[RLTraining] Failed to update parameter', { error });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get algorithm performance metrics
 * GET /api/rl-training/performance/:symbol
 */
router.get('/performance/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    
    const algorithmMetrics = stevieDecisionEngine.getAlgorithmMetrics(symbol);
    const recentMetrics = stevieDecisionEngine.getRecentPerformanceMetrics(symbol);
    const decisionHistory = stevieDecisionEngine.getDecisionHistory(symbol);

    res.json({
      success: true,
      data: {
        symbol,
        algorithmMetrics,
        recentMetrics,
        decisionHistory: decisionHistory.slice(-10), // Last 10 decisions
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('[RLTraining] Failed to get performance metrics', { error, symbol: req.params.symbol });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Reset algorithm configuration to defaults
 * POST /api/rl-training/reset
 */
router.post('/reset', async (req, res) => {
  try {
    const { defaultStevieConfig } = await import('../../shared/src/stevie/config');
    
    stevieDecisionEngine.updateConfiguration(defaultStevieConfig);

    logger.info('[RLTraining] Reset configuration to defaults');

    res.json({
      success: true,
      data: {
        message: 'Configuration reset to defaults',
        configuration: defaultStevieConfig,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('[RLTraining] Failed to reset configuration', { error });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get available training scenarios
 * GET /api/rl-training/scenarios
 */
router.get('/scenarios', async (req, res) => {
  try {
    const scenarios = advancedTrainingScenarios.getAvailableScenarios();
    const currentScenario = advancedTrainingScenarios.getCurrentScenario();
    const recommendation = await advancedTrainingScenarios.recommendScenario();

    res.json({
      success: true,
      data: {
        availableScenarios: scenarios,
        currentScenario,
        recommendation,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('[RLTraining] Failed to get scenarios', { error });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Start a predefined training scenario
 * POST /api/rl-training/scenarios/:scenarioId/start
 */
router.post('/scenarios/:scenarioId/start', async (req, res) => {
  try {
    const { scenarioId } = req.params;
    const userId = (req as any).user?.id || 'demo_user';

    const result = await advancedTrainingScenarios.startScenario(scenarioId, userId);

    if (result.success) {
      res.json({
        success: true,
        data: {
          episodeId: result.episodeId,
          scenario: result.scenario,
          message: `Started scenario: ${result.scenario?.name}`,
          timestamp: new Date().toISOString()
        }
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error
      });
    }

  } catch (error) {
    logger.error('[RLTraining] Failed to start scenario', { scenarioId: req.params.scenarioId, error });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Stop current scenario
 * POST /api/rl-training/scenarios/stop
 */
router.post('/scenarios/stop', async (req, res) => {
  try {
    const result = await advancedTrainingScenarios.stopCurrentScenario();

    if (result.success) {
      res.json({
        success: true,
        data: {
          report: result.report,
          message: 'Scenario stopped successfully',
          timestamp: new Date().toISOString()
        }
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error
      });
    }

  } catch (error) {
    logger.error('[RLTraining] Failed to stop scenario', { error });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get scenario results
 * GET /api/rl-training/scenarios/results/:scenarioId?
 */
router.get('/scenarios/results/:scenarioId?', async (req, res) => {
  try {
    const { scenarioId } = req.params;
    const results = advancedTrainingScenarios.getScenarioResults(scenarioId);

    res.json({
      success: true,
      data: {
        results,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('[RLTraining] Failed to get scenario results', { error });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;