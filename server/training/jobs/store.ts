import fs from "fs";
import path from "path";
import { TrainingJob } from "./types.js";

const RUNS_DIR = path.resolve("runs");
if (!fs.existsSync(RUNS_DIR)) fs.mkdirSync(RUNS_DIR, { recursive: true });

const jobs = new Map<string, TrainingJob>();

export function saveJob(job: TrainingJob) {
  jobs.set(job.jobId, job);
  const p = path.join(RUNS_DIR, `${job.jobId}.json`);
  fs.writeFileSync(p, JSON.stringify(job, null, 2));
}

export function getJob(jobId: string) { return jobs.get(jobId); }
export function listJobs() { return Array.from(jobs.values()).sort((a,b)=> (a.createdAt<b.createdAt?1:-1)); }