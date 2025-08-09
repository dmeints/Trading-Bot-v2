/**
 * Training Job Worker - Orchestrates training workflow
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { TrainingJob } from './types';
import { saveJob } from './store';
import { logger } from '../../utils/logger';

function nowISO(): string {
  return new Date().toISOString();
}

function runDir(jobId: string): string {
  const dir = path.resolve("runs", jobId);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

async function writeManifest(job: TrainingJob): Promise<void> {
  const manifest = {
    jobId: job.jobId,
    createdAt: job.createdAt,
    seed: job.seed ?? null,
    version: job.version ?? null,
    config: {
      durationHours: job.durationHours,
      symbols: job.symbols,
      features: job.features ?? [],
      maxDurationHours: job.maxDurationHours,
      maxCostUsd: job.maxCostUsd,
      skipValidation: job.skipValidation ?? false,
      notes: job.notes ?? ""
    },
    system: {
      gitSha: process.env.GIT_SHA || null,
      node: process.version,
      env: process.env.NODE_ENV || "development"
    }
  };
  
  const manifestPath = path.join(runDir(job.jobId), "manifest.json");
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  job.manifestPath = manifestPath;
  saveJob(job);
  
  logger.info('[Worker] Manifest written', { jobId: job.jobId, path: manifestPath });
}

async function preflight(job: TrainingJob): Promise<void> {
  job.state = "preflight";
  job.phase = "validating inputs";
  job.progress = 0.05;
  saveJob(job);
  
  logger.info('[Worker] Starting preflight checks', { jobId: job.jobId });
  
  // Duration validation
  const maxDuration = job.maxDurationHours ?? 48;
  if (job.durationHours < 0.1 || job.durationHours > maxDuration) {
    throw new Error(`Invalid durationHours: ${job.durationHours}. Must be between 0.1 and ${maxDuration}`);
  }
  
  // Symbol validation
  const allowedSymbols = new Set(["BTC", "ETH", "SOL", "ADA", "DOT"]);
  const invalidSymbols = job.symbols.filter(s => !allowedSymbols.has(s));
  if (invalidSymbols.length > 0) {
    throw new Error(`Unsupported symbols: ${invalidSymbols.join(', ')}`);
  }
  
  // Budget validation
  const maxCost = job.maxCostUsd ?? 50;
  if (maxCost < 0 || maxCost > 100) {
    throw new Error(`Invalid cost budget: $${maxCost}. Must be between $0 and $100`);
  }
  
  // Feature validation
  if (job.features && job.features.length > 0) {
    const allowedFeatures = new Set(["price", "microstructure", "derivatives", "sentiment"]);
    const invalidFeatures = job.features.filter(f => !allowedFeatures.has(f));
    if (invalidFeatures.length > 0) {
      throw new Error(`Invalid features: ${invalidFeatures.join(', ')}`);
    }
  }
  
  // Write manifest
  await writeManifest(job);
  
  logger.info('[Worker] Preflight checks passed', { jobId: job.jobId });
}

export async function runTrainingWorkflow(job: TrainingJob): Promise<void> {
  const startTime = Date.now();
  
  try {
    // Preflight validation
    await preflight(job);
    
    // Start training
    job.startedAt = nowISO();
    job.state = "training";
    job.phase = "PPO training in progress";
    job.progress = 0.15;
    saveJob(job);
    
    logger.info('[Worker] Starting PPO training', { 
      jobId: job.jobId,
      duration: job.durationHours + 'h',
      symbols: job.symbols
    });
    
    // Call your existing training system via HTTP
    const trainingResult = await callExistingTrainingAPI(job);
    
    // Update progress
    job.phase = "evaluating results";
    job.progress = 0.85;
    saveJob(job);
    
    // Process results
    await processTrainingResults(job, trainingResult);
    
    // Complete job
    job.state = "done";
    job.phase = "complete";
    job.progress = 1.0;
    job.finishedAt = nowISO();
    saveJob(job);
    
    const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
    logger.info('[Worker] Training job completed successfully', { 
      jobId: job.jobId,
      duration: duration + ' minutes',
      sharpe: job.metrics?.sharpe,
      generation: job.metrics?.generation
    });
    
  } catch (error: any) {
    job.state = "failed";
    job.phase = "error";
    job.progress = 1.0;
    job.finishedAt = nowISO();
    job.error = error?.message || "Training workflow failed";
    saveJob(job);
    
    const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
    logger.error('[Worker] Training job failed', { 
      jobId: job.jobId,
      duration: duration + ' minutes',
      error: job.error
    });
    
    throw error;
  }
}

async function callExistingTrainingAPI(job: TrainingJob): Promise<any> {
  // Import node-fetch dynamically to avoid module issues
  const fetch = (await import('node-fetch')).default;
  
  const payload = {
    duration: job.durationHours,
    skipValidation: job.skipValidation ?? false,
    symbols: job.symbols,
    seed: job.seed,
    version: job.version,
    features: job.features
  };
  
  logger.info('[Worker] Calling existing training API', { 
    jobId: job.jobId,
    payload: {
      duration: payload.duration,
      symbols: payload.symbols,
      skipValidation: payload.skipValidation
    }
  });
  
  const response = await fetch('http://localhost:5000/api/training/real-session', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-admin-secret': process.env.ADMIN_SECRET || '',
      'x-job-id': job.jobId
    },
    body: JSON.stringify(payload)
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Training API failed: ${response.status} ${errorText}`);
  }
  
  const result = await response.json();
  logger.info('[Worker] Training API response received', { 
    jobId: job.jobId,
    success: result.success,
    generation: result.data?.generation
  });
  
  return result;
}

async function processTrainingResults(job: TrainingJob, trainingResult: any): Promise<void> {
  logger.info('[Worker] Processing training results', { jobId: job.jobId });
  
  // Extract metrics from training result
  const data = trainingResult.data || trainingResult;
  job.metrics = {
    sharpe: data.new_performance?.sharpe_ratio || data.sharpe,
    returnPct: data.new_performance?.total_return || data.returnPct,
    maxDDPct: data.new_performance?.max_drawdown || data.maxDDPct,
    winRate: data.new_performance?.win_rate || data.winRate,
    generation: data.generation,
    improvementPct: data.improvement_percent || data.improvementPct
  };
  
  // Save artifacts
  const artifactsDir = runDir(job.jobId);
  job.artifacts = {
    modelPath: data.model_path || null,
    reportHtml: data.report_html || null,
    metricsPath: path.join(artifactsDir, "metrics.json")
  };
  
  // Write metrics file
  const metricsData = {
    jobId: job.jobId,
    completedAt: nowISO(),
    trainingDuration: job.durationHours,
    symbols: job.symbols,
    metrics: job.metrics,
    rawResults: data
  };
  
  fs.writeFileSync(job.artifacts.metricsPath!, JSON.stringify(metricsData, null, 2));
  
  // Generate summary report
  const summaryPath = path.join(artifactsDir, "summary.txt");
  const summary = generateSummaryReport(job, trainingResult);
  fs.writeFileSync(summaryPath, summary);
  
  logger.info('[Worker] Results processed', { 
    jobId: job.jobId,
    metricsPath: job.artifacts.metricsPath,
    summaryPath
  });
}

function generateSummaryReport(job: TrainingJob, trainingResult: any): string {
  const metrics = job.metrics || {};
  const data = trainingResult.data || trainingResult;
  
  return `
STEVIE TRAINING JOB SUMMARY
===========================

Job ID: ${job.jobId}
Completed: ${job.finishedAt}
Duration: ${job.durationHours} hours
Symbols: ${job.symbols.join(', ')}

PERFORMANCE METRICS
-------------------
Sharpe Ratio: ${metrics.sharpe?.toFixed(4) || 'N/A'}
Total Return: ${metrics.returnPct?.toFixed(2) || 'N/A'}%
Max Drawdown: ${metrics.maxDDPct?.toFixed(2) || 'N/A'}%
Win Rate: ${metrics.winRate?.toFixed(1) || 'N/A'}%
Generation: ${metrics.generation || 'N/A'}
Improvement: ${metrics.improvementPct?.toFixed(1) || 'N/A'}%

TRAINING DETAILS
----------------
Features: ${job.features?.join(', ') || 'default'}
Validation: ${job.skipValidation ? 'skipped' : 'enabled'}
Seed: ${job.seed || 'random'}
Version: ${job.version || 'latest'}

STATUS: ${job.state.toUpperCase()}
${job.error ? `ERROR: ${job.error}` : ''}

Generated: ${nowISO()}
`.trim();
}