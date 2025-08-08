/**
 * INVARIANT TESTS: FEES AND FUNDING
 * Trading fees, funding rates, and cost calculation validation
 */

import { describe, test, expect } from '@jest/globals';

interface TradingFees {
  makerFee: number;
  takerFee: number;
  withdrawalFee?: number;
}

interface FundingRate {
  rate: number; // 8-hour funding rate
  timestamp: number;
  nextFunding: number;
}

interface Trade {
  side: 'buy' | 'sell';
  size: number;
  price: number;
  isMaker: boolean;
  timestamp: number;
}

class FeeCalculator {
  /**
   * Calculate trading fees for a trade
   */
  static calculateTradingFees(trade: Trade, feeStructure: TradingFees): number {
    if (trade.size <= 0) throw new Error('Trade size must be positive');
    if (trade.price <= 0) throw new Error('Trade price must be positive');
    if (feeStructure.makerFee < 0) throw new Error('Maker fee cannot be negative');
    if (feeStructure.takerFee < 0) throw new Error('Taker fee cannot be negative');
    
    const notional = trade.size * trade.price;
    const feeRate = trade.isMaker ? feeStructure.makerFee : feeStructure.takerFee;
    
    return notional * feeRate;
  }
  
  /**
   * Calculate funding payment for a position
   */
  static calculateFundingPayment(
    side: 'long' | 'short',
    positionSize: number,
    markPrice: number,
    fundingRate: number
  ): number {
    if (positionSize <= 0) throw new Error('Position size must be positive');
    if (markPrice <= 0) throw new Error('Mark price must be positive');
    
    const notionalValue = positionSize * markPrice;
    const fundingPayment = notionalValue * fundingRate;
    
    // Longs pay when funding is positive, shorts receive
    // Shorts pay when funding is negative, longs receive
    return side === 'long' ? -fundingPayment : fundingPayment;
  }
  
  /**
   * Calculate total trading costs including fees and funding
   */
  static calculateTotalTradingCosts(
    trades: Trade[],
    feeStructure: TradingFees,
    fundingHistory: Array<{ rate: number; positionSize: number; markPrice: number; side: 'long' | 'short' }>
  ): {
    totalFees: number;
    totalFunding: number;
    totalCosts: number;
    breakdown: { tradingFees: number[]; fundingPayments: number[] };
  } {
    const tradingFees = trades.map(trade => this.calculateTradingFees(trade, feeStructure));
    const fundingPayments = fundingHistory.map(funding => 
      this.calculateFundingPayment(funding.side, funding.positionSize, funding.markPrice, funding.rate)
    );
    
    const totalFees = tradingFees.reduce((sum, fee) => sum + fee, 0);
    const totalFunding = fundingPayments.reduce((sum, payment) => sum + payment, 0);
    
    return {
      totalFees,
      totalFunding,
      totalCosts: totalFees + totalFunding,
      breakdown: { tradingFees, fundingPayments }
    };
  }
}

