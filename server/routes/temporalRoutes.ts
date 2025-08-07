/**
 * TEMPORAL OMNISCIENCE API ROUTES
 * Multi-timeframe analysis, causal inference, and prediction accuracy endpoints
 */

import { Router } from 'express';
import { temporalAnalyzer } from '../services/temporalAnalyzer';
import { causalInference } from '../services/causalInference';
import { predictionAccuracy } from '../services/predictionAccuracy';
import { isAuthenticated } from '../replitAuth';

const router = Router();

// MULTI-TIMEFRAME ANALYSIS ROUTES

router.get('/api/temporal/multiframe/:asset?', isAuthenticated, async (req, res) => {
  try {
    const asset = req.params.asset || 'BTC';
    const analysis = await temporalAnalyzer.analyzeMultiTimeframe(asset);
    
    res.json({
      success: true,
      data: analysis,
      metadata: {
        asset,
        analysisTimestamp: new Date(),
        timeframesAnalyzed: Object.keys(analysis.analysis).length,
        causalRelationships: analysis.causalChains.length,
        predictions: analysis.predictions.length
      }
    });
  } catch (error) {
    console.error('Multi-timeframe analysis failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to analyze multi-timeframe data'
    });
  }
});

router.get('/api/temporal/signal/:asset?', isAuthenticated, async (req, res) => {
  try {
    const asset = req.params.asset || 'BTC';
    const signal = await temporalAnalyzer.getTemporalSignal(asset);
    
    res.json({
      success: true,
      data: signal,
      timestamp: new Date()
    });
  } catch (error) {
    console.error('Temporal signal failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get temporal signal'
    });
  }
});

router.get('/api/temporal/causals', isAuthenticated, async (req, res) => {
  try {
    const insights = await temporalAnalyzer.getCausalInsights();
    
    res.json({
      success: true,
      data: {
        causalRelationships: insights,
        strongestCausals: insights.slice(0, 5),
        totalRelationships: insights.length
      }
    });
  } catch (error) {
    console.error('Causal insights failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get causal insights'
    });
  }
});

// CAUSAL INFERENCE ROUTES

router.get('/api/causal/events', isAuthenticated, async (req, res) => {
  try {
    const timeWindow = parseInt(req.query.hours as string) || 24;
    const events = await causalInference.identifyCausalEvents(timeWindow);
    
    res.json({
      success: true,
      data: {
        events,
        timeWindow: `${timeWindow} hours`,
        eventCount: events.length,
        eventTypes: [...new Set(events.map(e => e.type))]
      }
    });
  } catch (error) {
    console.error('Causal events failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to identify causal events'
    });
  }
});

router.get('/api/causal/effects', isAuthenticated, async (req, res) => {
  try {
    const timeWindow = parseInt(req.query.hours as string) || 24;
    const events = await causalInference.identifyCausalEvents(timeWindow);
    const effects = await causalInference.analyzeCausalEffects(events);
    
    res.json({
      success: true,
      data: {
        effects,
        summary: {
          totalEffects: effects.length,
          strongestEffect: effects.reduce((max, current) => 
            Math.abs(current.priceImpact.immediate) > Math.abs(max.priceImpact.immediate) ? current : max,
            effects[0]
          ),
          avgImmediateImpact: effects.reduce((sum, e) => sum + Math.abs(e.priceImpact.immediate), 0) / effects.length
        }
      }
    });
  } catch (error) {
    console.error('Causal effects analysis failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to analyze causal effects'
    });
  }
});

router.get('/api/causal/predictions', isAuthenticated, async (req, res) => {
  try {
    const lookAheadHours = parseInt(req.query.hours as string) || 4;
    const predictions = await causalInference.getEventPredictions(lookAheadHours);
    
    res.json({
      success: true,
      data: {
        predictions,
        lookAheadWindow: `${lookAheadHours} hours`,
        upcomingEvents: predictions.length,
        nextEvent: predictions[0] || null
      }
    });
  } catch (error) {
    console.error('Causal predictions failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get causal predictions'
    });
  }
});

router.get('/api/causal/signal', isAuthenticated, async (req, res) => {
  try {
    const signal = await causalInference.getStrongestCausalSignal();
    
    res.json({
      success: true,
      data: signal,
      timestamp: new Date()
    });
  } catch (error) {
    console.error('Causal signal failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get causal signal'
    });
  }
});

router.get('/api/causal/models', isAuthenticated, async (req, res) => {
  try {
    const models = causalInference.getCausalModelSummary();
    
    res.json({
      success: true,
      data: {
        models,
        modelCount: Object.keys(models).length,
        bestModels: Object.entries(models)
          .sort(([,a], [,b]) => b.successRate - a.successRate)
          .slice(0, 3)
          .map(([key, model]) => ({ key, model }))
      }
    });
  } catch (error) {
    console.error('Causal models failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get causal models'
    });
  }
});

