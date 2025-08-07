// Direct benchmark test for Stevie v1.1
const { stevieBenchmark } = require('./server/services/stevieBenchmark.ts');

async function runDirectBenchmark() {
  console.log('🎯 Running Stevie Algorithm Benchmark - Version 1.1\n');
  
  try {
    const report = await stevieBenchmark.runBenchmark('benchmark-test-user');
    const formattedReport = stevieBenchmark.formatBenchmarkReport(report);
    
    console.log(formattedReport);
    console.log('\n✅ Benchmark completed successfully!');
    
    return report;
  } catch (error) {
    console.error('❌ Benchmark failed:', error.message);
    return null;
  }
}

// Run if called directly
if (require.main === module) {
  runDirectBenchmark();
}

module.exports = { runDirectBenchmark };