/**
 * INVARIANT TESTS: P&L MATH
 * Core profit/loss calculation validation with boundary conditions
 */

import { describe, test, expect } from '@jest/globals';

interface Position {
  symbol: string;
  side: 'long' | 'short';
  size: number;
  entryPrice: number;
  currentPrice: number;
  leverage?: number;
}

interface PnLResult {
  unrealizedPnL: number;
  realizedPnL: number;
  percentReturn: number;
  notionalValue: number;
}

class PnLCalculator {
  /**
   * Calculate unrealized P&L for a position
   */
  static calculateUnrealizedPnL(position: Position): PnLResult {
    const { side, size, entryPrice, currentPrice, leverage = 1 } = position;
    
    // Basic validation
    if (size <= 0) throw new Error('Position size must be positive');
    if (entryPrice <= 0) throw new Error('Entry price must be positive');
    if (currentPrice <= 0) throw new Error('Current price must be positive');
    if (leverage <= 0) throw new Error('Leverage must be positive');
    
    const notionalValue = size * entryPrice;
    const priceDiff = currentPrice - entryPrice;
    
    let unrealizedPnL: number;
    if (side === 'long') {
      unrealizedPnL = size * priceDiff * leverage;
    } else {
      unrealizedPnL = size * (-priceDiff) * leverage;
    }
    
    const percentReturn = (unrealizedPnL / notionalValue) * 100;
    
    return {
      unrealizedPnL,
      realizedPnL: 0,
      percentReturn,
      notionalValue
    };
  }
  
  /**
   * Calculate realized P&L on position close
   */
  static calculateRealizedPnL(
    side: 'long' | 'short',
    size: number,
    entryPrice: number,
    exitPrice: number,
    leverage: number = 1
  ): number {
    if (size <= 0) throw new Error('Position size must be positive');
    if (entryPrice <= 0) throw new Error('Entry price must be positive');
    if (exitPrice <= 0) throw new Error('Exit price must be positive');
    if (leverage <= 0) throw new Error('Leverage must be positive');
    
    const priceDiff = exitPrice - entryPrice;
    
    if (side === 'long') {
      return size * priceDiff * leverage;
    } else {
      return size * (-priceDiff) * leverage;
    }
  }
  
  /**
   * Calculate position cost basis
   */
  static calculateCostBasis(
    trades: Array<{ side: 'buy' | 'sell'; size: number; price: number; }>
  ): { averagePrice: number; netSize: number; totalCost: number; } {
    let totalCost = 0;
    let netSize = 0;
    
    for (const trade of trades) {
      const tradeValue = trade.size * trade.price;
      
      if (trade.side === 'buy') {
        totalCost += tradeValue;
        netSize += trade.size;
      } else {
        totalCost -= tradeValue;
        netSize -= trade.size;
      }
    }
    
    const averagePrice = netSize !== 0 ? Math.abs(totalCost / netSize) : 0;
    
    return { averagePrice, netSize, totalCost };
  }
}

