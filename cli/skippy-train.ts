#!/usr/bin/env node
/**
 * Skippy Training CLI - Async Job System
 */

import fetch from 'node-fetch';

function arg(key: string, def?: any): any {
  const i = process.argv.indexOf(`--${key}`);
  if (i === -1) return def;
  const v = process.argv[i + 1];
  return v?.startsWith("--") || v === undefined ? true : v;
}

async function main() {
  const command = process.argv[2];
  const host = process.env.TRAIN_API_HOST || "http://localhost:5000";
  const adminSecret = process.env.ADMIN_SECRET || "";
  
  if (!adminSecret) {
    console.error("❌ Missing ADMIN_SECRET environment variable");
    process.exit(2);
  }

  const headers = {
    "Content-Type": "application/json",
    "x-admin-secret": adminSecret
  };

  switch (command) {
    case "ppo":
      await handlePPOCommand(host, headers);
      break;
    case "status":
      await handleStatusCommand(host, headers);
      break;
    case "results":
      await handleResultsCommand(host, headers);
      break;
    case "list":
      await handleListCommand(host, headers);
      break;
    case "cancel":
      await handleCancelCommand(host, headers);
      break;
    case "queue":
      await handleQueueCommand(host, headers);
      break;
    default:
      printUsage();
      break;
  }
}

