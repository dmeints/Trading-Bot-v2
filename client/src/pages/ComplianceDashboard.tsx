import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { 
  Shield,
  AlertTriangle,
  FileText,
  Users,
  Activity,
  Search,
  Download,
  Eye,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Lock,
  Unlock,
  BarChart3
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ComplianceEvent {
  id: string;
  timestamp: string;
  eventType: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  userId?: string;
  resolved: boolean;
  resolvedAt?: string;
}

interface AuditRecord {
  id: string;
  timestamp: string;
  action: string;
  resource: string;
  userId: string;
  ipAddress: string;
  details: Record<string, any>;
}

interface SurveillanceAlert {
  id: string;
  ruleId: string;
  ruleName: string;
  timestamp: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  riskScore: number;
  status: 'open' | 'investigating' | 'closed' | 'false_positive';
}

interface RegulatoryReport {
  id: string;
  reportType: string;
  generatedAt: string;
  generatedBy: string;
  status: 'pending' | 'generated' | 'submitted' | 'acknowledged';
  period: {
    startDate: string;
    endDate: string;
  };
}

interface SurveillanceRule {
  id: string;
  name: string;
  description: string;
  ruleType: string;
  severity: string;
  enabled: boolean;
  parameters: Record<string, any>;
}

export default function ComplianceDashboard() {
  const [surveillanceForm, setSurveillanceForm] = useState({
    tradeId: '',
    userId: '',
    symbol: 'BTC',
    quantity: '',
    price: '',
    value: ''
  });
  const [reportForm, setReportForm] = useState({
    reportType: 'daily_trading',
    startDate: '',
    endDate: ''
  });

  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch compliance events
  const { data: eventsData, isLoading: eventsLoading } = useQuery({
    queryKey: ['/api/compliance/events'],
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  // Fetch audit trail
  const { data: auditData } = useQuery({
    queryKey: ['/api/compliance/audit'],
    refetchInterval: 15000, // Refresh every 15 seconds
  });

  // Fetch surveillance alerts
  const { data: alertsData } = useQuery({
    queryKey: ['/api/compliance/surveillance/alerts'],
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  // Fetch surveillance rules
  const { data: rulesData } = useQuery({
    queryKey: ['/api/compliance/surveillance/rules'],
  });

  // Fetch regulatory reports
  const { data: reportsData } = useQuery({
    queryKey: ['/api/compliance/reports'],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Run surveillance mutation
  const runSurveillance = useMutation({
    mutationFn: async (surveillanceData: any) => {
      const response = await fetch('/api/compliance/surveillance/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(surveillanceData),
      });
      
      if (!response.ok) throw new Error('Failed to run surveillance');
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/compliance/surveillance/alerts'] });
      setSurveillanceForm({
        tradeId: '',
        userId: '',
        symbol: 'BTC',
        quantity: '',
        price: '',
        value: ''
      });
      toast({
        title: "Surveillance Complete",
        description: `${data.data.alerts.length} alerts generated for trade analysis.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to run surveillance.",
        variant: "destructive",
      });
    },
  });

  // Generate report mutation
  const generateReport = useMutation({
    mutationFn: async (reportData: any) => {
      const response = await fetch('/api/compliance/reports/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reportData),
      });
      
      if (!response.ok) throw new Error('Failed to generate report');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/compliance/reports'] });
      setReportForm({
        reportType: 'daily_trading',
        startDate: '',
        endDate: ''
      });
      toast({
        title: "Report Generated",
        description: "Regulatory report has been generated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to generate report.",
        variant: "destructive",
      });
    },
  });

  const events: ComplianceEvent[] = eventsData?.data?.events || [];
  const auditRecords: AuditRecord[] = auditData?.data?.records || [];
  const alerts: SurveillanceAlert[] = alertsData?.data?.alerts || [];
  const rules: SurveillanceRule[] = rulesData?.data?.rules || [];
  const reports: RegulatoryReport[] = reportsData?.data?.reports || [];

  const handleRunSurveillance = () => {
    if (!surveillanceForm.tradeId || !surveillanceForm.userId || !surveillanceForm.quantity || !surveillanceForm.price) {
      toast({
        title: "Error",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    const value = parseFloat(surveillanceForm.quantity) * parseFloat(surveillanceForm.price);
    
    runSurveillance.mutate({
      ...surveillanceForm,
      quantity: parseFloat(surveillanceForm.quantity),
      price: parseFloat(surveillanceForm.price),
      value
    });
  };

  const handleGenerateReport = () => {
    generateReport.mutate({
      ...reportForm,
      generatedBy: 'compliance-dashboard'
    });
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-600';
      case 'high': return 'bg-orange-600';
      case 'medium': return 'bg-yellow-600';
      default: return 'bg-blue-600';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return <XCircle className="w-4 h-4" />;
      case 'high': return <AlertTriangle className="w-4 h-4" />;
      case 'medium': return <AlertCircle className="w-4 h-4" />;
      default: return <CheckCircle className="w-4 h-4" />;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'open': return <Unlock className="w-4 h-4 text-red-600" />;
      case 'investigating': return <Search className="w-4 h-4 text-yellow-600" />;
      case 'closed': return <Lock className="w-4 h-4 text-green-600" />;
      default: return <Eye className="w-4 h-4 text-gray-600" />;
    }
  };

  if (eventsLoading) {
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
          <h1 className="text-2xl font-bold text-foreground">Compliance Dashboard</h1>
          <p className="text-muted-foreground">Institutional compliance and regulatory oversight</p>
        </div>
        <div className="flex items-center space-x-2">
          <Badge variant="secondary">
            Audit Trail: {auditData?.data?.integrity?.valid ? 'Valid' : 'Invalid'}
          </Badge>
          <Badge variant={events.filter(e => !e.resolved).length > 0 ? "destructive" : "secondary"}>
            {events.filter(e => !e.resolved).length} Open Events
          </Badge>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">Compliance Events</div>
            <Shield className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-bold mt-2">{events.length}</div>
          <div className="text-sm text-muted-foreground">
            {events.filter(e => e.severity === 'critical').length} Critical
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">Surveillance Alerts</div>
            <AlertTriangle className="w-4 h-4 text-orange-600" />
          </div>
          <div className="text-2xl font-bold mt-2">{alerts.length}</div>
          <div className="text-sm text-muted-foreground">
            {alerts.filter(a => a.status === 'open').length} Open
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">Audit Records</div>
            <Activity className="w-4 h-4 text-green-600" />
          </div>
          <div className="text-2xl font-bold mt-2">{auditRecords.length}</div>
          <div className="text-sm text-muted-foreground">
            Integrity: {auditData?.data?.integrity?.valid ? 'Valid' : 'Invalid'}
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">Reports</div>
            <FileText className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-2xl font-bold mt-2">{reports.length}</div>
          <div className="text-sm text-muted-foreground">
            {reports.filter(r => r.status === 'generated').length} Generated
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">Rules Active</div>
            <BarChart3 className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-bold mt-2">{rules.filter(r => r.enabled).length}</div>
          <div className="text-sm text-muted-foreground">
            of {rules.length} Total
          </div>
        </Card>
      </div>

      <Tabs defaultValue="events" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="events">Events</TabsTrigger>
          <TabsTrigger value="surveillance">Surveillance</TabsTrigger>
          <TabsTrigger value="audit">Audit Trail</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
          <TabsTrigger value="rules">Rules</TabsTrigger>
        </TabsList>

        {/* Compliance Events Tab */}
        <TabsContent value="events" className="space-y-4">
          <Card className="p-4">
            <h3 className="font-semibold mb-4">Recent Compliance Events</h3>
            
            {events.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                No compliance events recorded
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {events.map((event) => (
                  <div key={event.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      {getSeverityIcon(event.severity)}
                      <div>
                        <div className="font-medium">{event.description}</div>
                        <div className="text-sm text-muted-foreground">
                          {event.eventType} • {new Date(event.timestamp).toLocaleString()}
                          {event.userId && ` • User: ${event.userId}`}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge className={getSeverityColor(event.severity)}>
                        {event.severity.toUpperCase()}
                      </Badge>
                      {event.resolved ? (
                        <CheckCircle className="w-4 h-4 text-green-600" />
                      ) : (
                        <Clock className="w-4 h-4 text-yellow-600" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>

        {/* Surveillance Tab */}
        <TabsContent value="surveillance" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="p-4">
              <h3 className="font-semibold mb-4">Run Trade Surveillance</h3>
              
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="trade-id">Trade ID</Label>
                    <Input
                      id="trade-id"
                      value={surveillanceForm.tradeId}
                      onChange={(e) => setSurveillanceForm(prev => ({ ...prev, tradeId: e.target.value }))}
                      placeholder="TRD-123456"
                      data-testid="input-trade-id"
                    />
                  </div>
                  <div>
                    <Label htmlFor="user-id">User ID</Label>
                    <Input
                      id="user-id"
                      value={surveillanceForm.userId}
                      onChange={(e) => setSurveillanceForm(prev => ({ ...prev, userId: e.target.value }))}
                      placeholder="user-123"
                      data-testid="input-user-id"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="symbol">Symbol</Label>
                    <select
                      id="symbol"
                      value={surveillanceForm.symbol}
                      onChange={(e) => setSurveillanceForm(prev => ({ ...prev, symbol: e.target.value }))}
                      className="w-full p-2 border rounded-md bg-background"
                      data-testid="select-symbol"
                    >
                      <option value="BTC">BTC</option>
                      <option value="ETH">ETH</option>
                      <option value="SOL">SOL</option>
                      <option value="ADA">ADA</option>
                    </select>
                  </div>
                  <div>
                    <Label htmlFor="quantity">Quantity</Label>
                    <Input
                      id="quantity"
                      type="number"
                      step="0.00001"
                      value={surveillanceForm.quantity}
                      onChange={(e) => setSurveillanceForm(prev => ({ ...prev, quantity: e.target.value }))}
                      placeholder="1.5"
                      data-testid="input-quantity"
                    />
                  </div>
                  <div>
                    <Label htmlFor="price">Price</Label>
                    <Input
                      id="price"
                      type="number"
                      step="0.01"
                      value={surveillanceForm.price}
                      onChange={(e) => setSurveillanceForm(prev => ({ ...prev, price: e.target.value }))}
                      placeholder="65000"
                      data-testid="input-price"
                    />
                  </div>
                </div>

                <Button 
                  onClick={handleRunSurveillance} 
                  disabled={runSurveillance.isPending}
                  className="w-full"
                  data-testid="button-run-surveillance"
                >
                  <Search className="w-4 h-4 mr-2" />
                  {runSurveillance.isPending ? 'Running...' : 'Run Surveillance'}
                </Button>
              </div>
            </Card>

            <Card className="p-4">
              <h3 className="font-semibold mb-4">Surveillance Alerts</h3>
              
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {alerts.map((alert) => (
                  <div key={alert.id} className="p-3 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <Badge className={getSeverityColor(alert.severity)}>
                          {alert.severity.toUpperCase()}
                        </Badge>
                        <span className="font-medium">{alert.ruleName}</span>
                      </div>
                      {getStatusIcon(alert.status)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {alert.description}
                    </div>
                    <div className="mt-2 flex justify-between items-center">
                      <span className="text-xs text-muted-foreground">
                        {new Date(alert.timestamp).toLocaleString()}
                      </span>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs">Risk Score:</span>
                        <Progress value={alert.riskScore} className="w-16 h-2" />
                        <span className="text-xs font-medium">{alert.riskScore.toFixed(0)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </TabsContent>

        {/* Audit Trail Tab */}
        <TabsContent value="audit" className="space-y-4">
          <Card className="p-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold">Audit Trail</h3>
              <Badge variant={auditData?.data?.integrity?.valid ? "default" : "destructive"}>
                Integrity: {auditData?.data?.integrity?.valid ? 'Valid' : 'Invalid'}
              </Badge>
            </div>
            
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {auditRecords.map((record) => (
                <div key={record.id} className="flex justify-between items-center p-2 border rounded text-sm">
                  <div className="flex items-center space-x-3">
                    <Activity className="w-4 h-4 text-blue-600" />
                    <div>
                      <span className="font-medium">{record.action}</span>
                      <span className="text-muted-foreground"> on </span>
                      <span className="font-medium">{record.resource}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium">{record.userId}</div>
                    <div className="text-muted-foreground">
                      {new Date(record.timestamp).toLocaleString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>

        {/* Reports Tab */}
        <TabsContent value="reports" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="p-4">
              <h3 className="font-semibold mb-4">Generate Report</h3>
              
              <div className="space-y-4">
                <div>
                  <Label htmlFor="report-type">Report Type</Label>
                  <select
                    id="report-type"
                    value={reportForm.reportType}
                    onChange={(e) => setReportForm(prev => ({ ...prev, reportType: e.target.value }))}
                    className="w-full p-2 border rounded-md bg-background"
                    data-testid="select-report-type"
                  >
                    <option value="daily_trading">Daily Trading</option>
                    <option value="position_report">Position Report</option>
                    <option value="risk_metrics">Risk Metrics</option>
                    <option value="client_activity">Client Activity</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="start-date">Start Date</Label>
                    <Input
                      id="start-date"
                      type="date"
                      value={reportForm.startDate}
                      onChange={(e) => setReportForm(prev => ({ ...prev, startDate: e.target.value }))}
                      data-testid="input-start-date"
                    />
                  </div>
                  <div>
                    <Label htmlFor="end-date">End Date</Label>
                    <Input
                      id="end-date"
                      type="date"
                      value={reportForm.endDate}
                      onChange={(e) => setReportForm(prev => ({ ...prev, endDate: e.target.value }))}
                      data-testid="input-end-date"
                    />
                  </div>
                </div>

                <Button 
                  onClick={handleGenerateReport} 
                  disabled={generateReport.isPending}
                  className="w-full"
                  data-testid="button-generate-report"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  {generateReport.isPending ? 'Generating...' : 'Generate Report'}
                </Button>
              </div>
            </Card>

            <Card className="p-4">
              <h3 className="font-semibold mb-4">Recent Reports</h3>
              
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {reports.map((report) => (
                  <div key={report.id} className="p-3 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">{report.reportType.replace('_', ' ').toUpperCase()}</span>
                      <Badge variant={report.status === 'generated' ? "default" : "secondary"}>
                        {report.status.toUpperCase()}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Generated: {new Date(report.generatedAt).toLocaleDateString()}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Period: {new Date(report.period.startDate).toLocaleDateString()} - {new Date(report.period.endDate).toLocaleDateString()}
                    </div>
                    <div className="mt-2 flex justify-end">
                      <Button size="sm" variant="outline" data-testid={`button-download-${report.id}`}>
                        <Download className="w-3 h-3 mr-1" />
                        Download
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </TabsContent>

        {/* Rules Tab */}
        <TabsContent value="rules" className="space-y-4">
          <Card className="p-4">
            <h3 className="font-semibold mb-4">Surveillance Rules</h3>
            
            <div className="grid gap-4 md:grid-cols-2">
              {rules.map((rule) => (
                <div key={rule.id} className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">{rule.name}</span>
                    <div className="flex items-center space-x-2">
                      <Badge className={getSeverityColor(rule.severity)}>
                        {rule.severity.toUpperCase()}
                      </Badge>
                      {rule.enabled ? (
                        <CheckCircle className="w-4 h-4 text-green-600" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-600" />
                      )}
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground mb-2">
                    {rule.description}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Type: {rule.ruleType} • Status: {rule.enabled ? 'Enabled' : 'Disabled'}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}