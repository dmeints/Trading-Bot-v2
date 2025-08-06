import { Router } from 'express';
import { isAuthenticated } from '../replitAuth';
import { ultraAdaptiveRL } from '../services/ultraAdaptiveRL';
import { crossDomainSynergies } from '../services/crossDomainSynergies';

const router = Router();

// Get high-impact events for user
router.get('/high-impact-events', isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const lookbackHours = parseInt(req.query.hours as string) || 24;
    
    const events = await ultraAdaptiveRL.identifyHighImpactEvents(userId, lookbackHours);
    res.json({ events, totalCount: events.length });
  } catch (error) {
    console.error('[UltraAdaptive] Error getting high-impact events:', error);
    res.status(500).json({ error: 'Failed to get high-impact events' });
  }
});

// Trigger adaptive retraining
router.post('/retrain', isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const { eventIds, forceRetrain } = req.body;
    
    let events;
    if (eventIds && eventIds.length > 0) {
      // Retrain on specific events
      const allEvents = await ultraAdaptiveRL.identifyHighImpactEvents(userId, 168); // 7 days
      events = allEvents.filter(e => eventIds.includes(e.id));
    } else {
      // Retrain on recent high-impact events
      events = await ultraAdaptiveRL.identifyHighImpactEvents(userId, 48); // 2 days
      events = events.filter(e => e.learningPotential > 0.6);
    }
    
    if (events.length === 0 && !forceRetrain) {
      return res.json({ 
        status: 'no_events', 
        message: 'No high-impact events found for retraining' 
      });
    }
    
    const result = await ultraAdaptiveRL.triggerAdaptiveRetraining(events);
    res.json(result);
  } catch (error) {
    console.error('[UltraAdaptive] Error triggering retraining:', error);
    res.status(500).json({ error: 'Failed to trigger retraining' });
  }
});

// Generate what-if scenarios for a trade
router.get('/what-if/:tradeId', isAuthenticated, async (req: any, res) => {
  try {
    const { tradeId } = req.params;
    
    const scenarios = await ultraAdaptiveRL.generateWhatIfScenarios(tradeId);
    res.json({ tradeId, scenarios, scenarioCount: scenarios.length });
  } catch (error) {
    console.error('[UltraAdaptive] Error generating what-if scenarios:', error);
    if (error instanceof Error && error.message.includes('not found')) {
      res.status(404).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Failed to generate what-if scenarios' });
    }
  }
});

// Vector search for similar trades
router.post('/vector-search', isAuthenticated, async (req: any, res) => {
  try {
    const { query, limit } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: 'Query is required for vector search' });
    }
    
    const results = await ultraAdaptiveRL.vectorSearchSimilarTrades(query, limit || 10);
    res.json({ query, results, resultCount: results.length });
  } catch (error) {
    console.error('[UltraAdaptive] Error in vector search:', error);
    res.status(500).json({ error: 'Failed to perform vector search' });
  }
});

// Get analogous historical scenarios
router.post('/analogous-scenarios', isAuthenticated, async (req: any, res) => {
  try {
    const { context } = req.body;
    
    if (!context) {
      return res.status(400).json({ error: 'Context is required for analogous scenario search' });
    }
    
    const scenarios = await ultraAdaptiveRL.getAnalogousHistoricalScenarios(context);
    res.json({ context, scenarios, scenarioCount: scenarios.length });
  } catch (error) {
    console.error('[UltraAdaptive] Error getting analogous scenarios:', error);
    res.status(500).json({ error: 'Failed to get analogous scenarios' });
  }
});

// Get enriched market context with cross-domain data
router.get('/enriched-context/:symbol', isAuthenticated, async (req: any, res) => {
  try {
    const { symbol } = req.params;
    
    const enrichedContext = await crossDomainSynergies.getEnrichedMarketContext(symbol);
    res.json(enrichedContext);
  } catch (error) {
    console.error('[UltraAdaptive] Error getting enriched context:', error);
    res.status(500).json({ error: 'Failed to get enriched market context' });
  }
});

// Correlate on-chain data with RL signals
router.post('/correlate-onchain', isAuthenticated, async (req: any, res) => {
  try {
    const { symbol, rlSignal } = req.body;
    
    if (!symbol || !rlSignal) {
      return res.status(400).json({ error: 'Symbol and RL signal are required' });
    }
    
    const correlatedData = await crossDomainSynergies.correlateOnChainWithRL(symbol, rlSignal);
    res.json(correlatedData);
  } catch (error) {
    console.error('[UltraAdaptive] Error correlating on-chain data:', error);
    res.status(500).json({ error: 'Failed to correlate on-chain data' });
  }
});

// Integrate social sentiment
router.get('/sentiment/:symbol', isAuthenticated, async (req: any, res) => {
  try {
    const { symbol } = req.params;
    
    const sentimentData = await crossDomainSynergies.integrateSocialSentiment(symbol);
    res.json({ symbol, sentiment: sentimentData });
  } catch (error) {
    console.error('[UltraAdaptive] Error getting sentiment data:', error);
    res.status(500).json({ error: 'Failed to get sentiment data' });
  }
});

// Detect cross-market arbitrage opportunities
router.post('/arbitrage-detection', isAuthenticated, async (req: any, res) => {
  try {
    const { symbols } = req.body;
    
    if (!symbols || !Array.isArray(symbols)) {
      return res.status(400).json({ error: 'Symbols array is required' });
    }
    
    const opportunities = await crossDomainSynergies.detectCrossMarketArbitrage(symbols);
    res.json({ symbols, opportunities, opportunityCount: opportunities.length });
  } catch (error) {
    console.error('[UltraAdaptive] Error detecting arbitrage:', error);
    res.status(500).json({ error: 'Failed to detect arbitrage opportunities' });
  }
});

// Generate cross-domain explanation for copilot
router.post('/explain-cross-domain', isAuthenticated, async (req: any, res) => {
  try {
    const { event } = req.body;
    
    if (!event) {
      return res.status(400).json({ error: 'Event is required for explanation' });
    }
    
    const explanation = await crossDomainSynergies.generateCopilotExplanation(event);
    res.json({ event, explanation });
  } catch (error) {
    console.error('[UltraAdaptive] Error generating explanation:', error);
    res.status(500).json({ error: 'Failed to generate cross-domain explanation' });
  }
});

// Index a trade for vector search
router.post('/index-trade', isAuthenticated, async (req: any, res) => {
  try {
    const { trade } = req.body;
    
    if (!trade) {
      return res.status(400).json({ error: 'Trade is required for indexing' });
    }
    
    await ultraAdaptiveRL.indexTradeForVectorSearch(trade);
    res.json({ success: true, message: 'Trade indexed for vector search' });
  } catch (error) {
    console.error('[UltraAdaptive] Error indexing trade:', error);
    res.status(500).json({ error: 'Failed to index trade' });
  }
});

// Get on-chain enrichment for symbol
router.get('/onchain/:symbol', isAuthenticated, async (req: any, res) => {
  try {
    const { symbol } = req.params;
    
    const onChainData = await crossDomainSynergies.enrichWithOnChainData(symbol);
    res.json({ symbol, onChainData });
  } catch (error) {
    console.error('[UltraAdaptive] Error getting on-chain data:', error);
    res.status(500).json({ error: 'Failed to get on-chain data' });
  }
});

export default router;