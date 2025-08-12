
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AlertCircle, CheckCircle, Clock, Zap } from 'lucide-react';

interface ExecutionDecision {
  orderType: 'market' | 'limit';
  executionStyle: 'maker' | 'IOC' | 'FOK' | 'adaptive';
  urgency: 'low' | 'medium' | 'high';
  reasoning: string;
  timeInForce: 'GTC' | 'IOC' | 'FOK';
  postOnly: boolean;
  confidence: number;
  marketConditions: {
    spread: number;
    volatility: number;
    liquidity: string;
  };
}

interface ExecutionRouterProps {
  symbol: string;
  orderSize: number;
  side: 'buy' | 'sell';
  onExecutionChange: (decision: ExecutionDecision) => void;
}

export function ExecutionRouter({ symbol, orderSize, side, onExecutionChange }: ExecutionRouterProps) {
  const [decision, setDecision] = useState<ExecutionDecision | null>(null);
  const [manualOverride, setManualOverride] = useState<string>('auto');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (orderSize > 0) {
      fetchExecutionDecision();
    }
  }, [symbol, orderSize, side]);

  const fetchExecutionDecision = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/execution/decide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol,
          orderSize,
          side,
          urgency: 'medium'
        })
      });
      
      const newDecision = await response.json();
      setDecision(newDecision);
      onExecutionChange(newDecision);
    } catch (error) {
      console.error('Failed to fetch execution decision:', error);
    }
    setLoading(false);
  };

  const getExecutionIcon = (style: string) => {
    switch (style) {
      case 'maker': return <Clock className="w-4 h-4" />;
      case 'IOC': return <Zap className="w-4 h-4" />;
      case 'FOK': return <AlertCircle className="w-4 h-4" />;
      case 'adaptive': return <CheckCircle className="w-4 h-4" />;
      default: return <CheckCircle className="w-4 h-4" />;
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'bg-green-500';
    if (confidence >= 0.6) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const handleManualOverride = (value: string) => {
    setManualOverride(value);
    if (value !== 'auto' && decision) {
      const overriddenDecision = {
        ...decision,
        executionStyle: value as any,
        reasoning: `Manual override: ${value} execution selected by user`,
        confidence: 0.95
      };
      setDecision(overriddenDecision);
      onExecutionChange(overriddenDecision);
    } else if (value === 'auto') {
      fetchExecutionDecision();
    }
  };

  if (!decision && !loading) {
    return (
      <Card data-testid="execution-router-empty">
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground">
            Enter order details to see execution recommendation
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <TooltipProvider>
      <Card data-testid="execution-router-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <span>Execution Router</span>
            {decision && (
              <Badge 
                variant="outline" 
                className="text-xs"
                data-testid="execution-confidence"
              >
                {(decision.confidence * 100).toFixed(0)}% confidence
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {loading ? (
            <div className="flex items-center gap-2" data-testid="execution-loading">
              <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm">Analyzing execution...</span>
            </div>
          ) : decision && (
            <>
              {/* Manual Override Selection */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">
                  Execution Style
                </label>
                <Select 
                  value={manualOverride} 
                  onValueChange={handleManualOverride}
                  data-testid="execution-style-selector"
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto" data-testid="option-auto">Auto (Recommended)</SelectItem>
                    <SelectItem value="maker" data-testid="option-buy" data-testid="option-maker">Maker (Patient)</SelectItem>
                    <SelectItem value="IOC" data-testid="option-sell" data-testid="option-ioc">IOC (Immediate)</SelectItem>
                    <SelectItem value="FOK" data-testid="option-fok">FOK (All or Nothing)</SelectItem>
                    <SelectItem value="adaptive" data-testid="option-adaptive">Adaptive</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Current Recommendation */}
              <div className="space-y-3">
                <div className="flex items-center gap-2" data-testid="execution-recommendation">
                  {getExecutionIcon(decision.executionStyle)}
                  <span className="font-medium">{decision.executionStyle.toUpperCase()}</span>
                  <Badge variant={decision.orderType === 'market' ? 'destructive' : 'secondary'}>
                    {decision.orderType}
                  </Badge>
                  <Badge variant="outline">{decision.timeInForce}</Badge>
                </div>

                {/* Confidence Indicator */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Confidence:</span>
                  <div className="flex-1 bg-gray-200 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full ${getConfidenceColor(decision.confidence)}`}
                      style={{ width: `${decision.confidence * 100}%` }}
                      data-testid="confidence-bar"
                    />
                  </div>
                  <span className="text-xs font-medium">
                    {(decision.confidence * 100).toFixed(0)}%
                  </span>
                </div>

                {/* Market Conditions */}
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="text-center p-2 bg-muted rounded" data-testid="market-spread">
                        <div className="font-medium">{decision.marketConditions.spread.toFixed(1)}</div>
                        <div className="text-muted-foreground">Spread (bps)</div>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Current bid-ask spread in basis points</p>
                    </TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="text-center p-2 bg-muted rounded" data-testid="market-volatility">
                        <div className="font-medium">{(decision.marketConditions.volatility * 100).toFixed(1)}%</div>
                        <div className="text-muted-foreground">Volatility</div>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Estimated short-term volatility</p>
                    </TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="text-center p-2 bg-muted rounded" data-testid="market-liquidity">
                        <div className="font-medium capitalize">{decision.marketConditions.liquidity}</div>
                        <div className="text-muted-foreground">Liquidity</div>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Current market liquidity assessment</p>
                    </TooltipContent>
                  </Tooltip>
                </div>

                {/* Reasoning */}
                <div className="p-3 bg-muted rounded-md" data-testid="execution-reasoning">
                  <div className="text-xs font-medium text-muted-foreground mb-1">
                    Reasoning
                  </div>
                  <p className="text-sm">{decision.reasoning}</p>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
