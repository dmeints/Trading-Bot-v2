/**
 * Phase K - Performance Attribution Dashboard
 */

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { TrendingUp, TrendingDown, BarChart3, PieChart, Activity, AlertTriangle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";

interface FactorAttribution {
  factor: string;
  contribution: number;
  weight: number;
  description: string;
}

interface StrategyComponent {
  component: string;
  returns: number;
  sharpeRatio: number;
  maxDrawdown: number;
  winRate: number;
  avgTrade: number;
  tradeCount: number;
  rank?: number;
  riskAdjustedReturn?: number;
  efficiency?: number;
  consistency?: number;
}

interface RiskMetrics {
  volatility: number;
  var95: number;
  expectedShortfall: number;
  calmarRatio: number;
}

export default function PerformanceAttribution() {
  const [selectedPeriod, setSelectedPeriod] = useState('30d');
  const [benchmarkSymbol, setBenchmarkSymbol] = useState('BTCUSDT');
  const [analysisType, setAnalysisType] = useState('comprehensive');

  // Calculate date range based on selected period
  const getDateRange = (period: string) => {
    const endDate = new Date();
    const startDate = new Date();
    
    switch (period) {
      case '7d':
        startDate.setDate(endDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(endDate.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(endDate.getDate() - 90);
        break;
      case '1y':
        startDate.setFullYear(endDate.getFullYear() - 1);
        break;
    }

    return {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString()
    };
  };

  // Fetch comprehensive performance attribution
  const { data: attributionData, isLoading: attributionLoading } = useQuery({
    queryKey: ['/api/attribution/analyze', selectedPeriod, benchmarkSymbol],
    queryFn: async () => {
      const { startDate, endDate } = getDateRange(selectedPeriod);
      const response = await fetch(
        `/api/attribution/analyze?startDate=${startDate}&endDate=${endDate}&benchmarkSymbol=${benchmarkSymbol}`
      );
      if (!response.ok) throw new Error('Attribution analysis failed');
      return response.json();
    },
    refetchInterval: 300000, // Refresh every 5 minutes
  });

  // Fetch factor analysis
  const { data: factorData, isLoading: factorLoading } = useQuery({
    queryKey: ['/api/attribution/factors', selectedPeriod],
    queryFn: async () => {
      const response = await fetch(`/api/attribution/factors?period=${selectedPeriod}`);
      if (!response.ok) throw new Error('Factor analysis failed');
      return response.json();
    }
  });

  // Fetch component analysis
  const { data: componentData, isLoading: componentLoading } = useQuery({
    queryKey: ['/api/attribution/components', selectedPeriod],
    queryFn: async () => {
      const { startDate, endDate } = getDateRange(selectedPeriod);
      const response = await fetch(
        `/api/attribution/components?startDate=${startDate}&endDate=${endDate}`
      );
      if (!response.ok) throw new Error('Component analysis failed');
      return response.json();
    }
  });

  // Fetch risk decomposition
  const { data: riskData, isLoading: riskLoading } = useQuery({
    queryKey: ['/api/attribution/risk-decomposition', selectedPeriod, benchmarkSymbol],
    queryFn: async () => {
      const { startDate, endDate } = getDateRange(selectedPeriod);
      const response = await fetch(
        `/api/attribution/risk-decomposition?startDate=${startDate}&endDate=${endDate}&benchmarkSymbol=${benchmarkSymbol}`
      );
      if (!response.ok) throw new Error('Risk decomposition failed');
      return response.json();
    }
  });

  const formatPercentage = (value: number) => `${(value * 100).toFixed(2)}%`;
  const formatNumber = (value: number, decimals = 2) => value.toFixed(decimals);

  const getReturnColor = (value: number) => {
    if (value > 0) return "text-green-600";
    if (value < 0) return "text-red-600";
    return "text-gray-600";
  };

  const getRiskLevel = (volatility: number) => {
    if (volatility > 0.3) return { level: "High", color: "bg-red-500" };
    if (volatility > 0.15) return { level: "Medium", color: "bg-yellow-500" };
    return { level: "Low", color: "bg-green-500" };
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Phase K - Performance Attribution</h1>
          <p className="text-muted-foreground mt-2">
            Advanced strategy analysis, factor attribution, and performance decomposition
          </p>
        </div>
        <Badge variant="outline" className="bg-purple-50">
          Phase K: Live
        </Badge>
      </div>

      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Analysis Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Time Period</label>
              <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7d">7 Days</SelectItem>
                  <SelectItem value="30d">30 Days</SelectItem>
                  <SelectItem value="90d">90 Days</SelectItem>
                  <SelectItem value="1y">1 Year</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Benchmark</label>
              <Select value={benchmarkSymbol} onValueChange={setBenchmarkSymbol}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BTCUSDT">Bitcoin (BTC)</SelectItem>
                  <SelectItem value="ETHUSDT">Ethereum (ETH)</SelectItem>
                  <SelectItem value="TOTAL">Total Market</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Analysis Type</label>
              <Select value={analysisType} onValueChange={setAnalysisType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="comprehensive">Comprehensive</SelectItem>
                  <SelectItem value="factors">Factor Focus</SelectItem>
                  <SelectItem value="risk">Risk Analysis</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="factors">Factor Attribution</TabsTrigger>
          <TabsTrigger value="components">Strategy Components</TabsTrigger>
          <TabsTrigger value="risk">Risk Decomposition</TabsTrigger>
          <TabsTrigger value="time-series">Time Series</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Performance Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Performance Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {attributionLoading ? (
                  <div className="space-y-2">
                    <div className="h-4 bg-gray-200 rounded animate-pulse" />
                    <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4" />
                  </div>
                ) : attributionData?.success && (
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Total Return</span>
                      <span className={`text-lg font-bold ${getReturnColor(attributionData.analysis.totalReturn)}`}>
                        {formatPercentage(attributionData.analysis.totalReturn)}
                      </span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Benchmark Return</span>
                      <span className={`text-sm ${getReturnColor(attributionData.analysis.benchmarkReturn)}`}>
                        {formatPercentage(attributionData.analysis.benchmarkReturn)}
                      </span>
                    </div>

                    <Separator />

                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Alpha</span>
                      <span className={`text-sm font-bold ${getReturnColor(attributionData.analysis.alpha)}`}>
                        {formatPercentage(attributionData.analysis.alpha)}
                      </span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Beta</span>
                      <span className="text-sm font-mono">
                        {formatNumber(attributionData.analysis.beta)}
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Risk Metrics */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Risk Profile
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {attributionLoading ? (
                  <div className="space-y-2">
                    <div className="h-4 bg-gray-200 rounded animate-pulse" />
                    <div className="h-4 bg-gray-200 rounded animate-pulse w-2/3" />
                  </div>
                ) : attributionData?.success && (
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Volatility</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm">
                          {formatPercentage(attributionData.analysis.riskMetrics.volatility)}
                        </span>
                        <div className={`w-3 h-3 rounded-full ${getRiskLevel(attributionData.analysis.riskMetrics.volatility).color}`} />
                      </div>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">VaR (95%)</span>
                      <span className="text-sm text-red-600">
                        {formatPercentage(attributionData.analysis.riskMetrics.var95)}
                      </span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Max Drawdown</span>
                      <span className="text-sm text-red-600">
                        {formatPercentage(Math.max(...(attributionData.analysis.componentAnalysis?.map((c: StrategyComponent) => Math.abs(c.maxDrawdown)) || [0])))}
                      </span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Calmar Ratio</span>
                      <span className="text-sm font-mono">
                        {formatNumber(attributionData.analysis.riskMetrics.calmarRatio)}
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Top Factors */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChart className="h-5 w-5" />
                  Top Factors
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {factorLoading ? (
                  <div className="space-y-2">
                    <div className="h-4 bg-gray-200 rounded animate-pulse" />
                    <div className="h-4 bg-gray-200 rounded animate-pulse w-4/5" />
                  </div>
                ) : factorData?.success && (
                  factorData.factors.slice(0, 4).map((factor: FactorAttribution, index: number) => (
                    <div key={factor.factor} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${index === 0 ? 'bg-blue-500' : index === 1 ? 'bg-green-500' : index === 2 ? 'bg-yellow-500' : 'bg-purple-500'}`} />
                        <span className="text-sm font-medium">{factor.factor}</span>
                      </div>
                      <span className={`text-sm ${getReturnColor(factor.contribution)}`}>
                        {formatPercentage(factor.contribution)}
                      </span>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Factor Attribution Tab */}
        <TabsContent value="factors">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Factor Contributions</CardTitle>
                <CardDescription>Individual factor impact on portfolio returns</CardDescription>
              </CardHeader>
              <CardContent>
                {factorLoading ? (
                  <div className="space-y-4">
                    {[1, 2, 3, 4, 5].map(i => (
                      <div key={i} className="space-y-2">
                        <div className="h-4 bg-gray-200 rounded animate-pulse" />
                        <div className="h-2 bg-gray-200 rounded animate-pulse" />
                      </div>
                    ))}
                  </div>
                ) : factorData?.success && (
                  <div className="space-y-4">
                    {factorData.factors.map((factor: FactorAttribution) => (
                      <div key={factor.factor} className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="font-medium">{factor.factor}</span>
                          <span className={`text-sm font-bold ${getReturnColor(factor.contribution)}`}>
                            {formatPercentage(factor.contribution)}
                          </span>
                        </div>
                        <Progress 
                          value={Math.abs(factor.contribution) * 1000} 
                          className="h-2"
                        />
                        <p className="text-xs text-muted-foreground">{factor.description}</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Factor Summary</CardTitle>
                <CardDescription>Diversification and concentration metrics</CardDescription>
              </CardHeader>
              <CardContent>
                {factorData?.success && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center p-4 bg-blue-50 rounded-lg">
                        <div className="text-2xl font-bold text-blue-600">
                          {formatPercentage(factorData.summary.totalContribution)}
                        </div>
                        <div className="text-sm text-muted-foreground">Total Contribution</div>
                      </div>
                      
                      <div className="text-center p-4 bg-green-50 rounded-lg">
                        <div className="text-2xl font-bold text-green-600">
                          {formatNumber(factorData.summary.diversificationRatio)}
                        </div>
                        <div className="text-sm text-muted-foreground">Diversification</div>
                      </div>
                    </div>

                    <div className="p-4 bg-yellow-50 rounded-lg">
                      <div className="font-medium text-yellow-800">Dominant Factor</div>
                      <div className="text-sm text-yellow-700">
                        {factorData.summary.dominantFactor.factor}: {formatPercentage(factorData.summary.dominantFactor.contribution)}
                      </div>
                    </div>

                    <div className="text-xs text-muted-foreground">
                      Period: {factorData.period.days} days
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Strategy Components Tab */}
        <TabsContent value="components">
          <Card>
            <CardHeader>
              <CardTitle>Strategy Component Analysis</CardTitle>
              <CardDescription>Performance breakdown by individual strategy components</CardDescription>
            </CardHeader>
            <CardContent>
              {componentLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-20 bg-gray-200 rounded animate-pulse" />
                  ))}
                </div>
              ) : componentData?.success && (
                <div className="space-y-4">
                  {componentData.components.map((component: StrategyComponent) => (
                    <div key={component.component} className="border rounded-lg p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h4 className="font-semibold">{component.component}</h4>
                          <Badge variant="outline" className="text-xs">
                            Rank #{component.rank}
                          </Badge>
                        </div>
                        <div className="text-right">
                          <div className={`text-lg font-bold ${getReturnColor(component.returns)}`}>
                            {formatPercentage(component.returns)}
                          </div>
                          <div className="text-sm text-muted-foreground">Total Return</div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <div className="font-medium">Sharpe Ratio</div>
                          <div>{formatNumber(component.sharpeRatio)}</div>
                        </div>
                        <div>
                          <div className="font-medium">Win Rate</div>
                          <div>{formatPercentage(component.winRate)}</div>
                        </div>
                        <div>
                          <div className="font-medium">Max Drawdown</div>
                          <div className="text-red-600">{formatPercentage(Math.abs(component.maxDrawdown))}</div>
                        </div>
                        <div>
                          <div className="font-medium">Trades</div>
                          <div>{component.tradeCount}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Risk Decomposition Tab */}
        <TabsContent value="risk">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Risk Budget Allocation</CardTitle>
                <CardDescription>Systematic vs specific risk breakdown</CardDescription>
              </CardHeader>
              <CardContent>
                {riskLoading ? (
                  <div className="space-y-4">
                    <div className="h-4 bg-gray-200 rounded animate-pulse" />
                    <div className="h-20 bg-gray-200 rounded animate-pulse" />
                  </div>
                ) : riskData?.success && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span>Systematic Risk</span>
                        <span>{formatNumber(riskData.riskBudget.systematic)}%</span>
                      </div>
                      <Progress value={riskData.riskBudget.systematic} className="h-2" />
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span>Specific Risk</span>
                        <span>{formatNumber(riskData.riskBudget.specific)}%</span>
                      </div>
                      <Progress value={riskData.riskBudget.specific} className="h-2" />
                    </div>

                    <Separator />

                    <div className="space-y-2">
                      <h5 className="font-medium">Factor Risk Breakdown</h5>
                      {riskData.riskBudget.factorBreakdown.map((factor: any) => (
                        <div key={factor.factor} className="flex justify-between text-sm">
                          <span>{factor.factor}</span>
                          <span>{formatNumber(factor.allocation)}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  Risk Recommendations
                </CardTitle>
              </CardHeader>
              <CardContent>
                {riskData?.success && (
                  <div className="space-y-3">
                    {riskData.recommendations.map((rec: string, index: number) => (
                      <div key={index} className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                        <p className="text-sm text-blue-800">{rec}</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Time Series Tab */}
        <TabsContent value="time-series">
          <Card>
            <CardHeader>
              <CardTitle>Performance Time Series</CardTitle>
              <CardDescription>Historical performance and risk metrics over time</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <BarChart3 className="h-12 w-12 mx-auto mb-4" />
                <p>Time series visualization will be implemented with a charting library</p>
                <p className="text-sm mt-2">Chart data available via /api/attribution/time-series endpoint</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}