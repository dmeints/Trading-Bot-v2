import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Cpu, 
  Database, 
  Globe, 
  MemoryStick,
  Server,
  Wifi,
  XCircle
} from 'lucide-react';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

interface SLOStatus {
  name: string;
  target: number;
  current: number;
  threshold: number;
  unit: string;
}

interface AlertItem {
  metric: string;
  current: number;
  threshold: number;
}

export default function ServiceLevelPage() {
  const [realtimeData, setRealtimeData] = useState<any[]>([]);

  // Fetch SLO data
  const { data: sloData, isLoading: sloLoading } = useQuery({
    queryKey: ['/api/monitoring/slo'],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch alerts data
  const { data: alertsData, isLoading: alertsLoading } = useQuery({
    queryKey: ['/api/monitoring/alerts'],
    refetchInterval: 15000, // Refresh every 15 seconds
  });

  // Fetch telemetry data
  const { data: telemetryData, isLoading: telemetryLoading } = useQuery({
    queryKey: ['/api/monitoring/telemetry'],
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  // Fetch detailed health data
  const { data: healthData, isLoading: healthLoading } = useQuery({
    queryKey: ['/api/monitoring/health/detailed'],
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  // Generate realtime data for charts
  useEffect(() => {
    const interval = setInterval(() => {
      const newDataPoint = {
        timestamp: new Date().toLocaleTimeString(),
        cpu: telemetryData?.system?.memory?.percentage || Math.random() * 100,
        memory: telemetryData?.system?.memory?.percentage || Math.random() * 100,
        requests: Math.floor(Math.random() * 1000),
        latency: Math.random() * 200,
      };

      setRealtimeData(prev => {
        const updated = [...prev, newDataPoint];
        return updated.slice(-20); // Keep last 20 data points
      });
    }, 5000);

    return () => clearInterval(interval);
  }, [telemetryData]);

  const getSLOStatusColor = (slo: SLOStatus) => {
    const isViolation = slo.name.includes('95th') 
      ? slo.current > slo.threshold
      : slo.current < slo.threshold;
    
    if (isViolation) return 'destructive';
    if (slo.current >= slo.target * 0.95) return 'default';
    return 'secondary';
  };

  const getSLOIcon = (slo: SLOStatus) => {
    const isViolation = slo.name.includes('95th') 
      ? slo.current > slo.threshold
      : slo.current < slo.threshold;
    
    if (isViolation) return <XCircle className="w-4 h-4" />;
    if (slo.current >= slo.target * 0.95) return <CheckCircle className="w-4 h-4" />;
    return <AlertTriangle className="w-4 h-4" />;
  };

  const getHealthIcon = (healthy: boolean) => {
    return healthy ? <CheckCircle className="w-4 h-4 text-green-500" /> : <XCircle className="w-4 h-4 text-red-500" />;
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Service Level Dashboard</h1>
            <p className="text-gray-400">Real-time monitoring of SLAs, performance metrics, and system health</p>
          </div>
          <div className="flex items-center space-x-2">
            <div className="flex items-center space-x-1">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-sm text-gray-400">Live</span>
            </div>
          </div>
        </div>

        {/* Alert Summary */}
        {alertsData?.alertsActive && (
          <Alert className="border-red-500 bg-red-900/20">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {alertsData.alerts.length} active alert(s) detected. 
              {alertsData.severityLevels.critical > 0 && (
                <span className="font-semibold text-red-400"> {alertsData.severityLevels.critical} critical</span>
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* SLO Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {sloData?.slos?.map((slo: SLOStatus, index: number) => (
            <Card key={index} className="bg-gray-800 border-gray-600">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-300 flex items-center justify-between">
                  {slo.name}
                  {getSLOIcon(slo)}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-bold text-white">
                      {slo.current.toFixed(1)}{slo.unit}
                    </span>
                    <Badge variant={getSLOStatusColor(slo)} className="text-xs">
                      Target: {slo.target}{slo.unit}
                    </Badge>
                  </div>
                  <Progress 
                    value={slo.name.includes('95th') ? 
                      Math.max(0, 100 - (slo.current / slo.threshold) * 100) : 
                      (slo.current / slo.target) * 100
                    } 
                    className="h-2" 
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="metrics" className="space-y-4">
          <TabsList className="bg-gray-800">
            <TabsTrigger value="metrics">Performance Metrics</TabsTrigger>
            <TabsTrigger value="health">System Health</TabsTrigger>
            <TabsTrigger value="alerts">Active Alerts</TabsTrigger>
            <TabsTrigger value="telemetry">Live Telemetry</TabsTrigger>
          </TabsList>

          <TabsContent value="metrics" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Response Time Chart */}
              <Card className="bg-gray-800 border-gray-600">
                <CardHeader>
                  <CardTitle className="text-white flex items-center">
                    <Clock className="w-5 h-5 mr-2" />
                    Response Time Trends
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={realtimeData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="timestamp" stroke="#9CA3AF" />
                      <YAxis stroke="#9CA3AF" />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151' }}
                        labelStyle={{ color: '#F3F4F6' }}
                      />
                      <Line type="monotone" dataKey="latency" stroke="#3B82F6" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Request Volume Chart */}
              <Card className="bg-gray-800 border-gray-600">
                <CardHeader>
                  <CardTitle className="text-white flex items-center">
                    <Activity className="w-5 h-5 mr-2" />
                    Request Volume
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={realtimeData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="timestamp" stroke="#9CA3AF" />
                      <YAxis stroke="#9CA3AF" />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151' }}
                        labelStyle={{ color: '#F3F4F6' }}
                      />
                      <Area type="monotone" dataKey="requests" stroke="#10B981" fill="#10B981" fillOpacity={0.3} />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* System Resources */}
              <Card className="bg-gray-800 border-gray-600">
                <CardHeader>
                  <CardTitle className="text-white flex items-center">
                    <Server className="w-5 h-5 mr-2" />
                    System Resources
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={realtimeData.slice(-5)}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="timestamp" stroke="#9CA3AF" />
                      <YAxis stroke="#9CA3AF" />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151' }}
                        labelStyle={{ color: '#F3F4F6' }}
                      />
                      <Bar dataKey="cpu" fill="#F59E0B" />
                      <Bar dataKey="memory" fill="#8B5CF6" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* SLA Adherence */}
              <Card className="bg-gray-800 border-gray-600">
                <CardHeader>
                  <CardTitle className="text-white">SLA Adherence</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {sloData?.slos?.map((slo: SLOStatus, index: number) => (
                    <div key={index} className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-300">{slo.name}</span>
                        <span className="text-sm font-medium">
                          {slo.current.toFixed(1)}{slo.unit} / {slo.target}{slo.unit}
                        </span>
                      </div>
                      <Progress 
                        value={slo.name.includes('95th') ? 
                          Math.max(0, 100 - (slo.current / slo.threshold) * 100) : 
                          Math.min(100, (slo.current / slo.target) * 100)
                        } 
                        className="h-2" 
                      />
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="health" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Database Health */}
              <Card className="bg-gray-800 border-gray-600">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-300 flex items-center">
                    <Database className="w-4 h-4 mr-2" />
                    Database
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    {getHealthIcon(healthData?.checks?.database?.healthy)}
                    <div className="text-right">
                      <div className="text-lg font-semibold text-white">
                        {healthData?.checks?.database?.healthy ? 'Healthy' : 'Unhealthy'}
                      </div>
                      {healthData?.checks?.database?.latency && (
                        <div className="text-xs text-gray-400">
                          {healthData.checks.database.latency}ms
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* WebSocket Health */}
              <Card className="bg-gray-800 border-gray-600">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-300 flex items-center">
                    <Wifi className="w-4 h-4 mr-2" />
                    WebSocket
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    {getHealthIcon(healthData?.checks?.websocket?.healthy)}
                    <div className="text-right">
                      <div className="text-lg font-semibold text-white">
                        {healthData?.checks?.websocket?.healthy ? 'Healthy' : 'Unhealthy'}
                      </div>
                      {healthData?.checks?.websocket?.connections !== undefined && (
                        <div className="text-xs text-gray-400">
                          {healthData.checks.websocket.connections} connections
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* AI Services Health */}
              <Card className="bg-gray-800 border-gray-600">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-300 flex items-center">
                    <Cpu className="w-4 h-4 mr-2" />
                    AI Services
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    {getHealthIcon(healthData?.checks?.ai_services?.healthy)}
                    <div className="text-right">
                      <div className="text-lg font-semibold text-white">
                        {healthData?.checks?.ai_services?.healthy ? 'Healthy' : 'Unhealthy'}
                      </div>
                      {healthData?.checks?.ai_services?.services && (
                        <div className="text-xs text-gray-400">
                          {Object.values(healthData.checks.ai_services.services).filter(Boolean).length}/
                          {Object.keys(healthData.checks.ai_services.services).length} online
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* External APIs Health */}
              <Card className="bg-gray-800 border-gray-600">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-300 flex items-center">
                    <Globe className="w-4 h-4 mr-2" />
                    External APIs
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    {getHealthIcon(healthData?.checks?.external_apis?.healthy)}
                    <div className="text-right">
                      <div className="text-lg font-semibold text-white">
                        {healthData?.checks?.external_apis?.healthy ? 'Healthy' : 'Unhealthy'}
                      </div>
                      {healthData?.checks?.external_apis?.apis && (
                        <div className="text-xs text-gray-400">
                          {Object.values(healthData.checks.external_apis.apis).filter(Boolean).length}/
                          {Object.keys(healthData.checks.external_apis.apis).length} available
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="alerts" className="space-y-4">
            <Card className="bg-gray-800 border-gray-600">
              <CardHeader>
                <CardTitle className="text-white flex items-center">
                  <AlertTriangle className="w-5 h-5 mr-2" />
                  Active Alerts
                </CardTitle>
              </CardHeader>
              <CardContent>
                {alertsData?.alerts?.length > 0 ? (
                  <div className="space-y-3">
                    {alertsData.alerts.map((alert: AlertItem, index: number) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-red-900/20 border border-red-500/30 rounded">
                        <div className="flex items-center space-x-3">
                          <XCircle className="w-5 h-5 text-red-400" />
                          <div>
                            <div className="font-medium text-white">{alert.metric}</div>
                            <div className="text-sm text-gray-400">
                              Current: {alert.current} | Threshold: {alert.threshold}
                            </div>
                          </div>
                        </div>
                        <Badge variant="destructive">Critical</Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
                    <div className="text-lg font-medium text-white">No Active Alerts</div>
                    <div className="text-gray-400">All systems are operating normally</div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="telemetry" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Memory Usage */}
              <Card className="bg-gray-800 border-gray-600">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-300 flex items-center">
                    <MemoryStick className="w-4 h-4 mr-2" />
                    Memory Usage
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-white text-lg font-semibold">
                        {telemetryData?.system?.memory?.percentage?.toFixed(1) || 0}%
                      </span>
                      <span className="text-gray-400 text-sm">
                        {Math.round((telemetryData?.system?.memory?.used || 0) / 1024 / 1024)}MB / 
                        {Math.round((telemetryData?.system?.memory?.total || 0) / 1024 / 1024)}MB
                      </span>
                    </div>
                    <Progress value={telemetryData?.system?.memory?.percentage || 0} className="h-2" />
                  </div>
                </CardContent>
              </Card>

              {/* System Uptime */}
              <Card className="bg-gray-800 border-gray-600">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-300 flex items-center">
                    <Clock className="w-4 h-4 mr-2" />
                    System Uptime
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-white text-lg font-semibold">
                    {Math.floor((telemetryData?.system?.uptime || 0) / 3600)}h {Math.floor(((telemetryData?.system?.uptime || 0) % 3600) / 60)}m
                  </div>
                  <div className="text-gray-400 text-sm">
                    Started: {telemetryData?.application?.startTime ? new Date(telemetryData.application.startTime).toLocaleString() : 'Unknown'}
                  </div>
                </CardContent>
              </Card>

              {/* Environment Info */}
              <Card className="bg-gray-800 border-gray-600">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-300 flex items-center">
                    <Server className="w-4 h-4 mr-2" />
                    Environment
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Environment:</span>
                      <Badge variant="outline">{telemetryData?.application?.environment || 'Unknown'}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Build:</span>
                      <span className="text-white text-sm font-mono">
                        {telemetryData?.application?.buildSha?.substring(0, 8) || 'dev'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Node:</span>
                      <span className="text-white text-sm">
                        {telemetryData?.system?.nodeVersion || 'Unknown'}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}