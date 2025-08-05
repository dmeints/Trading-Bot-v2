import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useTradingStore } from '@/stores/tradingStore';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface Recommendation {
  id: string;
  symbol: string;
  action: string;
  entryPrice?: string;
  targetPrice?: string;
  stopLoss?: string;
  confidence: number;
  reasoning?: string;
  status: string;
  createdAt: string;
}

export default function AIRecommendations() {
  const { recommendations } = useTradingStore();

  const { data: fetchedRecommendations, isLoading } = useQuery({
    queryKey: ['/api/ai/recommendations'],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const displayRecommendations = recommendations.length > 0 ? recommendations : (Array.isArray(fetchedRecommendations) ? fetchedRecommendations : []);

  const getConfidenceLevel = (confidence: number) => {
    if (confidence >= 0.8) return { label: 'High Confidence', color: 'bg-green-500/20 text-green-400' };
    if (confidence >= 0.6) return { label: 'Medium Confidence', color: 'bg-amber-500/20 text-amber-400' };
    return { label: 'Low Confidence', color: 'bg-red-500/20 text-red-400' };
  };

  const getRiskRewardRatio = (entryPrice?: string, targetPrice?: string, stopLoss?: string) => {
    if (!entryPrice || !targetPrice || !stopLoss) return null;
    
    const entry = parseFloat(entryPrice);
    const target = parseFloat(targetPrice);
    const stop = parseFloat(stopLoss);
    
    const reward = Math.abs(target - entry);
    const risk = Math.abs(entry - stop);
    
    if (risk === 0) return null;
    
    return (reward / risk).toFixed(2);
  };

  if (isLoading) {
    return (
      <Card className="bg-gray-800 border-gray-700 p-4 h-full">
        <h3 className="text-lg font-semibold text-white mb-4">AI Recommendations</h3>
        <div className="animate-pulse space-y-3">
          {[1, 2].map(i => (
            <div key={i} className="bg-gray-700 rounded-lg p-3 h-20"></div>
          ))}
        </div>
      </Card>
    );
  }

  return (
    <Card className="bg-gray-800 border-gray-700 p-4 h-full overflow-hidden">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">AI Recommendations</h3>
        <Button variant="ghost" size="sm" className="text-blue-400 hover:text-blue-300">
          View All
        </Button>
      </div>
      
      <div className="space-y-3 overflow-y-auto max-h-[calc(100%-4rem)]">
        {Array.isArray(displayRecommendations) && displayRecommendations.length === 0 ? (
          <div className="text-center text-gray-400 py-8">
            <TrendingUp className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No active recommendations</p>
            <p className="text-sm">AI agents are analyzing market conditions</p>
          </div>
        ) : (
          Array.isArray(displayRecommendations) && displayRecommendations.slice(0, 3).map((rec: Recommendation) => {
            const confidenceLevel = getConfidenceLevel(rec.confidence);
            const riskReward = getRiskRewardRatio(rec.entryPrice, rec.targetPrice, rec.stopLoss);
            const isLong = rec.action === 'buy';

            return (
              <Card 
                key={rec.id}
                className="bg-gray-700 p-3 border border-green-500/30"
                data-testid={`card-recommendation-${rec.id}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    {isLong ? (
                      <TrendingUp className="w-4 h-4 text-green-400" />
                    ) : (
                      <TrendingDown className="w-4 h-4 text-red-400" />
                    )}
                    <span className={`text-sm font-medium ${isLong ? 'text-green-400' : 'text-red-400'}`}>
                      {rec.symbol} {isLong ? 'Long' : 'Short'} Position
                    </span>
                  </div>
                  <Badge className={`text-xs px-2 py-1 ${confidenceLevel.color}`}>
                    {confidenceLevel.label}
                  </Badge>
                </div>
                
                {rec.entryPrice && rec.targetPrice && rec.stopLoss && (
                  <div className="text-xs text-gray-400 mb-1">
                    Entry: ${parseFloat(rec.entryPrice).toFixed(2)} | 
                    Target: ${parseFloat(rec.targetPrice).toFixed(2)} | 
                    Stop: ${parseFloat(rec.stopLoss).toFixed(2)}
                  </div>
                )}
                
                <div className="flex items-center justify-between text-xs">
                  {riskReward && (
                    <span className="text-blue-400">
                      Risk/Reward: 1:{riskReward}
                    </span>
                  )}
                  <span className="text-blue-400">
                    Confidence: {Math.round(rec.confidence * 100)}%
                  </span>
                </div>

                {rec.reasoning && (
                  <div className="text-xs text-gray-400 mt-2 line-clamp-2">
                    {rec.reasoning}
                  </div>
                )}
              </Card>
            );
          })
        )}
      </div>
    </Card>
  );
}
