
/**
 * Microstructure Features Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { microstructureFeatures, OrderBookSnapshot, TradeEvent } from '../server/services/microstructure/Features';

describe('MicrostructureFeatures', () => {
  beforeEach(() => {
    // Reset state between tests
  });

  describe('Order Book Imbalance (OBI)', () => {
    it('should calculate positive OBI when bids dominate', () => {
      const orderBook: OrderBookSnapshot = {
        symbol: 'BTCUSDT',
        timestamp: new Date(),
        bids: [
          { price: 50000, size: 10 },
          { price: 49950, size: 8 },
          { price: 49900, size: 6 }
        ],
        asks: [
          { price: 50050, size: 2 },
          { price: 50100, size: 3 },
          { price: 50150, size: 1 }
        ]
      };

      const snapshot = microstructureFeatures.updateOrderBook(orderBook);
      
      expect(snapshot.obi).toBeGreaterThan(0);
      expect(snapshot.obi).toBeLessThanOrEqual(1);
    });

    it('should calculate negative OBI when asks dominate', () => {
      const orderBook: OrderBookSnapshot = {
        symbol: 'BTCUSDT',
        timestamp: new Date(),
        bids: [
          { price: 50000, size: 2 },
          { price: 49950, size: 1 },
          { price: 49900, size: 1 }
        ],
        asks: [
          { price: 50050, size: 10 },
          { price: 50100, size: 8 },
          { price: 50150, size: 6 }
        ]
      };

      const snapshot = microstructureFeatures.updateOrderBook(orderBook);
      
      expect(snapshot.obi).toBeLessThan(0);
      expect(snapshot.obi).toBeGreaterThanOrEqual(-1);
    });

    it('should handle empty order book gracefully', () => {
      const orderBook: OrderBookSnapshot = {
        symbol: 'BTCUSDT',
        timestamp: new Date(),
        bids: [],
        asks: []
      };

      const snapshot = microstructureFeatures.updateOrderBook(orderBook);
      
      expect(snapshot.obi).toBe(0);
    });
  });

  describe('Trade Imbalance (TI)', () => {
    it('should calculate positive TI when buy volume dominates', () => {
      const symbol = 'BTCUSDT';
      
      // Add some buy-heavy trades
      for (let i = 0; i < 5; i++) {
        const trade: TradeEvent = {
          symbol,
          timestamp: new Date(),
          price: 50000 + i,
          size: 1,
          side: 'buy'
        };
        microstructureFeatures.updateTrade(trade);
      }

      // Add one sell trade
      const sellTrade: TradeEvent = {
        symbol,
        timestamp: new Date(),
        price: 50000,
        size: 0.5,
        side: 'sell'
      };
      microstructureFeatures.updateTrade(sellTrade);

      const snapshot = microstructureFeatures.getSnapshot(symbol);
      expect(snapshot).toBeTruthy();
      expect(snapshot!.ti).toBeGreaterThan(0);
    });

    it('should return zero TI when no trades exist', () => {
      const snapshot = microstructureFeatures.getSnapshot('NEWCOIN');
      expect(snapshot).toBeNull();
    });
  });

  describe('Spread Calculation', () => {
    it('should calculate spread in basis points correctly', () => {
      const orderBook: OrderBookSnapshot = {
        symbol: 'BTCUSDT',
        timestamp: new Date(),
        bids: [{ price: 50000, size: 1 }],
        asks: [{ price: 50100, size: 1 }]
      };

      const snapshot = microstructureFeatures.updateOrderBook(orderBook);
      
      // Spread = 100, mid = 50050, spread bps = (100/50050) * 10000 ≈ 20 bps
      expect(snapshot.spread_bps).toBeCloseTo(20, 0);
    });

    it('should handle zero spread correctly', () => {
      const orderBook: OrderBookSnapshot = {
        symbol: 'BTCUSDT',
        timestamp: new Date(),
        bids: [{ price: 50000, size: 1 }],
        asks: [{ price: 50000, size: 1 }]
      };

      const snapshot = microstructureFeatures.updateOrderBook(orderBook);
      
      expect(snapshot.spread_bps).toBe(0);
    });
  });

  describe('Mock Data Generation', () => {
    it('should generate realistic mock snapshot', () => {
      const snapshot = microstructureFeatures.generateMockSnapshot('BTCUSDT');
      
      expect(snapshot.symbol).toBe('BTCUSDT');
      expect(snapshot.obi).toBeGreaterThanOrEqual(-1);
      expect(snapshot.obi).toBeLessThanOrEqual(1);
      expect(snapshot.ti).toBeGreaterThanOrEqual(-1);
      expect(snapshot.ti).toBeLessThanOrEqual(1);
      expect(snapshot.spread_bps).toBeGreaterThan(0);
      expect(snapshot.micro_vol).toBeGreaterThan(0);
      expect(snapshot.cancel_rate).toBeGreaterThanOrEqual(0);
      expect(snapshot.cancel_rate).toBeLessThanOrEqual(1);
    });
  });

  describe('Micro Volatility', () => {
    it('should calculate volatility from price changes', () => {
      const symbol = 'BTCUSDT';
      
      // Create order book with changing prices
      const prices = [50000, 50100, 49950, 50200, 49800];
      
      for (let i = 0; i < prices.length; i++) {
        const orderBook: OrderBookSnapshot = {
          symbol,
          timestamp: new Date(Date.now() + i * 1000),
          bids: [{ price: prices[i] - 25, size: 1 }],
          asks: [{ price: prices[i] + 25, size: 1 }]
        };
        
        microstructureFeatures.updateOrderBook(orderBook);
      }

      const snapshot = microstructureFeatures.getSnapshot(symbol);
      expect(snapshot).toBeTruthy();
      expect(snapshot!.micro_vol).toBeGreaterThan(0);
    });
  });
});
