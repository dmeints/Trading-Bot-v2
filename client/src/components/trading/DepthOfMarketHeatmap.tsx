import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';

interface OrderBookEntry {
  price: number;
  size: number;
  total: number;
}

interface DepthData {
  bids: OrderBookEntry[];
  asks: OrderBookEntry[];
  spread: number;
}

// Mock depth of market data
const generateMockDepth = (): DepthData => {
  const basePrice = 114765;
  const spread = basePrice * 0.0001; // 0.01% spread
  
  const bids: OrderBookEntry[] = [];
  const asks: OrderBookEntry[] = [];
  
  let totalBids = 0;
  let totalAsks = 0;
  
  // Generate bids (below current price)
  for (let i = 0; i < 15; i++) {
    const price = basePrice - (spread / 2) - (i * basePrice * 0.00005);
    const size = Math.random() * 2 + 0.5; // Random size between 0.5-2.5
    totalBids += size;
    bids.push({ price, size, total: totalBids });
  }
  
  // Generate asks (above current price)  
  for (let i = 0; i < 15; i++) {
    const price = basePrice + (spread / 2) + (i * basePrice * 0.00005);
    const size = Math.random() * 2 + 0.5;
    totalAsks += size;
    asks.push({ price, size, total: totalAsks });
  }
  
  return {
    bids: bids.reverse(), // Show highest bids first
    asks,
    spread
  };
};

export default function DepthOfMarketHeatmap() {
  const [depthData, setDepthData] = useState<DepthData>(generateMockDepth());
  const [hoveredEntry, setHoveredEntry] = useState<{ type: 'bid' | 'ask'; entry: OrderBookEntry } | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setDepthData(generateMockDepth());
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const maxBidSize = Math.max(...depthData.bids.map(b => b.size));
  const maxAskSize = Math.max(...depthData.asks.map(a => a.size));
  const maxSize = Math.max(maxBidSize, maxAskSize);

  const getIntensity = (size: number) => Math.min(100, (size / maxSize) * 100);

  return (
    <Card className="bg-gray-800 border-gray-700 p-3 h-full overflow-hidden">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-white">Depth of Market</h3>
        <div className="text-xs text-gray-400">
          Spread: ${depthData.spread.toFixed(2)}
        </div>
      </div>

      <div className="space-y-1 overflow-y-auto max-h-96">
        {/* Asks (Sellers) - Red */}
        <div className="space-y-0.5">
          <div className="text-xs text-red-400 font-medium mb-1">ASKS</div>
          {depthData.asks.slice().reverse().map((ask, index) => (
            <div
              key={`ask-${index}`}
              className="relative h-4 cursor-pointer group"
              onMouseEnter={() => setHoveredEntry({ type: 'ask', entry: ask })}
              onMouseLeave={() => setHoveredEntry(null)}
            >
              <div
                className="absolute inset-0 bg-red-600/20 rounded-sm transition-all"
                style={{ width: `${getIntensity(ask.size)}%` }}
              />
              <div className="absolute inset-0 flex items-center justify-between px-1 text-xs">
                <span className="text-red-400 font-mono">{ask.price.toFixed(2)}</span>
                <span className="text-white">{ask.size.toFixed(3)}</span>
              </div>
              {hoveredEntry?.entry === ask && (
                <div className="absolute right-0 top-4 z-10 bg-gray-900 border border-gray-600 rounded p-1 text-xs text-white">
                  Total: {ask.total.toFixed(3)}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Spread Indicator */}
        <div className="py-2 border-t border-b border-gray-600">
          <div className="text-center text-xs text-gray-400">
            Market Spread: ${depthData.spread.toFixed(2)}
          </div>
        </div>

        {/* Bids (Buyers) - Green */}
        <div className="space-y-0.5">
          <div className="text-xs text-green-400 font-medium mb-1">BIDS</div>
          {depthData.bids.map((bid, index) => (
            <div
              key={`bid-${index}`}
              className="relative h-4 cursor-pointer group"
              onMouseEnter={() => setHoveredEntry({ type: 'bid', entry: bid })}
              onMouseLeave={() => setHoveredEntry(null)}
            >
              <div
                className="absolute inset-0 bg-green-600/20 rounded-sm transition-all"
                style={{ width: `${getIntensity(bid.size)}%` }}
              />
              <div className="absolute inset-0 flex items-center justify-between px-1 text-xs">
                <span className="text-green-400 font-mono">{bid.price.toFixed(2)}</span>
                <span className="text-white">{bid.size.toFixed(3)}</span>
              </div>
              {hoveredEntry?.entry === bid && (
                <div className="absolute right-0 top-4 z-10 bg-gray-900 border border-gray-600 rounded p-1 text-xs text-white">
                  Total: {bid.total.toFixed(3)}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="mt-2 pt-2 border-t border-gray-700">
        <div className="flex justify-between text-xs text-gray-400">
          <div className="flex items-center space-x-1">
            <div className="w-2 h-2 bg-green-600/40 rounded"></div>
            <span>Bids</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-2 h-2 bg-red-600/40 rounded"></div>
            <span>Asks</span>
          </div>
        </div>
      </div>
    </Card>
  );
}