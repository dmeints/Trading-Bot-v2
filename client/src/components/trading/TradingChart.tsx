import { useTradingStore, useSelectedMarketPrice } from '@/stores/tradingStore';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Expand, Settings } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';

export default function TradingChart() {
  const { selectedSymbol } = useTradingStore();
  const selectedPrice = useSelectedMarketPrice();
  const { toast } = useToast();
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
    <Card className="bg-gray-800 border-gray-700 p-fluid-2 h-full overflow-hidden card-chart">
      {/* Desktop/Tablet Header */}
      <div className="hidden md:flex items-center justify-between mb-fluid-2">
        <div className="flex items-center space-x-fluid-2">
          <h3 className="text-fluid-lg font-semibold text-white whitespace-nowrap" data-testid="text-chart-symbol">
            {selectedSymbol}
          </h3>
          <div className="flex space-x-1">
            {timeframes.map(timeframe => (
              <Button
                key={timeframe}
                variant="ghost"
                size="sm"
                onClick={() => setSelectedTimeframe(timeframe)}
                className={`px-fluid-1 py-1 text-fluid-xs ${
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
        <div className="flex items-center space-x-fluid-1 flex-shrink-0">
          <span className="text-fluid-xs text-gray-400 hidden lg:inline">AI Recommendation:</span>
          <span 
            className={`px-2 py-1 rounded text-fluid-xs font-medium ${
              recommendation.action === 'BUY' ? 'bg-green-500/20 text-green-400' :
              recommendation.action === 'SELL' ? 'bg-red-500/20 text-red-400' :
              'bg-gray-500/20 text-gray-400'
            }`}
            data-testid="text-ai-recommendation"
          >
            {recommendation.action}
          </span>
          <span className="text-xs text-gray-400 hidden xl:inline" data-testid="text-ai-confidence">
            {recommendation.confidence}%
          </span>
        </div>
      </div>

      {/* Mobile Header */}
      <div className="block md:hidden mb-fluid-1">
        <div className="flex items-center justify-between mb-fluid-1">
          <h3 className="text-fluid-lg font-semibold text-white" data-testid="text-chart-symbol">
            {selectedSymbol}
          </h3>
          <span 
            className={`px-2 py-1 rounded text-xs font-medium ${
              recommendation.action === 'BUY' ? 'bg-green-500/20 text-green-400' :
              recommendation.action === 'SELL' ? 'bg-red-500/20 text-red-400' :
              'bg-gray-500/20 text-gray-400'
            }`}
            data-testid="text-ai-recommendation"
          >
            {recommendation.action} {recommendation.confidence}%
          </span>
        </div>
        <div className="flex space-x-1 overflow-x-auto scroll-container-x pb-1">
          {timeframes.map(timeframe => (
            <Button
              key={timeframe}
              variant="ghost"
              size="sm"
              onClick={() => setSelectedTimeframe(timeframe)}
              className={`px-3 py-1 text-xs flex-shrink-0 ${
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
      
      {/* Chart Container */}
      <div className="bg-gray-900 rounded border border-gray-600 flex-1 relative overflow-hidden min-h-0">
        <div className="absolute inset-0 p-fluid-1">
          {/* Simulated chart - responsive SVG */}
          <svg className="w-full h-full" viewBox="0 0 800 400" preserveAspectRatio="xMidYMid meet" data-testid="chart-canvas">
            {/* Grid lines */}
            <defs>
              <pattern id="grid" width="40" height="20" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 20" fill="none" stroke="#374151" strokeWidth="0.5"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
            
            {/* Price line - responsive stroke width */}
            <polyline 
              fill="none" 
              stroke="#0EA5E9" 
              strokeWidth="clamp(1.5, 0.5vw, 3)" 
              points="0,200 50,180 100,160 150,170 200,150 250,140 300,130 350,125 400,135 450,145 500,140 550,130 600,125 650,120 700,115 750,110 800,105"
            />
            
            {/* Volume bars - responsive */}
            <g fill="#0EA5E9" fillOpacity="0.3">
              <rect x="10" y="350" width="clamp(6, 1vw, 12)" height="30"/>
              <rect x="30" y="340" width="clamp(6, 1vw, 12)" height="40"/>
              <rect x="50" y="360" width="clamp(6, 1vw, 12)" height="20"/>
              <rect x="70" y="330" width="clamp(6, 1vw, 12)" height="50"/>
              <rect x="90" y="345" width="clamp(6, 1vw, 12)" height="35"/>
            </g>
          </svg>
          
          {/* Chart controls overlay - responsive positioning */}
          <div className="absolute top-fluid-1 right-fluid-1 flex space-x-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                toast({
                  title: "Chart Expand",
                  description: "Full-screen chart view coming soon",
                });
              }}
              className="bg-gray-700 p-fluid-1 text-gray-400 hover:text-white"
              data-testid="button-chart-expand"
            >
              <Expand className="w-fluid-2 h-fluid-2" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                toast({
                  title: "Chart Settings",
                  description: "Chart configuration options coming soon",
                });
              }}
              className="bg-gray-700 p-fluid-1 text-gray-400 hover:text-white hidden sm:flex"
              data-testid="button-chart-settings"
            >
              <Settings className="w-fluid-2 h-fluid-2" />
            </Button>
          </div>

          {/* Current price display - responsive sizing */}
          {selectedPrice && (
            <div className="absolute top-fluid-1 left-fluid-1 bg-gray-800/90 rounded px-fluid-1 py-1 border border-gray-600">
              <div className="text-fluid-base font-semibold text-white" data-testid="text-current-price">
                ${selectedPrice.price.toLocaleString()}
              </div>
              <div className={`text-fluid-xs ${selectedPrice.change24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {selectedPrice.change24h >= 0 ? '+' : ''}{selectedPrice.change24h.toFixed(2)}%
              </div>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
