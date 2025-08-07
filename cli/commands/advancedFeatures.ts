#!/usr/bin/env node
/**
 * ADVANCED FEATURES CLI COMMANDS
 * Multi-modal signals, risk management, and adversarial training commands
 */

import { Command } from 'commander';
import { newsService } from '../../server/services/newsService';
import { flowAnalyzer } from '../../server/services/flowAnalyzer';
import { sentimentService } from '../../server/services/sentimentService';
import { riskSizingService } from '../../server/services/riskSizingService';
import { adversarialTrainer } from '../../server/services/adversarialTrainer';

const advancedCommand = new Command('advanced');

advancedCommand
  .description('Advanced trading features - multi-modal signals, risk management, and adversarial training');

// News analysis commands
advancedCommand
  .command('news')
  .description('Analyze news impact and sentiment')
  .option('--timeframe <timeframe>', 'Analysis timeframe', '24h')
  .action(async (options) => {
    console.log('📰 NEWS IMPACT ANALYSIS');
    
    try {
      const [impacts, sentiment, analytics] = await Promise.all([
        newsService.getEventImpactScores(options.timeframe),
        newsService.getAggregatedMarketSentiment(),
        newsService.getNewsAnalytics(options.timeframe)
      ]);

      console.log('\n🎯 HIGH IMPACT EVENTS:');
      impacts.filter(i => i.severity > 0.7).forEach(impact => {
        console.log(`   ${impact.title}`);
        console.log(`   Impact: ${impact.impact}, Severity: ${(impact.severity * 100).toFixed(1)}%`);
        console.log(`   Affected: ${impact.affectedAssets.join(', ')}`);
        console.log(`   Predicted: ${impact.predictedMovement.direction} ${impact.predictedMovement.magnitude.toFixed(1)}%`);
        console.log('');
      });

      console.log('📊 MARKET SENTIMENT:');
      console.log(`   Overall: ${sentiment.overall} (${sentiment.score > 0 ? '+' : ''}${sentiment.score})`);
      console.log(`   Confidence: ${(sentiment.confidence * 100).toFixed(1)}%`);
      
      console.log('\n📈 ANALYTICS:');
      console.log(`   Total Articles: ${analytics.totalArticles}`);
      console.log(`   Sentiment: ${analytics.sentimentDistribution.positive}P/${analytics.sentimentDistribution.negative}N/${analytics.sentimentDistribution.neutral}Neutral`);
      console.log(`   Top Assets: ${analytics.topAssets.join(', ')}`);
      
    } catch (error) {
      console.error('❌ News analysis failed:', error);
      process.exit(1);
    }
  });

// Flow analysis commands
advancedCommand
  .command('flow')
  .description('Analyze on-chain whale and exchange flows')
  .option('--asset <asset>', 'Asset to analyze (BTC/ETH)', 'ETH')
  .option('--hours <hours>', 'Analysis period in hours', '24')
  .action(async (options) => {
    console.log('🐋 ON-CHAIN FLOW ANALYSIS');
    
    try {
      const asset = options.asset as 'BTC' | 'ETH';
      const hours = parseInt(options.hours);
      
      const [whaleActivity, exchangeFlows, comprehensive] = await Promise.all([
        flowAnalyzer.analyzeWhaleActivity(asset, hours),
        flowAnalyzer.analyzeExchangeFlows([asset], hours),
        flowAnalyzer.getComprehensiveOnChainMetrics([asset])
      ]);

      const whaleScore = flowAnalyzer.getWhaleActivityScore(whaleActivity);
      const flowScore = flowAnalyzer.getExchangeFlowScore(exchangeFlows);

      console.log('\n🐋 WHALE ACTIVITY:');
      console.log(`   Activity Score: ${whaleScore > 0 ? '+' : ''}${whaleScore} (${whaleScore > 10 ? 'Bullish' : whaleScore < -10 ? 'Bearish' : 'Neutral'})`);
      console.log(`   Total Transfers: ${whaleActivity.length}`);
      console.log(`   To Exchange: ${whaleActivity.filter(w => w.type === 'whale_to_exchange').length} (Bearish)`);
      console.log(`   From Exchange: ${whaleActivity.filter(w => w.type === 'whale_from_exchange').length} (Bullish)`);

      console.log('\n🏦 EXCHANGE FLOWS:');
      console.log(`   Flow Score: ${flowScore > 0 ? '+' : ''}${flowScore} (${flowScore > 10 ? 'Bullish' : flowScore < -10 ? 'Bearish' : 'Neutral'})`);
      exchangeFlows.forEach(flow => {
        const netFlow = flow.netFlow > 0 ? `+${flow.netFlow.toFixed(0)}` : flow.netFlow.toFixed(0);
        console.log(`   ${flow.exchange}: ${netFlow} ${flow.asset} (${flow.significance})`);
      });

      console.log('\n📊 NETWORK METRICS:');
      console.log(`   Active Addresses: ${comprehensive.networkMetrics.activeAddresses.toLocaleString()}`);
      console.log(`   Avg Transaction: $${comprehensive.networkMetrics.avgTransactionValue.toLocaleString()}`);
      if (comprehensive.networkMetrics.gasUsed) {
        console.log(`   Gas Used: ${(comprehensive.networkMetrics.gasUsed / 1000000).toFixed(1)}M`);
      }
      
    } catch (error) {
      console.error('❌ Flow analysis failed:', error);
      process.exit(1);
    }
  });

