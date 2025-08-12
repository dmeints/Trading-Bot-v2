import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useTradingStore } from '@/stores/tradingStore';
import { useToast } from '@/hooks/use-toast';
import { TrendingUp, TrendingDown, Clock } from 'lucide-react';
import { useEffect } from 'react';

interface Trade {
  id: string;
  symbol: string;
  side: 'buy' | 'sell';
  quantity: string;
  price: string;
  fee: string;
  pnl: string;
  executedAt: string;
}

export default function RecentTrades() {
  const { recentTrades, setRecentTrades } = useTradingStore();
  const { toast } = useToast();

  const { data: fetchedTrades, isLoading } = useQuery<Trade[]>({
    queryKey: ['/api/trading/trades'],
    refetchInterval: 15000, // Refresh every 15 seconds
  });

  useEffect(() => {
    if (fetchedTrades) {
      setRecentTrades(fetchedTrades);
    }
  }, [fetchedTrades, setRecentTrades]);

  const displayTrades = recentTrades.length > 0 ? recentTrades : (fetchedTrades || []);

  const formatCurrency = (value: string | number) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return (num || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
  };

  const formatQuantity = (quantity: string, symbol: string) => {
    const num = parseFloat(quantity);
    const baseSymbol = symbol.split('/')[0];
    return `${(num || 0).toFixed(6)} ${baseSymbol}`;
  };

  const getTimeAgo = (timestamp: string) => {
    const now = new Date();
    const tradeTime = new Date(timestamp);
    const diffMs = now.getTime() - tradeTime.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  if (isLoading && displayTrades.length === 0) {
    return (
      <Card className="bg-gray-800 border-gray-700 p-fluid-2 h-full card-widget">
        <div className="flex items-center justify-between mb-fluid-1">
          <h3 className="text-fluid-lg font-semibold text-white">Recent Trades</h3>
        </div>
        <div className="animate-pulse space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex items-center justify-between">
              <div className="flex items-center space-x-fluid-1">
                <div className="w-12 h-4 bg-gray-700 rounded"></div>
                <div className="w-16 h-4 bg-gray-700 rounded"></div>
                <div className="w-20 h-4 bg-gray-700 rounded"></div>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-16 h-4 bg-gray-700 rounded"></div>
                <div className="w-20 h-4 bg-gray-700 rounded"></div>
                <div className="w-12 h-4 bg-gray-700 rounded"></div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    );
  }

  return (
    <Card className="bg-gray-800 border-gray-700 p-fluid-2 h-full overflow-hidden card-widget">
      <div className="flex items-center justify-between mb-fluid-1">
        <h3 className="text-fluid-lg font-semibold text-white">Recent Trades</h3>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => {
            toast({
              title: "Coming Soon",
              description: "Detailed trading history view will be available soon",
            });
          }}
          className="text-blue-400 hover:text-blue-300 text-fluid-xs hidden sm:block"
          data-testid="button-view-all-trades button-execute"
        >
          View All
        </Button>
      </div>
      
      <div className="space-y-1 overflow-y-auto scroll-container-y flex-1">
        {displayTrades.length === 0 ? (
          <div className="text-center text-gray-400 py-fluid-2">
            <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-fluid-sm">No recent trades</p>
            <p className="text-fluid-xs">Your trading history will appear here</p>
          </div>
        ) : (
          displayTrades.slice(0, 5).map((trade) => {
            const pnl = parseFloat(trade.pnl);
            const isProfitable = pnl >= 0;
            const isBuy = trade.side === 'buy';

            return (
              <div 
                key={trade.id} 
                className="flex items-center justify-between text-fluid-xs py-fluid-1 px-2 rounded hover:bg-gray-700/50 transition-colors"
                data-testid={`trade-item-${trade.id}`}
              >
                {/* Desktop Layout */}
                <div className="hidden md:flex items-center space-x-fluid-1 flex-1">
                  <div className="flex items-center space-x-1">
                    {isBuy ? (
                      <TrendingUp className="w-3 h-3 text-green-400" />
                    ) : (
                      <TrendingDown className="w-3 h-3 text-red-400" />
                    )}
                    <span className={`font-medium ${isBuy ? 'text-green-400' : 'text-red-400'}`}>
                      {trade.side.toUpperCase()}
                    </span>
                  </div>
                  <span className="text-white font-medium" data-testid={`trade-symbol-${trade.id}`}>
                    {trade.symbol}
                  </span>
                  <span className="text-gray-400" data-testid={`trade-quantity-${trade.id}`}>
                    {formatQuantity(trade.quantity, trade.symbol)}
                  </span>
                </div>

                {/* Mobile Layout */}
                <div className="flex md:hidden items-center space-x-2 flex-1">
                  <div className="flex items-center space-x-1">
                    {isBuy ? (
                      <TrendingUp className="w-3 h-3 text-green-400" />
                    ) : (
                      <TrendingDown className="w-3 h-3 text-red-400" />
                    )}
                    <span className={`font-medium text-fluid-xs ${isBuy ? 'text-green-400' : 'text-red-400'}`}>
                      {trade.side.toUpperCase()}
                    </span>
                  </div>
                  <span className="text-white font-medium text-fluid-xs" data-testid={`trade-symbol-${trade.id}`}>
                    {trade.symbol}
                  </span>
                </div>

                {/* Desktop Right Side */}
                <div className="hidden md:flex items-center space-x-fluid-1 text-right">
                  <span className="text-gray-400" data-testid={`trade-price-${trade.id}`}>
                    {formatCurrency(trade.price)}
                  </span>
                  <span className={`font-medium ${isProfitable ? 'text-green-400' : 'text-red-400'}`} data-testid={`trade-pnl-${trade.id}`}>
                    {isProfitable ? '+' : ''}{formatCurrency(pnl)}
                  </span>
                  <span className="text-gray-400 text-fluid-xs" data-testid={`trade-time-${trade.id}`}>
                    {getTimeAgo(trade.executedAt)}
                  </span>
                </div>

                {/* Mobile Right Side */}
                <div className="flex md:hidden items-center space-x-1 text-right">
                  <span className={`font-medium text-fluid-xs ${isProfitable ? 'text-green-400' : 'text-red-400'}`} data-testid={`trade-pnl-${trade.id}`}>
                    {isProfitable ? '+' : ''}{formatCurrency(pnl)}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </Card>
  );
}
