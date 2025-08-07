#!/usr/bin/env node
/**
 * TEMPORAL OMNISCIENCE CLI COMMANDS
 * Multi-timeframe analysis, causal inference, and prediction accuracy
 */

import { Command } from 'commander';
import { temporalAnalyzer } from '../../server/services/temporalAnalyzer';
import { causalInference } from '../../server/services/causalInference';
import { predictionAccuracy } from '../../server/services/predictionAccuracy';

const temporalCommand = new Command('temporal');

temporalCommand
  .description('Temporal omniscience - multi-timeframe analysis, causal inference, and prediction tracking');

// Multi-timeframe analysis command
temporalCommand
  .command('analyze')
  .description('Multi-timeframe analysis across all time horizons')
  .option('--asset <asset>', 'Asset to analyze', 'BTC')
  .action(async (options) => {
    console.log(`🕐 MULTI-TIMEFRAME ANALYSIS: ${options.asset}`);
    
    try {
      const analysis = await temporalAnalyzer.analyzeMultiTimeframe(options.asset);
      
      console.log('\n📊 TIMEFRAME CONVERGENCE:');
      const conv = analysis.convergence;
      console.log(`   Bullish: ${conv.bullish}% | Bearish: ${conv.bearish}% | Neutral: ${conv.neutral}%`);
      console.log(`   Alignment Strength: ${conv.strength.toUpperCase()}`);
      
      console.log('\n⏱️ TIMEFRAME PATTERNS:');
      Object.entries(analysis.analysis).forEach(([tf, data]) => {
        const trend = data.patterns.trend === 'bullish' ? '📈' : 
                     data.patterns.trend === 'bearish' ? '📉' : '➡️';
        console.log(`   ${tf.padEnd(4)}: ${trend} ${data.patterns.trend} (${data.patterns.momentum.toFixed(1)}% momentum, ${data.patterns.volatility.toFixed(1)}% vol)`);
      });
      
      console.log('\n🔗 TOP CAUSAL RELATIONSHIPS:');
      analysis.causalChains.slice(0, 5).forEach((causal, i) => {
        console.log(`   ${i + 1}. ${causal.cause} → ${causal.effect}`);
        console.log(`      Strength: ${(causal.strength * 100).toFixed(0)}% | Delay: ${causal.timeDelay}min | Confidence: ${(causal.confidence * 100).toFixed(0)}%`);
      });
      
      console.log('\n🎯 KEY PREDICTIONS:');
      analysis.predictions.slice(0, 3).forEach((pred, i) => {
        const dir = pred.prediction.direction === 'up' ? '📈' : pred.prediction.direction === 'down' ? '📉' : '➡️';
        console.log(`   ${i + 1}. ${pred.timeframe}: ${dir} ${pred.prediction.direction} ${pred.prediction.magnitude.toFixed(1)}%`);
        console.log(`      Probability: ${(pred.prediction.probability * 100).toFixed(0)}% | Confidence: ${(pred.prediction.confidence * 100).toFixed(0)}%`);
        console.log(`      Reasoning: ${pred.reasoning}`);
      });
      
    } catch (error) {
      console.error('❌ Multi-timeframe analysis failed:', error);
      process.exit(1);
    }
  });

// Temporal signal command
temporalCommand
  .command('signal')
  .description('Get temporal trading signal')
  .option('--asset <asset>', 'Asset to analyze', 'BTC')
  .action(async (options) => {
    console.log(`🎯 TEMPORAL SIGNAL: ${options.asset}`);
    
    try {
      const signal = await temporalAnalyzer.getTemporalSignal(options.asset);
      
      const directionIcon = signal.direction === 'bullish' ? '📈' : 
                           signal.direction === 'bearish' ? '📉' : '➡️';
      
      console.log('\n🚦 TRADING SIGNAL:');
      console.log(`   Direction: ${directionIcon} ${signal.direction.toUpperCase()}`);
      console.log(`   Strength: ${signal.strength}/100`);
      console.log(`   Confidence: ${signal.confidence}%`);
      console.log(`   Time Horizon: ${signal.timeHorizon}`);
      console.log(`   Reasoning: ${signal.reasoning}`);
      
      console.log('\n💡 RECOMMENDATION:');
      if (signal.strength > 60 && signal.confidence > 70) {
        console.log(`   Strong ${signal.direction} signal - Consider ${signal.direction === 'bullish' ? 'long' : 'short'} position`);
      } else if (signal.strength > 30 && signal.confidence > 50) {
        console.log(`   Moderate ${signal.direction} signal - Monitor for confirmation`);
      } else {
        console.log('   Weak signal - Wait for clearer directional bias');
      }
      
    } catch (error) {
      console.error('❌ Temporal signal failed:', error);
      process.exit(1);
    }
  });

