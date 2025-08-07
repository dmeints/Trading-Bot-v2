#!/usr/bin/env tsx

/**
 * STEVIE TRAINING DAY REPORTER
 * Visualization and analysis of Training Day results
 */

import fs from 'fs';
import path from 'path';
import { TrainingDayReport, TrainingIteration } from './trainIterate';

export class StevieTrainingReporter {
  private resultsDir = './training-results';

  async generateReport(sessionId?: string, plot: boolean = false): Promise<void> {
    console.log('📊 STEVIE TRAINING DAY ANALYSIS');
    console.log('='.repeat(50));

    let report: TrainingDayReport;
    
    if (sessionId) {
      const filepath = path.join(this.resultsDir, `training_day_${sessionId}.json`);
      if (!fs.existsSync(filepath)) {
        console.error(`❌ Session ${sessionId} not found`);
        return;
      }
      report = JSON.parse(fs.readFileSync(filepath, 'utf8'));
    } else {
      // Use latest report
      const latestPath = path.join(this.resultsDir, 'latest_training_day.json');
      if (!fs.existsSync(latestPath)) {
        console.error('❌ No training reports found');
        return;
      }
      report = JSON.parse(fs.readFileSync(latestPath, 'utf8'));
    }

    this.displayDetailedAnalysis(report);
    
    if (plot) {
      this.generatePlots(report);
    }

    this.generateComparisonAnalysis();
  }

  private displayDetailedAnalysis(report: TrainingDayReport): void {
    const duration = (report.endTime - report.startTime) / 1000;
    
    console.log(`📋 SESSION DETAILS`);
    console.log(`   ID: ${report.sessionId}`);
    console.log(`   Duration: ${(duration / 60).toFixed(1)} minutes`);
    console.log(`   Started: ${new Date(report.startTime).toLocaleString()}`);
    console.log(`   Completed: ${new Date(report.endTime).toLocaleString()}`);
    
    console.log(`\n🔄 VERSION PROGRESSION`);
    console.log(`   Initial: Stevie v${report.initialVersion}`);
    console.log(`   Final: Stevie v${report.finalVersion}`);
    console.log(`   Iterations: ${report.totalIterations} (${report.successfulIterations} successful)`);
    console.log(`   Success Rate: ${((report.successfulIterations / report.totalIterations) * 100).toFixed(1)}%`);
    
    console.log(`\n📈 PERFORMANCE METRICS`);
    console.log(`   Overall Improvement: ${(report.performanceTrend.overallImprovement * 100).toFixed(2)}%`);
    console.log(`   Average Per-Iteration Improvement: ${(report.performanceTrend.averageImprovement * 100).toFixed(2)}%`);
    console.log(`   Best Performance: ${report.performanceTrend.bestIteration.performance.totalReturn.toFixed(2)}% (v${report.performanceTrend.bestIteration.stevieVersion})`);
    console.log(`   Peak Sharpe Ratio: ${report.performanceTrend.bestIteration.performance.sharpeRatio.toFixed(3)}`);
    console.log(`   Peak Win Rate: ${report.performanceTrend.bestIteration.performance.winRate.toFixed(1)}%`);
    
    console.log(`\n🛑 STOPPING ANALYSIS`);
    console.log(`   Reason: ${report.stoppingCriteria.reason}`);
    console.log(`   Final Improvement: ${(report.stoppingCriteria.finalImprovement * 100).toFixed(3)}%`);
    console.log(`   Required Threshold: ${(report.stoppingCriteria.threshold * 100).toFixed(1)}%`);
    
    // Detailed iteration breakdown
    console.log(`\n📋 ITERATION BREAKDOWN`);
    console.log('   Iter | Stevie Ver | Benchmark Ver | Return | Sharpe | Improve | Status');
    console.log('   -----|------------|---------------|--------|--------|---------|--------');
    
    report.iterations.forEach(iteration => {
      const status = iteration.status === 'success' ? '✅ OK' : 
                    iteration.status === 'failed' ? '❌ FAIL' : '⚠️ POOR';
      const improve = iteration.iterationNumber > 1 ? 
        `${iteration.performance.improvement >= 0 ? '+' : ''}${(iteration.performance.improvement * 100).toFixed(1)}%` : 
        '   -  ';
      
      console.log(`   ${iteration.iterationNumber.toString().padStart(4)} | ${iteration.stevieVersion.padEnd(10)} | ${iteration.benchmarkVersion.padEnd(13)} | ${iteration.performance.totalReturn.toFixed(1).padStart(6)}% | ${iteration.performance.sharpeRatio.toFixed(3).padStart(6)} | ${improve.padStart(7)} | ${status}`);
    });

    // Performance trend analysis
    console.log(`\n📊 TREND ANALYSIS`);
    const performances = report.iterations.map(i => i.performance.totalReturn);
    const improvements = report.iterations.slice(1).map(i => i.performance.improvement);
    
    const avgPerformance = performances.reduce((sum, p) => sum + p, 0) / performances.length;
    const volatility = Math.sqrt(performances.reduce((sum, p) => sum + Math.pow(p - avgPerformance, 2), 0) / performances.length);
    const positiveImprovements = improvements.filter(i => i > 0).length;
    const consistencyRate = positiveImprovements / improvements.length;
    
    console.log(`   Average Performance: ${avgPerformance.toFixed(2)}%`);
    console.log(`   Performance Volatility: ${volatility.toFixed(2)}%`);
    console.log(`   Improvement Consistency: ${(consistencyRate * 100).toFixed(1)}%`);
    console.log(`   Learning Efficiency: ${((report.successfulIterations / report.totalIterations) * consistencyRate * 100).toFixed(1)}%`);
  }