// Sentiment analysis commands
advancedCommand
  .command('sentiment')
  .description('Analyze social media sentiment')
  .action(async () => {
    console.log('💬 SOCIAL SENTIMENT ANALYSIS');
    
    try {
      const [metrics, signal] = await Promise.all([
        sentimentService.getComprehensiveSentimentMetrics(),
        sentimentService.getSentimentSignal()
      ]);

      console.log('\n📊 OVERALL SENTIMENT:');
      console.log(`   Score: ${signal.score > 0 ? '+' : ''}${signal.score} (${signal.trend})`);
      console.log(`   Confidence: ${(signal.confidence * 100).toFixed(1)}%`);
      console.log(`   Strength: ${signal.strength}`);
      console.log(`   Distribution: ${metrics.overall.bullish}%B / ${metrics.overall.bearish}%B / ${metrics.overall.neutral}%N`);

      console.log('\n💰 ASSET SENTIMENT:');
      Object.entries(metrics.assetSentiment).forEach(([asset, data]) => {
        const trend = data.trend === 'rising' ? '📈' : data.trend === 'falling' ? '📉' : '➡️';
        console.log(`   ${asset}: ${data.score > 0 ? '+' : ''}${data.score.toFixed(0)} ${trend} (${data.volume} mentions)`);
      });

      console.log('\n🌟 TOP INFLUENCERS:');
      metrics.topInfluencers.slice(0, 5).forEach((inf, i) => {
        const sentiment = inf.sentiment > 10 ? 'Bullish' : inf.sentiment < -10 ? 'Bearish' : 'Neutral';
        console.log(`   ${i + 1}. @${inf.username}: ${sentiment} (${inf.followerCount.toLocaleString()} followers)`);
      });

      console.log(`\n😱 Fear & Greed Index: ${metrics.fearGreedIndex}/100`);
      
    } catch (error) {
      console.error('❌ Sentiment analysis failed:', error);
      process.exit(1);
    }
  });

// Risk sizing commands
advancedCommand
  .command('risk')
  .description('Calculate optimal position sizing')
  .option('--symbol <symbol>', 'Trading symbol', 'BTCUSD')
  .option('--portfolio <value>', 'Portfolio value', '100000')
  .option('--win-rate <rate>', 'Historical win rate (0-1)', '0.6')
  .option('--avg-win <percent>', 'Average winning trade %', '3')
  .option('--avg-loss <percent>', 'Average losing trade %', '2')
  .option('--volatility <percent>', 'Current volatility %', '20')
  .option('--confidence <level>', 'Signal confidence (0-1)', '0.7')
  .action(async (options) => {
    console.log('⚖️ OPTIMAL POSITION SIZING');
    
    try {
      const input = {
        symbol: options.symbol,
        portfolioValue: parseFloat(options.portfolio),
        winRate: parseFloat(options.winRate),
        avgWin: parseFloat(options.avgWin),
        avgLoss: parseFloat(options.avgLoss),
        currentVolatility: parseFloat(options.volatility),
        confidence: parseFloat(options.confidence),
        marketRegime: 'sideways' as const,
        correlationRisk: 0.5
      };

      const result = riskSizingService.calculateOptimalPositionSize(input);

      console.log('\n💼 POSITION SIZING RECOMMENDATION:');
      console.log(`   Strategy: ${result.strategy}`);
      console.log(`   Position Size: ${result.recommendedSize}% of portfolio`);
      console.log(`   Position Value: $${result.positionValue.toLocaleString()}`);
      console.log(`   Max Risk: $${result.maxRiskAmount.toLocaleString()}`);
      console.log(`   Stop Loss: ${result.stopLoss}%`);
      console.log(`   Take Profit: ${result.takeProfit}%`);

      console.log('\n📊 RISK METRICS:');
      console.log(`   Sharpe Estimate: ${result.riskMetrics.sharpeEstimate}`);
      console.log(`   Max Drawdown Risk: ${result.riskMetrics.maxDrawdownRisk}%`);
      console.log(`   Portfolio Heat: ${result.riskMetrics.portfolioHeatLevel}%`);
      
      console.log(`\n💡 Reasoning: ${result.reasoning}`);
      
    } catch (error) {
      console.error('❌ Risk sizing failed:', error);
      process.exit(1);
    }
  });