// Causal analysis command
temporalCommand
  .command('causals')
  .description('Analyze causal relationships and event predictions')
  .option('--hours <hours>', 'Time window in hours', '24')
  .action(async (options) => {
    console.log('🔗 CAUSAL INFERENCE ANALYSIS');
    
    try {
      const timeWindow = parseInt(options.hours);
      const [events, signal] = await Promise.all([
        causalInference.identifyCausalEvents(timeWindow),
        causalInference.getStrongestCausalSignal()
      ]);
      
      const effects = await causalInference.analyzeCausalEffects(events);
      const predictions = await causalInference.getEventPredictions(4);
      
      console.log('\n📅 RECENT CAUSAL EVENTS:');
      events.slice(0, 5).forEach((event, i) => {
        const timeAgo = Math.floor((Date.now() - event.timestamp.getTime()) / (1000 * 60 * 60));
        console.log(`   ${i + 1}. ${event.type.toUpperCase()}: ${event.description}`);
        console.log(`      ${timeAgo}h ago | Magnitude: ${event.magnitude}/100 | Asset: ${event.asset}`);
      });
      
      console.log('\n⚡ CAUSAL EFFECTS:');
      effects.slice(0, 3).forEach((effect, i) => {
        console.log(`   ${i + 1}. ${effect.event.description.slice(0, 50)}...`);
        console.log(`      Immediate: ${effect.priceImpact.immediate.toFixed(1)}% | Short: ${effect.priceImpact.shortTerm.toFixed(1)}% | Medium: ${effect.priceImpact.mediumTerm.toFixed(1)}%`);
        if (effect.cascadingEffects.length > 0) {
          console.log(`      Cascading: ${effect.cascadingEffects[0]}`);
        }
      });
      
      console.log('\n🔮 UPCOMING PREDICTIONS:');
      predictions.slice(0, 3).forEach((pred, i) => {
        const timeLeft = Math.floor(pred.timeRemaining);
        console.log(`   ${i + 1}. ${pred.event.description.slice(0, 40)}...`);
        console.log(`      Expected in: ${timeLeft}min | Probability: ${(pred.probability * 100).toFixed(0)}%`);
        console.log(`      Impact: ${pred.expectedEffect.priceImpact.immediate.toFixed(1)}%`);
      });
      
      console.log('\n🎯 STRONGEST CAUSAL SIGNAL:');
      const sigIcon = signal.signal === 'bullish' ? '📈' : signal.signal === 'bearish' ? '📉' : '➡️';
      console.log(`   Signal: ${sigIcon} ${signal.signal.toUpperCase()}`);
      console.log(`   Strength: ${signal.strength}/100`);
      console.log(`   Confidence: ${signal.confidence}%`);
      console.log(`   Primary Cause: ${signal.primaryCause}`);
      console.log(`   Timeframe: ${signal.timeframe}`);
      
    } catch (error) {
      console.error('❌ Causal analysis failed:', error);
      process.exit(1);
    }
  });

// Prediction accuracy command
temporalCommand
  .command('accuracy')
  .description('View prediction accuracy metrics and performance')
  .action(async () => {
    console.log('📊 PREDICTION ACCURACY REPORT');
    
    try {
      const report = predictionAccuracy.getAccuracyReport();
      
      console.log('\n🎯 OVERALL PERFORMANCE:');
      console.log(`   Total Predictions: ${report.overall.totalPredictions}`);
      console.log(`   Avg Direction Accuracy: ${report.overall.avgDirectionAccuracy.toFixed(1)}%`);
      console.log(`   Avg Magnitude Error: ${report.overall.avgMagnitudeMAE.toFixed(1)} percentage points`);
      console.log(`   Best Source: ${report.overall.bestPerformingSource}`);
      console.log(`   Best Timeframe: ${report.overall.bestPerformingTimeframe}`);
      
      console.log('\n🏆 TOP PERFORMERS:');
      report.topPerformers.slice(0, 5).forEach((perf, i) => {
        const trend = perf.recentPerformance.trend === 'improving' ? '📈' : 
                     perf.recentPerformance.trend === 'declining' ? '📉' : '➡️';
        console.log(`   ${i + 1}. ${perf.source} (${perf.timeframe}): ${perf.metrics.directionAccuracy.toFixed(1)}% accuracy`);
        console.log(`      Samples: ${perf.metrics.totalPredictions} | Trend: ${trend} ${perf.recentPerformance.trend}`);
        console.log(`      Calibration: ${perf.metrics.calibration.toFixed(1)}% | Sharpe: ${perf.metrics.sharpeRatio.toFixed(2)}`);
      });
      
      console.log('\n📈 BY SOURCE:');
      Object.entries(report.bySource).forEach(([source, metrics]) => {
        const avgAccuracy = metrics.reduce((sum, m) => sum + m.metrics.directionAccuracy, 0) / metrics.length;
        const totalSamples = metrics.reduce((sum, m) => sum + m.metrics.totalPredictions, 0);
        console.log(`   ${source}: ${avgAccuracy.toFixed(1)}% avg accuracy (${totalSamples} samples)`);
        
        metrics.forEach(m => {
          const trend = m.recentPerformance.trend === 'improving' ? '📈' : 
                       m.recentPerformance.trend === 'declining' ? '📉' : '➡️';
          console.log(`     ${m.timeframe}: ${m.metrics.directionAccuracy.toFixed(1)}% ${trend}`);
        });
      });
      
      console.log('\n⏰ BY TIMEFRAME:');
      Object.entries(report.byTimeframe).forEach(([timeframe, metrics]) => {
        const avgAccuracy = metrics.reduce((sum, m) => sum + m.metrics.directionAccuracy, 0) / metrics.length;
        const totalSamples = metrics.reduce((sum, m) => sum + m.metrics.totalPredictions, 0);
        console.log(`   ${timeframe}: ${avgAccuracy.toFixed(1)}% avg accuracy (${totalSamples} samples)`);
      });
      
    } catch (error) {
      console.error('❌ Accuracy report failed:', error);
      process.exit(1);
    }
  });

