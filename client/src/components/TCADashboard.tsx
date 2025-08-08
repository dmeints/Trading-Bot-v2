/**
 * TCA (Transaction Cost Analysis) Dashboard
 * UI panel for per-symbol slippage, fill probability, adverse selection, venue win-rate
 */

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, LineChart, Line, ResponsiveContainer } from 'recharts';
import { Download, RefreshCw, TrendingUp, TrendingDown, Activity } from 'lucide-react';

interface TCAMetrics {
  symbol: string;
  totalTrades: number;
  avgSlippage: number;
  fillProbability: number;
  adverseSelection: number;
  venueBreakdown: {
    [venue: string]: {
      trades: number;
      winRate: number;
      avgSlippage: number;
      avgLatency: number;
    };
  };
  timeSeriesData: Array<{
    timestamp: number;
    slippage: number;
    fillProb: number;
    latency: number;
  }>;
}

interface TCADashboardData {
  symbols: string[];
  metrics: { [symbol: string]: TCAMetrics };
  summary: {
    totalTrades: number;
    avgSlippage: number;
    bestVenue: string;
    worstSlippage: number;
  };
}

export function TCADashboard() {
  const [selectedSymbol, setSelectedSymbol] = useState<string>('BTC');
  const [timeRange, setTimeRange] = useState<string>('24h');
  
  const { data: tcaData, isLoading, refetch } = useQuery<TCADashboardData>({
    queryKey: ['/api/tca/dashboard', selectedSymbol, timeRange],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const handleExportCSV = async () => {
    try {
      const response = await fetch(`/api/tca/export?symbol=${selectedSymbol}&timeRange=${timeRange}`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `tca_analysis_${selectedSymbol}_${timeRange}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const symbolMetrics = tcaData?.metrics[selectedSymbol];
  const venueData = symbolMetrics?.venueBreakdown ? Object.entries(symbolMetrics.venueBreakdown) : [];

  return (
    <div className="space-y-6 p-6" data-testid="tca-dashboard">
      {/* Header Controls */}
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <h1 className="text-2xl font-bold" data-testid="tca-title">Transaction Cost Analysis</h1>
          <Badge variant="outline" data-testid="status-badge">Live</Badge>
        </div>
        
        <div className="flex items-center space-x-2">
          <Select value={selectedSymbol} onValueChange={setSelectedSymbol}>
            <SelectTrigger className="w-32" data-testid="symbol-selector">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {tcaData?.symbols.map(symbol => (
                <SelectItem key={symbol} value={symbol}>{symbol}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-24" data-testid="timerange-selector">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1h">1H</SelectItem>
              <SelectItem value="24h">24H</SelectItem>
              <SelectItem value="7d">7D</SelectItem>
              <SelectItem value="30d">30D</SelectItem>
            </SelectContent>
          </Select>
          
          <Button variant="outline" size="sm" onClick={() => refetch()} data-testid="refresh-button">
            <RefreshCw className="h-4 w-4" />
          </Button>
          
          <Button variant="outline" size="sm" onClick={handleExportCSV} data-testid="export-button">
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card data-testid="card-total-trades">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Trades</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="total-trades-value">
              {symbolMetrics?.totalTrades.toLocaleString() || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {timeRange} period
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-avg-slippage">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Slippage</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="avg-slippage-value">
              {symbolMetrics?.avgSlippage ? `${(symbolMetrics.avgSlippage * 10000).toFixed(1)}bp` : '0bp'}
            </div>
            <p className="text-xs text-muted-foreground">
              Lower is better
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-fill-probability">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Fill Probability</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="fill-probability-value">
              {symbolMetrics?.fillProbability ? `${(symbolMetrics.fillProbability * 100).toFixed(1)}%` : '0%'}
            </div>
            <Progress 
              value={symbolMetrics?.fillProbability ? symbolMetrics.fillProbability * 100 : 0} 
              className="mt-2"
              data-testid="fill-probability-progress"
            />
          </CardContent>
        </Card>

        <Card data-testid="card-adverse-selection">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Adverse Selection</CardTitle>
            <TrendingDown className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="adverse-selection-value">
              {symbolMetrics?.adverseSelection ? `${(symbolMetrics.adverseSelection * 10000).toFixed(1)}bp` : '0bp'}
            </div>
            <p className="text-xs text-muted-foreground">
              Market impact cost
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Venue Performance */}
        <Card data-testid="venue-performance-card">
          <CardHeader>
            <CardTitle>Venue Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {venueData.map(([venue, metrics]) => (
                <div key={venue} className="border rounded-lg p-4" data-testid={`venue-${venue.toLowerCase()}`}>
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="font-semibold">{venue}</h3>
                    <Badge variant={metrics.winRate > 0.6 ? "success" : "secondary"}>
                      {(metrics.winRate * 100).toFixed(1)}% Win Rate
                    </Badge>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Trades</p>
                      <p className="font-medium" data-testid={`${venue.toLowerCase()}-trades`}>
                        {metrics.trades.toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Avg Slippage</p>
                      <p className="font-medium" data-testid={`${venue.toLowerCase()}-slippage`}>
                        {(metrics.avgSlippage * 10000).toFixed(1)}bp
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Avg Latency</p>
                      <p className="font-medium" data-testid={`${venue.toLowerCase()}-latency`}>
                        {metrics.avgLatency.toFixed(0)}ms
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Slippage Comparison Chart */}
        <Card data-testid="slippage-chart-card">
          <CardHeader>
            <CardTitle>Venue Slippage Comparison</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={venueData.map(([venue, metrics]) => ({
                venue,
                slippage: metrics.avgSlippage * 10000,
                winRate: metrics.winRate * 100
              }))}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="venue" />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip />
                <Legend />
                <Bar yAxisId="left" dataKey="slippage" fill="#8884d8" name="Slippage (bp)" />
                <Bar yAxisId="right" dataKey="winRate" fill="#82ca9d" name="Win Rate %" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Time Series Analysis */}
      <Card data-testid="timeseries-chart-card">
        <CardHeader>
          <CardTitle>Execution Quality Over Time</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={symbolMetrics?.timeSeriesData || []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="timestamp"
                tickFormatter={(value) => new Date(value).toLocaleTimeString()}
              />
              <YAxis yAxisId="left" />
              <YAxis yAxisId="right" orientation="right" />
              <Tooltip 
                labelFormatter={(value) => new Date(value).toLocaleString()}
                formatter={(value: any, name: string) => [
                  name === 'slippage' ? `${(value * 10000).toFixed(1)}bp` :
                  name === 'fillProb' ? `${(value * 100).toFixed(1)}%` :
                  `${value.toFixed(0)}ms`,
                  name
                ]}
              />
              <Legend />
              <Line 
                yAxisId="left" 
                type="monotone" 
                dataKey="slippage" 
                stroke="#8884d8" 
                name="Slippage"
                strokeWidth={2}
              />
              <Line 
                yAxisId="right" 
                type="monotone" 
                dataKey="fillProb" 
                stroke="#82ca9d" 
                name="Fill Probability"
                strokeWidth={2}
              />
              <Line 
                yAxisId="right" 
                type="monotone" 
                dataKey="latency" 
                stroke="#ffc658" 
                name="Latency (ms)"
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Summary Stats */}
      {tcaData?.summary && (
        <Card data-testid="summary-stats-card">
          <CardHeader>
            <CardTitle>Portfolio Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Total Trades</p>
                <p className="text-2xl font-bold" data-testid="summary-total-trades">
                  {tcaData.summary.totalTrades.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Overall Slippage</p>
                <p className="text-2xl font-bold" data-testid="summary-avg-slippage">
                  {(tcaData.summary.avgSlippage * 10000).toFixed(1)}bp
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Best Venue</p>
                <p className="text-2xl font-bold" data-testid="summary-best-venue">
                  {tcaData.summary.bestVenue}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Worst Slippage</p>
                <p className="text-2xl font-bold text-red-600" data-testid="summary-worst-slippage">
                  {(tcaData.summary.worstSlippage * 10000).toFixed(1)}bp
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default TCADashboard;