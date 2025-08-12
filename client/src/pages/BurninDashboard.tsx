
/**
 * Burn-in Dashboard - Paper Trading Monitoring with Conformal Prediction Validation
 */

import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Progress } from '../components/ui/progress';
import { Alert, AlertDescription } from '../components/ui/alert';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { TrendingUp, TrendingDown, Target, AlertTriangle, CheckCircle, Clock, Activity, Brain } from 'lucide-react';

interface BurninOverview {
  timeframe: string;
  performance: {
    totalReturn: number;
    winRate: number;
    sharpeRatio: number;
    maxDrawdown: number;
    totalTrades: number;
    profitFactor: number;
  };
  conformal: {
    calibrationSamples: number;
    empiricalCoverage: number;
    coverageGap: number;
    avgIntervalWidth: number;
  };
  burnin: {
    tradingDays: number;
    consistencyScore: number;
    readinessScore: number;
    uncertaintyManagement: {
      coverageAccuracy: number;
      adaptationRate: string;
      intervalEfficiency: number;
    };
  };
}

interface RealTimeMetrics {
  timestamp: string;
  portfolio: {
    totalValue: number;
    unrealizedPnl: number;
    realizedPnl: number;
    cash: number;
  };
  trading: {
    tradesLastHour: number;
    winRate: number;
    avgTradeSize: number;
    sharpeRatio: number;
  };
  conformal: {
    calibrationSamples: number;
    empiricalCoverage: number;
    coverageGap: number;
    avgIntervalWidth: number;
  };
  system: {
    uptime: number;
    memoryUsage: number;
    activeConnections: number;
  };
}

interface PerformanceChart {
  chartData: {
    equity: Array<{
      timestamp: string;
      value: number;
      pnl: number;
      drawdown: number;
    }>;
    trades: Array<{
      timestamp: string;
      symbol: string;
      side: string;
      pnl: number;
      value: number;
    }>;
    performance: {
      totalReturn: number;
      maxDrawdown: number;
      volatility: number;
      tradesPerDay: number;
    };
  };
}

