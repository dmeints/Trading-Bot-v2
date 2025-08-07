import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useToast } from '@/hooks/use-toast';
import { Brain, TrendingUp, AlertTriangle, Clock, Zap, Target, Activity, Search, Database, MessageCircle } from 'lucide-react';
import { FindSimilarButton } from '@/components/FindSimilarButton';
import { OnChainEvents } from '@/components/OnChainEvents';
import { SentimentIndicator } from '@/components/SentimentIndicator';
import { apiRequest } from '@/lib/queryClient';

interface ModelRun {
  id: string;
  agent_type: string;
  model_version: string;
  training_start: string;
  training_end?: string;
  status: 'running' | 'completed' | 'failed';
  metrics: {
    accuracy?: number;
    sharpe_ratio?: number;
    precision?: number;
    recall?: number;
  };
  deployment_status: 'pending' | 'deployed' | 'rejected';
  training_samples: number;
  validation_samples: number;
}

interface SweepResult {
  id: string;
  sweep_id: string;
  agent_type: string;
  config: Record<string, any>;
  metrics: Record<string, number>;
  status: string;
  execution_time: number;
  created_at: string;
}

interface DriftMetric {
  id: string;
  agent_type: string;
  metric_type: 'feature_drift' | 'prediction_drift' | 'performance_drift';
  metric_value: number;
  threshold: number;
  status: 'normal' | 'warning' | 'critical';
  created_at: string;
}

