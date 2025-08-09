/**
 * Training Job Store - In-memory + JSONL persistence
 */

import * as fs from 'fs';
import * as path from 'path';
import { TrainingJob } from './types';
import { logger } from '../../utils/logger';

const RUNS_DIR = path.resolve("runs");
if (!fs.existsSync(RUNS_DIR)) {
  fs.mkdirSync(RUNS_DIR, { recursive: true });
}

const jobs = new Map<string, TrainingJob>();

export function saveJob(job: TrainingJob): void {
  jobs.set(job.jobId, job);
  const jobPath = path.join(RUNS_DIR, `${job.jobId}.json`);
  
  try {
    fs.writeFileSync(jobPath, JSON.stringify(job, null, 2));
    logger.debug('[JobStore] Job saved', { jobId: job.jobId, state: job.state });
  } catch (error) {
    logger.error('[JobStore] Failed to save job', { jobId: job.jobId, error });
  }
}

export function getJob(jobId: string): TrainingJob | undefined {
  return jobs.get(jobId);
}

export function listJobs(): TrainingJob[] {
  return Array.from(jobs.values()).sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export function deleteJob(jobId: string): boolean {
  const jobPath = path.join(RUNS_DIR, `${jobId}.json`);
  
  try {
    if (fs.existsSync(jobPath)) {
      fs.unlinkSync(jobPath);
    }
    jobs.delete(jobId);
    logger.info('[JobStore] Job deleted', { jobId });
    return true;
  } catch (error) {
    logger.error('[JobStore] Failed to delete job', { jobId, error });
    return false;
  }
}

// Load existing jobs on startup
export function loadExistingJobs(): void {
  try {
    const files = fs.readdirSync(RUNS_DIR);
    let loaded = 0;
    
    for (const file of files) {
      if (file.endsWith('.json') && file.startsWith('tr_')) {
        try {
          const jobPath = path.join(RUNS_DIR, file);
          const jobData = JSON.parse(fs.readFileSync(jobPath, 'utf-8'));
          jobs.set(jobData.jobId, jobData);
          loaded++;
        } catch (error) {
          logger.warn('[JobStore] Failed to load job file', { file, error });
        }
      }
    }
    
    logger.info('[JobStore] Existing jobs loaded', { count: loaded });
  } catch (error) {
    logger.error('[JobStore] Failed to load existing jobs', { error });
  }
}

// Initialize on module load
loadExistingJobs();