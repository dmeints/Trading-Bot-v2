/**
 * Transfer Learning API Routes
 * Endpoints for jumpstarting training with pre-trained models
 */

import { Router } from 'express';
import { logger } from '../utils/logger.js';
import { transferLearningManager } from '../training/transferLearning';

export const transferLearningRouter = Router();

/**
 * GET /api/transfer-learning/models
 * Get available pre-trained models
 */
transferLearningRouter.get('/models', async (req, res) => {
  try {
    const models = transferLearningManager.getAvailableModels();
    const recommended = transferLearningManager.getRecommendedModel();

    res.json({
      success: true,
      data: {
        models,
        recommended: recommended?.name,
        count: models.length,
        categories: {
          academic: models.filter(m => m.source === 'academic').length,
          industry: models.filter(m => m.source === 'industry').length,
          community: models.filter(m => m.source === 'community').length
        }
      }
    });

  } catch (error) {
    logger.error('[TransferLearning] Failed to get available models', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve available models'
    });
  }
});

/**
 * POST /api/transfer-learning/start
 * Start transfer learning from a pre-trained model
 */
transferLearningRouter.post('/start', async (req, res) => {
  try {
    const { 
      modelName, 
      transferType = 'fast_transfer',
      customConfig 
    } = req.body;

    if (!modelName) {
      return res.status(400).json({
        success: false,
        error: 'Model name is required'
      });
    }

    logger.info('[TransferLearning] Starting transfer learning request', {
      modelName,
      transferType
    });

    // Start transfer learning (async)
    transferLearningManager.startTransferLearning(modelName, transferType)
      .then(result => {
        logger.info('[TransferLearning] Transfer learning completed successfully', {
          modelName,
          improvement: result.improvement,
          trainingTime: result.trainingTime
        });
      })
      .catch(error => {
        logger.error('[TransferLearning] Transfer learning failed', {
          modelName,
          error
        });
      });

    res.json({
      success: true,
      message: 'Transfer learning started successfully',
      data: {
        modelName,
        transferType,
        estimatedDuration: transferType === 'fast_transfer' ? '10-20 minutes' :
                           transferType === 'deep_transfer' ? '30-60 minutes' :
                           '15-30 minutes',
        status: 'transfer_learning_started'
      }
    });

  } catch (error) {
    logger.error('[TransferLearning] Failed to start transfer learning', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to start transfer learning'
    });
  }
});

/**
 * GET /api/transfer-learning/recommended
 * Get recommended pre-trained model for quick start
 */
transferLearningRouter.get('/recommended', async (req, res) => {
  try {
    const recommended = transferLearningManager.getRecommendedModel();

    if (!recommended) {
      return res.status(404).json({
        success: false,
        error: 'No recommended models available'
      });
    }

    res.json({
      success: true,
      data: {
        model: recommended,
        reasoning: 'Highest Sharpe ratio with transferable architecture',
        quickStartOptions: [
          {
            type: 'fast_transfer',
            duration: '10-20 minutes',
            description: 'Quick adaptation with frozen base layers'
          },
          {
            type: 'deep_transfer',
            duration: '30-60 minutes',
            description: 'Full fine-tuning for maximum performance'
          }
        ]
      }
    });

  } catch (error) {
    logger.error('[TransferLearning] Failed to get recommended model', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to get recommended model'
    });
  }
});

/**
 * POST /api/transfer-learning/quick-start
 * One-click start with recommended model and optimal settings
 */
transferLearningRouter.post('/quick-start', async (req, res) => {
  try {
    const recommended = transferLearningManager.getRecommendedModel();

    if (!recommended) {
      return res.status(404).json({
        success: false,
        error: 'No recommended models available for quick start'
      });
    }

    logger.info('[TransferLearning] Starting quick-start transfer learning', {
      recommendedModel: recommended.name
    });

    // Start with fast transfer for quick results
    transferLearningManager.startTransferLearning(recommended.name, 'fast_transfer')
      .then(result => {
        logger.info('[TransferLearning] Quick-start completed successfully', {
          model: recommended.name,
          improvement: result.improvement
        });
      })
      .catch(error => {
        logger.error('[TransferLearning] Quick-start failed', { error });
      });

    res.json({
      success: true,
      message: 'Quick-start transfer learning initiated',
      data: {
        baseModel: recommended.name,
        basePerformance: recommended.performance,
        transferType: 'fast_transfer',
        estimatedDuration: '10-20 minutes',
        expectedImprovement: '20-40% over baseline',
        status: 'quick_start_initiated'
      }
    });

  } catch (error) {
    logger.error('[TransferLearning] Quick-start failed', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to start quick-start transfer learning'
    });
  }
});