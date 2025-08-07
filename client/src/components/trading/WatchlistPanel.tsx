import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Star, 
  StarOff, 
  Plus, 
  Bell, 
  TrendingUp, 
  TrendingDown,
  Search 
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface WatchlistItem {
  symbol: string;
  price: number;
  change24h: number;
  volume: number;
  alerts?: {
    priceAbove?: number;
    priceBelow?: number;
  };
}

const mockWatchlist: WatchlistItem[] = [
  { symbol: 'BTC/USD', price: 114765, change24h: -0.12, volume: 28450000000 },
  { symbol: 'ETH/USD', price: 3670.79, change24h: 2.34, volume: 15680000000 },
  { symbol: 'SOL/USD', price: 167.58, change24h: -1.45, volume: 4250000000 },
  { symbol: 'ADA/USD', price: 0.738472, change24h: 0.89, volume: 850000000 },
  { symbol: 'DOT/USD', price: 3.66, change24h: -0.67, volume: 420000000 }
];

export default function WatchlistPanel() {
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>(mockWatchlist);
  const [searchTerm, setSearchTerm] = useState('');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { toast } = useToast();

  const toggleFavorite = (symbol: string) => {
    setWatchlist(prev => prev.filter(item => item.symbol !== symbol));
    toast({
      title: "Removed from Watchlist",
      description: `${symbol} has been removed from your watchlist`,
    });
  };

  const setAlert = (symbol: string, type: 'above' | 'below') => {
    const currentPrice = watchlist.find(item => item.symbol === symbol)?.price || 0;
    const alertPrice = type === 'above' ? currentPrice * 1.05 : currentPrice * 0.95;
    
    toast({
      title: "Alert Set",
      description: `Price alert set for ${symbol} ${type} $${alertPrice.toFixed(2)}`,
    });
  };

  const formatVolume = (volume: number) => {
    if (volume >= 1e9) return `$${(volume / 1e9).toFixed(1)}B`;
    if (volume >= 1e6) return `$${(volume / 1e6).toFixed(1)}M`;
    return `$${(volume / 1e3).toFixed(1)}K`;
  };

  const filteredWatchlist = watchlist.filter(item =>
    item.symbol.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Card className="bg-gray-800 border-gray-700 h-full overflow-hidden">
      <div className="p-3 border-b border-gray-700">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-white">Watchlist</h3>
          <div className="flex items-center space-x-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="text-gray-400 hover:text-white p-1"
            >
              {isCollapsed ? <Plus className="w-4 h-4" /> : <Star className="w-4 h-4" />}
            </Button>
          </div>
        </div>
        
        {!isCollapsed && (
          <div className="relative">
            <Search className="w-4 h-4 absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <Input
              type="text"
              placeholder="Search symbols..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 bg-gray-900 border-gray-600 text-white text-xs"
            />
          </div>
        )}
      </div>

      {!isCollapsed && (
        <div className="overflow-y-auto flex-1">
          <div className="space-y-1 p-2">
            {filteredWatchlist.map((item) => (
              <div
                key={item.symbol}
                className="bg-gray-900 rounded p-2 hover:bg-gray-700 transition-colors cursor-pointer"
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center space-x-2">
                    <span className="text-white text-xs font-medium">{item.symbol}</span>
                    <Badge 
                      variant="secondary" 
                      className={`text-xs px-1 py-0 ${
                        item.change24h >= 0 
                          ? 'bg-green-600/20 text-green-400' 
                          : 'bg-red-600/20 text-red-400'
                      }`}
                    >
                      {item.change24h >= 0 ? '+' : ''}{item.change24h.toFixed(2)}%
                    </Badge>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setAlert(item.symbol, 'above')}
                      className="text-gray-400 hover:text-blue-400 p-1"
                      title="Set price alert"
                    >
                      <Bell className="w-3 h-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleFavorite(item.symbol)}
                      className="text-yellow-400 hover:text-gray-400 p-1"
                      title="Remove from watchlist"
                    >
                      <Star className="w-3 h-3 fill-current" />
                    </Button>
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-white text-sm font-mono">
                    ${item.price.toLocaleString()}
                  </span>
                  <div className="flex items-center space-x-1">
                    {item.change24h >= 0 ? 
                      <TrendingUp className="w-3 h-3 text-green-400" /> :
                      <TrendingDown className="w-3 h-3 text-red-400" />
                    }
                    <span className="text-xs text-gray-400">
                      {formatVolume(item.volume)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}