// Intelligence command - comprehensive analysis
temporalCommand
  .command('intelligence')
  .description('Comprehensive temporal intelligence report')
  .option('--asset <asset>', 'Asset to analyze', 'BTC')
  .action(async (options) => {
    console.log(`🧠 TEMPORAL OMNISCIENCE INTELLIGENCE: ${options.asset}`);
    
    try {
      const [signal, causalSignal, accuracyReport] = await Promise.all([
        temporalAnalyzer.getTemporalSignal(options.asset),
        causalInference.getStrongestCausalSignal(),
        predictionAccuracy.getAccuracyReport()
      ]);
      
      // Composite intelligence score
      const signals = [
        { name: 'Temporal', strength: signal.strength, confidence: signal.confidence, direction: signal.direction },
        { name: 'Causal', strength: causalSignal.strength, confidence: causalSignal.confidence, direction: causalSignal.signal }
      ];
      
      let compositeScore = 0;
      let totalWeight = 0;
      
      signals.forEach(s => {
        const weight = s.confidence / 100;
        const score = s.direction === 'bullish' ? s.strength : s.direction === 'bearish' ? -s.strength : 0;
        compositeScore += score * weight;
        totalWeight += weight;
      });
      
      const normalizedScore = totalWeight > 0 ? compositeScore / totalWeight : 0;
      const compositeDirection = normalizedScore > 5 ? 'BULLISH' : normalizedScore < -5 ? 'BEARISH' : 'NEUTRAL';
      const compositeStrength = Math.abs(normalizedScore);
      const overallConfidence = (totalWeight / signals.length) * 100;
      
      console.log('\n🎯 COMPOSITE INTELLIGENCE:');
      const compIcon = compositeDirection === 'BULLISH' ? '📈' : compositeDirection === 'BEARISH' ? '📉' : '➡️';
      console.log(`   Direction: ${compIcon} ${compositeDirection}`);
      console.log(`   Strength: ${compositeStrength.toFixed(0)}/100`);
      console.log(`   Confidence: ${overallConfidence.toFixed(0)}%`);
      
      console.log('\n📊 SIGNAL BREAKDOWN:');
      signals.forEach(s => {
        const icon = s.direction === 'bullish' ? '📈' : s.direction === 'bearish' ? '📉' : '➡️';
        console.log(`   ${s.name}: ${icon} ${s.direction} (${s.strength}/100 strength, ${s.confidence}% confidence)`);
      });
      
      console.log('\n🔍 KEY INSIGHTS:');
      console.log(`   • Temporal: ${signal.reasoning}`);
      console.log(`   • Causal: ${causalSignal.primaryCause.slice(0, 60)}...`);
      
      console.log('\n📈 PREDICTION QUALITY:');
      console.log(`   • Best Performing Source: ${accuracyReport.overall.bestPerformingSource}`);
      console.log(`   • Overall Direction Accuracy: ${accuracyReport.overall.avgDirectionAccuracy.toFixed(1)}%`);
      console.log(`   • Total Historical Predictions: ${accuracyReport.overall.totalPredictions}`);
      
      console.log('\n💡 TRADING RECOMMENDATION:');
      if (compositeStrength > 40 && overallConfidence > 65) {
        console.log(`   🚀 HIGH CONVICTION: Strong ${compositeDirection.toLowerCase()} signal across multiple timeframes`);
        console.log(`   📋 Action: Consider ${compositeDirection === 'BULLISH' ? 'long' : 'short'} position with appropriate risk management`);
      } else if (compositeStrength > 20 && overallConfidence > 50) {
        console.log(`   ⚠️  MODERATE SIGNAL: ${compositeDirection} bias detected but requires confirmation`);
        console.log(`   📋 Action: Monitor closely, wait for additional confirmation signals`);
      } else {
        console.log(`   😐 NEUTRAL/WEAK: No clear directional bias across timeframes`);
        console.log(`   📋 Action: Stay on sidelines or use range-trading strategies`);
      }
      
    } catch (error) {
      console.error('❌ Temporal intelligence failed:', error);
      process.exit(1);
    }
  });

export { temporalCommand };