/**
 * Phase L - Production Monitoring Dashboard
 */

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { 
  Activity, 
  Server, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Cpu, 
  HardDrive, 
  Wifi,
  Database,
  Zap
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";

interface SystemHealthMetrics {
  overall: 'HEALTHY' | 'DEGRADED' | 'CRITICAL';
  uptime: number;
  lastCheck: string;
  components: {
    database: ComponentHealth;
    api: ComponentHealth;
    marketData: ComponentHealth;
    trading: ComponentHealth;
    ai: ComponentHealth;
  };
  performance: {
    responseTime: number;
    throughput: number;
    errorRate: number;
    memoryUsage: number;
    cpuUsage: number;
  };
  alerts: SystemAlert[];
}

interface ComponentHealth {
  status: 'UP' | 'DOWN' | 'DEGRADED';
  responseTime: number;
  errorCount: number;
  lastError: string | null;
  uptime: number;
}

interface SystemAlert {
  id: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  component: string;
  message: string;
  timestamp: string;
  resolved: boolean;
}

interface DeploymentMetrics {
  version: string;
  deploymentTime: string;
  buildHash: string;
  environment: string;
  rollbackAvailable: boolean;
  featureFlags: Record<string, boolean>;
  performanceBenchmarks: {
    apiLatency: number;
    databaseQueries: number;
    memoryFootprint: number;
    startupTime: number;
  };
}

export default function ProductionMonitoring() {
  const [selectedTimeRange, setSelectedTimeRange] = useState('1h');
  const [selectedComponent, setSelectedComponent] = useState('all');
  
  const queryClient = useQueryClient();

  // Fetch system health metrics
  const { data: healthData, isLoading: healthLoading } = useQuery({
    queryKey: ['/api/monitoring/health'],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch deployment metrics
  const { data: deploymentData, isLoading: deploymentLoading } = useQuery({
    queryKey: ['/api/monitoring/deployment'],
    refetchInterval: 300000, // Refresh every 5 minutes
  });

  // Fetch system metrics
  const { data: metricsData, isLoading: metricsLoading } = useQuery({
    queryKey: ['/api/monitoring/metrics', selectedTimeRange, selectedComponent],
    refetchInterval: 60000, // Refresh every minute
  });

  // Fetch alerts
  const { data: alertsData, isLoading: alertsLoading } = useQuery({
    queryKey: ['/api/monitoring/alerts'],
    refetchInterval: 15000, // Refresh every 15 seconds
  });

  // Resolve alert mutation
  const resolveAlert = useMutation({
    mutationFn: async (alertId: string) => {
      const response = await fetch('/api/monitoring/alerts/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alertId })
      });
      if (!response.ok) throw new Error('Failed to resolve alert');
      return response.json();
    },
    onSuccess: (data, alertId) => {
      toast({
        title: "Alert Resolved",
        description: `Alert ${alertId} has been resolved successfully`
      });
      queryClient.invalidateQueries({ queryKey: ['/api/monitoring/alerts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/monitoring/health'] });
    },
    onError: (error) => {
      toast({
        title: "Resolution Failed",
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: "destructive"
      });
    }
  });

  const formatUptime = (uptimeMs: number) => {
    const seconds = Math.floor(uptimeMs / 1000);
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m ${seconds % 60}s`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'HEALTHY':
      case 'UP':
        return "text-green-600";
      case 'DEGRADED':
        return "text-yellow-600";
      case 'CRITICAL':
      case 'DOWN':
        return "text-red-600";
      default:
        return "text-gray-600";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'HEALTHY':
      case 'UP':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'DEGRADED':
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      case 'CRITICAL':
      case 'DOWN':
        return <XCircle className="h-4 w-4 text-red-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-600" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'CRITICAL':
        return "bg-red-100 text-red-800 border-red-200";
      case 'HIGH':
        return "bg-orange-100 text-orange-800 border-orange-200";
      case 'MEDIUM':
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case 'LOW':
        return "bg-blue-100 text-blue-800 border-blue-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Phase L - Production Monitoring</h1>
          <p className="text-muted-foreground mt-2">
            Comprehensive system health monitoring, alerting, and CI/CD deployment tracking
          </p>
        </div>
        <Badge variant="outline" className="bg-green-50">
          Phase L: Live
        </Badge>
      </div>

      {/* System Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">System Status</p>
                {healthLoading ? (
                  <div className="h-6 bg-gray-200 rounded animate-pulse mt-2" />
                ) : (
                  <p className={`text-lg font-bold ${getStatusColor(healthData?.health?.overall || 'UNKNOWN')}`}>
                    {healthData?.health?.overall || 'UNKNOWN'}
                  </p>
                )}
              </div>
              <Activity className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Uptime</p>
                {healthLoading ? (
                  <div className="h-6 bg-gray-200 rounded animate-pulse mt-2" />
                ) : (
                  <p className="text-lg font-bold">
                    {formatUptime(healthData?.health?.uptime || 0)}
                  </p>
                )}
              </div>
              <Clock className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Alerts</p>
                {alertsLoading ? (
                  <div className="h-6 bg-gray-200 rounded animate-pulse mt-2" />
                ) : (
                  <p className="text-lg font-bold text-red-600">
                    {alertsData?.alerts?.length || 0}
                  </p>
                )}
              </div>
              <AlertTriangle className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Response Time</p>
                {healthLoading ? (
                  <div className="h-6 bg-gray-200 rounded animate-pulse mt-2" />
                ) : (
                  <p className="text-lg font-bold">
                    {healthData?.health?.performance?.responseTime || 0}ms
                  </p>
                )}
              </div>
              <Zap className="h-8 w-8 text-yellow-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="health" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="health">System Health</TabsTrigger>
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="deployment">Deployment</TabsTrigger>
          <TabsTrigger value="metrics">Metrics</TabsTrigger>
        </TabsList>

        {/* System Health Tab */}
        <TabsContent value="health">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Server className="h-5 w-5" />
                  Component Health
                </CardTitle>
                <CardDescription>Status of individual system components</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {healthLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3, 4, 5].map(i => (
                      <div key={i} className="flex justify-between items-center">
                        <div className="h-4 bg-gray-200 rounded animate-pulse w-24" />
                        <div className="h-4 bg-gray-200 rounded animate-pulse w-16" />
                      </div>
                    ))}
                  </div>
                ) : healthData?.success && healthData.health?.components && (
                  Object.entries(healthData.health.components).map(([name, component]) => (
                    <div key={name} className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        {name === 'database' && <Database className="h-4 w-4" />}
                        {name === 'api' && <Wifi className="h-4 w-4" />}
                        {name === 'marketData' && <Activity className="h-4 w-4" />}
                        {name === 'trading' && <Zap className="h-4 w-4" />}
                        {name === 'ai' && <Server className="h-4 w-4" />}
                        <span className="font-medium capitalize">{name.replace(/([A-Z])/g, ' $1')}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(component.status)}
                        <span className={`text-sm ${getStatusColor(component.status)}`}>
                          {component.status}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {component.responseTime}ms
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Cpu className="h-5 w-5" />
                  System Resources
                </CardTitle>
                <CardDescription>Current system resource utilization</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {healthLoading ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="space-y-2">
                        <div className="h-4 bg-gray-200 rounded animate-pulse w-20" />
                        <div className="h-2 bg-gray-200 rounded animate-pulse" />
                      </div>
                    ))}
                  </div>
                ) : healthData?.success && healthData.health?.performance && (
                  <>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm font-medium">CPU Usage</span>
                        <span className="text-sm">{healthData.health.performance.cpuUsage}%</span>
                      </div>
                      <Progress value={healthData.health.performance.cpuUsage} className="h-2" />
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm font-medium">Memory Usage</span>
                        <span className="text-sm">{healthData.health.performance.memoryUsage.toFixed(1)}MB</span>
                      </div>
                      <Progress value={(healthData.health.performance.memoryUsage / 512) * 100} className="h-2" />
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm font-medium">Error Rate</span>
                        <span className="text-sm">{healthData.health.performance.errorRate}%</span>
                      </div>
                      <Progress 
                        value={healthData.health.performance.errorRate} 
                        className="h-2"
                        // Make progress bar red if error rate is high
                      />
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Alerts Tab */}
        <TabsContent value="alerts">
          <Card>
            <CardHeader>
              <CardTitle>System Alerts</CardTitle>
              <CardDescription>Current system alerts and notifications</CardDescription>
            </CardHeader>
            <CardContent>
              {alertsLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-16 bg-gray-200 rounded animate-pulse" />
                  ))}
                </div>
              ) : alertsData?.success ? (
                alertsData.alerts.length > 0 ? (
                  <div className="space-y-4">
                    {alertsData.alerts.map((alert: SystemAlert) => (
                      <div
                        key={alert.id}
                        className={`border rounded-lg p-4 ${getSeverityColor(alert.severity)}`}
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge variant="outline" className={getSeverityColor(alert.severity)}>
                                {alert.severity}
                              </Badge>
                              <span className="font-medium">{alert.component}</span>
                              <span className="text-sm text-muted-foreground">
                                {new Date(alert.timestamp).toLocaleString()}
                              </span>
                            </div>
                            <p className="text-sm">{alert.message}</p>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => resolveAlert.mutate(alert.id)}
                            disabled={resolveAlert.isPending}
                            data-testid={`resolve-alert-${alert.id}`}
                          >
                            {resolveAlert.isPending ? 'Resolving...' : 'Resolve'}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-600" />
                    <p>No active alerts - system is healthy</p>
                  </div>
                )
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <AlertTriangle className="h-12 w-12 mx-auto mb-4" />
                  <p>Failed to load alerts</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Performance Tab */}
        <TabsContent value="performance">
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <Select value={selectedTimeRange} onValueChange={setSelectedTimeRange}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1h">Last Hour</SelectItem>
                  <SelectItem value="6h">Last 6 Hours</SelectItem>
                  <SelectItem value="24h">Last 24 Hours</SelectItem>
                  <SelectItem value="7d">Last 7 Days</SelectItem>
                </SelectContent>
              </Select>

              <Select value={selectedComponent} onValueChange={setSelectedComponent}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Components</SelectItem>
                  <SelectItem value="api">API</SelectItem>
                  <SelectItem value="database">Database</SelectItem>
                  <SelectItem value="trading">Trading</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Performance Metrics</CardTitle>
                </CardHeader>
                <CardContent>
                  {metricsLoading ? (
                    <div className="space-y-4">
                      <div className="h-4 bg-gray-200 rounded animate-pulse" />
                      <div className="h-20 bg-gray-200 rounded animate-pulse" />
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Activity className="h-12 w-12 mx-auto mb-4" />
                      <p>Performance charts will be displayed here</p>
                      <p className="text-sm mt-2">Metrics API endpoint: /api/monitoring/metrics</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>System Load</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-8 text-muted-foreground">
                    <HardDrive className="h-12 w-12 mx-auto mb-4" />
                    <p>System load visualization</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Deployment Tab */}
        <TabsContent value="deployment">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Deployment Information</CardTitle>
                <CardDescription>Current deployment status and version info</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {deploymentLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3, 4].map(i => (
                      <div key={i} className="flex justify-between">
                        <div className="h-4 bg-gray-200 rounded animate-pulse w-24" />
                        <div className="h-4 bg-gray-200 rounded animate-pulse w-32" />
                      </div>
                    ))}
                  </div>
                ) : deploymentData?.success && (
                  <>
                    <div className="flex justify-between">
                      <span className="font-medium">Version</span>
                      <Badge variant="outline">{deploymentData.deployment.version}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">Environment</span>
                      <Badge variant={deploymentData.deployment.environment === 'production' ? 'default' : 'secondary'}>
                        {deploymentData.deployment.environment}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">Build Hash</span>
                      <span className="text-sm font-mono">{deploymentData.deployment.buildHash}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">Deployed</span>
                      <span className="text-sm">
                        {new Date(deploymentData.deployment.deploymentTime).toLocaleString()}
                      </span>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Feature Flags</CardTitle>
                <CardDescription>Active feature toggles and configurations</CardDescription>
              </CardHeader>
              <CardContent>
                {deploymentLoading ? (
                  <div className="space-y-2">
                    {[1, 2, 3, 4, 5].map(i => (
                      <div key={i} className="flex justify-between">
                        <div className="h-4 bg-gray-200 rounded animate-pulse w-32" />
                        <div className="h-4 bg-gray-200 rounded animate-pulse w-16" />
                      </div>
                    ))}
                  </div>
                ) : deploymentData?.success && (
                  <div className="space-y-2">
                    {Object.entries(deploymentData.deployment.featureFlags).map(([flag, enabled]) => (
                      <div key={flag} className="flex justify-between items-center">
                        <span className="text-sm font-medium">{flag}</span>
                        <Badge variant={enabled ? 'default' : 'secondary'}>
                          {enabled ? 'Enabled' : 'Disabled'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Metrics Tab */}
        <TabsContent value="metrics">
          <Card>
            <CardHeader>
              <CardTitle>System Metrics Dashboard</CardTitle>
              <CardDescription>Comprehensive system performance and usage metrics</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-muted-foreground">
                <Activity className="h-16 w-16 mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Advanced Metrics Dashboard</h3>
                <p>Detailed system metrics visualization will be implemented here</p>
                <p className="text-sm mt-2">Integration ready for charting libraries (Chart.js, D3, etc.)</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}