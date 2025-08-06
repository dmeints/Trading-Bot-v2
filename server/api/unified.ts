import { Router } from 'express';
import { z } from 'zod';
import { storage } from '../storage';
import { isAuthenticated } from '../replitAuth';

const router = Router();

// Unified API response format
interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

function createResponse<T>(data?: T, error?: string): ApiResponse<T> {
  return {
    success: !error,
    data,
    error,
    timestamp: new Date().toISOString()
  };
}

// Validation schemas
const tradeRequestSchema = z.object({
  symbol: z.string(),
  action: z.enum(['buy', 'sell']),
  quantity: z.number().positive(),
  type: z.enum(['market', 'limit']).default('market'),
  price: z.number().positive().optional()
});

// Market data endpoints
router.get('/market/latest', async (req, res) => {
  try {
    const marketData = await storage.getLatestMarketData();
    res.json(createResponse(marketData));
  } catch (error) {
    console.error('Market data fetch error:', error);
    res.status(500).json(createResponse(undefined, 'Failed to fetch market data'));
  }
});

router.get('/market/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    // For now, filter from latest data since getMarketDataBySymbol may not exist
    const allData = await storage.getLatestMarketData();
    const data = allData.find(item => item.symbol === symbol.toUpperCase());
    res.json(createResponse(data));
  } catch (error) {
    console.error('Market data by symbol error:', error);
    res.status(500).json(createResponse(undefined, `Failed to fetch data for ${req.params.symbol}`));
  }
});

// Trading endpoints
router.post('/trading/execute', isAuthenticated, async (req, res) => {
  try {
    const validation = tradeRequestSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json(createResponse(undefined, 'Invalid trade request'));
    }

    const userId = (req.user as any)?.claims?.sub || 'dev-user-123';
    // Simplified trade execution - in production this would go through trading engine
    const tradeResult = {
      id: `trade-${Date.now()}`,
      ...validation.data,
      status: 'executed',
      executedAt: new Date().toISOString()
    };
    
    res.json(createResponse(tradeResult));
  } catch (error) {
    res.status(500).json(createResponse(undefined, 'Trade execution failed'));
  }
});

router.get('/trading/positions', isAuthenticated, async (req, res) => {
  try {
    const userId = (req.user as any)?.claims?.sub || 'dev-user-123';
    const positions = await storage.getUserPositions(userId);
    res.json(createResponse(positions));
  } catch (error) {
    res.status(500).json(createResponse(undefined, 'Failed to fetch positions'));
  }
});

router.get('/trading/history', isAuthenticated, async (req, res) => {
  try {
    const userId = (req.user as any)?.claims?.sub || 'dev-user-123';
    const limit = parseInt(req.query.limit as string) || 50;
    const trades = await storage.getUserTrades(userId, limit);
    res.json(createResponse(trades));
  } catch (error) {
    res.status(500).json(createResponse(undefined, 'Failed to fetch trade history'));
  }
});

// Portfolio endpoints
router.get('/portfolio/summary', isAuthenticated, async (req, res) => {
  try {
    const userId = (req.user as any)?.claims?.sub || 'dev-user-123';
    const positions = await storage.getUserPositions(userId);
    const snapshot = await storage.getLatestPortfolioSnapshot(userId);

    // Convert string values to numbers for calculations
    const totalValue = positions.reduce((sum, pos) => {
      const quantity = parseFloat(pos.quantity);
      const currentPrice = parseFloat(pos.currentPrice);
      return sum + (quantity * currentPrice);
    }, 0);
    
    const totalPnL = positions.reduce((sum, pos) => {
      const pnl = pos.unrealizedPnl ? parseFloat(pos.unrealizedPnl) : 0;
      return sum + pnl;
    }, 0);

    res.json(createResponse({
      positions: positions.map(pos => ({
        ...pos,
        quantity: parseFloat(pos.quantity),
        avgPrice: parseFloat(pos.entryPrice),
        currentPrice: parseFloat(pos.currentPrice),
        unrealizedPnl: pos.unrealizedPnl ? parseFloat(pos.unrealizedPnl) : 0
      })),
      summary: {
        totalValue,
        totalPnL,
        positionCount: positions.length,
        lastUpdated: snapshot?.createdAt?.toString() || new Date().toISOString()
      }
    }));
  } catch (error) {
    console.error('Portfolio summary error:', error);
    res.status(500).json(createResponse(undefined, 'Failed to fetch portfolio summary'));
  }
});

// AI endpoints
router.get('/ai/status', async (req, res) => {
  try {
    // Check AI agent status from recent activities
    const activities = await storage.getRecentAgentActivities(10);
    const agentTypes = ['market_insight', 'risk_assessor'];
    
    const status = agentTypes.reduce((acc, type) => {
      const lastActivity = activities.find(a => a.agentType === type);
      if (lastActivity?.createdAt) {
        const activityTime = new Date(lastActivity.createdAt).getTime();
        const isRecent = new Date().getTime() - activityTime < 300000; // 5 minutes
        acc[type] = isRecent ? 'active' : 'idle';
      } else {
        acc[type] = 'idle';
      }
      return acc;
    }, {} as Record<string, string>);

    res.json(createResponse(status));
  } catch (error) {
    res.status(500).json(createResponse(undefined, 'Failed to fetch AI status'));
  }
});

router.get('/ai/insights', isAuthenticated, async (req, res) => {
  try {
    const activities = await storage.getRecentAgentActivities(20);
    const insights = activities
      .filter(a => a.agentType === 'market_insight')
      .slice(0, 5)
      .map(a => ({
        type: a.agentType,
        message: a.activity,
        confidence: a.confidence,
        timestamp: a.createdAt,
        data: a.data
      }));

    res.json(createResponse(insights));
  } catch (error) {
    res.status(500).json(createResponse(undefined, 'Failed to fetch AI insights'));
  }
});

// Analytics endpoints
router.get('/analytics/performance', isAuthenticated, async (req, res) => {
  try {
    const userId = (req.user as any)?.claims?.sub || 'dev-user-123';
    const days = parseInt(req.query.days as string) || 30;
    
    // Get performance data for the specified period
    const trades = await storage.getUserTrades(userId, 1000);
    const recentTrades = trades.filter(trade => {
      if (!trade.executedAt) return false;
      const tradeDate = new Date(trade.executedAt);
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      return tradeDate >= cutoff;
    });

    const winningTrades = recentTrades.filter(t => {
      const pnl = t.pnl ? parseFloat(t.pnl) : 0;
      return pnl > 0;
    });

    const totalPnL = recentTrades.reduce((sum, t) => {
      const pnl = t.pnl ? parseFloat(t.pnl) : 0;
      return sum + pnl;
    }, 0);

    const performance = {
      totalTrades: recentTrades.length,
      winRate: recentTrades.length > 0 ? winningTrades.length / recentTrades.length : 0,
      totalPnL,
      averageTrade: recentTrades.length > 0 ? totalPnL / recentTrades.length : 0
    };

    res.json(createResponse(performance));
  } catch (error) {
    res.status(500).json(createResponse(undefined, 'Failed to fetch performance analytics'));
  }
});

// Health check
router.get('/health', (req, res) => {
  res.json(createResponse({
    status: 'healthy',
    version: '1.0.0',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  }));
});

export { router as unifiedApi };
export type { ApiResponse };