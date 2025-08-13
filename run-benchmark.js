
#!/usr/bin/env node

/**
 * Simple Node.js wrapper for running Stevie benchmarks
 */

const { spawn } = require('child_process');
const path = require('path');

// Try different approaches to run the benchmark
async function runBenchmark() {
  console.log('🎯 Starting Stevie Benchmark Test...\n');
  
  const approaches = [
    // Try with npx tsx
    ['npx', ['tsx', 'server/training/benchmarkTest.ts', '--version=1.7', '--days=30']],
    
    // Try with node and tsx loader
    ['node', ['--loader', 'tsx', 'server/training/benchmarkTest.ts', '--version=1.7', '--days=30']],
    
    // Try the comprehensive benchmark suite
    ['node', ['tools/stevie_benchmark_suite.js']],
    
    // Try the walk-forward benchmark
    ['node', ['--loader', 'tsx', 'tools/bench/run_benchmark.ts']]
  ];
  
  for (const [command, args] of approaches) {
    console.log(`Trying: ${command} ${args.join(' ')}`);
    
    try {
      const result = await runCommand(command, args);
      if (result.success) {
        console.log('✅ Benchmark completed successfully!');
        console.log(result.output);
        return;
      }
    } catch (error) {
      console.log(`❌ Failed: ${error.message}`);
    }
  }
  
  console.log('\n🔧 All approaches failed. Installing dependencies...');
  
  // Install tsx if not available
  try {
    await runCommand('npm', ['install', '--save-dev', 'tsx', 'typescript', '@types/node']);
    console.log('✅ Dependencies installed. Retrying benchmark...');
    
    const result = await runCommand('npx', ['tsx', 'server/training/benchmarkTest.ts', '--version=1.7', '--days=30']);
    if (result.success) {
      console.log('✅ Benchmark completed after installing dependencies!');
      console.log(result.output);
    }
  } catch (error) {
    console.error('❌ Failed to install dependencies or run benchmark:', error.message);
  }
}

function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'pipe' });
    let output = '';
    let error = '';
    
    child.stdout.on('data', (data) => {
      output += data.toString();
      process.stdout.write(data);
    });
    
    child.stderr.on('data', (data) => {
      error += data.toString();
      process.stderr.write(data);
    });
    
    child.on('close', (code) => {
      if (code === 0) {
        resolve({ success: true, output, error });
      } else {
        reject(new Error(`Command failed with exit code ${code}: ${error}`));
      }
    });
    
    child.on('error', (err) => {
      reject(new Error(`Failed to start command: ${err.message}`));
    });
  });
}

// Run the benchmark
runBenchmark().catch(console.error);
