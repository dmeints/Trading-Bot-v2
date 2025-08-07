import { Router } from 'express';
import { isAuthenticated } from '../replitAuth';
import { storage } from '../storage';
import { z } from 'zod';

const router = Router();

const LayoutConfigSchema = z.object({
  name: z.string().min(1).max(100),
  panels: z.array(z.object({
    id: z.string(),
    title: z.string(),
    component: z.string(),
    visible: z.boolean(),
    size: z.enum(['small', 'medium', 'large']),
    position: z.object({
      x: z.number(),
      y: z.number(),
    }),
  })),
  gridColumns: z.number().min(1).max(12),
  preset: z.string().optional(),
});

// Get user layouts
router.get('/', isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const layouts = await storage.getUserLayouts(userId);
    res.json(layouts);
  } catch (error) {
    console.error('Error fetching user layouts:', error);
    res.status(500).json({ error: 'Failed to fetch layouts' });
  }
});

// Save user layout
router.post('/', isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const layoutData = LayoutConfigSchema.parse(req.body);
    
    const layout = await storage.saveUserLayout(userId, {
      layoutName: layoutData.name,
      layoutConfig: {
        panels: layoutData.panels,
        gridColumns: layoutData.gridColumns,
        preset: layoutData.preset,
      },
      isDefault: false,
    });
    
    res.json(layout);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid layout data', details: error.errors });
    }
    console.error('Error saving user layout:', error);
    res.status(500).json({ error: 'Failed to save layout' });
  }
});

// Apply layout preset
router.post('/apply-preset', isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const { preset } = req.body;
    
    if (!preset || typeof preset !== 'string') {
      return res.status(400).json({ error: 'Preset name is required' });
    }
    
    // Define preset configurations
    const presets = {
      'trading-focus': {
        name: 'Trading Focus',
        panels: [
          { id: 'trading-chart', title: 'Trading Chart', component: 'TradingChart', visible: true, size: 'large', position: { x: 0, y: 0 } },
          { id: 'order-book', title: 'Order Book', component: 'OrderBook', visible: true, size: 'medium', position: { x: 1, y: 0 } },
          { id: 'recent-trades', title: 'Recent Trades', component: 'RecentTrades', visible: true, size: 'medium', position: { x: 0, y: 1 } },
        ],
        gridColumns: 2,
      },
      'analytics-focus': {
        name: 'Analytics Focus',
        panels: [
          { id: 'trading-chart', title: 'Trading Chart', component: 'TradingChart', visible: true, size: 'large', position: { x: 0, y: 0 } },
          { id: 'portfolio-summary', title: 'Portfolio', component: 'PortfolioSummary', visible: true, size: 'medium', position: { x: 1, y: 0 } },
          { id: 'market-data', title: 'Market Data', component: 'MarketData', visible: true, size: 'medium', position: { x: 0, y: 1 } },
        ],
        gridColumns: 2,
      },
      'copilot-focus': {
        name: 'AI Copilot Focus',
        panels: [
          { id: 'ai-insights', title: 'AI Insights', component: 'AIInsights', visible: true, size: 'large', position: { x: 0, y: 0 } },
          { id: 'trading-chart', title: 'Trading Chart', component: 'TradingChart', visible: true, size: 'medium', position: { x: 1, y: 0 } },
          { id: 'portfolio-summary', title: 'Portfolio', component: 'PortfolioSummary', visible: true, size: 'medium', position: { x: 0, y: 1 } },
        ],
        gridColumns: 2,
      },
    };
    
    const presetConfig = presets[preset as keyof typeof presets];
    if (!presetConfig) {
      return res.status(400).json({ error: 'Invalid preset name' });
    }
    
    const layout = await storage.saveUserLayout(userId, {
      layoutName: presetConfig.name,
      layoutConfig: presetConfig,
      isDefault: true,
    });
    
    res.json(layout);
  } catch (error) {
    console.error('Error applying layout preset:', error);
    res.status(500).json({ error: 'Failed to apply preset' });
  }
});

// Delete user layout
router.delete('/:layoutId', isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const { layoutId } = req.params;
    
    await storage.deleteUserLayout(userId, layoutId);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting user layout:', error);
    res.status(500).json({ error: 'Failed to delete layout' });
  }
});

export default router;