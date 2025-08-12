
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';

interface RegimeState {
  regime: string;
  confidence: number;
  volatility: number;
  trendStrength: number;
  lastUpdate: string;
}

export const RegimeCard: React.FC = () => {
  const [state, setState] = useState<RegimeState | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchState = async () => {
      try {
        const response = await fetch('/api/regime/state');
        if (response.ok) {
          const data = await response.json();
          setState(data);
        }
      } catch (error) {
        console.error('Failed to fetch regime state:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchState();
    const interval = setInterval(fetchState, 5000);
    return () => clearInterval(interval);
  }, []);

  const getRegimeColor = (regime: string) => {
    switch (regime?.toLowerCase()) {
      case 'bull': return 'bg-green-500';
      case 'bear': return 'bg-red-500';
      case 'sideways': return 'bg-yellow-500';
      default: return 'bg-gray-500';
    }
  };

  const getRegimeVariant = (regime: string) => {
    switch (regime?.toLowerCase()) {
      case 'bull': return 'default';
      case 'bear': return 'destructive';
      case 'sideways': return 'secondary';
      default: return 'outline';
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Market Regime</CardTitle>
          <CardDescription>Current market state detection</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse">Loading...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Market Regime</CardTitle>
        <CardDescription>Current market state detection</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {state ? (
          <>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Regime</span>
              <Badge variant={getRegimeVariant(state.regime)}>
                {state.regime.toUpperCase()}
              </Badge>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Confidence</span>
              <div className="flex items-center space-x-2">
                <div className="w-12 bg-gray-200 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full ${getRegimeColor(state.regime)}`}
                    style={{ width: `${(state.confidence || 0) * 100}%` }}
                  />
                </div>
                <span className="font-mono text-xs">
                  {((state.confidence || 0) * 100).toFixed(0)}%
                </span>
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Volatility</span>
              <span className="font-mono text-sm">
                {((state.volatility || 0) * 100).toFixed(1)}%
              </span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Trend Strength</span>
              <span className="font-mono text-sm">
                {((state.trendStrength || 0) * 100).toFixed(1)}%
              </span>
            </div>
            
            <div className="text-xs text-muted-foreground">
              Last update: {new Date(state.lastUpdate).toLocaleTimeString()}
            </div>
          </>
        ) : (
          <div className="text-sm text-muted-foreground">No data available</div>
        )}
      </CardContent>
    </Card>
  );
};
