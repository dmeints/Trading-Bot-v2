import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  TrendingUp, 
  TrendingDown, 
  Bot, 
  Brain, 
  Zap, 
  AlertTriangle, 
  CheckCircle,
  Activity,
  Settings,
  Globe,
  Target,
  Gauge
} from 'lucide-react';

export default function RevolutionaryDashboard() {
  const [optimizationEnabled, setOptimizationEnabled] = useState(false);
  const [automationEnabled, setAutomationEnabled] = useState(false);

  // Fetch revolutionary overview
  const { data: overview, isLoading } = useQuery({
    queryKey: ['/api/revolutionary/dashboard/revolutionary-overview'],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Individual system queries for detailed data
  const { data: confidenceWeights } = useQuery({
    queryKey: ['/api/revolutionary/adaptive-learning/confidence-weights'],
    refetchInterval: 60000,
  });

  const { data: globalRegime } = useQuery({
    queryKey: ['/api/revolutionary/cross-market/current-regime'],
    refetchInterval: 30000,
  });

  const { data: correlationAlerts } = useQuery({
    queryKey: ['/api/revolutionary/data-fusion/correlation-alerts'],
    refetchInterval: 45000,
  });

  const { data: optimizationStatus } = useQuery({
    queryKey: ['/api/revolutionary/real-time-optimization/status'],
    refetchInterval: 15000,
  });

  const handleOptimizationToggle = async () => {
    try {
      const endpoint = optimizationEnabled 
        ? '/api/revolutionary/real-time-optimization/stop'
        : '/api/revolutionary/real-time-optimization/start/current-user';
      
      await fetch(endpoint, { method: 'POST' });
      setOptimizationEnabled(!optimizationEnabled);
    } catch (error) {
      console.error('Failed to toggle optimization:', error);
    }
  };

  const handleAutomationToggle = async () => {
    try {
      const endpoint = automationEnabled 
        ? '/api/revolutionary/intelligent-automation/disable'
        : '/api/revolutionary/intelligent-automation/enable/current-user';
      
      await fetch(endpoint, { method: 'POST' });
      setAutomationEnabled(!automationEnabled);
    } catch (error) {
      console.error('Failed to toggle automation:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="revolutionary-dashboard">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Revolutionary AI Trading System</h1>
          <p className="text-muted-foreground">
            Advanced AI ensemble with cross-market intelligence and quantum analytics
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={handleOptimizationToggle}
            variant={optimizationEnabled ? "destructive" : "default"}
            data-testid="toggle-optimization"
          >
            <Zap className="w-4 h-4 mr-2" />
            {optimizationEnabled ? 'Stop' : 'Start'} Optimization
          </Button>
          <Button
            onClick={handleAutomationToggle}
            variant={automationEnabled ? "destructive" : "default"}
            data-testid="toggle-automation"
          >
            <Bot className="w-4 h-4 mr-2" />
            {automationEnabled ? 'Disable' : 'Enable'} Automation
          </Button>
        </div>
      </div>

      {/* System Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card data-testid="adaptive-learning-status">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Adaptive Learning</CardTitle>
            <Brain className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {overview?.adaptiveLearning?.crossAgentInsights?.length || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Active cross-agent insights
            </p>
          </CardContent>
        </Card>

        <Card data-testid="global-market-status">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Global Market</CardTitle>
            <Globe className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {overview?.globalMarket?.currentRegime?.regimeType || 'Unknown'}
            </div>
            <p className="text-xs text-muted-foreground">
              Current global regime
            </p>
          </CardContent>
        </Card>

        <Card data-testid="automation-status">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Automation</CardTitle>
            <Settings className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {overview?.automation?.status?.active ? 'Active' : 'Inactive'}
            </div>
            <p className="text-xs text-muted-foreground">
              Intelligent automation status
            </p>
          </CardContent>
        </Card>

        <Card data-testid="optimization-status">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Optimization</CardTitle>
            <Target className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {overview?.optimization?.status?.userCount || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Users being optimized
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Dashboard Tabs */}
      <Tabs defaultValue="adaptive-learning" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="adaptive-learning">Adaptive Learning</TabsTrigger>
          <TabsTrigger value="market-intelligence">Market Intelligence</TabsTrigger>
          <TabsTrigger value="automation">Automation</TabsTrigger>
          <TabsTrigger value="quantum-analytics">Quantum Analytics</TabsTrigger>
          <TabsTrigger value="meta-learning">Meta Learning</TabsTrigger>
        </TabsList>

        <TabsContent value="adaptive-learning" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Agent Confidence Weights */}
            <Card data-testid="confidence-weights-card">
              <CardHeader>
                <CardTitle>AI Agent Confidence Weights</CardTitle>
                <CardDescription>
                  Dynamic confidence scores for each specialized AI agent
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {confidenceWeights && Object.entries(confidenceWeights).map(([agent, weight]) => (
                    <div key={agent} className="flex items-center justify-between">
                      <span className="text-sm font-medium capitalize">
                        {agent.replace('_', ' ')}
                      </span>
                      <div className="flex items-center gap-2">
                        <Progress value={Number(weight) * 100} className="w-20" />
                        <span className="text-sm text-muted-foreground">
                          {(Number(weight) * 100).toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Cross-Agent Insights */}
            <Card data-testid="cross-agent-insights-card">
              <CardHeader>
                <CardTitle>Cross-Agent Insights</CardTitle>
                <CardDescription>
                  Recent knowledge sharing between AI agents
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-64">
                  <div className="space-y-2">
                    {overview?.adaptiveLearning?.crossAgentInsights?.map((insight: any, index: number) => (
                      <div key={index} className="p-2 border rounded-lg">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className="text-xs">
                            {insight.sourceAgent} → {insight.targetAgent}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {(insight.confidence * 100).toFixed(0)}% confidence
                          </span>
                        </div>
                        <p className="text-sm">{insight.insight}</p>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="market-intelligence" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Global Market Regime */}
            <Card data-testid="global-regime-card">
              <CardHeader>
                <CardTitle>Global Market Regime</CardTitle>
                <CardDescription>
                  Cross-market analysis and regime detection
                </CardDescription>
              </CardHeader>
              <CardContent>
                {globalRegime ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-lg font-semibold">
                        {globalRegime.regimeType?.toUpperCase()}
                      </span>
                      <Badge 
                        variant={globalRegime.confidence > 0.7 ? "default" : "secondary"}
                        data-testid="regime-confidence"
                      >
                        {(globalRegime.confidence * 100).toFixed(0)}% confidence
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Primary Market:</span>
                        <p className="font-medium">{globalRegime.primaryMarket}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">VIX Level:</span>
                        <p className="font-medium">{globalRegime.indicators?.vix?.toFixed(1)}</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-muted-foreground">Loading global regime data...</p>
                )}
              </CardContent>
            </Card>

            {/* Correlation Alerts */}
            <Card data-testid="correlation-alerts-card">
              <CardHeader>
                <CardTitle>Correlation Risk Alerts</CardTitle>
                <CardDescription>
                  High-risk correlation breakdowns detected
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-64">
                  <div className="space-y-2">
                    {correlationAlerts?.length > 0 ? (
                      correlationAlerts.map((alert: any, index: number) => (
                        <Alert key={index} className={`
                          ${alert.riskLevel === 'critical' ? 'border-red-500' : ''}
                          ${alert.riskLevel === 'high' ? 'border-orange-500' : ''}
                          ${alert.riskLevel === 'medium' ? 'border-yellow-500' : ''}
                        `}>
                          <AlertTriangle className="h-4 w-4" />
                          <AlertDescription>
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-medium">
                                {alert.asset1} ↔ {alert.asset2}
                              </span>
                              <Badge variant={
                                alert.riskLevel === 'critical' ? 'destructive' :
                                alert.riskLevel === 'high' ? 'default' : 'secondary'
                              }>
                                {alert.riskLevel}
                              </Badge>
                            </div>
                            <p className="text-sm">{alert.recommendedAction}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Correlation: {(alert.correlation * 100).toFixed(1)}%
                            </p>
                          </AlertDescription>
                        </Alert>
                      ))
                    ) : (
                      <p className="text-muted-foreground text-center py-8">
                        No correlation alerts detected
                      </p>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="automation" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Automation Status */}
            <Card data-testid="automation-details-card">
              <CardHeader>
                <CardTitle>Intelligent Automation Status</CardTitle>
                <CardDescription>
                  Real-time portfolio optimization and strategy switching
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span>Auto-Rebalancing</span>
                    <Badge variant={overview?.automation?.status?.active ? "default" : "secondary"}>
                      {overview?.automation?.status?.active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Dynamic Position Sizing</span>
                    <Badge variant="default">Enabled</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Strategy Monitoring</span>
                    <Badge variant="default">Active</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Recent Strategy Switches */}
            <Card data-testid="strategy-switches-card">
              <CardHeader>
                <CardTitle>Recent Strategy Switches</CardTitle>
                <CardDescription>
                  Automatic strategy adaptations by the AI system
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-64">
                  <div className="space-y-2">
                    {overview?.automation?.recentSwitches?.length > 0 ? (
                      overview.automation.recentSwitches.map((switchEvent: any, index: number) => (
                        <div key={index} className="p-2 border rounded-lg">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium">
                              {switchEvent.fromStrategy} → {switchEvent.toStrategy}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {new Date(switchEvent.timestamp).toLocaleDateString()}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Reason: {switchEvent.reason}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-xs">
                              {(switchEvent.confidence * 100).toFixed(0)}% confidence
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              +{(switchEvent.expectedImprovement * 100).toFixed(1)}% expected
                            </Badge>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-muted-foreground text-center py-8">
                        No recent strategy switches
                      </p>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="quantum-analytics" className="space-y-4">
          <Card data-testid="quantum-analytics-card">
            <CardHeader>
              <CardTitle>Quantum Analytics Suite</CardTitle>
              <CardDescription>
                Multi-dimensional risk analysis and uncertainty quantification
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-4 border rounded-lg">
                  <Gauge className="h-8 w-8 mx-auto mb-2 text-blue-600" />
                  <h3 className="font-semibold">Risk Dimensions</h3>
                  <p className="text-2xl font-bold">5</p>
                  <p className="text-xs text-muted-foreground">Active analysis vectors</p>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <Activity className="h-8 w-8 mx-auto mb-2 text-green-600" />
                  <h3 className="font-semibold">Quantum Coherence</h3>
                  <p className="text-2xl font-bold">78%</p>
                  <p className="text-xs text-muted-foreground">Portfolio alignment</p>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <TrendingUp className="h-8 w-8 mx-auto mb-2 text-purple-600" />
                  <h3 className="font-semibold">Uncertainty</h3>
                  <p className="text-2xl font-bold">23%</p>
                  <p className="text-xs text-muted-foreground">Total uncertainty level</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="meta-learning" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Learning Patterns */}
            <Card data-testid="learning-patterns-card">
              <CardHeader>
                <CardTitle>Meta-Learning Patterns</CardTitle>
                <CardDescription>
                  System-wide learning adaptation patterns
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {overview?.metaLearning?.patterns?.map((pattern: any, index: number) => (
                    <div key={index} className="p-2 border rounded-lg">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium capitalize">
                          {pattern.patternId?.replace(/_/g, ' ')}
                        </span>
                        <Badge variant="outline">
                          {(pattern.confidence * 100).toFixed(0)}% confidence
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Market: {pattern.marketCondition} | Speed: {(pattern.adaptationSpeed * 100).toFixed(0)}%
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Predictive Strategies */}
            <Card data-testid="predictive-strategies-card">
              <CardHeader>
                <CardTitle>Predictive Strategies</CardTitle>
                <CardDescription>
                  AI-generated strategies for future market conditions
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {overview?.metaLearning?.predictiveStrategies?.map((strategy: any, index: number) => (
                    <div key={index} className="p-2 border rounded-lg">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium">
                          {strategy.strategyId}
                        </span>
                        <Badge variant="outline">
                          {(strategy.readinessScore * 100).toFixed(0)}% ready
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Target: {strategy.targetMarketCondition} | 
                        Expected: +{(strategy.expectedPerformance * 100).toFixed(1)}%
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