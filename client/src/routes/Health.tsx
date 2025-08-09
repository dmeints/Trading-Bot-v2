import React from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import TopNavigation from '@/components/layout/TopNavigation';
import SidebarNavigation from '@/components/layout/SidebarNavigation';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertCircle, CheckCircle2, Activity, Database, Server, Cpu, Clock, RefreshCw } from 'lucide-react';

export default function Health() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  
  const { data: health, isLoading, refetch } = useQuery<{data: any}>({
    queryKey: ['/api/health'],
    refetchInterval: 5000, // Auto-refresh every 5 seconds
    retry: 1
  });

  const { data: metrics } = useQuery<string>({
    queryKey: ['/api/metrics'],
    refetchInterval: 10000, // Auto-refresh every 10 seconds
    retry: 1
  });

  const { data: tradingMetrics } = useQuery<{data: any}>({
    queryKey: ['/api/trading/metrics'],
    refetchInterval: 5000, // Auto-refresh every 5 seconds
    retry: 1
  });

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    window.location.href = "/api/login";
    return null;
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'bg-green-500';
      case 'warning': return 'bg-yellow-500';
      case 'critical': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const StatusIcon = ({ status }: { status: string }) => {
    switch (status) {
      case 'healthy': return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'warning': return <AlertCircle className="h-5 w-5 text-yellow-500" />;
      case 'critical': return <AlertCircle className="h-5 w-5 text-red-500" />;
      default: return <Activity className="h-5 w-5 text-gray-500" />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <TopNavigation />
      
      <div className="flex pt-16">
        <SidebarNavigation />
        
        <main className="flex-1 p-6">
          <div className="max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-6">
              <h1 className="text-2xl font-bold">System Health Dashboard</h1>
              <Button onClick={() => refetch()} variant="outline" className="text-white border-gray-600">
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>
            
            {isLoading ? (
              <div className="text-center py-12">
                <div className="text-white">Loading health status...</div>
              </div>
            ) : (
              <Tabs defaultValue="overview" className="w-full">
                <TabsList className="grid grid-cols-3 w-full max-w-md bg-gray-800 mb-6">
                  <TabsTrigger value="overview" className="text-white data-[state=active]:bg-blue-600">
                    Overview
                  </TabsTrigger>
                  <TabsTrigger value="services" className="text-white data-[state=active]:bg-blue-600">
                    Services
                  </TabsTrigger>
                  <TabsTrigger value="metrics" className="text-white data-[state=active]:bg-blue-600">
                    Metrics
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="overview" className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Card className="bg-gray-800 border-gray-700">
                      <CardHeader className="flex flex-row items-center space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-gray-300">Overall Status</CardTitle>
                        <StatusIcon status={health?.data?.status || 'unknown'} />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-white capitalize">
                          {health?.data?.status || 'Unknown'}
                        </div>
                        <Badge className={`mt-2 ${getStatusColor(health?.data?.status || 'unknown')}`}>
                          System Operational
                        </Badge>
                      </CardContent>
                    </Card>

                    <Card className="bg-gray-800 border-gray-700">
                      <CardHeader className="flex flex-row items-center space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-gray-300">Uptime</CardTitle>
                        <Clock className="h-4 w-4" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-white">
                          {health?.data?.uptime || 'N/A'}s
                        </div>
                        <p className="text-xs text-gray-400">
                          Since last restart
                        </p>
                      </CardContent>
                    </Card>

                    <Card className="bg-gray-800 border-gray-700">
                      <CardHeader className="flex flex-row items-center space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-gray-300">Version</CardTitle>
                        <Server className="h-4 w-4" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-white">
                          {health?.data?.version || 'dev'}
                        </div>
                        <p className="text-xs text-gray-400">
                          Build version
                        </p>
                      </CardContent>
                    </Card>
                  </div>

                  <Card className="bg-gray-800 border-gray-700">
                    <CardHeader>
                      <CardTitle className="text-white">System Information</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <h4 className="text-sm font-medium text-gray-300 mb-2">Environment</h4>
                          <Badge variant="outline" className="text-white border-gray-600">
                            {health?.data?.environment || 'development'}
                          </Badge>
                        </div>
                        <div>
                          <h4 className="text-sm font-medium text-gray-300 mb-2">Node.js Version</h4>
                          <span className="text-white">{health?.data?.nodeVersion || process.version}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
                
                <TabsContent value="services" className="space-y-6">
                  <div className="grid gap-4">
                    {health?.data?.services ? Object.entries(health.data.services).map(([name, service]: [string, any]) => (
                      <Card key={name} className="bg-gray-800 border-gray-700">
                        <CardHeader className="flex flex-row items-center space-y-0 pb-2">
                          <CardTitle className="text-sm font-medium text-gray-300 capitalize">
                            {name.replace(/([A-Z])/g, ' $1').trim()}
                          </CardTitle>
                          <StatusIcon status={service.status} />
                        </CardHeader>
                        <CardContent>
                          <div className="flex justify-between items-center">
                            <Badge className={getStatusColor(service.status)}>
                              {service.status}
                            </Badge>
                            {service.responseTime && (
                              <span className="text-sm text-gray-400">
                                {service.responseTime}ms
                              </span>
                            )}
                          </div>
                          {service.message && (
                            <p className="text-sm text-gray-400 mt-2">{service.message}</p>
                          )}
                        </CardContent>
                      </Card>
                    )) : (
                      <div className="text-center py-8 text-gray-400">
                        No service details available
                      </div>
                    )}
                  </div>
                </TabsContent>
                
                <TabsContent value="metrics" className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card className="bg-gray-800 border-gray-700">
                      <CardHeader className="flex flex-row items-center space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-gray-300">Memory Usage</CardTitle>
                        <Cpu className="h-4 w-4" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-white">
                          {health?.data?.memory ? `${Math.round(health.data.memory.used / 1024 / 1024)} MB` : 'N/A'}
                        </div>
                        <p className="text-xs text-gray-400">
                          {health?.data?.memory ? `of ${Math.round(health.data.memory.total / 1024 / 1024)} MB total` : 'Memory info unavailable'}
                        </p>
                      </CardContent>
                    </Card>

                    <Card className="bg-gray-800 border-gray-700">
                      <CardHeader className="flex flex-row items-center space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-gray-300">Database</CardTitle>
                        <Database className="h-4 w-4" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-white">
                          {health?.data?.database?.status || 'Unknown'}
                        </div>
                        <p className="text-xs text-gray-400">
                          Connection status
                        </p>
                      </CardContent>
                    </Card>
                  </div>

                  {metrics && (
                    <Card className="bg-gray-800 border-gray-700">
                      <CardHeader>
                        <CardTitle className="text-white">Prometheus Metrics</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <pre className="text-xs text-gray-300 overflow-auto max-h-64">
                          {metrics}
                        </pre>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>
              </Tabs>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}