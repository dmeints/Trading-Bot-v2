/**
 * Revolutionary Enhancements API Routes
 * 
 * Endpoints for all the breakthrough AI trading enhancements
 */

import { Router } from 'express';
import { adaptiveLearningEngine } from '../services/adaptiveLearning';
import { dataFusionEngine } from '../services/dataFusionEngine';
import { predictiveAnalyticsEngine } from '../services/predictiveAnalytics';
import { intelligentAutomationEngine } from '../services/intelligentAutomation';
import { metaLearningEngine } from '../services/metaLearning';
import { crossMarketIntelligenceEngine } from '../services/crossMarketIntelligence';
import { quantumAnalyticsEngine } from '../services/quantumAnalytics';
import { realTimeOptimizationEngine } from '../services/realTimeOptimization';
import { logger } from '../utils/logger';

const router = Router();

// Adaptive Learning Endpoints
router.get('/adaptive-learning/confidence-weights', async (req, res) => {
  try {
    const weights = adaptiveLearningEngine.getConfidenceWeights();
    res.json(weights);
  } catch (error) {
    logger.error('Failed to get confidence weights', { error });
    res.status(500).json({ error: 'Failed to get confidence weights' });
  }
});

router.get('/adaptive-learning/cross-agent-insights', async (req, res) => {
  try {
    const insights = adaptiveLearningEngine.getCrossAgentInsights();
    res.json(insights);
  } catch (error) {
    logger.error('Failed to get cross-agent insights', { error });
    res.status(500).json({ error: 'Failed to get cross-agent insights' });
  }
});

router.post('/adaptive-learning/update-performance', async (req, res) => {
  try {
    const { agentType, prediction, actualOutcome, marketRegime } = req.body;
    
    await adaptiveLearningEngine.updateAgentPerformance(
      agentType, 
      prediction, 
      actualOutcome, 
      marketRegime
    );
    
    res.json({ success: true, message: 'Agent performance updated' });
  } catch (error) {
    logger.error('Failed to update agent performance', { error });
    res.status(500).json({ error: 'Failed to update agent performance' });
  }
});

router.get('/adaptive-learning/optimal-agent/:marketRegime/:predictionType', async (req, res) => {
  try {
    const { marketRegime, predictionType } = req.params;
    const optimalAgent = await adaptiveLearningEngine.selectOptimalAgent(marketRegime, predictionType);
    res.json({ optimalAgent });
  } catch (error) {
    logger.error('Failed to select optimal agent', { error });
    res.status(500).json({ error: 'Failed to select optimal agent' });
  }
});

// Data Fusion Engine Endpoints
router.post('/data-fusion/sentiment-regime-matrix/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const matrix = await dataFusionEngine.createSentimentRegimeCorrelationMatrix(symbol);
    res.json(matrix);
  } catch (error) {
    logger.error('Failed to create sentiment-regime matrix', { symbol: req.params.symbol, error });
    res.status(500).json({ error: 'Failed to create sentiment-regime matrix' });
  }
});

router.get('/data-fusion/correlation-alerts', async (req, res) => {
  try {
    const alerts = await dataFusionEngine.analyzeCorrelationAlerts();
    res.json(alerts);
  } catch (error) {
    logger.error('Failed to get correlation alerts', { error });
    res.status(500).json({ error: 'Failed to get correlation alerts' });
  }
});

router.post('/data-fusion/crowd-ai-ensemble/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const ensembleScore = await dataFusionEngine.generateCrowdAIEnsembleScore(symbol);
    res.json(ensembleScore);
  } catch (error) {
    logger.error('Failed to generate crowd-AI ensemble score', { symbol: req.params.symbol, error });
    res.status(500).json({ error: 'Failed to generate crowd-AI ensemble score' });
  }
});

router.post('/data-fusion/optimize-portfolio', async (req, res) => {
  try {
    const { symbols } = req.body;
    const optimizedWeights = await dataFusionEngine.optimizePortfolioWeights(symbols);
    res.json({ optimizedWeights });
  } catch (error) {
    logger.error('Failed to optimize portfolio weights', { error });
    res.status(500).json({ error: 'Failed to optimize portfolio weights' });
  }
});

