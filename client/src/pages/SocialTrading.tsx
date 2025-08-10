import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { 
  Users,
  Copy,
  TrendingUp,
  TrendingDown,
  Star,
  Heart,
  MessageCircle,
  Share2,
  Eye,
  Award,
  Shield,
  DollarSign,
  Activity,
  BarChart3,
  PlayCircle,
  StopCircle,
  Filter,
  Search
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface StrategyProvider {
  id: string;
  username: string;
  displayName: string;
  bio: string;
  verified: boolean;
  performance: {
    totalReturn: number;
    sharpeRatio: number;
    maxDrawdown: number;
    winRate: number;
    followersCount: number;
    aum: number;
    totalTrades: number;
  };
  strategy: {
    name: string;
    description: string;
    riskLevel: string;
    tradingStyle: string;
    performanceFee: number;
    minInvestment: number;
  };
}

interface TradingFeed {
  id: string;
  type: string;
  authorName: string;
  content: string;
  timestamp: string;
  likes: number;
  comments: number;
  shares: number;
  views: number;
  tags: string[];
}

interface LeaderboardEntry {
  rank: number;
  username: string;
  displayName: string;
  verified: boolean;
  totalReturn: number;
  sharpeRatio: number;
  followersCount: number;
  score: number;
}

interface CopyTradingRelationship {
  id: string;
  strategyProviderId: string;
  isActive: boolean;
  settings: {
    allocationAmount: number;
    positionSizing: number;
    copyMode: string;
  };
  performance: {
    totalInvested: number;
    currentValue: number;
    totalReturn: number;
    tradesCopied: number;
  };
}

export default function SocialTrading() {
  const [selectedProvider, setSelectedProvider] = useState<string>('');
  const [copyTradingForm, setCopyTradingForm] = useState({
    allocationAmount: 1000,
    positionSizing: 100,
    copyMode: 'percentage',
    maxOpenTrades: 5,
    riskLimit: 0.05
  });
  const [feedForm, setFeedForm] = useState({
    type: 'insight',
    content: ''
  });
  const [filters, setFilters] = useState({
    riskLevel: '',
    tradingStyle: '',
    verified: false,
    minReturn: 0
  });

  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch strategy providers
  const { data: strategiesData, isLoading: strategiesLoading } = useQuery({
    queryKey: ['/api/social/strategies', filters],
    refetchInterval: 30000,
  });

  // Fetch trading feed
  const { data: feedData } = useQuery({
    queryKey: ['/api/social/feed'],
    refetchInterval: 15000,
  });

  // Fetch leaderboard
  const { data: leaderboardData } = useQuery({
    queryKey: ['/api/social/leaderboard'],
    refetchInterval: 60000,
  });

  // Fetch copy trading relationships
  const { data: copyRelationshipsData } = useQuery({
    queryKey: ['/api/social/copy/relationships'],
    refetchInterval: 20000,
  });

  // Start copy trading mutation
  const startCopyTrading = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch('/api/social/copy/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) throw new Error('Failed to start copy trading');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/social/copy/relationships'] });
      queryClient.invalidateQueries({ queryKey: ['/api/social/strategies'] });
      toast({
        title: "Copy Trading Started",
        description: "You are now copying this strategy provider.",
      });
    },
  });

  // Stop copy trading mutation
  const stopCopyTrading = useMutation({
    mutationFn: async (copyTradingId: string) => {
      const response = await fetch('/api/social/copy/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ copyTradingId }),
      });
      
      if (!response.ok) throw new Error('Failed to stop copy trading');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/social/copy/relationships'] });
      queryClient.invalidateQueries({ queryKey: ['/api/social/strategies'] });
      toast({
        title: "Copy Trading Stopped",
        description: "Copy trading relationship has been ended.",
      });
    },
  });

  // Add to feed mutation
  const addToFeed = useMutation({
    mutationFn: async (feedData: any) => {
      const response = await fetch('/api/social/feed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(feedData),
      });
      
      if (!response.ok) throw new Error('Failed to add to feed');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/social/feed'] });
      setFeedForm({ type: 'insight', content: '' });
      toast({
        title: "Posted to Feed",
        description: "Your post has been added to the trading feed.",
      });
    },
  });

  // Engage with feed mutation
  const engageWithFeed = useMutation({
    mutationFn: async ({ feedId, action }: { feedId: string; action: string }) => {
      const response = await fetch(`/api/social/feed/${feedId}/engage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      
      if (!response.ok) throw new Error('Failed to engage with feed');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/social/feed'] });
    },
  });

  const strategies: StrategyProvider[] = strategiesData?.data?.strategies || [];
  const feed: TradingFeed[] = feedData?.data?.feed || [];
  const leaderboard: LeaderboardEntry[] = leaderboardData?.data?.leaderboard || [];
  const copyRelationships: CopyTradingRelationship[] = copyRelationshipsData?.data?.relationships || [];

  const handleStartCopyTrading = () => {
    if (!selectedProvider) {
      toast({
        title: "Error",
        description: "Please select a strategy provider first.",
        variant: "destructive",
      });
      return;
    }

    startCopyTrading.mutate({
      followerId: 'current-user', // This would be the actual user ID
      strategyProviderId: selectedProvider,
      settings: copyTradingForm
    });
  };

  const handleAddToFeed = () => {
    if (!feedForm.content.trim()) {
      toast({
        title: "Error",
        description: "Please enter some content for your post.",
        variant: "destructive",
      });
      return;
    }

    addToFeed.mutate({
      type: feedForm.type,
      authorId: 'current-user',
      authorName: 'Current User',
      content: feedForm.content,
      tags: []
    });
  };

  const getRiskLevelColor = (riskLevel: string) => {
    switch (riskLevel) {
      case 'low': return 'bg-green-600';
      case 'medium': return 'bg-yellow-600';
      case 'high': return 'bg-orange-600';
      case 'very_high': return 'bg-red-600';
      default: return 'bg-gray-600';
    }
  };

  const getPerformanceColor = (value: number) => {
    return value >= 0 ? 'text-green-600' : 'text-red-600';
  };

  if (strategiesLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Social Trading</h1>
          <p className="text-muted-foreground">Copy successful traders and share strategies</p>
        </div>
        <div className="flex items-center space-x-2">
          <Badge variant="secondary">
            {strategies.length} Strategies
          </Badge>
          <Badge variant="secondary">
            {copyRelationships.filter(r => r.isActive).length} Active Copies
          </Badge>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">Strategy Providers</div>
            <Users className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-bold mt-2">{strategies.length}</div>
          <div className="text-sm text-muted-foreground">
            {strategies.filter(s => s.verified).length} Verified
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">Total AUM</div>
            <DollarSign className="w-4 h-4 text-green-600" />
          </div>
          <div className="text-2xl font-bold mt-2 text-green-600">
            ${strategiesData?.data?.summary?.totalAUM?.toLocaleString() || '0'}
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">Active Copies</div>
            <Copy className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-2xl font-bold mt-2">
            {copyRelationships.filter(r => r.isActive).length}
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">Feed Activity</div>
            <Activity className="w-4 h-4 text-orange-600" />
          </div>
          <div className="text-2xl font-bold mt-2">{feed.length}</div>
          <div className="text-sm text-muted-foreground">
            {feedData?.data?.summary?.totalViews || 0} Views
          </div>
        </Card>
      </div>

      <Tabs defaultValue="discover" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="discover">Discover</TabsTrigger>
          <TabsTrigger value="copy">Copy Trading</TabsTrigger>
          <TabsTrigger value="feed">Trading Feed</TabsTrigger>
          <TabsTrigger value="leaderboard">Leaderboard</TabsTrigger>
          <TabsTrigger value="my-copies">My Copies</TabsTrigger>
        </TabsList>

        {/* Discover Tab */}
        <TabsContent value="discover" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            {strategies.map((strategy) => (
              <Card key={strategy.id} className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <span className="font-semibold">{strategy.displayName}</span>
                    {strategy.verified && <Shield className="w-4 h-4 text-blue-600" />}
                  </div>
                  <Badge className={getRiskLevelColor(strategy.strategy.riskLevel)}>
                    {strategy.strategy.riskLevel.toUpperCase()}
                  </Badge>
                </div>

                <div className="text-sm text-muted-foreground mb-3">
                  {strategy.bio}
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-sm">
                    <span>Total Return:</span>
                    <span className={getPerformanceColor(strategy.performance.totalReturn)}>
                      {(strategy.performance.totalReturn * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Sharpe Ratio:</span>
                    <span>{strategy.performance.sharpeRatio.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Followers:</span>
                    <span>{strategy.performance.followersCount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Win Rate:</span>
                    <span>{(strategy.performance.winRate * 100).toFixed(1)}%</span>
                  </div>
                </div>

                <div className="flex space-x-2">
                  <Button
                    size="sm"
                    onClick={() => setSelectedProvider(strategy.id)}
                    variant={selectedProvider === strategy.id ? "default" : "outline"}
                    data-testid={`button-select-${strategy.id}`}
                  >
                    {selectedProvider === strategy.id ? 'Selected' : 'Select'}
                  </Button>
                  <Button size="sm" variant="outline" data-testid={`button-view-${strategy.id}`}>
                    <Eye className="w-3 h-3" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Copy Trading Tab */}
        <TabsContent value="copy" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="p-4">
              <h3 className="font-semibold mb-4">Start Copy Trading</h3>
              
              {selectedProvider ? (
                <div className="space-y-4">
                  <div className="p-3 border rounded bg-muted">
                    <div className="font-medium">
                      {strategies.find(s => s.id === selectedProvider)?.displayName}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {strategies.find(s => s.id === selectedProvider)?.strategy.name}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="allocation">Allocation Amount ($)</Label>
                      <Input
                        id="allocation"
                        type="number"
                        value={copyTradingForm.allocationAmount}
                        onChange={(e) => setCopyTradingForm(prev => ({ 
                          ...prev, 
                          allocationAmount: parseInt(e.target.value) 
                        }))}
                        data-testid="input-allocation"
                      />
                    </div>
                    <div>
                      <Label htmlFor="position-sizing">Position Sizing (%)</Label>
                      <Input
                        id="position-sizing"
                        type="number"
                        value={copyTradingForm.positionSizing}
                        onChange={(e) => setCopyTradingForm(prev => ({ 
                          ...prev, 
                          positionSizing: parseInt(e.target.value) 
                        }))}
                        data-testid="input-position-sizing"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="copy-mode">Copy Mode</Label>
                    <select
                      id="copy-mode"
                      value={copyTradingForm.copyMode}
                      onChange={(e) => setCopyTradingForm(prev => ({ ...prev, copyMode: e.target.value }))}
                      className="w-full p-2 border rounded-md bg-background"
                      data-testid="select-copy-mode"
                    >
                      <option value="percentage">Percentage</option>
                      <option value="fixed">Fixed Amount</option>
                      <option value="proportional">Proportional</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="max-trades">Max Open Trades</Label>
                      <Input
                        id="max-trades"
                        type="number"
                        value={copyTradingForm.maxOpenTrades}
                        onChange={(e) => setCopyTradingForm(prev => ({ 
                          ...prev, 
                          maxOpenTrades: parseInt(e.target.value) 
                        }))}
                        data-testid="input-max-trades"
                      />
                    </div>
                    <div>
                      <Label htmlFor="risk-limit">Risk Limit (%)</Label>
                      <Input
                        id="risk-limit"
                        type="number"
                        step="0.01"
                        value={copyTradingForm.riskLimit * 100}
                        onChange={(e) => setCopyTradingForm(prev => ({ 
                          ...prev, 
                          riskLimit: parseFloat(e.target.value) / 100 
                        }))}
                        data-testid="input-risk-limit"
                      />
                    </div>
                  </div>

                  <Button 
                    onClick={handleStartCopyTrading} 
                    disabled={startCopyTrading.isPending}
                    className="w-full"
                    data-testid="button-start-copy-trading"
                  >
                    <PlayCircle className="w-4 h-4 mr-2" />
                    {startCopyTrading.isPending ? 'Starting...' : 'Start Copy Trading'}
                  </Button>
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  Select a strategy provider to start copy trading
                </div>
              )}
            </Card>

            <Card className="p-4">
              <h3 className="font-semibold mb-4">Copy Trading Performance</h3>
              
              {copyRelationships.length > 0 ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-3 border rounded">
                      <div className="text-sm text-muted-foreground">Total Invested</div>
                      <div className="text-lg font-bold">
                        ${copyRelationshipsData?.data?.summary?.totalInvested?.toLocaleString() || '0'}
                      </div>
                    </div>
                    <div className="text-center p-3 border rounded">
                      <div className="text-sm text-muted-foreground">Total Return</div>
                      <div className={`text-lg font-bold ${getPerformanceColor(copyRelationshipsData?.data?.summary?.totalReturn || 0)}`}>
                        {copyRelationshipsData?.data?.summary?.overallReturnPercentage 
                          ? `${copyRelationshipsData.data.summary.overallReturnPercentage.toFixed(1)}%`
                          : '0%'}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {copyRelationships.slice(0, 5).map((relationship) => (
                      <div key={relationship.id} className="flex justify-between items-center p-2 border rounded">
                        <div className="text-sm">
                          Copy #{relationship.id.slice(0, 8)}
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-medium">
                            ${relationship.performance.currentValue.toLocaleString()}
                          </div>
                          <div className={`text-xs ${getPerformanceColor(relationship.performance.totalReturn)}`}>
                            {(relationship.performance.totalReturn * 100).toFixed(1)}%
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  No copy trading relationships yet
                </div>
              )}
            </Card>
          </div>
        </TabsContent>

        {/* Trading Feed Tab */}
        <TabsContent value="feed" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="md:col-span-2">
              <Card className="p-4">
                <h3 className="font-semibold mb-4">Trading Feed</h3>
                
                <div className="space-y-4">
                  {feed.map((item) => (
                    <div key={item.id} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <span className="font-medium">{item.authorName}</span>
                          <Badge variant="outline" className="text-xs">
                            {item.type.toUpperCase()}
                          </Badge>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {new Date(item.timestamp).toLocaleString()}
                        </span>
                      </div>
                      
                      <div className="mb-3 text-sm">
                        {item.content}
                      </div>

                      {item.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-3">
                          {item.tags.map((tag) => (
                            <Badge key={tag} variant="secondary" className="text-xs">
                              #{tag}
                            </Badge>
                          ))}
                        </div>
                      )}

                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <button
                            onClick={() => engageWithFeed.mutate({ feedId: item.id, action: 'like' })}
                            className="flex items-center space-x-1 text-sm text-muted-foreground hover:text-red-600"
                          >
                            <Heart className="w-4 h-4" />
                            <span>{item.likes}</span>
                          </button>
                          <button className="flex items-center space-x-1 text-sm text-muted-foreground hover:text-blue-600">
                            <MessageCircle className="w-4 h-4" />
                            <span>{item.comments}</span>
                          </button>
                          <button className="flex items-center space-x-1 text-sm text-muted-foreground hover:text-green-600">
                            <Share2 className="w-4 h-4" />
                            <span>{item.shares}</span>
                          </button>
                        </div>
                        <div className="flex items-center space-x-1 text-sm text-muted-foreground">
                          <Eye className="w-4 h-4" />
                          <span>{item.views}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            <Card className="p-4">
              <h3 className="font-semibold mb-4">Share Your Insights</h3>
              
              <div className="space-y-4">
                <div>
                  <Label htmlFor="post-type">Post Type</Label>
                  <select
                    id="post-type"
                    value={feedForm.type}
                    onChange={(e) => setFeedForm(prev => ({ ...prev, type: e.target.value }))}
                    className="w-full p-2 border rounded-md bg-background"
                    data-testid="select-post-type"
                  >
                    <option value="insight">Market Insight</option>
                    <option value="educational">Educational</option>
                    <option value="alert">Trading Alert</option>
                    <option value="strategy">Strategy Update</option>
                  </select>
                </div>

                <div>
                  <Label htmlFor="content">Content</Label>
                  <textarea
                    id="content"
                    value={feedForm.content}
                    onChange={(e) => setFeedForm(prev => ({ ...prev, content: e.target.value }))}
                    placeholder="Share your trading insights..."
                    className="w-full p-2 border rounded-md bg-background h-24 resize-none"
                    data-testid="textarea-content"
                  />
                </div>

                <Button 
                  onClick={handleAddToFeed} 
                  disabled={addToFeed.isPending}
                  className="w-full"
                  data-testid="button-add-to-feed"
                >
                  <Share2 className="w-4 h-4 mr-2" />
                  {addToFeed.isPending ? 'Posting...' : 'Share Post'}
                </Button>
              </div>
            </Card>
          </div>
        </TabsContent>

        {/* Leaderboard Tab */}
        <TabsContent value="leaderboard" className="space-y-4">
          <Card className="p-4">
            <h3 className="font-semibold mb-4">Top Performers</h3>
            
            <div className="space-y-3">
              {leaderboard.map((entry) => (
                <div key={entry.rank} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center space-x-4">
                    <div className="text-center">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                        entry.rank === 1 ? 'bg-yellow-500 text-white' :
                        entry.rank === 2 ? 'bg-gray-400 text-white' :
                        entry.rank === 3 ? 'bg-amber-600 text-white' :
                        'bg-muted'
                      }`}>
                        {entry.rank <= 3 ? <Award className="w-4 h-4" /> : entry.rank}
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-medium">{entry.displayName}</span>
                        {entry.verified && <Shield className="w-4 h-4 text-blue-600" />}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        @{entry.username} • {entry.followersCount} followers
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`font-medium ${getPerformanceColor(entry.totalReturn)}`}>
                      {(entry.totalReturn * 100).toFixed(1)}%
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Sharpe: {entry.sharpeRatio.toFixed(2)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>

        {/* My Copies Tab */}
        <TabsContent value="my-copies" className="space-y-4">
          <Card className="p-4">
            <h3 className="font-semibold mb-4">My Copy Trading</h3>
            
            {copyRelationships.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                No active copy trading relationships
              </div>
            ) : (
              <div className="space-y-4">
                {copyRelationships.map((relationship) => (
                  <div key={relationship.id} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <div className="font-medium">Copy Trading #{relationship.id.slice(0, 8)}</div>
                        <div className="text-sm text-muted-foreground">
                          Strategy Provider: {relationship.strategyProviderId}
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge variant={relationship.isActive ? "default" : "secondary"}>
                          {relationship.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                        {relationship.isActive && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => stopCopyTrading.mutate(relationship.id)}
                            disabled={stopCopyTrading.isPending}
                            data-testid={`button-stop-${relationship.id}`}
                          >
                            <StopCircle className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-4 gap-4 text-sm">
                      <div className="text-center">
                        <div className="text-muted-foreground">Invested</div>
                        <div className="font-medium">
                          ${relationship.performance.totalInvested.toLocaleString()}
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-muted-foreground">Current Value</div>
                        <div className="font-medium">
                          ${relationship.performance.currentValue.toLocaleString()}
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-muted-foreground">Return</div>
                        <div className={`font-medium ${getPerformanceColor(relationship.performance.totalReturn)}`}>
                          {(relationship.performance.totalReturn * 100).toFixed(1)}%
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-muted-foreground">Trades Copied</div>
                        <div className="font-medium">{relationship.performance.tradesCopied}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}