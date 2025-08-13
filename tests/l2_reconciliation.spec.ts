
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
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { OrderBook, BookDelta } from '../server/services/l2/OrderBook.js';
import { BookMaintainer } from '../server/services/l2/BookMaintainer.js';

describe('L2 Order Book', () => {
  let book: OrderBook;

  beforeEach(() => {
    book = new OrderBook('binance', 'BTCUSDT');
  });

  it('should apply snapshot correctly', () => {
    const snapshot = {
      bids: [{ price: 45000, size: 1.5 }, { price: 44990, size: 2.0 }],
      asks: [{ price: 45010, size: 1.2 }, { price: 45020, size: 1.8 }],
      seq: 100,
      timestamp: Date.now()
    };

    book.applySnapshot(snapshot);

    const bestBid = book.getBestBid();
    const bestAsk = book.getBestAsk();

    expect(bestBid?.price).toBe(45000);
    expect(bestBid?.size).toBe(1.5);
    expect(bestAsk?.price).toBe(45010);
    expect(bestAsk?.size).toBe(1.2);
    expect(book.getSequence()).toBe(100);
  });

  it('should apply deltas in sequence', () => {
    // Apply initial snapshot
    book.applySnapshot({
      bids: [{ price: 45000, size: 1.0 }],
      asks: [{ price: 45010, size: 1.0 }],
      seq: 100,
      timestamp: Date.now()
    });

    // Apply delta
    const delta: BookDelta = {
      type: 'update',
      side: 'bid',
      price: 45000,
      size: 2.0,
      seq: 101
    };

    const result = book.applyDelta(delta);
    expect(result).toBe(true);

    const bestBid = book.getBestBid();
    expect(bestBid?.size).toBe(2.0);
    expect(book.getSequence()).toBe(101);
  });

  it('should reject out-of-sequence deltas', () => {
    book.applySnapshot({
      bids: [{ price: 45000, size: 1.0 }],
      asks: [{ price: 45010, size: 1.0 }],
      seq: 100,
      timestamp: Date.now()
    });

    // Try to apply delta with gap
    const delta: BookDelta = {
      type: 'update',
      side: 'bid',
      price: 45000,
      size: 2.0,
      seq: 105 // Gap!
    };

    const result = book.applyDelta(delta);
    expect(result).toBe(false);
    expect(book.getSequence()).toBe(100); // Unchanged
  });

  it('should calculate aggregates correctly', () => {
    book.applySnapshot({
      bids: [
        { price: 45000, size: 1.0 },
        { price: 44990, size: 2.0 },
        { price: 44980, size: 1.5 }
      ],
      asks: [
        { price: 45010, size: 1.2 },
        { price: 45020, size: 1.8 },
        { price: 45030, size: 2.2 }
      ],
      seq: 100,
      timestamp: Date.now()
    });

    const aggregates = book.getAggregates();

    expect(aggregates.bidVolume).toBe(4.5);
    expect(aggregates.askVolume).toBe(5.2);
    expect(aggregates.spread).toBe(10);
    expect(aggregates.midPrice).toBe(45005);
    expect(aggregates.weightedMid).toBeCloseTo(45004.55, 1);
  });

  it('should handle deletions', () => {
    book.applySnapshot({
      bids: [{ price: 45000, size: 1.0 }],
      asks: [{ price: 45010, size: 1.0 }],
      seq: 100,
      timestamp: Date.now()
    });

    const deleteDelta: BookDelta = {
      type: 'delete',
      side: 'bid',
      price: 45000,
      size: 0,
      seq: 101
    };

    book.applyDelta(deleteDelta);

    const bestBid = book.getBestBid();
    expect(bestBid).toBe(null);
  });
});

describe('Book Maintainer', () => {
  let maintainer: BookMaintainer;

  beforeEach(() => {
    maintainer = new BookMaintainer();
  });

  afterEach(() => {
    maintainer.destroy();
  });

  it('should fetch and maintain books', async () => {
    await maintainer.startMaintaining('binance', 'BTCUSDT');

    const book = maintainer.getBook('binance', 'BTCUSDT');
    expect(book).toBeDefined();
    expect(book?.bids.length).toBeGreaterThan(0);
    expect(book?.asks.length).toBeGreaterThan(0);
  });

  it('should provide aggregates for microstructure', async () => {
    await maintainer.startMaintaining('binance', 'BTCUSDT');

    const aggregates = maintainer.getAggregates('binance', 'BTCUSDT');
    expect(aggregates).toBeDefined();
    expect(typeof aggregates?.spread).toBe('number');
    expect(typeof aggregates?.midPrice).toBe('number');
  });
});
