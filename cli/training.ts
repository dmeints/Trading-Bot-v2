#!/usr/bin/env tsx
import { Command } from 'commander';
import fetch from 'node-fetch';

const program = new Command();

program
  .name('skippy-training')
  .description('Skippy training CLI tool')
  .version('1.0.0');

program
  .command('start')
  .description('Start a new training job')
  .requiredOption('-d, --duration <hours>', 'training duration in hours')
  .requiredOption('-s, --symbols <symbols>', 'comma-separated symbols (e.g., BTC,ETH)')
  .option('--seed <seed>', 'random seed for reproducibility')
  .option('--features <features>', 'comma-separated feature list')
  .option('--notes <notes>', 'training notes')
  .action(async (options) => {
    const request = {
      durationHours: parseFloat(options.duration),
      symbols: options.symbols.split(','),
      seed: options.seed ? parseInt(options.seed) : undefined,
      features: options.features ? options.features.split(',') : undefined,
      notes: options.notes,
    };
    
    console.log('Starting training job with:', request);
    
    try {
      const response = await fetch('http://localhost:5000/api/training-jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      });
      
      const result = await response.json();
      
      if (response.ok) {
        console.log(`Training job created: ${result.jobId}`);
        console.log(`Status: ${result.status}`);
      } else {
        console.error('Failed to create training job:', result.error);
      }
    } catch (error) {
      console.error('Network error:', error);
    }
  });

program
  .command('status <jobId>')
  .description('Check training job status')
  .action(async (jobId) => {
    try {
      const response = await fetch(`http://localhost:5000/api/training-jobs/${jobId}`);
      const result = await response.json();
      
      if (response.ok) {
        console.log('Job Status:', JSON.stringify(result, null, 2));
      } else {
        console.error('Job not found:', result.error);
      }
    } catch (error) {
      console.error('Network error:', error);
    }
  });

program
  .command('list')
  .description('List all training jobs')
  .action(async () => {
    try {
      const response = await fetch('http://localhost:5000/api/training-jobs');
      const jobs = await response.json();
      
      console.log('Training Jobs:');
      jobs.forEach((job: any) => {
        console.log(`- ${job.jobId}: ${job.state} (${Math.round(job.progress * 100)}%)`);
      });
    } catch (error) {
      console.error('Network error:', error);
    }
  });

program.parse();