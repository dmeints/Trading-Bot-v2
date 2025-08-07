/**
 * ADVANCED FEATURES API ROUTES
 * News analysis, flow tracking, sentiment analysis, risk sizing, and adversarial training
 */

import { Router } from 'express';
import { newsService } from '../services/newsService';
import { flowAnalyzer } from '../services/flowAnalyzer';
import { sentimentService } from '../services/sentimentService';
import { riskSizingService } from '../services/riskSizingService';
import { adversarialTrainer } from '../services/adversarialTrainer';
import { isAuthenticated } from '../replitAuth';

const router = Router();

// NEWS & EVENT ANALYSIS ROUTES

router.get('/api/news/impact', isAuthenticated, async (req, res) => {
  try {
    const timeframe = req.query.timeframe as string || '24h';
    const impacts = await newsService.getEventImpactScores(timeframe);
    
    res.json({
      success: true,
      data: {
        impacts,
        timeframe,
        count: impacts.length,
        highImpactEvents: impacts.filter(i => i.severity > 0.7).length
      }
    });
  } catch (error) {
    console.error('News impact analysis failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to analyze news impact'
    });
  }
});

router.get('/api/news/sentiment', isAuthenticated, async (req, res) => {
  try {
    const sentiment = await newsService.getAggregatedMarketSentiment();
    
    res.json({
      success: true,
      data: sentiment
    });
  } catch (error) {
    console.error('News sentiment analysis failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to analyze news sentiment'
    });
  }
});

router.get('/api/news/analytics', isAuthenticated, async (req, res) => {
  try {
    const timeframe = req.query.timeframe as string || '24h';
    const analytics = await newsService.getNewsAnalytics(timeframe);
    
    res.json({
      success: true,
      data: analytics
    });
  } catch (error) {
    console.error('News analytics failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get news analytics'
    });
  }
});

// ON-CHAIN FLOW ANALYSIS ROUTES

router.get('/api/flow/whales', isAuthenticated, async (req, res) => {
  try {
    const asset = req.query.asset as 'BTC' | 'ETH' || 'ETH';
    const hours = parseInt(req.query.hours as string) || 24;
    
    const whaleActivity = await flowAnalyzer.analyzeWhaleActivity(asset, hours);
    const activityScore = flowAnalyzer.getWhaleActivityScore(whaleActivity);
    
    res.json({
      success: true,
      data: {
        whaleActivity,
        activityScore,
        summary: {
          totalTransfers: whaleActivity.length,
          toExchange: whaleActivity.filter(w => w.type === 'whale_to_exchange').length,
          fromExchange: whaleActivity.filter(w => w.type === 'whale_from_exchange').length,
          whaleToWhale: whaleActivity.filter(w => w.type === 'whale_to_whale').length
        }
      }
    });
  } catch (error) {
    console.error('Whale activity analysis failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to analyze whale activity'
    });
  }
});

router.get('/api/flow/exchanges', isAuthenticated, async (req, res) => {
  try {
    const assets = req.query.assets ? (req.query.assets as string).split(',') : ['BTC', 'ETH'];
    const hours = parseInt(req.query.hours as string) || 24;
    
    const exchangeFlows = await flowAnalyzer.analyzeExchangeFlows(assets, hours);
    const flowScore = flowAnalyzer.getExchangeFlowScore(exchangeFlows);
    
    res.json({
      success: true,
      data: {
        exchangeFlows,
        flowScore,
        summary: {
          totalFlows: exchangeFlows.length,
          highSignificance: exchangeFlows.filter(f => f.significance === 'high').length,
          netInflowAssets: assets.filter(asset => 
            exchangeFlows.filter(f => f.asset === asset).reduce((sum, f) => sum + f.netFlow, 0) > 0
          )
        }
      }
    });
  } catch (error) {
    console.error('Exchange flow analysis failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to analyze exchange flows'
    });
  }
});

router.get('/api/flow/comprehensive', isAuthenticated, async (req, res) => {
  try {
    const assets = req.query.assets ? (req.query.assets as string).split(',') : ['BTC', 'ETH'];
    const metrics = await flowAnalyzer.getComprehensiveOnChainMetrics(assets);
    
    res.json({
      success: true,
      data: metrics
    });
  } catch (error) {
    console.error('Comprehensive flow analysis failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get comprehensive flow metrics'
    });
  }
});

// SOCIAL SENTIMENT ANALYSIS ROUTES

router.get('/api/sentiment', isAuthenticated, async (req, res) => {
  try {
    const metrics = await sentimentService.getComprehensiveSentimentMetrics();
    
    res.json({
      success: true,
      data: metrics
    });
  } catch (error) {
    console.error('Sentiment analysis failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to analyze social sentiment'
    });
  }
});

router.get('/api/sentiment/signal', isAuthenticated, async (req, res) => {
  try {
    const signal = await sentimentService.getSentimentSignal();
    
    res.json({
      success: true,
      data: signal
    });
  } catch (error) {
    console.error('Sentiment signal failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get sentiment signal'
    });
  }
});

