
/**
 * Safe Promotion Dashboard
 * UI for shadow mode validation and gradual ramp-up monitoring
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Progress } from '../components/ui/progress';
import { Badge } from '../components/ui/badge';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { 
  CheckCircle, 
  Clock, 
  AlertTriangle, 
  TrendingUp, 
  TrendingDown,
  Play,
  Pause,
  SkipForward,
  RotateCcw
} from 'lucide-react';

interface ShadowStatus {
  isRunning: boolean;
  startTime: Date;
  elapsedHours: number;
  samplesCollected: number;
  completedTrades: number;
  requiredSamples: number;
}

interface ShadowResult {
  approved: boolean;
  confidence: number;
  validationPeriodHours: number;
  samplesProcessed: number;
  performanceMetrics: {
    coverage: number;
    coverageGap: number;
    avgIntervalWidth: number;
    sharpeRatio: number;
    maxDrawdown: number;
    winRate: number;
    profitFactor: number;
  };
  thresholdChecks: {
    coverageCheck: boolean;
    gapCheck: boolean;
    widthCheck: boolean;
    sharpeCheck: boolean;
    drawdownCheck: boolean;
  };
  issues: string[];
  recommendations: string[];
}

interface PromotionStatus {
  currentStep: number;
  currentNotional: number;
  isLive: boolean;
  canAdvance: boolean;
  needsRollback: boolean;
  stepPerformance: {
    tradesInStep: number;
    sharpeRatio: number;
    winRate: number;
    maxDrawdown: number;
    consecutiveLosses: number;
  };
  nextStepRequirements: {
    minTrades: number;
    currentTrades: number;
    performanceMet: boolean;
  };
}

export default function SafePromotionDashboard() {
  const [shadowStatus, setShadowStatus] = useState<ShadowStatus | null>(null);
  const [shadowResult, setShadowResult] = useState<ShadowResult | null>(null);
  const [promotionStatus, setPromotionStatus] = useState<PromotionStatus | null>(null);
  const [promotionHistory, setPromotionHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch status on component mount and periodically
  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000); // Update every 5 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchStatus = async () => {
    try {
      const response = await fetch('/api/safe-promotion/status');
      const data = await response.json();
      
      if (data.success) {
        if (data.system.shadowMode.status) {
          setShadowStatus(data.system.shadowMode.status);
        }
        if (data.system.promotion.status) {
          setPromotionStatus(data.system.promotion.status);
        }
      }
    } catch (err) {
      console.error('Failed to fetch status:', err);
    }
  };

  const fetchShadowResult = async () => {
    try {
      const response = await fetch('/api/safe-promotion/shadow/result');
      const data = await response.json();
      
      if (data.success) {
        setShadowResult(data.result);
      }
    } catch (err) {
      console.error('Failed to fetch shadow result:', err);
    }
  };

  const fetchPromotionHistory = async () => {
    try {
      const response = await fetch('/api/safe-promotion/promotion/status');
      const data = await response.json();
      
      if (data.success && data.promotionHistory) {
        setPromotionHistory(data.promotionHistory);
      }
    } catch (err) {
      console.error('Failed to fetch promotion history:', err);
    }
  };

  const startShadowMode = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/safe-promotion/shadow/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          validationPeriodHours: 24,
          requiredSamples: 100
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setShadowStatus(data.status);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to start shadow mode');
    } finally {
      setLoading(false);
    }
  };

  const stopShadowMode = async () => {
    setLoading(true);
    
    try {
      const response = await fetch('/api/safe-promotion/shadow/stop', {
        method: 'POST'
      });
      
      if (response.ok) {
        setShadowStatus(null);
      }
    } catch (err) {
      setError('Failed to stop shadow mode');
    } finally {
      setLoading(false);
    }
  };

  const initializePromotion = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/safe-promotion/promotion/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          initialNotional: 0.005,
          maxNotional: 0.02,
          rampUpSteps: [0.005, 0.01, 0.015, 0.02]
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setPromotionStatus(data.promotionStatus);
        await fetchPromotionHistory();
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to initialize promotion');
    } finally {
      setLoading(false);
    }
  };

  const advancePromotion = async (adminOverride: boolean = false) => {
    setLoading(true);
    
    try {
      const response = await fetch('/api/safe-promotion/promotion/advance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminOverride })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setPromotionStatus(data.promotionStatus);
        await fetchPromotionHistory();
      }
    } catch (err) {
      setError('Failed to advance promotion');
    } finally {
      setLoading(false);
    }
  };

  const rollbackPromotion = async () => {
    setLoading(true);
    
    try {
      const response = await fetch('/api/safe-promotion/promotion/rollback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Manual rollback from dashboard' })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setPromotionStatus(data.promotionStatus);
        await fetchPromotionHistory();
      }
    } catch (err) {
      setError('Failed to rollback promotion');
    } finally {
      setLoading(false);
    }
  };

  const formatPercentage = (value: number) => `${(value * 100).toFixed(1)}%`;
  const formatNumber = (value: number, decimals: number = 2) => value.toFixed(decimals);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Safe Promotion Dashboard</h1>
        <Badge variant={promotionStatus?.isLive ? 'default' : 'secondary'}>
          {promotionStatus?.isLive ? 'Live Trading' : 'Shadow Mode'}
        </Badge>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="shadow" className="space-y-4">
        <TabsList>
          <TabsTrigger value="shadow">Shadow Mode</TabsTrigger>
          <TabsTrigger value="promotion">Live Promotion</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="shadow" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Shadow Mode Validation
                {shadowStatus?.isRunning ? (
                  <Badge variant="default" className="animate-pulse">Running</Badge>
                ) : (
                  <Badge variant="secondary">Stopped</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!shadowStatus?.isRunning ? (
                <div className="space-y-4">
                  <p className="text-muted-foreground">
                    Start shadow mode validation to test conformal predictions without executing trades.
                  </p>
                  <Button 
                    onClick={startShadowMode}
                    disabled={loading}
                    className="gap-2"
                  >
                    <Play className="h-4 w-4" />
                    Start Shadow Mode
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <div className="text-sm text-muted-foreground">Elapsed Time</div>
                      <div className="text-xl font-bold">
                        {shadowStatus.elapsedHours.toFixed(1)}h
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Samples</div>
                      <div className="text-xl font-bold">
                        {shadowStatus.samplesCollected}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Completed</div>
                      <div className="text-xl font-bold">
                        {shadowStatus.completedTrades}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Progress</div>
                      <div className="text-xl font-bold">
                        {formatPercentage(shadowStatus.completedTrades / shadowStatus.requiredSamples)}
                      </div>
                    </div>
                  </div>

                  <Progress 
                    value={Math.min(100, (shadowStatus.completedTrades / shadowStatus.requiredSamples) * 100)}
                    className="w-full"
                  />

                  <div className="flex gap-2">
                    <Button 
                      onClick={stopShadowMode}
                      variant="outline"
                      disabled={loading}
                      className="gap-2"
                    >
                      <Pause className="h-4 w-4" />
                      Stop
                    </Button>
                    <Button 
                      onClick={fetchShadowResult}
                      variant="outline"
                      disabled={loading}
                    >
                      Get Result
                    </Button>
                  </div>
                </div>
              )}

              {shadowResult && (
                <div className="mt-6 space-y-4">
                  <h3 className="text-lg font-semibold">Validation Result</h3>
                  
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div>
                      <div className="text-sm text-muted-foreground">Approval Status</div>
                      <div className="flex items-center gap-2">
                        {shadowResult.approved ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <AlertTriangle className="h-4 w-4 text-red-500" />
                        )}
                        <span className={shadowResult.approved ? 'text-green-500' : 'text-red-500'}>
                          {shadowResult.approved ? 'Approved' : 'Rejected'}
                        </span>
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Confidence</div>
                      <div className="text-xl font-bold">
                        {formatPercentage(shadowResult.confidence)}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Samples</div>
                      <div className="text-xl font-bold">
                        {shadowResult.samplesProcessed}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <div>
                      <div className="text-sm text-muted-foreground">Coverage</div>
                      <div className="text-lg font-bold">
                        {formatPercentage(shadowResult.performanceMetrics.coverage)}
                      </div>
                      {shadowResult.thresholdChecks.coverageCheck ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-red-500" />
                      )}
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Sharpe Ratio</div>
                      <div className="text-lg font-bold">
                        {formatNumber(shadowResult.performanceMetrics.sharpeRatio)}
                      </div>
                      {shadowResult.thresholdChecks.sharpeCheck ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-red-500" />
                      )}
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Win Rate</div>
                      <div className="text-lg font-bold">
                        {formatPercentage(shadowResult.performanceMetrics.winRate)}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Max Drawdown</div>
                      <div className="text-lg font-bold">
                        {formatPercentage(shadowResult.performanceMetrics.maxDrawdown)}
                      </div>
                      {shadowResult.thresholdChecks.drawdownCheck ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-red-500" />
                      )}
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Interval Width</div>
                      <div className="text-lg font-bold">
                        {formatPercentage(shadowResult.performanceMetrics.avgIntervalWidth)}
                      </div>
                      {shadowResult.thresholdChecks.widthCheck ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-red-500" />
                      )}
                    </div>
                  </div>

                  {shadowResult.issues.length > 0 && (
                    <div>
                      <h4 className="font-medium text-red-500">Issues:</h4>
                      <ul className="list-disc list-inside space-y-1">
                        {shadowResult.issues.map((issue, index) => (
                          <li key={index} className="text-sm text-red-600">{issue}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {shadowResult.recommendations.length > 0 && (
                    <div>
                      <h4 className="font-medium text-blue-500">Recommendations:</h4>
                      <ul className="list-disc list-inside space-y-1">
                        {shadowResult.recommendations.map((rec, index) => (
                          <li key={index} className="text-sm text-blue-600">{rec}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {shadowResult.approved && (
                    <Button 
                      onClick={initializePromotion}
                      disabled={loading}
                      className="gap-2"
                    >
                      <TrendingUp className="h-4 w-4" />
                      Initialize Live Promotion
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="promotion" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Live Promotion Status
                {promotionStatus?.isLive ? (
                  <Badge variant="default">Active</Badge>
                ) : (
                  <Badge variant="secondary">Inactive</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!promotionStatus?.isLive ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground mb-4">
                    Complete shadow mode validation to initialize live promotion.
                  </p>
                  <Button disabled>Initialize Promotion</Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <div className="text-sm text-muted-foreground">Current Step</div>
                      <div className="text-xl font-bold">
                        {promotionStatus.currentStep + 1}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Notional Size</div>
                      <div className="text-xl font-bold">
                        {formatPercentage(promotionStatus.currentNotional)}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Trades in Step</div>
                      <div className="text-xl font-bold">
                        {promotionStatus.stepPerformance.tradesInStep}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Win Rate</div>
                      <div className="text-xl font-bold">
                        {formatPercentage(promotionStatus.stepPerformance.winRate)}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div>
                      <div className="text-sm text-muted-foreground">Sharpe Ratio</div>
                      <div className="text-lg font-bold">
                        {formatNumber(promotionStatus.stepPerformance.sharpeRatio)}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Max Drawdown</div>
                      <div className="text-lg font-bold">
                        {formatPercentage(promotionStatus.stepPerformance.maxDrawdown)}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Consecutive Losses</div>
                      <div className="text-lg font-bold">
                        {promotionStatus.stepPerformance.consecutiveLosses}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Progress to Next Step</span>
                      <span>
                        {promotionStatus.nextStepRequirements.currentTrades}/
                        {promotionStatus.nextStepRequirements.minTrades} trades
                      </span>
                    </div>
                    <Progress 
                      value={Math.min(100, (promotionStatus.nextStepRequirements.currentTrades / promotionStatus.nextStepRequirements.minTrades) * 100)}
                      className="w-full"
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button 
                      onClick={() => advancePromotion(false)}
                      disabled={!promotionStatus.canAdvance || loading}
                      className="gap-2"
                    >
                      <SkipForward className="h-4 w-4" />
                      Advance Step
                    </Button>
                    <Button 
                      onClick={() => advancePromotion(true)}
                      variant="outline"
                      disabled={loading}
                      className="gap-2"
                    >
                      <SkipForward className="h-4 w-4" />
                      Force Advance
                    </Button>
                    <Button 
                      onClick={rollbackPromotion}
                      variant="destructive"
                      disabled={loading}
                      className="gap-2"
                    >
                      <RotateCcw className="h-4 w-4" />
                      Rollback
                    </Button>
                  </div>

                  {promotionStatus.needsRollback && (
                    <Alert variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        Performance triggers indicate rollback may be needed.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Promotion History</CardTitle>
            </CardHeader>
            <CardContent>
              {promotionHistory.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No promotion history available.
                </p>
              ) : (
                <div className="space-y-4">
                  {promotionHistory.map((step, index) => (
                    <div key={index} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium">Step {step.step + 1}</h4>
                        <Badge variant={step.completed ? 'default' : 'secondary'}>
                          {step.completed ? 'Completed' : 'Current'}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Notional:</span>
                          <span className="ml-2 font-medium">
                            {formatPercentage(step.notional)}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Trades:</span>
                          <span className="ml-2 font-medium">{step.trades}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Total P&L:</span>
                          <span className={`ml-2 font-medium ${step.totalPnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                            ${step.totalPnl.toFixed(2)}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Win Rate:</span>
                          <span className="ml-2 font-medium">
                            {formatPercentage(step.winRate)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