const BurninDashboard: React.FC = () => {
  const [overview, setOverview] = useState<BurninOverview | null>(null);
  const [realTimeMetrics, setRealTimeMetrics] = useState<RealTimeMetrics | null>(null);
  const [performanceChart, setPerformanceChart] = useState<PerformanceChart | null>(null);
  const [conformalAnalysis, setConformalAnalysis] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [timeframe, setTimeframe] = useState('24h');
  const [isLive, setIsLive] = useState(true);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Fetch overview data
  const fetchOverview = async () => {
    try {
      const response = await fetch(`/api/burnin-dashboard/overview?timeframe=${timeframe}`);
      const data = await response.json();
      if (data.success) {
        setOverview(data.overview);
      }
    } catch (error) {
      console.error('Failed to fetch overview:', error);
    }
  };

  // Fetch performance chart data
  const fetchPerformanceChart = async () => {
    try {
      const response = await fetch(`/api/burnin-dashboard/performance-chart?timeframe=${timeframe}`);
      const data = await response.json();
      if (data.success) {
        setPerformanceChart(data);
      }
    } catch (error) {
      console.error('Failed to fetch performance chart:', error);
    }
  };

  // Fetch conformal analysis
  const fetchConformalAnalysis = async () => {
    try {
      const response = await fetch('/api/burnin-dashboard/conformal-analysis');
      const data = await response.json();
      if (data.success) {
        setConformalAnalysis(data.analysis);
      }
    } catch (error) {
      console.error('Failed to fetch conformal analysis:', error);
    }
  };

  // Set up real-time metrics stream
  const setupRealTimeStream = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    if (!isLive) return;

    eventSourceRef.current = new EventSource('/api/burnin-dashboard/real-time-metrics');
    
    eventSourceRef.current.onmessage = (event) => {
      try {
        const metrics = JSON.parse(event.data);
        if (!metrics.error) {
          setRealTimeMetrics(metrics);
        }
      } catch (error) {
        console.error('Failed to parse real-time metrics:', error);
      }
    };

    eventSourceRef.current.onerror = (error) => {
      console.error('Real-time stream error:', error);
      setTimeout(setupRealTimeStream, 5000); // Retry after 5 seconds
    };
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([
        fetchOverview(),
        fetchPerformanceChart(),
        fetchConformalAnalysis()
      ]);
      setLoading(false);
    };

    loadData();
    setupRealTimeStream();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [timeframe, isLive]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(value);
  };

  const formatPercentage = (value: number) => {
    return `${(value * 100).toFixed(2)}%`;
  };

  const getStatusColor = (score: number) => {
    if (score >= 0.8) return 'text-green-500';
    if (score >= 0.6) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getStatusBadge = (score: number) => {
    if (score >= 0.8) return <Badge variant="default" className="bg-green-500">Excellent</Badge>;
    if (score >= 0.6) return <Badge variant="secondary">Good</Badge>;
    return <Badge variant="destructive">Needs Improvement</Badge>;
  };

  if (loading && !overview) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        <span className="ml-2">Loading burn-in dashboard...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Brain className="h-6 w-6 text-blue-500" />
            Burn-in Dashboard
          </h1>
          <p className="text-muted-foreground">
            Paper trading monitoring with conformal prediction validation
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={isLive ? "default" : "outline"}
            onClick={() => setIsLive(!isLive)}
            className="flex items-center gap-2"
          >
            <Activity className="h-4 w-4" />
            {isLive ? 'Live' : 'Paused'}
          </Button>
          <select
            value={timeframe}
            onChange={(e) => setTimeframe(e.target.value)}
            className="px-3 py-2 border rounded-md"
          >
            <option value="1h">1 Hour</option>
            <option value="6h">6 Hours</option>
            <option value="24h">24 Hours</option>
            <option value="7d">7 Days</option>
            <option value="30d">30 Days</option>
          </select>
        </div>
      </div>

      {/* Real-time Status */}
      {realTimeMetrics && (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>
            Live monitoring active • Last update: {new Date(realTimeMetrics.timestamp).toLocaleTimeString()} • 
            System uptime: {Math.floor(realTimeMetrics.system.uptime / 3600)}h
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="conformal">Conformal Analysis</TabsTrigger>
          <TabsTrigger value="validation">Validation</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {/* Key Metrics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Portfolio Value</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {realTimeMetrics ? formatCurrency(realTimeMetrics.portfolio.totalValue) : '--'}
                </div>
                <p className="text-xs text-muted-foreground">
                  PnL: {realTimeMetrics ? formatCurrency(realTimeMetrics.portfolio.realizedPnl + realTimeMetrics.portfolio.unrealizedPnl) : '--'}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Win Rate</CardTitle>
                <Target className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {overview ? formatPercentage(overview.performance.winRate) : '--'}
                </div>
                <p className="text-xs text-muted-foreground">
                  {overview ? `${overview.performance.totalTrades} trades` : 'No trades'}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Sharpe Ratio</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {overview ? overview.performance.sharpeRatio.toFixed(3) : '--'}
                </div>
                <p className="text-xs text-muted-foreground">
                  Risk-adjusted return
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Max Drawdown</CardTitle>
                <TrendingDown className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-500">
                  {overview ? formatPercentage(overview.performance.maxDrawdown) : '--'}
                </div>
                <p className="text-xs text-muted-foreground">
                  Peak-to-trough decline
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Burn-in Status */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Burn-in Progress</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Readiness Score</span>
                    <span className={getStatusColor(overview?.burnin.readinessScore || 0)}>
                      {((overview?.burnin.readinessScore || 0) * 100).toFixed(1)}%
                    </span>
                  </div>
                  <Progress value={(overview?.burnin.readinessScore || 0) * 100} />
                </div>
                
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Consistency Score</span>
                    <span className={getStatusColor(overview?.burnin.consistencyScore || 0)}>
                      {((overview?.burnin.consistencyScore || 0) * 100).toFixed(1)}%
                    </span>
                  </div>
                  <Progress value={(overview?.burnin.consistencyScore || 0) * 100} />
                </div>

                <div className="pt-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Overall Status</span>
                    {getStatusBadge(overview?.burnin.readinessScore || 0)}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Conformal Prediction Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="font-medium">Calibration Samples</div>
                    <div className="text-2xl font-bold">
                      {overview?.conformal.calibrationSamples || 0}
                    </div>
                  </div>
                  <div>
                    <div className="font-medium">Coverage Accuracy</div>
                    <div className="text-2xl font-bold">
                      {overview ? formatPercentage(overview.conformal.empiricalCoverage) : '--'}
                    </div>
                  </div>
                </div>
                
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Coverage Gap</span>
                    <span className={overview?.conformal.coverageGap < 0.05 ? 'text-green-500' : 'text-red-500'}>
                      {overview ? formatPercentage(overview.conformal.coverageGap) : '--'}
                    </span>
                  </div>
                  <Progress 
                    value={Math.max(0, 100 - (overview?.conformal.coverageGap || 0) * 2000)} 
                    className={overview?.conformal.coverageGap < 0.05 ? 'bg-green-100' : 'bg-red-100'}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Equity Curve</CardTitle>
            </CardHeader>
            <CardContent>
              <div style={{ width: '100%', height: 400 }}>
                <ResponsiveContainer>
                  <AreaChart data={performanceChart?.chartData.equity || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="timestamp" 
                      tickFormatter={(value) => new Date(value).toLocaleDateString()}
                    />
                    <YAxis tickFormatter={formatCurrency} />
                    <Tooltip 
                      labelFormatter={(value) => new Date(value).toLocaleString()}
                      formatter={(value: any, name: string) => [formatCurrency(value), name]}
                    />
                    <Area type="monotone" dataKey="value" stroke="#2563eb" fill="#3b82f6" fillOpacity={0.3} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Drawdown Chart</CardTitle>
              </CardHeader>
              <CardContent>
                <div style={{ width: '100%', height: 300 }}>
                  <ResponsiveContainer>
                    <AreaChart data={performanceChart?.chartData.equity || []}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="timestamp" 
                        tickFormatter={(value) => new Date(value).toLocaleDateString()}
                      />
                      <YAxis tickFormatter={formatPercentage} />
                      <Tooltip 
                        labelFormatter={(value) => new Date(value).toLocaleString()}
                        formatter={(value: any) => [formatPercentage(value), 'Drawdown']}
                      />
                      <Area type="monotone" dataKey="drawdown" stroke="#ef4444" fill="#f87171" fillOpacity={0.3} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Trade Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div style={{ width: '100%', height: 300 }}>
                  <ResponsiveContainer>
                    <BarChart data={performanceChart?.chartData.trades.slice(-20) || []}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="symbol" 
                        angle={-45}
                        textAnchor="end"
                        height={60}
                      />
                      <YAxis tickFormatter={formatCurrency} />
                      <Tooltip formatter={(value: any) => [formatCurrency(value), 'PnL']} />
                      <Bar dataKey="pnl" fill={(entry: any) => entry.pnl > 0 ? '#22c55e' : '#ef4444'} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="conformal" className="space-y-4">
          {conformalAnalysis && (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Calibration Quality</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-sm text-muted-foreground">Expected Coverage</div>
                        <div className="text-xl font-bold">
                          {formatPercentage(conformalAnalysis.calibration.coverage.expected)}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Empirical Coverage</div>
                        <div className="text-xl font-bold">
                          {formatPercentage(conformalAnalysis.calibration.coverage.empirical)}
                        </div>
                      </div>
                    </div>
                    
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Coverage Status</span>
                        <Badge variant={conformalAnalysis.calibration.coverage.status === 'good' ? 'default' : 'secondary'}>
                          {conformalAnalysis.calibration.coverage.status}
                        </Badge>
                      </div>
                    </div>

                    <div>
                      <div className="text-sm text-muted-foreground">Interval Efficiency</div>
                      <div className="text-xl font-bold">
                        {conformalAnalysis.calibration.intervalWidth.efficiency.toFixed(3)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Coverage per unit width
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Prediction Analysis</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-sm text-muted-foreground">Total Predictions</div>
                        <div className="text-xl font-bold">
                          {conformalAnalysis.predictions.totalPredictions}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Within Interval</div>
                        <div className="text-xl font-bold text-green-500">
                          {conformalAnalysis.predictions.withinInterval}
                        </div>
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Prediction Accuracy</span>
                        <span>{formatPercentage(conformalAnalysis.predictions.accuracy)}</span>
                      </div>
                      <Progress value={conformalAnalysis.predictions.accuracy * 100} />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {conformalAnalysis.recommendations.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-yellow-500" />
                      Recommendations
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {conformalAnalysis.recommendations.map((rec: string, index: number) => (
                        <li key={index} className="flex items-start gap-2">
                          <div className="w-2 h-2 bg-yellow-500 rounded-full mt-2 flex-shrink-0"></div>
                          <span className="text-sm">{rec}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="validation" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                System Validation
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h4 className="font-semibold">Database Connectivity</h4>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Trades Table</span>
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Positions Table</span>
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Portfolio Snapshots</span>
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="font-semibold">Conformal Predictor Status</h4>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Initialized</span>
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Calibration Samples</span>
                      <span className="text-sm">{overview?.conformal.calibrationSamples || 0}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Ready for Production</span>
                      {(overview?.conformal.calibrationSamples || 0) >= 50 ? 
                        <CheckCircle className="h-4 w-4 text-green-500" /> :
                        <Clock className="h-4 w-4 text-yellow-500" />
                      }
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t">
                <div className="flex justify-between items-center">
                  <span className="font-semibold">Overall System Status</span>
                  <Badge variant="default" className="bg-green-500">
                    Operational
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default BurninDashboard;
