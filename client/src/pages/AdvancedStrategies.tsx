import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  Target, 
  Shield, 
  BarChart3,
  Zap,
  AlertCircle,
  CheckCircle,
  Settings
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ErrorBoundary } from '@/components/ErrorBoundary';

interface Strategy {
  id: string;
  name: string;
  description: string;
  active: boolean;
  weight: number;
  performance: {
    totalReturn: number;
    sharpeRatio: number;
    maxDrawdown: number;
    winRate: number;
    avgReturn: number;
  };
}

interface Signal {
  type: 'BUY' | 'SELL' | 'HOLD';
  strength: number;
  confidence: number;
  source: string;
  reasoning: string;
  timeframe: string;
}

function AdvancedStrategiesContent() {
  const [selectedStrategy, setSelectedStrategy] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch all strategies
  const { data: strategiesData, isLoading: strategiesLoading } = useQuery({
    queryKey: ['/api/strategies/trading'],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch current signals
  const { data: signalsData, isLoading: signalsLoading } = useQuery({
    queryKey: ['/api/strategies/signals'],
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  // Fetch risk metrics
  const { data: riskData, isLoading: riskLoading } = useQuery({
    queryKey: ['/api/strategies/risk-metrics'],
    refetchInterval: 15000, // Refresh every 15 seconds
  });

  // Fetch portfolio optimization
  const { data: optimizationData } = useQuery({
    queryKey: ['/api/strategies/portfolio-optimization'],
    refetchInterval: 60000, // Refresh every minute
  });

  const toggleStrategy = useMutation({
    mutationFn: async ({ strategyId, active }: { strategyId: string; active: boolean }) => {
      const response = await fetch('/api/strategies/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ strategyId, active }),
      });
      
      if (!response.ok) throw new Error('Failed to toggle strategy');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/strategies/trading'] });
      toast({
        title: "Strategy Updated",
        description: "Strategy status has been changed successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: "Failed to update strategy status.",
        variant: "destructive",
      });
    },
  });

  const updateWeights = useMutation({
    mutationFn: async (weights: Record<string, number>) => {
      const response = await fetch('/api/strategies/weights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weights }),
      });
      
      if (!response.ok) throw new Error('Failed to update weights');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/strategies/trading'] });
      toast({
        title: "Weights Updated",
        description: "Strategy allocation weights have been updated.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: "Failed to update strategy weights.",
        variant: "destructive",
      });
    },
  });

  const strategies: Strategy[] = (strategiesData as any)?.data?.strategies || [];
  const signals: Signal[] = (signalsData as any)?.data?.signals || [];
  const signalSummary = (signalsData as any)?.data?.summary;
  const riskMetrics = (riskData as any)?.data;

  const getPerformanceColor = (value: number, type: 'return' | 'sharpe' | 'drawdown') => {
    switch (type) {
      case 'return':
        return value > 0.15 ? 'text-green-600' : value > 0.05 ? 'text-yellow-600' : 'text-red-600';
      case 'sharpe':
        return value > 1.5 ? 'text-green-600' : value > 1.0 ? 'text-yellow-600' : 'text-red-600';
      case 'drawdown':
        return Math.abs(value) < 0.05 ? 'text-green-600' : Math.abs(value) < 0.1 ? 'text-yellow-600' : 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  const getSignalIcon = (type: string) => {
    switch (type) {
      case 'BUY': return <TrendingUp className="w-4 h-4 text-green-600" />;
      case 'SELL': return <TrendingDown className="w-4 h-4 text-red-600" />;
      default: return <Activity className="w-4 h-4 text-blue-600" />;
    }
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
          <h1 className="text-2xl font-bold text-foreground">Advanced Trading Strategies</h1>
          <p className="text-muted-foreground">Manage AI-driven trading strategies and portfolio optimization</p>
        </div>
        <Badge variant="outline" className="px-3 py-1">
          {strategies.filter(s => s.active).length} Active Strategies
        </Badge>
      </div>

      <Tabs defaultValue="strategies" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="strategies">Strategies</TabsTrigger>
          <TabsTrigger value="signals">Live Signals</TabsTrigger>
          <TabsTrigger value="risk">Risk Management</TabsTrigger>
          <TabsTrigger value="optimization">Portfolio Optimization</TabsTrigger>
        </TabsList>

        {/* Strategies Tab */}
        <TabsContent value="strategies" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {strategies.map((strategy) => (
              <Card key={strategy.id} className="p-4">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-semibold text-foreground">{strategy.name}</h3>
                    <p className="text-sm text-muted-foreground mt-1">{strategy.description}</p>
                  </div>
                  <Switch
                    checked={strategy.active}
                    onCheckedChange={(checked) => 
                      toggleStrategy.mutate({ strategyId: strategy.id, active: checked })
                    }
                    disabled={toggleStrategy.isPending}
                    data-testid={`switch-strategy-${strategy.id}`}
                  />
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-sm">
                    <span>Allocation Weight:</span>
                    <span className="font-medium">{(strategy.weight * 100).toFixed(1)}%</span>
                  </div>
                  <Progress value={strategy.weight * 100} className="h-2" />
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">Total Return</span>
                    <div className={`font-medium ${getPerformanceColor(strategy.performance.totalReturn, 'return')}`}>
                      {(strategy.performance.totalReturn * 100).toFixed(1)}%
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Sharpe Ratio</span>
                    <div className={`font-medium ${getPerformanceColor(strategy.performance.sharpeRatio, 'sharpe')}`}>
                      {strategy.performance.sharpeRatio.toFixed(2)}
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Win Rate</span>
                    <div className="font-medium text-foreground">
                      {(strategy.performance.winRate * 100).toFixed(1)}%
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Max Drawdown</span>
                    <div className={`font-medium ${getPerformanceColor(strategy.performance.maxDrawdown, 'drawdown')}`}>
                      {(Math.abs(strategy.performance.maxDrawdown) * 100).toFixed(1)}%
                    </div>
                  </div>
                </div>

                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full mt-3"
                  onClick={() => setSelectedStrategy(strategy.id)}
                  data-testid={`button-configure-${strategy.id}`}
                >
                  <Settings className="w-4 h-4 mr-2" />
                  Configure
                </Button>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Signals Tab */}
        <TabsContent value="signals" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">Active Signals</div>
                <Badge variant="secondary">{signalSummary?.total || 0}</Badge>
              </div>
              <div className="text-2xl font-bold mt-2">{signalSummary?.total || 0}</div>
            </Card>
            <Card className="p-4" data-testid="card-buy-signals">
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">Buy Signals</div>
                <TrendingUp className="w-4 h-4 text-green-600" data-testid="icon-buy" />
              </div>
              <div className="text-2xl font-bold mt-2 text-green-600" data-testid="count-buy">{signalSummary?.buy || 0}</div>
            </Card>
            <Card className="p-4" data-testid="card-sell-signals">
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">Sell Signals</div>
                <TrendingDown className="w-4 h-4 text-red-600" data-testid="icon-sell" />
              </div>
              <div className="text-2xl font-bold mt-2 text-red-600" data-testid="count-sell">{signalSummary?.sell || 0}</div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">Avg Confidence</div>
                <Target className="w-4 h-4 text-blue-600" />
              </div>
              <div className="text-2xl font-bold mt-2 text-blue-600">
                {signalSummary?.averageConfidence ? (signalSummary.averageConfidence * 100).toFixed(0) + '%' : '0%'}
              </div>
            </Card>
          </div>

          <Card className="p-4">
            <h3 className="font-semibold mb-4">Recent Trading Signals</h3>
            <div className="space-y-3">
              {signals.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  No active signals at this time
                </div>
              ) : (
                signals.map((signal, index) => (
                  <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      {getSignalIcon(signal.type)}
                      <div>
                        <div className="font-medium">{signal.type}</div>
                        <div className="text-sm text-muted-foreground">{signal.source}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center space-x-2">
                        <Badge variant="outline">{(signal.confidence * 100).toFixed(0)}%</Badge>
                        <Badge variant="secondary">{signal.timeframe}</Badge>
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">{signal.reasoning}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </TabsContent>

        {/* Risk Management Tab */}
        <TabsContent value="risk" className="space-y-4">
          {riskMetrics && (
            <>
              <div className="grid gap-4 md:grid-cols-4">
                <Card className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">Daily P&L</div>
                    <Shield className="w-4 h-4 text-blue-600" />
                  </div>
                  <div className="text-2xl font-bold mt-2">
                    ${riskMetrics.current?.dailyPnl?.toLocaleString() || '0'}
                  </div>
                </Card>
                <Card className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">Current Drawdown</div>
                    <AlertCircle className="w-4 h-4 text-orange-600" />
                  </div>
                  <div className="text-2xl font-bold mt-2 text-orange-600">
                    {((riskMetrics.current?.currentDrawdown || 0) * 100).toFixed(2)}%
                  </div>
                </Card>
                <Card className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">VaR 95%</div>
                    <BarChart3 className="w-4 h-4 text-red-600" />
                  </div>
                  <div className="text-2xl font-bold mt-2 text-red-600">
                    ${riskMetrics.current?.var95?.toLocaleString() || '0'}
                  </div>
                </Card>
                <Card className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">Sharpe Ratio</div>
                    <CheckCircle className="w-4 h-4 text-green-600" />
                  </div>
                  <div className="text-2xl font-bold mt-2 text-green-600">
                    {riskMetrics.current?.sharpeRatio?.toFixed(2) || '0.00'}
                  </div>
                </Card>
              </div>

              <Card className="p-4">
                <h3 className="font-semibold mb-4">Risk Limit Utilization</h3>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span>Daily Loss Utilization</span>
                      <span>{((riskMetrics.limits?.dailyLossUtilization || 0) * 100).toFixed(1)}%</span>
                    </div>
                    <Progress value={(riskMetrics.limits?.dailyLossUtilization || 0) * 100} className="h-2" />
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span>Drawdown Utilization</span>
                      <span>{((riskMetrics.limits?.drawdownUtilization || 0) * 100).toFixed(1)}%</span>
                    </div>
                    <Progress value={(riskMetrics.limits?.drawdownUtilization || 0) * 100} className="h-2" />
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span>Concentration Utilization</span>
                      <span>{((riskMetrics.limits?.concentrationUtilization || 0) * 100).toFixed(1)}%</span>
                    </div>
                    <Progress value={(riskMetrics.limits?.concentrationUtilization || 0) * 100} className="h-2" />
                  </div>
                </div>
              </Card>
            </>
          )}
        </TabsContent>

        {/* Portfolio Optimization Tab */}
        <TabsContent value="optimization" className="space-y-4">
          {optimizationData && (optimizationData as any)?.data && (
            <>
              <div className="grid gap-4 md:grid-cols-3">
                <Card className="p-4">
                  <div className="text-sm text-muted-foreground">Expected Return</div>
                  <div className="text-2xl font-bold mt-2 text-green-600">
                    {(((optimizationData as any).data.optimization?.expectedReturn || 0) * 100).toFixed(1)}%
                  </div>
                </Card>
                <Card className="p-4">
                  <div className="text-sm text-muted-foreground">Expected Volatility</div>
                  <div className="text-2xl font-bold mt-2 text-orange-600">
                    {(((optimizationData as any).data.optimization?.expectedVolatility || 0) * 100).toFixed(1)}%
                  </div>
                </Card>
                <Card className="p-4">
                  <div className="text-sm text-muted-foreground">Sharpe Ratio</div>
                  <div className="text-2xl font-bold mt-2 text-blue-600">
                    {((optimizationData as any).data.optimization?.sharpeRatio || 0).toFixed(2)}
                  </div>
                </Card>
              </div>

              <Card className="p-4">
                <h3 className="font-semibold mb-4">Optimal Asset Allocation</h3>
                <div className="space-y-3">
                  {Object.entries((optimizationData as any).data.optimization?.optimalWeights || {}).map(([asset, weight]) => (
                    <div key={asset} className="flex items-center justify-between">
                      <span className="font-medium">{asset}</span>
                      <div className="flex items-center space-x-3 flex-1 ml-4">
                        <Progress value={(weight as number) * 100} className="h-2 flex-1" />
                        <span className="text-sm w-12 text-right">{((weight as number) * 100).toFixed(1)}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              <Card className="p-4">
                <h3 className="font-semibold mb-4">Diversification Metrics</h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <div className="text-sm text-muted-foreground">Effective Assets</div>
                    <div className="text-xl font-bold">
                      {((optimizationData as any).data.diversification?.effectiveAssets || 0).toFixed(1)}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Diversification Ratio</div>
                    <div className="text-xl font-bold">
                      {((optimizationData as any).data.diversification?.diversificationRatio || 0).toFixed(2)}
                    </div>
                  </div>
                </div>
              </Card>

              {(optimizationData as any).data.recommendation && (
                <Card className="p-4 bg-blue-50 border-blue-200">
                  <h3 className="font-semibold text-blue-900 mb-2">Recommendation</h3>
                  <p className="text-blue-800">{(optimizationData as any).data.recommendation.reason}</p>
                  <Badge className="mt-2 bg-blue-600">
                    {(optimizationData as any).data.recommendation.action}
                  </Badge>
                </Card>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function AdvancedStrategies() {
  return (
    <ErrorBoundary fallback={(error: Error, retry: () => void) => (
      <div className="p-6">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-foreground mb-2">Advanced Strategies Unavailable</h2>
          <p className="text-muted-foreground mb-4">
            There was an error loading the advanced strategies page. Please try refreshing the page.
          </p>
          <Button onClick={retry}>
            Try Again
          </Button>
        </div>
      </div>
    )}>
      <AdvancedStrategiesContent />
    </ErrorBoundary>
  );
}