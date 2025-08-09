/**
 * Training Jobs API Routes
 */

import { Router } from 'express';
import * as crypto from 'crypto';
import { TrainingJob, TrainingRequest } from './types';
import { saveJob, getJob, listJobs } from './store';
import { enqueue, getQueueStatus, cancelJob } from './queue';
import { logger } from '../../utils/logger';

const router = Router();

// Admin authentication middleware
function requireAdmin(req: any, res: any, next: any) {
  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret || req.headers["x-admin-secret"] !== adminSecret) {
    return res.status(401).json({ error: "unauthorized" });
  }
  next();
}

// Create new training job
router.post("/training/jobs", requireAdmin, (req, res) => {
  try {
    const body = req.body as TrainingRequest;
    const steps = Number(req.query.steps as string) || 0;
    
    // Optional steps→hours conversion (100k steps ≈ 1h)
    let durationHours = body.durationHours;
    if (!durationHours && steps > 0) {
      durationHours = Math.max(0.1, Math.min(48, steps / 100000));
    }
    if (!durationHours) {
      durationHours = 0.25; // 15 minute default
    }
    
    const jobId = `tr_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
    
    const job: TrainingJob = {
      jobId,
      createdAt: new Date().toISOString(),
      durationHours,
      symbols: body.symbols || ["BTC"],
      skipValidation: !!body.skipValidation,
      seed: body.seed,
      version: body.version || "1.1",
      features: body.features || ["price", "microstructure"],
      maxDurationHours: body.maxDurationHours || 12,
      maxCostUsd: body.maxCostUsd || 10,
      notes: body.notes || "",
      state: "queued",
      progress: 0
    };
    
    saveJob(job);
    enqueue(job);
    
    logger.info('[API] Training job created', { 
      jobId, 
      duration: durationHours + 'h',
      symbols: job.symbols 
    });
    
    res.status(202).json({ 
      jobId, 
      acceptedAt: job.createdAt,
      estimatedDuration: durationHours + ' hours',
      queuePosition: getQueueStatus().queueLength
    });
  } catch (error: any) {
    logger.error('[API] Failed to create training job', { error: error.message });
    res.status(400).json({ error: error.message });
  }
});

// List all training jobs
router.get("/training/jobs", requireAdmin, (req, res) => {
  const limit = parseInt(req.query.limit as string) || 50;
  const state = req.query.state as string;
  
  let jobs = listJobs();
  
  if (state) {
    jobs = jobs.filter(job => job.state === state);
  }
  
  jobs = jobs.slice(0, limit);
  
  res.json({ 
    jobs,
    total: jobs.length,
    queue: getQueueStatus()
  });
});

// Get specific job status
router.get("/training/jobs/:jobId/status", requireAdmin, (req, res) => {
  const job = getJob(req.params.jobId);
  if (!job) {
    return res.status(404).json({ error: "job_not_found" });
  }
  
  const queueStatus = getQueueStatus();
  const isCurrentJob = queueStatus.currentJob === job.jobId;
  
  res.json({ 
    job,
    queue: {
      isCurrentJob,
      queueLength: queueStatus.queueLength,
      isRunning: queueStatus.isRunning
    }
  });
});

// Get job results (only for completed jobs)
router.get("/training/jobs/:jobId/results", requireAdmin, (req, res) => {
  const job = getJob(req.params.jobId);
  if (!job) {
    return res.status(404).json({ error: "job_not_found" });
  }
  
  if (job.state !== "done" && job.state !== "failed") {
    return res.status(409).json({ 
      error: "job_not_ready", 
      state: job.state,
      progress: job.progress
    });
  }
  
  res.json({ 
    job,
    metrics: job.metrics,
    artifacts: job.artifacts,
    manifestPath: job.manifestPath,
    success: job.state === "done"
  });
});

// Cancel a queued job
router.delete("/training/jobs/:jobId", requireAdmin, (req, res) => {
  const job = getJob(req.params.jobId);
  if (!job) {
    return res.status(404).json({ error: "job_not_found" });
  }
  
  if (job.state === "done" || job.state === "failed") {
    return res.status(409).json({ 
      error: "job_already_completed", 
      state: job.state 
    });
  }
  
  const cancelled = cancelJob(req.params.jobId);
  if (cancelled) {
    logger.info('[API] Job cancelled', { jobId: req.params.jobId });
    res.json({ success: true, message: "Job cancelled" });
  } else {
    res.status(409).json({ error: "job_not_cancellable" });
  }
});

// Get queue status
router.get("/training/queue", requireAdmin, (req, res) => {
  const status = getQueueStatus();
  const currentJob = status.currentJob ? getJob(status.currentJob) : null;
  
  res.json({
    queueLength: status.queueLength,
    isRunning: status.isRunning,
    currentJob: currentJob ? {
      jobId: currentJob.jobId,
      symbols: currentJob.symbols,
      progress: currentJob.progress,
      phase: currentJob.phase,
      startedAt: currentJob.startedAt
    } : null
  });
});

export default router;