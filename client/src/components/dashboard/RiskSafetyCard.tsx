
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { AlertTriangle, Shield, CheckCircle } from 'lucide-react';

interface GuardState {
  totalNotional: number;
  config: {
    maxNotional: number;
    symbolNotionalCap: number;
    maxDrawdown: number;
  };
  drawdownBreaker: {
    active: boolean;
    reason?: string;
  };
  metrics: {
    maxDrawdown: number;
    winRate: number;
  };
}

interface SizingSnapshot {
  symbol: string;
  finalSize: number;
  confidence: number;
  uncertaintyWidth: number;
  timestamp: string;
}

export const RiskSafetyCard: React.FC = () => {
  const [guardState, setGuardState] = useState<GuardState | null>(null);
  const [sizingSnapshot, setSizingSnapshot] = useState<SizingSnapshot | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [guardsResponse, sizingResponse] = await Promise.all([
          fetch('/api/guards/state'),
          fetch('/api/exec/sizing/last')
        ]);

        if (guardsResponse.ok) {
          const guardsData = await guardsResponse.json();
          setGuardState(guardsData);
        }

        if (sizingResponse.ok) {
          const sizingData = await sizingResponse.json();
          setSizingSnapshot(sizingData);
        }
      } catch (error) {
        console.error('Failed to fetch risk data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Risk & Safety</CardTitle>
          <CardDescription>Guard rails and sizing</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse">Loading...</div>
        </CardContent>
      </Card>
    );
  }

  const notionalUsage = guardState ? 
    (guardState.totalNotional / guardState.config.maxNotional) * 100 : 0;

  const getStatusColor = () => {
    if (guardState?.drawdownBreaker.active) return 'text-red-500';
    if (notionalUsage > 80) return 'text-yellow-500';
    return 'text-green-500';
  };

  const getStatusIcon = () => {
    if (guardState?.drawdownBreaker.active) return <AlertTriangle className="h-4 w-4" />;
    if (notionalUsage > 80) return <Shield className="h-4 w-4" />;
    return <CheckCircle className="h-4 w-4" />;
  };

  const getStatusText = () => {
    if (guardState?.drawdownBreaker.active) return 'BREAKER ACTIVE';
    if (notionalUsage > 80) return 'HIGH USAGE';
    return 'HEALTHY';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Risk & Safety</CardTitle>
        <CardDescription>Guard rails and sizing</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Status</span>
          <div className={`flex items-center space-x-1 ${getStatusColor()}`}>
            {getStatusIcon()}
            <Badge variant="outline" className={getStatusColor()}>
              {getStatusText()}
            </Badge>
          </div>
        </div>

        {guardState && (
          <>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Notional Usage</span>
              <div className="flex items-center space-x-2">
                <div className="w-12 bg-gray-200 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full ${
                      notionalUsage > 90 ? 'bg-red-500' : 
                      notionalUsage > 70 ? 'bg-yellow-500' : 'bg-green-500'
                    }`}
                    style={{ width: `${Math.min(notionalUsage, 100)}%` }}
                  />
                </div>
                <span className="font-mono text-xs">
                  {notionalUsage.toFixed(0)}%
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Max Drawdown</span>
              <span className="font-mono text-sm">
                {((guardState.metrics?.maxDrawdown || 0) * 100).toFixed(1)}%
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Win Rate</span>
              <span className="font-mono text-sm">
                {((guardState.metrics?.winRate || 0) * 100).toFixed(1)}%
              </span>
            </div>
          </>
        )}

        {sizingSnapshot && (
          <>
            <hr className="my-2" />
            <div className="text-xs font-medium text-muted-foreground">Latest Sizing</div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Symbol</span>
              <span className="font-mono text-sm">{sizingSnapshot.symbol}</span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Size</span>
              <span className="font-mono text-sm">{sizingSnapshot.finalSize.toFixed(2)}</span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Confidence</span>
              <span className="font-mono text-sm">
                {(sizingSnapshot.confidence * 100).toFixed(0)}%
              </span>
            </div>
          </>
        )}

        {guardState?.drawdownBreaker.active && guardState.drawdownBreaker.reason && (
          <div className="text-xs text-red-600 mt-2">
            {guardState.drawdownBreaker.reason}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
