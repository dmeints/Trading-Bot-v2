import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ThumbsUp, ThumbsDown, Share2, TrendingUp, TrendingDown, Users, Star, Eye } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

interface StrategySharing {
  id: string;
  userId: string;
  strategyName: string;
  description: string;
  performance: {
    totalReturn: number;
    sharpeRatio: number;
    maxDrawdown: number;
    winRate: number;
    totalTrades: number;
  };
  parameters: any;
  isPublic: boolean;
  upvotes: number;
  downvotes: number;
  createdAt: string;
  userReputation?: {
    tradingScore: number;
    communityScore: number;
    totalTrades: number;
    successfulTrades: number;
  };
}

interface CommunitySignal {
  id: string;
  symbol: string;
  action: 'buy' | 'sell' | 'hold';
  confidence: number;
  reasoning: string;
  votes: number;
  userCount: number;
  sentiment: number;
  timeframe: string;
}

export function CollaborativeIntelligence() {
  const [activeTab, setActiveTab] = useState('strategies');
  const queryClient = useQueryClient();

  const { data: publicStrategies, isLoading: strategiesLoading } = useQuery({
    queryKey: ['/api/strategies/public'],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const { data: communitySignals, isLoading: signalsLoading } = useQuery({
    queryKey: ['/api/community/signals'],
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  const { data: topTraders, isLoading: tradersLoading } = useQuery({
    queryKey: ['/api/community/top-traders'],
    refetchInterval: 60000, // Refresh every minute
  });

  const voteOnStrategyMutation = useMutation({
    mutationFn: ({ strategyId, upvote }: { strategyId: string; upvote: boolean }) =>
      apiRequest(`/api/strategies/${strategyId}/vote`, {
        method: 'POST',
        body: JSON.stringify({ upvote }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/strategies/public'] });
    },
  });

  const followStrategyMutation = useMutation({
    mutationFn: (strategyId: string) =>
      apiRequest(`/api/strategies/${strategyId}/follow`, {
        method: 'POST',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/user/followed-strategies'] });
    },
  });

  const handleVote = (strategyId: string, upvote: boolean) => {
    voteOnStrategyMutation.mutate({ strategyId, upvote });
  };

  const handleFollow = (strategyId: string) => {
    followStrategyMutation.mutate(strategyId);
  };

  const getPerformanceColor = (value: number, type: 'return' | 'sharpe' | 'drawdown') => {
    if (type === 'return') {
      return value > 0 ? 'text-green-600' : 'text-red-600';
    } else if (type === 'sharpe') {
      return value > 1.5 ? 'text-green-600' : value > 1 ? 'text-yellow-600' : 'text-red-600';
    } else { // drawdown
      return value < 0.1 ? 'text-green-600' : value < 0.2 ? 'text-yellow-600' : 'text-red-600';
    }
  };

  const formatPerformance = (value: number, type: 'return' | 'sharpe' | 'drawdown') => {
    if (type === 'return') {
      return `${((value || 0) * 100).toFixed(1)}%`;
    } else if (type === 'drawdown') {
      return `${((value || 0) * 100).toFixed(1)}%`;
    } else {
      return (value || 0).toFixed(2);
    }
  };

  return (
    <div className="space-y-6" data-testid="collaborative-intelligence">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Collaborative Intelligence
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Learn from the community and share your trading insights
          </p>
        </div>
        <div className="flex items-center space-x-4">
          <Badge variant="outline" className="flex items-center space-x-1">
            <Users className="h-4 w-4" />
            <span>Community Active</span>
          </Badge>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="strategies" data-testid="tab-strategies">
            Strategy Sharing
          </TabsTrigger>
          <TabsTrigger value="signals" data-testid="tab-signals">
            Community Signals
          </TabsTrigger>
          <TabsTrigger value="traders" data-testid="tab-traders">
            Top Traders
          </TabsTrigger>
          <TabsTrigger value="insights" data-testid="tab-insights">
            Market Insights
          </TabsTrigger>
        </TabsList>

        <TabsContent value="strategies" className="space-y-6">
          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Share2 className="h-5 w-5" />
                  <span>Public Trading Strategies</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {strategiesLoading ? (
                  <div className="space-y-4">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="animate-pulse">
                        <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                        <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {publicStrategies?.map((strategy: StrategySharing) => (
                      <div
                        key={strategy.id}
                        className="border rounded-lg p-4 hover:shadow-md transition-shadow"
                        data-testid={`strategy-card-${strategy.id}`}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h3 className="font-semibold text-lg">{strategy.strategyName}</h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                              {strategy.description}
                            </p>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleVote(strategy.id, true)}
                              data-testid={`upvote-${strategy.id}`}
                            >
                              <ThumbsUp className="h-4 w-4 mr-1" />
                              {strategy.upvotes}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleVote(strategy.id, false)}
                              data-testid={`downvote-${strategy.id}`}
                            >
                              <ThumbsDown className="h-4 w-4 mr-1" />
                              {strategy.downvotes}
                            </Button>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
                          <div className="text-center">
                            <div className={`text-lg font-semibold ${getPerformanceColor(strategy.performance.totalReturn, 'return')}`}>
                              {formatPerformance(strategy.performance.totalReturn, 'return')}
                            </div>
                            <div className="text-xs text-gray-500">Total Return</div>
                          </div>
                          <div className="text-center">
                            <div className={`text-lg font-semibold ${getPerformanceColor(strategy.performance.sharpeRatio, 'sharpe')}`}>
                              {formatPerformance(strategy.performance.sharpeRatio, 'sharpe')}
                            </div>
                            <div className="text-xs text-gray-500">Sharpe Ratio</div>
                          </div>
                          <div className="text-center">
                            <div className={`text-lg font-semibold ${getPerformanceColor(strategy.performance.maxDrawdown, 'drawdown')}`}>
                              {formatPerformance(strategy.performance.maxDrawdown, 'drawdown')}
                            </div>
                            <div className="text-xs text-gray-500">Max Drawdown</div>
                          </div>
                          <div className="text-center">
                            <div className="text-lg font-semibold">
                              {(strategy.performance.winRate * 100).toFixed(1)}%
                            </div>
                            <div className="text-xs text-gray-500">Win Rate</div>
                          </div>
                          <div className="text-center">
                            <div className="text-lg font-semibold">
                              {strategy.performance.totalTrades}
                            </div>
                            <div className="text-xs text-gray-500">Total Trades</div>
                          </div>
                        </div>

                        {strategy.userReputation && (
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center space-x-3">
                              <Avatar className="h-8 w-8">
                                <AvatarFallback>
                                  {strategy.userId.substring(0, 2).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <div className="text-sm font-medium">Community Score</div>
                                <div className="flex items-center space-x-2">
                                  <Progress 
                                    value={strategy.userReputation.tradingScore * 100} 
                                    className="w-20 h-2" 
                                  />
                                  <span className="text-xs text-gray-600">
                                    {(strategy.userReputation.tradingScore * 100).toFixed(0)}%
                                  </span>
                                </div>
                              </div>
                            </div>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => handleFollow(strategy.id)}
                              data-testid={`follow-${strategy.id}`}
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              Follow
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="signals" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <TrendingUp className="h-5 w-5" />
                <span>Community Trading Signals</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {signalsLoading ? (
                <div className="space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="animate-pulse">
                      <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                      <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  {communitySignals?.map((signal: CommunitySignal) => (
                    <div
                      key={signal.id}
                      className="border rounded-lg p-4 hover:shadow-md transition-shadow"
                      data-testid={`signal-card-${signal.id}`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-3">
                          <Badge 
                            variant={signal.action === 'buy' ? 'default' : signal.action === 'sell' ? 'destructive' : 'secondary'}
                            className="flex items-center space-x-1"
                            data-testid={`button-${signal.action}`}
                          >
                            {signal.action === 'buy' ? (
                              <TrendingUp className="h-3 w-3" />
                            ) : signal.action === 'sell' ? (
                              <TrendingDown className="h-3 w-3" />
                            ) : null}
                            <span>{signal.action.toUpperCase()}</span>
                          </Badge>
                          <h3 className="font-semibold">{signal.symbol}</h3>
                        </div>
                        <div className="flex items-center space-x-2">
                          <div className="text-sm text-gray-600">
                            <Users className="h-4 w-4 inline mr-1" />
                            {signal.userCount} traders
                          </div>
                          <div className="text-sm text-gray-600">
                            <Star className="h-4 w-4 inline mr-1" />
                            {signal.votes} votes
                          </div>
                        </div>
                      </div>

                      <div className="mb-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm text-gray-600">Community Confidence</span>
                          <span className="text-sm font-medium">
                            {(signal.confidence * 100).toFixed(1)}%
                          </span>
                        </div>
                        <Progress value={signal.confidence * 100} className="h-2" />
                      </div>

                      <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
                        {signal.reasoning}
                      </p>

                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <span>Timeframe: {signal.timeframe}</span>
                        <span>Sentiment: {signal.sentiment > 0 ? 'Bullish' : signal.sentiment < 0 ? 'Bearish' : 'Neutral'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="traders" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Users className="h-5 w-5" />
                <span>Top Community Traders</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {tradersLoading ? (
                <div className="space-y-4">
                  {[...Array(10)].map((_, i) => (
                    <div key={i} className="animate-pulse flex items-center space-x-4">
                      <div className="h-10 w-10 bg-gray-200 rounded-full"></div>
                      <div className="flex-1">
                        <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
                        <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  {topTraders?.map((trader: any, index: number) => (
                    <div
                      key={trader.userId}
                      className="flex items-center justify-between p-4 border rounded-lg hover:shadow-md transition-shadow"
                      data-testid={`trader-card-${index}`}
                    >
                      <div className="flex items-center space-x-4">
                        <div className="flex items-center justify-center w-8 h-8 bg-primary text-primary-foreground rounded-full text-sm font-bold">
                          #{index + 1}
                        </div>
                        <Avatar className="h-10 w-10">
                          <AvatarFallback>
                            {trader.userId.substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium">Trader {trader.userId.substring(0, 8)}</div>
                          <div className="text-sm text-gray-600">
                            {trader.totalTrades} trades • {((trader.successfulTrades / trader.totalTrades) * 100).toFixed(1)}% win rate
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-semibold text-green-600" data-testid="badge-buy">
                          {(trader.tradingScore * 100).toFixed(0)}
                        </div>
                        <div className="text-xs text-gray-500">Trading Score</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="insights" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Market Sentiment Trends</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-green-600" data-testid="badge-buy">Bullish</div>
                    <div className="text-sm text-gray-600">Overall Market Sentiment</div>
                  </div>
                  <Progress value={72} className="h-3" />
                  <div className="text-xs text-gray-500 text-center">
                    72% of community signals are bullish
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Popular Assets</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {['BTC/USD', 'ETH/USD', 'SOL/USD', 'ADA/USD'].map((symbol, index) => (
                    <div key={symbol} className="flex items-center justify-between">
                      <span className="font-medium">{symbol}</span>
                      <div className="flex items-center space-x-2">
                        <Progress value={90 - index * 15} className="w-20 h-2" />
                        <span className="text-sm text-gray-600">
                          {90 - index * 15}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}