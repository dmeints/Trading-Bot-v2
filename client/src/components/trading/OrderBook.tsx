import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useTradingStore } from '@/stores/tradingStore';

interface OrderBookEntry {
  price: number;
  quantity: number;
  total: number;
}

interface OrderBookData {
  bids: OrderBookEntry[];
  asks: OrderBookEntry[];
  spread: number;
  spreadPercentage: number;
}

export default function OrderBook() {
  const { selectedSymbol } = useTradingStore();
  const [orderBook, setOrderBook] = useState<OrderBookData | null>(null);
  const [maxTotal, setMaxTotal] = useState(0);

  useEffect(() => {
    // Simulate order book data - in production, connect to real exchange WebSocket
    const generateOrderBook = (): OrderBookData => {
      const basePrice = 50000 + Math.random() * 10000; // Random base price
      const spread = basePrice * 0.001; // 0.1% spread
      
      const bids: OrderBookEntry[] = [];
      const asks: OrderBookEntry[] = [];
      
      // Generate bid orders (buy orders)
      for (let i = 0; i < 15; i++) {
        const price = basePrice - (i + 1) * (spread / 2) - Math.random() * 10;
        const quantity = Math.random() * 5 + 0.1;
        const total = i === 0 ? quantity : bids[i-1].total + quantity;
        bids.push({ price, quantity, total });
      }
      
      // Generate ask orders (sell orders)
      for (let i = 0; i < 15; i++) {
        const price = basePrice + (i + 1) * (spread / 2) + Math.random() * 10;
        const quantity = Math.random() * 5 + 0.1;
        const total = i === 0 ? quantity : asks[i-1].total + quantity;
        asks.push({ price, quantity, total });
      }
      
      const actualSpread = asks[0].price - bids[0].price;
      const spreadPercentage = (actualSpread / basePrice) * 100;
      
      return {
        bids: bids.reverse(), // Show highest bids first
        asks,
        spread: actualSpread,
        spreadPercentage
      };
    };

    const updateOrderBook = () => {
      const newOrderBook = generateOrderBook();
      const allTotals = [...newOrderBook.bids, ...newOrderBook.asks].map(entry => entry.total);
      setMaxTotal(Math.max(...allTotals));
      setOrderBook(newOrderBook);
    };

    updateOrderBook();
    const interval = setInterval(updateOrderBook, 2000); // Update every 2 seconds

    return () => clearInterval(interval);
  }, [selectedSymbol]);

  if (!orderBook) {
    return (
      <Card className="bg-gray-800 border-gray-700 h-full">
        <CardContent className="p-4">
          <div className="animate-pulse space-y-2">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="h-4 bg-gray-700 rounded"></div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const formatPrice = (price: number) => price.toFixed(2);
  const formatQuantity = (qty: number) => qty.toFixed(4);

  return (
    <Card className="bg-gray-800 border-gray-700 h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-white text-lg flex items-center justify-between">
          <span>Order Book</span>
          <Badge variant="outline" className="text-xs">
            {selectedSymbol || 'BTC/USD'}
          </Badge>
        </CardTitle>
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-400">Spread: ${orderBook.spread.toFixed(2)}</span>
          <span className="text-gray-400">({orderBook.spreadPercentage.toFixed(3)}%)</span>
        </div>
      </CardHeader>
      
      <CardContent className="p-0">
        <div className="grid grid-cols-3 gap-2 px-4 py-2 bg-gray-700/50 text-xs font-medium text-gray-300">
          <span>Price</span>
          <span className="text-center">Quantity</span>
          <span className="text-right">Total</span>
        </div>
        
        {/* Ask Orders (Sell Orders) - Red */}
        <div className="max-h-48 overflow-y-auto">
          {orderBook.asks.slice(0, 10).reverse().map((ask, index) => {
            const widthPercentage = (ask.total / maxTotal) * 100;
            return (
              <div 
                key={`ask-${index}`} 
                className="relative px-4 py-1 text-xs hover:bg-red-500/10 transition-colors"
              >
                <div 
                  className="absolute inset-y-0 right-0 bg-red-500/20"
                  style={{ width: `${widthPercentage}%` }}
                />
                <div className="relative grid grid-cols-3 gap-2 text-red-400">
                  <span className="font-mono">{formatPrice(ask.price)}</span>
                  <span className="text-center text-gray-300">{formatQuantity(ask.quantity)}</span>
                  <span className="text-right text-gray-300">{formatQuantity(ask.total)}</span>
                </div>
              </div>
            );
          })}
        </div>
        
        {/* Spread Indicator */}
        <div className="px-4 py-2 bg-gray-700/30 border-y border-gray-600">
          <div className="text-center">
            <span className="text-lg font-mono text-white">
              ${((orderBook.asks[0].price + orderBook.bids[0].price) / 2).toFixed(2)}
            </span>
            <div className="text-xs text-gray-400">Last Price</div>
          </div>
        </div>
        
        {/* Bid Orders (Buy Orders) - Green */}
        <div className="max-h-48 overflow-y-auto">
          {orderBook.bids.slice(0, 10).map((bid, index) => {
            const widthPercentage = (bid.total / maxTotal) * 100;
            return (
              <div 
                key={`bid-${index}`} 
                className="relative px-4 py-1 text-xs hover:bg-green-500/10 transition-colors"
              >
                <div 
                  className="absolute inset-y-0 right-0 bg-green-500/20"
                  style={{ width: `${widthPercentage}%` }}
                />
                <div className="relative grid grid-cols-3 gap-2 text-green-400">
                  <span className="font-mono">{formatPrice(bid.price)}</span>
                  <span className="text-center text-gray-300">{formatQuantity(bid.quantity)}</span>
                  <span className="text-right text-gray-300">{formatQuantity(bid.total)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}