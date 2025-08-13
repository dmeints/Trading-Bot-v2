import { Router } from 'express';
import { executionRouter } from '../services/ExecutionRouter.js';
import { ExecutionRequestSchema } from '../contracts/exec.js';
import { executionPlanner } from '../services/execution/Planner.js';
import { logger } from '../utils/logger.js';

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

router.get('/sizing/last', (req, res) => {
  const sizing = executionRouter.getLastSizing();
  res.json(sizing);
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