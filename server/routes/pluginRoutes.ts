import { Router } from 'express';
import { pluginManager } from '../services/pluginManager';
import { logger } from '../utils/logger';
import { isAuthenticated } from '../replitAuth';
import { z } from 'zod';

const router = Router();

// Get all plugins
router.get('/plugins', isAuthenticated, async (req, res) => {
  try {
    await pluginManager.initialize();
    const plugins = Array.from(pluginManager.getPlugins().values()).map(plugin => ({
      ...plugin.manifest,
      status: 'active'
    }));

    res.json({
      success: true,
      data: plugins
    });
  } catch (error) {
    logger.error('Failed to fetch plugins', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch plugins'
    });
  }
});

// Get plugin details
router.get('/plugins/:name', isAuthenticated, async (req, res) => {
  try {
    const { name } = req.params;
    await pluginManager.initialize();
    
    const plugin = pluginManager.getPlugins().get(name);
    if (!plugin) {
      return res.status(404).json({
        success: false,
        error: 'Plugin not found'
      });
    }

    res.json({
      success: true,
      data: {
        ...plugin.manifest,
        status: 'active',
        path: plugin.path
      }
    });
  } catch (error) {
    logger.error('Failed to fetch plugin details', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch plugin details'
    });
  }
});

// Get registered strategies
router.get('/strategies', isAuthenticated, async (req, res) => {
  try {
    await pluginManager.initialize();
    const strategies = Array.from(pluginManager.getStrategies().entries()).map(([name, strategy]) => ({
      name,
      description: strategy.description,
      parameters: strategy.parameters
    }));

    res.json({
      success: true,
      data: strategies
    });
  } catch (error) {
    logger.error('Failed to fetch strategies', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch strategies'
    });
  }
});

// Execute strategy
const executeStrategySchema = z.object({
  strategyName: z.string(),
  context: z.object({
    marketData: z.array(z.any()),
    indicators: z.record(z.array(z.number())).optional().default({}),
    portfolio: z.any().optional(),
    timestamp: z.string().transform(str => new Date(str))
  })
});

router.post('/strategies/execute', isAuthenticated, async (req, res) => {
  try {
    const { strategyName, context } = executeStrategySchema.parse(req.body);
    
    await pluginManager.initialize();
    const result = await pluginManager.executeStrategy(strategyName, context);
    
    if (!result) {
      return res.status(404).json({
        success: false,
        error: 'Strategy not found or execution failed'
      });
    }

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Failed to execute strategy', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to execute strategy'
    });
  }
});

// Get UI panels
router.get('/panels', isAuthenticated, async (req, res) => {
  try {
    await pluginManager.initialize();
    const panels = Array.from(pluginManager.getUIPanels().entries()).map(([name, panel]) => ({
      name,
      ...panel
    }));

    res.json({
      success: true,
      data: panels
    });
  } catch (error) {
    logger.error('Failed to fetch UI panels', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch UI panels'
    });
  }
});

// Get data connectors
router.get('/connectors', isAuthenticated, async (req, res) => {
  try {
    await pluginManager.initialize();
    const connectors = Array.from(pluginManager.getDataConnectors().entries()).map(([name, connector]) => ({
      name,
      description: connector.description
    }));

    res.json({
      success: true,
      data: connectors
    });
  } catch (error) {
    logger.error('Failed to fetch data connectors', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch data connectors'
    });
  }
});

// Get signal transformers
router.get('/transformers', isAuthenticated, async (req, res) => {
  try {
    await pluginManager.initialize();
    const transformers = Array.from(pluginManager.getSignalTransformers().entries()).map(([name, transformer]) => ({
      name,
      description: transformer.description
    }));

    res.json({
      success: true,
      data: transformers
    });
  } catch (error) {
    logger.error('Failed to fetch signal transformers', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch signal transformers'
    });
  }
});

// Reload plugin
router.post('/plugins/:name/reload', isAuthenticated, async (req, res) => {
  try {
    const { name } = req.params;
    await pluginManager.initialize();
    await pluginManager.reloadPlugin(name);

    logger.info('Plugin reloaded', { 
      plugin: name,
      user: (req.user as any)?.claims?.sub 
    });

    res.json({
      success: true,
      message: `Plugin ${name} reloaded successfully`
    });
  } catch (error) {
    logger.error('Failed to reload plugin', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to reload plugin'
    });
  }
});

// Uninstall plugin
router.delete('/plugins/:name', isAuthenticated, async (req, res) => {
  try {
    const { name } = req.params;
    await pluginManager.initialize();
    await pluginManager.uninstallPlugin(name);

    logger.info('Plugin uninstalled', { 
      plugin: name,
      user: (req.user as any)?.claims?.sub 
    });

    res.json({
      success: true,
      message: `Plugin ${name} uninstalled successfully`
    });
  } catch (error) {
    logger.error('Failed to uninstall plugin', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to uninstall plugin'
    });
  }
});

// Plugin marketplace endpoints
router.get('/marketplace', isAuthenticated, async (req, res) => {
  try {
    // Mock marketplace data - in production this would fetch from a real marketplace API
    const marketplacePlugins = [
      {
        name: 'advanced-ta-indicators',
        version: '2.1.0',
        description: 'Advanced technical analysis indicators including Ichimoku, Bollinger Bands, and more',
        author: 'TradingTools Inc',
        downloads: 15420,
        rating: 4.8,
        category: 'indicators',
        price: 'free',
        url: 'https://marketplace.skippy.com/plugins/advanced-ta-indicators.zip'
      },
      {
        name: 'crypto-news-sentiment',
        version: '1.3.2',
        description: 'Real-time cryptocurrency news sentiment analysis and signal generation',
        author: 'NewsAI Labs',
        downloads: 8932,
        rating: 4.6,
        category: 'data_sources',
        price: '$29.99',
        url: 'https://marketplace.skippy.com/plugins/crypto-news-sentiment.zip'
      },
      {
        name: 'portfolio-optimizer',
        version: '3.0.1',
        description: 'Modern portfolio theory optimization with risk parity and black-litterman models',
        author: 'QuantLib Team',
        downloads: 12156,
        rating: 4.9,
        category: 'portfolio',
        price: '$49.99',
        url: 'https://marketplace.skippy.com/plugins/portfolio-optimizer.zip'
      }
    ];

    res.json({
      success: true,
      data: marketplacePlugins
    });
  } catch (error) {
    logger.error('Failed to fetch marketplace plugins', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch marketplace plugins'
    });
  }
});

// Install plugin from marketplace
const installPluginSchema = z.object({
  pluginUrl: z.string().url(),
  pluginName: z.string()
});

router.post('/marketplace/install', isAuthenticated, async (req, res) => {
  try {
    const { pluginUrl, pluginName } = installPluginSchema.parse(req.body);
    
    await pluginManager.initialize();
    // In a real implementation, this would download and install the plugin
    await pluginManager.installPlugin(pluginUrl);

    logger.info('Plugin installed from marketplace', { 
      plugin: pluginName,
      url: pluginUrl,
      user: (req.user as any)?.claims?.sub 
    });

    res.json({
      success: true,
      message: `Plugin ${pluginName} installed successfully`
    });
  } catch (error) {
    logger.error('Failed to install plugin from marketplace', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to install plugin'
    });
  }
});

export default router;