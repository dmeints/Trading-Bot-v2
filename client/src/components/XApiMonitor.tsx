import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Shield, Activity, Database } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';

interface XApiStats {
  usage: {
    used: number;
    limit: number;
    remaining: number;
    month: string;
  };
  cache: {
    totalEntries: number;
    oldestEntry: number | null;
    newestEntry: number | null;
    totalSavedRequests: number;
  };
  limits: {
    monthlyLimit: number;
    dailyRecommended: number;
    emergencyCutoff: number;
  };
  status: 'safe' | 'warning' | 'critical';
}

export function XApiMonitor() {
  const { data: stats, isLoading, error } = useQuery<XApiStats>({
    queryKey: ['/api/admin/x-api/usage'],
    refetchInterval: 30000, // Refresh every 30 seconds
    retry: false
  });

  if (isLoading) {
    return (
      <Card data-testid="x-api-monitor-loading">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            X API Protection Monitor
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !stats) {
    return (
      <Alert variant="destructive" data-testid="x-api-monitor-error">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>X API Monitor Error</AlertTitle>
        <AlertDescription>
          Unable to load X API usage statistics. Check admin permissions.
        </AlertDescription>
      </Alert>
    );
  }

  const usagePercentage = (stats.usage.used / stats.usage.limit) * 100;
  const statusConfig = {
    safe: { color: 'text-green-600', bgColor: 'bg-green-100', darkBgColor: 'dark:bg-green-900' },
    warning: { color: 'text-yellow-600', bgColor: 'bg-yellow-100', darkBgColor: 'dark:bg-yellow-900' },
    critical: { color: 'text-red-600', bgColor: 'bg-red-100', darkBgColor: 'dark:bg-red-900' }
  };

  const config = statusConfig[stats.status];

  return (
    <div className="space-y-4" data-testid="x-api-monitor">
      {/* Status Alert */}
      {stats.status !== 'safe' && (
        <Alert variant={stats.status === 'critical' ? 'destructive' : 'default'}>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>
            {stats.status === 'critical' ? 'X API Critical Usage' : 'X API Usage Warning'}
          </AlertTitle>
          <AlertDescription>
            {stats.status === 'critical' 
              ? `Only ${stats.usage.remaining} requests remaining this month. System will auto-disable at ${stats.limits.emergencyCutoff} to prevent complete cutoff.`
              : `${stats.usage.remaining} requests remaining. Consider conserving X API usage.`
            }
          </AlertDescription>
        </Alert>
      )}

      {/* Main Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            X API Emergency Protection
          </CardTitle>
          <CardDescription>
            Free tier: Only 100 posts/month (3 per day budget)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Usage Progress */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Monthly Usage</span>
              <Badge variant={stats.status === 'critical' ? 'destructive' : stats.status === 'warning' ? 'secondary' : 'default'}>
                {stats.usage.used}/{stats.usage.limit}
              </Badge>
            </div>
            <Progress 
              value={usagePercentage} 
              className="h-3"
              data-testid="usage-progress"
            />
            <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400">
              <span>{stats.usage.remaining} remaining</span>
              <span>{stats.usage.month}</span>
            </div>
          </div>

          {/* Protection Stats Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className={`p-3 rounded-lg ${config.bgColor} ${config.darkBgColor}`}>
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4" />
                <span className="text-sm font-medium">Daily Budget</span>
              </div>
              <p className="text-lg font-bold mt-1">
                {stats.limits.dailyRecommended}/day
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Conservative limit
              </p>
            </div>

            <div className={`p-3 rounded-lg ${config.bgColor} ${config.darkBgColor}`}>
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4" />
                <span className="text-sm font-medium">Cache Hits</span>
              </div>
              <p className="text-lg font-bold mt-1">
                {stats.cache.totalSavedRequests}
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Requests saved
              </p>
            </div>
          </div>

          {/* Cache Information */}
          <div className="border-t pt-4">
            <h4 className="text-sm font-medium mb-2">Cache Status</h4>
            <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
              <div className="flex justify-between">
                <span>Active entries:</span>
                <span>{stats.cache.totalEntries}</span>
              </div>
              {stats.cache.oldestEntry && (
                <div className="flex justify-between">
                  <span>Oldest cache:</span>
                  <span>
                    {Math.round((Date.now() - stats.cache.oldestEntry) / 1000 / 60)} min ago
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Emergency Cutoff Warning */}
          <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
            <p className="text-xs text-gray-600 dark:text-gray-400">
              <strong>Emergency Protection:</strong> System will auto-disable X API at {stats.limits.emergencyCutoff} 
              requests to prevent complete service cutoff. Cached data will continue serving.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}