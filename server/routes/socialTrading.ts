import { Router } from 'express';
import { logger } from '../utils/logger.js';

const socialTradingRouter = Router();

// Import social trading manager service dynamically
let socialTradingManager: any = null;

async function initializeSocialTradingManager() {
  if (!socialTradingManager) {
    try {
      const { SocialTradingManager } = await import('../services/SocialTradingManager.js');
      socialTradingManager = new SocialTradingManager();
      logger.info('[SocialTrading] SocialTradingManager service initialized');
    } catch (error) {
      logger.error('[SocialTrading] Failed to initialize SocialTradingManager:', error);
      throw error;
    }
  }
}

/**
 * GET /api/social/strategies
 * Get strategy providers with filtering and pagination
 */
socialTradingRouter.get('/strategies', async (req, res) => {
  try {
    await initializeSocialTradingManager();
    
    const { 
      riskLevel, 
      tradingStyle, 
      verified, 
      minReturn = 0, 
      maxDrawdown = -1,
      limit = 20,
      sortBy = 'performance'
    } = req.query;
    
    let strategies = socialTradingManager.getStrategyProviders();
    
    // Apply filters
    if (riskLevel) {
      strategies = strategies.filter((s: any) => s.strategy.riskLevel === riskLevel);
    }
    if (tradingStyle) {
      strategies = strategies.filter((s: any) => s.strategy.tradingStyle === tradingStyle);
    }
    if (verified !== undefined) {
      strategies = strategies.filter((s: any) => s.verified === (verified === 'true'));
    }
    if (minReturn) {
      strategies = strategies.filter((s: any) => s.performance.totalReturn >= parseFloat(minReturn as string));
    }
    if (maxDrawdown) {
      strategies = strategies.filter((s: any) => s.performance.maxDrawdown >= parseFloat(maxDrawdown as string));
    }

    // Sort strategies
    if (sortBy === 'performance') {
      strategies.sort((a: any, b: any) => b.performance.totalReturn - a.performance.totalReturn);
    } else if (sortBy === 'followers') {
      strategies.sort((a: any, b: any) => b.performance.followersCount - a.performance.followersCount);
    } else if (sortBy === 'sharpe') {
      strategies.sort((a: any, b: any) => b.performance.sharpeRatio - a.performance.sharpeRatio);
    }

    // Limit results
    strategies = strategies.slice(0, parseInt(limit as string));

    const summary = {
      totalStrategies: strategies.length,
      avgReturn: strategies.length > 0 ? 
        strategies.reduce((sum: number, s: any) => sum + s.performance.totalReturn, 0) / strategies.length : 0,
      totalFollowers: strategies.reduce((sum: number, s: any) => sum + s.performance.followersCount, 0),
      totalAUM: strategies.reduce((sum: number, s: any) => sum + s.performance.aum, 0)
    };

    res.json({
      success: true,
      data: {
        strategies,
        summary
      }
    });

  } catch (error) {
    logger.error('[SocialTrading] Error getting strategies:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get strategies'
    });
  }
});

/**
 * GET /api/social/strategies/:providerId
 * Get detailed strategy provider information
 */
socialTradingRouter.get('/strategies/:providerId', async (req, res) => {
  try {
    await initializeSocialTradingManager();
    
    const { providerId } = req.params;
    const provider = socialTradingManager.getStrategyProvider(providerId);
    
    if (!provider) {
      return res.status(404).json({
        success: false,
        error: 'Strategy provider not found'
      });
    }

    // Get recent trades for this provider
    const recentTrades = socialTradingManager.getSocialTrades(providerId)
      .slice(0, 10); // Last 10 trades

    res.json({
      success: true,
      data: {
        provider,
        recentTrades,
        statistics: {
          averageTradeSize: recentTrades.length > 0 ? 
            recentTrades.reduce((sum: number, t: any) => sum + (t.quantity * t.price), 0) / recentTrades.length : 0,
          tradingFrequency: provider.performance.totalTrades / Math.max(1, 
            Math.ceil((Date.now() - provider.createdAt.getTime()) / (1000 * 60 * 60 * 24))), // trades per day
        }
      }
    });

  } catch (error) {
    logger.error('[SocialTrading] Error getting strategy details:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get strategy details'
    });
  }
});

/**
 * POST /api/social/strategies
 * Create a new strategy provider
 */
