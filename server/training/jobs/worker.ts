import fs from "fs";
import path from "path";
import crypto from "crypto";
import { TrainingJob } from "./types.js";
import { saveJob } from "./store.js";
import { exec as _exec } from "child_process";
import { promisify } from "util";
const exec = promisify(_exec);

function nowISO() { return new Date().toISOString(); }
function runDir(jobId: string) { const d = path.resolve("runs", jobId); if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive:true }); return d; }

async function writeManifest(job: TrainingJob) {
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
  const p = path.join(runDir(job.jobId), "manifest.json");
  fs.writeFileSync(p, JSON.stringify(manifest, null, 2));
  job.manifestPath = p;
  saveJob(job);
}

async function preflight(job: TrainingJob) {
  job.state = "preflight"; job.phase = "validating inputs"; job.progress = 0.05;
  saveJob(job);
  // Bounds & allowlists
  if (job.durationHours < 0.25 || job.durationHours > (job.maxDurationHours ?? 48)) {
    throw new Error("Invalid durationHours");
  }
  const allow = new Set(["BTC","ETH","SOL","ADA","DOT"]);
  if (!job.symbols.every(s => allow.has(s))) throw new Error("Unsupported symbol");
  // Budget guard (example)
  if ((job.maxCostUsd ?? 10) < 0) throw new Error("Invalid cost budget");
  // TODO: data availability check, disk space, seeds, feature flags on
  await writeManifest(job);
}

export async function runTrainingWorkflow(job: TrainingJob) {
  try {
    await preflight(job);
    job.startedAt = nowISO();
    job.state = "training"; job.phase = "PPO running"; job.progress = 0.15;
    saveJob(job);
    
    // Simulate training process
    for (let epoch = 1; epoch <= 10; epoch++) {
      job.phase = `PPO epoch ${epoch}/10`;
      job.progress = 0.15 + (epoch / 10) * 0.7;
      saveJob(job);
      await new Promise(resolve => setTimeout(resolve, 1000)); // 1s per epoch
    }
    
    job.state = "evaluating"; job.phase = "Computing metrics"; job.progress = 0.9;
    saveJob(job);
    
    // Simulate evaluation
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    job.state = "done"; job.phase = "Complete"; job.progress = 1.0;
    job.finishedAt = nowISO();
    job.metrics = {
      sharpe: Math.random() * 2,
      returnPct: Math.random() * 20 - 10,
      maxDDPct: Math.random() * -15,
      winRate: Math.random() * 0.4 + 0.4,
      generation: 1,
      improvementPct: Math.random() * 10,
    };
    saveJob(job);
    
  } catch (error) {
    job.state = "failed";
    job.error = error instanceof Error ? error.message : "Unknown error";
    job.finishedAt = nowISO();
    saveJob(job);
  }
}