describe('P&L Math Invariants', () => {
  describe('Unrealized P&L Calculations', () => {
    test('Long position profit when price increases', () => {
      const position: Position = {
        symbol: 'BTC',
        side: 'long',
        size: 1,
        entryPrice: 50000,
        currentPrice: 55000
      };
      
      const result = PnLCalculator.calculateUnrealizedPnL(position);
      
      expect(result.unrealizedPnL).toBe(5000);
      expect(result.percentReturn).toBe(10);
      expect(result.notionalValue).toBe(50000);
    });
    
    test('Long position loss when price decreases', () => {
      const position: Position = {
        symbol: 'BTC',
        side: 'long',
        size: 1,
        entryPrice: 50000,
        currentPrice: 45000
      };
      
      const result = PnLCalculator.calculateUnrealizedPnL(position);
      
      expect(result.unrealizedPnL).toBe(-5000);
      expect(result.percentReturn).toBe(-10);
    });
    
    test('Short position profit when price decreases', () => {
      const position: Position = {
        symbol: 'BTC',
        side: 'short',
        size: 1,
        entryPrice: 50000,
        currentPrice: 45000
      };
      
      const result = PnLCalculator.calculateUnrealizedPnL(position);
      
      expect(result.unrealizedPnL).toBe(5000);
      expect(result.percentReturn).toBe(10);
    });
    
    test('Short position loss when price increases', () => {
      const position: Position = {
        symbol: 'BTC',
        side: 'short',
        size: 1,
        entryPrice: 50000,
        currentPrice: 55000
      };
      
      const result = PnLCalculator.calculateUnrealizedPnL(position);
      
      expect(result.unrealizedPnL).toBe(-5000);
      expect(result.percentReturn).toBe(-10);
    });
    
    test('Leverage amplifies P&L correctly', () => {
      const position: Position = {
        symbol: 'BTC',
        side: 'long',
        size: 1,
        entryPrice: 50000,
        currentPrice: 55000,
        leverage: 10
      };
      
      const result = PnLCalculator.calculateUnrealizedPnL(position);
      
      expect(result.unrealizedPnL).toBe(50000); // 5000 * 10x leverage
      expect(result.percentReturn).toBe(100); // 10% * 10x leverage
    });
    
    test('Zero P&L when prices are equal', () => {
      const position: Position = {
        symbol: 'BTC',
        side: 'long',
        size: 1,
        entryPrice: 50000,
        currentPrice: 50000
      };
      
      const result = PnLCalculator.calculateUnrealizedPnL(position);
      
      expect(result.unrealizedPnL).toBe(0);
      expect(result.percentReturn).toBe(0);
    });
  });
  
  describe('Realized P&L Calculations', () => {
    test('Realized profit matches unrealized at close', () => {
      const realizedPnL = PnLCalculator.calculateRealizedPnL('long', 1, 50000, 55000);
      expect(realizedPnL).toBe(5000);
    });
    
    test('Realized loss for short position', () => {
      const realizedPnL = PnLCalculator.calculateRealizedPnL('short', 1, 50000, 55000);
      expect(realizedPnL).toBe(-5000);
    });
  });
  
  describe('Cost Basis Calculations', () => {
    test('Single buy trade cost basis', () => {
      const trades = [{ side: 'buy' as const, size: 1, price: 50000 }];
      const result = PnLCalculator.calculateCostBasis(trades);
      
      expect(result.averagePrice).toBe(50000);
      expect(result.netSize).toBe(1);
      expect(result.totalCost).toBe(50000);
    });
    
    test('Multiple buy trades average correctly', () => {
      const trades = [
        { side: 'buy' as const, size: 1, price: 50000 },
        { side: 'buy' as const, size: 1, price: 60000 }
      ];
      const result = PnLCalculator.calculateCostBasis(trades);
      
      expect(result.averagePrice).toBe(55000);
      expect(result.netSize).toBe(2);
      expect(result.totalCost).toBe(110000);
    });
    
    test('Buy then sell reduces position', () => {
      const trades = [
        { side: 'buy' as const, size: 2, price: 50000 },
        { side: 'sell' as const, size: 1, price: 55000 }
      ];
      const result = PnLCalculator.calculateCostBasis(trades);
      
      expect(result.netSize).toBe(1);
      expect(result.totalCost).toBe(45000); // 100000 - 55000
    });
  });
  
  describe('Edge Cases and Invariants', () => {
    test('Invalid position size throws error', () => {
      const position: Position = {
        symbol: 'BTC',
        side: 'long',
        size: -1,
        entryPrice: 50000,
        currentPrice: 55000
      };
      
      expect(() => PnLCalculator.calculateUnrealizedPnL(position)).toThrow('Position size must be positive');
    });
    
    test('Invalid entry price throws error', () => {
      const position: Position = {
        symbol: 'BTC',
        side: 'long',
        size: 1,
        entryPrice: -50000,
        currentPrice: 55000
      };
      
      expect(() => PnLCalculator.calculateUnrealizedPnL(position)).toThrow('Entry price must be positive');
    });
    
    test('Invalid current price throws error', () => {
      const position: Position = {
        symbol: 'BTC',
        side: 'long',
        size: 1,
        entryPrice: 50000,
        currentPrice: 0
      };
      
      expect(() => PnLCalculator.calculateUnrealizedPnL(position)).toThrow('Current price must be positive');
    });
    
    test('P&L symmetry: long profit equals short loss', () => {
      const longResult = PnLCalculator.calculateUnrealizedPnL({
        symbol: 'BTC',
        side: 'long',
        size: 1,
        entryPrice: 50000,
        currentPrice: 55000
      });
      
      const shortResult = PnLCalculator.calculateUnrealizedPnL({
        symbol: 'BTC',
        side: 'short',
        size: 1,
        entryPrice: 50000,
        currentPrice: 55000
      });
      
      expect(longResult.unrealizedPnL).toBe(-shortResult.unrealizedPnL);
    });
    
    test('Fractional sizes work correctly', () => {
      const result = PnLCalculator.calculateUnrealizedPnL({
        symbol: 'BTC',
        side: 'long',
        size: 0.5,
        entryPrice: 50000,
        currentPrice: 55000
      });
      
      expect(result.unrealizedPnL).toBe(2500);
      expect(result.percentReturn).toBe(10);
    });
    
    test('Very large numbers maintain precision', () => {
      const result = PnLCalculator.calculateUnrealizedPnL({
        symbol: 'BTC',
        side: 'long',
        size: 1000000,
        entryPrice: 50000,
        currentPrice: 50001
      });
      
      expect(result.unrealizedPnL).toBe(1000000);
      expect(result.percentReturn).toBeCloseTo(0.002, 6);
    });
  });
});