socialTradingRouter.post('/strategies', async (req, res) => {
  try {
    await initializeSocialTradingManager();
    
    const {
      userId,
      username,
      displayName,
      bio,
      strategy,
      subscription
    } = req.body;

    if (!userId || !username || !displayName || !bio || !strategy) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: userId, username, displayName, bio, strategy'
      });
    }

    if (!strategy.name || !strategy.description || !strategy.riskLevel || !strategy.tradingStyle) {
      return res.status(400).json({
        success: false,
        error: 'Missing required strategy fields: name, description, riskLevel, tradingStyle'
      });
    }

    const providerId = await socialTradingManager.createStrategyProvider(userId, {
      username,
      displayName,
      bio,
      strategy,
      subscription
    });

    res.json({
      success: true,
      data: {
        providerId,
        message: 'Strategy provider created successfully'
      }
    });

  } catch (error) {
    logger.error('[SocialTrading] Error creating strategy provider:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create strategy provider'
    });
  }
});

/**
 * POST /api/social/copy/start
 * Start copy trading a strategy
 */
socialTradingRouter.post('/copy/start', async (req, res) => {
  try {
    await initializeSocialTradingManager();
    
    const {
      followerId,
      strategyProviderId,
      settings
    } = req.body;

    if (!followerId || !strategyProviderId || !settings) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: followerId, strategyProviderId, settings'
      });
    }

    if (!settings.copyMode || !settings.allocationAmount) {
      return res.status(400).json({
        success: false,
        error: 'Missing required settings: copyMode, allocationAmount'
      });
    }

    const copyTradingId = await socialTradingManager.startCopyTrading(
      followerId,
      strategyProviderId,
      settings
    );

    res.json({
      success: true,
      data: {
        copyTradingId,
        message: 'Copy trading started successfully'
      }
    });

  } catch (error) {
    logger.error('[SocialTrading] Error starting copy trading:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to start copy trading'
    });
  }
});

/**
 * POST /api/social/copy/stop
 * Stop copy trading a strategy
 */
socialTradingRouter.post('/copy/stop', async (req, res) => {
  try {
    await initializeSocialTradingManager();
    
    const { copyTradingId } = req.body;

    if (!copyTradingId) {
      return res.status(400).json({
        success: false,
        error: 'copyTradingId is required'
      });
    }

    const stopped = await socialTradingManager.stopCopyTrading(copyTradingId);

    if (stopped) {
      res.json({
        success: true,
        data: {
          copyTradingId,
          message: 'Copy trading stopped successfully'
        }
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'Copy trading relationship not found'
      });
    }

  } catch (error) {
    logger.error('[SocialTrading] Error stopping copy trading:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to stop copy trading'
    });
  }
});

/**
 * GET /api/social/copy/relationships
 * Get copy trading relationships for a user
 */
socialTradingRouter.get('/copy/relationships', async (req, res) => {
  try {
    await initializeSocialTradingManager();
    
    const { followerId } = req.query;
    const relationships = socialTradingManager.getCopyTradingRelationships(followerId as string);

    const activeRelationships = relationships.filter((r: any) => r.isActive);
    const totalInvested = relationships.reduce((sum: number, r: any) => sum + r.performance.totalInvested, 0);
    const totalReturn = relationships.reduce((sum: number, r: any) => sum + r.performance.realizedPnL + r.performance.unrealizedPnL, 0);

    res.json({
      success: true,
      data: {
        relationships,
        summary: {
          total: relationships.length,
          active: activeRelationships.length,
          totalInvested,
          totalReturn,
          overallReturnPercentage: totalInvested > 0 ? (totalReturn / totalInvested) * 100 : 0
        }
      }
    });

  } catch (error) {
    logger.error('[SocialTrading] Error getting copy relationships:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get copy relationships'
    });
  }
});

/**
 * POST /api/social/trades
 * Record a new social trade
 */
socialTradingRouter.post('/trades', async (req, res) => {
  try {
    await initializeSocialTradingManager();
    
    const {
      strategyProviderId,
      symbol,
      side,
      type,
      quantity,
      price,
      description,
      isPublic = true,
      tags = []
    } = req.body;

    if (!strategyProviderId || !symbol || !side || !type || !quantity || !price) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: strategyProviderId, symbol, side, type, quantity, price'
      });
    }

    const tradeId = await socialTradingManager.recordSocialTrade(strategyProviderId, {
      symbol,
      side,
      type,
      quantity: parseFloat(quantity),
      price: parseFloat(price),
      description,
      isPublic,
      tags
    });

    res.json({
      success: true,
      data: {
        tradeId,
        message: 'Social trade recorded successfully'
      }
    });

  } catch (error) {
    logger.error('[SocialTrading] Error recording social trade:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to record social trade'
    });
  }
});

/**
 * GET /api/social/trades
 * Get social trades with filtering
 */
