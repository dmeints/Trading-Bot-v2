import { ReactNode } from 'react';
import { Wifi, WifiOff, Clock, AlertTriangle, CheckCircle, Loader2 } from 'lucide-react';

export type StatusType = 'online' | 'offline' | 'loading' | 'warning' | 'success' | 'error';

interface StatusIndicatorProps {
  status: StatusType;
  label?: string;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
  animated?: boolean;
  className?: string;
}

interface StatusBadgeProps {
  status: StatusType;
  children: ReactNode;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  className?: string;
}

const statusConfig = {
  online: {
    color: 'bg-green-400',
    icon: CheckCircle,
    label: 'Online',
    textColor: 'text-green-400'
  },
  offline: {
    color: 'bg-red-400',
    icon: WifiOff,
    label: 'Offline',
    textColor: 'text-red-400'
  },
  loading: {
    color: 'bg-blue-400',
    icon: Loader2,
    label: 'Loading',
    textColor: 'text-blue-400'
  },
  warning: {
    color: 'bg-yellow-400',
    icon: AlertTriangle,
    label: 'Warning',
    textColor: 'text-yellow-400'
  },
  success: {
    color: 'bg-green-400',
    icon: CheckCircle,
    label: 'Success',
    textColor: 'text-green-400'
  },
  error: {
    color: 'bg-red-400',
    icon: AlertTriangle,
    label: 'Error',
    textColor: 'text-red-400'
  }
};

const sizeConfig = {
  sm: { dot: 'w-2 h-2', icon: 'w-3 h-3', text: 'text-xs' },
  md: { dot: 'w-3 h-3', icon: 'w-4 h-4', text: 'text-sm' },
  lg: { dot: 'w-4 h-4', icon: 'w-5 h-5', text: 'text-base' }
};

export function StatusIndicator({
  status,
  label,
  showLabel = false,
  size = 'md',
  animated = true,
  className = ''
}: StatusIndicatorProps) {
  const config = statusConfig[status];
  const sizeClasses = sizeConfig[size];
  const Icon = config.icon;

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      {/* Dot Indicator */}
      <div className={`
        rounded-full ${config.color} ${sizeClasses.dot}
        ${animated && status === 'online' ? 'animate-pulse' : ''}
        ${animated && status === 'loading' ? 'animate-ping' : ''}
      `} />
      
      {/* Icon (for larger sizes) */}
      {size !== 'sm' && (
        <Icon className={`
          ${sizeClasses.icon} ${config.textColor}
          ${status === 'loading' ? 'animate-spin' : ''}
        `} />
      )}
      
      {/* Label */}
      {showLabel && (
        <span className={`${sizeClasses.text} ${config.textColor} font-medium`}>
          {label || config.label}
        </span>
      )}
    </div>
  );
}

export function StatusBadge({
  status,
  children,
  position = 'top-right',
  className = ''
}: StatusBadgeProps) {
  const config = statusConfig[status];
  
  const positionClasses = {
    'top-right': 'top-1 right-1',
    'top-left': 'top-1 left-1',
    'bottom-right': 'bottom-1 right-1',
    'bottom-left': 'bottom-1 left-1'
  };

  return (
    <div className={`relative ${className}`}>
      {children}
      <div className={`absolute ${positionClasses[position]} z-10`}>
        <div className={`
          w-3 h-3 rounded-full ${config.color} border-2 border-gray-800
          ${status === 'online' ? 'animate-pulse' : ''}
          ${status === 'loading' ? 'animate-ping' : ''}
        `} />
      </div>
    </div>
  );
}

// Connection Quality Indicator
interface ConnectionQualityProps {
  quality: 'excellent' | 'good' | 'fair' | 'poor';
  showLabel?: boolean;
  className?: string;
}

export function ConnectionQuality({ quality, showLabel = false, className = '' }: ConnectionQualityProps) {
  const qualityConfig = {
    excellent: { bars: 4, color: 'bg-green-400', label: 'Excellent' },
    good: { bars: 3, color: 'bg-green-400', label: 'Good' },
    fair: { bars: 2, color: 'bg-yellow-400', label: 'Fair' },
    poor: { bars: 1, color: 'bg-red-400', label: 'Poor' }
  };

  const config = qualityConfig[quality];

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      {/* Signal Bars */}
      <div className="flex items-end space-x-0.5">
        {[1, 2, 3, 4].map((bar) => (
          <div
            key={bar}
            className={`
              w-1 ${config.color}
              ${bar === 1 ? 'h-1' : bar === 2 ? 'h-2' : bar === 3 ? 'h-3' : 'h-4'}
              ${bar <= config.bars ? 'opacity-100' : 'opacity-30'}
            `}
          />
        ))}
      </div>
      
      {/* Label */}
      {showLabel && (
        <span className="text-xs text-gray-400">{config.label}</span>
      )}
    </div>
  );
}

// Data Freshness Indicator
interface DataFreshnessProps {
  lastUpdate: Date;
  threshold?: number; // minutes
  className?: string;
}

export function DataFreshness({ lastUpdate, threshold = 5, className = '' }: DataFreshnessProps) {
  const now = new Date();
  const minutesSince = Math.floor((now.getTime() - lastUpdate.getTime()) / 60000);
  
  const status: StatusType = minutesSince < threshold ? 'success' : 
                            minutesSince < threshold * 2 ? 'warning' : 'error';
  
  const timeText = minutesSince < 1 ? 'Just now' :
                   minutesSince < 60 ? `${minutesSince}m ago` :
                   `${Math.floor(minutesSince / 60)}h ago`;

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      <StatusIndicator status={status} size="sm" />
      <span className="text-xs text-gray-400">{timeText}</span>
    </div>
  );
}

// Trading Status Indicator (specific to trading contexts)
interface TradingStatusProps {
  isMarketOpen: boolean;
  hasActiveOrders: boolean;
  connectionStatus: 'connected' | 'disconnected' | 'reconnecting';
  className?: string;
}

export function TradingStatus({
  isMarketOpen,
  hasActiveOrders,
  connectionStatus,
  className = ''
}: TradingStatusProps) {
  const getOverallStatus = (): StatusType => {
    if (connectionStatus === 'disconnected') return 'error';
    if (connectionStatus === 'reconnecting') return 'loading';
    if (!isMarketOpen) return 'warning';
    return 'success';
  };

  const getStatusLabel = () => {
    if (connectionStatus === 'disconnected') return 'Disconnected';
    if (connectionStatus === 'reconnecting') return 'Reconnecting...';
    if (!isMarketOpen) return 'Market Closed';
    return hasActiveOrders ? 'Active Trading' : 'Ready to Trade';
  };

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      <StatusIndicator 
        status={getOverallStatus()} 
        size="sm" 
        animated={connectionStatus === 'reconnecting'}
      />
      <span className="text-xs text-gray-400">{getStatusLabel()}</span>
      {hasActiveOrders && (
        <div className="w-1 h-1 bg-blue-400 rounded-full animate-pulse ml-1" />
      )}
    </div>
  );
}