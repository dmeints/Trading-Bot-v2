/**
 * Stevie v1.3 - Feature API Routes
 * Exposes feature data for LLM function calling
 */

import { Router } from 'express';
import FeatureService from '../services/featureService';
import VectorService from '../services/vectorService';

const router = Router();

// Initialize services
const featureService = new FeatureService();
const vectorService = new VectorService({
  provider: 'memory', // Use in-memory for development
  openaiApiKey: process.env.OPENAI_API_KEY
});

// Get comprehensive features for a symbol
router.get('/api/features/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const timestamp = parseInt(req.query.timestamp as string) || Date.now();
    
    const features = await featureService.getFeatures(symbol.toUpperCase(), timestamp);
    
    res.json({
      success: true,
      data: features,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[FeatureAPI] Error fetching features:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch features',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get current market sentiment
router.get('/api/sentiment/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const features = await featureService.getFeatures(symbol.toUpperCase());
    
    const sentimentData = {
      fearGreedIndex: features.sentiment.fearGreedIndex,
      sentimentScore: features.sentiment.sentimentScore,
      socialMentions: features.sentiment.socialMentions,
      trendingRank: features.sentiment.trendingRank,
      interpretation: getSentimentInterpretation(features.sentiment.fearGreedIndex),
      recommendation: getSentimentRecommendation(features.sentiment.sentimentScore)
    };
    
    res.json({
      success: true,
      data: sentimentData,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[SentimentAPI] Error fetching sentiment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch sentiment data'
    });
  }
});

// Get on-chain metrics
router.get('/api/onchain/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const features = await featureService.getFeatures(symbol.toUpperCase());
    
    const onChainData = {
      ...features.onChain,
      networkHealth: calculateNetworkHealth(features.onChain),
      activityLevel: getActivityLevel(features.onChain.networkActivity),
      metrics: getOnChainMetrics(symbol, features.onChain)
    };
    
    res.json({
      success: true,
      data: onChainData,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[OnChainAPI] Error fetching on-chain data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch on-chain data'
    });
  }
});

// Get funding rates and derivatives data
router.get('/api/funding/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const features = await featureService.getFeatures(symbol.toUpperCase());
    
    const fundingData = {
      currentRate: features.derivatives.fundingRate,
      annualizedRate: features.derivatives.fundingRate * 365 * 3, // 3x daily
      trend: features.derivatives.fundingTrend,
      openInterest: features.derivatives.openInterest,
      leverageRatio: features.derivatives.leverageRatio,
      interpretation: getFundingInterpretation(features.derivatives.fundingRate),
      signals: getFundingSignals(features.derivatives)
    };
    
    res.json({
      success: true,
      data: fundingData,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[FundingAPI] Error fetching funding data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch funding data'
    });
  }
});

// Get economic events and macro data
router.get('/api/events', async (req, res) => {
  try {
    const features = await featureService.getFeatures('BTCUSDT'); // Use BTC as reference
    
    const eventsData = {
      eventProximity: features.macroEvents.eventProximity,
      impactScore: features.macroEvents.impactScore,
      marketRegime: features.macroEvents.marketRegime,
      riskLevel: getMacroRiskLevel(features.macroEvents),
      recommendations: getMacroRecommendations(features.macroEvents)
    };
    
    res.json({
      success: true,
      data: eventsData,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[EventsAPI] Error fetching events data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch events data'
    });
  }
});

// Get similar trading scenarios from vector database
router.get('/api/scenarios/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const features = await featureService.getFeatures(symbol.toUpperCase());
    
    const insights = await vectorService.getScenarioInsights(features);
    
    res.json({
      success: true,
      data: {
        similarScenarios: insights.similarScenarios,
        outcomesPrediction: insights.outcomesPrediction,
        confidenceScore: insights.confidenceScore,
        recommendations: insights.recommendations,
        historicalPerformance: getHistoricalPerformance(insights.outcomesPrediction)
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[ScenariosAPI] Error fetching scenarios:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch scenario insights'
    });
  }
});

