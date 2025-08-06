import { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Clock, Wifi, WifiOff, AlertCircle, CheckCircle, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

interface StatusIndicatorProps {
  status: 'online' | 'offline' | 'warning' | 'error';
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  className?: string;
}

export function StatusIndicator({ status, size = 'md', label, className }: StatusIndicatorProps) {
  const statusConfig = {
    online: {
      color: 'bg-green-500',
      icon: <CheckCircle className="w-3 h-3" />,
      label: 'Online'
    },
    offline: {
      color: 'bg-gray-500',
      icon: <AlertCircle className="w-3 h-3" />,
      label: 'Offline'
    },
    warning: {
      color: 'bg-yellow-500',
      icon: <AlertTriangle className="w-3 h-3" />,
      label: 'Warning'
    },
    error: {
      color: 'bg-red-500',
      icon: <AlertCircle className="w-3 h-3" />,
      label: 'Error'
    }
  };

  const sizeClasses = {
    sm: 'w-2 h-2',
    md: 'w-3 h-3',
    lg: 'w-4 h-4'
  };

  const config = statusConfig[status];

  return (
    <div className={cn("flex items-center space-x-1", className)}>
      <div className={cn(
        "rounded-full",
        config.color,
        sizeClasses[size],
        status === 'online' && "animate-pulse"
      )} />
      {label && (
        <span className="text-xs text-gray-400">
          {label || config.label}
        </span>
      )}
    </div>
  );
}

interface DataFreshnessProps {
  lastUpdate: Date;
  threshold?: number; // minutes
  className?: string;
}

export function DataFreshness({ lastUpdate, threshold = 5, className }: DataFreshnessProps) {
  const minutesAgo = (Date.now() - lastUpdate.getTime()) / (1000 * 60);
  const isStale = minutesAgo > threshold;
  
  return (
    <div className={cn("flex items-center space-x-1 text-xs", className)}>
      <Clock className="w-3 h-3 text-gray-400" />
      <span className={cn(
        "text-gray-400",
        isStale && "text-yellow-400"
      )}>
        {formatDistanceToNow(lastUpdate, { addSuffix: true })}
      </span>
      {isStale && (
        <Badge variant="outline" className="text-xs">
          Stale
        </Badge>
      )}
    </div>
  );
}

interface TradingStatusProps {
  isMarketOpen: boolean;
  hasActiveOrders: boolean;
  connectionStatus: 'connected' | 'disconnected' | 'connecting';
  className?: string;
}

export function TradingStatus({ 
  isMarketOpen, 
  hasActiveOrders, 
  connectionStatus,
  className 
}: TradingStatusProps) {
  const getConnectionIcon = () => {
    switch (connectionStatus) {
      case 'connected':
        return <Wifi className="w-4 h-4 text-green-400" />;
      case 'connecting':
        return <Wifi className="w-4 h-4 text-yellow-400 animate-pulse" />;
      case 'disconnected':
        return <WifiOff className="w-4 h-4 text-red-400" />;
    }
  };

  return (
    <div className={cn("flex items-center space-x-4", className)}>
      {/* Connection Status */}
      <div className="flex items-center space-x-1">
        {getConnectionIcon()}
        <span className="text-xs text-gray-400 capitalize">
          {connectionStatus}
        </span>
      </div>

      {/* Market Status */}
      <div className="flex items-center space-x-1">
        <StatusIndicator 
          status={isMarketOpen ? 'online' : 'offline'}
          size="sm"
        />
        <span className="text-xs text-gray-400">
          Market {isMarketOpen ? 'Open' : 'Closed'}
        </span>
      </div>

      {/* Active Orders */}
      {hasActiveOrders && (
        <Badge variant="outline" className="text-xs">
          Active Orders
        </Badge>
      )}
    </div>
  );
}