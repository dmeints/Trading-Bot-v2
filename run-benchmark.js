
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
    // Try the CLI bench command with node
    ['node', ['cli/bench.ts']],
    
    // Try the server CLI bench
    ['node', ['server/cli/bench.ts']],
    
    // Try the comprehensive benchmark suite
    ['node', ['tools/stevie_benchmark_suite.js']],
    
    // Try the walk-forward benchmark
    ['node', ['tools/bench/run_benchmark.ts']],
    
    // Try with npx tsx if available
    ['npx', ['tsx', 'server/training/benchmarkTest.ts', '--version=1.7', '--days=30']]
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
      continue;
    }
  }
  
  console.log('\n🔧 Installing tsx and trying again...');
  
  // Install tsx if not available
  try {
    console.log('Installing tsx...');
    await runCommand('npm', ['install', '--save-dev', 'tsx']);
    
    // Try tsx approaches after installation
    const tsxApproaches = [
      ['npx', ['tsx', 'server/training/benchmarkTest.ts', '--version=1.7', '--days=30']],
      ['npx', ['tsx', 'tools/bench/run_benchmark.ts']],
      ['npx', ['tsx', 'server/cli/bench.ts', 'run', '--symbols', 'BTCUSDT', '--timeframe', '5m', '--from', '2024-01-01', '--to', '2024-02-01']]
    ];
    
    for (const [cmd, cmdArgs] of tsxApproaches) {
      console.log(`Trying with tsx: ${cmd} ${cmdArgs.join(' ')}`);
      try {
        const result = await runCommand(cmd, cmdArgs);
        if (result.success) {
          console.log('✅ Benchmark completed with tsx!');
          console.log(result.output);
          return;
        }
      } catch (error) {
        console.log(`❌ tsx attempt failed: ${error.message}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Failed to install tsx:', error.message);
  }
  
  console.log('\n📋 All benchmark approaches failed. Available options:');
  console.log('1. Ensure tsx is installed: npm install --save-dev tsx');
  console.log('2. Try manual command: npx tsx server/training/benchmarkTest.ts --version=1.7 --days=30');
  console.log('3. Check if benchmark files exist in the expected locations');
}

function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'pipe', cwd: process.cwd() });
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
        reject(new Error(`Command failed with exit code ${code}: ${error || 'Unknown error'}`));
      }
    });
    
    child.on('error', (err) => {
      reject(new Error(`Failed to start command: ${err.message}`));
    });
  });
}

// Run the benchmark
runBenchmark().catch(console.error);
