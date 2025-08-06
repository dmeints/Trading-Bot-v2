import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Treemap
} from 'recharts';
import { 
  TrendingUp, 
  TrendingDown, 
  BarChart3, 
  PieChart as PieChartIcon, 
  Brain, 
  Shield, 
  Target,
  Activity,
  AlertTriangle,
  CheckCircle
} from 'lucide-react';

interface RiskMetrics {
  userId: string;
  varDaily: number;
  varWeekly: number;
  maxDrawdown: number;
  sharpeRatio: number;
  sortinoRatio: number;
  beta: number;
  alpha: number;
  diversificationScore: number;
}

interface PerformanceData {
  date: string;
  portfolioValue: number;
  benchmark: number;
  drawdown: number;
  returns: number;
}

interface SentimentData {
  symbol: string;
  source: string;
  sentiment: number;
  confidence: number;
  volume: number;
  timestamp: string;
}

interface MarketRegime {
  symbol: string;
  regime: 'bull' | 'bear' | 'sideways' | 'volatile';
  confidence: number;
  volatility: number;
  trendStrength: number;
}

interface AIModelPerformance {
  agentType: string;
  accuracy: number;
  confidence: number;
  predictions: number;
  successRate: number;
}

export function AdvancedAnalytics() {
  const [activeTab, setActiveTab] = useState('performance');
  const [selectedTimeframe, setSelectedTimeframe] = useState('30d');
  const [selectedSymbol, setSelectedSymbol] = useState('BTC/USD');

  const { data: riskMetrics, isLoading: riskLoading } = useQuery({
    queryKey: ['/api/risk/metrics'],
    refetchInterval: 60000,
  });

  const { data: performanceData, isLoading: performanceLoading } = useQuery({
    queryKey: ['/api/analytics/performance', selectedTimeframe],
    refetchInterval: 30000,
  });

  const { data: sentimentData, isLoading: sentimentLoading } = useQuery({
    queryKey: ['/api/sentiment/analysis', selectedSymbol],
    refetchInterval: 15000,
  });

  const { data: marketRegimes, isLoading: regimesLoading } = useQuery({
    queryKey: ['/api/market/regimes'],
    refetchInterval: 60000,
  });

  const { data: aiPerformance, isLoading: aiLoading } = useQuery({
    queryKey: ['/api/ai/performance'],
    refetchInterval: 120000,
  });

  const { data: correlationData, isLoading: correlationLoading } = useQuery({
    queryKey: ['/api/correlations', selectedSymbol],
    refetchInterval: 300000,
  });

  // Color schemes for charts
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];
  const RISK_COLORS = {
    low: '#10B981',
    medium: '#F59E0B',
    high: '#EF4444',
    critical: '#DC2626'
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatPercentage = (value: number) => {
    return `${(value * 100).toFixed(2)}%`;
  };

  const getRiskLevel = (score: number): string => {
    if (score < 0.25) return 'low';
    if (score < 0.5) return 'medium';
    if (score < 0.75) return 'high';
    return 'critical';
  };

  const getRiskColor = (level: string) => RISK_COLORS[level as keyof typeof RISK_COLORS];

  return (
    <div className="space-y-6" data-testid="advanced-analytics">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Advanced Analytics
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Comprehensive performance and risk analysis
          </p>
        </div>
        <div className="flex items-center space-x-4">
          <Select value={selectedTimeframe} onValueChange={setSelectedTimeframe}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Timeframe" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">7 Days</SelectItem>
              <SelectItem value="30d">30 Days</SelectItem>
              <SelectItem value="90d">90 Days</SelectItem>
              <SelectItem value="1y">1 Year</SelectItem>
            </SelectContent>
          </Select>
          <Select value={selectedSymbol} onValueChange={setSelectedSymbol}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Asset" />
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
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="performance" data-testid="tab-performance">
            <BarChart3 className="h-4 w-4 mr-2" />
            Performance
          </TabsTrigger>
          <TabsTrigger value="risk" data-testid="tab-risk">
            <Shield className="h-4 w-4 mr-2" />
            Risk Analysis
          </TabsTrigger>
          <TabsTrigger value="sentiment" data-testid="tab-sentiment">
            <Activity className="h-4 w-4 mr-2" />
            Sentiment
          </TabsTrigger>
          <TabsTrigger value="regimes" data-testid="tab-regimes">
            <Target className="h-4 w-4 mr-2" />
            Market Regimes
          </TabsTrigger>
          <TabsTrigger value="ai" data-testid="tab-ai">
            <Brain className="h-4 w-4 mr-2" />
            AI Performance
          </TabsTrigger>
          <TabsTrigger value="correlations" data-testid="tab-correlations">
            <PieChartIcon className="h-4 w-4 mr-2" />
            Correlations
          </TabsTrigger>
        </TabsList>

        <TabsContent value="performance" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Portfolio Value</p>
                    <p className="text-2xl font-bold text-green-600">
                      {formatCurrency(performanceData?.current?.portfolioValue || 0)}
                    </p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-green-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Total Return</p>
                    <p className="text-2xl font-bold text-green-600">
                      {formatPercentage(performanceData?.summary?.totalReturn || 0)}
                    </p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-green-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Sharpe Ratio</p>
                    <p className="text-2xl font-bold">
                      {(performanceData?.summary?.sharpeRatio || 0).toFixed(2)}
                    </p>
                  </div>
                  <BarChart3 className="h-8 w-8 text-blue-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Max Drawdown</p>
                    <p className="text-2xl font-bold text-red-600">
                      {formatPercentage(performanceData?.summary?.maxDrawdown || 0)}
                    </p>
                  </div>
                  <TrendingDown className="h-8 w-8 text-red-600" />
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Portfolio Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={performanceData?.timeline || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip 
                      formatter={(value, name) => [
                        name === 'portfolioValue' ? formatCurrency(value as number) : formatPercentage(value as number),
                        name === 'portfolioValue' ? 'Portfolio Value' : 'Benchmark'
                      ]}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="portfolioValue" 
                      stroke="#0088FE" 
                      strokeWidth={2}
                      name="Portfolio Value"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="benchmark" 
                      stroke="#00C49F" 
                      strokeWidth={2}
                      name="Benchmark"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Drawdown Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-60">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={performanceData?.timeline || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip formatter={(value) => [formatPercentage(value as number), 'Drawdown']} />
                    <Area 
                      type="monotone" 
                      dataKey="drawdown" 
                      stroke="#FF8042" 
                      fill="#FF8042" 
                      fillOpacity={0.3}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="risk" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Shield className="h-5 w-5" />
                  <span>Risk Overview</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {riskMetrics && (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Overall Risk Level</span>
                      <Badge 
                        variant="outline" 
                        style={{ 
                          backgroundColor: getRiskColor(getRiskLevel(riskMetrics.overallRisk || 0.5)),
                          color: 'white' 
                        }}
                      >
                        {getRiskLevel(riskMetrics.overallRisk || 0.5).toUpperCase()}
                      </Badge>
                    </div>
                    <Progress 
                      value={(riskMetrics.overallRisk || 0.5) * 100} 
                      className="h-3"
                    />
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Value at Risk (VaR)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm">Daily VaR (95%)</span>
                    <span className="font-medium">{formatPercentage(riskMetrics?.varDaily || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Weekly VaR (95%)</span>
                    <span className="font-medium">{formatPercentage(riskMetrics?.varWeekly || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Beta</span>
                    <span className="font-medium">{(riskMetrics?.beta || 0).toFixed(2)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Portfolio Diversification</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-600">
                    {Math.round((riskMetrics?.diversificationScore || 0) * 100)}%
                  </div>
                  <p className="text-sm text-gray-600 mt-2">Diversification Score</p>
                  <Progress 
                    value={(riskMetrics?.diversificationScore || 0) * 100} 
                    className="mt-4"
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Risk Metrics Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div className="text-center">
                  <div className="text-lg font-semibold">{(riskMetrics?.sharpeRatio || 0).toFixed(2)}</div>
                  <div className="text-sm text-gray-600">Sharpe Ratio</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-semibold">{(riskMetrics?.sortinoRatio || 0).toFixed(2)}</div>
                  <div className="text-sm text-gray-600">Sortino Ratio</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-semibold">{formatPercentage(riskMetrics?.maxDrawdown || 0)}</div>
                  <div className="text-sm text-gray-600">Max Drawdown</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-semibold">{(riskMetrics?.alpha || 0).toFixed(2)}</div>
                  <div className="text-sm text-gray-600">Alpha</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sentiment" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Sentiment Overview for {selectedSymbol}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-60">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={sentimentData?.breakdown || []}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="source" />
                      <YAxis domain={[-1, 1]} />
                      <Tooltip 
                        formatter={(value) => [
                          `${(value as number * 100).toFixed(1)}%`,
                          'Sentiment'
                        ]}
                      />
                      <Bar dataKey="sentiment" fill="#0088FE" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Sentiment Sources</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {sentimentData?.breakdown?.map((item: any, index: number) => (
                    <div key={item.source} className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        />
                        <span className="capitalize">{item.source}</span>
                      </div>
                      <div className="text-right">
                        <div className={`font-medium ${item.sentiment > 0 ? 'text-green-600' : item.sentiment < 0 ? 'text-red-600' : 'text-gray-600'}`}>
                          {item.sentiment > 0 ? '+' : ''}{(item.sentiment * 100).toFixed(1)}%
                        </div>
                        <div className="text-xs text-gray-500">
                          {item.volume} signals
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Overall Market Sentiment</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center">
                <div className="text-4xl font-bold mb-2">
                  <span className={sentimentData?.overallSentiment > 0 ? 'text-green-600' : sentimentData?.overallSentiment < 0 ? 'text-red-600' : 'text-gray-600'}>
                    {sentimentData?.overallSentiment > 0.2 ? 'Bullish' : 
                     sentimentData?.overallSentiment < -0.2 ? 'Bearish' : 'Neutral'}
                  </span>
                </div>
                <div className="text-lg text-gray-600">
                  {(Math.abs(sentimentData?.overallSentiment || 0) * 100).toFixed(1)}% confidence
                </div>
                <Progress 
                  value={Math.abs(sentimentData?.overallSentiment || 0) * 100} 
                  className="mt-4 max-w-xs mx-auto"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="regimes" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {marketRegimes?.map((regime: MarketRegime) => (
              <Card key={regime.symbol}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>{regime.symbol}</span>
                    <Badge 
                      variant={
                        regime.regime === 'bull' ? 'default' :
                        regime.regime === 'bear' ? 'destructive' :
                        regime.regime === 'volatile' ? 'secondary' : 'outline'
                      }
                    >
                      {regime.regime.toUpperCase()}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm">Confidence</span>
                      <span className="font-medium">{(regime.confidence * 100).toFixed(1)}%</span>
                    </div>
                    <Progress value={regime.confidence * 100} className="h-2" />
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm">Volatility</span>
                      <span className="font-medium">{(regime.volatility * 100).toFixed(1)}%</span>
                    </div>
                    <Progress value={regime.volatility * 100} className="h-2" />
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm">Trend Strength</span>
                      <span className="font-medium">{(regime.trendStrength * 100).toFixed(1)}%</span>
                    </div>
                    <Progress value={regime.trendStrength * 100} className="h-2" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="ai" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Brain className="h-5 w-5" />
                <span>AI Agent Performance</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {aiPerformance?.map((agent: AIModelPerformance) => (
                  <div key={agent.agentType} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold capitalize">{agent.agentType.replace('_', ' ')}</h3>
                      <div className="flex items-center space-x-2">
                        {agent.successRate > 0.7 ? (
                          <CheckCircle className="h-5 w-5 text-green-600" />
                        ) : agent.successRate > 0.5 ? (
                          <AlertTriangle className="h-5 w-5 text-yellow-600" />
                        ) : (
                          <AlertTriangle className="h-5 w-5 text-red-600" />
                        )}
                        <span className="text-sm font-medium">
                          {(agent.successRate * 100).toFixed(1)}% Success Rate
                        </span>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <div className="text-gray-600">Accuracy</div>
                        <div className="font-medium">{(agent.accuracy * 100).toFixed(1)}%</div>
                      </div>
                      <div>
                        <div className="text-gray-600">Confidence</div>
                        <div className="font-medium">{(agent.confidence * 100).toFixed(1)}%</div>
                      </div>
                      <div>
                        <div className="text-gray-600">Predictions</div>
                        <div className="font-medium">{agent.predictions}</div>
                      </div>
                    </div>
                    
                    <Progress value={agent.successRate * 100} className="mt-3" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="correlations" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Asset Correlations for {selectedSymbol}</CardTitle>
            </CardHeader>
            <CardContent>
              {correlationLoading ? (
                <div className="animate-pulse space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="h-4 bg-gray-200 rounded"></div>
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  {correlationData?.map((corr: any) => (
                    <div key={`${corr.asset1}-${corr.asset2}`} className="flex items-center justify-between p-3 border rounded">
                      <div>
                        <div className="font-medium">
                          {corr.asset1} / {corr.asset2}
                        </div>
                        <div className="text-sm text-gray-600">
                          {corr.timeframe} timeframe
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`text-lg font-semibold ${
                          corr.correlation > 0.7 ? 'text-red-600' : 
                          corr.correlation > 0.3 ? 'text-yellow-600' : 'text-green-600'
                        }`}>
                          {(corr.correlation * 100).toFixed(1)}%
                        </div>
                        <div className="text-xs text-gray-500">
                          Significance: {(corr.significance * 100).toFixed(1)}%
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}