  private generatePlots(report: TrainingDayReport): void {
    console.log(`\n📈 PERFORMANCE VISUALIZATION`);
    
    // ASCII plot of performance over iterations
    const performances = report.iterations.map(i => i.performance.totalReturn);
    const maxPerf = Math.max(...performances);
    const minPerf = Math.min(...performances);
    const range = maxPerf - minPerf || 1;
    
    console.log('   Performance Over Iterations:');
    console.log(`   ${maxPerf.toFixed(1)}% ┤`);
    
    for (let y = 10; y >= 0; y--) {
      const threshold = minPerf + (range * y / 10);
      let line = `   ${threshold >= 0 ? ' ' : ''}${threshold.toFixed(1).padStart(6)}% ┤`;
      
      for (let i = 0; i < performances.length; i++) {
        const perf = performances[i];
        if (Math.abs(perf - threshold) < range / 20) {
          line += '█';
        } else if (perf > threshold) {
          line += ' ';
        } else {
          line += '·';
        }
      }
      console.log(line);
    }
    
    console.log(`   ${minPerf.toFixed(1)}% └${'─'.repeat(performances.length)}`);
    console.log(`         ${report.iterations.map((_, i) => (i + 1).toString().slice(-1)).join('')}`);
    console.log('         Iteration Number');
    
    // Version progression visualization
    console.log(`\n🔄 VERSION PROGRESSION`);
    console.log('   Stevie Versions:');
    report.iterations.forEach((iteration, index) => {
      const bar = '█'.repeat(Math.max(1, Math.floor(iteration.performance.totalReturn / 2)));
      const status = iteration.status === 'success' ? '✅' : iteration.status === 'failed' ? '❌' : '⚠️';
      console.log(`   ${iteration.stevieVersion.padEnd(8)} ${status} ${bar} ${iteration.performance.totalReturn.toFixed(1)}%`);
    });
  }

