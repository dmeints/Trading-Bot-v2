/**
 * Training Job Queue - Simple queue with single worker
 */

import { TrainingJob } from './types';
import { saveJob, getJob } from './store';
import { runTrainingWorkflow } from './worker';
import { logger } from '../../utils/logger';

const queue: string[] = [];
let running = false;
let currentJobId: string | null = null;

export function enqueue(job: TrainingJob): void {
  queue.push(job.jobId);
  logger.info('[Queue] Job enqueued', { 
    jobId: job.jobId, 
    position: queue.length,
    symbols: job.symbols,
    duration: job.durationHours + 'h'
  });
  
  tick();
}

export function getQueueStatus(): {
  queueLength: number;
  currentJob: string | null;
  isRunning: boolean;
} {
  return {
    queueLength: queue.length,
    currentJob: currentJobId,
    isRunning: running
  };
}

async function tick(): Promise<void> {
  if (running) return;
  
  const nextJobId = queue.shift();
  if (!nextJobId) return;
  
  const job = getJob(nextJobId);
  if (!job) {
    logger.warn('[Queue] Job not found in store', { jobId: nextJobId });
    return tick();
  }
  
  running = true;
  currentJobId = nextJobId;
  
  logger.info('[Queue] Starting job', { 
    jobId: nextJobId,
    symbols: job.symbols,
    duration: job.durationHours + 'h'
  });
  
  try {
    await runTrainingWorkflow(job);
  } catch (error) {
    logger.error('[Queue] Job workflow failed', { jobId: nextJobId, error });
  }
  
  running = false;
  currentJobId = null;
  
  logger.info('[Queue] Job completed', { 
    jobId: nextJobId,
    state: job.state,
    remaining: queue.length
  });
  
  // Process next job
  return tick();
}

export function cancelJob(jobId: string): boolean {
  const index = queue.indexOf(jobId);
  if (index > -1) {
    queue.splice(index, 1);
    
    const job = getJob(jobId);
    if (job) {
      job.state = 'failed';
      job.error = 'Cancelled by user';
      job.finishedAt = new Date().toISOString();
      saveJob(job);
    }
    
    logger.info('[Queue] Job cancelled', { jobId });
    return true;
  }
  
  return false;
}