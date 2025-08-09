import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  BarChart3, 
  TrendingUp, 
  Activity, 
  Clock,
  Target,
  Zap,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RefreshCw
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';

interface AnalyticsData {
  timestamp: string;
  tradeId: string;
  strategy: string;
  regime: 'bull' | 'bear' | 'sideways';
  type: 'scalp' | 'swing' | 'breakout';
  risk: 'low' | 'medium' | 'high';
  source: string;
  pnl: number;
  latencyMs: number;
  signalStrength: number;
  confidence: number;
  metadata?: any;
}

interface SystemMetrics {
  totalEvents: number;
  avgLatency: number;
  avgConfidence: number;
  totalPnL: number;
  successRate: number;
}

export default function Analytics() {
  const [adminSecret] = useState(localStorage.getItem('admin_secret') || '');
  const [timeRange, setTimeRange] = useState('24h');
  const [selectedSource, setSelectedSource] = useState('all');

  const { data: analyticsData, refetch: refetchAnalytics } = useQuery<AnalyticsData[]>({
    queryKey: ['/api/admin/analytics', timeRange],
    queryFn: async () => {
      const limit = timeRange === '1h' ? 100 : timeRange === '24h' ? 1000 : 5000;
      const response = await fetch(`/api/admin/analytics?limit=${limit}`, {
        headers: { 'x-admin-secret': adminSecret },
      });
      if (!response.ok) throw new Error('Failed to fetch analytics');
      return response.json();
    },
    enabled: !!adminSecret,
    refetchInterval: 30000,
  });

  const { data: systemStats } = useQuery({
    queryKey: ['/api/admin/system/stats'],
    queryFn: async () => {
      const response = await fetch('/api/admin/system/stats', {
        headers: { 'x-admin-secret': adminSecret },
      });
      if (!response.ok) throw new Error('Failed to fetch system stats');
      return response.json();
    },
    enabled: !!adminSecret,
    refetchInterval: 15000,
  });

  const filteredData = analyticsData?.filter(item => {
    const timeLimit = Date.now() - (
      timeRange === '1h' ? 60 * 60 * 1000 :
      timeRange === '24h' ? 24 * 60 * 60 * 1000 :
      7 * 24 * 60 * 60 * 1000
    );
    const itemTime = new Date(item.timestamp).getTime();
    const timeMatch = itemTime >= timeLimit;
    const sourceMatch = selectedSource === 'all' || item.source === selectedSource;
    return timeMatch && sourceMatch;
  }) || [];

  const metrics: SystemMetrics = {
    totalEvents: filteredData.length,
    avgLatency: filteredData.reduce((sum, item) => sum + item.latencyMs, 0) / filteredData.length || 0,
    avgConfidence: filteredData.reduce((sum, item) => sum + item.confidence, 0) / filteredData.length || 0,
    totalPnL: filteredData.reduce((sum, item) => sum + item.pnl, 0),
    successRate: filteredData.filter(item => item.pnl > 0).length / filteredData.length * 100 || 0,
  };

  // Prepare chart data
  const timeSeriesData = filteredData
    .slice(-50)
    .map(item => ({
      time: new Date(item.timestamp).toLocaleTimeString(),
      confidence: item.confidence,
      pnl: item.pnl,
      latency: item.latencyMs,
    }));

  const strategyData = Object.entries(
    filteredData.reduce((acc, item) => {
      acc[item.strategy] = (acc[item.strategy] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  ).map(([strategy, count]) => ({ strategy, count }));

  const riskData = Object.entries(
    filteredData.reduce((acc, item) => {
      acc[item.risk] = (acc[item.risk] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  ).map(([risk, count]) => ({ risk, count }));

  const sourceOptions = ['all', ...new Set(analyticsData?.map(item => item.source) || [])];

  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

  if (!adminSecret) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <Alert className="max-w-md">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Admin access required. Please authenticate via the admin panel first.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold flex items-center space-x-3">
            <BarChart3 className="w-8 h-8 text-blue-400" />
            <span>Advanced Analytics</span>
          </h1>
          <div className="flex items-center space-x-4">
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-32 bg-gray-800 border-gray-600 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1h">Last Hour</SelectItem>
                <SelectItem value="24h">Last 24h</SelectItem>
                <SelectItem value="7d">Last 7 Days</SelectItem>
              </SelectContent>
            </Select>
            <Select value={selectedSource} onValueChange={setSelectedSource}>
              <SelectTrigger className="w-48 bg-gray-800 border-gray-600 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {sourceOptions.map(source => (
                  <SelectItem key={source} value={source}>
                    {source === 'all' ? 'All Sources' : source}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetchAnalytics()}
              className="border-gray-600 text-gray-300 hover:bg-gray-800"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
          <Card className="bg-gray-800 border-gray-700">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">Total Events</p>
                  <p className="text-2xl font-bold text-white">{metrics.totalEvents}</p>
                </div>
                <Activity className="w-8 h-8 text-blue-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">Avg Latency</p>
                  <p className="text-2xl font-bold text-white">{Math.round(metrics.avgLatency)}ms</p>
                </div>
                <Clock className="w-8 h-8 text-green-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">Avg Confidence</p>
                  <p className="text-2xl font-bold text-white">{(metrics.avgConfidence * 100).toFixed(1)}%</p>
                </div>
                <Target className="w-8 h-8 text-purple-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">Total P&L</p>
                  <p className={`text-2xl font-bold ${metrics.totalPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    ${metrics.totalPnL.toFixed(2)}
                  </p>
                </div>
                <TrendingUp className="w-8 h-8 text-orange-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">Success Rate</p>
                  <p className="text-2xl font-bold text-white">{metrics.successRate.toFixed(1)}%</p>
                </div>
                {metrics.successRate >= 70 ? (
                  <CheckCircle2 className="w-8 h-8 text-green-400" />
                ) : metrics.successRate >= 50 ? (
                  <AlertTriangle className="w-8 h-8 text-yellow-400" />
                ) : (
                  <XCircle className="w-8 h-8 text-red-400" />
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="charts" className="space-y-6">
          <TabsList className="grid grid-cols-3 w-full max-w-lg bg-gray-800">
            <TabsTrigger value="charts" className="text-white data-[state=active]:bg-blue-600">
              Performance Charts
            </TabsTrigger>
            <TabsTrigger value="breakdown" className="text-white data-[state=active]:bg-blue-600">
              Breakdown Analysis  
            </TabsTrigger>
            <TabsTrigger value="events" className="text-white data-[state=active]:bg-blue-600">
              Recent Events
            </TabsTrigger>
          </TabsList>

          <TabsContent value="charts">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="bg-gray-800 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-white">Confidence & P&L Over Time</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={timeSeriesData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="time" stroke="#9CA3AF" />
                      <YAxis stroke="#9CA3AF" />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '0.5rem' }}
                        labelStyle={{ color: '#F3F4F6' }}
                      />
                      <Line type="monotone" dataKey="confidence" stroke="#3B82F6" strokeWidth={2} />
                      <Line type="monotone" dataKey="pnl" stroke="#10B981" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="bg-gray-800 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-white">Response Latency</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={timeSeriesData.slice(-20)}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="time" stroke="#9CA3AF" />
                      <YAxis stroke="#9CA3AF" />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '0.5rem' }}
                        labelStyle={{ color: '#F3F4F6' }}
                      />
                      <Bar dataKey="latency" fill="#F59E0B" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="breakdown">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="bg-gray-800 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-white">Strategy Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={strategyData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ strategy, percent }) => `${strategy} (${(percent * 100).toFixed(0)}%)`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="count"
                      >
                        {strategyData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '0.5rem' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="bg-gray-800 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-white">Risk Profile</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={riskData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="risk" stroke="#9CA3AF" />
                      <YAxis stroke="#9CA3AF" />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '0.5rem' }}
                        labelStyle={{ color: '#F3F4F6' }}
                      />
                      <Bar dataKey="count" fill="#8B5CF6" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="events">
            <Card className="bg-gray-800 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white">Recent Analytics Events</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="max-h-96 overflow-y-auto space-y-3">
                  {filteredData.slice(0, 50).map((event, index) => (
                    <div key={index} className="p-4 bg-gray-700 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-3">
                          <Badge variant="outline" className="text-xs">
                            {event.source}
                          </Badge>
                          <Badge 
                            className={`text-xs ${
                              event.risk === 'low' ? 'bg-green-500' :
                              event.risk === 'medium' ? 'bg-yellow-500' : 'bg-red-500'
                            }`}
                          >
                            {event.risk}
                          </Badge>
                        </div>
                        <span className="text-xs text-gray-400">
                          {new Date(event.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-gray-400">Strategy:</span>
                          <br />
                          <span className="text-white">{event.strategy}</span>
                        </div>
                        <div>
                          <span className="text-gray-400">P&L:</span>
                          <br />
                          <span className={event.pnl >= 0 ? 'text-green-400' : 'text-red-400'}>
                            ${(event.pnl || 0).toFixed(2)}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-400">Confidence:</span>
                          <br />
                          <span className="text-white">{((event.confidence || 0) * 100).toFixed(1)}%</span>
                        </div>
                        <div>
                          <span className="text-gray-400">Latency:</span>
                          <br />
                          <span className="text-white">{event.latencyMs}ms</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}