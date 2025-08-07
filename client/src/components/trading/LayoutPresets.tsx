import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  LayoutGrid, 
  LineChart, 
  Brain, 
  TrendingUp,
  Monitor,
  Smartphone 
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface LayoutPreset {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  badge?: string;
  config: any; // Layout configuration
}

const layoutPresets: LayoutPreset[] = [
  {
    id: 'classic-trading',
    name: 'Classic Trading',
    description: 'Traditional TradingView-style layout with chart focus',
    icon: <LineChart className="w-4 h-4" />,
    badge: 'Popular',
    config: {
      layout: 'classic',
      chartSize: 'large',
      panels: ['chart', 'orderbook', 'trades', 'positions']
    }
  },
  {
    id: 'analytics-first',
    name: 'Analytics First',
    description: 'Binance-style multi-panel analytics dashboard',
    icon: <TrendingUp className="w-4 h-4" />,
    config: {
      layout: 'analytics',
      chartSize: 'medium',
      panels: ['chart', 'portfolio', 'analytics', 'ai-insights']
    }
  },
  {
    id: 'ai-copilot',
    name: 'AI Copilot',
    description: 'AI-first interface with contextual recommendations',
    icon: <Brain className="w-4 h-4" />,
    badge: 'New',
    config: {
      layout: 'ai-focused',
      chartSize: 'medium',
      panels: ['chart', 'ai-insights', 'recommendations', 'strategy-builder']
    }
  },
  {
    id: 'mobile-optimized',
    name: 'Mobile Optimized',
    description: 'Touch-friendly layout for mobile trading',
    icon: <Smartphone className="w-4 h-4" />,
    config: {
      layout: 'mobile',
      chartSize: 'fullscreen',
      panels: ['chart', 'quick-trade', 'positions']
    }
  }
];

export default function LayoutPresets() {
  const { toast } = useToast();

  const applyLayoutPreset = (preset: LayoutPreset) => {
    // Store layout preference in localStorage
    localStorage.setItem('skippy-layout-preset', JSON.stringify(preset.config));
    
    toast({
      title: "Layout Applied",
      description: `${preset.name} layout has been applied. Refresh to see changes.`,
    });

    // In a real implementation, this would trigger a layout update
    // For now, we'll just show the toast
  };

  const restoreDefaultLayout = () => {
    localStorage.removeItem('skippy-layout-preset');
    toast({
      title: "Layout Reset",
      description: "Default layout restored. Refresh to see changes.",
    });
  };

  return (
    <Card className="bg-gray-800 border-gray-700 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-white mb-2">Layout Presets</h3>
          <p className="text-sm text-gray-400">
            Choose from professional trading layouts inspired by industry leaders
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={restoreDefaultLayout}
          className="bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600"
        >
          <LayoutGrid className="w-4 h-4 mr-2" />
          Restore Default
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {layoutPresets.map((preset) => (
          <Card 
            key={preset.id} 
            className="bg-gray-900 border-gray-600 p-4 hover:border-blue-600 transition-colors cursor-pointer"
            onClick={() => applyLayoutPreset(preset)}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-blue-600/20 rounded-lg text-blue-400">
                  {preset.icon}
                </div>
                <div>
                  <h4 className="font-medium text-white">{preset.name}</h4>
                  {preset.badge && (
                    <Badge variant="secondary" className="text-xs mt-1 bg-blue-600/20 text-blue-400">
                      {preset.badge}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            
            <p className="text-sm text-gray-400 mb-4">
              {preset.description}
            </p>

            <div className="flex items-center justify-between">
              <div className="flex space-x-1">
                {preset.config.panels.slice(0, 3).map((panel: string, index: number) => (
                  <div
                    key={panel}
                    className="w-3 h-3 bg-gray-600 rounded-sm"
                    title={panel.replace('-', ' ')}
                  />
                ))}
                {preset.config.panels.length > 3 && (
                  <div className="text-xs text-gray-500">
                    +{preset.config.panels.length - 3}
                  </div>
                )}
              </div>
              
              <Button
                size="sm"
                className="bg-blue-600 hover:bg-blue-700 text-white"
                onClick={(e) => {
                  e.stopPropagation();
                  applyLayoutPreset(preset);
                }}
              >
                Apply
              </Button>
            </div>
          </Card>
        ))}
      </div>

      <div className="mt-6 p-4 bg-gray-900 rounded-lg border border-gray-600">
        <div className="flex items-start space-x-3">
          <Monitor className="w-5 h-5 text-blue-400 mt-0.5" />
          <div>
            <h4 className="text-sm font-medium text-white mb-1">Pro Tip</h4>
            <p className="text-sm text-gray-400">
              Layout preferences are saved automatically. Each preset optimizes panel arrangement 
              for different trading workflows based on TradingView, Binance, and Coinbase Pro patterns.
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
}