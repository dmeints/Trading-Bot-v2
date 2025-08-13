
/**
 * Volatility Forecast API Routes
 */

import { Router } from 'express';
import { volatilityModels } from '../services/volatility/Models';
import { logger } from '../utils/logger';

const router = Router();

/**
 * GET /api/vol/forecast/:symbol?h=60
 * Get volatility forecast for symbol and horizon
 */
router.get('/forecast/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const horizonMins = parseInt(req.query.h as string) || 60;
    
    if (horizonMins < 1 || horizonMins > 10080) { // 1 minute to 1 week
      return res.status(400).json({ error: 'Horizon must be between 1 and 10080 minutes' });
    }

    const forecast = await volatilityModels.forecastVol(symbol.toUpperCase(), horizonMins);
    res.json(forecast);

  } catch (error) {
    logger.error('[Vol] Error getting forecast:', error);
    res.status(500).json({ error: 'Failed to get volatility forecast' });
  }
});

/**
 * GET /api/vol/cache/:symbol
 * Get cached forecast for symbol
 */
router.get('/cache/:symbol', (req, res) => {
  try {
    const { symbol } = req.params;
    const horizonMins = parseInt(req.query.h as string) || 60;
    
    const forecast = volatilityModels.getForecast(symbol.toUpperCase(), horizonMins);
    
    if (!forecast) {
      return res.status(404).json({ error: 'No cached forecast found' });
    }
    
    res.json(forecast);

  } catch (error) {
    logger.error('[Vol] Error getting cached forecast:', error);
    res.status(500).json({ error: 'Failed to get cached forecast' });
  }
});

/**
 * DELETE /api/vol/cache/:symbol
 * Clear cache for symbol
 */
router.delete('/cache/:symbol', (req, res) => {
  try {
    const { symbol } = req.params;
    volatilityModels.clearCache(symbol.toUpperCase());
    res.json({ success: true });

  } catch (error) {
    logger.error('[Vol] Error clearing cache:', error);
    res.status(500).json({ error: 'Failed to clear cache' });
  }
});

export default router;
import { Router } from 'express';
import { volatilityModels } from '../services/volatility/Models.js';
import { logger } from '../utils/logger.js';

const router = Router();

/**
 * GET /api/vol/forecast/:symbol?h=horizonMins
 * Get volatility forecast for symbol
 */
router.get('/forecast/:symbol', (req, res) => {
  try {
    const { symbol } = req.params;
    const horizonMins = parseInt(req.query.h as string || '60', 10);
    
    if (horizonMins <= 0 || horizonMins > 1440) {
      return res.status(400).json({ error: 'Horizon must be between 1 and 1440 minutes' });
    }

    // Try to get real forecast, fallback to mock
    let forecast = volatilityModels.forecastVol(symbol.toUpperCase(), horizonMins);
    
    // If no real data, generate mock
    if (forecast.sigmaHAR === 0.02 && forecast.sigmaGARCH === 0.02) {
      forecast = volatilityModels.generateMockForecast(symbol.toUpperCase(), horizonMins);
    }
    
    res.json(forecast);
  } catch (error) {
    logger.error('[VolRoutes] Error forecasting volatility:', error);
    res.status(500).json({ error: 'Failed to forecast volatility' });
  }
});

export default router;