// Predictive Analytics Endpoints
router.post('/predictive-analytics/optimize-parameters/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const optimizations = await predictiveAnalyticsEngine.optimizeTradingParametersRealTime(userId);
    res.json({ optimizations });
  } catch (error) {
    logger.error('Failed to optimize trading parameters', { userId: req.params.userId, error });
    res.status(500).json({ error: 'Failed to optimize trading parameters' });
  }
});

router.post('/predictive-analytics/evolve-strategies', async (req, res) => {
  try {
    const newStrategies = await predictiveAnalyticsEngine.evolveStrategies();
    res.json({ strategies: newStrategies });
  } catch (error) {
    logger.error('Failed to evolve strategies', { error });
    res.status(500).json({ error: 'Failed to evolve strategies' });
  }
});

router.get('/predictive-analytics/correlation-breakdown-predictions', async (req, res) => {
  try {
    const predictions = await predictiveAnalyticsEngine.predictCorrelationBreakdowns();
    res.json({ predictions });
  } catch (error) {
    logger.error('Failed to predict correlation breakdowns', { error });
    res.status(500).json({ error: 'Failed to predict correlation breakdowns' });
  }
});

// Intelligent Automation Endpoints
router.post('/intelligent-automation/enable/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    await intelligentAutomationEngine.enableAutomation(userId);
    res.json({ success: true, message: 'Intelligent automation enabled' });
  } catch (error) {
    logger.error('Failed to enable automation', { userId: req.params.userId, error });
    res.status(500).json({ error: 'Failed to enable automation' });
  }
});

router.post('/intelligent-automation/disable', async (req, res) => {
  try {
    await intelligentAutomationEngine.disableAutomation();
    res.json({ success: true, message: 'Intelligent automation disabled' });
  } catch (error) {
    logger.error('Failed to disable automation', { error });
    res.status(500).json({ error: 'Failed to disable automation' });
  }
});

router.get('/intelligent-automation/status', async (req, res) => {
  try {
    const status = intelligentAutomationEngine.getAutomationStatus();
    res.json(status);
  } catch (error) {
    logger.error('Failed to get automation status', { error });
    res.status(500).json({ error: 'Failed to get automation status' });
  }
});

router.post('/intelligent-automation/update-rebalance-config/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const config = req.body;
    await intelligentAutomationEngine.updateRebalanceConfig(userId, config);
    res.json({ success: true, message: 'Rebalance config updated' });
  } catch (error) {
    logger.error('Failed to update rebalance config', { userId: req.params.userId, error });
    res.status(500).json({ error: 'Failed to update rebalance config' });
  }
});

router.get('/intelligent-automation/strategy-switch-history', async (req, res) => {
  try {
    const history = intelligentAutomationEngine.getStrategySwitchHistory();
    res.json({ history });
  } catch (error) {
    logger.error('Failed to get strategy switch history', { error });
    res.status(500).json({ error: 'Failed to get strategy switch history' });
  }
});

// Meta-Learning Endpoints
router.post('/meta-learning/learn-to-learn/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    await metaLearningEngine.learnToLearn(userId);
    res.json({ success: true, message: 'Meta-learning analysis completed' });
  } catch (error) {
    logger.error('Failed to perform meta-learning', { userId: req.params.userId, error });
    res.status(500).json({ error: 'Failed to perform meta-learning' });
  }
});

router.post('/meta-learning/create-immune-system/:strategyId', async (req, res) => {
  try {
    const { strategyId } = req.params;
    const immuneSystem = await metaLearningEngine.createStrategyImmuneSystem(strategyId);
    res.json(immuneSystem);
  } catch (error) {
    logger.error('Failed to create strategy immune system', { strategyId: req.params.strategyId, error });
    res.status(500).json({ error: 'Failed to create strategy immune system' });
  }
});

router.get('/meta-learning/immune-system/:strategyId', async (req, res) => {
  try {
    const { strategyId } = req.params;
    const immuneSystem = metaLearningEngine.getImmuneSystemStatus(strategyId);
    res.json(immuneSystem);
  } catch (error) {
    logger.error('Failed to get immune system status', { strategyId: req.params.strategyId, error });
    res.status(500).json({ error: 'Failed to get immune system status' });
  }
});

