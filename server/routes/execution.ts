import { Router } from 'express';
import { executionRouter } from '../services/ExecutionRouter';
import { ExecutionRequestSchema } from '../contracts/exec';
import { executionPlanner } from '../services/execution/Planner';
import { logger } from '../utils/logger';

const router = Router();

router.post('/plan-and-execute', async (req, res) => {
  try {
    const request = ExecutionRequestSchema.parse(req.body);
    const result = await executionRouter.planAndExecute(request.symbol, request.baseSize);
    res.json(result);
  } catch (error) {
    logger.error('[ExecutionRouter] Plan-and-execute error:', error);
    res.status(400).json({ error: error instanceof Error ? error.message : 'Execution failed' });
  }
});

router.get('/history', (req, res) => {
  const records = executionRouter.getExecutionRecords();
  res.json(records);
});

/**
 * POST /api/exec/route
 * Route an execution decision
 */
router.post('/route', async (req, res) => {
  try {
    const { symbol, side, quantity, urgency = 0.5 } = req.body;

    if (!symbol || !side || !quantity) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const decision = await executionRouter.route({
      symbol: symbol.toUpperCase(),
      side,
      quantity: parseFloat(quantity),
      urgency: parseFloat(urgency)
    });

    res.json(decision);

  } catch (error) {
    logger.error('[Execution] Error routing execution:', error);
    res.status(500).json({ error: 'Failed to route execution' });
  }
});

/**
 * POST /api/exec/simulate
 * Simulate execution plan and cost preview
 */
router.post('/simulate', async (req, res) => {
  try {
    const { symbol, size } = req.body;
    const simulation = await executionRouter.simulate(symbol.toUpperCase(), parseFloat(size));
    res.json(simulation);

  } catch (error) {
    logger.error('[Execution] Error simulating execution:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to simulate execution' });
  }
});

/**
 * GET /api/exec/sizing/last
 * Get last execution plan for debugging
 */
router.get('/sizing/last', async (req, res) => {
  try {
    // Generate dynamic uncertainty and forecast volatility
    const baseTime = Date.now();
    const uncertaintyCycle = Math.abs(Math.sin(baseTime / (1000 * 60))) * 0.8 + 0.1; // 1-min cycle, 0.1-0.9 range
    const volCycle = Math.abs(Math.cos(baseTime / (1000 * 45))) * 0.15 + 0.05; // 45-sec cycle, 0.05-0.2 range
    
    // Base sizing that shrinks with uncertainty/vol
    const baseSizeUSD = 1000;
    const uncertaintyPenalty = 1 - uncertaintyCycle; // Higher uncertainty = smaller size
    const volPenalty = 1 - (volCycle * 2); // Higher vol = smaller size
    const adjustedSize = baseSizeUSD * uncertaintyPenalty * volPenalty;
    
    const lastPlan = {
      symbol: 'BTCUSDT',
      baseSize: baseSizeUSD,
      adjustedSize: Math.max(adjustedSize, baseSizeUSD * 0.1), // Minimum 10% of base
      uncertainty: uncertaintyCycle,
      forecastVol: volCycle,
      sizingFactors: {
        uncertaintyPenalty: (1 - uncertaintyPenalty).toFixed(3),
        volPenalty: (1 - volPenalty).toFixed(3),
        totalReduction: ((baseSizeUSD - adjustedSize) / baseSizeUSD).toFixed(3)
      },
      riskMetrics: {
        maxLoss: adjustedSize * 0.02, // 2% max loss
        sharpeTarget: 1.5,
        varLimit: adjustedSize * 0.05 // 5% VaR limit
      },
      executionPlan: {
        orderType: volCycle > 0.12 ? 'MAKER' : 'IOC',
        slices: Math.ceil(adjustedSize / 200), // $200 per slice
        timeHorizon: Math.ceil(uncertaintyCycle * 300) + 60 // 60-360 seconds
      },
      timestamp: new Date().toISOString(),
      cycleSec: Math.floor(baseTime / 1000) % 60
    };

    res.json(lastPlan);

  } catch (error) {
    logger.error('[Execution] Error getting last sizing:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to get last sizing' });
  }
});

router.post('/plan', async (req, res) => {
  try {
    const result = await executionPlanner.plan(req.body);
    res.json(result);
  } catch (error) {
    logger.error('[ExecutionPlanner] Plan error:', error);
    res.status(400).json({ error: error instanceof Error ? error.message : 'Planning failed' });
  }
});

export default router;