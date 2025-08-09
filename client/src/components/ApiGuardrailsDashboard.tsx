import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Shield, AlertTriangle, Activity, Database, Clock, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { XApiMonitor } from './XApiMonitor';

interface ApiStats {
  used: number;
  limit: number;
  remaining: number;
  resetTime: number;
  utilizationPercent: number;
  status: 'safe' | 'warning' | 'critical';
}

interface AllApiStats {
  apis: {
    x: {
      usage: any;
      cache: any;
      limits: any;
      status: string;
    };
    reddit?: ApiStats;
    etherscan?: ApiStats;
    cryptopanic?: ApiStats;
  };
  summary: {
    totalApis: number;
    criticalApis: number;
    warningApis: number;
    timestamp: string;
  };
}

export function ApiGuardrailsDashboard() {
  const { data: stats, isLoading, error, refetch } = useQuery<AllApiStats>({
    queryKey: ['/api/admin/api-usage/all'],
    refetchInterval: 30000, // Refresh every 30 seconds
    retry: false
  });

  const [lastRefresh, setLastRefresh] = useState(new Date());

  useEffect(() => {
    if (stats) {
      setLastRefresh(new Date());
    }
  }, [stats]);

  if (isLoading) {
    return (
      <div className="space-y-4" data-testid="api-guardrails-loading">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              API Guardrails Dashboard
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="animate-pulse space-y-3">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <Alert variant="destructive" data-testid="api-guardrails-error">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>API Guardrails Dashboard Error</AlertTitle>
        <AlertDescription>
          Unable to load API usage statistics. Check admin permissions and try again.
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => refetch()}
            className="ml-2"
          >
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  const totalCritical = stats.summary.criticalApis;
  const totalWarning = stats.summary.warningApis;
  const totalSafe = stats.summary.totalApis - totalCritical - totalWarning;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'critical': return 'text-red-600 bg-red-100 dark:bg-red-900';
      case 'warning': return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900';
      default: return 'text-green-600 bg-green-100 dark:bg-green-900';
    }
  };

  const formatResetTime = (timestamp: number) => {
    const resetDate = new Date(timestamp);
    const now = new Date();
    const hoursUntilReset = Math.ceil((resetDate.getTime() - now.getTime()) / (1000 * 60 * 60));
    
    if (hoursUntilReset <= 0) return 'Resetting now...';
    if (hoursUntilReset === 1) return '1 hour';
    if (hoursUntilReset < 24) return `${hoursUntilReset} hours`;
    return `${Math.ceil(hoursUntilReset / 24)} days`;
  };

  return (
    <div className="space-y-6" data-testid="api-guardrails-dashboard">
      {/* System Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            API Guardrails Protection System
          </CardTitle>
          <CardDescription className="flex items-center gap-4">
            <span>Protecting all external API quotas</span>
            <span className="text-xs text-gray-500">
              Last updated: {lastRefresh.toLocaleTimeString()}
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{totalSafe}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Safe</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">{totalWarning}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Warning</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{totalCritical}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Critical</div>
            </div>
          </div>

          {/* System Status Alert */}
          {totalCritical > 0 && (
            <Alert variant="destructive" className="mb-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Critical API Usage Detected</AlertTitle>
              <AlertDescription>
                {totalCritical} API{totalCritical > 1 ? 's have' : ' has'} reached critical usage levels. 
                Review individual API status below.
              </AlertDescription>
            </Alert>
          )}

          {totalWarning > 0 && totalCritical === 0 && (
            <Alert className="mb-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>API Usage Warning</AlertTitle>
              <AlertDescription>
                {totalWarning} API{totalWarning > 1 ? 's are' : ' is'} approaching usage limits. 
                Monitor usage patterns to prevent service disruption.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* X API Special Protection */}
      <XApiMonitor />

      {/* Individual API Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Reddit API */}
        {stats.apis.reddit && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center justify-between">
                Reddit API
                <Badge variant={stats.apis.reddit.status === 'critical' ? 'destructive' : 
                                stats.apis.reddit.status === 'warning' ? 'secondary' : 'default'}>
                  {stats.apis.reddit.status.toUpperCase()}
                </Badge>
              </CardTitle>
              <CardDescription>
                Daily Limit: 1,000 requests
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span>Usage</span>
                  <span>{stats.apis.reddit.used} / {stats.apis.reddit.limit}</span>
                </div>
                <Progress 
                  value={stats.apis.reddit.utilizationPercent} 
                  className="h-2"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>{stats.apis.reddit.remaining} remaining</span>
                  <span>{stats.apis.reddit.utilizationPercent}% used</span>
                </div>
              </div>
              
              <div className="pt-2 border-t">
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-3 w-3" />
                  <span>Resets in: {formatResetTime(stats.apis.reddit.resetTime)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Etherscan API */}
        {stats.apis.etherscan && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center justify-between">
                Etherscan API
                <Badge variant={stats.apis.etherscan.status === 'critical' ? 'destructive' : 
                                stats.apis.etherscan.status === 'warning' ? 'secondary' : 'default'}>
                  {stats.apis.etherscan.status.toUpperCase()}
                </Badge>
              </CardTitle>
              <CardDescription>
                Daily Limit: 50,000 requests (conservative)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span>Usage</span>
                  <span>{stats.apis.etherscan.used} / {stats.apis.etherscan.limit}</span>
                </div>
                <Progress 
                  value={stats.apis.etherscan.utilizationPercent} 
                  className="h-2"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>{stats.apis.etherscan.remaining} remaining</span>
                  <span>{stats.apis.etherscan.utilizationPercent}% used</span>
                </div>
              </div>
              
              <div className="pt-2 border-t">
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-3 w-3" />
                  <span>Resets in: {formatResetTime(stats.apis.etherscan.resetTime)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* CryptoPanic API */}
        {stats.apis.cryptopanic && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center justify-between">
                CryptoPanic API
                <Badge variant={stats.apis.cryptopanic.status === 'critical' ? 'destructive' : 
                                stats.apis.cryptopanic.status === 'warning' ? 'secondary' : 'default'}>
                  {stats.apis.cryptopanic.status.toUpperCase()}
                </Badge>
              </CardTitle>
              <CardDescription>
                Daily Limit: 800 requests (conservative)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span>Usage</span>
                  <span>{stats.apis.cryptopanic.used} / {stats.apis.cryptopanic.limit}</span>
                </div>
                <Progress 
                  value={stats.apis.cryptopanic.utilizationPercent} 
                  className="h-2"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>{stats.apis.cryptopanic.remaining} remaining</span>
                  <span>{stats.apis.cryptopanic.utilizationPercent}% used</span>
                </div>
              </div>
              
              <div className="pt-2 border-t">
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-3 w-3" />
                  <span>Resets in: {formatResetTime(stats.apis.cryptopanic.resetTime)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Protection Features Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Active Protection Features
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <Shield className="h-6 w-6 mx-auto mb-2 text-green-600" />
              <div className="font-medium text-sm">Rate Limiting</div>
              <div className="text-xs text-gray-600">1s min gaps</div>
            </div>
            
            <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <Activity className="h-6 w-6 mx-auto mb-2 text-blue-600" />
              <div className="font-medium text-sm">Usage Tracking</div>
              <div className="text-xs text-gray-600">Real-time</div>
            </div>
            
            <div className="text-center p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
              <AlertTriangle className="h-6 w-6 mx-auto mb-2 text-yellow-600" />
              <div className="font-medium text-sm">Emergency Buffers</div>
              <div className="text-xs text-gray-600">10-20% safety</div>
            </div>
            
            <div className="text-center p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
              <TrendingUp className="h-6 w-6 mx-auto mb-2 text-purple-600" />
              <div className="font-medium text-sm">Auto Reset</div>
              <div className="text-xs text-gray-600">Daily midnight</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="text-xs text-gray-500 text-center">
        API Guardrails System v1.0 - Protecting {stats.summary.totalApis} external APIs
      </div>
    </div>
  );
}