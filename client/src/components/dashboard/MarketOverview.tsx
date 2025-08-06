import { useTradingStore } from '@/stores/tradingStore';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function MarketOverview() {
  const { marketPrices, selectedSymbol, setSelectedSymbol } = useTradingStore();

  const majorSymbols = ['BTC/USD', 'ETH/USD', 'SOL/USD'];

  const getMarketSentiment = () => {
    const prices = Object.values(marketPrices);
    if (prices.length === 0) return 'Neutral';
    
    const avgChange = prices.reduce((sum, price) => sum + price.change24h, 0) / prices.length;
    if (avgChange > 2) return 'Bullish';
    if (avgChange < -2) return 'Bearish';
    return 'Neutral';
  };

  const sentiment = getMarketSentiment();

  return (
    <Card className="bg-gray-800 border-gray-700 p-fluid-2 h-full overflow-hidden">
      {/* Desktop and Tablet View */}
      <div className="hidden sm:flex items-center justify-between">
        <h2 className="text-fluid-lg font-semibold text-white whitespace-nowrap">Market Overview</h2>
        <div className="flex items-center space-x-fluid-2 overflow-x-auto scroll-container-x flex-shrink-0">
          {majorSymbols.map(symbol => {
            const price = marketPrices[symbol];
            if (!price) return null;

            const isPositive = price.change24h >= 0;

            return (
              <Button
                key={symbol}
                variant="ghost"
                onClick={() => setSelectedSymbol(symbol)}
                className={`text-center p-fluid-1 h-auto flex-col space-y-1 transition-colors flex-shrink-0 min-w-20 ${
                  selectedSymbol === symbol 
                    ? 'bg-blue-600/20 border border-blue-500/30' 
                    : 'hover:bg-gray-700/50'
                }`}
                data-testid={`market-data-${symbol.replace('/', '-')}`}
              >
                <div className="text-fluid-xs text-gray-400">{symbol}</div>
                <div className={`text-fluid-sm font-semibold ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                  ${price.price.toLocaleString()}
                </div>
                <div className={`text-xs ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                  {isPositive ? '+' : ''}{price.change24h.toFixed(2)}%
                </div>
              </Button>
            );
          })}
          
          <div className={`px-fluid-1 py-2 rounded-lg flex-shrink-0 ${
            sentiment === 'Bullish' ? 'bg-green-600/20' :
            sentiment === 'Bearish' ? 'bg-red-600/20' :
            'bg-blue-600/20'
          }`} data-testid="market-sentiment">
            <div className={`text-xs ${
              sentiment === 'Bullish' ? 'text-green-400' :
              sentiment === 'Bearish' ? 'text-red-400' :
              'text-blue-400'
            }`}>
              Market Sentiment
            </div>
            <div className="text-fluid-sm font-semibold text-white">{sentiment}</div>
          </div>
        </div>
      </div>

      {/* Mobile View */}
      <div className="block sm:hidden space-y-fluid-1">
        <h2 className="text-fluid-lg font-semibold text-white">Market Overview</h2>
        
        {/* Price Ticker - Horizontal Scroll */}
        <div className="flex space-x-fluid-1 overflow-x-auto scroll-container-x pb-2">
          {majorSymbols.map(symbol => {
            const price = marketPrices[symbol];
            if (!price) return null;

            const isPositive = price.change24h >= 0;

            return (
              <Button
                key={symbol}
                variant="ghost"
                onClick={() => setSelectedSymbol(symbol)}
                className={`text-center p-fluid-1 h-auto flex-col space-y-1 transition-colors flex-shrink-0 min-w-24 ${
                  selectedSymbol === symbol 
                    ? 'bg-blue-600/20 border border-blue-500/30' 
                    : 'hover:bg-gray-700/50'
                }`}
                data-testid={`market-data-${symbol.replace('/', '-')}`}
              >
                <div className="text-xs text-gray-400">{symbol}</div>
                <div className={`text-sm font-semibold ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                  ${price.price.toLocaleString()}
                </div>
                <div className={`text-xs ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                  {isPositive ? '+' : ''}{price.change24h.toFixed(2)}%
                </div>
              </Button>
            );
          })}
        </div>

        {/* Market Sentiment */}
        <div className={`px-fluid-1 py-2 rounded-lg inline-block ${
          sentiment === 'Bullish' ? 'bg-green-600/20' :
          sentiment === 'Bearish' ? 'bg-red-600/20' :
          'bg-blue-600/20'
        }`} data-testid="market-sentiment">
          <div className={`text-xs ${
            sentiment === 'Bullish' ? 'text-green-400' :
            sentiment === 'Bearish' ? 'text-red-400' :
            'text-blue-400'
          }`}>
            Market Sentiment
          </div>
          <div className="text-sm font-semibold text-white">{sentiment}</div>
        </div>
      </div>
    </Card>
  );
}
