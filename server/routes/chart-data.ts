
import express from 'express';
import { logger } from '../utils/logger.js';

const router = express.Router();

// Mock chart data generation
function generateChartData(points = 50) {
  const now = Date.now();
  const basePrice = 50000;
  
  return Array.from({ length: points }, (_, i) => {
    const timeOffset = (points - 1 - i) * 60000; // 1 minute intervals
    const priceVariation = (Math.random() - 0.5) * 1000;
    const price = basePrice + priceVariation + (Math.sin(i * 0.1) * 500);
    
    return {
      time: now - timeOffset,
      price: Math.round(price * 100) / 100,
      volume: Math.floor(Math.random() * 500) + 500,
      open: Math.round((price - 50) * 100) / 100,
      high: Math.round((price + Math.random() * 200) * 100) / 100,
      low: Math.round((price - Math.random() * 200) * 100) / 100,
      close: Math.round(price * 100) / 100
    };
  });
}

router.get('/chart-data', async (req, res) => {
  try {
    const points = parseInt(req.query.points as string) || 50;
    const chartData = generateChartData(points);
    
    res.json({
      success: true,
      data: chartData,
      timestamp: Date.now()
    });
  } catch (error) {
    logger.error('[ChartData] Failed to generate chart data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate chart data'
    });
  }
});

export default router;
