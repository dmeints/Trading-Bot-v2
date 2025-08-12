import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { 
  Download, 
  RefreshCw, 
  Trash2, 
  BarChart3, 
  AlertTriangle,
  Database,
  Settings,
  Users,
  Activity,
  CheckCircle2,
  Clock,
  Play
} from 'lucide-react';

interface SystemStats {
  analyticsFileSize: number;
  errorLogSize: number;
  totalEvents: number;
  last24hEvents: number;
  lastUpdated: string;
}

export default function Admin() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [adminSecret, setAdminSecret] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Check for saved admin secret
  useEffect(() => {
    const savedSecret = localStorage.getItem('admin_secret');
    if (savedSecret) {
      setAdminSecret(savedSecret);
      setIsAuthenticated(true);
    }
  }, []);

  const { data: systemStats, refetch: refetchStats } = useQuery<SystemStats>({
    queryKey: ['/api/admin/system/stats'],
    queryFn: async () => {
      const response = await fetch('/api/admin/system/stats', {
        headers: { 'x-admin-secret': adminSecret },
      });
      if (!response.ok) throw new Error('Failed to fetch system stats');
      return response.json();
    },
    enabled: isAuthenticated,
    refetchInterval: 30000,
  });

  const { data: analyticsData } = useQuery<any[]>({
    queryKey: ['/api/admin/analytics'],
    queryFn: async () => {
      const response = await fetch('/api/admin/analytics?limit=100', {
        headers: { 'x-admin-secret': adminSecret },
      });
      if (!response.ok) throw new Error('Failed to fetch analytics');
      return response.json();
    },
    enabled: isAuthenticated,
  });

  const { data: errorLogs } = useQuery<string>({
    queryKey: ['/api/admin/errors'],
    queryFn: async () => {
      const response = await fetch('/api/admin/errors?limit=50', {
        headers: { 'x-admin-secret': adminSecret },
      });
      if (!response.ok) throw new Error('Failed to fetch error logs');
      return response.text();
    },
    enabled: isAuthenticated,
  });

  const generateSummaryMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/admin/generate-summary', {
        method: 'POST',
        headers: { 'x-admin-secret': adminSecret },
      });
      if (!response.ok) throw new Error('Failed to generate summary');
      return response.blob();
    },
    onSuccess: (blob) => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `daily_summary_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      toast({
        title: "Summary Generated",
        description: "Daily summary CSV has been downloaded",
      });
    },
    onError: () => {
      toast({
        title: "Generation Failed",
        description: "Failed to generate daily summary",
        variant: "destructive",
      });
    },
  });

  const clearLogsMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/admin/clear-logs', {
        method: 'POST',
        headers: { 'x-admin-secret': adminSecret },
      });
      if (!response.ok) throw new Error('Failed to clear logs');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin'] });
      toast({
        title: "Logs Cleared",
        description: "All analytics and error logs have been cleared",
      });
    },
    onError: () => {
      toast({
        title: "Clear Failed",
        description: "Failed to clear logs",
        variant: "destructive",
      });
    },
  });

  const handleLogin = async () => {
    try {
      const response = await fetch('/api/admin/system/stats', {
        headers: { 'x-admin-secret': adminSecret },
      });
      
      if (response.ok) {
        localStorage.setItem('admin_secret', adminSecret);
        setIsAuthenticated(true);
        toast({
          title: "Authentication Successful",
          description: "You now have admin access",
        });
      } else {
        toast({
          title: "Authentication Failed",
          description: "Invalid admin secret",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Authentication Error",
        description: "Failed to authenticate",
        variant: "destructive",
      });
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('admin_secret');
    setAdminSecret('');
    setIsAuthenticated(false);
    queryClient.clear();
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <Card className="w-full max-w-md bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white text-center flex items-center justify-center space-x-2">
              <Settings className="w-6 h-6" />
              <span>Admin Access</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="admin-secret" className="text-gray-300">Admin Secret</Label>
              <Input
                id="admin-secret"
                type="password"
                placeholder="Enter admin secret"
                value={adminSecret}
                onChange={(e) => setAdminSecret(e.target.value)}
                className="bg-gray-700 border-gray-600 text-white"
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
              />
            </div>
            <Button 
              onClick={handleLogin}
              className="w-full bg-blue-600 hover:bg-blue-700"
              disabled={!adminSecret}
              data-testid="button-login button-save"
            >
              Login
            </Button>
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Admin access is required to view system analytics and logs.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold flex items-center space-x-3">
            <Settings className="w-8 h-8 text-blue-400" />
            <span>Admin Dashboard</span>
          </h1>
          <Button
            variant="outline"
            onClick={handleLogout}
            className="border-gray-600 text-gray-300 hover:bg-gray-800"
          >
            Logout
          </Button>
        </div>

        {systemStats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <Card className="bg-gray-800 border-gray-700">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-400">Total Events</p>
                    <p className="text-2xl font-bold text-white">{systemStats.totalEvents}</p>
                  </div>
                  <BarChart3 className="w-8 h-8 text-blue-400" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gray-800 border-gray-700">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-400">Last 24h Events</p>
                    <p className="text-2xl font-bold text-white">{systemStats.last24hEvents}</p>
                  </div>
                  <Activity className="w-8 h-8 text-green-400" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gray-800 border-gray-700">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-400">Analytics Size</p>
                    <p className="text-2xl font-bold text-white">{formatBytes(systemStats.analyticsFileSize)}</p>
                  </div>
                  <Database className="w-8 h-8 text-purple-400" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gray-800 border-gray-700">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-400">Error Log Size</p>
                    <p className="text-2xl font-bold text-white">{formatBytes(systemStats.errorLogSize)}</p>
                  </div>
                  <AlertTriangle className="w-8 h-8 text-red-400" />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <div className="flex flex-wrap gap-4 mb-8">
          <Button
            onClick={() => generateSummaryMutation.mutate()}
            disabled={generateSummaryMutation.isPending}
            className="bg-green-600 hover:bg-green-700 flex items-center space-x-2"
          >
            <Download className="w-4 h-4" />
            <span>{generateSummaryMutation.isPending ? 'Generating...' : 'Generate Daily Summary'}</span>
          </Button>

          <Button
            onClick={() => refetchStats()}
            variant="outline"
            className="border-gray-600 text-gray-300 hover:bg-gray-800 flex items-center space-x-2"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Refresh Stats</span>
          </Button>

          <Button
            onClick={() => clearLogsMutation.mutate()}
            disabled={clearLogsMutation.isPending}
            variant="destructive"
            className="flex items-center space-x-2"
          >
            <Trash2 className="w-4 h-4" />
            <span>{clearLogsMutation.isPending ? 'Clearing...' : 'Clear All Logs'}</span>
          </Button>
        </div>

        <Tabs defaultValue="analytics" className="space-y-6">
          <TabsList className="grid grid-cols-4 w-full max-w-4xl bg-gray-800">
            <TabsTrigger value="analytics" className="text-white data-[state=active]:bg-blue-600">
              Analytics Data
            </TabsTrigger>
            <TabsTrigger value="errors" className="text-white data-[state=active]:bg-blue-600">
              Error Logs
            </TabsTrigger>
            <TabsTrigger value="models" className="text-white data-[state=active]:bg-blue-600">
              Models & Webhooks
            </TabsTrigger>
            <TabsTrigger value="testing" className="text-white data-[state=active]:bg-blue-600">
              Webhook Testing
            </TabsTrigger>
          </TabsList>

          <TabsContent value="analytics">
            <Card className="bg-gray-800 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white">Recent Analytics Events</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="max-h-96 overflow-y-auto">
                  {analyticsData && analyticsData.length > 0 ? (
                    <div className="space-y-2">
                      {analyticsData.map((event, index) => (
                        <div key={index} className="p-3 bg-gray-700 rounded text-sm font-mono">
                          <div className="flex items-center justify-between mb-1">
                            <Badge variant="outline" className="text-xs">
                              {event.source}
                            </Badge>
                            <span className="text-gray-400 text-xs">
                              {new Date(event.timestamp).toLocaleString()}
                            </span>
                          </div>
                          <div className="text-gray-300">
                            {event.strategy} • {event.type} • {event.risk} risk • P&L: ${event.pnl}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center text-gray-400 py-8">
                      No analytics data available
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="errors">
            <Card className="bg-gray-800 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white">Error Logs</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="max-h-96 overflow-y-auto">
                  {errorLogs ? (
                    <pre className="text-sm font-mono text-gray-300 whitespace-pre-wrap">
                      {errorLogs}
                    </pre>
                  ) : (
                    <div className="text-center text-gray-400 py-8">
                      No error logs available
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="models">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="bg-gray-800 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-white">Model Management</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Button 
                    onClick={() => window.open('/models', '_blank')}
                    className="w-full bg-blue-600 hover:bg-blue-700"
                  >
                    Open Model Manager
                  </Button>
                  <Button 
                    onClick={() => window.open('/analytics', '_blank')}
                    className="w-full bg-purple-600 hover:bg-purple-700"
                  >
                    Advanced Analytics
                  </Button>
                  <div className="text-sm text-gray-300">
                    <p>• Register and manage AI models</p>
                    <p>• Monitor model performance</p>
                    <p>• Backup and version control</p>
                    <p>• Advanced analytics dashboard</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gray-800 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-white">Webhook Security</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-sm text-gray-300 space-y-2">
                    <div>
                      <strong className="text-white">Trading Webhooks:</strong>
                      <br />
                      <code className="text-xs bg-gray-700 px-2 py-1 rounded">POST /api/webhooks/trading</code>
                      <br />
                      <span className="text-xs">Header: x-trading-signature</span>
                    </div>
                    <div>
                      <strong className="text-white">Market Data Webhooks:</strong>
                      <br />
                      <code className="text-xs bg-gray-700 px-2 py-1 rounded">POST /api/webhooks/market</code>
                      <br />
                      <span className="text-xs">Header: x-market-signature</span>
                    </div>
                    <div>
                      <strong className="text-white">Generic Webhooks:</strong>
                      <br />
                      <code className="text-xs bg-gray-700 px-2 py-1 rounded">POST /api/webhooks/generic</code>
                      <br />
                      <span className="text-xs">Header: x-webhook-signature</span>
                    </div>
                  </div>
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription className="text-xs">
                      All webhooks use HMAC-SHA256 signature verification for security.
                    </AlertDescription>
                  </Alert>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="testing">
            <WebhookTestingPanel adminSecret={adminSecret} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function WebhookTestingPanel({ adminSecret }: { adminSecret: string }) {
  const [isRunning, setIsRunning] = useState(false);
  const { toast } = useToast();
  
  const { data: testHistory, refetch: refetchHistory } = useQuery({
    queryKey: ['/api/admin/webhook/tests'],
    queryFn: async () => {
      const response = await fetch('/api/admin/webhook/tests', {
        headers: { 'x-admin-secret': adminSecret },
      });
      if (!response.ok) throw new Error('Failed to fetch test history');
      return response.json();
    },
    enabled: !!adminSecret,
    refetchInterval: 5000,
  });

  const { data: testStats } = useQuery({
    queryKey: ['/api/admin/webhook/stats'],
    queryFn: async () => {
      const response = await fetch('/api/admin/webhook/stats', {
        headers: { 'x-admin-secret': adminSecret },
      });
      if (!response.ok) throw new Error('Failed to fetch test stats');
      return response.json();
    },
    enabled: !!adminSecret,
    refetchInterval: 10000,
  });

  const runTestsMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/admin/webhook/test', {
        method: 'POST',
        headers: { 'x-admin-secret': adminSecret },
      });
      if (!response.ok) throw new Error('Failed to run tests');
      return response.json();
    },
    onSuccess: () => {
      refetchHistory();
      toast({
        title: "Tests Completed",
        description: "All webhook tests have been executed successfully",
      });
    },
    onError: () => {
      toast({
        title: "Test Failed",
        description: "Failed to execute webhook tests",
        variant: "destructive",
      });
    },
    onSettled: () => {
      setIsRunning(false);
    },
  });

  const clearHistoryMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/admin/webhook/tests', {
        method: 'DELETE',
        headers: { 'x-admin-secret': adminSecret },
      });
      if (!response.ok) throw new Error('Failed to clear history');
      return response.json();
    },
    onSuccess: () => {
      refetchHistory();
      toast({
        title: "History Cleared",
        description: "Test history has been cleared successfully",
      });
    },
  });

  const handleRunTests = () => {
    setIsRunning(true);
    runTestsMutation.mutate();
  };

  return (
    <div className="space-y-6">
      {testStats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-gray-800 border-gray-700">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">Total Tests</p>
                  <p className="text-2xl font-bold text-white">{testStats.totalTests}</p>
                </div>
                <Activity className="w-8 h-8 text-blue-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">Success Rate</p>
                  <p className="text-2xl font-bold text-white">{testStats.successRate?.toFixed(1) || 0}%</p>
                </div>
                {testStats.successRate >= 80 ? (
                  <CheckCircle2 className="w-8 h-8 text-green-400" />
                ) : (
                  <AlertTriangle className="w-8 h-8 text-yellow-400" />
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">Avg Response</p>
                  <p className="text-2xl font-bold text-white">{testStats.averageResponseTime || 0}ms</p>
                </div>
                <Clock className="w-8 h-8 text-purple-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">Last Run</p>
                  <p className="text-sm font-bold text-white">
                    {testStats.lastTestRun ? new Date(testStats.lastTestRun).toLocaleString() : 'Never'}
                  </p>
                </div>
                <Clock className="w-8 h-8 text-orange-400" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="flex space-x-4">
        <Button
          onClick={handleRunTests}
          disabled={isRunning}
          className="bg-green-600 hover:bg-green-700"
        >
          {isRunning ? (
            <>
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              Running Tests...
            </>
          ) : (
            <>
              <Play className="w-4 h-4 mr-2" />
              Run All Tests
            </>
          )}
        </Button>

        <Button
          variant="outline"
          onClick={() => clearHistoryMutation.mutate()}
          disabled={clearHistoryMutation.isPending}
          className="border-gray-600 text-gray-300 hover:bg-gray-700"
        >
          <Trash2 className="w-4 h-4 mr-2" />
          Clear History
        </Button>
      </div>

      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white">Test Results History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-h-96 overflow-y-auto space-y-3">
            {!testHistory || testHistory.length === 0 ? (
              <div className="text-center text-gray-400 py-8">
                No test results available. Run some tests to see results here.
              </div>
            ) : (
              testHistory.map((result: any, index: number) => (
                <div key={index} className="p-4 bg-gray-700 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-3">
                      <div className={`w-3 h-3 rounded-full ${result.success ? 'bg-green-400' : 'bg-red-400'}`} />
                      <span className="text-white font-medium">Test ID: {result.id}</span>
                      <Badge variant={result.success ? 'default' : 'destructive'}>
                        {result.statusCode}
                      </Badge>
                    </div>
                    <span className="text-xs text-gray-400">
                      {new Date(result.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-gray-400">Response Time:</span>
                      <br />
                      <span className="text-white">{result.responseTime}ms</span>
                    </div>
                    <div>
                      <span className="text-gray-400">Success:</span>
                      <br />
                      <span className={result.success ? 'text-green-400' : 'text-red-400'}>
                        {result.success ? 'Yes' : 'No'}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-400">Signature Valid:</span>
                      <br />
                      <span className={result.signatureValid ? 'text-green-400' : 'text-red-400'}>
                        {result.signatureValid ? 'Yes' : 'No'}
                      </span>
                    </div>
                  </div>
                  {result.error && (
                    <div className="mt-2">
                      <span className="text-gray-400 text-sm">Error: </span>
                      <span className="text-red-400 text-sm">{result.error}</span>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}