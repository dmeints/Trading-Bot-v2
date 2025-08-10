import { logger } from '../utils/logger.js';
import { EventEmitter } from 'events';
import crypto from 'crypto';

interface StrategyProvider {
  id: string;
  userId: string;
  username: string;
  displayName: string;
  bio: string;
  avatar?: string;
  verified: boolean;
  isPublic: boolean;
  createdAt: Date;
  
  // Performance metrics
  performance: {
    totalReturn: number;
    annualizedReturn: number;
    sharpeRatio: number;
    maxDrawdown: number;
    winRate: number;
    totalTrades: number;
    followersCount: number;
    aum: number; // Assets under management
    lastTradeAt: Date;
  };
  
  // Strategy details
  strategy: {
    name: string;
    description: string;
    riskLevel: 'low' | 'medium' | 'high' | 'very_high';
    tradingStyle: 'scalping' | 'day_trading' | 'swing' | 'position' | 'algorithmic';
    instruments: string[];
    timeframes: string[];
    minInvestment: number;
    performanceFee: number; // Percentage
  };
  
  // Subscription settings
  subscription: {
    isActive: boolean;
    monthlyFee?: number;
    trialPeriod: number; // Days
    subscriptionCount: number;
  };
}

interface CopyTrading {
  id: string;
  followerId: string;
  strategyProviderId: string;
  isActive: boolean;
  startDate: Date;
  endDate?: Date;
  
  // Copy settings
  settings: {
    copyMode: 'percentage' | 'fixed' | 'proportional';
    allocationAmount: number; // Total amount allocated
    positionSizing: number; // Percentage of provider's position size
    maxOpenTrades: number;
    stopLossEnabled: boolean;
    takeProfitEnabled: boolean;
    riskLimit: number; // Maximum loss percentage
  };
  
  // Performance tracking
  performance: {
    totalInvested: number;
    currentValue: number;
    realizedPnL: number;
    unrealizedPnL: number;
    totalReturn: number;
    tradesCopied: number;
    successfulTrades: number;
    fees: number;
  };
}

interface SocialTrade {
  id: string;
  strategyProviderId: string;
  symbol: string;
  side: 'buy' | 'sell';
  type: 'market' | 'limit' | 'stop';
  quantity: number;
  price: number;
  timestamp: Date;
  status: 'pending' | 'executed' | 'cancelled';
  
  // Social features
  isPublic: boolean;
  likes: number;
  comments: number;
  shares: number;
  description?: string;
  tags: string[];
  
  // Copy trading metrics
  copiedBy: number; // Number of followers who copied this trade
  totalCopyValue: number; // Total value copied across all followers
}

interface TradingFeed {
  id: string;
  type: 'trade' | 'insight' | 'strategy' | 'educational' | 'alert';
  authorId: string;
  authorName: string;
  content: string;
  attachments?: {
    type: 'image' | 'chart' | 'document';
    url: string;
    caption?: string;
  }[];
  timestamp: Date;
  
  // Engagement metrics
  likes: number;
  comments: number;
  shares: number;
  views: number;
  
  // Related data
  relatedTrade?: string; // Trade ID if applicable
  relatedStrategy?: string; // Strategy ID if applicable
  tags: string[];
  visibility: 'public' | 'followers' | 'premium';
}

interface LeaderboardEntry {
  rank: number;
  strategyProviderId: string;
  username: string;
  displayName: string;
  avatar?: string;
  verified: boolean;
  
  // Performance metrics for ranking
  score: number; // Composite score
  totalReturn: number;
  sharpeRatio: number;
  maxDrawdown: number;
  winRate: number;
  followersCount: number;
  aum: number;
  
  // Ranking details
  previousRank?: number;
  rankChange: number;
  timeframe: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'all_time';
}