// Store a completed trading scenario for learning
router.post('/api/scenarios/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const { outcome, confidence, features, scenario } = req.body;
    
    if (!['profit', 'loss', 'neutral'].includes(outcome)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid outcome. Must be profit, loss, or neutral'
      });
    }
    
    const scenarioId = `${symbol}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    await vectorService.upsertTradingScenario(
      scenarioId,
      features,
      outcome,
      confidence,
      scenario
    );
    
    res.json({
      success: true,
      data: {
        id: scenarioId,
        message: 'Trading scenario stored successfully'
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[ScenariosAPI] Error storing scenario:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to store trading scenario'
    });
  }
});

// Get comprehensive market analysis combining all features
router.get('/api/analysis/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const features = await featureService.getFeatures(symbol.toUpperCase());
    const insights = await vectorService.getScenarioInsights(features);
    
    const analysis = {
      symbol: symbol.toUpperCase(),
      timestamp: new Date().toISOString(),
      
      // Current market state
      price: {
        current: features.ohlcv.close[features.ohlcv.close.length - 1] || 0,
        change24h: features.meta.priceChange24h,
        volatility: features.technical.volatility
      },
      
      // Technical analysis
      technical: {
        rsi: features.technical.rsi,
        rsiSignal: getTechnicalSignal('rsi', features.technical.rsi),
        macd: features.technical.macd,
        bollingerPosition: features.technical.bollingerBands.position,
        momentum: features.technical.momentum[0] // Latest momentum
      },
      
      // Sentiment analysis
      sentiment: {
        fearGreed: features.sentiment.fearGreedIndex,
        score: features.sentiment.sentimentScore,
        social: features.sentiment.socialMentions,
        trending: features.sentiment.trendingRank > 0
      },
      
      // Market structure
      market: {
        fundingRate: features.derivatives.fundingRate,
        openInterest: features.derivatives.openInterest,
        liquidityScore: features.orderBook.liquidityScore,
        spread: features.orderBook.spread
      },
      
      // AI insights
      aiInsights: {
        scenarioConfidence: insights.confidenceScore,
        profitProbability: insights.outcomesPrediction.profit,
        recommendations: insights.recommendations,
        riskLevel: calculateRiskLevel(features)
      },
      
      // Overall signals
      signals: generateTradingSignals(features, insights)
    };
    
    res.json({
      success: true,
      data: analysis,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[AnalysisAPI] Error generating analysis:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate market analysis'
    });
  }
});

// Helper functions
function getSentimentInterpretation(fearGreedIndex: number): string {
  if (fearGreedIndex >= 75) return 'Extreme Greed';
  if (fearGreedIndex >= 55) return 'Greed';
  if (fearGreedIndex >= 45) return 'Neutral';
  if (fearGreedIndex >= 25) return 'Fear';
  return 'Extreme Fear';
}

function getSentimentRecommendation(sentimentScore: number): string {
  if (sentimentScore > 0.5) return 'Bullish sentiment suggests potential upside';
  if (sentimentScore < -0.5) return 'Bearish sentiment suggests potential downside';
  return 'Neutral sentiment - wait for clearer signals';
}

function calculateNetworkHealth(onChain: any): number {
  const activity = onChain.networkActivity || 0;
  const gasPrice = onChain.gasPrice || 0;
  const hashrate = onChain.hashrate || 0;
  
  // Normalize and combine metrics
  return Math.min(1, (activity + (gasPrice > 0 ? 0.5 : 0) + (hashrate > 0 ? 0.5 : 0)) / 2);
}

function getActivityLevel(networkActivity: number): string {
  if (networkActivity > 0.7) return 'High';
  if (networkActivity > 0.4) return 'Medium';
  return 'Low';
}

function getOnChainMetrics(symbol: string, onChain: any): any {
  if (symbol.includes('BTC')) {
    return {
      type: 'Bitcoin',
      hashrate: onChain.hashrate,
      difficulty: onChain.difficulty,
      mempoolSize: onChain.mempoolSize
    };
  } else if (symbol.includes('ETH')) {
    return {
      type: 'Ethereum',
      gasPrice: onChain.gasPrice,
      totalSupply: onChain.totalSupply
    };
  }
  return { type: 'Generic' };
}

function getFundingInterpretation(fundingRate: number): string {
  if (fundingRate > 0.001) return 'High positive funding - longs pay shorts';
  if (fundingRate < -0.001) return 'Negative funding - shorts pay longs';
  return 'Neutral funding rate';
}

function getFundingSignals(derivatives: any): string[] {
  const signals: string[] = [];
  
  if (derivatives.fundingRate > 0.002) {
    signals.push('Extremely high funding rate suggests overextended longs');
  }
  
  if (derivatives.fundingTrend > 0.0005) {
    signals.push('Rising funding rate trend');
  } else if (derivatives.fundingTrend < -0.0005) {
    signals.push('Declining funding rate trend');
  }
  
  if (derivatives.leverageRatio > 5) {
    signals.push('High leverage detected - increased volatility risk');
  }
  
  return signals;
}

function getMacroRiskLevel(macroEvents: any): string {
  const { eventProximity, impactScore, marketRegime } = macroEvents;
  
  if (marketRegime === 'high-impact-event' || impactScore > 3) return 'High';
  if (marketRegime === 'event-driven' || eventProximity > 0.5) return 'Medium';
  return 'Low';
}

function getMacroRecommendations(macroEvents: any): string[] {
  const recommendations: string[] = [];
  
  if (macroEvents.marketRegime === 'high-impact-event') {
    recommendations.push('Major economic event approaching - consider reducing position sizes');
  }
  
  if (macroEvents.impactScore > 2) {
    recommendations.push('High-impact events detected - expect increased volatility');
  }
  
  if (macroEvents.eventProximity > 0.8) {
    recommendations.push('Event within 24-48 hours - monitor closely');
  }
  
  return recommendations;
}

function getHistoricalPerformance(outcomes: Record<string, number>): any {
  const profitRate = outcomes.profit;
  const lossRate = outcomes.loss;
  
  return {
    profitRate: Math.round(profitRate * 100),
    lossRate: Math.round(lossRate * 100),
    neutralRate: Math.round(outcomes.neutral * 100),
    expectedOutcome: profitRate > lossRate ? 'positive' : 'negative',
    confidence: Math.abs(profitRate - lossRate)
  };
}

function getTechnicalSignal(indicator: string, value: number): string {
  switch (indicator) {
    case 'rsi':
      if (value > 70) return 'Overbought';
      if (value < 30) return 'Oversold';
      return 'Neutral';
    default:
      return 'Neutral';
  }
}

function calculateRiskLevel(features: any): string {
  let riskScore = 0;
  
  // Volatility risk
  if (features.technical.volatility > 0.5) riskScore += 2;
  else if (features.technical.volatility > 0.3) riskScore += 1;
  
  // Funding risk
  if (Math.abs(features.derivatives.fundingRate) > 0.002) riskScore += 2;
  else if (Math.abs(features.derivatives.fundingRate) > 0.001) riskScore += 1;
  
  // Sentiment risk
  if (features.sentiment.fearGreedIndex > 80 || features.sentiment.fearGreedIndex < 20) riskScore += 1;
  
  // Liquidity risk
  if (features.orderBook.liquidityScore < 0.3) riskScore += 1;
  
  if (riskScore >= 4) return 'High';
  if (riskScore >= 2) return 'Medium';
  return 'Low';
}

function generateTradingSignals(features: any, insights: any): any {
  const signals = {
    overall: 'Neutral',
    strength: 0,
    components: {
      technical: 'Neutral',
      sentiment: 'Neutral',
      derivatives: 'Neutral',
      ai: 'Neutral'
    }
  };
  
  // Technical signals
  let technicalScore = 0;
  if (features.technical.rsi > 70) technicalScore -= 1;
  else if (features.technical.rsi < 30) technicalScore += 1;
  
  if (features.technical.macd > 0) technicalScore += 0.5;
  else technicalScore -= 0.5;
  
  if (features.technical.bollingerBands.position > 0.8) technicalScore -= 0.5;
  else if (features.technical.bollingerBands.position < 0.2) technicalScore += 0.5;
  
  signals.components.technical = technicalScore > 0.5 ? 'Bullish' : technicalScore < -0.5 ? 'Bearish' : 'Neutral';
  
  // Sentiment signals
  const sentimentScore = (features.sentiment.fearGreedIndex - 50) / 50 + features.sentiment.sentimentScore;
  signals.components.sentiment = sentimentScore > 0.3 ? 'Bullish' : sentimentScore < -0.3 ? 'Bearish' : 'Neutral';
  
  // Derivatives signals
  const derivativesScore = -features.derivatives.fundingRate * 100; // Inverse relationship
  signals.components.derivatives = derivativesScore > 0.1 ? 'Bullish' : derivativesScore < -0.1 ? 'Bearish' : 'Neutral';
  
  // AI signals
  const aiScore = insights.outcomesPrediction.profit - insights.outcomesPrediction.loss;
  signals.components.ai = aiScore > 0.2 ? 'Bullish' : aiScore < -0.2 ? 'Bearish' : 'Neutral';
  
  // Overall signal
  const overallScore = technicalScore + sentimentScore + derivativesScore + aiScore;
  signals.overall = overallScore > 0.5 ? 'Bullish' : overallScore < -0.5 ? 'Bearish' : 'Neutral';
  signals.strength = Math.abs(overallScore);
  
  return signals;
}

export default router;