// PREDICTION ACCURACY ROUTES

router.post('/api/accuracy/record', isAuthenticated, async (req, res) => {
  try {
    const { asset, timeframe, prediction, reasoning, source } = req.body;
    
    // Validate required fields
    if (!asset || !timeframe || !prediction || !source) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: asset, timeframe, prediction, source'
      });
    }
    
    const predictionId = predictionAccuracy.recordPrediction(
      asset,
      timeframe,
      prediction,
      reasoning || 'No reasoning provided',
      source
    );
    
    res.json({
      success: true,
      data: {
        predictionId,
        message: 'Prediction recorded successfully'
      }
    });
  } catch (error) {
    console.error('Record prediction failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to record prediction'
    });
  }
});

router.post('/api/accuracy/update/:predictionId', isAuthenticated, async (req, res) => {
  try {
    const { predictionId } = req.params;
    const { actualPrice, previousPrice } = req.body;
    
    if (!actualPrice || !previousPrice) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: actualPrice, previousPrice'
      });
    }
    
    await predictionAccuracy.updatePredictionOutcome(predictionId, actualPrice, previousPrice);
    
    res.json({
      success: true,
      message: 'Prediction outcome updated successfully'
    });
  } catch (error) {
    console.error('Update prediction failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update prediction outcome'
    });
  }
});

router.get('/api/accuracy/report', isAuthenticated, async (req, res) => {
  try {
    const report = predictionAccuracy.getAccuracyReport();
    
    res.json({
      success: true,
      data: report,
      generatedAt: new Date()
    });
  } catch (error) {
    console.error('Accuracy report failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate accuracy report'
    });
  }
});

router.get('/api/accuracy/best-source/:timeframe', isAuthenticated, async (req, res) => {
  try {
    const { timeframe } = req.params;
    const bestSource = await predictionAccuracy.getBestPredictionSource(timeframe);
    
    res.json({
      success: true,
      data: bestSource,
      timeframe
    });
  } catch (error) {
    console.error('Best source analysis failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to determine best prediction source'
    });
  }
});

// COMPREHENSIVE TEMPORAL INTELLIGENCE ENDPOINT

router.get('/api/temporal/intelligence/:asset?', isAuthenticated, async (req, res) => {
  try {
    const asset = req.params.asset || 'BTC';
    
    // Get comprehensive temporal intelligence
    const [
      multiframeAnalysis,
      temporalSignal,
      causalSignal,
      accuracyReport
    ] = await Promise.all([
      temporalAnalyzer.analyzeMultiTimeframe(asset),
      temporalAnalyzer.getTemporalSignal(asset),
      causalInference.getStrongestCausalSignal(),
      predictionAccuracy.getAccuracyReport()
    ]);
    
    // Combine signals with confidence weighting
    const signals = [
      { source: 'temporal', ...temporalSignal },
      { source: 'causal', ...causalSignal }
    ];
    
    // Calculate composite temporal intelligence score
    let compositeScore = 0;
    let totalWeight = 0;
    
    for (const signal of signals) {
      const weight = signal.confidence / 100;
      const score = signal.direction === 'bullish' ? signal.strength : 
                   signal.direction === 'bearish' ? -signal.strength : 0;
      
      compositeScore += score * weight;
      totalWeight += weight;
    }
    
    const normalizedScore = totalWeight > 0 ? compositeScore / totalWeight : 0;
    const compositeDirection = normalizedScore > 5 ? 'bullish' : normalizedScore < -5 ? 'bearish' : 'neutral';
    const compositeStrength = Math.abs(normalizedScore);
    
    res.json({
      success: true,
      data: {
        asset,
        composite: {
          direction: compositeDirection,
          strength: Math.round(compositeStrength),
          confidence: Math.round((totalWeight / signals.length) * 100),
          reasoning: `Multi-timeframe convergence: ${multiframeAnalysis.convergence.strength} alignment, strongest causal factor: ${causalSignal.primaryCause.slice(0, 50)}...`
        },
        breakdown: {
          temporal: temporalSignal,
          causal: causalSignal,
          convergence: multiframeAnalysis.convergence,
          predictions: multiframeAnalysis.predictions.slice(0, 3),
          topCausals: multiframeAnalysis.causalChains.slice(0, 3)
        },
        performance: {
          overall: accuracyReport.overall,
          bestSource: accuracyReport.topPerformers[0]
        }
      },
      timestamp: new Date()
    });
    
  } catch (error) {
    console.error('Temporal intelligence failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate temporal intelligence'
    });
  }
});

export { router as temporalRoutes };