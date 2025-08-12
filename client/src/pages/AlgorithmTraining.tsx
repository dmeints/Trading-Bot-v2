import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { 
  Play, 
  Square, 
  BarChart3, 
  TrendingUp,
  Brain,
  Timer,
  Target,
  Zap,
  Activity,
  Settings,
  CheckCircle,
  AlertCircle,
  Clock
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface TrainingSession {
  id: string;
  strategyId: string;
  status: 'initializing' | 'training' | 'validating' | 'completed' | 'failed';
  startTime: string;
  endTime?: string;
  epochs: number;
  currentEpoch: number;
  metrics: {
    loss: number[];
    accuracy: number[];
    sharpeRatio: number[];
    maxDrawdown: number[];
    winRate: number[];
  };
  bestPerformance: {
    epoch: number;
    sharpeRatio: number;
    totalReturn: number;
    maxDrawdown: number;
  };
}

interface BacktestResult {
  id: string;
  strategyId: string;
  performance: {
    totalReturn: number;
    annualizedReturn: number;
    sharpeRatio: number;
    sortinoRatio: number;
    maxDrawdown: number;
    winRate: number;
    profitFactor: number;
    avgTrade: number;
    totalTrades: number;
  };
}

export default function AlgorithmTraining() {
  const [selectedStrategy, setSelectedStrategy] = useState<string>('momentum_breakout');
  const [trainingConfig, setTrainingConfig] = useState({
    epochs: 100,
    learningRate: 0.001,
    batchSize: 32,
    validationSplit: 0.2
  });
  const [backtestConfig, setBacktestConfig] = useState({
    startDate: '2024-01-01',
    endDate: '2024-12-31',
    initialCapital: 100000
  });

  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch training sessions
  const { data: sessionsData, isLoading: sessionsLoading } = useQuery({
    queryKey: ['/api/rl-training/status'],
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  // Fetch backtest results
  const { data: backtestsData, isLoading: backtestsLoading } = useQuery({
    queryKey: ['/api/backtests/history'],
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  // Check if training is active
  const { data: trainingStatus } = useQuery({
    queryKey: ['/api/rl-training/status'],
    refetchInterval: 2000, // Refresh every 2 seconds
  });

  // Start training mutation
  const startTraining = useMutation({
    mutationFn: async (config: any) => {
      const response = await fetch('/api/rl-training/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          maxEpisodes: config.epochs || 100,
          convergenceThreshold: 0.02,
          parametersToOptimize: ['volPctBreakout', 'socialGo', 'costCapBps', 'baseRiskPct']
        }),
      });
      
      if (!response.ok) throw new Error('Failed to start training');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/rl-training/status'] });
      toast({
        title: "Training Started",
        description: "Algorithm training has been initiated successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to start training session.",
        variant: "destructive",
      });
    },
  });

  // Stop training mutation
  const stopTraining = useMutation({
    mutationFn: async (sessionId: string) => {
      const response = await fetch(`/api/training/stop/${sessionId}`, {
        method: 'POST',
      });
      
      if (!response.ok) throw new Error('Failed to stop training');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/training/sessions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/training/is-training'] });
      toast({
        title: "Training Stopped",
        description: "Training session has been stopped successfully.",
      });
    },
  });

  // Run backtest mutation
  const runBacktest = useMutation({
    mutationFn: async (config: any) => {
      const response = await fetch('/api/backtests/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          strategyId: config.strategyId,
          startDate: config.startDate,
          endDate: config.endDate,
          initialCapital: config.initialCapital
        }),
      });
      
      if (!response.ok) throw new Error('Failed to run backtest');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/backtests/history'] });
      toast({
        title: "Backtest Completed",
        description: "Strategy backtesting has been completed successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to run backtest.",
        variant: "destructive",
      });
    },
  });

  const sessions: TrainingSession[] = (sessionsData as any)?.data?.training?.sessions || [];
  const backtests: BacktestResult[] = (backtestsData as any)?.data || [];
  const isTrainingActive = (trainingStatus as any)?.data?.training?.isTraining || false;

  const handleStartTraining = () => {
    startTraining.mutate({
      strategyId: selectedStrategy,
      ...trainingConfig
    });
  };

  const handleRunBacktest = () => {
    runBacktest.mutate({
      strategyId: selectedStrategy,
      ...backtestConfig
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'failed':
        return <AlertCircle className="w-4 h-4 text-red-600" />;
      case 'training':
        return <Activity className="w-4 h-4 text-blue-600 animate-pulse" />;
      default:
        return <Clock className="w-4 h-4 text-yellow-600" />;
    }
  };

  const formatDuration = (startTime: string, endTime?: string) => {
    const start = new Date(startTime);
    const end = endTime ? new Date(endTime) : new Date();
    const duration = Math.floor((end.getTime() - start.getTime()) / 1000);
    
    if (duration < 60) return `${duration}s`;
    if (duration < 3600) return `${Math.floor(duration / 60)}m ${duration % 60}s`;
    return `${Math.floor(duration / 3600)}h ${Math.floor((duration % 3600) / 60)}m`;
  };

  const getPerformanceColor = (value: number, type: 'return' | 'sharpe') => {
    switch (type) {
      case 'return':
        return value > 0.1 ? 'text-green-600' : value > 0 ? 'text-yellow-600' : 'text-red-600';
      case 'sharpe':
        return value > 1.0 ? 'text-green-600' : value > 0.5 ? 'text-yellow-600' : 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  if (sessionsLoading && backtestsLoading) {
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
          <h1 className="text-2xl font-bold text-foreground">Algorithm Training</h1>
          <p className="text-muted-foreground">Train and optimize AI trading algorithms with real-time performance monitoring</p>
        </div>
        <div className="flex items-center space-x-2">
          {isTrainingActive && (
            <Badge variant="default" className="bg-blue-600 text-white animate-pulse">
              <Activity className="w-3 h-3 mr-1" />
              Training Active
            </Badge>
          )}
        </div>
      </div>

      <Tabs defaultValue="training" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="training">Training Sessions</TabsTrigger>
          <TabsTrigger value="backtesting">Backtesting</TabsTrigger>
          <TabsTrigger value="optimization">Optimization</TabsTrigger>
          <TabsTrigger value="analytics">Performance Analytics</TabsTrigger>
        </TabsList>

        {/* Training Tab */}
        <TabsContent value="training" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Training Control Panel */}
            <Card className="p-4">
              <h3 className="font-semibold mb-4">Start New Training Session</h3>
              
              <div className="space-y-4">
                <div>
                  <Label htmlFor="strategy">Strategy</Label>
                  <select 
                    id="strategy"
                    value={selectedStrategy}
                    onChange={(e) => setSelectedStrategy(e.target.value)}
                    className="w-full p-2 border rounded-md bg-background"
                    data-testid="select-training-strategy"
                  >
                    <option value="momentum_breakout">Momentum Breakout</option>
                    <option value="mean_reversion">Mean Reversion</option>
                    <option value="sentiment_momentum">Sentiment Momentum</option>
                  </select>
                </div>

                <div>
                  <Label htmlFor="epochs">Training Epochs: {trainingConfig.epochs}</Label>
                  <Slider
                    value={[trainingConfig.epochs]}
                    onValueChange={(value) => setTrainingConfig(prev => ({ ...prev, epochs: value[0] }))}
                    max={500}
                    min={10}
                    step={10}
                    className="mt-2"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="learningRate">Learning Rate</Label>
                    <Input
                      id="learningRate"
                      type="number"
                      step="0.0001"
                      value={trainingConfig.learningRate}
                      onChange={(e) => setTrainingConfig(prev => ({ 
                        ...prev, 
                        learningRate: parseFloat(e.target.value) 
                      }))}
                      data-testid="input-learning-rate"
                    />
                  </div>
                  <div>
                    <Label htmlFor="batchSize">Batch Size</Label>
                    <Input
                      id="batchSize"
                      type="number"
                      value={trainingConfig.batchSize}
                      onChange={(e) => setTrainingConfig(prev => ({ 
                        ...prev, 
                        batchSize: parseInt(e.target.value) 
                      }))}
                      data-testid="input-batch-size"
                    />
                  </div>
                </div>

                <Button 
                  onClick={handleStartTraining} 
                  disabled={startTraining.isPending || isTrainingActive}
                  className="w-full"
                  data-testid="button-start-training"
                >
                  <Play className="w-4 h-4 mr-2" />
                  {startTraining.isPending ? 'Starting...' : 'Start Training'}
                </Button>
              </div>
            </Card>

            {/* Training Status */}
            <Card className="p-4">
              <h3 className="font-semibold mb-4">Training Status</h3>
              
              {sessions.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  No training sessions yet
                </div>
              ) : (
                <div className="space-y-3">
                  {sessions.slice(0, 3).map((session) => (
                    <div key={session.id} className="border rounded-lg p-3">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center space-x-2">
                          {getStatusIcon(session.status)}
                          <span className="font-medium">{session.strategyId}</span>
                        </div>
                        {session.status === 'training' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => stopTraining.mutate(session.id)}
                            data-testid={`button-stop-${session.id}`}
                          >
                            <Square className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                      
                      {session.status === 'training' && (
                        <div className="mb-2">
                          <div className="flex justify-between text-sm mb-1">
                            <span>Progress</span>
                            <span>{session.currentEpoch}/{session.epochs}</span>
                          </div>
                          <Progress value={(session.currentEpoch / session.epochs) * 100} className="h-2" />
                        </div>
                      )}
                      
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="text-muted-foreground">Duration:</span>
                          <span className="ml-1">{formatDuration(session.startTime, session.endTime)}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Best Sharpe:</span>
                          <span className="ml-1 text-blue-600">{session.bestPerformance.sharpeRatio.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </TabsContent>

        {/* Backtesting Tab */}
        <TabsContent value="backtesting" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Backtest Configuration */}
            <Card className="p-4">
              <h3 className="font-semibold mb-4">Run Backtest</h3>
              
              <div className="space-y-4">
                <div>
                  <Label htmlFor="backtest-strategy">Strategy</Label>
                  <select 
                    id="backtest-strategy"
                    value={selectedStrategy}
                    onChange={(e) => setSelectedStrategy(e.target.value)}
                    className="w-full p-2 border rounded-md bg-background"
                    data-testid="select-backtest-strategy"
                  >
                    <option value="momentum_breakout">Momentum Breakout</option>
                    <option value="mean_reversion">Mean Reversion</option>
                    <option value="sentiment_momentum">Sentiment Momentum</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="startDate">Start Date</Label>
                    <Input
                      id="startDate"
                      type="date"
                      value={backtestConfig.startDate}
                      onChange={(e) => setBacktestConfig(prev => ({ ...prev, startDate: e.target.value }))}
                      data-testid="input-start-date"
                    />
                  </div>
                  <div>
                    <Label htmlFor="endDate">End Date</Label>
                    <Input
                      id="endDate"
                      type="date"
                      value={backtestConfig.endDate}
                      onChange={(e) => setBacktestConfig(prev => ({ ...prev, endDate: e.target.value }))}
                      data-testid="input-end-date"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="initialCapital">Initial Capital ($)</Label>
                  <Input
                    id="initialCapital"
                    type="number"
                    value={backtestConfig.initialCapital}
                    onChange={(e) => setBacktestConfig(prev => ({ 
                      ...prev, 
                      initialCapital: parseInt(e.target.value) 
                    }))}
                    data-testid="input-initial-capital"
                  />
                </div>

                <Button 
                  onClick={handleRunBacktest} 
                  disabled={runBacktest.isPending}
                  className="w-full"
                  data-testid="button-run-backtest"
                >
                  <BarChart3 className="w-4 h-4 mr-2" />
                  {runBacktest.isPending ? 'Running...' : 'Run Backtest'}
                </Button>
              </div>
            </Card>

            {/* Backtest Results */}
            <Card className="p-4">
              <h3 className="font-semibold mb-4">Recent Backtest Results</h3>
              
              {backtests.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  No backtest results yet
                </div>
              ) : (
                <div className="space-y-3">
                  {backtests.slice(0, 3).map((backtest) => (
                    <div key={backtest.id} className="border rounded-lg p-3">
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-medium">{backtest.strategyId}</span>
                        <Badge variant="secondary">{backtest.performance.totalTrades} trades</Badge>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="text-muted-foreground">Total Return:</span>
                          <span className={`ml-1 font-medium ${getPerformanceColor(backtest.performance.totalReturn, 'return')}`}>
                            {(backtest.performance.totalReturn * 100).toFixed(2)}%
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Sharpe Ratio:</span>
                          <span className={`ml-1 font-medium ${getPerformanceColor(backtest.performance.sharpeRatio, 'sharpe')}`}>
                            {backtest.performance.sharpeRatio.toFixed(2)}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Win Rate:</span>
                          <span className="ml-1">{(backtest.performance.winRate * 100).toFixed(1)}%</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Max DD:</span>
                          <span className="ml-1 text-red-600">{(Math.abs(backtest.performance.maxDrawdown) * 100).toFixed(2)}%</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </TabsContent>

        {/* Optimization Tab */}
        <TabsContent value="optimization" className="space-y-4">
          <Card className="p-4">
            <h3 className="font-semibold mb-4">Hyperparameter Optimization</h3>
            
            {/* Current optimization status */}
            <div className="mb-6">
              <h4 className="text-sm font-medium mb-3">Recent Optimizations</h4>
              {(trainingStatus as any)?.data?.recentOptimizations?.length > 0 ? (
                <div className="space-y-3">
                  {((trainingStatus as any).data.recentOptimizations || []).map((opt: any, index: number) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                      <div>
                        <div className="text-sm font-medium">{opt.parameter || 'Parameter'}</div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(opt.timestamp || Date.now()).toLocaleString()}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm">
                          {opt.oldValue} → {opt.newValue}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Performance: {opt.performance ? `${(opt.performance * 100).toFixed(1)}%` : 'N/A'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-6">
                  <Settings className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No optimization history available</p>
                  <p className="text-xs">Start a training session to see optimization results</p>
                </div>
              )}
            </div>

            {/* Current algorithm configuration */}
            <div className="mb-6">
              <h4 className="text-sm font-medium mb-3">Current Algorithm Configuration</h4>
              {(trainingStatus as any)?.data?.currentAlgorithmConfig ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {Object.entries((trainingStatus as any).data.currentAlgorithmConfig).map(([key, value]) => (
                    <div key={key} className="p-3 bg-muted rounded-lg">
                      <div className="text-xs text-muted-foreground">{key}</div>
                      <div className="text-sm font-medium">{String(value)}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-4">
                  <p className="text-sm">Configuration loading...</p>
                </div>
              )}
            </div>

            {/* Manual parameter adjustment */}
            <div>
              <h4 className="text-sm font-medium mb-3">Manual Parameter Adjustment</h4>
              <div className="p-4 border rounded-lg">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="param-select" className="text-xs">Parameter</Label>
                    <select 
                      id="param-select"
                      className="w-full mt-1 p-2 border rounded text-sm"
                      defaultValue=""
                    >
                      <option value="">Select parameter</option>
                      <option value="volPctBreakout">Volume Breakout %</option>
                      <option value="socialGo">Social Sentiment Threshold</option>
                      <option value="costCapBps">Cost Cap (BPS)</option>
                      <option value="baseRiskPct">Base Risk %</option>
                    </select>
                  </div>
                  <div>
                    <Label htmlFor="param-value" className="text-xs">New Value</Label>
                    <Input 
                      id="param-value"
                      type="number" 
                      step="0.01"
                      placeholder="Enter new value"
                      className="mt-1"
                    />
                  </div>
                  <div className="flex items-end">
                    <Button size="sm" className="w-full">
                      Update Parameter
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Updates will take effect immediately and be included in the next training cycle
                </p>
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">Total Sessions</div>
                <Brain className="w-4 h-4 text-blue-600" />
              </div>
              <div className="text-2xl font-bold mt-2">{(sessionsData as any)?.data?.summary?.total || 0}</div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">Completed</div>
                <CheckCircle className="w-4 h-4 text-green-600" />
              </div>
              <div className="text-2xl font-bold mt-2 text-green-600">{(sessionsData as any)?.data?.summary?.completed || 0}</div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">Avg Return</div>
                <TrendingUp className="w-4 h-4 text-blue-600" />
              </div>
              <div className="text-2xl font-bold mt-2 text-blue-600">
                {(backtestsData as any)?.data?.summary?.avgReturn ? 
                  ((backtestsData as any).data.summary.avgReturn * 100).toFixed(1) + '%' : '0%'}
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">Best Return</div>
                <Target className="w-4 h-4 text-green-600" />
              </div>
              <div className="text-2xl font-bold mt-2 text-green-600">
                {(backtestsData as any)?.data?.summary?.bestReturn ? 
                  ((backtestsData as any).data.summary.bestReturn * 100).toFixed(1) + '%' : '0%'}
              </div>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}