import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import TopNavigation from '@/components/layout/TopNavigation';
import SidebarNavigation from '@/components/layout/SidebarNavigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarIcon, Download, Play, Settings, TrendingUp, TrendingDown, BarChart3, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface BacktestConfig {
  strategy: string;
  symbol: string;
  startDate: Date;
  endDate: Date;
  initialBalance: number;
  riskPerTrade: number;
  stopLoss?: number;
  takeProfit?: number;
}

interface BacktestResult {
  id: string;
  config: BacktestConfig;
  performance: {
    totalReturn: number;
    winRate: number;
    sharpeRatio: number;
    maxDrawdown: number;
    totalTrades: number;
    avgTradeReturn: number;
    profitFactor: number;
  };
  trades: any[];
  equityCurve: { timestamp: Date; equity: number; drawdown: number }[];
  statistics: any;
  reportUrl?: string;
}

interface SyntheticEvent {
  type: 'news' | 'whale_move' | 'social_buzz' | 'regulatory';
  timestamp: Date;
  impact: number;
  description: string;
  duration: number;
}

export default function SimulationStudio() {
  const { isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [config, setConfig] = useState<BacktestConfig>({
    strategy: 'momentum',
    symbol: 'BTC/USD',
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
    endDate: new Date(),
    initialBalance: 10000,
    riskPerTrade: 2,
    stopLoss: 5,
    takeProfit: 10
  });
  
  const [syntheticEvents, setSyntheticEvents] = useState<SyntheticEvent[]>([]);
  const [selectedResult, setSelectedResult] = useState<BacktestResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);

  // Query for available strategies
  const { data: strategies = [] } = useQuery<string[]>({
    queryKey: ['/api/strategies/list'],
    enabled: isAuthenticated,
    retry: 2,
    staleTime: 300000 // 5 minutes
  });

  // Fetch real market event templates for simulation
  const { data: eventTemplates = [] } = useQuery<SyntheticEvent[]>({
    queryKey: ['/api/market/event-templates'],
    enabled: isAuthenticated,
    retry: 2
  });

  // Fetch real backtest results history
  const { data: backtestHistory = [] } = useQuery<BacktestResult[]>({
    queryKey: ['/api/backtests/history'],
    enabled: isAuthenticated,
    retry: 2
  });

  // Run backtest mutation
  const runBacktestMutation = useMutation({
    mutationFn: async (backtestConfig: BacktestConfig & { syntheticEvents: SyntheticEvent[] }): Promise<BacktestResult> => {
      const response = await apiRequest('/api/simulation/backtest', {
        method: 'POST',
        data: backtestConfig
      });
      return response;
    },
    onSuccess: (result: BacktestResult) => {
      setSelectedResult(result);
      setIsRunning(false);
      setProgress(100);
      toast({
        title: "Backtest Complete",
        description: `Strategy returned ${result.performance.totalReturn.toFixed(2)}% with ${result.performance.winRate.toFixed(1)}% win rate`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/simulation/history'] });
    },
    onError: (error: any) => {
      setIsRunning(false);
      setProgress(0);
      toast({
        title: "Backtest Failed",
        description: error.message || "Failed to run backtest simulation",
        variant: "destructive",
      });
    }
  });

  // Export results mutation
  const exportMutation = useMutation({
    mutationFn: async (backtestId: string) => {
      const response = await fetch(`/api/simulation/export/${backtestId}`);
      const blob = await response.blob();
      return { blob, backtestId };
    },
    onSuccess: ({ blob, backtestId }) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backtest_${backtestId}_results.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast({
        title: "Export Complete",
        description: "Backtest results downloaded successfully",
      });
    }
  });

  const handleRunBacktest = () => {
    setIsRunning(true);
    setProgress(0);
    
    // Simulate progress updates
    // Real backtest execution with progress tracking
    const executeRealBacktest = async () => {
      try {
        setProgress(10);
        
        // Submit backtest job to real backtesting engine
        const backtestJob = await apiRequest('/api/backtests/submit', {
          method: 'POST',
          data: {
            ...config,
            syntheticEvents,
            timestamp: new Date().toISOString()
          }
        });
        
        const jobId = backtestJob?.id;
        if (!jobId) throw new Error('Failed to create backtest job');
        
        setProgress(25);
        
        // Poll for real progress updates
        const progressInterval = setInterval(async () => {
          try {
            const status = await apiRequest(`/api/backtests/status/${jobId}`);
            const realProgress = status?.progress || 0;
            
            setProgress(Math.min(90, realProgress));
            
            if (status?.status === 'completed') {
              clearInterval(progressInterval);
              setProgress(100);
              
              // Fetch real results
              const results = await apiRequest(`/api/backtests/results/${jobId}`);
              if (results) {
                setSelectedResult(results);
                queryClient.invalidateQueries({ queryKey: ['/api/backtests/history'] });
                toast({
                  title: "Backtest Complete",
                  description: `Strategy performance: ${results.performance?.totalReturn?.toFixed(2)}% return`,
                });
              }
            } else if (status?.status === 'failed') {
              clearInterval(progressInterval);
              setProgress(0);
              toast({
                title: "Backtest Failed", 
                description: status?.error || "Unknown error occurred",
                variant: "destructive"
              });
            }
          } catch (error) {
            clearInterval(progressInterval);
            console.error('Progress polling error:', error);
          }
        }, 2000);
        
      } catch (error) {
        console.error('Real backtest execution error:', error);
        setProgress(0);
        toast({
          title: "Execution Error",
          description: "Failed to start backtest. Please check configuration.",
          variant: "destructive"
        });
      }
    };
    
    executeRealBacktest();

    runBacktestMutation.mutate({
      ...config,
      syntheticEvents
    });
  };

  const addSyntheticEvent = (template: SyntheticEvent) => {
    const newEvent = {
      ...template,
      timestamp: new Date(config.startDate.getTime() + Math.random() * (config.endDate.getTime() - config.startDate.getTime()))
    };
    setSyntheticEvents([...syntheticEvents, newEvent]);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    window.location.href = "/api/login";
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <TopNavigation />
      
      <div className="flex pt-16">
        <SidebarNavigation />
        
        <main className="flex-1 p-6">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-2xl font-bold">Simulation Studio</h1>
              <div className="flex gap-2">
                {selectedResult && (
                  <Button
                    variant="outline"
                    onClick={() => exportMutation.mutate(selectedResult.id)}
                    disabled={exportMutation.isPending}
                    data-testid="button-export-results"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Export Results
                  </Button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Configuration Panel */}
              <div className="lg:col-span-1 space-y-6">
                <Card className="bg-gray-800 border-gray-700">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Settings className="w-5 h-5" />
                      Backtest Configuration
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="strategy">Strategy</Label>
                      <Select 
                        value={config.strategy} 
                        onValueChange={(value) => setConfig({...config, strategy: value})}
                      >
                        <SelectTrigger id="strategy" data-testid="select-strategy">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {strategies.map(strategy => (
                            <SelectItem key={strategy} value={strategy}>
                              {strategy.replace('_', ' ').toUpperCase()}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="symbol">Trading Pair</Label>
                      <Select 
                        value={config.symbol} 
                        onValueChange={(value) => setConfig({...config, symbol: value})}
                      >
                        <SelectTrigger id="symbol" data-testid="select-symbol">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="BTC/USD">BTC/USD</SelectItem>
                          <SelectItem value="ETH/USD">ETH/USD</SelectItem>
                          <SelectItem value="SOL/USD">SOL/USD</SelectItem>
                          <SelectItem value="ADA/USD">ADA/USD</SelectItem>
                          <SelectItem value="DOT/USD">DOT/USD</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label>Start Date</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className="w-full justify-start text-left font-normal">
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {format(config.startDate, "MMM dd, yyyy")}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0">
                            <Calendar
                              mode="single"
                              selected={config.startDate}
                              onSelect={(date) => date && setConfig({...config, startDate: date})}
                            />
                          </PopoverContent>
                        </Popover>
                      </div>

                      <div>
                        <Label>End Date</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className="w-full justify-start text-left font-normal">
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {format(config.endDate, "MMM dd, yyyy")}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0">
                            <Calendar
                              mode="single"
                              selected={config.endDate}
                              onSelect={(date) => date && setConfig({...config, endDate: date})}
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="balance">Initial Balance ($)</Label>
                      <Input
                        id="balance"
                        type="number"
                        value={config.initialBalance}
                        onChange={(e) => setConfig({...config, initialBalance: parseInt(e.target.value)})}
                        data-testid="input-initial-balance"
                      />
                    </div>

                    <div>
                      <Label htmlFor="risk">Risk per Trade (%)</Label>
                      <Input
                        id="risk"
                        type="number"
                        step="0.1"
                        value={config.riskPerTrade}
                        onChange={(e) => setConfig({...config, riskPerTrade: parseFloat(e.target.value)})}
                        data-testid="input-risk-per-trade"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label htmlFor="stopLoss">Stop Loss (%)</Label>
                        <Input
                          id="stopLoss"
                          type="number"
                          step="0.1"
                          value={config.stopLoss || ''}
                          onChange={(e) => setConfig({...config, stopLoss: e.target.value ? parseFloat(e.target.value) : undefined})}
                          data-testid="input-stop-loss"
                        />
                      </div>

                      <div>
                        <Label htmlFor="takeProfit">Take Profit (%)</Label>
                        <Input
                          id="takeProfit"
                          type="number"
                          step="0.1"
                          value={config.takeProfit || ''}
                          onChange={(e) => setConfig({...config, takeProfit: e.target.value ? parseFloat(e.target.value) : undefined})}
                          data-testid="input-take-profit"
                        />
                      </div>
                    </div>

                    <Button 
                      onClick={handleRunBacktest} 
                      disabled={isRunning}
                      className="w-full"
                      data-testid="button-run-backtest"
                    >
                      <Play className="w-4 h-4 mr-2" />
                      {isRunning ? 'Running...' : 'Run Backtest'}
                    </Button>

                    {isRunning && (
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Progress</span>
                          <span>{progress.toFixed(0)}%</span>
                        </div>
                        <Progress value={progress} className="w-full" />
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Synthetic Events */}
                <Card className="bg-gray-800 border-gray-700">
                  <CardHeader>
                    <CardTitle>Synthetic Events</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      {eventTemplates.map((template, index) => (
                        <Button
                          key={index}
                          variant="outline"
                          size="sm"
                          onClick={() => addSyntheticEvent(template)}
                          className="w-full justify-start"
                          data-testid={`button-add-event-${template.type}`}
                        >
                          {template.type.replace('_', ' ').toUpperCase()}: {template.description}
                        </Button>
                      ))}
                    </div>

                    {syntheticEvents.length > 0 && (
                      <div className="space-y-2">
                        <Label>Added Events</Label>
                        {syntheticEvents.map((event, index) => (
                          <div key={index} className="flex items-center justify-between p-2 bg-gray-700 rounded">
                            <div className="text-sm">
                              <Badge variant="secondary" className="mb-1">
                                {event.type}
                              </Badge>
                              <div>{event.description}</div>
                              <div className="text-gray-400">
                                {format(event.timestamp, "MMM dd, HH:mm")}
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSyntheticEvents(syntheticEvents.filter((_, i) => i !== index))}
                            >
                              ×
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Results Panel */}
              <div className="lg:col-span-2">
                {selectedResult ? (
                  <Tabs defaultValue="overview" className="space-y-6">
                    <TabsList className="grid grid-cols-4 w-full max-w-lg bg-gray-800">
                      <TabsTrigger value="overview">Overview</TabsTrigger>
                      <TabsTrigger value="equity">Equity Curve</TabsTrigger>
                      <TabsTrigger value="trades">Trades</TabsTrigger>
                      <TabsTrigger value="statistics">Statistics</TabsTrigger>
                    </TabsList>

                    <TabsContent value="overview" className="space-y-6">
                      {/* Performance Metrics */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <Card className="bg-gray-800 border-gray-700">
                          <CardContent className="p-4">
                            <div className="flex items-center gap-2">
                              <TrendingUp className="w-4 h-4 text-green-400" />
                              <div>
                                <div className="text-2xl font-bold text-green-400" data-testid="metric-total-return">
                                  {selectedResult.performance.totalReturn.toFixed(2)}%
                                </div>
                                <div className="text-sm text-gray-400">Total Return</div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>

                        <Card className="bg-gray-800 border-gray-700">
                          <CardContent className="p-4">
                            <div className="flex items-center gap-2">
                              <BarChart3 className="w-4 h-4 text-blue-400" />
                              <div>
                                <div className="text-2xl font-bold text-blue-400" data-testid="metric-win-rate">
                                  {selectedResult.performance.winRate.toFixed(1)}%
                                </div>
                                <div className="text-sm text-gray-400">Win Rate</div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>

                        <Card className="bg-gray-800 border-gray-700">
                          <CardContent className="p-4">
                            <div className="flex items-center gap-2">
                              <TrendingDown className="w-4 h-4 text-red-400" />
                              <div>
                                <div className="text-2xl font-bold text-red-400" data-testid="metric-max-drawdown">
                                  {selectedResult.performance.maxDrawdown.toFixed(2)}%
                                </div>
                                <div className="text-sm text-gray-400">Max Drawdown</div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>

                        <Card className="bg-gray-800 border-gray-700">
                          <CardContent className="p-4">
                            <div className="flex items-center gap-2">
                              <Clock className="w-4 h-4 text-purple-400" />
                              <div>
                                <div className="text-2xl font-bold text-purple-400" data-testid="metric-total-trades">
                                  {selectedResult.performance.totalTrades}
                                </div>
                                <div className="text-sm text-gray-400">Total Trades</div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    </TabsContent>

                    <TabsContent value="equity" className="space-y-6">
                      <Card className="bg-gray-800 border-gray-700">
                        <CardHeader>
                          <CardTitle>Equity Curve</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <ResponsiveContainer width="100%" height={400}>
                            <AreaChart data={selectedResult.equityCurve}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                              <XAxis 
                                dataKey="timestamp" 
                                tickFormatter={(value) => format(new Date(value), "MMM dd")}
                                stroke="#9CA3AF"
                              />
                              <YAxis stroke="#9CA3AF" />
                              <Tooltip 
                                labelFormatter={(value) => format(new Date(value), "MMM dd, yyyy HH:mm")}
                                contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151' }}
                              />
                              <Area
                                type="monotone"
                                dataKey="equity"
                                stroke="#10B981"
                                fill="#10B981"
                                fillOpacity={0.2}
                              />
                            </AreaChart>
                          </ResponsiveContainer>
                        </CardContent>
                      </Card>
                    </TabsContent>

                    <TabsContent value="trades" className="space-y-6">
                      <Card className="bg-gray-800 border-gray-700">
                        <CardHeader>
                          <CardTitle>Trade History</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm" data-testid="table-trades">
                              <thead>
                                <tr className="border-b border-gray-700">
                                  <th className="text-left p-2">Date</th>
                                  <th className="text-left p-2">Symbol</th>
                                  <th className="text-left p-2">Side</th>
                                  <th className="text-left p-2">Quantity</th>
                                  <th className="text-left p-2">Price</th>
                                  <th className="text-left p-2">P&L</th>
                                  <th className="text-left p-2">Confidence</th>
                                </tr>
                              </thead>
                              <tbody>
                                {selectedResult.trades.slice(0, 20).map((trade, index) => (
                                  <tr key={index} className="border-b border-gray-700/50" data-testid={`trade-row-${index}`}>
                                    <td className="p-2">{format(new Date(trade.timestamp), "MMM dd, HH:mm")}</td>
                                    <td className="p-2">{trade.symbol}</td>
                                    <td className="p-2">
                                      <Badge variant={trade.side === 'buy' ? 'default' : 'secondary'}>
                                        {trade.side.toUpperCase()}
                                      </Badge>
                                    </td>
                                    <td className="p-2">{trade.quantity.toFixed(6)}</td>
                                    <td className="p-2">${trade.price.toFixed(2)}</td>
                                    <td className={`p-2 ${trade.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                      ${trade.pnl.toFixed(2)}
                                    </td>
                                    <td className="p-2">{(trade.confidence * 100).toFixed(1)}%</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </CardContent>
                      </Card>
                    </TabsContent>

                    <TabsContent value="statistics" className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Card className="bg-gray-800 border-gray-700">
                          <CardHeader>
                            <CardTitle>Performance Metrics</CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            <div className="flex justify-between">
                              <span>Sharpe Ratio:</span>
                              <span className="font-mono">{selectedResult.performance.sharpeRatio.toFixed(3)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Profit Factor:</span>
                              <span className="font-mono">{selectedResult.performance.profitFactor.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Avg Trade Return:</span>
                              <span className="font-mono">${selectedResult.performance.avgTradeReturn.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Best Trade:</span>
                              <span className="font-mono text-green-400">${selectedResult.statistics.bestTrade.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Worst Trade:</span>
                              <span className="font-mono text-red-400">${selectedResult.statistics.worstTrade.toFixed(2)}</span>
                            </div>
                          </CardContent>
                        </Card>

                        <Card className="bg-gray-800 border-gray-700">
                          <CardHeader>
                            <CardTitle>Trade Statistics</CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            <div className="flex justify-between">
                              <span>Duration:</span>
                              <span className="font-mono">{selectedResult.statistics.duration.toFixed(0)} days</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Consecutive Wins:</span>
                              <span className="font-mono">{selectedResult.statistics.consecutiveWins}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Consecutive Losses:</span>
                              <span className="font-mono">{selectedResult.statistics.consecutiveLosses}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Volatility:</span>
                              <span className="font-mono">{selectedResult.statistics.volatility.toFixed(2)}%</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Avg Daily Return:</span>
                              <span className="font-mono">${selectedResult.statistics.avgDailyReturn.toFixed(2)}</span>
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    </TabsContent>
                  </Tabs>
                ) : (
                  <Card className="bg-gray-800 border-gray-700 h-96 flex items-center justify-center">
                    <div className="text-center text-gray-400">
                      <BarChart3 className="w-16 h-16 mx-auto mb-4 opacity-50" />
                      <h3 className="text-lg font-semibold mb-2">No Simulation Results</h3>
                      <p>Configure your backtest parameters and run a simulation to see results here.</p>
                    </div>
                  </Card>
                )}
              </div>
            </div>

            {/* Previous Results */}
            {backtestHistory.length > 0 && (
              <Card className="bg-gray-800 border-gray-700 mt-6">
                <CardHeader>
                  <CardTitle>Recent Simulations</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {backtestHistory.slice(0, 5).map((result, index) => (
                      <div 
                        key={result.id}
                        className="flex items-center justify-between p-3 bg-gray-700 rounded cursor-pointer hover:bg-gray-600"
                        onClick={() => setSelectedResult(result)}
                        data-testid={`history-item-${index}`}
                      >
                        <div>
                          <div className="font-medium">
                            {result.config.strategy.replace('_', ' ').toUpperCase()} - {result.config.symbol}
                          </div>
                          <div className="text-sm text-gray-400">
                            {format(result.config.startDate, "MMM dd")} - {format(result.config.endDate, "MMM dd, yyyy")}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={`font-mono ${result.performance.totalReturn >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {result.performance.totalReturn.toFixed(2)}%
                          </div>
                          <div className="text-sm text-gray-400">
                            {result.performance.totalTrades} trades
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}