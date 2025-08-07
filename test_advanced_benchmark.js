// Quick test for Stevie Advanced Benchmarking System
const fetch = require('node-fetch');

async function testAdvancedBenchmark() {
  console.log('🎯 Testing Stevie Advanced Benchmarking Suite...\n');
  
  try {
    console.log('Running comprehensive benchmark for Version 1.1...');
    
    const response = await fetch('http://localhost:5000/api/stevie/benchmark/advanced/run', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ version: '1.1' })
    });
    
    if (response.status === 200) {
      const result = await response.json();
      
      console.log('\n✅ BENCHMARK COMPLETED SUCCESSFULLY!\n');
      console.log('📊 EXECUTIVE SUMMARY:');
      console.log(`Version: ${result.data.summary.version}`);
      console.log(`Overall Score: ${result.data.summary.overallScore}/100`);
      console.log(`Total Trades: ${result.data.summary.totalTrades}`);
      console.log(`Sharpe Ratio: ${result.data.summary.sharpeRatio.toFixed(3)}`);
      console.log(`Max Drawdown: ${(result.data.summary.maxDrawdown * 100).toFixed(2)}%`);
      console.log(`Win Rate: ${(result.data.summary.winRate * 100).toFixed(1)}%`);
      console.log(`Consistency: ${result.data.summary.consistency.toFixed(3)}`);
      
      console.log('\n🎯 OPTIMIZED PARAMETERS:');
      Object.entries(result.data.summary.bestParams).forEach(([key, value]) => {
        console.log(`  ${key}: ${value}`);
      });
      
      console.log('\n📈 TOP RECOMMENDATIONS:');
      result.data.summary.topRecommendations.forEach((rec, i) => {
        console.log(`${i + 1}. ${rec}`);
      });
      
      console.log('\n🎉 Advanced benchmarking system is fully operational!');
      return true;
    } else {
      console.log(`❌ Request failed with status: ${response.status}`);
      return false;
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    return false;
  }
}

// Run test
testAdvancedBenchmark().then(success => {
  process.exit(success ? 0 : 1);
});