async function handlePPOCommand(host: string, headers: any) {
  const steps = Number(arg("steps", 1000000));
  const symbols = (arg("symbols", "BTC") as string).split(",").map(s => s.trim());
  const seed = arg("seed");
  const version = arg("version", "1.1");
  const features = (arg("features", "price,microstructure") as string).split(",").map(s => s.trim());
  const maxDuration = Number(arg("max-duration", 12));
  const maxCost = Number(arg("max-cost", 10));
  const notes = arg("notes", "");
  const skipValidation = arg("skip-validation", "false") === "true";
  const watch = arg("watch", "true") !== "false";

  // Convert steps to hours if duration not specified
  const durationHours = Number(arg("duration")) || (steps / 100000);

  console.log(`🚀 Starting PPO training job...`);
  console.log(`   Duration: ${durationHours} hours`);
  console.log(`   Symbols: ${symbols.join(", ")}`);
  console.log(`   Features: ${features.join(", ")}`);

  try {
    const response = await fetch(`${host}/api/training/jobs?steps=${steps}`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        durationHours,
        symbols,
        skipValidation,
        seed,
        version,
        features,
        maxDurationHours: maxDuration,
        maxCostUsd: maxCost,
        notes
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Job creation failed: ${response.status} ${errorText}`);
      process.exit(3);
    }

    const result = await response.json() as any;
    console.log(`✅ Job created: ${result.jobId}`);
    console.log(`   Queue position: ${result.queuePosition || 'Processing'}`);
    console.log(`   Estimated duration: ${result.estimatedDuration}`);

    if (watch) {
      console.log(`\n⏳ Watching job progress (Ctrl+C to exit)...`);
      await watchJob(host, headers, result.jobId);
    } else {
      console.log(`\n💡 Use: skippy-train status ${result.jobId} to check progress`);
    }
  } catch (error: any) {
    console.error(`❌ Error creating job: ${error.message}`);
    process.exit(3);
  }
}

async function handleStatusCommand(host: string, headers: any) {
  const jobId = process.argv[3];
  if (!jobId) {
    console.error("❌ Job ID required: skippy-train status <job-id>");
    process.exit(1);
  }

  try {
    const response = await fetch(`${host}/api/training/jobs/${jobId}/status`, { headers });
    
    if (!response.ok) {
      if (response.status === 404) {
        console.error(`❌ Job not found: ${jobId}`);
      } else {
        console.error(`❌ Status check failed: ${response.status}`);
      }
      process.exit(4);
    }

    const result = await response.json() as any;
    const job = result.job;

    console.log(`📊 Job Status: ${job.jobId}`);
    console.log(`   State: ${getStateEmoji(job.state)} ${job.state.toUpperCase()}`);
    console.log(`   Progress: ${Math.round(job.progress * 100)}%`);
    
    if (job.phase) {
      console.log(`   Phase: ${job.phase}`);
    }
    
    if (job.startedAt) {
      const elapsed = Math.round((new Date().getTime() - new Date(job.startedAt).getTime()) / 1000 / 60);
      console.log(`   Running time: ${elapsed} minutes`);
    }
    
    if (job.error) {
      console.log(`   Error: ${job.error}`);
    }

    if (job.state === 'done' && job.metrics) {
      console.log(`\n📈 Results:`);
      if (job.metrics.sharpe) console.log(`   Sharpe Ratio: ${job.metrics.sharpe.toFixed(4)}`);
      if (job.metrics.generation) console.log(`   Generation: ${job.metrics.generation}`);
      if (job.metrics.improvementPct) console.log(`   Improvement: ${job.metrics.improvementPct.toFixed(1)}%`);
      
      console.log(`\n💡 Use: skippy-train results ${jobId} for detailed results`);
    }
  } catch (error: any) {
    console.error(`❌ Error checking status: ${error.message}`);
    process.exit(4);
  }
}

async function handleResultsCommand(host: string, headers: any) {
  const jobId = process.argv[3];
  if (!jobId) {
    console.error("❌ Job ID required: skippy-train results <job-id>");
    process.exit(1);
  }

  try {
    const response = await fetch(`${host}/api/training/jobs/${jobId}/results`, { headers });
    
    if (!response.ok) {
      if (response.status === 404) {
        console.error(`❌ Job not found: ${jobId}`);
      } else if (response.status === 409) {
        const error = await response.json() as any;
        console.error(`❌ Job not ready: ${error.state} (${Math.round(error.progress * 100)}%)`);
      } else {
        console.error(`❌ Results fetch failed: ${response.status}`);
      }
      process.exit(4);
    }

    const result = await response.json() as any;
    const job = result.job;
    const metrics = result.metrics || {};

    console.log(`📊 Training Results: ${job.jobId}`);
    console.log(`   Status: ${job.success ? '✅ SUCCESS' : '❌ FAILED'}`);
    console.log(`   Duration: ${job.durationHours} hours`);
    console.log(`   Symbols: ${job.symbols.join(', ')}`);
    
    if (job.finishedAt) {
      console.log(`   Completed: ${new Date(job.finishedAt).toLocaleString()}`);
    }

    if (job.success) {
      console.log(`\n📈 Performance Metrics:`);
      if (metrics.sharpe) console.log(`   Sharpe Ratio: ${metrics.sharpe.toFixed(4)}`);
      if (metrics.returnPct) console.log(`   Total Return: ${metrics.returnPct.toFixed(2)}%`);
      if (metrics.maxDDPct) console.log(`   Max Drawdown: ${metrics.maxDDPct.toFixed(2)}%`);
      if (metrics.winRate) console.log(`   Win Rate: ${metrics.winRate.toFixed(1)}%`);
      if (metrics.generation) console.log(`   Generation: ${metrics.generation}`);
      if (metrics.improvementPct) console.log(`   Improvement: ${metrics.improvementPct.toFixed(1)}%`);
    }

    if (result.artifacts) {
      console.log(`\n📁 Artifacts:`);
      if (result.artifacts.metricsPath) console.log(`   Metrics: ${result.artifacts.metricsPath}`);
      if (result.artifacts.modelPath) console.log(`   Model: ${result.artifacts.modelPath}`);
      if (result.manifestPath) console.log(`   Manifest: ${result.manifestPath}`);
    }

    if (job.error) {
      console.log(`\n❌ Error: ${job.error}`);
    }
  } catch (error: any) {
    console.error(`❌ Error fetching results: ${error.message}`);
    process.exit(4);
  }
}

async function handleListCommand(host: string, headers: any) {
  const limit = Number(arg("limit", 10));
  const state = arg("state");

  try {
    let url = `${host}/api/training/jobs?limit=${limit}`;
    if (state) url += `&state=${state}`;

    const response = await fetch(url, { headers });
    
    if (!response.ok) {
      console.error(`❌ List fetch failed: ${response.status}`);
      process.exit(4);
    }

    const result = await response.json() as any;
    const jobs = result.jobs || [];

    console.log(`📋 Training Jobs (${jobs.length} of ${result.total || jobs.length})`);
    
    if (result.queue) {
      console.log(`   Queue: ${result.queue.queueLength} waiting, ${result.queue.isRunning ? 'running' : 'idle'}`);
    }

    if (jobs.length === 0) {
      console.log("   No jobs found");
      return;
    }

    console.log();
    jobs.forEach((job: any) => {
      const duration = job.finishedAt ? 
        Math.round((new Date(job.finishedAt).getTime() - new Date(job.startedAt || job.createdAt).getTime()) / 1000 / 60) :
        job.startedAt ? Math.round((new Date().getTime() - new Date(job.startedAt).getTime()) / 1000 / 60) :
        null;

      console.log(`${getStateEmoji(job.state)} ${job.jobId.substring(0, 16)}... (${job.state})`);
      console.log(`   ${job.symbols.join(',')} • ${job.durationHours}h • ${duration ? duration + 'm' : 'pending'}`);
      
      if (job.metrics?.sharpe) {
        console.log(`   Sharpe: ${job.metrics.sharpe.toFixed(4)} • Gen: ${job.metrics.generation || '?'}`);
      }
      
      if (job.error) {
        console.log(`   Error: ${job.error.substring(0, 60)}...`);
      }
      
      console.log();
    });
  } catch (error: any) {
    console.error(`❌ Error listing jobs: ${error.message}`);
    process.exit(4);
  }
}

async function handleCancelCommand(host: string, headers: any) {
  const jobId = process.argv[3];
  if (!jobId) {
    console.error("❌ Job ID required: skippy-train cancel <job-id>");
    process.exit(1);
  }

  try {
    const response = await fetch(`${host}/api/training/jobs/${jobId}`, {
      method: 'DELETE',
      headers
    });
    
    if (!response.ok) {
      if (response.status === 404) {
        console.error(`❌ Job not found: ${jobId}`);
      } else if (response.status === 409) {
        const error = await response.json() as any;
        console.error(`❌ Cannot cancel: ${error.error}`);
      } else {
        console.error(`❌ Cancel failed: ${response.status}`);
      }
      process.exit(4);
    }

    console.log(`✅ Job cancelled: ${jobId}`);
  } catch (error: any) {
    console.error(`❌ Error cancelling job: ${error.message}`);
    process.exit(4);
  }
}

async function handleQueueCommand(host: string, headers: any) {
  try {
    const response = await fetch(`${host}/api/training/queue`, { headers });
    
    if (!response.ok) {
      console.error(`❌ Queue status failed: ${response.status}`);
      process.exit(4);
    }

    const result = await response.json() as any;

    console.log(`🔄 Training Queue Status`);
    console.log(`   Waiting jobs: ${result.queueLength}`);
    console.log(`   Status: ${result.isRunning ? '🏃 Running' : '⏸️ Idle'}`);

    if (result.currentJob) {
      const job = result.currentJob;
      const elapsed = Math.round((new Date().getTime() - new Date(job.startedAt).getTime()) / 1000 / 60);
      console.log(`\n📊 Current Job:`);
      console.log(`   ID: ${job.jobId}`);
      console.log(`   Symbols: ${job.symbols.join(', ')}`);
      console.log(`   Progress: ${Math.round(job.progress * 100)}%`);
      console.log(`   Phase: ${job.phase}`);
      console.log(`   Running: ${elapsed} minutes`);
    }
  } catch (error: any) {
    console.error(`❌ Error checking queue: ${error.message}`);
    process.exit(4);
  }
}

async function watchJob(host: string, headers: any, jobId: string) {
  const startTime = Date.now();
  
  while (true) {
    try {
      const response = await fetch(`${host}/api/training/jobs/${jobId}/status`, { headers });
      
      if (!response.ok) {
        console.error(`\n❌ Status check failed: ${response.status}`);
        return;
      }

      const result = await response.json() as any;
      const job = result.job;
      
      const elapsed = Math.round((Date.now() - startTime) / 1000 / 60);
      const progress = Math.round(job.progress * 100);
      const eta = job.etaSeconds ? Math.round(job.etaSeconds / 60) : null;
      
      process.stdout.write(`\r${getStateEmoji(job.state)} [${job.state.toUpperCase()}] ${progress}% • ${job.phase || 'Processing'} • ${elapsed}m elapsed ${eta ? `• ETA: ${eta}m` : ''}    `);
      
      if (job.state === "done") {
        console.log(`\n\n✅ Training completed successfully!`);
        if (job.metrics) {
          if (job.metrics.sharpe) console.log(`   Sharpe Ratio: ${job.metrics.sharpe.toFixed(4)}`);
          if (job.metrics.generation) console.log(`   Generation: ${job.metrics.generation}`);
          if (job.metrics.improvementPct) console.log(`   Improvement: ${job.metrics.improvementPct.toFixed(1)}%`);
        }
        console.log(`\n💡 Use: skippy-train results ${jobId} for detailed results`);
        break;
      }
      
      if (job.state === "failed") {
        console.log(`\n\n❌ Training failed: ${job.error || 'Unknown error'}`);
        break;
      }
      
      await new Promise(resolve => setTimeout(resolve, 5000));
    } catch (error: any) {
      console.error(`\n❌ Watch error: ${error.message}`);
      break;
    }
  }
}

function getStateEmoji(state: string): string {
  switch (state) {
    case 'queued': return '⏳';
    case 'preflight': return '🔍';
    case 'training': return '🏃';
    case 'evaluating': return '📊';
    case 'done': return '✅';
    case 'failed': return '❌';
    default: return '❓';
  }
}

function printUsage() {
  console.log(`
🤖 Skippy Training CLI

USAGE:
  skippy-train <command> [options]

COMMANDS:
  ppo                Start PPO training job
  status <job-id>    Check job status  
  results <job-id>   Get job results
  list               List recent jobs
  cancel <job-id>    Cancel queued job
  queue              Show queue status

PPO OPTIONS:
  --steps <number>        Training steps (default: 1000000)
  --duration <hours>      Training duration (overrides steps)
  --symbols <list>        Comma-separated symbols (default: BTC)
  --features <list>       Feature set (default: price,microstructure)
  --max-duration <hours>  Maximum duration limit (default: 12)
  --max-cost <usd>        Cost budget (default: 10)
  --skip-validation       Skip preflight checks
  --seed <number>         Random seed
  --version <string>      Model version (default: 1.1)
  --notes <string>        Job notes
  --watch <bool>          Watch progress (default: true)

EXAMPLES:
  skippy-train ppo --steps 500000 --symbols BTC,ETH
  skippy-train ppo --duration 2 --features price,microstructure,derivatives
  skippy-train status tr_1754123456_abc123
  skippy-train list --limit 20 --state done
  
ENVIRONMENT:
  ADMIN_SECRET         Required for API authentication
  TRAIN_API_HOST      API host (default: http://localhost:5000)
`);
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error(`❌ Unexpected error: ${error.message}`);
  process.exit(1);
});

process.on('unhandledRejection', (error: any) => {
  console.error(`❌ Unhandled promise rejection: ${error.message}`);
  process.exit(1);
});

// Run main function
main().catch(error => {
  console.error(`❌ CLI error: ${error.message}`);
  process.exit(1);
});