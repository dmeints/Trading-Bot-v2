import cron from 'node-cron';
import { MLOpsService } from '../services/mlopsService';
import { logger } from '../utils/logger';

/**
 * Automated retraining cron jobs
 * Runs daily at 2 AM to retrain models with fresh data
 */

const mlopsService = MLOpsService.getInstance();

// Market Insight Agent retraining - Daily at 2:00 AM
const marketInsightRetrainingJob = cron.schedule('0 2 * * *', async () => {
  logger.info('Starting scheduled Market Insight retraining');
  
  try {
    const result = await mlopsService.runRetrainingPipeline('market_insight');
    logger.info('Market Insight retraining completed', {
      runId: result.id,
      status: result.status,
      deploymentStatus: result.deployment_status,
      metrics: result.metrics
    });
  } catch (error) {
    logger.error('Market Insight retraining failed', { error });
  }
}, {
  scheduled: false, // Will be started manually
  timezone: 'UTC'
});

// Risk Assessor retraining - Daily at 3:00 AM (offset to avoid conflicts)
const riskAssessorRetrainingJob = cron.schedule('0 3 * * *', async () => {
  logger.info('Starting scheduled Risk Assessor retraining');
  
  try {
    const result = await mlopsService.runRetrainingPipeline('risk_assessor');
    logger.info('Risk Assessor retraining completed', {
      runId: result.id,
      status: result.status,
      deploymentStatus: result.deployment_status,
      metrics: result.metrics
    });
  } catch (error) {
    logger.error('Risk Assessor retraining failed', { error });
  }
}, {
  scheduled: false,
  timezone: 'UTC'
});

// Drift detection job - Every 6 hours
const driftDetectionJob = cron.schedule('0 */6 * * *', async () => {
  logger.info('Running drift detection');
  
  try {
    const agents = ['market_insight', 'risk_assessor'] as const;
    
    for (const agent of agents) {
      const metrics = await mlopsService.calculateDriftMetrics(agent);
      const criticalCount = metrics.filter(m => m.status === 'critical').length;
      const warningCount = metrics.filter(m => m.status === 'warning').length;
      
      logger.info(`Drift detection completed for ${agent}`, {
        agent,
        totalMetrics: metrics.length,
        criticalAlerts: criticalCount,
        warningAlerts: warningCount
      });
      
      // Trigger immediate retraining if critical drift detected
      if (criticalCount > 0) {
        logger.warn(`Critical drift detected for ${agent}, triggering immediate retraining`);
        
        try {
          await mlopsService.runRetrainingPipeline(agent);
          logger.info(`Emergency retraining completed for ${agent}`);
        } catch (retrainError) {
          logger.error(`Emergency retraining failed for ${agent}`, { error: retrainError });
        }
      }
    }
  } catch (error) {
    logger.error('Drift detection failed', { error });
  }
}, {
  scheduled: false,
  timezone: 'UTC'
});

// Weekly comprehensive model validation - Sundays at 1:00 AM
const weeklyValidationJob = cron.schedule('0 1 * * 0', async () => {
  logger.info('Starting weekly model validation');
  
  try {
    // Run comprehensive validation on all deployed models
    const agents = ['market_insight', 'risk_assessor'] as const;
    
    for (const agent of agents) {
      // Calculate extended performance metrics
      const driftMetrics = await mlopsService.calculateDriftMetrics(agent);
      
      // Log weekly summary
      logger.info(`Weekly validation summary for ${agent}`, {
        agent,
        driftMetrics: driftMetrics.map(m => ({
          type: m.metric_type,
          value: m.value,
          status: m.status
        }))
      });
    }
    
    logger.info('Weekly model validation completed');
  } catch (error) {
    logger.error('Weekly model validation failed', { error });
  }
}, {
  scheduled: false,
  timezone: 'UTC'
});

/**
 * Initialize and start all cron jobs
 */
export function startRetrainingJobs(): void {
  const jobsToStart = [
    { job: marketInsightRetrainingJob, name: 'Market Insight Retraining', schedule: 'Daily 2:00 AM UTC' },
    { job: riskAssessorRetrainingJob, name: 'Risk Assessor Retraining', schedule: 'Daily 3:00 AM UTC' },
    { job: driftDetectionJob, name: 'Drift Detection', schedule: 'Every 6 hours' },
    { job: weeklyValidationJob, name: 'Weekly Validation', schedule: 'Sundays 1:00 AM UTC' }
  ];

  jobsToStart.forEach(({ job, name, schedule }) => {
    try {
      job.start();
      logger.info(`Started cron job: ${name}`, { schedule });
    } catch (error) {
      logger.error(`Failed to start cron job: ${name}`, { error });
    }
  });

  logger.info('All MLOps cron jobs initialized', { 
    jobCount: jobsToStart.length,
    timezone: 'UTC'
  });
}

/**
 * Stop all cron jobs (for graceful shutdown)
 */
export function stopRetrainingJobs(): void {
  const jobs = [
    marketInsightRetrainingJob,
    riskAssessorRetrainingJob,
    driftDetectionJob,
    weeklyValidationJob
  ];

  jobs.forEach((job, index) => {
    try {
      job.stop();
      logger.info(`Stopped cron job ${index + 1}`);
    } catch (error) {
      logger.error(`Failed to stop cron job ${index + 1}`, { error });
    }
  });

  logger.info('All MLOps cron jobs stopped');
}

/**
 * Get status of all cron jobs
 */
export function getJobStatus(): Array<{ name: string; running: boolean; schedule: string }> {
  return [
    {
      name: 'Market Insight Retraining',
      running: marketInsightRetrainingJob.getStatus() === 'scheduled',
      schedule: '0 2 * * *'
    },
    {
      name: 'Risk Assessor Retraining', 
      running: riskAssessorRetrainingJob.getStatus() === 'scheduled',
      schedule: '0 3 * * *'
    },
    {
      name: 'Drift Detection',
      running: driftDetectionJob.getStatus() === 'scheduled',
      schedule: '0 */6 * * *'
    },
    {
      name: 'Weekly Validation',
      running: weeklyValidationJob.getStatus() === 'scheduled',
      schedule: '0 1 * * 0'
    }
  ];
}

// Manual trigger functions for CLI/API access
export async function triggerMarketInsightRetraining(): Promise<any> {
  logger.info('Manual trigger: Market Insight retraining');
  return await mlopsService.runRetrainingPipeline('market_insight');
}

export async function triggerRiskAssessorRetraining(): Promise<any> {
  logger.info('Manual trigger: Risk Assessor retraining');
  return await mlopsService.runRetrainingPipeline('risk_assessor');
}

export async function triggerDriftDetection(): Promise<any> {
  logger.info('Manual trigger: Drift detection');
  const results = {};
  
  for (const agent of ['market_insight', 'risk_assessor'] as const) {
    results[agent] = await mlopsService.calculateDriftMetrics(agent);
  }
  
  return results;
}