  private generateComparisonAnalysis(): void {
    console.log(`\n🔍 HISTORICAL COMPARISON`);
    
    if (!fs.existsSync(this.resultsDir)) {
      console.log('   No historical data available');
      return;
    }
    
    const files = fs.readdirSync(this.resultsDir)
      .filter(f => f.startsWith('training_day_') && f.endsWith('.json'))
      .slice(-5); // Last 5 sessions
    
    if (files.length === 0) {
      console.log('   No historical training sessions found');
      return;
    }
    
    console.log(`   Comparing last ${files.length} training sessions:`);
    console.log('   Session                    | Iterations | Best Performance | Final Version');
    console.log('   ---------------------------|------------|------------------|---------------');
    
    files.forEach(filename => {
      try {
        const filepath = path.join(this.resultsDir, filename);
        const report: TrainingDayReport = JSON.parse(fs.readFileSync(filepath, 'utf8'));
        
        const sessionName = filename.replace('training_day_', '').replace('.json', '');
        const shortSession = sessionName.slice(-10); // Last 10 characters
        
        console.log(`   ${shortSession.padEnd(26)} | ${report.totalIterations.toString().padStart(10)} | ${report.performanceTrend.bestIteration.performance.totalReturn.toFixed(1).padStart(15)}% | v${report.finalVersion}`);
      } catch (error) {
        console.log(`   ${filename.padEnd(26)} | ERROR      |                - | -`);
      }
    });

    // Performance trend across sessions
    const sessionPerformances: number[] = [];
    files.forEach(filename => {
      try {
        const filepath = path.join(this.resultsDir, filename);
        const report: TrainingDayReport = JSON.parse(fs.readFileSync(filepath, 'utf8'));
        sessionPerformances.push(report.performanceTrend.bestIteration.performance.totalReturn);
      } catch (error) {
        // Skip invalid files
      }
    });

    if (sessionPerformances.length >= 2) {
      const improvement = (sessionPerformances[sessionPerformances.length - 1] - sessionPerformances[0]) / Math.abs(sessionPerformances[0]);
      console.log(`\n   📈 Multi-Session Trend: ${(improvement * 100).toFixed(1)}% improvement over ${sessionPerformances.length} sessions`);
    }
  }

  async generateSummaryReport(): Promise<void> {
    console.log('📋 TRAINING DAY SUMMARY REPORT');
    console.log('='.repeat(50));

    if (!fs.existsSync(this.resultsDir)) {
      console.log('No training results directory found');
      return;
    }

    const files = fs.readdirSync(this.resultsDir)
      .filter(f => f.startsWith('training_day_') && f.endsWith('.json'));
    
    console.log(`Total Training Sessions: ${files.length}`);
    
    if (files.length === 0) {
      console.log('No training sessions completed yet');
      return;
    }

    let totalIterations = 0;
    let totalSuccessfulIterations = 0;
    let bestOverallPerformance = -Infinity;
    let bestSession = '';
    const allVersions: string[] = [];

    files.forEach(filename => {
      try {
        const filepath = path.join(this.resultsDir, filename);
        const report: TrainingDayReport = JSON.parse(fs.readFileSync(filepath, 'utf8'));
        
        totalIterations += report.totalIterations;
        totalSuccessfulIterations += report.successfulIterations;
        
        if (report.performanceTrend.bestIteration.performance.totalReturn > bestOverallPerformance) {
          bestOverallPerformance = report.performanceTrend.bestIteration.performance.totalReturn;
          bestSession = filename;
        }
        
        report.iterations.forEach(iter => {
          if (!allVersions.includes(iter.stevieVersion)) {
            allVersions.push(iter.stevieVersion);
          }
        });
      } catch (error) {
        console.log(`Error reading ${filename}: ${error}`);
      }
    });

    console.log(`\n📊 AGGREGATE STATISTICS`);
    console.log(`Total Iterations: ${totalIterations}`);
    console.log(`Success Rate: ${((totalSuccessfulIterations / totalIterations) * 100).toFixed(1)}%`);
    console.log(`Best Performance: ${bestOverallPerformance.toFixed(2)}% (${bestSession})`);
    console.log(`Versions Explored: ${allVersions.sort().join(', ')}`);
  }
}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  
  const sessionId = args.find(arg => arg.startsWith('--session='))?.split('=')[1];
  const plot = args.includes('--plot');
  const summary = args.includes('--summary');
  
  const reporter = new StevieTrainingReporter();
  
  if (summary) {
    reporter.generateSummaryReport().catch(console.error);
  } else {
    reporter.generateReport(sessionId, plot).catch(console.error);
  }
}

// Export handled by class declaration