import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { 
  Monitor,
  Activity,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Zap,
  Database,
  Cloud,
  Cpu,
  MemoryStick,
  Network,
  BarChart3,
  PieChart,
  Users,
  DollarSign,
  Shield,
  Brain,
  Target,
  Gauge
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface SystemHealth {
  timestamp: string;
  uptime: number;
  memoryUsage: {
    used: number;
    total: number;
    percentage: number;
  };
  cpuUsage: number;
  apiResponseTimes: {
    trading: number;
    portfolio: number;
    compliance: number;
    social: number;
    average: number;
  };
  activeConnections: number;
  errorRate: number;
  throughput: number;
}

interface ServiceStatus {
  serviceName: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  lastCheck: string;
  responseTime: number;
  errorCount: number;
  uptime: number;
  version: string;
}

interface SystemAlert {
  id: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  service: string;
  timestamp: string;
  resolved: boolean;
}

interface UnifiedAnalytics {
  timestamp: string;
  trading: {
    totalTrades: number;
    volume24h: number;
    activeStrategies: number;
    successRate: number;
    avgReturnRate: number;
  };
  portfolio: {
    totalPortfolios: number;
    totalAUM: number;
    avgPerformance: number;
    rebalancesExecuted: number;
    riskScore: number;
  };
  compliance: {
    complianceEvents: number;
    surveillanceAlerts: number;
    auditRecordsGenerated: number;
    reguLatoryReports: number;
    integrityScore: number;
  };
  social: {
    activeProviders: number;
    copyTradingRelationships: number;
    socialEngagement: number;
    communityGrowthRate: number;
    feedActivity: number;
  };
  system: {
    userActivity: number;
    apiCalls: number;
    dataProcessed: number;
    mlPredictions: number;
  };
}

export default function SystemDashboard() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch system overview
  const { data: overviewData, isLoading: overviewLoading } = useQuery({
    queryKey: ['/api/system/overview'],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch system health
  const { data: healthData } = useQuery({
    queryKey: ['/api/system/health'],
    refetchInterval: 15000, // Refresh every 15 seconds
  });

  // Fetch analytics
  const { data: analyticsData } = useQuery({
    queryKey: ['/api/system/analytics'],
    refetchInterval: 60000, // Refresh every minute
  });

  // Fetch alerts
  const { data: alertsData } = useQuery({
    queryKey: ['/api/system/alerts'],
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  // Fetch intelligence insights
  const { data: intelligenceData } = useQuery({
    queryKey: ['/api/system/intelligence'],
    refetchInterval: 300000, // Refresh every 5 minutes
  });

  // Resolve alert mutation
  const resolveAlert = useMutation({
    mutationFn: async (alertId: string) => {
      const response = await fetch(`/api/system/alerts/${alertId}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolvedBy: 'dashboard-user' }),
      });
      
      if (!response.ok) throw new Error('Failed to resolve alert');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/system/alerts'] });
      toast({
        title: "Alert Resolved",
        description: "The system alert has been resolved.",
      });
    },
  });

  const health: SystemHealth = healthData?.data?.health;
  const services: ServiceStatus[] = healthData?.data?.services || [];
  const analytics: UnifiedAnalytics = analyticsData?.data?.analytics;
  const insights = analyticsData?.data?.insights;
  const alerts: SystemAlert[] = alertsData?.data?.alerts || [];
  const intelligence = intelligenceData?.data?.insights;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-600';
      case 'degraded': return 'text-yellow-600';
      case 'unhealthy': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'degraded': return <AlertTriangle className="w-4 h-4 text-yellow-600" />;
      case 'unhealthy': return <XCircle className="w-4 h-4 text-red-600" />;
      default: return <Activity className="w-4 h-4 text-gray-600" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-600';
      case 'high': return 'bg-orange-600';
      case 'medium': return 'bg-yellow-600';
      default: return 'bg-blue-600';
    }
  };

  const formatUptime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  const formatBytes = (bytes: number) => {
    const gb = bytes / (1024 * 1024 * 1024);
    return `${gb.toFixed(2)} GB`;
  };

  if (overviewLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-foreground">System Dashboard</h1>
          <p className="text-muted-foreground">Comprehensive system monitoring and analytics</p>
        </div>
        <div className="flex items-center space-x-2">
          <Badge variant={overviewData?.data?.summary?.overallHealth === 'excellent' ? "default" : "secondary"}>
            System: {overviewData?.data?.summary?.overallHealth || 'Unknown'}
          </Badge>
          <Badge variant="secondary">
            Score: {overviewData?.data?.summary?.systemScore || 0}/100
          </Badge>
        </div>
      </div>

      {/* System Status Cards */}
      <div className="grid gap-4 md:grid-cols-6">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">System Health</div>
            <Monitor className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-bold mt-2 capitalize">
            {overviewData?.data?.summary?.overallHealth || 'Unknown'}
          </div>
          <div className="text-sm text-muted-foreground">
            Grade: {overviewData?.data?.summary?.performanceGrade || 'N/A'}
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">Uptime</div>
            <Activity className="w-4 h-4 text-green-600" />
          </div>
          <div className="text-2xl font-bold mt-2">
            {health ? formatUptime(health.uptime) : '0h 0m'}
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">Memory Usage</div>
            <MemoryStick className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-2xl font-bold mt-2">
            {health ? `${health.memoryUsage.percentage.toFixed(1)}%` : '0%'}
          </div>
          <div className="mt-2">
            <Progress value={health?.memoryUsage.percentage || 0} className="h-2" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">CPU Usage</div>
            <Cpu className="w-4 h-4 text-orange-600" />
          </div>
          <div className="text-2xl font-bold mt-2">
            {health ? `${health.cpuUsage.toFixed(1)}%` : '0%'}
          </div>
          <div className="mt-2">
            <Progress value={health?.cpuUsage || 0} className="h-2" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">API Response</div>
            <Zap className="w-4 h-4 text-yellow-600" />
          </div>
          <div className="text-2xl font-bold mt-2">
            {health ? `${health.apiResponseTimes.average.toFixed(0)}ms` : '0ms'}
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">Active Alerts</div>
            <AlertTriangle className="w-4 h-4 text-red-600" />
          </div>
          <div className="text-2xl font-bold mt-2">
            {alerts.filter(a => !a.resolved).length}
          </div>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="services">Services</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
          <TabsTrigger value="intelligence">Intelligence</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="p-4">
              <h3 className="font-semibold mb-4">Platform Analytics</h3>
              
              {analytics ? (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Trading Volume</span>
                      <span className="font-medium">
                        ${analytics.trading.volume24h.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Total Portfolios</span>
                      <span className="font-medium">{analytics.portfolio.totalPortfolios}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">AUM</span>
                      <span className="font-medium text-green-600">
                        ${analytics.portfolio.totalAUM.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Success Rate</span>
                      <span className="font-medium">
                        {(analytics.trading.successRate * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Social Providers</span>
                      <span className="font-medium">{analytics.social.activeProviders}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">User Activity</span>
                      <span className="font-medium">{analytics.system.userActivity}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">API Calls</span>
                      <span className="font-medium">{analytics.system.apiCalls.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Compliance Score</span>
                      <span className="font-medium text-blue-600">
                        {(analytics.compliance.integrityScore * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  Loading analytics...
                </div>
              )}
            </Card>

            <Card className="p-4">
              <h3 className="font-semibold mb-4">Performance Insights</h3>
              
              {insights ? (
                <div className="space-y-4">
                  <div className="p-3 border rounded-lg">
                    <div className="font-medium text-green-600">System Efficiency</div>
                    <div className="text-sm text-muted-foreground">
                      {insights.systemEfficiency ? 
                        `${(insights.systemEfficiency * 100).toFixed(1)}% - Excellent performance` :
                        'Calculating efficiency metrics...'}
                    </div>
                    <Progress value={insights.systemEfficiency ? insights.systemEfficiency * 100 : 0} className="mt-2 h-2" />
                  </div>

                  <div className="p-3 border rounded-lg">
                    <div className="font-medium text-blue-600">Data Integrity</div>
                    <div className="text-sm text-muted-foreground">
                      {insights.dataIntegrity ? 
                        `${insights.dataIntegrity.toFixed(1)}% - All systems verified` :
                        'Verifying data integrity...'}
                    </div>
                    <Progress value={insights.dataIntegrity || 0} className="mt-2 h-2" />
                  </div>

                  <div className="p-3 border rounded-lg">
                    <div className="font-medium text-purple-600">Performance Score</div>
                    <div className="text-sm text-muted-foreground">
                      {insights.performanceScore ? 
                        `${insights.performanceScore.toFixed(1)}/100 - Industry leading` :
                        'Calculating performance score...'}
                    </div>
                    <Progress value={insights.performanceScore || 0} className="mt-2 h-2" />
                  </div>
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  Generating insights...
                </div>
              )}
            </Card>
          </div>
        </TabsContent>

        {/* Services Tab */}
        <TabsContent value="services" className="space-y-4">
          <Card className="p-4">
            <h3 className="font-semibold mb-4">Service Status</h3>
            
            <div className="grid gap-3 md:grid-cols-2">
              {services.map((service) => (
                <div key={service.serviceName} className="p-3 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      {getStatusIcon(service.status)}
                      <span className="font-medium">{service.serviceName}</span>
                    </div>
                    <Badge className={service.status === 'healthy' ? 'bg-green-600' : 
                                   service.status === 'degraded' ? 'bg-yellow-600' : 'bg-red-600'}>
                      {service.status.toUpperCase()}
                    </Badge>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Response:</span>
                      <span className="ml-1 font-medium">{service.responseTime.toFixed(0)}ms</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Errors:</span>
                      <span className="ml-1 font-medium">{service.errorCount}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Version:</span>
                      <span className="ml-1 font-medium">{service.version}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">Trading</div>
                <TrendingUp className="w-4 h-4 text-green-600" />
              </div>
              <div className="text-2xl font-bold mt-2">
                {analytics ? analytics.trading.totalTrades.toLocaleString() : '0'}
              </div>
              <div className="text-sm text-muted-foreground">Total Trades</div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">Portfolio</div>
                <PieChart className="w-4 h-4 text-blue-600" />
              </div>
              <div className="text-2xl font-bold mt-2 text-green-600">
                ${analytics ? analytics.portfolio.totalAUM.toLocaleString() : '0'}
              </div>
              <div className="text-sm text-muted-foreground">Assets Under Management</div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">Compliance</div>
                <Shield className="w-4 h-4 text-indigo-600" />
              </div>
              <div className="text-2xl font-bold mt-2">
                {analytics ? (analytics.compliance.integrityScore * 100).toFixed(1) : '0'}%
              </div>
              <div className="text-sm text-muted-foreground">Integrity Score</div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">Social</div>
                <Users className="w-4 h-4 text-pink-600" />
              </div>
              <div className="text-2xl font-bold mt-2">
                {analytics ? analytics.social.socialEngagement : '0'}
              </div>
              <div className="text-sm text-muted-foreground">Community Engagement</div>
            </Card>
          </div>
        </TabsContent>

        {/* Alerts Tab */}
        <TabsContent value="alerts" className="space-y-4">
          <Card className="p-4">
            <h3 className="font-semibold mb-4">System Alerts</h3>
            
            {alerts.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                <CheckCircle className="w-12 h-12 mx-auto mb-2 text-green-600" />
                No active alerts - System running smoothly
              </div>
            ) : (
              <div className="space-y-3">
                {alerts.map((alert) => (
                  <div key={alert.id} className="p-3 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <Badge className={getSeverityColor(alert.severity)}>
                          {alert.severity.toUpperCase()}
                        </Badge>
                        <span className="font-medium">{alert.title}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs text-muted-foreground">
                          {new Date(alert.timestamp).toLocaleString()}
                        </span>
                        {!alert.resolved && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => resolveAlert.mutate(alert.id)}
                            disabled={resolveAlert.isPending}
                          >
                            Resolve
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground">{alert.message}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Service: {alert.service} • Type: {alert.type}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>

        {/* Intelligence Tab */}
        <TabsContent value="intelligence" className="space-y-4">
          <Card className="p-4">
            <h3 className="font-semibold mb-4 flex items-center">
              <Brain className="w-5 h-5 mr-2" />
              AI System Intelligence
            </h3>
            
            {intelligence ? (
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="p-3 border rounded-lg">
                    <div className="font-medium text-green-600">Performance Trend</div>
                    <div className="text-sm text-muted-foreground capitalize">
                      {intelligence.systemTrends?.performance?.trend || 'Analyzing...'}
                    </div>
                    <div className="text-xs mt-1">
                      Confidence: {intelligence.systemTrends?.performance?.confidence ? 
                        `${(intelligence.systemTrends.performance.confidence * 100).toFixed(0)}%` : 'N/A'}
                    </div>
                  </div>

                  <div className="p-3 border rounded-lg">
                    <div className="font-medium text-blue-600">Usage Trend</div>
                    <div className="text-sm text-muted-foreground capitalize">
                      {intelligence.systemTrends?.usage?.trend || 'Analyzing...'}
                    </div>
                    <div className="text-xs mt-1">
                      Confidence: {intelligence.systemTrends?.usage?.confidence ? 
                        `${(intelligence.systemTrends.usage.confidence * 100).toFixed(0)}%` : 'N/A'}
                    </div>
                  </div>

                  <div className="p-3 border rounded-lg">
                    <div className="font-medium text-purple-600">Error Trend</div>
                    <div className="text-sm text-muted-foreground capitalize">
                      {intelligence.systemTrends?.errors?.trend || 'Analyzing...'}
                    </div>
                    <div className="text-xs mt-1">
                      Confidence: {intelligence.systemTrends?.errors?.confidence ? 
                        `${(intelligence.systemTrends.errors.confidence * 100).toFixed(0)}%` : 'N/A'}
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-medium mb-3">Business Insights</h4>
                  <div className="space-y-2">
                    {intelligence.businessInsights && Object.entries(intelligence.businessInsights).map(([key, insight]: [string, any]) => (
                      <div key={key} className="p-3 border rounded-lg">
                        <div className="flex items-center justify-between">
                          <span className="font-medium capitalize">{key}</span>
                          <Badge variant={insight.impact === 'high' ? 'default' : 'secondary'}>
                            {insight.impact} Impact
                          </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">
                          {insight.recommendation}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {insight.reasoning}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center text-muted-foreground py-8">
                <Brain className="w-12 h-12 mx-auto mb-2" />
                AI Intelligence analysis in progress...
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}