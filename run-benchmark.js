
const { spawn } = require('child_process');
const fs = require('fs');

console.log('🎯 Starting Stevie Benchmark Test...\n');

async function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    console.log(`🔧 Trying: ${command} ${args.join(' ')}`);
    
    const child = spawn(command, args, { 
      stdio: 'pipe', 
      cwd: process.cwd(),
      ...options 
    });
    
    let output = '';
    let error = '';
    
    child.stdout.on('data', (data) => {
      const text = data.toString();
      output += text;
      process.stdout.write(text);
    });
    
    child.stderr.on('data', (data) => {
      const text = data.toString();
      error += text;
      process.stderr.write(text);
    });
    
    child.on('close', (code) => {
      if (code === 0) {
        resolve({ success: true, output, error });
      } else {
        reject(new Error(`Command failed with exit code ${code}: ${error || 'Unknown error'}`));
      }
    });
    
    child.on('error', (err) => {
      reject(err);
    });
  });
}

function fileExists(path) {
  try {
    return fs.existsSync(path);
  } catch {
    return false;
  }
}

async function main() {
  console.log('📋 Checking available benchmark files...\n');
  
  const benchmarkFiles = [
    'server/training/benchmarkTest.ts',
    'tools/bench/run_benchmark.ts', 
    'cli/bench.ts',
    'tools/stevie_benchmark_suite.js',
    'stevie_v14_comprehensive_benchmark.ts',
    'stevie_v15_comprehensive_benchmark.ts'
  ];
  
  const availableFiles = benchmarkFiles.filter(fileExists);
  
  if (availableFiles.length === 0) {
    console.log('❌ No benchmark files found!');
    return;
  }
  
  console.log('✅ Available benchmark files:');
  availableFiles.forEach(file => console.log(`  - ${file}`));
  console.log('');
  
  // Try different execution approaches
  const approaches = [
    // Try Node.js directly on JS files
    ...(availableFiles.filter(f => f.endsWith('.js')).map(f => ['node', [f]])),
    
    // Try npx tsx on TypeScript files  
    ...(availableFiles.filter(f => f.endsWith('.ts')).map(f => ['npx', ['tsx', f, '--version=1.7', '--days=30', '--shocks=5', '--noise=10', '--slippage=0.2']])),
    
    // Try ts-node if available
    ...(availableFiles.filter(f => f.endsWith('.ts')).map(f => ['npx', ['ts-node', f]])),
    
    // CLI bench with parameters
    ['npx', ['tsx', 'cli/bench.ts', 'run', '--symbols', 'BTCUSDT', '--timeframe', '5m', '--from', '2024-01-01', '--to', '2024-02-01']],
    
    // Simple benchmark suite
    ['node', ['tools/stevie_benchmark_suite.js']]
  ];
  
  for (const [command, args] of approaches) {
    try {
      const result = await runCommand(command, args);
      if (result.success) {
        console.log('\n✅ Benchmark completed successfully!');
        console.log('\n📊 Results should be saved to:');
        console.log('  - ./benchmark-results/');
        console.log('  - ./artifacts/bench/');
        
        // Check for result files
        const resultPaths = [
          './benchmark-results/',
          './artifacts/bench/',
          './runs/'
        ];
        
        resultPaths.forEach(path => {
          if (fileExists(path)) {
            console.log(`  ✓ Found results in: ${path}`);
            try {
              const files = fs.readdirSync(path);
              const recentFiles = files.filter(f => 
                f.includes('.json') || f.includes('.csv') || f.includes('.md')
              ).slice(0, 3);
              recentFiles.forEach(f => console.log(`    - ${f}`));
            } catch (e) {
              // Ignore directory read errors
            }
          }
        });
        
        return;
      }
    } catch (error) {
      console.log(`❌ Failed: ${error.message}\n`);
      continue;
    }
  }
  
  // If all approaches failed, try installing missing dependencies
  console.log('\n🔧 All approaches failed. Installing missing dependencies...\n');
  
  try {
    await runCommand('npm', ['install', '--save-dev', 'tsx', 'typescript', 'ts-node']);
    console.log('✅ Dependencies installed. Retrying benchmark...\n');
    
    // Retry the most promising approaches
    const retryApproaches = [
      ['npx', ['tsx', 'server/training/benchmarkTest.ts', '--version=1.7', '--days=30']],
      ['npx', ['tsx', 'tools/bench/run_benchmark.ts']],
      ['node', ['tools/stevie_benchmark_suite.js']]
    ];
    
    for (const [command, args] of retryApproaches) {
      try {
        const result = await runCommand(command, args);
        if (result.success) {
          console.log('\n✅ Benchmark completed after dependency installation!');
          return;
        }
      } catch (error) {
        console.log(`❌ Retry failed: ${error.message}\n`);
      }
    }
    
  } catch (error) {
    console.error('❌ Failed to install dependencies:', error.message);
  }
  
  console.log('\n📋 Manual options to try:');
  console.log('1. npm install --save-dev tsx typescript');
  console.log('2. npx tsx server/training/benchmarkTest.ts --version=1.7 --days=30');
  console.log('3. node tools/stevie_benchmark_suite.js');
  console.log('4. Check that benchmark files exist and are not corrupted');
}

main().catch(console.error);
