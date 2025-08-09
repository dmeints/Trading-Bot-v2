import { TrainingJob } from "./types.js";
import { saveJob, getJob } from "./store.js";
import { runTrainingWorkflow } from "./worker.js";

const q: string[] = [];
let running = false;

export function enqueue(job: TrainingJob) {
  q.push(job.jobId);
  tick();
}

async function tick() {
  if (running) return;
  const next = q.shift();
  if (!next) return;
  running = true;
  const job = getJob(next);
  if (!job) { running = false; return tick(); }
  await runTrainingWorkflow(job).catch(()=>{});
  running = false;
  return tick();
}