#!/usr/bin/env tsx
import { Command } from 'commander';
import fs from "fs";
import path from "path";

const program = new Command();

program
  .name('skippy-bench')
  .description('Skippy benchmark CLI tool')
  .version('1.0.0');

program
  .command('run')
  .description('Run a benchmark test')
  .requiredOption('-s, --symbols <symbols>', 'comma-separated symbols (e.g., BTC,ETH)')
  .requiredOption('-t, --timeframe <timeframe>', 'timeframe: 1m, 5m, 1h, 1d')
  .requiredOption('--from <fromIso>', 'start date in ISO format')
  .requiredOption('--to <toIso>', 'end date in ISO format')
  .option('--fees <feeBps>', 'fee basis points', '10')
  .option('--slippage <slipBps>', 'slippage basis points', '5')
  .option('--seed <rngSeed>', 'random seed', Math.floor(Math.random() * 1000000).toString())
  .action(async (options) => {
    console.log('Running benchmark with options:', options);
    
    // Create a basic manifest
    const manifest = {
      strategy: "default",
      version: "1.0.0",
      symbols: options.symbols.split(','),
      timeframe: options.timeframe,
      fromIso: options.from,
      toIso: options.to,
      feeBps: parseInt(options.fees),
      slipBps: parseInt(options.slippage),
      rngSeed: parseInt(options.seed),
      timestamp: new Date().toISOString(),
    };
    
    // Ensure bench-results directory exists
    const benchDir = path.resolve("bench-results");
    if (!fs.existsSync(benchDir)) {
      fs.mkdirSync(benchDir, { recursive: true });
    }
    
    // Write manifest
    const manifestPath = path.join(benchDir, `manifest_${Date.now()}.json`);
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    
    console.log(`Benchmark manifest written to: ${manifestPath}`);
    console.log('Benchmark completed successfully');
  });

program.parse();