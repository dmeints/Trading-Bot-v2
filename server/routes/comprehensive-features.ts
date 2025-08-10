/**
 * Comprehensive Features API
 * Unified endpoint for all advanced algorithmic trading features
 */

import { Router, Request, Response } from 'express';
import { rateLimiters } from '../middleware/rateLimiter';
import { calculateRegime, type RegimeFeatures } from '../features/regime';
import { calculateSocial, type SocialFeatures, getPlatformSentiment, analyzeSentimentTrend } from '../features/social';
import { calculateOnchain, type OnchainFeatures, analyzeWhaleActivity } from '../features/onchain';
import { calculateMacro, type MacroFeatures, getEconomicCalendar, analyzeFedCommunications } from '../features/macro';
import { logger } from '../utils/logger';

const router = Router();

/**
 * Comprehensive Features Interface
 */
export interface ComprehensiveFeatures {
  symbol: string;
  timestamp: string;
  timeWindow: {
    start: string;
    end: string;
  };
  
  // Core feature sets
  regime?: RegimeFeatures;
  social?: SocialFeatures;
  onchain?: OnchainFeatures;
  macro?: MacroFeatures;
  
  // Aggregate scores
  aggregate: {
    overall_signal: number; // -1 to 1, bearish to bullish
    confidence: number; // 0 to 1, confidence in the signal
    risk_level: 'low' | 'medium' | 'high';
    action_recommendation: 'strong_sell' | 'sell' | 'hold' | 'buy' | 'strong_buy';
    feature_count: number; // Number of successfully calculated features
    blackout_mode: boolean; // Whether any blackout conditions are active
  };
  
  // Metadata
  metadata: {
    calculation_time_ms: number;
    failed_features: string[];
    data_freshness: 'real_time' | 'recent' | 'stale';
  };
}

/**
 * Calculate all comprehensive features for a symbol
 */
router.get('/comprehensive/:symbol', rateLimiters.features, async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    const { symbol } = req.params;
    const { 
      hours = 24,
      include_regime = 'true',
      include_social = 'true', 
      include_onchain = 'true',
      include_macro = 'true'
    } = req.query;
    
    const hoursNumber = parseInt(hours as string);
    const endTime = new Date();
    const windowStart = new Date(endTime.getTime() - hoursNumber * 60 * 60 * 1000);
    
    console.log(`[ComprehensiveFeatures] Calculating for ${symbol} over ${hoursNumber}h window`);
    
    // Calculate all features simultaneously
    const featurePromises: Promise<any>[] = [];
    const featureFlags = {
      regime: include_regime === 'true',
      social: include_social === 'true',
      onchain: include_onchain === 'true',
      macro: include_macro === 'true'
    };
    
    const failedFeatures: string[] = [];
    let regime: RegimeFeatures | undefined;
    let social: SocialFeatures | undefined;
    let onchain: OnchainFeatures | undefined;
    let macro: MacroFeatures | undefined;
    
    // Execute all feature calculations in parallel
    const results = await Promise.allSettled([
      featureFlags.regime ? calculateRegime(symbol, windowStart, endTime) : Promise.resolve(null),
      featureFlags.social ? calculateSocial(symbol, windowStart, endTime) : Promise.resolve(null),
      featureFlags.onchain ? calculateOnchain(symbol, windowStart, endTime) : Promise.resolve(null),
      featureFlags.macro ? calculateMacro(windowStart, endTime) : Promise.resolve(null)
    ]);
    
    // Process results
    if (results[0].status === 'fulfilled' && results[0].value) {
      regime = results[0].value;
    } else if (featureFlags.regime) {
      failedFeatures.push('regime');
    }
    
    if (results[1].status === 'fulfilled' && results[1].value) {
      social = results[1].value;
    } else if (featureFlags.social) {
      failedFeatures.push('social');
    }
    
    if (results[2].status === 'fulfilled' && results[2].value) {
      onchain = results[2].value;
    } else if (featureFlags.onchain) {
      failedFeatures.push('onchain');
    }
    
    if (results[3].status === 'fulfilled' && results[3].value) {
      macro = results[3].value;
    } else if (featureFlags.macro) {
      failedFeatures.push('macro');
    }
    
    // Calculate aggregate signals
    const aggregate = calculateAggregateSignals({
      regime,
      social,
      onchain,
      macro
    });
    
    const calculationTime = Date.now() - startTime;
    
    const response: ComprehensiveFeatures = {
      symbol,
      timestamp: endTime.toISOString(),
      timeWindow: {
        start: windowStart.toISOString(),
        end: endTime.toISOString()
      },
      regime,
      social,
      onchain,
      macro,
      aggregate,
      metadata: {
        calculation_time_ms: calculationTime,
        failed_features: failedFeatures,
        data_freshness: calculationTime < 5000 ? 'real_time' : calculationTime < 15000 ? 'recent' : 'stale'
      }
    };
    
    console.log(`[ComprehensiveFeatures] Completed for ${symbol}: signal=${aggregate.overall_signal}, confidence=${aggregate.confidence}, time=${calculationTime}ms`);
    
    res.json(response);
    
  } catch (error) {
    const calculationTime = Date.now() - startTime;
    logger.error(`[ComprehensiveFeatures] Error calculating features`, {
      symbol: req.params.symbol,
      error: error instanceof Error ? error.message : String(error),
      calculationTime
    });
    
    res.status(500).json({
      error: 'Failed to calculate comprehensive features',
      details: error instanceof Error ? error.message : 'Unknown error',
      calculation_time_ms: calculationTime
    });
  }
});

