import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  PlayCircle, 
  StopCircle, 
  Brain, 
  TrendingUp, 
  Target, 
  Settings2,
  Clock,
  BarChart3,
  Zap,
  Shield,
  DollarSign,
  Activity
} from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface TrainingScenario {
  id: string;
  name: string;
  description: string;
  duration: number;
  targetParameters: string[];
  marketConditions: string;
  optimizationGoal: string;
  config: {
    maxEpisodes: number;
    convergenceThreshold: number;
    aggressiveness: 'conservative' | 'moderate' | 'aggressive';
  };
}

interface TrainingStatus {
  isTraining: boolean;
  currentEpisode: any;
  trainingHistory: any[];
}

export default function RLTraining() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedScenario, setSelectedScenario] = useState<string | null>(null);

  // Fetch training status
  const { data: statusData, isLoading: statusLoading } = useQuery({
    queryKey: ['/api/rl-training/status'],
    refetchInterval: 2000, // Refresh every 2 seconds during training
  });

  // Fetch available scenarios
  const { data: scenariosData, isLoading: scenariosLoading } = useQuery({
    queryKey: ['/api/rl-training/scenarios'],
  });

  // Fetch performance metrics
  const { data: performanceData } = useQuery({
    queryKey: ['/api/rl-training/performance/BTC'],
  });

  // Start scenario mutation
  const startScenarioMutation = useMutation({
    mutationFn: (scenarioId: string) => 
      apiRequest(`/api/rl-training/scenarios/${scenarioId}/start`, {
        method: 'POST',
      }),
    onSuccess: (data) => {
      toast({
        title: 'Training Started',
        description: `Started scenario: ${data.data.scenario.name}`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/rl-training/status'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Training Failed',
        description: error.message || 'Failed to start training scenario',
        variant: 'destructive',
      });
    },
  });

  // Stop training mutation
  const stopTrainingMutation = useMutation({
    mutationFn: () => 
      apiRequest('/api/rl-training/scenarios/stop', {
        method: 'POST',
      }),
    onSuccess: () => {
      toast({
        title: 'Training Stopped',
        description: 'Training session has been stopped successfully',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/rl-training/status'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Stop Failed',
        description: error.message || 'Failed to stop training',
        variant: 'destructive',
      });
    },
  });

  const trainingStatus: TrainingStatus = statusData?.data?.training || {
    isTraining: false,
    currentEpisode: null,
    trainingHistory: []
  };

  const scenarios: TrainingScenario[] = scenariosData?.data?.availableScenarios || [];
  const recommendation = scenariosData?.data?.recommendation;
  const currentConfig = statusData?.data?.currentAlgorithmConfig;

  const getScenarioIcon = (goal: string) => {
    switch (goal) {
      case 'returns': return <DollarSign className="h-4 w-4" />;
      case 'sharpe': return <TrendingUp className="h-4 w-4" />;
      case 'drawdown': return <Shield className="h-4 w-4" />;
      case 'winrate': return <Target className="h-4 w-4" />;
      default: return <Activity className="h-4 w-4" />;
    }
  };

  const getAggressivenessColor = (level: string) => {
    switch (level) {
      case 'conservative': return 'bg-green-100 text-green-800';
      case 'moderate': return 'bg-blue-100 text-blue-800';
      case 'aggressive': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6" data-testid="rl-training-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight" data-testid="text-title">
            RL Parameter Optimization
          </h1>
          <p className="text-muted-foreground" data-testid="text-subtitle">
            Continuous algorithm improvement through reinforcement learning
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge 
            variant={trainingStatus.isTraining ? "default" : "secondary"}
            data-testid="badge-status"
          >
            <Brain className="h-3 w-3 mr-1" />
            {trainingStatus.isTraining ? 'Training Active' : 'Ready'}
          </Badge>
        </div>
      </div>

      <Tabs defaultValue="scenarios" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="scenarios" data-testid="tab-scenarios">Scenarios</TabsTrigger>
          <TabsTrigger value="status" data-testid="tab-status">Status</TabsTrigger>
          <TabsTrigger value="config" data-testid="tab-config">Configuration</TabsTrigger>
          <TabsTrigger value="performance" data-testid="tab-performance">Performance</TabsTrigger>
        </TabsList>

        {/* Training Scenarios Tab */}
        <TabsContent value="scenarios" className="space-y-4">
          {/* Recommendation Alert */}
          {recommendation && !trainingStatus.isTraining && (
            <Alert data-testid="alert-recommendation">
              <Brain className="h-4 w-4" />
              <AlertDescription>
                <div className="flex items-center justify-between">
                  <div>
                    <strong>Recommended:</strong> {recommendation.recommended.name}
                    <br />
                    <span className="text-sm text-muted-foreground">
                      {recommendation.reasoning}
                    </span>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => startScenarioMutation.mutate(recommendation.recommended.id)}
                    disabled={startScenarioMutation.isPending}
                    data-testid="button-start-recommended"
                  >
                    <PlayCircle className="h-4 w-4 mr-1" />
                    Start
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Current Training Display */}
          {trainingStatus.isTraining && trainingStatus.currentEpisode && (
            <Card data-testid="card-current-training">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Activity className="h-5 w-5 text-green-500" />
                      Training in Progress
                    </CardTitle>
                    <CardDescription>
                      Episode: {trainingStatus.currentEpisode.episodeId}
                    </CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => stopTrainingMutation.mutate()}
                    disabled={stopTrainingMutation.isPending}
                    data-testid="button-stop-training"
                  >
                    <StopCircle className="h-4 w-4 mr-1" />
                    Stop
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Started: {new Date(trainingStatus.currentEpisode.startTime).toLocaleTimeString()}
                    </div>
                    <div className="flex items-center gap-1">
                      <Target className="h-3 w-3" />
                      Parameters: {trainingStatus.currentEpisode.parameterUpdates?.length || 0} updates
                    </div>
                  </div>
                  
                  {trainingStatus.currentEpisode.performanceMetrics && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="text-center">
                        <div className="text-lg font-semibold">
                          {(trainingStatus.currentEpisode.performanceMetrics.totalReturn * 100).toFixed(2)}%
                        </div>
                        <div className="text-xs text-muted-foreground">Return</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-semibold">
                          {trainingStatus.currentEpisode.performanceMetrics.sharpeRatio.toFixed(2)}
                        </div>
                        <div className="text-xs text-muted-foreground">Sharpe</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-semibold">
                          {(trainingStatus.currentEpisode.performanceMetrics.winRate * 100).toFixed(1)}%
                        </div>
                        <div className="text-xs text-muted-foreground">Win Rate</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-semibold">
                          {trainingStatus.currentEpisode.performanceMetrics.decisionCount}
                        </div>
                        <div className="text-xs text-muted-foreground">Decisions</div>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Available Scenarios */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {scenarios.map((scenario) => (
              <Card 
                key={scenario.id} 
                className={`cursor-pointer transition-colors ${
                  selectedScenario === scenario.id ? 'ring-2 ring-primary' : ''
                }`}
                onClick={() => setSelectedScenario(scenario.id)}
                data-testid={`card-scenario-${scenario.id}`}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      {getScenarioIcon(scenario.optimizationGoal)}
                      <CardTitle className="text-base">{scenario.name}</CardTitle>
                    </div>
                    <Badge 
                      className={getAggressivenessColor(scenario.config.aggressiveness)}
                      data-testid={`badge-aggressiveness-${scenario.id}`}
                    >
                      {scenario.config.aggressiveness}
                    </Badge>
                  </div>
                  <CardDescription className="text-sm">
                    {scenario.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {scenario.duration}m
                    </div>
                    <div className="flex items-center gap-1">
                      <BarChart3 className="h-3 w-3" />
                      {scenario.config.maxEpisodes} episodes
                    </div>
                    <div className="flex items-center gap-1">
                      <Target className="h-3 w-3" />
                      {scenario.optimizationGoal}
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="text-xs font-medium">Target Parameters:</div>
                    <div className="flex flex-wrap gap-1">
                      {scenario.targetParameters.slice(0, 3).map((param) => (
                        <Badge key={param} variant="outline" className="text-xs">
                          {param}
                        </Badge>
                      ))}
                      {scenario.targetParameters.length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{scenario.targetParameters.length - 3} more
                        </Badge>
                      )}
                    </div>
                  </div>
                  
                  <Button
                    className="w-full"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      startScenarioMutation.mutate(scenario.id);
                    }}
                    disabled={trainingStatus.isTraining || startScenarioMutation.isPending}
                    data-testid={`button-start-${scenario.id}`}
                  >
                    <PlayCircle className="h-4 w-4 mr-1" />
                    Start Training
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Status Tab */}
        <TabsContent value="status" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Training Status */}
            <Card data-testid="card-training-status">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Training Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span>Status:</span>
                    <Badge variant={trainingStatus.isTraining ? "default" : "secondary"}>
                      {trainingStatus.isTraining ? 'Active' : 'Idle'}
                    </Badge>
                  </div>
                  
                  {trainingStatus.currentEpisode && (
                    <>
                      <Separator />
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Episode ID:</span>
                          <span className="font-mono text-xs">
                            {trainingStatus.currentEpisode.episodeId.slice(-8)}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>Parameters Updated:</span>
                          <span>{trainingStatus.currentEpisode.parameterUpdates?.length || 0}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>Duration:</span>
                          <span>
                            {trainingStatus.currentEpisode.startTime ? 
                              Math.floor((Date.now() - new Date(trainingStatus.currentEpisode.startTime).getTime()) / 60000) 
                              : 0}m
                          </span>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Training History */}
            <Card data-testid="card-training-history">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Training History
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-48">
                  {trainingStatus.trainingHistory.length === 0 ? (
                    <div className="text-center text-muted-foreground py-8">
                      No training history yet
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {trainingStatus.trainingHistory.slice(-5).map((episode, index) => (
                        <div key={index} className="flex items-center justify-between p-2 bg-muted rounded">
                          <div className="text-sm">
                            Episode {episode.episodeId?.slice(-6) || 'Unknown'}
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {episode.status || 'completed'}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Configuration Tab */}
        <TabsContent value="config" className="space-y-4">
          <Card data-testid="card-current-config">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings2 className="h-5 w-5" />
                Current Algorithm Configuration
              </CardTitle>
              <CardDescription>
                Live parameters being used by the trading algorithm
              </CardDescription>
            </CardHeader>
            <CardContent>
              {currentConfig ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  <div className="space-y-2">
                    <div className="text-sm font-medium">Risk Management</div>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span>Base Risk:</span>
                        <span className="font-mono">{(currentConfig.baseRiskPct * 100).toFixed(1)}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Cost Cap:</span>
                        <span className="font-mono">{currentConfig.costCapBps} bps</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="text-sm font-medium">Strategy Thresholds</div>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span>Vol Breakout:</span>
                        <span className="font-mono">{currentConfig.volPctBreakout}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Social Go:</span>
                        <span className="font-mono">{currentConfig.socialGo}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="text-sm font-medium">Exit Rules</div>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span>TP Breakout:</span>
                        <span className="font-mono">{currentConfig.tpBreakout} bps</span>
                      </div>
                      <div className="flex justify-between">
                        <span>SL Breakout:</span>
                        <span className="font-mono">{currentConfig.slBreakout} bps</span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  Loading configuration...
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Performance Tab */}
        <TabsContent value="performance" className="space-y-4">
          <Card data-testid="card-performance-metrics">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Algorithm Performance
              </CardTitle>
              <CardDescription>
                Recent decision quality and trading metrics
              </CardDescription>
            </CardHeader>
            <CardContent>
              {performanceData?.data ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <div className="text-center p-4 bg-muted rounded">
                    <div className="text-2xl font-bold">
                      {performanceData.data.algorithmMetrics?.totalDecisions || 0}
                    </div>
                    <div className="text-sm text-muted-foreground">Total Decisions</div>
                  </div>
                  
                  <div className="text-center p-4 bg-muted rounded">
                    <div className="text-2xl font-bold">
                      {performanceData.data.algorithmMetrics?.avgConfidence || 0}%
                    </div>
                    <div className="text-sm text-muted-foreground">Avg Confidence</div>
                  </div>
                  
                  <div className="text-center p-4 bg-muted rounded">
                    <div className="text-2xl font-bold">
                      {performanceData.data.algorithmMetrics?.activeDecisions || 0}
                    </div>
                    <div className="text-sm text-muted-foreground">Active Decisions</div>
                  </div>
                  
                  <div className="text-center p-4 bg-muted rounded">
                    <div className="text-2xl font-bold">
                      {performanceData.data.algorithmMetrics?.avgPositionSize || '0.000'}
                    </div>
                    <div className="text-sm text-muted-foreground">Avg Position Size</div>
                  </div>
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  Loading performance data...
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}