router.post('/meta-learning/generate-predictive-strategies', async (req, res) => {
  try {
    const strategies = await metaLearningEngine.generatePredictiveStrategies();
    res.json({ strategies });
  } catch (error) {
    logger.error('Failed to generate predictive strategies', { error });
    res.status(500).json({ error: 'Failed to generate predictive strategies' });
  }
});

router.get('/meta-learning/learning-patterns', async (req, res) => {
  try {
    const patterns = metaLearningEngine.getLearningPatterns();
    res.json({ patterns });
  } catch (error) {
    logger.error('Failed to get learning patterns', { error });
    res.status(500).json({ error: 'Failed to get learning patterns' });
  }
});

// Cross-Market Intelligence Endpoints
router.get('/cross-market/global-regime', async (req, res) => {
  try {
    const regime = await crossMarketIntelligenceEngine.detectGlobalMarketRegime();
    res.json(regime);
  } catch (error) {
    logger.error('Failed to detect global market regime', { error });
    res.status(500).json({ error: 'Failed to detect global market regime' });
  }
});

router.get('/cross-market/current-regime', async (req, res) => {
  try {
    const currentRegime = crossMarketIntelligenceEngine.getCurrentGlobalRegime();
    res.json(currentRegime);
  } catch (error) {
    logger.error('Failed to get current global regime', { error });
    res.status(500).json({ error: 'Failed to get current global regime' });
  }
});

router.get('/cross-market/contagion-predictions', async (req, res) => {
  try {
    const predictions = await crossMarketIntelligenceEngine.predictContagion();
    res.json({ predictions });
  } catch (error) {
    logger.error('Failed to predict contagion', { error });
    res.status(500).json({ error: 'Failed to predict contagion' });
  }
});

router.get('/cross-market/correlations', async (req, res) => {
  try {
    const correlations = await crossMarketIntelligenceEngine.analyzeCrossAssetCorrelations();
    res.json({ correlations });
  } catch (error) {
    logger.error('Failed to analyze cross-asset correlations', { error });
    res.status(500).json({ error: 'Failed to analyze cross-asset correlations' });
  }
});

router.get('/cross-market/indicators', async (req, res) => {
  try {
    const indicators = crossMarketIntelligenceEngine.getMarketIndicators();
    res.json({ indicators });
  } catch (error) {
    logger.error('Failed to get market indicators', { error });
    res.status(500).json({ error: 'Failed to get market indicators' });
  }
});

// Quantum Analytics Endpoints
router.post('/quantum-analytics/risk-analysis/:portfolioId', async (req, res) => {
  try {
    const { portfolioId } = req.params;
    const riskProfile = await quantumAnalyticsEngine.performMultiDimensionalRiskAnalysis(portfolioId);
    res.json(riskProfile);
  } catch (error) {
    logger.error('Failed to perform quantum risk analysis', { portfolioId: req.params.portfolioId, error });
    res.status(500).json({ error: 'Failed to perform quantum risk analysis' });
  }
});

router.post('/quantum-analytics/probability-landscape/:symbol/:timeframe', async (req, res) => {
  try {
    const { symbol, timeframe } = req.params;
    const landscape = await quantumAnalyticsEngine.createProbabilityLandscape(symbol, timeframe);
    res.json(landscape);
  } catch (error) {
    logger.error('Failed to create probability landscape', { 
      symbol: req.params.symbol, 
      timeframe: req.params.timeframe, 
      error 
    });
    res.status(500).json({ error: 'Failed to create probability landscape' });
  }
});

router.post('/quantum-analytics/uncertainty/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const uncertainty = await quantumAnalyticsEngine.quantifyUncertainty(symbol);
    res.json(uncertainty);
  } catch (error) {
    logger.error('Failed to quantify uncertainty', { symbol: req.params.symbol, error });
    res.status(500).json({ error: 'Failed to quantify uncertainty' });
  }
});

router.get('/quantum-analytics/risk-profile/:portfolioId', async (req, res) => {
  try {
    const { portfolioId } = req.params;
    const riskProfile = quantumAnalyticsEngine.getQuantumRiskProfile(portfolioId);
    res.json(riskProfile);
  } catch (error) {
    logger.error('Failed to get quantum risk profile', { portfolioId: req.params.portfolioId, error });
    res.status(500).json({ error: 'Failed to get quantum risk profile' });
  }
});

