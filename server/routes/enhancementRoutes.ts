/**
 * API Routes for all 6 Exceptional Enhancement Services
 * Integrated endpoints for personality, learning, risk, timeframes, intelligence, and monitoring
 */

import type { Express } from "express";
import SteviePersonalityService from '../services/steviePersonalityService';
import RealTimeLearningService from '../services/realTimeLearningService';
import AdvancedRiskService from '../services/advancedRiskService';
import MultiTimeframeService from '../services/multiTimeframeService';
import MarketIntelligenceService from '../services/marketIntelligenceService';
import ProductionMonitoringService from '../services/productionMonitoringService';
import { isAuthenticated } from '../replitAuth';

// Initialize all services
const personalityService = new SteviePersonalityService();
const learningService = new RealTimeLearningService();
const riskService = new AdvancedRiskService();
const timeframeService = new MultiTimeframeService();
const intelligenceService = new MarketIntelligenceService();
const monitoringService = new ProductionMonitoringService();

export function registerEnhancementRoutes(app: Express): void {

  // =============================================================================
  // Enhanced Stevie Personality & Memory Routes
  // =============================================================================

  // Initialize or get user profile
  app.post("/api/stevie/profile", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || 'dev-user';
      const { experienceLevel } = req.body;
      
      const profile = await personalityService.initializeUserProfile(userId, experienceLevel);
      res.json({ success: true, data: profile });
    } catch (error) {
      console.error("Error initializing user profile:", error);
      res.status(500).json({ success: false, error: "Failed to initialize profile" });
    }
  });

  // Enhanced personalized chat with Stevie
  app.post("/api/stevie/chat-enhanced", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || 'dev-user';
      const { message, context } = req.body;
      
      const response = await personalityService.generatePersonalizedResponse(userId, message, context);
      res.json({ success: true, data: response });
    } catch (error) {
      console.error("Error in enhanced chat:", error);
      res.status(500).json({ success: false, error: "Failed to generate response" });
    }
  });

  // Record trade memory for learning
  app.post("/api/stevie/memory/trade", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || 'dev-user';
      const { symbol, action, reasoning, confidence, outcome } = req.body;
      
      const memory = await personalityService.recordTradeMemory(
        userId, symbol, action, reasoning, confidence, outcome
      );
      res.json({ success: true, data: memory });
    } catch (error) {
      console.error("Error recording trade memory:", error);
      res.status(500).json({ success: false, error: "Failed to record memory" });
    }
  });

  // Get pattern recognition for current market
  app.get("/api/stevie/patterns/:symbol", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || 'dev-user';
      const { symbol } = req.params;
      
      const marketData = { /* would get real market data */ };
      const pattern = await personalityService.recognizePattern(userId, marketData);
      
      res.json({ success: true, data: { pattern } });
    } catch (error) {
      console.error("Error recognizing patterns:", error);
      res.status(500).json({ success: false, error: "Failed to recognize patterns" });
    }
  });

  // =============================================================================
  // Real-Time Learning & Adaptation Routes
  // =============================================================================

  // Record trade outcome for learning
  app.post("/api/learning/outcome", isAuthenticated, async (req: any, res) => {
    try {
      const { tradeId, symbol, action, entryPrice, exitPrice, confidence, features, profit } = req.body;
      
      await learningService.recordTradeOutcome(
        tradeId, symbol, action, entryPrice, exitPrice, confidence, features, profit
      );
      
      res.json({ success: true, message: "Trade outcome recorded" });
    } catch (error) {
      console.error("Error recording trade outcome:", error);
      res.status(500).json({ success: false, error: "Failed to record outcome" });
    }
  });

  // Detect current market regime
  app.post("/api/learning/regime", isAuthenticated, async (req: any, res) => {
    try {
      const { marketData } = req.body;
      
      const regime = await learningService.detectMarketRegime(marketData);
      res.json({ success: true, data: regime });
    } catch (error) {
      console.error("Error detecting market regime:", error);
      res.status(500).json({ success: false, error: "Failed to detect regime" });
    }
  });

  // Optimize parameters based on performance
  app.post("/api/learning/optimize", isAuthenticated, async (req: any, res) => {
    try {
      const updates = await learningService.optimizeParameters();
      res.json({ success: true, data: { updates, count: updates.length } });
    } catch (error) {
      console.error("Error optimizing parameters:", error);
      res.status(500).json({ success: false, error: "Failed to optimize" });
    }
  });

  // Get adaptive strategy for current conditions
  app.get("/api/learning/strategy/:regime", isAuthenticated, async (req: any, res) => {
    try {
      const { regime } = req.params;
      const { riskTolerance = 0.5 } = req.query;
      
      const strategy = await learningService.getAdaptiveStrategy(regime, Number(riskTolerance));
      res.json({ success: true, data: strategy });
    } catch (error) {
      console.error("Error getting adaptive strategy:", error);
      res.status(500).json({ success: false, error: "Failed to get strategy" });
    }
  });

  // =============================================================================
  // Advanced Risk Management Routes
  // =============================================================================

  // Comprehensive risk assessment
  app.post("/api/risk/assess", isAuthenticated, async (req: any, res) => {
    try {
      const { positions, marketData, userRiskTolerance } = req.body;
      
      const assessment = await riskService.assessOverallRisk(positions, marketData, userRiskTolerance);
      res.json({ success: true, data: assessment });
    } catch (error) {
      console.error("Error assessing risk:", error);
      res.status(500).json({ success: false, error: "Failed to assess risk" });
    }
  });

  // Dynamic position sizing
  app.post("/api/risk/position-size", isAuthenticated, async (req: any, res) => {
    try {
      const { symbol, confidence, marketConditions, currentPortfolio, userRiskTolerance } = req.body;
      
      const sizing = await riskService.calculateDynamicPositionSize(
        symbol, confidence, marketConditions, currentPortfolio, userRiskTolerance
      );
      res.json({ success: true, data: sizing });
    } catch (error) {
      console.error("Error calculating position size:", error);
      res.status(500).json({ success: false, error: "Failed to calculate size" });
    }
  });

  // Black swan detection
  app.post("/api/risk/black-swan", isAuthenticated, async (req: any, res) => {
    try {
      const { marketData } = req.body;
      
      const signal = await riskService.detectBlackSwanEvent(marketData);
      res.json({ success: true, data: signal });
    } catch (error) {
      console.error("Error detecting black swan:", error);
      res.status(500).json({ success: false, error: "Failed to detect event" });
    }
  });

  // Liquidity-aware order sizing
  app.post("/api/risk/liquidity-order", isAuthenticated, async (req: any, res) => {
    try {
      const { symbol, desiredSize, marketDepth } = req.body;
      
      const order = await riskService.getLiquidityAwareOrderSize(symbol, desiredSize, marketDepth);
      res.json({ success: true, data: order });
    } catch (error) {
      console.error("Error calculating liquidity order:", error);
      res.status(500).json({ success: false, error: "Failed to calculate order" });
    }
  });

  // =============================================================================
  // Multi-Timeframe Strategy Routes
  // =============================================================================

  // Orchestrate strategies across timeframes
  app.post("/api/timeframes/orchestrate", isAuthenticated, async (req: any, res) => {
    try {
      const { symbol, userRiskTolerance, availableCapital } = req.body;
      
      const result = await timeframeService.orchestrateStrategies(symbol, userRiskTolerance, availableCapital);
      res.json({ success: true, data: result });
    } catch (error) {
      console.error("Error orchestrating strategies:", error);
      res.status(500).json({ success: false, error: "Failed to orchestrate" });
    }
  });

  // Analyze multiple timeframes
  app.get("/api/timeframes/analysis/:symbol", isAuthenticated, async (req: any, res) => {
    try {
      const { symbol } = req.params;
      
      const analysis = await timeframeService.analyzeMultipleTimeframes(symbol);
      res.json({ success: true, data: analysis });
    } catch (error) {
      console.error("Error analyzing timeframes:", error);
      res.status(500).json({ success: false, error: "Failed to analyze" });
    }
  });

  // Update strategy performance
  app.post("/api/timeframes/performance", isAuthenticated, async (req: any, res) => {
    try {
      const { strategy, timeframe, profit, confidence } = req.body;
      
      await timeframeService.updateStrategyPerformance(strategy, timeframe, profit, confidence);
      res.json({ success: true, message: "Performance updated" });
    } catch (error) {
      console.error("Error updating performance:", error);
      res.status(500).json({ success: false, error: "Failed to update" });
    }
  });

  // Get optimal allocation
  app.get("/api/timeframes/allocation", isAuthenticated, async (req: any, res) => {
    try {
      const { availableCapital = 1.0, riskTolerance = 0.5 } = req.query;
      
      const allocation = await timeframeService.getOptimalAllocation(
        Number(availableCapital), Number(riskTolerance)
      );
      res.json({ success: true, data: allocation });
    } catch (error) {
      console.error("Error getting allocation:", error);
      res.status(500).json({ success: false, error: "Failed to get allocation" });
    }
  });

  // =============================================================================
  // Market Intelligence Routes
  // =============================================================================

  // Order flow analysis
  app.get("/api/intelligence/order-flow/:symbol", isAuthenticated, async (req: any, res) => {
    try {
      const { symbol } = req.params;
      
      const orderFlow = await intelligenceService.analyzeOrderFlow(symbol);
      res.json({ success: true, data: orderFlow });
    } catch (error) {
      console.error("Error analyzing order flow:", error);
      res.status(500).json({ success: false, error: "Failed to analyze" });
    }
  });

  // Whale movement tracking
  app.get("/api/intelligence/whales/:symbol", isAuthenticated, async (req: any, res) => {
    try {
      const { symbol } = req.params;
      
      const whales = await intelligenceService.trackWhaleMovements(symbol);
      res.json({ success: true, data: whales });
    } catch (error) {
      console.error("Error tracking whales:", error);
      res.status(500).json({ success: false, error: "Failed to track" });
    }
  });

  // Arbitrage opportunities
  app.get("/api/intelligence/arbitrage", isAuthenticated, async (req: any, res) => {
    try {
      const opportunities = await intelligenceService.findArbitrageOpportunities();
      res.json({ success: true, data: opportunities });
    } catch (error) {
      console.error("Error finding arbitrage:", error);
      res.status(500).json({ success: false, error: "Failed to find opportunities" });
    }
  });

  // Options flow analysis
  app.get("/api/intelligence/options/:symbol", isAuthenticated, async (req: any, res) => {
    try {
      const { symbol } = req.params;
      
      const options = await intelligenceService.analyzeOptionsFlow(symbol);
      res.json({ success: true, data: options });
    } catch (error) {
      console.error("Error analyzing options:", error);
      res.status(500).json({ success: false, error: "Failed to analyze" });
    }
  });

  // Market intelligence summary
  app.get("/api/intelligence/summary/:symbol", isAuthenticated, async (req: any, res) => {
    try {
      const { symbol } = req.params;
      
      const summary = await intelligenceService.getMarketIntelligenceSummary(symbol);
      res.json({ success: true, data: summary });
    } catch (error) {
      console.error("Error getting intelligence summary:", error);
      res.status(500).json({ success: false, error: "Failed to get summary" });
    }
  });

  // =============================================================================
  // Production Monitoring & Excellence Routes
  // =============================================================================

  // System health dashboard
  app.get("/api/monitoring/health", isAuthenticated, async (req: any, res) => {
    try {
      const health = await monitoringService.getSystemHealth();
      res.json({ success: true, data: health });
    } catch (error) {
      console.error("Error getting system health:", error);
      res.status(500).json({ success: false, error: "Failed to get health" });
    }
  });

  // Performance dashboard
  app.get("/api/monitoring/performance", isAuthenticated, async (req: any, res) => {
    try {
      const dashboard = await monitoringService.getPerformanceDashboard();
      res.json({ success: true, data: dashboard });
    } catch (error) {
      console.error("Error getting performance dashboard:", error);
      res.status(500).json({ success: false, error: "Failed to get dashboard" });
    }
  });

  // A/B testing
  app.post("/api/monitoring/ab-test", isAuthenticated, async (req: any, res) => {
    try {
      const { testName, variantA, variantB, trafficSplit } = req.body;
      
      const test = await monitoringService.runABTest(testName, variantA, variantB, trafficSplit);
      res.json({ success: true, data: test });
    } catch (error) {
      console.error("Error running A/B test:", error);
      res.status(500).json({ success: false, error: "Failed to run test" });
    }
  });

  // Automated reporting
  app.post("/api/monitoring/report", isAuthenticated, async (req: any, res) => {
    try {
      const { type, recipients } = req.body;
      
      const report = await monitoringService.generateAutomatedReport(type, recipients);
      res.json({ success: true, data: report });
    } catch (error) {
      console.error("Error generating report:", error);
      res.status(500).json({ success: false, error: "Failed to generate report" });
    }
  });

  // Performance optimization
  app.post("/api/monitoring/optimize", isAuthenticated, async (req: any, res) => {
    try {
      const optimization = await monitoringService.optimizePerformance();
      res.json({ success: true, data: optimization });
    } catch (error) {
      console.error("Error optimizing performance:", error);
      res.status(500).json({ success: false, error: "Failed to optimize" });
    }
  });

  // Setup predictive alerts
  app.post("/api/monitoring/alerts/setup", isAuthenticated, async (req: any, res) => {
    try {
      await monitoringService.setupPredictiveAlerts();
      res.json({ success: true, message: "Predictive alerts configured" });
    } catch (error) {
      console.error("Error setting up alerts:", error);
      res.status(500).json({ success: false, error: "Failed to setup alerts" });
    }
  });

  // =============================================================================
  // Combined Intelligence Endpoint
  // =============================================================================

  // Complete enhancement system status
  app.get("/api/enhancements/status", isAuthenticated, async (req: any, res) => {
    try {
      const [health, learning, risk] = await Promise.all([
        monitoringService.getSystemHealth(),
        learningService.optimizeParameters(),
        riskService.assessOverallRisk([], {}, 0.5)
      ]);

      const status = {
        timestamp: Date.now(),
        systemHealth: health,
        learningSystem: {
          active: true,
          recentOptimizations: learning.length,
          status: 'operational'
        },
        riskSystem: {
          active: true,
          overallRisk: risk.overallRisk,
          status: 'monitoring'
        },
        personalitySystem: {
          active: true,
          status: 'learning'
        },
        timeframeSystem: {
          active: true,
          status: 'orchestrating'
        },
        intelligenceSystem: {
          active: true,
          status: 'analyzing'
        }
      };

      res.json({ success: true, data: status });
    } catch (error) {
      console.error("Error getting enhancement status:", error);
      res.status(500).json({ success: false, error: "Failed to get status" });
    }
  });
}