/**
 * Get regime analysis for a symbol
 */
router.get('/regime/:symbol', rateLimiters.features, async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;
    const { hours = 24 } = req.query;
    
    const hoursNumber = parseInt(hours as string);
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - hoursNumber * 60 * 60 * 1000);
    
    const regimeFeatures = await calculateRegime(symbol, startTime, endTime);
    
    if (!regimeFeatures) {
      return res.status(404).json({ error: 'Unable to calculate regime features', symbol });
    }
    
    res.json({
      symbol,
      timestamp: endTime.toISOString(),
      time_window_hours: hoursNumber,
      regime: regimeFeatures
    });
    
  } catch (error) {
    logger.error(`[RegimeFeatures] Error`, { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ error: 'Failed to calculate regime features' });
  }
});

/**
 * Get social sentiment analysis
 */
router.get('/social/:symbol', rateLimiters.features, async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;
    const { hours = 24, platform } = req.query;
    
    const hoursNumber = parseInt(hours as string);
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - hoursNumber * 60 * 60 * 1000);
    
    if (platform && ['twitter', 'reddit', 'news'].includes(platform as string)) {
      // Get specific platform sentiment
      const sentiment = await getPlatformSentiment(platform as any, symbol, { start: startTime, end: endTime });
      
      return res.json({
        symbol,
        platform,
        sentiment,
        timestamp: endTime.toISOString(),
        time_window_hours: hoursNumber
      });
    }
    
    // Get comprehensive social features
    const socialFeatures = await calculateSocial(symbol, startTime, endTime);
    
    if (!socialFeatures) {
      return res.status(404).json({ error: 'Unable to calculate social features', symbol });
    }
    
    res.json({
      symbol,
      timestamp: endTime.toISOString(),
      time_window_hours: hoursNumber,
      social: socialFeatures
    });
    
  } catch (error) {
    logger.error(`[SocialFeatures] Error`, { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ error: 'Failed to calculate social features' });
  }
});

/**
 * Get on-chain analysis
 */
router.get('/onchain/:symbol', rateLimiters.features, async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;
    const { hours = 24 } = req.query;
    
    const hoursNumber = parseInt(hours as string);
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - hoursNumber * 60 * 60 * 1000);
    
    const onchainFeatures = await calculateOnchain(symbol, startTime, endTime);
    
    if (!onchainFeatures) {
      return res.status(404).json({ error: 'Unable to calculate on-chain features', symbol });
    }
    
    res.json({
      symbol,
      timestamp: endTime.toISOString(),
      time_window_hours: hoursNumber,
      onchain: onchainFeatures
    });
    
  } catch (error) {
    logger.error(`[OnChainFeatures] Error`, { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ error: 'Failed to calculate on-chain features' });
  }
});