// Adversarial training commands
advancedCommand
  .command('stress-test')
  .description('Run adversarial stress testing')
  .option('--scenario <type>', 'Scenario type (flash_crash, regulatory_shock, etc.)', 'flash_crash')
  .action(async (options) => {
    console.log('🔥 ADVERSARIAL STRESS TESTING');
    
    try {
      const result = await adversarialTrainer.quickStressTest(options.scenario);
      
      console.log('\n⚔️ STRESS TEST RESULTS:');
      console.log(`   Scenario: ${result.scenario.name} (${result.scenario.severity})`);
      console.log(`   Robustness Score: ${result.robustnessScore}/100`);
      
      console.log('\n📈 MODEL PERFORMANCE:');
      console.log(`   Total Return: ${result.modelPerformance.totalReturn}%`);
      console.log(`   Max Drawdown: ${result.modelPerformance.maxDrawdown}%`);
      console.log(`   Sharpe Ratio: ${result.modelPerformance.sharpeRatio}`);
      console.log(`   Trades Executed: ${result.modelPerformance.tradesExecuted}`);
      console.log(`   Recovery Time: ${result.modelPerformance.recoveryTime} periods`);

      console.log('\n🧠 BEHAVIOR ANALYSIS:');
      console.log(`   Panic Selling: ${result.behaviorAnalysis.panicSelling ? 'Yes' : 'No'}`);
      console.log(`   Doubled Down: ${result.behaviorAnalysis.doubledDown ? 'Yes' : 'No'}`);
      console.log(`   Stopped Trading: ${result.behaviorAnalysis.stoppedTrading ? 'Yes' : 'No'}`);
      console.log(`   Adapted Quickly: ${result.behaviorAnalysis.adaptedQuickly ? 'Yes' : 'No'}`);
      console.log(`   Recovery Strategy: ${result.behaviorAnalysis.recoveryStrategy}`);

      console.log('\n🎓 LESSONS LEARNED:');
      result.lessonsLearned.forEach((lesson, i) => {
        console.log(`   ${i + 1}. ${lesson}`);
      });
      
    } catch (error) {
      console.error('❌ Stress testing failed:', error);
      process.exit(1);
    }
  });

// Comprehensive signals command
advancedCommand
  .command('signals')
  .description('Get comprehensive multi-modal signals')
  .option('--timeframe <timeframe>', 'Analysis timeframe', '24h')
  .action(async (options) => {
    console.log('🎯 COMPREHENSIVE SIGNAL ANALYSIS');
    
    try {
      const [
        newsImpact,
        newsSentiment,
        whaleActivity,
        exchangeFlows,
        socialSentiment
      ] = await Promise.all([
        newsService.getEventImpactScores(options.timeframe),
        newsService.getAggregatedMarketSentiment(),
        flowAnalyzer.analyzeWhaleActivity('ETH', 24),
        flowAnalyzer.analyzeExchangeFlows(['BTC', 'ETH'], 24),
        sentimentService.getSentimentSignal()
      ]);

      // Calculate composite signal
      const signals = {
        news: {
          impact: newsImpact.filter(i => i.severity > 0.5).length,
          sentiment: newsSentiment.score
        },
        onChain: {
          whaleScore: flowAnalyzer.getWhaleActivityScore(whaleActivity),
          flowScore: flowAnalyzer.getExchangeFlowScore(exchangeFlows)
        },
        social: {
          score: socialSentiment.score,
          confidence: socialSentiment.confidence
        }
      };

      // Weighted composite score
      const weights = { news: 0.3, onChain: 0.4, social: 0.3 };
      const compositeScore = 
        signals.news.sentiment * weights.news +
        ((signals.onChain.whaleScore + signals.onChain.flowScore) / 2) * weights.onChain +
        signals.social.score * weights.social;

      const trend = compositeScore > 10 ? 'BULLISH' : compositeScore < -10 ? 'BEARISH' : 'NEUTRAL';

      console.log('\n🎯 COMPOSITE SIGNAL:');
      console.log(`   Score: ${compositeScore > 0 ? '+' : ''}${compositeScore.toFixed(1)}`);
      console.log(`   Trend: ${trend}`);
      console.log(`   Confidence: ${((signals.social.confidence * 0.5 + 0.5) * 100).toFixed(1)}%`);

      console.log('\n📊 SIGNAL BREAKDOWN:');
      console.log(`   📰 News: ${signals.news.impact} high-impact events, sentiment ${signals.news.sentiment > 0 ? 'positive' : 'negative'}`);
      console.log(`   🐋 On-Chain: Whale score ${signals.onChain.whaleScore}, Flow score ${signals.onChain.flowScore}`);
      console.log(`   💬 Social: ${signals.social.score > 0 ? 'Bullish' : 'Bearish'} sentiment (${(signals.social.confidence * 100).toFixed(0)}% confidence)`);

      console.log('\n💡 TRADING RECOMMENDATION:');
      if (Math.abs(compositeScore) > 20) {
        console.log(`   Strong ${trend.toLowerCase()} signal - Consider ${compositeScore > 0 ? 'long' : 'short'} positions`);
      } else if (Math.abs(compositeScore) > 10) {
        console.log(`   Moderate ${trend.toLowerCase()} signal - Monitor for confirmation`);
      } else {
        console.log('   Neutral signal - Range-bound trading or wait for clearer signals');
      }
      
    } catch (error) {
      console.error('❌ Signal analysis failed:', error);
      process.exit(1);
    }
  });

export { advancedCommand };