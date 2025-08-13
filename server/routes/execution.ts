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
    const lastPlan = executionPlanner.getLastPlan();

    if (!lastPlan) {
      return res.status(404).json({ error: 'No execution plans found' });
    }

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