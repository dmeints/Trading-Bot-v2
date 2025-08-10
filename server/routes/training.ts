import { Router } from 'express';
import { logger } from '../utils/logger.js';

const trainingRouter = Router();

// Import training service dynamically
let trainingEngine: any = null;

async function initializeTrainingService() {
  if (!trainingEngine) {
    try {
      const { TrainingEngine } = await import('../services/TrainingEngine.js');
      trainingEngine = new TrainingEngine();
      logger.info('[Training] TrainingEngine service initialized');
    } catch (error) {
      logger.error('[Training] Failed to initialize TrainingEngine:', error);
      throw error;
    }
  }
}

/**
 * POST /api/training/start
 * Start a new training session
 */
trainingRouter.post('/start', async (req, res) => {
  try {
    await initializeTrainingService();
    
    const { strategyId, epochs = 100, batchSize = 32, learningRate = 0.001, validationSplit = 0.2, earlyStoppingPatience = 10, hyperparameters } = req.body;
    
    if (!strategyId) {
      return res.status(400).json({
        success: false,
        error: 'Strategy ID is required'
      });
    }

    const sessionId = await trainingEngine.startTraining({
      strategyId,
      epochs,
      batchSize,
      learningRate,
      validationSplit,
      earlyStoppingPatience,
      hyperparameters
    });

    res.json({
      success: true,
      data: {
        sessionId,
        message: 'Training session started successfully'
      }
    });

  } catch (error) {
    logger.error('[Training] Error starting training:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start training session'
    });
  }
});

/**
 * GET /api/training/status/:sessionId
 * Get training session status and progress
 */
trainingRouter.get('/status/:sessionId', async (req, res) => {
  try {
    await initializeTrainingService();
    
    const { sessionId } = req.params;
    const session = await trainingEngine.getTrainingSession(sessionId);
    
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Training session not found'
      });
    }

    res.json({
      success: true,
      data: {
        session,
        progress: {
          percentage: (session.currentEpoch / session.epochs) * 100,
          estimated_remaining: session.status === 'training' ? 
            ((session.epochs - session.currentEpoch) * 2) + 's' : '0s'
        }
      }
    });

  } catch (error) {
    logger.error('[Training] Error getting training status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get training status'
    });
  }
});

/**
 * GET /api/training/sessions
 * Get all training sessions
 */
trainingRouter.get('/sessions', async (req, res) => {
  try {
    await initializeTrainingService();
    
    const sessions = await trainingEngine.getAllTrainingSessions();
    
    res.json({
      success: true,
      data: {
        sessions,
        summary: {
          total: sessions.length,
          active: sessions.filter((s: any) => s.status === 'training').length,
          completed: sessions.filter((s: any) => s.status === 'completed').length,
          failed: sessions.filter((s: any) => s.status === 'failed').length
        }
      }
    });

  } catch (error) {
    logger.error('[Training] Error getting training sessions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get training sessions'
    });
  }
});

/**
 * POST /api/training/stop/:sessionId
 * Stop a running training session
 */
trainingRouter.post('/stop/:sessionId', async (req, res) => {
  try {
    await initializeTrainingService();
    
    const { sessionId } = req.params;
    const stopped = await trainingEngine.stopTraining(sessionId);
    
    if (!stopped) {
      return res.status(400).json({
        success: false,
        error: 'Training session not found or not currently training'
      });
    }

    res.json({
      success: true,
      data: {
        sessionId,
        message: 'Training session stopped successfully'
      }
    });

  } catch (error) {
    logger.error('[Training] Error stopping training:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to stop training session'
    });
  }
});

/**
 * POST /api/training/backtest
 * Run backtesting for a strategy
 */
trainingRouter.post('/backtest', async (req, res) => {
  try {
    await initializeTrainingService();
    
    const { strategyId, startDate, endDate, initialCapital = 100000, commission = 0.001, slippage = 0.0005 } = req.body;
    
    if (!strategyId || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: 'Strategy ID, start date, and end date are required'
      });
    }

    const backtestId = await trainingEngine.runBacktest({
      strategyId,
      startDate,
      endDate,
      initialCapital,
      commission,
      slippage
    });

    res.json({
      success: true,
      data: {
        backtestId,
        message: 'Backtest completed successfully'
      }
    });

  } catch (error) {
    logger.error('[Training] Error running backtest:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to run backtest'
    });
  }
});

/**
 * GET /api/training/backtest/:backtestId
 * Get backtest results
 */
trainingRouter.get('/backtest/:backtestId', async (req, res) => {
  try {
    await initializeTrainingService();
    
    const { backtestId } = req.params;
    const result = await trainingEngine.getBacktestResult(backtestId);
    
    if (!result) {
      return res.status(404).json({
        success: false,
        error: 'Backtest result not found'
      });
    }

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    logger.error('[Training] Error getting backtest result:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get backtest result'
    });
  }
});

/**
 * GET /api/training/backtests
 * Get all backtest results
 */
trainingRouter.get('/backtests', async (req, res) => {
  try {
    await initializeTrainingService();
    
    const backtests = await trainingEngine.getAllBacktestResults();
    
    res.json({
      success: true,
      data: {
        backtests,
        summary: {
          total: backtests.length,
          avgReturn: backtests.reduce((sum: number, bt: any) => sum + bt.performance.totalReturn, 0) / backtests.length || 0,
          avgSharpe: backtests.reduce((sum: number, bt: any) => sum + bt.performance.sharpeRatio, 0) / backtests.length || 0,
          bestReturn: Math.max(...backtests.map((bt: any) => bt.performance.totalReturn), 0)
        }
      }
    });

  } catch (error) {
    logger.error('[Training] Error getting backtest results:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get backtest results'
    });
  }
});

/**
 * POST /api/training/optimize
 * Optimize strategy hyperparameters
 */
trainingRouter.post('/optimize', async (req, res) => {
  try {
    await initializeTrainingService();
    
    const { strategyId, parameterSpace } = req.body;
    
    if (!strategyId || !parameterSpace) {
      return res.status(400).json({
        success: false,
        error: 'Strategy ID and parameter space are required'
      });
    }

    const optimization = await trainingEngine.optimizeHyperparameters(strategyId, parameterSpace);

    res.json({
      success: true,
      data: optimization
    });

  } catch (error) {
    logger.error('[Training] Error optimizing hyperparameters:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to optimize hyperparameters'
    });
  }
});

/**
 * GET /api/training/is-training
 * Check if any training is currently active
 */
trainingRouter.get('/is-training', async (req, res) => {
  try {
    await initializeTrainingService();
    
    const isTraining = trainingEngine.isCurrentlyTraining();
    
    res.json({
      success: true,
      data: {
        isTraining,
        message: isTraining ? 'Training in progress' : 'No active training'
      }
    });

  } catch (error) {
    logger.error('[Training] Error checking training status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check training status'
    });
  }
});

export { trainingRouter };