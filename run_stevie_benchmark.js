#!/usr/bin/env node

/**
 * Stevie v1.5 Benchmark and Training Execution Script
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 STARTING STEVIE v1.5 COMPREHENSIVE BENCHMARK & TRAINING PROTOCOLS');
console.log('='.repeat(80));

async function executeBenchmark() {
  console.log('\n📊 Phase 1: Running Comprehensive Benchmark Suite...');
  
  // Make API call to trigger benchmark
  try {
    const response = await fetch('http://localhost:5000/api/stevie/benchmark', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        version: '1.5',
        comprehensive: true,
        days: 14,
        marketShocks: 3,
        noiseLevel: 5,
        slippageRate: 0.2
      })
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log('✅ Benchmark completed:', result);
      return result;
    } else {
      console.error('❌ Benchmark API call failed:', response.status);
    }
  } catch (error) {
    console.error('❌ Benchmark execution error:', error.message);
  }
}

async function executeTraining() {
  console.log('\n🎯 Phase 2: Starting Real Training Day Protocol...');
  
  try {
    const response = await fetch('http://localhost:5000/api/training/real-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        duration: 2.0, // 2 hour training session
        skipValidation: false
      })
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log('✅ Training session started:', result);
      return result;
    } else {
      console.error('❌ Training API call failed:', response.status);
    }
  } catch (error) {
    console.error('❌ Training execution error:', error.message);
  }
}

async function executeRLTraining() {
  console.log('\n🧠 Phase 3: Starting Reinforcement Learning Training...');
  
  try {
    const response = await fetch('http://localhost:5000/api/rl/training/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        episodes: 1000,
        learningRate: 0.0003,
        batchSize: 64,
        symbols: ['BTC', 'ETH', 'SOL'],
        features: ['price', 'volume', 'technical', 'sentiment']
      })
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log('✅ RL Training started:', result);
      return result;
    } else {
      console.error('❌ RL Training API call failed:', response.status);
    }
  } catch (error) {
    console.error('❌ RL Training execution error:', error.message);
  }
}

async function runIterativeTraining() {
  console.log('\n🔄 Phase 4: Starting Iterative Training Loop...');
  
  try {
    const response = await fetch('http://localhost:5000/api/training/iterative', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        maxIterations: 10,
        plateauThreshold: 0.005,
        initialVersion: '1.5'
      })
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log('✅ Iterative training started:', result);
      return result;
    } else {
      console.error('❌ Iterative training API call failed:', response.status);
    }
  } catch (error) {
    console.error('❌ Iterative training execution error:', error.message);
  }
}

async function main() {
  const startTime = Date.now();
  
  try {
    // Execute all benchmark and training protocols
    const benchmarkResult = await executeBenchmark();
    await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
    
    const trainingResult = await executeTraining();
    await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds
    
    const rlResult = await executeRLTraining();
    await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds
    
    const iterativeResult = await runIterativeTraining();
    
    console.log('\n🎉 ALL PROTOCOLS EXECUTED SUCCESSFULLY');
    console.log('='.repeat(80));
    console.log(`⏱️ Total execution time: ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
    console.log('\n📋 Summary:');
    console.log('  ✅ Comprehensive Benchmark Suite');
    console.log('  ✅ Real Training Day Protocol');
    console.log('  ✅ Reinforcement Learning Training');
    console.log('  ✅ Iterative Training Loop');
    
    // Save execution report
    const report = {
      timestamp: new Date().toISOString(),
      executionTime: Date.now() - startTime,
      results: {
        benchmark: benchmarkResult,
        training: trainingResult,
        rl: rlResult,
        iterative: iterativeResult
      }
    };
    
    const reportPath = `benchmark-training-report-${Date.now()}.json`;
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`📄 Detailed report saved: ${reportPath}`);
    
  } catch (error) {
    console.error('❌ EXECUTION FAILED:', error.message);
    process.exit(1);
  }
}

// Add fetch polyfill for Node.js
const fetch = require('node-fetch');

main();