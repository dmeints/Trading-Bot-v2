/**
 * Phase A - External Connectors & Schemas Demo Page
 * Comprehensive demonstration of all 8 external data sources integration
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { 
  Activity, 
  TrendingUp, 
  Database, 
  Zap, 
  Heart, 
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  BarChart3,
  LineChart,
  PieChart,
  DollarSign,
  Users,
  Globe,
  Calendar
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface ConnectorHealth {
  provider: string;
  status: 'healthy' | 'degraded' | 'down';
  requestCount: number;
  errorCount: number;
  configured: boolean;
}

interface DataSummary {
  marketData: Array<{
    symbol: string;
    hasData: boolean;
    latest: any;
  }>;
  orderbook: Array<{
    symbol: string;
    hasData: boolean;
    latest: any;
  }>;
  sentiment: Array<{
    symbol: string;
    count: number;
    latest: any;
  }>;
  onchain: Array<{
    chain: string;
    count: number;
    latest: any;
  }>;
  macroEvents: number;
}

interface HealthResponse {
  health: ConnectorHealth[];
  stats?: any;
  lastUpdate?: string;
}

interface SummaryResponse {
  summary: DataSummary;
  health?: ConnectorHealth[];
  lastUpdated: string;
}

const CONNECTOR_INFO = {
  coingecko: { name: 'CoinGecko Pro', type: 'Market Data', icon: BarChart3, color: 'text-green-600' },
  binance: { name: 'Binance', type: 'Real-time Trading', icon: LineChart, color: 'text-yellow-600' },
  twitter: { name: 'X (Twitter)', type: 'Social Sentiment', icon: Users, color: 'text-blue-600' },
  reddit: { name: 'Reddit', type: 'Community Sentiment', icon: Users, color: 'text-orange-600' },
  etherscan: { name: 'Etherscan', type: 'On-chain (ETH)', icon: Database, color: 'text-purple-600' },
  blockchair: { name: 'Blockchair', type: 'On-chain (BTC)', icon: Database, color: 'text-amber-600' },
  cryptopanic: { name: 'CryptoPanic', type: 'News Sentiment', icon: Globe, color: 'text-red-600' },
  tradingeconomics: { name: 'Trading Economics', type: 'Macro Events', icon: Calendar, color: 'text-indigo-600' },
};

export default function ConnectorsDemo() {
  const [activeTab, setActiveTab] = useState('overview');
  const queryClient = useQueryClient();

  // Fetch connector health status
  const { data: healthData, isLoading: healthLoading } = useQuery<HealthResponse>({
    queryKey: ['/api/connectors-phase-a/health'],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch comprehensive data summary
  const { data: summaryData, isLoading: summaryLoading } = useQuery<SummaryResponse>({
    queryKey: ['/api/connectors-phase-a/summary'],
    refetchInterval: 60000, // Refresh every minute
  });

  // Start data ingestion mutation
  const startIngestionMutation = useMutation({
    mutationFn: (config?: any) => apiRequest('/api/connectors-phase-a/ingestion/start', 'POST', config),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/connectors-phase-a/health'] });
    },
  });

  // Stop data ingestion mutation
  const stopIngestionMutation = useMutation({
    mutationFn: () => apiRequest('/api/connectors-phase-a/ingestion/stop', 'POST'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/connectors-phase-a/health'] });
    },
  });

  // Manual data fetch mutation
  const fetchDataMutation = useMutation({
    mutationFn: () => apiRequest('/api/connectors-phase-a/fetch-all', 'POST'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/connectors-phase-a/summary'] });
    },
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'degraded': return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      case 'down': return <XCircle className="h-4 w-4 text-red-600" />;
      default: return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'bg-green-100 text-green-800';
      case 'degraded': return 'bg-yellow-100 text-yellow-800';
      case 'down': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const calculateHealthPercentage = (health?: ConnectorHealth[]) => {
    if (!health?.length) return 0;
    const healthyCount = health.filter((h: ConnectorHealth) => h.status === 'healthy').length;
    return (healthyCount / health.length) * 100;
  };

  return (
    <div className="container mx-auto p-6 space-y-6" data-testid="connectors-demo">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight" data-testid="page-title">
          Phase A - External Connectors & Schemas
        </h1>
        <p className="text-muted-foreground" data-testid="page-description">
          Comprehensive integration with 8 external data sources for real-time market analysis, sentiment tracking, and on-chain metrics
        </p>
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-2">
        <Button
          onClick={() => startIngestionMutation.mutate()}
          disabled={startIngestionMutation.isPending}
          data-testid="button-start-ingestion"
        >
          <Activity className="mr-2 h-4 w-4" />
          {startIngestionMutation.isPending ? 'Starting...' : 'Start Data Ingestion'}
        </Button>
        <Button
          variant="outline"
          onClick={() => stopIngestionMutation.mutate()}
          disabled={stopIngestionMutation.isPending}
          data-testid="button-stop-ingestion"
        >
          <XCircle className="mr-2 h-4 w-4" />
          {stopIngestionMutation.isPending ? 'Stopping...' : 'Stop Ingestion'}
        </Button>
        <Button
          variant="secondary"
          onClick={() => fetchDataMutation.mutate()}
          disabled={fetchDataMutation.isPending}
          data-testid="button-manual-fetch"
        >
          <Zap className="mr-2 h-4 w-4" />
          {fetchDataMutation.isPending ? 'Fetching...' : 'Manual Fetch'}
        </Button>
      </div>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="health" data-testid="tab-health">Health Status</TabsTrigger>
          <TabsTrigger value="data" data-testid="tab-data">Data Summary</TabsTrigger>
          <TabsTrigger value="testing" data-testid="tab-testing">Integration Test</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* System Health Overview */}
            <Card data-testid="card-system-health">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">System Health</CardTitle>
                <Heart className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-health-percentage">
                  {healthLoading ? (
                    <Skeleton className="h-8 w-16" />
                  ) : (
                    `${Math.round(calculateHealthPercentage(healthData?.health || []))}%`
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {healthData?.health?.length || 0} connectors monitored
                </p>
                {!healthLoading && healthData?.health && (
                  <Progress 
                    value={calculateHealthPercentage(healthData.health)} 
                    className="mt-2" 
                  />
                )}
              </CardContent>
            </Card>

            {/* Active Connectors */}
            <Card data-testid="card-active-connectors">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Connectors</CardTitle>
                <Database className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-active-count">
                  {healthLoading ? (
                    <Skeleton className="h-8 w-8" />
                  ) : (
                    healthData?.health?.filter(h => h.status === 'healthy').length || 0
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  of {Object.keys(CONNECTOR_INFO).length} total sources
                </p>
              </CardContent>
            </Card>

            {/* Data Points Collected */}
            <Card data-testid="card-data-points">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Data Points</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-data-count">
                  {summaryLoading ? (
                    <Skeleton className="h-8 w-16" />
                  ) : (
                    summaryData?.summary ? 
                      Object.values(summaryData.summary).reduce((sum: number, val: any) => {
                        if (Array.isArray(val)) return sum + val.length;
                        return sum + (typeof val === 'number' ? val : 0);
                      }, 0) : 0
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  across all data sources
                </p>
              </CardContent>
            </Card>

            {/* Last Update */}
            <Card data-testid="card-last-update">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Last Update</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-last-update">
                  {summaryLoading ? (
                    <Skeleton className="h-8 w-16" />
                  ) : (
                    summaryData?.lastUpdated ? 
                      new Date(summaryData.lastUpdated).toLocaleTimeString() : 
                      'Never'
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {summaryData?.lastUpdated ? 
                    `${Math.round((Date.now() - new Date(summaryData.lastUpdated).getTime()) / 60000)}m ago` :
                    'No recent data'
                  }
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Connector Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {Object.entries(CONNECTOR_INFO).map(([key, info]) => {
              const health = healthData?.health?.find(h => h.provider === key);
              const Icon = info.icon;
              
              return (
                <Card key={key} data-testid={`card-connector-${key}`}>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">{info.name}</CardTitle>
                    <Icon className={`h-4 w-4 ${info.color}`} />
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">{info.type}</span>
                      {health ? (
                        <Badge 
                          variant="secondary" 
                          className={getStatusColor(health.status)}
                          data-testid={`status-${key}`}
                        >
                          {getStatusIcon(health.status)}
                          <span className="ml-1">{health.status}</span>
                        </Badge>
                      ) : (
                        <Skeleton className="h-5 w-16" />
                      )}
                    </div>
                    {health && (
                      <div className="text-xs text-muted-foreground space-y-1">
                        <div>Requests: {health.requestCount}</div>
                        <div>Errors: {health.errorCount}</div>
                        <div>Configured: {health.configured ? 'Yes' : 'No'}</div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* Health Status Tab */}
        <TabsContent value="health" className="space-y-4">
          <Card data-testid="card-health-details">
            <CardHeader>
              <CardTitle>Connector Health Details</CardTitle>
              <CardDescription>
                Real-time status monitoring for all external data sources
              </CardDescription>
            </CardHeader>
            <CardContent>
              {healthLoading ? (
                <div className="space-y-3">
                  {[...Array(8)].map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  {healthData?.health?.map((health: ConnectorHealth) => {
                    const info = CONNECTOR_INFO[health.provider as keyof typeof CONNECTOR_INFO];
                    const Icon = info?.icon || Database;
                    
                    return (
                      <div 
                        key={health.provider} 
                        className="flex items-center justify-between p-4 border rounded-lg"
                        data-testid={`health-row-${health.provider}`}
                      >
                        <div className="flex items-center space-x-3">
                          <Icon className={`h-5 w-5 ${info?.color || 'text-gray-500'}`} />
                          <div>
                            <div className="font-medium">{info?.name || health.provider}</div>
                            <div className="text-sm text-muted-foreground">{info?.type || 'Data Source'}</div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-4">
                          <div className="text-right text-sm">
                            <div>{health.requestCount} requests</div>
                            <div className="text-muted-foreground">{health.errorCount} errors</div>
                          </div>
                          <Badge 
                            variant="secondary" 
                            className={getStatusColor(health.status)}
                            data-testid={`badge-status-${health.provider}`}
                          >
                            {getStatusIcon(health.status)}
                            <span className="ml-1">{health.status}</span>
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Data Summary Tab */}
        <TabsContent value="data" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Market Data */}
            <Card data-testid="card-market-data-summary">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <DollarSign className="mr-2 h-5 w-5" />
                  Market Data
                </CardTitle>
              </CardHeader>
              <CardContent>
                {summaryLoading ? (
                  <div className="space-y-2">
                    {[...Array(3)].map((_, i) => (
                      <Skeleton key={i} className="h-6 w-full" />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {summaryData?.summary?.marketData?.map((item: any, i: number) => (
                      <div key={i} className="flex justify-between items-center">
                        <span>{item.symbol}</span>
                        <Badge variant={item.hasData ? "default" : "secondary"}>
                          {item.hasData ? "Active" : "No Data"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Sentiment Data */}
            <Card data-testid="card-sentiment-summary">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Users className="mr-2 h-5 w-5" />
                  Sentiment Analysis
                </CardTitle>
              </CardHeader>
              <CardContent>
                {summaryLoading ? (
                  <div className="space-y-2">
                    {[...Array(3)].map((_, i) => (
                      <Skeleton key={i} className="h-6 w-full" />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {summaryData?.summary?.sentiment?.map((item: any, i: number) => (
                      <div key={i} className="flex justify-between items-center">
                        <span>{item.symbol}</span>
                        <Badge variant={item.count > 0 ? "default" : "secondary"}>
                          {item.count} points
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Integration Test Tab */}
        <TabsContent value="testing" className="space-y-4">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              This tab demonstrates live integration testing with all 8 external connectors. 
              Click "Manual Fetch" to trigger a comprehensive data collection test.
            </AlertDescription>
          </Alert>

          {fetchDataMutation.isPending && (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center space-y-4">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
                  <p>Running comprehensive integration test...</p>
                  <p className="text-sm text-muted-foreground">
                    Testing all 8 external connectors simultaneously
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {fetchDataMutation.isSuccess && (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                Integration test completed successfully! Check the data summary above for results.
              </AlertDescription>
            </Alert>
          )}

          {fetchDataMutation.isError && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertDescription>
                Integration test failed. Please check connector health and try again.
              </AlertDescription>
            </Alert>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}