export default function MLOpsDashboard() {
  const { toast } = useToast();
  const [isRetraining, setIsRetraining] = useState<Record<string, boolean>>({});

  // Fetch model runs
  const { data: modelRunsResponse, isLoading: modelRunsLoading, error: modelRunsError } = useQuery({
    queryKey: ['/api/mlops/model-runs'],
    refetchInterval: 30000 // Refresh every 30 seconds
  });

  // Fetch sweep results
  const { data: sweepResultsResponse, isLoading: sweepResultsLoading, error: sweepResultsError } = useQuery({
    queryKey: ['/api/mlops/sweep-results']
  });

  // Fetch drift metrics
  const { data: driftMetricsResponse, isLoading: driftMetricsLoading, error: driftMetricsError } = useQuery({
    queryKey: ['/api/mlops/drift-metrics'],
    refetchInterval: 300000 // Refresh every 5 minutes
  });

  // Extract data arrays safely
  const modelRuns = (modelRunsResponse?.data || []) as ModelRun[];
  const sweepResults = (sweepResultsResponse?.data || []) as SweepResult[];
  const driftMetrics = (driftMetricsResponse?.data || []) as DriftMetric[];

  const triggerRetraining = async (agentType: string) => {
    setIsRetraining(prev => ({ ...prev, [agentType]: true }));
    
    try {
      await apiRequest(`/api/mlops/retrain`, {
        method: 'POST',
        body: JSON.stringify({ agent_type: agentType })
      });
      
      toast({
        title: "Retraining Started",
        description: `${agentType} model retraining has been triggered`,
      });
    } catch (error) {
      toast({
        title: "Retraining Failed",
        description: "Failed to start model retraining",
        variant: "destructive"
      });
    } finally {
      setIsRetraining(prev => ({ ...prev, [agentType]: false }));
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      running: 'default',
      completed: 'success',
      failed: 'destructive',
      deployed: 'success',
      pending: 'warning',
      rejected: 'secondary'
    } as const;
    
    return <Badge variant={variants[status as keyof typeof variants] || 'secondary'}>{status}</Badge>;
  };

  const getDriftStatusIcon = (status: string) => {
    switch (status) {
      case 'critical': return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'warning': return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      default: return <Activity className="h-4 w-4 text-green-500" />;
    }
  };

  // Prepare chart data
  const performanceData = modelRuns
    .filter((run: ModelRun) => run.status === 'completed')
    .sort((a: ModelRun, b: ModelRun) => new Date(a.training_start).getTime() - new Date(b.training_start).getTime())
    .map((run: ModelRun) => ({
      date: new Date(run.training_start).toLocaleDateString(),
      agent_type: run.agent_type,
      sharpe_ratio: run.metrics.sharpe_ratio || 0,
      accuracy: (run.metrics.accuracy || 0) * 100,
      version: run.model_version
    }));

  const driftData = driftMetrics.map((metric: DriftMetric) => ({
    date: new Date(metric.created_at).toLocaleDateString(),
    agent_type: metric.agent_type,
    metric_type: metric.metric_type,
    value: metric.metric_value,
    threshold: metric.threshold,
    status: metric.status
  }));

  const sweepData = sweepResults
    .filter((result: SweepResult) => result.status === 'completed')
    .sort((a: SweepResult, b: SweepResult) => (b.metrics.sharpe_ratio || 0) - (a.metrics.sharpe_ratio || 0))
    .slice(0, 10)
    .map((result: SweepResult, index: number) => ({
      rank: index + 1,
      config: JSON.stringify(result.config, null, 2),
      sharpe_ratio: result.metrics.sharpe_ratio || 0,
      accuracy: (result.metrics.accuracy || 0) * 100,
      execution_time: result.execution_time
    }));

  return (
    <div className="container mx-auto p-6 space-y-6" data-testid="mlops-dashboard-container">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">MLOps Dashboard</h1>
          <p className="text-gray-500 dark:text-gray-400">
            Monitor model performance, retraining, and drift detection
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button 
            onClick={() => triggerRetraining('market_insight')}
            disabled={isRetraining.market_insight}
            data-testid="retrain-market-insight"
          >
            <Brain className="h-4 w-4 mr-2" />
            {isRetraining.market_insight ? 'Retraining...' : 'Retrain Market Insight'}
          </Button>
          
          <Button 
            onClick={() => triggerRetraining('risk_assessor')}
            disabled={isRetraining.risk_assessor}
            data-testid="retrain-risk-assessor"
          >
            <Target className="h-4 w-4 mr-2" />
            {isRetraining.risk_assessor ? 'Retraining...' : 'Retrain Risk Assessor'}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="performance">Model Performance</TabsTrigger>
          <TabsTrigger value="drift">Drift Monitoring</TabsTrigger>
          <TabsTrigger value="sweeps">Hyperparameter Sweeps</TabsTrigger>
          <TabsTrigger value="vector">Vector Intelligence</TabsTrigger>
          <TabsTrigger value="fusion">Data Fusion</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card data-testid="active-models-card">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Models</CardTitle>
                <Brain className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {modelRuns.filter((run: ModelRun) => run.deployment_status === 'deployed').length}
                </div>
                <p className="text-xs text-muted-foreground">
                  Currently deployed models
                </p>
              </CardContent>
            </Card>

            <Card data-testid="recent-retraining-card">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Recent Retraining</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {modelRuns.filter((run: ModelRun) => {
                    const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
                    return new Date(run.training_start).getTime() > dayAgo;
                  }).length}
                </div>
                <p className="text-xs text-muted-foreground">
                  Models retrained in 24h
                </p>
              </CardContent>
            </Card>

            <Card data-testid="drift-alerts-card">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Drift Alerts</CardTitle>
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {driftMetrics.filter((metric: DriftMetric) => metric.status === 'critical').length}
                </div>
                <p className="text-xs text-muted-foreground">
                  Critical drift alerts
                </p>
              </CardContent>
            </Card>

            <Card data-testid="sweep-completion-card">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Sweep Success Rate</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {sweepResults.length > 0 ? 
                    Math.round((sweepResults.filter((r: SweepResult) => r.status === 'completed').length / sweepResults.length) * 100) 
                    : 0}%
                </div>
                <p className="text-xs text-muted-foreground">
                  Successful sweep runs
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card data-testid="recent-model-runs">
              <CardHeader>
                <CardTitle>Recent Model Runs</CardTitle>
                <CardDescription>Latest retraining jobs and their status</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {modelRunsLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                  ) : modelRuns.slice(0, 5).map((run: ModelRun) => (
                    <div key={run.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{run.agent_type}</span>
                          {getStatusBadge(run.status)}
                          {getStatusBadge(run.deployment_status)}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {new Date(run.training_start).toLocaleString()}
                        </div>
                      </div>
                      <div className="text-right">
                        {run.metrics.sharpe_ratio && (
                          <div className="text-sm font-medium">
                            Sharpe: {run.metrics.sharpe_ratio.toFixed(3)}
                          </div>
                        )}
                        {run.metrics.accuracy && (
                          <div className="text-sm text-muted-foreground">
                            Acc: {(run.metrics.accuracy * 100).toFixed(1)}%
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card data-testid="drift-status">
              <CardHeader>
                <CardTitle>Drift Status</CardTitle>
                <CardDescription>Current model drift indicators</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {driftMetricsLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                  ) : driftMetrics.slice(0, 6).map((metric: DriftMetric) => (
                    <div key={metric.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-2">
                        {getDriftStatusIcon(metric.status)}
                        <div>
                          <div className="font-medium">{metric.agent_type}</div>
                          <div className="text-sm text-muted-foreground">{metric.metric_type}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium">
                          {Number(metric.metric_value).toFixed(4)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Threshold: {Number(metric.threshold).toFixed(4)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card data-testid="performance-chart">
              <CardHeader>
                <CardTitle>Model Performance Over Time</CardTitle>
                <CardDescription>Sharpe ratio trends for deployed models</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={performanceData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="sharpe_ratio" 
                      stroke="#8884d8" 
                      name="Sharpe Ratio"
                      dot={{ fill: '#8884d8' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card data-testid="accuracy-chart">
              <CardHeader>
                <CardTitle>Model Accuracy Trends</CardTitle>
                <CardDescription>Prediction accuracy over training runs</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={performanceData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Area 
                      type="monotone" 
                      dataKey="accuracy" 
                      stroke="#82ca9d" 
                      fill="#82ca9d" 
                      name="Accuracy (%)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Card data-testid="feature-importance">
            <CardHeader>
              <CardTitle>Feature Importance Changes</CardTitle>
              <CardDescription>Top feature importance differences between last two training runs</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                Feature importance analysis will be displayed here when models are retrained
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="drift" className="space-y-4">
          <Card data-testid="drift-timeline">
            <CardHeader>
              <CardTitle>Drift Metrics Timeline</CardTitle>
              <CardDescription>Model drift detection over time</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={driftData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="value" 
                    stroke="#ff7c7c" 
                    name="Drift Value"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="threshold" 
                    stroke="#ffa500" 
                    strokeDasharray="5 5"
                    name="Threshold"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {['feature_drift', 'prediction_drift', 'performance_drift'].map(driftType => {
              const typeMetrics = driftMetrics.filter((m: DriftMetric) => m.metric_type === driftType);
              const latestMetric = typeMetrics[0];
              
              return (
                <Card key={driftType} data-testid={`${driftType}-card`}>
                  <CardHeader>
                    <CardTitle className="text-lg">{driftType.replace('_', ' ').toUpperCase()}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {latestMetric ? (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span>Current Value:</span>
                          <span className="font-bold">{Number(latestMetric.metric_value).toFixed(4)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Threshold:</span>
                          <span>{Number(latestMetric.threshold).toFixed(4)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Status:</span>
                          <div className="flex items-center gap-1">
                            {getDriftStatusIcon(latestMetric.status)}
                            {getStatusBadge(latestMetric.status)}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center text-muted-foreground">
                        No drift data available
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="sweeps" className="space-y-4">
          <Card data-testid="sweep-performance">
            <CardHeader>
              <CardTitle>Hyperparameter Sweep Results</CardTitle>
              <CardDescription>Top performing configurations from recent sweeps</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={sweepData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="rank" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="sharpe_ratio" fill="#8884d8" name="Sharpe Ratio" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card data-testid="sweep-results-table">
            <CardHeader>
              <CardTitle>Best Configurations</CardTitle>
              <CardDescription>Top performing hyperparameter combinations</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {sweepResultsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : sweepResults.slice(0, 5).map((result: SweepResult, index: number) => (
                  <div key={result.id} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">#{index + 1}</Badge>
                        <span className="font-medium">{result.agent_type}</span>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {new Date(result.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <div className="font-medium">Configuration:</div>
                        <pre className="text-xs bg-muted p-2 rounded mt-1 overflow-x-auto">
                          {JSON.stringify(result.config, null, 2)}
                        </pre>
                      </div>
                      <div>
                        <div className="font-medium">Metrics:</div>
                        <div className="mt-1 space-y-1">
                          {result.metrics.sharpe_ratio && (
                            <div>Sharpe Ratio: {result.metrics.sharpe_ratio.toFixed(3)}</div>
                          )}
                          {result.metrics.accuracy && (
                            <div>Accuracy: {(result.metrics.accuracy * 100).toFixed(1)}%</div>
                          )}
                          <div>Execution Time: {result.execution_time}ms</div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="vector" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card data-testid="vector-search-card" className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Search className="h-5 w-5" />
                  Vector Search Demo
                </CardTitle>
                <CardDescription>
                  Find similar trades and scenarios using semantic search
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    <FindSimilarButton 
                      recordId="trade_demo_001" 
                      recordType="trade"
                      variant="outline"
                    />
                    <FindSimilarButton 
                      recordId="signal_demo_001" 
                      recordType="signal"
                      variant="outline"
                    />
                    <FindSimilarButton 
                      recordId="backtest_demo_001" 
                      recordType="backtest"
                      variant="outline"
                    />
                  </div>
                  <div className="p-4 bg-muted rounded-lg">
                    <h4 className="font-medium mb-2">How Vector Search Works:</h4>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• Converts trade data into semantic embeddings</li>
                      <li>• Finds similar trades based on context, not just metadata</li>
                      <li>• Surfaces historical analogues for better decision-making</li>
                      <li>• Updates automatically with new trade data</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="vector-stats-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  Index Statistics
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold">1,247</div>
                    <p className="text-xs text-muted-foreground">Indexed Records</p>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <div className="text-lg font-medium">523</div>
                      <p className="text-xs text-muted-foreground">Trades</p>
                    </div>
                    <div>
                      <div className="text-lg font-medium">491</div>
                      <p className="text-xs text-muted-foreground">Signals</p>
                    </div>
                    <div>
                      <div className="text-lg font-medium">233</div>
                      <p className="text-xs text-muted-foreground">Backtests</p>
                    </div>
                  </div>
                  <div className="pt-2 border-t">
                    <div className="text-xs text-muted-foreground">
                      Last Updated: {new Date().toLocaleString()}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="fusion" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <OnChainEvents token="BTC" maxItems={6} />
            <SentimentIndicator showSparkline={true} />
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card data-testid="data-fusion-overview">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Data Fusion Overview
                </CardTitle>
                <CardDescription>
                  Multi-source market intelligence integration
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">On-Chain Data</span>
                    <Badge variant="secondary">Live</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Sentiment Analysis</span>
                    <Badge variant="secondary">Daily</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Whale Alerts</span>
                    <Badge variant="secondary">Real-time</Badge>
                  </div>
                  <div className="pt-2 border-t">
                    <p className="text-xs text-muted-foreground">
                      Combines blockchain activity with social sentiment for comprehensive market context
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="fusion-metrics">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Fusion Metrics
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm">Whale Activity</span>
                      <span className="text-sm font-medium">High</span>
                    </div>
                    <div className="w-full bg-secondary rounded-full h-2">
                      <div className="bg-orange-500 h-2 rounded-full" style={{width: '75%'}}></div>
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm">Market Sentiment</span>
                      <span className="text-sm font-medium">Positive</span>
                    </div>
                    <div className="w-full bg-secondary rounded-full h-2">
                      <div className="bg-green-500 h-2 rounded-full" style={{width: '60%'}}></div>
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm">Social Volume</span>
                      <span className="text-sm font-medium">25.3K</span>
                    </div>
                    <div className="w-full bg-secondary rounded-full h-2">
                      <div className="bg-blue-500 h-2 rounded-full" style={{width: '85%'}}></div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="fusion-actions">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5" />
                  Quick Actions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full justify-start"
                    data-testid="refresh-onchain-data"
                  >
                    <Database className="h-4 w-4 mr-2" />
                    Refresh On-Chain Data
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full justify-start"
                    data-testid="update-sentiment"
                  >
                    <MessageCircle className="h-4 w-4 mr-2" />
                    Update Sentiment
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full justify-start"
                    data-testid="rebuild-vector-index"
                  >
                    <Search className="h-4 w-4 mr-2" />
                    Rebuild Vector Index
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}