export class SocialTradingManager extends EventEmitter {
  private strategyProviders: Map<string, StrategyProvider>;
  private copyTradingRelationships: Map<string, CopyTrading>;
  private socialTrades: Map<string, SocialTrade>;
  private tradingFeed: TradingFeed[];
  private leaderboards: Map<string, LeaderboardEntry[]>; // timeframe -> entries
  
  constructor() {
    super();
    this.strategyProviders = new Map();
    this.copyTradingRelationships = new Map();
    this.socialTrades = new Map();
    this.tradingFeed = [];
    this.leaderboards = new Map();
    
    this.initializeTestData();
    
    logger.info('[SocialTradingManager] Initialized with social trading and copy trading capabilities');
  }

  private initializeTestData(): void {
    // Create sample strategy providers
    const sampleProviders: StrategyProvider[] = [
      {
        id: 'provider_001',
        userId: 'user_001',
        username: 'cryptomaster_pro',
        displayName: 'CryptoMaster Pro',
        bio: 'Professional crypto trader with 5+ years of experience. Specializing in swing trading and technical analysis.',
        verified: true,
        isPublic: true,
        createdAt: new Date('2023-01-15'),
        performance: {
          totalReturn: 0.485, // 48.5%
          annualizedReturn: 0.325,
          sharpeRatio: 1.85,
          maxDrawdown: -0.125,
          winRate: 0.68,
          totalTrades: 245,
          followersCount: 1250,
          aum: 2850000,
          lastTradeAt: new Date()
        },
        strategy: {
          name: 'Crypto Swing Master',
          description: 'Medium-term swing trading strategy focusing on major cryptocurrencies with technical analysis.',
          riskLevel: 'medium',
          tradingStyle: 'swing',
          instruments: ['BTC', 'ETH', 'SOL', 'ADA'],
          timeframes: ['4h', '1d'],
          minInvestment: 1000,
          performanceFee: 20
        },
        subscription: {
          isActive: true,
          monthlyFee: 99,
          trialPeriod: 7,
          subscriptionCount: 1250
        }
      },
      {
        id: 'provider_002',
        userId: 'user_002',
        username: 'algo_trader_x',
        displayName: 'AlgoTrader X',
        bio: 'Quantitative analyst developing algorithmic trading strategies. Focus on high-frequency and momentum strategies.',
        verified: true,
        isPublic: true,
        createdAt: new Date('2023-03-22'),
        performance: {
          totalReturn: 0.725,
          annualizedReturn: 0.445,
          sharpeRatio: 2.15,
          maxDrawdown: -0.085,
          winRate: 0.72,
          totalTrades: 1850,
          followersCount: 850,
          aum: 1650000,
          lastTradeAt: new Date()
        },
        strategy: {
          name: 'Momentum Algorithm',
          description: 'High-frequency algorithmic trading based on momentum indicators and market microstructure.',
          riskLevel: 'high',
          tradingStyle: 'algorithmic',
          instruments: ['BTC', 'ETH', 'SOL'],
          timeframes: ['1m', '5m', '15m'],
          minInvestment: 5000,
          performanceFee: 25
        },
        subscription: {
          isActive: true,
          monthlyFee: 149,
          trialPeriod: 3,
          subscriptionCount: 850
        }
      },
      {
        id: 'provider_003',
        userId: 'user_003',
        username: 'conservative_growth',
        displayName: 'Conservative Growth',
        bio: 'Long-term focused trader emphasizing capital preservation with steady returns.',
        verified: false,
        isPublic: true,
        createdAt: new Date('2023-06-10'),
        performance: {
          totalReturn: 0.185,
          annualizedReturn: 0.155,
          sharpeRatio: 1.25,
          maxDrawdown: -0.035,
          winRate: 0.78,
          totalTrades: 95,
          followersCount: 420,
          aum: 580000,
          lastTradeAt: new Date()
        },
        strategy: {
          name: 'Steady Growth Strategy',
          description: 'Conservative approach with focus on capital preservation and steady returns.',
          riskLevel: 'low',
          tradingStyle: 'position',
          instruments: ['BTC', 'ETH'],
          timeframes: ['1d', '1w'],
          minInvestment: 500,
          performanceFee: 15
        },
        subscription: {
          isActive: true,
          trialPeriod: 14,
          subscriptionCount: 420
        }
      }
    ];

    for (const provider of sampleProviders) {
      this.strategyProviders.set(provider.id, provider);
    }

    // Generate sample trading feed
    this.generateSampleTradingFeed();
    
    // Calculate initial leaderboards
    this.updateLeaderboards();
  }