socialTradingRouter.get('/trades', async (req, res) => {
  try {
    await initializeSocialTradingManager();
    
    const { strategyProviderId, limit = 50 } = req.query;
    const trades = socialTradingManager.getSocialTrades(strategyProviderId as string);

    // Sort by timestamp (most recent first) and limit
    const sortedTrades = trades
      .sort((a: any, b: any) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, parseInt(limit as string));

    const summary = {
      totalTrades: sortedTrades.length,
      totalVolume: sortedTrades.reduce((sum: number, t: any) => sum + (t.quantity * t.price), 0),
      avgEngagement: sortedTrades.length > 0 ? 
        sortedTrades.reduce((sum: number, t: any) => sum + t.likes + t.comments + t.shares, 0) / sortedTrades.length : 0,
      totalCopies: sortedTrades.reduce((sum: number, t: any) => sum + t.copiedBy, 0)
    };

    res.json({
      success: true,
      data: {
        trades: sortedTrades,
        summary
      }
    });

  } catch (error) {
    logger.error('[SocialTrading] Error getting social trades:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get social trades'
    });
  }
});

/**
 * GET /api/social/feed
 * Get trading feed with filtering and pagination
 */
socialTradingRouter.get('/feed', async (req, res) => {
  try {
    await initializeSocialTradingManager();
    
    const { type, limit = 50 } = req.query;
    const feed = socialTradingManager.getTradingFeed(
      parseInt(limit as string),
      type as any
    );

    const summary = {
      totalItems: feed.length,
      totalEngagement: feed.reduce((sum: number, item: any) => sum + item.likes + item.comments + item.shares, 0),
      totalViews: feed.reduce((sum: number, item: any) => sum + item.views, 0),
      types: feed.reduce((acc: Record<string, number>, item: any) => {
        acc[item.type] = (acc[item.type] || 0) + 1;
        return acc;
      }, {})
    };

    res.json({
      success: true,
      data: {
        feed,
        summary
      }
    });

  } catch (error) {
    logger.error('[SocialTrading] Error getting trading feed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get trading feed'
    });
  }
});

/**
 * POST /api/social/feed
 * Add new item to trading feed
 */
socialTradingRouter.post('/feed', async (req, res) => {
  try {
    await initializeSocialTradingManager();
    
    const {
      type,
      authorId,
      authorName,
      content,
      attachments,
      tags,
      visibility = 'public'
    } = req.body;

    if (!type || !authorId || !authorName || !content) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: type, authorId, authorName, content'
      });
    }

    const feedId = await socialTradingManager.addToTradingFeed({
      type,
      authorId,
      authorName,
      content,
      attachments,
      tags,
      visibility
    });

    res.json({
      success: true,
      data: {
        feedId,
        message: 'Feed item added successfully'
      }
    });

  } catch (error) {
    logger.error('[SocialTrading] Error adding to feed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add to trading feed'
    });
  }
});

/**
 * POST /api/social/feed/:feedId/engage
 * Engage with a feed item (like, view, etc.)
 */
socialTradingRouter.post('/feed/:feedId/engage', async (req, res) => {
  try {
    await initializeSocialTradingManager();
    
    const { feedId } = req.params;
    const { action } = req.body;

    if (!action || !['like', 'unlike', 'view'].includes(action)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid action. Must be: like, unlike, view'
      });
    }

    const success = await socialTradingManager.engageWithFeed(feedId, action);

    if (success) {
      res.json({
        success: true,
        data: {
          feedId,
          action,
          message: 'Engagement recorded successfully'
        }
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'Feed item not found'
      });
    }

  } catch (error) {
    logger.error('[SocialTrading] Error engaging with feed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to engage with feed item'
    });
  }
});

/**
 * GET /api/social/leaderboard
 * Get trader leaderboard for specified timeframe
 */
socialTradingRouter.get('/leaderboard', async (req, res) => {
  try {
    await initializeSocialTradingManager();
    
    const { timeframe = 'monthly', limit = 50 } = req.query;

    if (!['daily', 'weekly', 'monthly', 'yearly', 'all_time'].includes(timeframe as string)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid timeframe. Must be: daily, weekly, monthly, yearly, all_time'
      });
    }

    const leaderboard = socialTradingManager.getLeaderboard(timeframe as any)
      .slice(0, parseInt(limit as string));

    const summary = {
      totalEntries: leaderboard.length,
      topPerformer: leaderboard[0] || null,
      avgReturn: leaderboard.length > 0 ? 
        leaderboard.reduce((sum: number, entry: any) => sum + entry.totalReturn, 0) / leaderboard.length : 0,
      avgSharpe: leaderboard.length > 0 ? 
        leaderboard.reduce((sum: number, entry: any) => sum + entry.sharpeRatio, 0) / leaderboard.length : 0
    };

    res.json({
      success: true,
      data: {
        leaderboard,
        timeframe,
        summary
      }
    });

  } catch (error) {
    logger.error('[SocialTrading] Error getting leaderboard:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get leaderboard'
    });
  }
});

export { socialTradingRouter };