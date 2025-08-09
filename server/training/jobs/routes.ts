import { Router } from "express";
import { z } from "zod";
import { TrainingJob, TrainingRequest } from "./types.js";
import { saveJob, getJob, listJobs } from "./store.js";
import { enqueue } from "./queue.js";

export const trainingJobsRouter = Router();

const TrainingRequestSchema = z.object({
  durationHours: z.number().min(0.25).max(48),
  symbols: z.array(z.string()).min(1),
  skipValidation: z.boolean().optional(),
  seed: z.number().optional(),
  version: z.string().optional(),
  features: z.array(z.string()).optional(),
  maxDurationHours: z.number().optional(),
  maxCostUsd: z.number().optional(),
  notes: z.string().optional(),
});

// Create a new training job
trainingJobsRouter.post("/", async (req, res) => {
  try {
    const request = TrainingRequestSchema.parse(req.body) as TrainingRequest;
    const jobId = `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    
    const job: TrainingJob = {
      ...request,
      jobId,
      createdAt: new Date().toISOString(),
      state: "queued",
      progress: 0,
    };
    
    saveJob(job);
    enqueue(job);
    
    res.status(202).json({ jobId, status: "queued" });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Invalid request" });
  }
});

// Get job status
trainingJobsRouter.get("/:jobId", (req, res) => {
  const { jobId } = req.params;
  const job = getJob(jobId);
  
  if (!job) {
    return res.status(404).json({ error: "Job not found" });
  }
  
  res.json(job);
});

// List all jobs
trainingJobsRouter.get("/", (req, res) => {
  const jobs = listJobs();
  res.json(jobs);
});