  private generateSampleTradingFeed(): void {
    const sampleFeedItems: TradingFeed[] = [
      {
        id: 'feed_001',
        type: 'trade',
        authorId: 'provider_001',
        authorName: 'CryptoMaster Pro',
        content: 'Just opened a long position on BTC at $65,200. Technical indicators showing strong bullish momentum. Target: $68,500',
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
        likes: 45,
        comments: 12,
        shares: 8,
        views: 320,
        relatedTrade: 'trade_001',
        tags: ['BTC', 'long', 'bullish', 'technical_analysis'],
        visibility: 'public'
      },
      {
        id: 'feed_002',
        type: 'insight',
        authorId: 'provider_002',
        authorName: 'AlgoTrader X',
        content: 'Market volatility increasing. My algorithm is detecting potential breakout patterns in ETH. Watch for volume confirmation.',
        timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000), // 4 hours ago
        likes: 67,
        comments: 23,
        shares: 15,
        views: 580,
        tags: ['ETH', 'volatility', 'breakout', 'algorithm'],
        visibility: 'public'
      },
      {
        id: 'feed_003',
        type: 'educational',
        authorId: 'provider_003',
        authorName: 'Conservative Growth',
        content: 'Risk management tip: Never risk more than 2% of your portfolio on a single trade. This simple rule has saved me countless times.',
        timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000), // 6 hours ago
        likes: 125,
        comments: 34,
        shares: 45,
        views: 890,
        tags: ['risk_management', 'education', 'portfolio'],
        visibility: 'public'
      }
    ];

    this.tradingFeed = sampleFeedItems;
  }

  async createStrategyProvider(
    userId: string,
    providerData: {
      username: string;
      displayName: string;
      bio: string;
      strategy: StrategyProvider['strategy'];
      subscription?: Partial<StrategyProvider['subscription']>;
    }
  ): Promise<string> {
    const providerId = crypto.randomUUID();
    
    const provider: StrategyProvider = {
      id: providerId,
      userId,
      username: providerData.username,
      displayName: providerData.displayName,
      bio: providerData.bio,
      verified: false,
      isPublic: true,
      createdAt: new Date(),
      performance: {
        totalReturn: 0,
        annualizedReturn: 0,
        sharpeRatio: 0,
        maxDrawdown: 0,
        winRate: 0,
        totalTrades: 0,
        followersCount: 0,
        aum: 0,
        lastTradeAt: new Date()
      },
      strategy: providerData.strategy,
      subscription: {
        isActive: true,
        monthlyFee: providerData.subscription?.monthlyFee,
        trialPeriod: providerData.subscription?.trialPeriod || 7,
        subscriptionCount: 0
      }
    };

    this.strategyProviders.set(providerId, provider);
    
    logger.info('[SocialTradingManager] Strategy provider created:', {
      providerId,
      username: provider.username
    });

    return providerId;
  }

  async startCopyTrading(
    followerId: string,
    strategyProviderId: string,
    settings: CopyTrading['settings']
  ): Promise<string> {
    const provider = this.strategyProviders.get(strategyProviderId);
    if (!provider) {
      throw new Error('Strategy provider not found');
    }

    if (settings.allocationAmount < provider.strategy.minInvestment) {
      throw new Error(`Minimum investment is $${provider.strategy.minInvestment}`);
    }

    const copyTradingId = crypto.randomUUID();
    
    const copyTrading: CopyTrading = {
      id: copyTradingId,
      followerId,
      strategyProviderId,
      isActive: true,
      startDate: new Date(),
      settings,
      performance: {
        totalInvested: settings.allocationAmount,
        currentValue: settings.allocationAmount,
        realizedPnL: 0,
        unrealizedPnL: 0,
        totalReturn: 0,
        tradesCopied: 0,
        successfulTrades: 0,
        fees: 0
      }
    };

    this.copyTradingRelationships.set(copyTradingId, copyTrading);
    
    // Update provider's follower count and AUM
    provider.performance.followersCount++;
    provider.performance.aum += settings.allocationAmount;

    logger.info('[SocialTradingManager] Copy trading started:', {
      copyTradingId,
      followerId,
      strategyProviderId,
      allocation: settings.allocationAmount
    });

    this.emit('copyTradingStarted', { copyTradingId, followerId, strategyProviderId });

    return copyTradingId;
  }

  async recordSocialTrade(
    strategyProviderId: string,
    tradeData: {
      symbol: string;
      side: 'buy' | 'sell';
      type: 'market' | 'limit' | 'stop';
      quantity: number;
      price: number;
      description?: string;
      isPublic?: boolean;
      tags?: string[];
    }
  ): Promise<string> {
    const provider = this.strategyProviders.get(strategyProviderId);
    if (!provider) {
      throw new Error('Strategy provider not found');
    }

    const tradeId = crypto.randomUUID();
    
    const socialTrade: SocialTrade = {
      id: tradeId,
      strategyProviderId,
      symbol: tradeData.symbol,
      side: tradeData.side,
      type: tradeData.type,
      quantity: tradeData.quantity,
      price: tradeData.price,
      timestamp: new Date(),
      status: 'executed',
      isPublic: tradeData.isPublic ?? true,
      likes: 0,
      comments: 0,
      shares: 0,
      description: tradeData.description,
      tags: tradeData.tags || [],
      copiedBy: 0,
      totalCopyValue: 0
    };

    this.socialTrades.set(tradeId, socialTrade);
    
    // Update provider performance
    provider.performance.totalTrades++;
    provider.performance.lastTradeAt = new Date();

    // Process copy trading for this trade
    await this.processCopyTrade(socialTrade);

    // Add to trading feed if public
    if (socialTrade.isPublic) {
      this.addToTradingFeed({
        type: 'trade',
        authorId: strategyProviderId,
        authorName: provider.displayName,
        content: `${tradeData.side.toUpperCase()} ${tradeData.quantity} ${tradeData.symbol} at $${tradeData.price.toLocaleString()}${tradeData.description ? '. ' + tradeData.description : ''}`,
        relatedTrade: tradeId,
        tags: tradeData.tags || []
      });
    }

    logger.info('[SocialTradingManager] Social trade recorded:', {
      tradeId,
      strategyProviderId,
      symbol: tradeData.symbol,
      side: tradeData.side
    });

    return tradeId;
  }

  private async processCopyTrade(socialTrade: SocialTrade): Promise<void> {
    // Find all active copy trading relationships for this provider
    const activeCopyTrades = Array.from(this.copyTradingRelationships.values())
      .filter(ct => ct.strategyProviderId === socialTrade.strategyProviderId && ct.isActive);

    for (const copyTrade of activeCopyTrades) {
      try {
        // Calculate position size based on copy settings
        let copyQuantity = 0;
        
        switch (copyTrade.settings.copyMode) {
          case 'percentage':
            copyQuantity = socialTrade.quantity * (copyTrade.settings.positionSizing / 100);
            break;
          case 'fixed':
            copyQuantity = copyTrade.settings.positionSizing;
            break;
          case 'proportional':
            const provider = this.strategyProviders.get(socialTrade.strategyProviderId)!;
            const proportionOfPortfolio = (socialTrade.quantity * socialTrade.price) / provider.performance.aum;
            copyQuantity = (copyTrade.settings.allocationAmount * proportionOfPortfolio) / socialTrade.price;
            break;
        }

        // Check if copy trade should be executed
        if (copyQuantity > 0 && this.shouldExecuteCopyTrade(copyTrade, socialTrade, copyQuantity)) {
          await this.executeCopyTrade(copyTrade, socialTrade, copyQuantity);
        }

      } catch (error) {
        logger.error('[SocialTradingManager] Failed to process copy trade:', {
          copyTradeId: copyTrade.id,
          error: String(error)
        });
      }
    }
  }

  private shouldExecuteCopyTrade(
    copyTrade: CopyTrading,
    socialTrade: SocialTrade,
    copyQuantity: number
  ): boolean {
    // Check risk limits
    const tradeValue = copyQuantity * socialTrade.price;
    const riskPercentage = tradeValue / copyTrade.performance.currentValue;
    
    if (riskPercentage > copyTrade.settings.riskLimit) {
      return false;
    }

    // Check maximum open trades
    // This would require tracking open positions per copy trade
    // For now, assume it passes

    return true;
  }

  private async executeCopyTrade(
    copyTrade: CopyTrading,
    socialTrade: SocialTrade,
    copyQuantity: number
  ): Promise<void> {
    const tradeValue = copyQuantity * socialTrade.price;
    const fee = tradeValue * 0.001; // 0.1% trading fee
    
    // Update copy trade performance
    copyTrade.performance.tradesCopied++;
    copyTrade.performance.fees += fee;
    
    // Update social trade copy metrics
    socialTrade.copiedBy++;
    socialTrade.totalCopyValue += tradeValue;

    logger.info('[SocialTradingManager] Copy trade executed:', {
      copyTradeId: copyTrade.id,
      originalTradeId: socialTrade.id,
      copyQuantity,
      tradeValue
    });

    this.emit('copyTradeExecuted', {
      copyTradeId: copyTrade.id,
      originalTradeId: socialTrade.id,
      copyQuantity,
      tradeValue
    });
  }

  async addToTradingFeed(feedData: {
    type: TradingFeed['type'];
    authorId: string;
    authorName: string;
    content: string;
    attachments?: TradingFeed['attachments'];
    relatedTrade?: string;
    relatedStrategy?: string;
    tags?: string[];
    visibility?: TradingFeed['visibility'];
  }): Promise<string> {
    const feedId = crypto.randomUUID();
    
    const feedItem: TradingFeed = {
      id: feedId,
      type: feedData.type,
      authorId: feedData.authorId,
      authorName: feedData.authorName,
      content: feedData.content,
      attachments: feedData.attachments,
      timestamp: new Date(),
      likes: 0,
      comments: 0,
      shares: 0,
      views: 0,
      relatedTrade: feedData.relatedTrade,
      relatedStrategy: feedData.relatedStrategy,
      tags: feedData.tags || [],
      visibility: feedData.visibility || 'public'
    };

    // Add to beginning of feed (most recent first)
    this.tradingFeed.unshift(feedItem);
    
    // Keep feed manageable (last 1000 items)
    if (this.tradingFeed.length > 1000) {
      this.tradingFeed = this.tradingFeed.slice(0, 1000);
    }

    this.emit('feedItemAdded', feedItem);
    
    return feedId;
  }

  private updateLeaderboards(): void {
    const timeframes = ['daily', 'weekly', 'monthly', 'yearly', 'all_time'];
    
    for (const timeframe of timeframes) {
      const entries = this.calculateLeaderboard(timeframe as any);
      this.leaderboards.set(timeframe, entries);
    }
  }

  private calculateLeaderboard(timeframe: LeaderboardEntry['timeframe']): LeaderboardEntry[] {
    const providers = Array.from(this.strategyProviders.values());
    
    // Calculate composite score for ranking
    const scoredProviders = providers.map((provider, index) => {
      // Composite score calculation (this could be more sophisticated)
      const returnScore = Math.max(0, provider.performance.totalReturn) * 100;
      const sharpeScore = Math.max(0, provider.performance.sharpeRatio) * 50;
      const drawdownScore = Math.max(0, (1 + provider.performance.maxDrawdown)) * 30;
      const winRateScore = provider.performance.winRate * 40;
      const followersScore = Math.log(provider.performance.followersCount + 1) * 10;
      const aumScore = Math.log(provider.performance.aum + 1) * 5;
      
      const score = returnScore + sharpeScore + drawdownScore + winRateScore + followersScore + aumScore;
      
      return {
        rank: 0, // Will be set after sorting
        strategyProviderId: provider.id,
        username: provider.username,
        displayName: provider.displayName,
        avatar: provider.avatar,
        verified: provider.verified,
        score,
        totalReturn: provider.performance.totalReturn,
        sharpeRatio: provider.performance.sharpeRatio,
        maxDrawdown: provider.performance.maxDrawdown,
        winRate: provider.performance.winRate,
        followersCount: provider.performance.followersCount,
        aum: provider.performance.aum,
        rankChange: 0, // This would be calculated by comparing to previous rankings
        timeframe
      };
    });

    // Sort by score and assign ranks
    scoredProviders.sort((a, b) => b.score - a.score);
    scoredProviders.forEach((entry, index) => {
      entry.rank = index + 1;
    });

    return scoredProviders;
  }

  // Getter methods
  getStrategyProviders(): StrategyProvider[] {
    return Array.from(this.strategyProviders.values());
  }

  getStrategyProvider(providerId: string): StrategyProvider | null {
    return this.strategyProviders.get(providerId) || null;
  }

  getCopyTradingRelationships(followerId?: string): CopyTrading[] {
    const relationships = Array.from(this.copyTradingRelationships.values());
    return followerId ? relationships.filter(ct => ct.followerId === followerId) : relationships;
  }

  getSocialTrades(strategyProviderId?: string): SocialTrade[] {
    const trades = Array.from(this.socialTrades.values());
    return strategyProviderId ? 
      trades.filter(t => t.strategyProviderId === strategyProviderId) : trades;
  }

  getTradingFeed(limit: number = 50, type?: TradingFeed['type']): TradingFeed[] {
    let feed = this.tradingFeed;
    if (type) {
      feed = feed.filter(item => item.type === type);
    }
    return feed.slice(0, limit);
  }

  getLeaderboard(timeframe: LeaderboardEntry['timeframe']): LeaderboardEntry[] {
    return this.leaderboards.get(timeframe) || [];
  }

  async stopCopyTrading(copyTradingId: string): Promise<boolean> {
    const copyTrade = this.copyTradingRelationships.get(copyTradingId);
    if (!copyTrade) {
      return false;
    }

    copyTrade.isActive = false;
    copyTrade.endDate = new Date();

    // Update provider's follower count and AUM
    const provider = this.strategyProviders.get(copyTrade.strategyProviderId);
    if (provider) {
      provider.performance.followersCount = Math.max(0, provider.performance.followersCount - 1);
      provider.performance.aum = Math.max(0, provider.performance.aum - copyTrade.settings.allocationAmount);
    }

    this.emit('copyTradingStopped', { copyTradingId });
    
    logger.info('[SocialTradingManager] Copy trading stopped:', { copyTradingId });

    return true;
  }

  async engageWithFeed(feedId: string, action: 'like' | 'unlike' | 'view'): Promise<boolean> {
    const feedItem = this.tradingFeed.find(item => item.id === feedId);
    if (!feedItem) {
      return false;
    }

    switch (action) {
      case 'like':
        feedItem.likes++;
        break;
      case 'unlike':
        feedItem.likes = Math.max(0, feedItem.likes - 1);
        break;
      case 'view':
        feedItem.views++;
        break;
    }

    return true;
  }
}