/**
 * Get macro economic analysis
 */
router.get('/macro', rateLimiters.features, async (req: Request, res: Response) => {
  try {
    const { hours = 24 } = req.query;
    
    const hoursNumber = parseInt(hours as string);
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - hoursNumber * 60 * 60 * 1000);
    
    const macroFeatures = await calculateMacro(startTime, endTime);
    
    if (!macroFeatures) {
      return res.status(404).json({ error: 'Unable to calculate macro features' });
    }
    
    res.json({
      timestamp: endTime.toISOString(),
      time_window_hours: hoursNumber,
      macro: macroFeatures
    });
    
  } catch (error) {
    logger.error(`[MacroFeatures] Error`, { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ error: 'Failed to calculate macro features' });
  }
});

/**
 * Analyze sentiment trend over time
 */
router.get('/social/:symbol/trend', rateLimiters.features, async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;
    const { hours = 24 } = req.query;
    
    const hoursNumber = parseInt(hours as string);
    
    const trendAnalysis = await analyzeSentimentTrend(symbol, hoursNumber);
    
    if (!trendAnalysis) {
      return res.status(404).json({ error: 'Unable to analyze sentiment trend', symbol });
    }
    
    res.json({
      symbol,
      analysis_window_hours: hoursNumber,
      trend: trendAnalysis,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error(`[SentimentTrend] Error`, { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ error: 'Failed to analyze sentiment trend' });
  }
});

/**
 * Analyze whale activity
 */
router.get('/onchain/:symbol/whales', rateLimiters.features, async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;
    const { hours = 24 } = req.query;
    
    const hoursNumber = parseInt(hours as string);
    
    const whaleAnalysis = await analyzeWhaleActivity(symbol, hoursNumber);
    
    if (!whaleAnalysis) {
      return res.status(404).json({ error: 'Unable to analyze whale activity', symbol });
    }
    
    res.json({
      symbol,
      analysis_window_hours: hoursNumber,
      whale_activity: whaleAnalysis,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error(`[WhaleAnalysis] Error`, { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ error: 'Failed to analyze whale activity' });
  }
});

/**
 * Get economic calendar
 */
