import { Router } from 'express';
import { MLOpsService } from '../services/mlopsService';
import { triggerMarketInsightRetraining, triggerRiskAssessorRetraining, triggerDriftDetection, getJobStatus } from '../jobs/retrainingCron';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { logger } from '../utils/logger';

const router = Router();
const mlopsService = MLOpsService.getInstance();

// Model retraining endpoints
router.post('/retrain', async (req, res) => {
  try {
    const { agent_type } = req.body;
    
    if (!agent_type || !['market_insight', 'risk_assessor'].includes(agent_type)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid agent_type. Must be market_insight or risk_assessor' 
      });
    }

    logger.info('Manual retraining triggered', { agent_type, user: req.user?.claims?.sub });
    
    const result = await mlopsService.runRetrainingPipeline(agent_type);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Manual retraining failed', { error });
    res.status(500).json({
      success: false,
      error: 'Retraining failed'
    });
  }
});

// Get model runs
router.get('/model-runs', async (req, res) => {
  try {
    const { agent_type, status, limit = 50 } = req.query;
    
    let query = sql`
      SELECT * FROM model_runs
      WHERE 1=1
    `;
    
    if (agent_type) {
      query = sql`${query} AND agent_type = ${agent_type}`;
    }
    
    if (status) {
      query = sql`${query} AND status = ${status}`;
    }
    
    query = sql`${query} ORDER BY created_at DESC LIMIT ${parseInt(limit as string)}`;
    
    const result = await db.execute(query);
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    logger.error('Failed to fetch model runs', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch model runs'
    });
  }
});