// RISK SIZING & PORTFOLIO MANAGEMENT ROUTES

router.post('/api/risk/position-size', isAuthenticated, async (req, res) => {
  try {
    const input = req.body;
    const riskProfile = req.body.riskProfile;
    
    // Validate required fields
    const required = ['symbol', 'portfolioValue', 'winRate', 'avgWin', 'avgLoss', 'currentVolatility', 'confidence', 'marketRegime'];
    for (const field of required) {
      if (!(field in input)) {
        return res.status(400).json({
          success: false,
          error: `Missing required field: ${field}`
        });
      }
    }
    
    const result = riskSizingService.calculateOptimalPositionSize(input, riskProfile);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Position sizing failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to calculate position size'
    });
  }
});

router.post('/api/risk/portfolio-risk', isAuthenticated, async (req, res) => {
  try {
    const positions = req.body.positions;
    
    if (!Array.isArray(positions)) {
      return res.status(400).json({
        success: false,
        error: 'Positions must be an array'
      });
    }
    
    const portfolioRisk = riskSizingService.calculatePortfolioRisk(positions);
    
    res.json({
      success: true,
      data: portfolioRisk
    });
  } catch (error) {
    console.error('Portfolio risk calculation failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to calculate portfolio risk'
    });
  }
});

router.post('/api/risk/backtest-sizing', isAuthenticated, async (req, res) => {
  try {
    const { trades, strategy } = req.body;
    
    if (!Array.isArray(trades) || !strategy) {
      return res.status(400).json({
        success: false,
        error: 'Missing trades array or strategy'
      });
    }
    
    const results = await riskSizingService.backtestSizingStrategy(trades, strategy);
    
    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    console.error('Sizing backtest failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to backtest sizing strategy'
    });
  }
});

// ADVERSARIAL TRAINING ROUTES

router.post('/api/adversarial/train', isAuthenticated, async (req, res) => {
  try {
    const config = req.body;
    
    // Use default config if none provided
    const finalConfig = config.scenarios ? config : adversarialTrainer.getRecommendedTrainingConfig('moderate');
    
    // Start training (this will run in background)
    const trainingPromise = adversarialTrainer.runAdversarialTraining(finalConfig);
    
    res.json({
      success: true,
      message: 'Adversarial training started',
      config: finalConfig
    });
    
    // Handle completion asynchronously
    trainingPromise.then(results => {
      console.log('Adversarial training completed:', results.overallRobustness);
    }).catch(error => {
      console.error('Adversarial training failed:', error);
    });
    
  } catch (error) {
    console.error('Adversarial training start failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start adversarial training'
    });
  }
});

router.post('/api/adversarial/stress-test', isAuthenticated, async (req, res) => {
  try {
    const { scenarioType } = req.body;
    
    if (!scenarioType) {
      return res.status(400).json({
        success: false,
        error: 'Scenario type is required'
      });
    }
    
    const result = await adversarialTrainer.quickStressTest(scenarioType);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Stress test failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to run stress test'
    });
  }
});

router.get('/api/adversarial/config/:riskTolerance', isAuthenticated, async (req, res) => {
  try {
    const riskTolerance = req.params.riskTolerance as 'conservative' | 'moderate' | 'aggressive';
    
    if (!['conservative', 'moderate', 'aggressive'].includes(riskTolerance)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid risk tolerance. Must be: conservative, moderate, or aggressive'
      });
    }
    
    const config = adversarialTrainer.getRecommendedTrainingConfig(riskTolerance);
    
    res.json({
      success: true,
      data: config
    });
  } catch (error) {
    console.error('Config generation failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate training config'
    });
  }
});

// MULTI-SIGNAL AGGREGATION ENDPOINT

router.get('/api/signals/comprehensive', isAuthenticated, async (req, res) => {
  try {
    const timeframe = req.query.timeframe as string || '24h';
    
    // Fetch all signals in parallel
    const [
      newsImpact,
      newsSentiment,
      whaleActivity,
      exchangeFlows,
      socialSentiment
    ] = await Promise.all([
      newsService.getEventImpactScores(timeframe),
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
    
    res.json({
      success: true,
      data: {
        signals,
        composite: {
          score: Math.round(compositeScore),
          trend: compositeScore > 10 ? 'bullish' : compositeScore < -10 ? 'bearish' : 'neutral',
          confidence: (signals.social.confidence * 0.5 + 0.5), // Normalize confidence
          components: {
            news: `${signals.news.impact} high-impact events, ${signals.news.sentiment > 0 ? 'positive' : 'negative'} sentiment`,
            onChain: `Whale score: ${signals.onChain.whaleScore}, Flow score: ${signals.onChain.flowScore}`,
            social: `${signals.social.score > 0 ? 'Bullish' : 'Bearish'} sentiment with ${Math.round(signals.social.confidence * 100)}% confidence`
          }
        }
      }
    });
    
  } catch (error) {
    console.error('Comprehensive signals failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get comprehensive signals'
    });
  }
});

export { router as advancedFeaturesRouter };