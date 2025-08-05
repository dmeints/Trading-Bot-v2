import { useTradingStore, useSelectedMarketPrice } from '@/stores/tradingStore';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Expand, Settings } from 'lucide-react';
import { useState } from 'react';

export default function TradingChart() {
  const { selectedSymbol } = useTradingStore();
  const selectedPrice = useSelectedMarketPrice();
  const [selectedTimeframe, setSelectedTimeframe] = useState('1H');

  const timeframes = ['1H', '4H', '1D', '1W'];

  const getAIRecommendation = () => {
    if (!selectedPrice) return { action: 'HOLD', confidence: 0 };
    
    // Simple logic for demonstration
    const change = selectedPrice.change24h;
    if (change > 3) return { action: 'BUY', confidence: 92 };
    if (change < -3) return { action: 'SELL', confidence: 88 };
    return { action: 'HOLD', confidence: 65 };
  };

  const recommendation = getAIRecommendation();

  return (
    <Card className="bg-gray-800 border-gray-700 p-4 h-full">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-4">
          <h3 className="text-lg font-semibold text-white" data-testid="text-chart-symbol">
            {selectedSymbol}
          </h3>
          <div className="flex space-x-2">
            {timeframes.map(timeframe => (
              <Button
                key={timeframe}
                variant="ghost"
                size="sm"
                onClick={() => setSelectedTimeframe(timeframe)}
                className={`px-3 py-1 text-xs ${
                  selectedTimeframe === timeframe
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
                data-testid={`button-timeframe-${timeframe}`}
              >
                {timeframe}
              </Button>
            ))}
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-400">AI Recommendation:</span>
          <span 
            className={`px-2 py-1 rounded text-sm font-medium ${
              recommendation.action === 'BUY' ? 'bg-green-500/20 text-green-400' :
              recommendation.action === 'SELL' ? 'bg-red-500/20 text-red-400' :
              'bg-gray-500/20 text-gray-400'
            }`}
            data-testid="text-ai-recommendation"
          >
            {recommendation.action}
          </span>
          <span className="text-xs text-gray-400" data-testid="text-ai-confidence">
            Confidence: {recommendation.confidence}%
          </span>
        </div>
      </div>
      
      {/* Chart Container */}
      <div className="bg-gray-900 rounded border border-gray-600 h-full relative overflow-hidden">
        <div className="absolute inset-0 p-4">
          {/* Simulated chart - in production, integrate with TradingView or similar */}
          <svg className="w-full h-full" viewBox="0 0 800 400" data-testid="chart-canvas">
            {/* Grid lines */}
            <defs>
              <pattern id="grid" width="40" height="20" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 20" fill="none" stroke="#374151" strokeWidth="0.5"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
            
            {/* Price line */}
            <polyline 
              fill="none" 
              stroke="#0EA5E9" 
              strokeWidth="2" 
              points="0,200 50,180 100,160 150,170 200,150 250,140 300,130 350,125 400,135 450,145 500,140 550,130 600,125 650,120 700,115 750,110 800,105"
            />
            
            {/* Volume bars */}
            <g fill="#0EA5E9" fillOpacity="0.3">
              <rect x="10" y="350" width="8" height="30"/>
              <rect x="30" y="340" width="8" height="40"/>
              <rect x="50" y="360" width="8" height="20"/>
              <rect x="70" y="330" width="8" height="50"/>
              <rect x="90" y="345" width="8" height="35"/>
            </g>
          </svg>
          
          {/* Chart controls overlay */}
          <div className="absolute top-4 right-4 flex space-x-2">
            <Button
              variant="ghost"
              size="sm"
              className="bg-gray-700 p-2 text-gray-400 hover:text-white"
              data-testid="button-chart-expand"
            >
              <Expand className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="bg-gray-700 p-2 text-gray-400 hover:text-white"
              data-testid="button-chart-settings"
            >
              <Settings className="w-4 h-4" />
            </Button>
          </div>

          {/* Current price display */}
          {selectedPrice && (
            <div className="absolute top-4 left-4 bg-gray-800/90 rounded px-3 py-2 border border-gray-600">
              <div className="text-lg font-semibold text-white" data-testid="text-current-price">
                ${selectedPrice.price.toLocaleString()}
              </div>
              <div className={`text-sm ${selectedPrice.change24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {selectedPrice.change24h >= 0 ? '+' : ''}{selectedPrice.change24h.toFixed(2)}%
              </div>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