// Get specific model run
router.get('/model-runs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await db.execute(sql`
      SELECT * FROM model_runs WHERE run_id = ${id}
    `);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Model run not found'
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    logger.error('Failed to fetch model run', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch model run'
    });
  }
});

// Hyperparameter sweep endpoints
router.post('/sweep', async (req, res) => {
  try {
    const { agent_type, parameter_grid, name } = req.body;
    
    if (!agent_type || !parameter_grid) {
      return res.status(400).json({
        success: false,
        error: 'agent_type and parameter_grid are required'
      });
    }
    
    logger.info('Hyperparameter sweep triggered', { 
      agent_type, 
      parameter_grid, 
      user: req.user?.claims?.sub 
    });
    
    const sweepId = await mlopsService.runHyperparameterSweep(agent_type, parameter_grid);
    
    // Create sweep record
    await db.execute(sql`
      INSERT INTO hyperparameter_sweeps (
        id, name, agent_type, parameter_grid, status, total_configurations, created_by
      ) VALUES (
        ${sweepId}, 
        ${name || `Sweep-${Date.now()}`}, 
        ${agent_type}, 
        ${JSON.stringify(parameter_grid)}, 
        'running',
        ${Object.values(parameter_grid).reduce((acc: number, arr: any) => acc * arr.length, 1)},
        ${req.user?.claims?.sub || 'unknown'}
      )
    `);
    
    res.json({
      success: true,
      data: { sweep_id: sweepId }
    });
  } catch (error) {
    logger.error('Hyperparameter sweep failed', { error });
    res.status(500).json({
      success: false,
      error: 'Hyperparameter sweep failed'
    });
  }
});

// Get sweep results
router.get('/sweep-results', async (req, res) => {
  try {
    const { sweep_id, agent_type, limit = 100 } = req.query;
    
    let query = sql`
      SELECT sr.*, hs.name as sweep_name
      FROM sweep_results sr
      LEFT JOIN hyperparameter_sweeps hs ON sr.sweep_id = hs.id
      WHERE 1=1
    `;
    
    if (sweep_id) {
      query = sql`${query} AND sr.sweep_id = ${sweep_id}`;
    }
    
    if (agent_type) {
      query = sql`${query} AND sr.agent_type = ${agent_type}`;
    }
    
    query = sql`${query} ORDER BY (sr.metrics->>'sharpe_ratio')::float DESC NULLS LAST LIMIT ${parseInt(limit as string)}`;
    
    const result = await db.execute(query);
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    logger.error('Failed to fetch sweep results', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch sweep results'
    });
  }
});

// Drift detection endpoints
router.post('/drift/calculate', async (req, res) => {
  try {
    const { agent_type } = req.body;
    
    if (agent_type && !['market_insight', 'risk_assessor'].includes(agent_type)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid agent_type'
      });
    }
    
    const agents = agent_type ? [agent_type] : ['market_insight', 'risk_assessor'];
    const results = {};
    
    for (const agent of agents) {
      results[agent] = await mlopsService.calculateDriftMetrics(agent);
    }
    
    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    logger.error('Drift calculation failed', { error });
    res.status(500).json({
      success: false,
      error: 'Drift calculation failed'
    });
  }
});

// Get drift metrics
router.get('/drift-metrics', async (req, res) => {
  try {
    const { agent_type, metric_type, status, limit = 100 } = req.query;
    
    let query = sql`
      SELECT * FROM drift_metrics
      WHERE 1=1
    `;
    
    if (agent_type) {
      query = sql`${query} AND agent_type = ${agent_type}`;
    }
    
    if (metric_type) {
      query = sql`${query} AND metric_type = ${metric_type}`;
    }
    
    if (status) {
      query = sql`${query} AND status = ${status}`;
    }
    
    query = sql`${query} ORDER BY created_at DESC LIMIT ${parseInt(limit as string)}`;
    
    const result = await db.execute(query);
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    logger.error('Failed to fetch drift metrics', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch drift metrics'
    });
  }
});

// Get model deployments
router.get('/deployments', async (req, res) => {
  try {
    const { agent_type, is_active = 'true' } = req.query;
    
    let query = sql`
      SELECT md.*, mr.metrics, mr.training_samples, mr.validation_samples
      FROM model_deployments md
      LEFT JOIN model_runs mr ON md.model_version = mr.model_version AND md.agent_type = mr.agent_type
      WHERE 1=1
    `;
    
    if (agent_type) {
      query = sql`${query} AND md.agent_type = ${agent_type}`;
    }
    
    if (is_active === 'true') {
      query = sql`${query} AND md.is_active = true`;
    }
    
    query = sql`${query} ORDER BY md.deployed_at DESC`;
    
    const result = await db.execute(query);
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    logger.error('Failed to fetch deployments', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch deployments'
    });
  }
});

// Get job status (cron jobs)
router.get('/jobs/status', async (req, res) => {
  try {
    const status = getJobStatus();
    
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    logger.error('Failed to fetch job status', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch job status'
    });
  }
});

// Manual job triggers
router.post('/jobs/trigger/:jobType', async (req, res) => {
  try {
    const { jobType } = req.params;
    let result;
    
    switch (jobType) {
      case 'market-insight-retraining':
        result = await triggerMarketInsightRetraining();
        break;
      case 'risk-assessor-retraining':
        result = await triggerRiskAssessorRetraining();
        break;
      case 'drift-detection':
        result = await triggerDriftDetection();
        break;
      default:
        return res.status(400).json({
          success: false,
          error: 'Invalid job type'
        });
    }
    
    logger.info('Manual job trigger', { jobType, user: req.user?.claims?.sub });
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Manual job trigger failed', { error, jobType: req.params.jobType });
    res.status(500).json({
      success: false,
      error: 'Job trigger failed'
    });
  }
});

// Feature importance tracking
router.get('/feature-importance', async (req, res) => {
  try {
    const { agent_type, model_run_id, limit = 20 } = req.query;
    
    let query = sql`
      SELECT fi.*, mr.model_version, mr.training_start
      FROM feature_importance fi
      LEFT JOIN model_runs mr ON fi.model_run_id = mr.id
      WHERE 1=1
    `;
    
    if (agent_type) {
      query = sql`${query} AND fi.agent_type = ${agent_type}`;
    }
    
    if (model_run_id) {
      query = sql`${query} AND fi.model_run_id = ${model_run_id}`;
    }
    
    query = sql`${query} ORDER BY fi.importance DESC LIMIT ${parseInt(limit as string)}`;
    
    const result = await db.execute(query);
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    logger.error('Failed to fetch feature importance', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch feature importance'
    });
  }
});

// Model performance history
router.get('/performance-history', async (req, res) => {
  try {
    const { agent_type, model_version, evaluation_period, limit = 100 } = req.query;
    
    let query = sql`
      SELECT * FROM model_performance_history
      WHERE 1=1
    `;
    
    if (agent_type) {
      query = sql`${query} AND agent_type = ${agent_type}`;
    }
    
    if (model_version) {
      query = sql`${query} AND model_version = ${model_version}`;
    }
    
    if (evaluation_period) {
      query = sql`${query} AND evaluation_period = ${evaluation_period}`;
    }
    
    query = sql`${query} ORDER BY evaluation_date DESC LIMIT ${parseInt(limit as string)}`;
    
    const result = await db.execute(query);
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    logger.error('Failed to fetch performance history', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch performance history'
    });
  }
});

export { router as mlopsRoutes };