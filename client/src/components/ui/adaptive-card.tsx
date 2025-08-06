import { useState, ReactNode } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronDown, Settings, Expand, MoreHorizontal } from 'lucide-react';

interface AdaptiveCardProps {
  title: string;
  children: ReactNode;
  level?: 'beginner' | 'intermediate' | 'expert';
  expandable?: boolean;
  status?: 'live' | 'delayed' | 'offline';
  actions?: Array<{
    icon: ReactNode;
    label: string;
    onClick: () => void;
  }>;
  className?: string;
  defaultExpanded?: boolean;
}

export function AdaptiveCard({
  title,
  children,
  level = 'intermediate',
  expandable = true,
  status = 'live',
  actions = [],
  className = '',
  defaultExpanded = false
}: AdaptiveCardProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [showActions, setShowActions] = useState(false);

  const statusClasses = {
    live: 'border-green-500/30 bg-gray-800/90',
    delayed: 'border-yellow-500/30 bg-gray-800/90',
    offline: 'border-red-500/30 bg-gray-800/50'
  };

  const statusIndicators = {
    live: 'bg-green-400 animate-pulse',
    delayed: 'bg-yellow-400',
    offline: 'bg-red-400'
  };

  return (
    <Card 
      className={`
        relative overflow-hidden transition-all duration-300 backdrop-blur-sm border
        ${statusClasses[status]}
        ${isExpanded ? 'h-auto' : level === 'beginner' ? 'h-24' : 'h-32'}
        ${className}
      `}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Status Indicator */}
      <div className="absolute top-3 right-3 flex items-center space-x-2">
        <div className={`w-2 h-2 rounded-full ${statusIndicators[status]}`} />
        {level === 'expert' && (
          <span className="text-xs text-gray-400">{status}</span>
        )}
      </div>

      {/* Header */}
      <div className="p-4 flex items-center justify-between">
        <h3 className={`font-semibold text-white ${
          level === 'beginner' ? 'text-base' : 'text-lg'
        }`}>
          {title}
        </h3>
        
        <div className="flex items-center space-x-1">
          {/* Expandable Toggle */}
          {expandable && level !== 'beginner' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="hover:bg-gray-700 p-1"
            >
              <ChevronDown className={`w-4 h-4 transition-transform ${
                isExpanded ? 'rotate-180' : ''
              }`} />
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className={`px-4 pb-4 ${
        level === 'beginner' && !isExpanded ? 'overflow-hidden' : ''
      }`}>
        {children}
      </div>

      {/* Hover Actions (TradingView Pattern) */}
      <div className={`
        absolute top-3 left-3 flex space-x-1 transition-opacity duration-200
        ${showActions && level !== 'beginner' ? 'opacity-100' : 'opacity-0'}
      `}>
        {actions.map((action, index) => (
          <Button
            key={index}
            variant="ghost"
            size="sm"
            onClick={action.onClick}
            className="bg-gray-800/80 hover:bg-gray-700 p-1.5 backdrop-blur-sm"
            title={action.label}
          >
            {action.icon}
          </Button>
        ))}
        
        {level === 'expert' && (
          <>
            <Button
              variant="ghost"
              size="sm"
              className="bg-gray-800/80 hover:bg-gray-700 p-1.5 backdrop-blur-sm"
              title="Settings"
            >
              <Settings className="w-3 h-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="bg-gray-800/80 hover:bg-gray-700 p-1.5 backdrop-blur-sm"
              title="Expand"
            >
              <Expand className="w-3 h-3" />
            </Button>
          </>
        )}
      </div>

      {/* Progressive Disclosure Indicator */}
      {!isExpanded && expandable && level !== 'beginner' && (
        <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2">
          <div className="flex space-x-1">
            <div className="w-1 h-1 bg-gray-500 rounded-full"></div>
            <div className="w-1 h-1 bg-gray-500 rounded-full"></div>
            <div className="w-1 h-1 bg-gray-500 rounded-full"></div>
          </div>
        </div>
      )}

      {/* Mobile Expand Hint */}
      {!isExpanded && expandable && level === 'beginner' && (
        <div className="absolute bottom-2 right-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(true)}
            className="text-xs text-gray-400 hover:text-white"
          >
            Show more
          </Button>
        </div>
      )}
    </Card>
  );
}

// Simple and Advanced view components for different user levels
export function SimpleView({ data }: { data: any }) {
  return (
    <div className="space-y-2">
      <div className="text-2xl font-bold text-white">
        {data.primary}
      </div>
      <div className={`text-sm ${data.change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
        {data.change >= 0 ? '+' : ''}{data.change}%
      </div>
    </div>
  );
}

export function AdvancedView({ data, expanded }: { data: any; expanded: boolean }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-2xl font-bold text-white">
          {data.primary}
        </div>
        <div className={`text-sm font-medium ${data.change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
          {data.change >= 0 ? '+' : ''}{data.change}%
        </div>
      </div>
      
      {expanded && (
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-gray-400">24h Volume</div>
            <div className="text-white font-medium">{data.volume}</div>
          </div>
          <div>
            <div className="text-gray-400">Market Cap</div>
            <div className="text-white font-medium">{data.marketCap}</div>
          </div>
          <div>
            <div className="text-gray-400">High</div>
            <div className="text-white font-medium">{data.high}</div>
          </div>
          <div>
            <div className="text-gray-400">Low</div>
            <div className="text-white font-medium">{data.low}</div>
          </div>
        </div>
      )}
    </div>
  );
}