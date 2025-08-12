/**
 * Phase J - Real-Time Execution Integration Dashboard
 */

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { AlertTriangle, TrendingUp, Clock, Target, Shield } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";

interface ExecutionDecision {
  orderType: 'MAKER' | 'IOC' | 'FOK';
  confidence: 'LOW' | 'MEDIUM' | 'HIGH';
  expectedFillProbability: number;
  reasoning: string;
  blockedReason?: string;
  riskAssessment: {
    toxicityFlag: boolean;
    spreadAnalysis: number;
    volumeAnalysis: number;
    marketImpact: number;
  };
}

interface ExecutionStatus {
  marketHealth: 'HEALTHY' | 'CAUTION' | 'TOXIC';
  recommendedOrderType: 'MAKER' | 'IOC' | 'FOK';
  currentSpread: number;
  volatility: number;
  lastUpdate: string;
}

export default function ExecutionDashboard() {
  const [selectedSymbol, setSelectedSymbol] = useState('BTCUSDT');
  const [orderForm, setOrderForm] = useState({
    side: 'BUY' /* data-testid="button-buy" */ as 'BUY' | 'SELL',
    quantity: 0.01,
    maxSlippage: 0.005, // 0.5%
    urgency: 'MEDIUM' as 'LOW' | 'MEDIUM' | 'HIGH'
  });

  const queryClient = useQueryClient();

  // Fetch execution status for selected symbol
  const { data: status, isLoading: statusLoading } = useQuery({
    queryKey: ['/api/execution/status', selectedSymbol],
    refetchInterval: 15000, // Refresh every 15 seconds
  });

  // Route execution mutation
  const routeExecution = useMutation({
    mutationFn: async (request: any) => {
      const response = await fetch('/api/execution/route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: selectedSymbol, ...request })
      });
      if (!response.ok) throw new Error('Execution routing failed');
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Execution Routing Complete",
        description: `Recommended: ${data.decision.orderType} with ${data.decision.confidence} confidence`
      });
    },
    onError: (error) => {
      toast({
        title: "Routing Failed",
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: "destructive"
      });
    }
  });

  // Analyze execution scenarios
  const analyzeScenarios = useMutation({
    mutationFn: async (request: any) => {
      const response = await fetch('/api/execution/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: selectedSymbol, ...request })
      });
      if (!response.ok) throw new Error('Analysis failed');
      return response.json();
    }
  });

  const handleRouteOrder = () => {
    routeExecution.mutate(orderForm);
  };

  const handleAnalyzeScenarios = () => {
    analyzeScenarios.mutate(orderForm);
  };

  const getHealthColor = (health: string) => {
    switch (health) {
      case 'HEALTHY': return 'bg-green-500';
      case 'CAUTION': return 'bg-yellow-500';
      case 'TOXIC': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getConfidenceColor = (confidence: string) => {
    switch (confidence) {
      case 'HIGH': return 'bg-green-100 text-green-800';
      case 'MEDIUM': return 'bg-yellow-100 text-yellow-800';
      case 'LOW': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Phase J - Real-Time Execution</h1>
          <p className="text-muted-foreground mt-2">
            Intelligent order routing with risk assessment and market analysis
          </p>
        </div>
        <Badge variant="outline" className="bg-blue-50">
          Phase J: Live
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Market Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Market Status
            </CardTitle>
            <CardDescription>Real-time market health for {selectedSymbol}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Symbol</Label>
              <Select value={selectedSymbol} onValueChange={setSelectedSymbol}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BTCUSDT">BTCUSDT</SelectItem>
                  <SelectItem value="ETHUSDT">ETHUSDT</SelectItem>
                  <SelectItem value="SOLUSDT">SOLUSDT</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {statusLoading ? (
              <div className="space-y-2">
                <div className="h-4 bg-gray-200 rounded animate-pulse" />
                <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4" />
              </div>
            ) : status?.success && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Health</Label>
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${getHealthColor(status.status.marketHealth)}`} />
                    <span className="text-sm font-medium">{status.status.marketHealth}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <Label>Spread</Label>
                  <span className="text-sm font-mono">
                    {(status.status.currentSpread * 100).toFixed(3)}%
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <Label>Volatility</Label>
                  <span className="text-sm font-mono">
                    {(status.status.volatility * 100).toFixed(2)}%
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <Label>Recommended</Label>
                  <Badge variant="outline">{status.status.recommendedOrderType}</Badge>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Order Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Order Configuration
            </CardTitle>
            <CardDescription>Configure order parameters for routing</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="side">Side</Label>
                <Select 
                  value={orderForm.side} 
                  onValueChange={(value) => setOrderForm(prev => ({ ...prev, side: value as 'BUY' | 'SELL' }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BUY">BUY</SelectItem>
                    <SelectItem value="SELL">SELL</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="urgency">Urgency</Label>
                <Select 
                  value={orderForm.urgency} 
                  onValueChange={(value) => setOrderForm(prev => ({ ...prev, urgency: value as any }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LOW">LOW</SelectItem>
                    <SelectItem value="MEDIUM">MEDIUM</SelectItem>
                    <SelectItem value="HIGH">HIGH</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="quantity">Quantity</Label>
              <Input
                id="quantity"
                type="number"
                step="0.001"
                value={orderForm.quantity}
                onChange={(e) => setOrderForm(prev => ({ ...prev, quantity: parseFloat(e.target.value) || 0 }))}
                data-testid="input-quantity"
              />
            </div>

            <div>
              <Label htmlFor="slippage">Max Slippage (%)</Label>
              <Input
                id="slippage"
                type="number"
                step="0.001"
                value={orderForm.maxSlippage * 100}
                onChange={(e) => setOrderForm(prev => ({ ...prev, maxSlippage: (parseFloat(e.target.value) || 0) / 100 }))}
                data-testid="input-slippage"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button 
                onClick={handleRouteOrder}
                disabled={routeExecution.isPending}
                data-testid="button-execute button-route-order button-sell"
              >
                {routeExecution.isPending ? 'Routing...' : 'Route Order'}
              </Button>

              <Button 
                variant="outline" 
                onClick={handleAnalyzeScenarios}
                disabled={analyzeScenarios.isPending}
                data-testid="button-analyze-scenarios"
              >
                {analyzeScenarios.isPending ? 'Analyzing...' : 'Analyze All'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Execution Decision */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Execution Decision
            </CardTitle>
            <CardDescription>Routing recommendation and risk assessment</CardDescription>
          </CardHeader>
          <CardContent>
            {routeExecution.data?.success && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Order Type</Label>
                  <Badge variant="outline">{routeExecution.data.decision.orderType}</Badge>
                </div>

                <div className="flex items-center justify-between">
                  <Label>Confidence</Label>
                  <Badge 
                    className={getConfidenceColor(routeExecution.data.decision.confidence)}
                    data-testid="confidence-pill"
                  >
                    {routeExecution.data.decision.confidence}
                  </Badge>
                </div>

                <div className="flex items-center justify-between">
                  <Label>Fill Probability</Label>
                  <span className="text-sm font-mono">
                    {(routeExecution.data.decision.expectedFillProbability * 100).toFixed(1)}%
                  </span>
                </div>

                {routeExecution.data.decision.blockedReason && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-red-500" />
                      <span className="text-sm font-medium text-red-800" data-testid="why-blocked">
                        {routeExecution.data.decision.blockedReason}
                      </span>
                    </div>
                  </div>
                )}

                <Separator />

                <div>
                  <Label className="text-sm font-medium">Reasoning</Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    {routeExecution.data.decision.reasoning}
                  </p>
                </div>

                <div>
                  <Label className="text-sm font-medium">Risk Assessment</Label>
                  <div className="mt-2 space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span>Toxicity Flag:</span>
                      <span className={routeExecution.data.decision.riskAssessment.toxicityFlag ? 'text-red-600' : 'text-green-600'}>
                        {routeExecution.data.decision.riskAssessment.toxicityFlag ? 'TOXIC' : 'CLEAN'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Market Impact:</span>
                      <span>{routeExecution.data.decision.riskAssessment.marketImpact.toFixed(2)}%</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {!routeExecution.data && (
              <div className="text-center py-8 text-muted-foreground">
                <Clock className="h-8 w-8 mx-auto mb-2" />
                <p>Configure order parameters and click "Route Order" to get execution recommendations</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Risk Presets */}
      <Card>
        <CardHeader>
          <CardTitle>Risk Management Presets</CardTitle>
          <CardDescription>Quick preset configurations for different risk levels</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button
              variant="outline"
              className="h-20 flex flex-col items-center justify-center"
              onClick={() => setOrderForm(prev => ({ ...prev, quantity: prev.quantity * 1, maxSlippage: 0.001, urgency: 'LOW' }))}
              data-testid="risk-preset-1x"
            >
              <span className="font-semibold text-green-600">Conservative</span>
              <span className="text-xs text-muted-foreground">1x Size, 0.1% Slippage</span>
            </Button>

            <Button
              variant="outline"
              className="h-20 flex flex-col items-center justify-center"
              onClick={() => setOrderForm(prev => ({ ...prev, quantity: prev.quantity * 2, maxSlippage: 0.005, urgency: 'MEDIUM' }))}
              data-testid="risk-preset-2x"
            >
              <span className="font-semibold text-blue-600">Moderate</span>
              <span className="text-xs text-muted-foreground">2x Size, 0.5% Slippage</span>
            </Button>

            <Button
              variant="outline"
              className="h-20 flex flex-col items-center justify-center"
              onClick={() => setOrderForm(prev => ({ ...prev, quantity: prev.quantity * 3, maxSlippage: 0.01, urgency: 'HIGH' }))}
              data-testid="risk-preset-3x"
            >
              <span className="font-semibold text-red-600">Aggressive</span>
              <span className="text-xs text-muted-foreground">3x Size, 1.0% Slippage</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Scenario Analysis Results */}
      {analyzeScenarios.data?.success && (
        <Card>
          <CardHeader>
            <CardTitle>Execution Scenario Analysis</CardTitle>
            <CardDescription>Comparison across different urgency levels</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {Object.entries(analyzeScenarios.data.analysis)
                .filter(([key]) => key.includes('urgency'))
                .map(([key, scenario]) => {
                  const s = scenario as ExecutionDecision;
                  return (
                    <div key={key} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium capitalize">{key.replace('_urgency', '').toUpperCase()}</span>
                        <Badge variant="outline">{s.orderType}</Badge>
                      </div>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span>Confidence:</span>
                          <Badge className={getConfidenceColor(s.confidence)}>{s.confidence}</Badge>
                        </div>
                        <div className="flex justify-between">
                          <span>Fill Probability:</span>
                          <span>{(s.expectedFillProbability * 100).toFixed(1)}%</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}