import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { 
  TrendingUp, 
  BarChart3, 
  Activity, 
  Waves,
  Target,
  Zap,
  Settings
} from 'lucide-react';

interface Indicator {
  id: string;
  name: string;
  shortName: string;
  description: string;
  icon: React.ReactNode;
  enabled: boolean;
  category: 'trend' | 'momentum' | 'volume' | 'volatility';
  color: string;
}

const availableIndicators: Indicator[] = [
  {
    id: 'rsi',
    name: 'Relative Strength Index',
    shortName: 'RSI',
    description: 'Momentum oscillator measuring speed and change of price movements',
    icon: <Activity className="w-4 h-4" />,
    enabled: false,
    category: 'momentum',
    color: '#8b5cf6'
  },
  {
    id: 'macd',
    name: 'MACD',
    shortName: 'MACD',
    description: 'Moving Average Convergence Divergence - trend-following momentum indicator',
    icon: <TrendingUp className="w-4 h-4" />,
    enabled: false,
    category: 'trend',
    color: '#3b82f6'
  },
  {
    id: 'bb',
    name: 'Bollinger Bands',
    shortName: 'BB',
    description: 'Volatility bands placed above and below moving average',
    icon: <Waves className="w-4 h-4" />,
    enabled: false,
    category: 'volatility',
    color: '#f59e0b'
  },
  {
    id: 'sma',
    name: 'Simple Moving Average',
    shortName: 'SMA',
    description: 'Average price over a specified number of periods',
    icon: <BarChart3 className="w-4 h-4" />,
    enabled: true,
    category: 'trend',
    color: '#10b981'
  },
  {
    id: 'ema',
    name: 'Exponential Moving Average',
    shortName: 'EMA',
    description: 'Moving average giving more weight to recent prices',
    icon: <Zap className="w-4 h-4" />,
    enabled: false,
    category: 'trend',
    color: '#ef4444'
  },
  {
    id: 'volume',
    name: 'Volume',
    shortName: 'VOL',
    description: 'Trading volume indicator',
    icon: <BarChart3 className="w-4 h-4" />,
    enabled: true,
    category: 'volume',
    color: '#6b7280'
  },
  {
    id: 'stoch',
    name: 'Stochastic',
    shortName: 'STOCH',
    description: 'Momentum indicator comparing closing price to price range',
    icon: <Target className="w-4 h-4" />,
    enabled: false,
    category: 'momentum',
    color: '#ec4899'
  }
];

export default function ChartIndicatorsPanel() {
  const [indicators, setIndicators] = useState<Indicator[]>(availableIndicators);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const toggleIndicator = (id: string) => {
    setIndicators(prev =>
      prev.map(indicator =>
        indicator.id === id
          ? { ...indicator, enabled: !indicator.enabled }
          : indicator
      )
    );
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'trend': return 'bg-blue-600/20 text-blue-400';
      case 'momentum': return 'bg-purple-600/20 text-purple-400';
      case 'volume': return 'bg-green-600/20 text-green-400';
      case 'volatility': return 'bg-orange-600/20 text-orange-400';
      default: return 'bg-gray-600/20 text-gray-400';
    }
  };

  const filteredIndicators = selectedCategory === 'all'
    ? indicators
    : indicators.filter(indicator => indicator.category === selectedCategory);

  const enabledCount = indicators.filter(i => i.enabled).length;

  return (
    <Card className="bg-gray-800 border-gray-700 p-4 h-full overflow-hidden">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <h3 className="text-lg font-semibold text-white">Chart Indicators</h3>
          <Badge variant="secondary" className="text-xs">
            {enabledCount} active
          </Badge>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="text-gray-400 hover:text-white"
        >
          <Settings className="w-4 h-4" />
        </Button>
      </div>

      {/* Category Filter */}
      <div className="flex flex-wrap gap-2 mb-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSelectedCategory('all')}
          className={`text-xs ${
            selectedCategory === 'all'
              ? 'bg-blue-600 text-white'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          All
        </Button>
        {['trend', 'momentum', 'volume', 'volatility'].map((category) => (
          <Button
            key={category}
            variant="ghost"
            size="sm"
            onClick={() => setSelectedCategory(category)}
            className={`text-xs capitalize ${
              selectedCategory === category
                ? 'bg-blue-600 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            {category}
          </Button>
        ))}
      </div>

      {/* Indicators List */}
      <div className="space-y-3 overflow-y-auto flex-1">
        {filteredIndicators.map((indicator) => (
          <div
            key={indicator.id}
            className="bg-gray-900 rounded-lg p-3 hover:bg-gray-700 transition-colors"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-3">
                <div
                  className="p-2 rounded-lg"
                  style={{ backgroundColor: `${indicator.color}20`, color: indicator.color }}
                >
                  {indicator.icon}
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-white font-medium">{indicator.shortName}</span>
                    <Badge
                      variant="secondary"
                      className={`text-xs ${getCategoryColor(indicator.category)}`}
                    >
                      {indicator.category}
                    </Badge>
                  </div>
                  <span className="text-xs text-gray-400">{indicator.name}</span>
                </div>
              </div>
              <Switch
                checked={indicator.enabled}
                onCheckedChange={() => toggleIndicator(indicator.id)}
              />
            </div>
            <p className="text-xs text-gray-400 leading-relaxed">
              {indicator.description}
            </p>
            {indicator.enabled && (
              <div className="mt-2 flex items-center space-x-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: indicator.color }}
                />
                <span className="text-xs text-gray-300">Active on chart</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="mt-4 pt-4 border-t border-gray-700">
        <div className="flex space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIndicators(prev => prev.map(i => ({ ...i, enabled: true })))}
            className="flex-1 text-xs bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600"
          >
            Enable All
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIndicators(prev => prev.map(i => ({ ...i, enabled: false })))}
            className="flex-1 text-xs bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600"
          >
            Disable All
          </Button>
        </div>
      </div>
    </Card>
  );
}