describe('Fees and Funding Invariants', () => {
  const standardFees: TradingFees = {
    makerFee: 0.001, // 0.1%
    takerFee: 0.002  // 0.2%
  };
  
  describe('Trading Fee Calculations', () => {
    test('Maker fee calculation', () => {
      const trade: Trade = {
        side: 'buy',
        size: 1,
        price: 50000,
        isMaker: true,
        timestamp: Date.now()
      };
      
      const fee = FeeCalculator.calculateTradingFees(trade, standardFees);
      expect(fee).toBe(50); // 50000 * 0.001
    });
    
    test('Taker fee calculation', () => {
      const trade: Trade = {
        side: 'sell',
        size: 1,
        price: 50000,
        isMaker: false,
        timestamp: Date.now()
      };
      
      const fee = FeeCalculator.calculateTradingFees(trade, standardFees);
      expect(fee).toBe(100); // 50000 * 0.002
    });
    
    test('Fractional size fee calculation', () => {
      const trade: Trade = {
        side: 'buy',
        size: 0.5,
        price: 50000,
        isMaker: true,
        timestamp: Date.now()
      };
      
      const fee = FeeCalculator.calculateTradingFees(trade, standardFees);
      expect(fee).toBe(25); // 25000 * 0.001
    });
    
    test('Zero fees with zero rate', () => {
      const trade: Trade = {
        side: 'buy',
        size: 1,
        price: 50000,
        isMaker: true,
        timestamp: Date.now()
      };
      
      const zeroFees: TradingFees = { makerFee: 0, takerFee: 0 };
      const fee = FeeCalculator.calculateTradingFees(trade, zeroFees);
      expect(fee).toBe(0);
    });
  });
  
  describe('Funding Rate Calculations', () => {
    test('Long position pays positive funding', () => {
      const payment = FeeCalculator.calculateFundingPayment('long', 1, 50000, 0.0001);
      expect(payment).toBe(-5); // -(1 * 50000 * 0.0001)
    });
    
    test('Short position receives positive funding', () => {
      const payment = FeeCalculator.calculateFundingPayment('short', 1, 50000, 0.0001);
      expect(payment).toBe(5); // +(1 * 50000 * 0.0001)
    });
    
    test('Long position receives negative funding', () => {
      const payment = FeeCalculator.calculateFundingPayment('long', 1, 50000, -0.0001);
      expect(payment).toBe(5); // -(-1 * 50000 * 0.0001)
    });
    
    test('Short position pays negative funding', () => {
      const payment = FeeCalculator.calculateFundingPayment('short', 1, 50000, -0.0001);
      expect(payment).toBe(-5); // +(-1 * 50000 * 0.0001)
    });
    
    test('Zero funding rate results in zero payment', () => {
      const payment = FeeCalculator.calculateFundingPayment('long', 1, 50000, 0);
      expect(payment).toBe(0);
    });
    
    test('Larger position size scales funding proportionally', () => {
      const payment1 = FeeCalculator.calculateFundingPayment('long', 1, 50000, 0.0001);
      const payment10 = FeeCalculator.calculateFundingPayment('long', 10, 50000, 0.0001);
      
      expect(payment10).toBe(payment1 * 10);
    });
  });
  
  describe('Total Trading Costs', () => {
    test('Combined fees and funding calculation', () => {
      const trades: Trade[] = [
        { side: 'buy', size: 1, price: 50000, isMaker: true, timestamp: Date.now() },
        { side: 'sell', size: 1, price: 51000, isMaker: false, timestamp: Date.now() }
      ];
      
      const fundingHistory = [
        { rate: 0.0001, positionSize: 1, markPrice: 50500, side: 'long' as const }
      ];
      
      const result = FeeCalculator.calculateTotalTradingCosts(trades, standardFees, fundingHistory);
      
      expect(result.totalFees).toBe(152); // 50 + 102
      expect(result.totalFunding).toBe(-5.05); // -(1 * 50500 * 0.0001)
      expect(result.totalCosts).toBe(146.95); // 152 - 5.05
    });
    
    test('Breakdown matches totals', () => {
      const trades: Trade[] = [
        { side: 'buy', size: 1, price: 50000, isMaker: true, timestamp: Date.now() }
      ];
      
      const fundingHistory = [
        { rate: 0.0001, positionSize: 1, markPrice: 50000, side: 'long' as const }
      ];
      
      const result = FeeCalculator.calculateTotalTradingCosts(trades, standardFees, fundingHistory);
      
      const breakdownFees = result.breakdown.tradingFees.reduce((sum, fee) => sum + fee, 0);
      const breakdownFunding = result.breakdown.fundingPayments.reduce((sum, payment) => sum + payment, 0);
      
      expect(breakdownFees).toBe(result.totalFees);
      expect(breakdownFunding).toBe(result.totalFunding);
    });
  });
  
  describe('Edge Cases and Validation', () => {
    test('Invalid trade size throws error', () => {
      const trade: Trade = {
        side: 'buy',
        size: -1,
        price: 50000,
        isMaker: true,
        timestamp: Date.now()
      };
      
      expect(() => FeeCalculator.calculateTradingFees(trade, standardFees)).toThrow('Trade size must be positive');
    });
    
    test('Invalid trade price throws error', () => {
      const trade: Trade = {
        side: 'buy',
        size: 1,
        price: 0,
        isMaker: true,
        timestamp: Date.now()
      };
      
      expect(() => FeeCalculator.calculateTradingFees(trade, standardFees)).toThrow('Trade price must be positive');
    });
    
    test('Negative maker fee throws error', () => {
      const trade: Trade = {
        side: 'buy',
        size: 1,
        price: 50000,
        isMaker: true,
        timestamp: Date.now()
      };
      
      const invalidFees: TradingFees = { makerFee: -0.001, takerFee: 0.002 };
      
      expect(() => FeeCalculator.calculateTradingFees(trade, invalidFees)).toThrow('Maker fee cannot be negative');
    });
    
    test('Negative taker fee throws error', () => {
      const trade: Trade = {
        side: 'buy',
        size: 1,
        price: 50000,
        isMaker: false,
        timestamp: Date.now()
      };
      
      const invalidFees: TradingFees = { makerFee: 0.001, takerFee: -0.002 };
      
      expect(() => FeeCalculator.calculateTradingFees(trade, invalidFees)).toThrow('Taker fee cannot be negative');
    });
    
    test('Very small amounts maintain precision', () => {
      const trade: Trade = {
        side: 'buy',
        size: 0.00001,
        price: 50000,
        isMaker: true,
        timestamp: Date.now()
      };
      
      const fee = FeeCalculator.calculateTradingFees(trade, standardFees);
      expect(fee).toBeCloseTo(0.5, 10); // 0.00001 * 50000 * 0.001
    });
    
    test('Very large amounts work correctly', () => {
      const trade: Trade = {
        side: 'buy',
        size: 1000000,
        price: 50000,
        isMaker: true,
        timestamp: Date.now()
      };
      
      const fee = FeeCalculator.calculateTradingFees(trade, standardFees);
      expect(fee).toBe(50000000); // 1000000 * 50000 * 0.001
    });
    
    test('Fee symmetry: buy and sell same fee rate', () => {
      const buyTrade: Trade = {
        side: 'buy',
        size: 1,
        price: 50000,
        isMaker: true,
        timestamp: Date.now()
      };
      
      const sellTrade: Trade = {
        side: 'sell',
        size: 1,
        price: 50000,
        isMaker: true,
        timestamp: Date.now()
      };
      
      const buyFee = FeeCalculator.calculateTradingFees(buyTrade, standardFees);
      const sellFee = FeeCalculator.calculateTradingFees(sellTrade, standardFees);
      
      expect(buyFee).toBe(sellFee);
    });
  });
});