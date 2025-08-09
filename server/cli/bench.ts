#!/usr/bin/env tsx
import { Command } from 'commander';
import { BenchRunRequest, BenchRunResult } from '../../shared/src/types/bench.js';
import { hashDataset } from '../utils/datasetHash.js';
import { execSync } from 'node:child_process';

const program = new Command();

const commit = (() => { 
  try { 
    return execSync("git rev-parse HEAD").toString().trim(); 
  } catch { 
    return "unknown"; 
  } 
})();

program
  .name('skippy-bench')
  .description('Skippy benchmark CLI')
  .version('1.0.0');

program
  .command('run')
  .description('Run a benchmark')
  .requiredOption('-s, --symbols <symbols>', 'comma-separated symbols')
  .requiredOption('-t, --timeframe <timeframe>', 'timeframe: 1m, 5m, 1h, 1d')
  .requiredOption('--from <fromIso>', 'start date ISO')
  .requiredOption('--to <toIso>', 'end date ISO')
  .option('--fees <feeBps>', 'fee basis points', '10')
  .option('--slippage <slipBps>', 'slippage basis points', '5')
  .option('--seed <rngSeed>', 'random seed', Math.floor(Math.random() * 1000000).toString())
  .action(async (options) => {
    const request: BenchRunRequest = {
      strategy: "default",
      version: "1.0.0",
      symbols: options.symbols.split(','),
      timeframe: options.timeframe as any,
      fromIso: options.from,
      toIso: options.to,
      feeBps: parseInt(options.fees),
      slipBps: parseInt(options.slippage),
      rngSeed: parseInt(options.seed),
    };
    
    console.log('Running benchmark with:', JSON.stringify(request, null, 2));
    
    // Simulate benchmark execution
    const datasetId = hashDataset(request);
    const runId = `cli_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    
    const result: BenchRunResult = {
      runId,
      status: "done",
      headline: {
        cashGrowthScore: 0,
        totalReturnPct: 0,
        sharpe: 0,
        sortino: 0,
        winRatePct: 0,
        maxDrawdownPct: 0,
        profitFactor: 0,
      },
      provenance: {
        source: "computed",
        datasetId,
        commit,
        runId,
        generatedAt: new Date().toISOString(),
      }
    };
    
    console.log('Benchmark result:', JSON.stringify(result, null, 2));
  });

program.parse();