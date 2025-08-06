import { ReactNode, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronUp, ChevronDown, Maximize2, Minimize2, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

export type UserLevel = 'beginner' | 'intermediate' | 'expert';
export type CardStatus = 'live' | 'delayed' | 'offline';

interface CardAction {
  icon: ReactNode;
  label: string;
  onClick: () => void;
}

interface AdaptiveCardProps {
  title: string;
  level: UserLevel;
  status?: CardStatus;
  children: ReactNode;
  className?: string;
  expandable?: boolean;
  actions?: CardAction[];
}

export function AdaptiveCard({
  title,
  level,
  status = 'live',
  children,
  className,
  expandable = true,
  actions = []
}: AdaptiveCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const statusColors = {
    live: 'bg-green-500',
    delayed: 'bg-yellow-500',
    offline: 'bg-red-500'
  };

  const statusLabels = {
    live: 'Live',
    delayed: 'Delayed',
    offline: 'Offline'
  };

  return (
    <Card 
      className={cn(
        "bg-gray-800 border-gray-700 transition-all duration-300",
        isExpanded && "col-span-full row-span-2 z-10",
        isCollapsed && "min-h-[60px]",
        className
      )}
      data-testid={`adaptive-card-${title.toLowerCase().replace(/\s+/g, '-')}`}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex items-center space-x-2">
          <CardTitle className="text-sm font-medium text-gray-200">
            {title}
          </CardTitle>
          <div className="flex items-center space-x-1">
            <div className={cn("w-2 h-2 rounded-full", statusColors[status])} />
            <Badge variant="outline" className="text-xs">
              {statusLabels[status]}
            </Badge>
          </div>
        </div>
        
        <div className="flex items-center space-x-1">
          {/* User level indicator */}
          {level === 'expert' && (
            <Badge variant="outline" className="text-xs">Expert</Badge>
          )}
          
          {/* Action buttons */}
          {actions.map((action, index) => (
            <Button
              key={index}
              variant="ghost"
              size="sm"
              onClick={action.onClick}
              className="h-6 w-6 p-0 text-gray-400 hover:text-gray-200"
              title={action.label}
            >
              {action.icon}
            </Button>
          ))}
          
          {/* Collapse/Expand controls */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="h-6 w-6 p-0 text-gray-400 hover:text-gray-200"
            title={isCollapsed ? "Expand" : "Collapse"}
          >
            {isCollapsed ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
          </Button>
          
          {expandable && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="h-6 w-6 p-0 text-gray-400 hover:text-gray-200"
              title={isExpanded ? "Minimize" : "Maximize"}
              aria-label={isExpanded ? "minimize card" : "expand card"}
            >
              {isExpanded ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
            </Button>
          )}
        </div>
      </CardHeader>
      
      {!isCollapsed && (
        <CardContent className="pt-0">
          <div className={cn(
            "transition-all duration-300",
            isExpanded && "max-h-none",
            !isExpanded && level === 'beginner' && "max-h-48 overflow-hidden"
          )}>
            {children}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

// Simple and Advanced View Components for Progressive Disclosure
interface ViewProps {
  children: ReactNode;
  className?: string;
}

export function SimpleView({ children, className }: ViewProps) {
  return (
    <div className={cn("space-y-2", className)} data-testid="simple-view">
      {children}
    </div>
  );
}

export function AdvancedView({ children, className }: ViewProps) {
  return (
    <div className={cn("space-y-4", className)} data-testid="advanced-view">
      {children}
    </div>
  );
}