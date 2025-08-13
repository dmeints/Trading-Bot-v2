
/**
 * L2 Reconciliation Tests
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { OrderBook } from '../server/services/l2/OrderBook';

describe('L2 Reconciliation', () => {
  let orderBook: OrderBook;

  beforeEach(() => {
    orderBook = new OrderBook('BTCUSDT', 'binance');
  });

  it('should apply snapshot correctly', () => {
    const snapshot = {
      symbol: 'BTCUSDT',
      venue: 'binance',
      bids: [
        { price: 43000, size: 1.5 },
        { price: 42999, size: 2.0 }
      ],
      asks: [
        { price: 43001, size: 1.2 },
        { price: 43002, size: 1.8 }
      ],
      sequence: 1000,
      timestamp: Date.now()
    };

    orderBook.applySnapshot(snapshot);

    const bestBid = orderBook.getBestBid();
    const bestAsk = orderBook.getBestAsk();

    expect(bestBid?.price).toBe(43000);
    expect(bestBid?.size).toBe(1.5);
    expect(bestAsk?.price).toBe(43001);
    expect(bestAsk?.size).toBe(1.2);
    expect(orderBook.getSequence()).toBe(1000);
  });

  it('should apply deltas in sequence', () => {
    // Apply initial snapshot
    const snapshot = {
      symbol: 'BTCUSDT',
      venue: 'binance',
      bids: [{ price: 43000, size: 1.0 }],
      asks: [{ price: 43001, size: 1.0 }],
      sequence: 1000,
      timestamp: Date.now()
    };
    orderBook.applySnapshot(snapshot);

    // Apply delta
    const delta = {
      symbol: 'BTCUSDT',
      venue: 'binance',
      sequence: 1001,
      bids: [{ price: 43000, size: 2.0 }], // Update size
      asks: [],
      timestamp: Date.now()
    };

    const applied = orderBook.applyDelta(delta);
    expect(applied).toBe(true);
    expect(orderBook.getBestBid()?.size).toBe(2.0);
    expect(orderBook.getSequence()).toBe(1001);
  });

  it('should detect sequence gaps and trigger resync', () => {
    // Apply initial snapshot
    const snapshot = {
      symbol: 'BTCUSDT',
      venue: 'binance',
      bids: [{ price: 43000, size: 1.0 }],
      asks: [{ price: 43001, size: 1.0 }],
      sequence: 1000,
      timestamp: Date.now()
    };
    orderBook.applySnapshot(snapshot);

    // Apply delta with gap
    const delta = {
      symbol: 'BTCUSDT',
      venue: 'binance',
      sequence: 1005, // Gap: expected 1001
      bids: [{ price: 43000, size: 2.0 }],
      asks: [],
      timestamp: Date.now()
    };

    const applied = orderBook.applyDelta(delta);
    expect(applied).toBe(false); // Should fail due to gap
    expect(orderBook.getSequence()).toBe(1000); // Should remain unchanged
  });

  it('should calculate top-K levels correctly', () => {
    const snapshot = {
      symbol: 'BTCUSDT',
      venue: 'binance',
      bids: [
        { price: 43000, size: 1.0 },
        { price: 42999, size: 2.0 },
        { price: 42998, size: 1.5 }
      ],
      asks: [
        { price: 43001, size: 1.2 },
        { price: 43002, size: 1.8 },
        { price: 43003, size: 0.8 }
      ],
      sequence: 1000,
      timestamp: Date.now()
    };

    orderBook.applySnapshot(snapshot);
    const topK = orderBook.getTopK(2);

    expect(topK.bids).toHaveLength(2);
    expect(topK.asks).toHaveLength(2);
    
    // Bids should be sorted highest first
    expect(topK.bids[0].price).toBe(43000);
    expect(topK.bids[1].price).toBe(42999);
    
    // Asks should be sorted lowest first
    expect(topK.asks[0].price).toBe(43001);
    expect(topK.asks[1].price).toBe(43002);
  });

  it('should calculate spread and imbalance correctly', () => {
    const snapshot = {
      symbol: 'BTCUSDT',
      venue: 'binance',
      bids: [
        { price: 43000, size: 5.0 }
      ],
      asks: [
        { price: 43002, size: 2.0 }
      ],
      sequence: 1000,
      timestamp: Date.now()
    };

    orderBook.applySnapshot(snapshot);

    const spread = orderBook.getSpread();
    const midPrice = orderBook.getMidPrice();
    const imbalance = orderBook.getImbalance();

    expect(spread).toBe(2); // 43002 - 43000
    expect(midPrice).toBe(43001); // (43000 + 43002) / 2
    expect(imbalance).toBeCloseTo(0.429, 2); // (5-2)/(5+2) = 3/7
  });
});