// Real-Time Optimization Endpoints
router.post('/real-time-optimization/start/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    await realTimeOptimizationEngine.startRealTimeOptimization(userId);
    res.json({ success: true, message: 'Real-time optimization started' });
  } catch (error) {
    logger.error('Failed to start real-time optimization', { userId: req.params.userId, error });
    res.status(500).json({ error: 'Failed to start real-time optimization' });
  }
});

router.post('/real-time-optimization/stop', async (req, res) => {
  try {
    await realTimeOptimizationEngine.stopRealTimeOptimization();
    res.json({ success: true, message: 'Real-time optimization stopped' });
  } catch (error) {
    logger.error('Failed to stop real-time optimization', { error });
    res.status(500).json({ error: 'Failed to stop real-time optimization' });
  }
});

router.get('/real-time-optimization/status', async (req, res) => {
  try {
    const status = realTimeOptimizationEngine.getOptimizationStatus();
    res.json(status);
  } catch (error) {
    logger.error('Failed to get optimization status', { error });
    res.status(500).json({ error: 'Failed to get optimization status' });
  }
});

router.get('/real-time-optimization/targets/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const targets = realTimeOptimizationEngine.getOptimizationTargets(userId);
    res.json({ targets });
  } catch (error) {
    logger.error('Failed to get optimization targets', { userId: req.params.userId, error });
    res.status(500).json({ error: 'Failed to get optimization targets' });
  }
});

router.get('/real-time-optimization/performance-history/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const history = realTimeOptimizationEngine.getPerformanceHistory(userId);
    res.json({ history });
  } catch (error) {
    logger.error('Failed to get performance history', { userId: req.params.userId, error });
    res.status(500).json({ error: 'Failed to get performance history' });
  }
});

router.get('/real-time-optimization/models', async (req, res) => {
  try {
    const models = realTimeOptimizationEngine.getAvailableModels();
    res.json({ models });
  } catch (error) {
    logger.error('Failed to get available models', { error });
    res.status(500).json({ error: 'Failed to get available models' });
  }
});

router.get('/real-time-optimization/adaptive-period/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const period = realTimeOptimizationEngine.getCurrentAdaptivePeriod(userId);
    res.json({ period });
  } catch (error) {
    logger.error('Failed to get adaptive period', { userId: req.params.userId, error });
    res.status(500).json({ error: 'Failed to get adaptive period' });
  }
});

// Combined Revolutionary Dashboard Endpoint
router.get('/dashboard/revolutionary-overview', async (req, res) => {
  try {
    // Gather data from all revolutionary systems
    const overview = {
      adaptiveLearning: {
        confidenceWeights: adaptiveLearningEngine.getConfidenceWeights(),
        crossAgentInsights: adaptiveLearningEngine.getCrossAgentInsights().slice(0, 5)
      },
      globalMarket: {
        currentRegime: crossMarketIntelligenceEngine.getCurrentGlobalRegime(),
        contagionPredictions: crossMarketIntelligenceEngine.getContagionPredictions().slice(0, 3),
        correlations: crossMarketIntelligenceEngine.getCrossAssetCorrelations().slice(0, 5)
      },
      automation: {
        status: intelligentAutomationEngine.getAutomationStatus(),
        recentSwitches: intelligentAutomationEngine.getStrategySwitchHistory().slice(0, 3)
      },
      optimization: {
        status: realTimeOptimizationEngine.getOptimizationStatus(),
        availableModels: realTimeOptimizationEngine.getAvailableModels().length
      },
      metaLearning: {
        patterns: metaLearningEngine.getLearningPatterns().slice(0, 3),
        predictiveStrategies: metaLearningEngine.getPredictiveStrategies().slice(0, 3)
      }
    };

    res.json(overview);
  } catch (error) {
    logger.error('Failed to get revolutionary overview', { error });
    res.status(500).json({ error: 'Failed to get revolutionary overview' });
  }
});

export { router as revolutionaryEnhancementsRouter };