router.get('/macro/calendar', rateLimiters.features, async (req: Request, res: Response) => {
  try {
    const { days = 7 } = req.query;
    
    const daysNumber = parseInt(days as string);
    const calendar = await getEconomicCalendar(daysNumber);
    
    res.json({
      calendar,
      forecast_days: daysNumber,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error(`[EconomicCalendar] Error`, { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ error: 'Failed to get economic calendar' });
  }
});

/**
 * Analyze Fed communications
 */
router.get('/macro/fed', rateLimiters.features, async (req: Request, res: Response) => {
  try {
    const fedAnalysis = await analyzeFedCommunications();
    
    if (!fedAnalysis) {
      return res.status(404).json({ error: 'Unable to analyze Fed communications' });
    }
    
    res.json({
      fed_analysis: fedAnalysis,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error(`[FedAnalysis] Error`, { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ error: 'Failed to analyze Fed communications' });
  }
});

/**
 * Calculate aggregate signals from multiple feature sets
 */
function calculateAggregateSignals(features: {
  regime?: RegimeFeatures;
  social?: SocialFeatures;
  onchain?: OnchainFeatures;
  macro?: MacroFeatures;
}): ComprehensiveFeatures['aggregate'] {
  
  let overallSignal = 0;
  let totalConfidence = 0;
  let signalCount = 0;
  let riskFactors = 0;
  let featureCount = 0;
  let blackoutMode = false;
  
  // Regime contribution
  if (features.regime) {
    featureCount++;
    const regimeWeight = 0.3;
    
    // Convert trend strength to signal (-100 to 100 -> -1 to 1)
    const regimeSignal = features.regime.trend_strength / 100;
    overallSignal += regimeSignal * regimeWeight;
    
    // Higher regime persistence = higher confidence
    totalConfidence += features.regime.regime_persistence * regimeWeight;
    signalCount++;
    
    // Risk factors
    if (features.regime.vol_pct > 50) riskFactors += 0.3;
    if (features.regime.breakout_probability > 0.7) riskFactors += 0.2;
    if (features.regime.liquidity_tier === 3) riskFactors += 0.1;
  }
  
  // Social contribution
  if (features.social) {
    featureCount++;
    const socialWeight = 0.25;
    
    overallSignal += features.social.sentiment_score * socialWeight;
    totalConfidence += features.social.confidence * socialWeight;
    signalCount++;
    
    // Risk factors
    if (features.social.spike) riskFactors += 0.2;
    if (Math.abs(features.social.z) > 2) riskFactors += 0.15;
  }
  
  // On-chain contribution
  if (features.onchain) {
    featureCount++;
    const onchainWeight = 0.25;
    
    overallSignal += features.onchain.bias * onchainWeight;
    
    // Calculate on-chain confidence based on multiple factors
    let onchainConfidence = 0.5;
    if (features.onchain.whale_activity_score > 0.7) onchainConfidence += 0.2;
    if (features.onchain.active_addresses_change > 5) onchainConfidence += 0.15;
    if (!features.onchain.gas_spike_flag) onchainConfidence += 0.15;
    
    totalConfidence += onchainConfidence * onchainWeight;
    signalCount++;
    
    // Risk factors
    if (features.onchain.gas_spike_flag) riskFactors += 0.25;
    if (features.onchain.network_congestion > 0.8) riskFactors += 0.2;
  }
  
  // Macro contribution
  if (features.macro) {
    featureCount++;
    const macroWeight = 0.2;
    
    overallSignal += features.macro.risk_on_sentiment * macroWeight;
    
    // Calculate macro confidence
    let macroConfidence = 0.6;
    if (!features.macro.blackout) macroConfidence += 0.3;
    if (features.macro.recent_impact_score < 0.5) macroConfidence += 0.1;
    
    totalConfidence += macroConfidence * macroWeight;
    signalCount++;
    
    // Risk factors and blackout
    if (features.macro.blackout) {
      blackoutMode = true;
      riskFactors += 0.4;
    }
    if (features.macro.vix_level > 30) riskFactors += 0.3;
    if (features.macro.inflation_pressure > 0.7) riskFactors += 0.2;
  }
  
  // Normalize signals
  const normalizedSignal = signalCount > 0 ? overallSignal : 0;
  const normalizedConfidence = signalCount > 0 ? totalConfidence : 0;
  
  // Determine risk level
  let riskLevel: 'low' | 'medium' | 'high' = 'low';
  if (riskFactors > 0.7) riskLevel = 'high';
  else if (riskFactors > 0.4) riskLevel = 'medium';
  
  // Action recommendation
  let actionRecommendation: ComprehensiveFeatures['aggregate']['action_recommendation'] = 'hold';
  
  if (blackoutMode) {
    actionRecommendation = 'hold'; // Conservative during blackouts
  } else if (normalizedSignal > 0.6 && normalizedConfidence > 0.7 && riskLevel !== 'high') {
    actionRecommendation = 'strong_buy';
  } else if (normalizedSignal > 0.3 && normalizedConfidence > 0.6) {
    actionRecommendation = 'buy';
  } else if (normalizedSignal < -0.6 && normalizedConfidence > 0.7 && riskLevel !== 'high') {
    actionRecommendation = 'strong_sell';
  } else if (normalizedSignal < -0.3 && normalizedConfidence > 0.6) {
    actionRecommendation = 'sell';
  }
  
  return {
    overall_signal: Math.round(normalizedSignal * 1000) / 1000,
    confidence: Math.round(normalizedConfidence * 1000) / 1000,
    risk_level: riskLevel,
    action_recommendation: actionRecommendation,
    feature_count: featureCount,
    blackout_mode: blackoutMode
  };
}

export default router;