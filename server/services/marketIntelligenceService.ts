/**
 * Advanced Market Intelligence System
 * Deep market microstructure analysis and whale tracking
 */

import axios from 'axios';
import { db } from '../db';
import {
  orderFlowData,
  whaleMovements,
  arbitrageOpportunities,
  optionsFlow,
  type OrderFlowData,
  type WhaleMovement,
  type ArbitrageOpportunity,
  type OptionsFlow
} from '../../shared/schema';
import { eq, desc, gte, and } from 'drizzle-orm';

interface OrderFlowAnalysis {
  largeOrders: { size: number; side: 'buy' | 'sell'; price: number; timestamp: number }[];
  institutionalFlow: number; // -1 to 1
  retailFlow: number; // -1 to 1
  smartMoneyIndicator: number; // -1 to 1
  liquidityShocks: { price: number; impact: number; direction: 'up' | 'down' }[];
}

interface WhaleAlert {
  address: string;
  amount: number;
  type: 'deposit' | 'withdrawal' | 'transfer';
  exchange?: string;
  significance: 'low' | 'medium' | 'high' | 'extreme';
  priceImpactEstimate: number;
}

interface CrossExchangeArbitrage {
  symbol: string;
  buyExchange: string;
  sellExchange: string;
  priceDifference: number;
  percentageGap: number;
  estimatedProfit: number;
  requiredCapital: number;
  riskLevel: 'low' | 'medium' | 'high';
}

interface OptionsFlowSignal {
  symbol: string;
  bullishFlow: number;
  bearishFlow: number;
  unusualActivity: boolean;
  maxPainLevel: number;
  expirationBias: 'bullish' | 'bearish' | 'neutral';
  significance: number;
}

export class MarketIntelligenceService {
  private exchanges = ['binance', 'coinbase', 'kraken', 'bitfinex'];
  private whaleThreshold = 1000000; // $1M USD
  private arbitrageThreshold = 0.005; // 0.5%

  constructor() {}

  async analyzeOrderFlow(symbol: string): Promise<OrderFlowAnalysis> {
    try {
      // Get order book data from multiple exchanges
      const orderBooks = await this.getMultiExchangeOrderBooks(symbol);
      const trades = await this.getRecentLargeTrades(symbol);

      // Analyze large orders
      const largeOrders = trades.filter(trade => trade.size > 100000); // $100k+ orders

      // Calculate institutional vs retail flow
      const institutionalFlow = this.calculateInstitutionalFlow(largeOrders);
      const retailFlow = this.calculateRetailFlow(trades);

      // Smart money indicator (based on order flow imbalances)
      const smartMoneyIndicator = this.calculateSmartMoneyIndicator(orderBooks, trades);

      // Detect liquidity shocks
      const liquidityShocks = this.detectLiquidityShocks(orderBooks, trades);

      // Record order flow data
      await db.insert(orderFlowData).values({
        symbol,
        largeOrderCount: largeOrders.length,
        institutionalFlow,
        retailFlow,
        smartMoneyIndicator,
        averageOrderSize: trades.reduce((sum, t) => sum + t.size, 0) / trades.length,
        marketData: { orderBooks: orderBooks.length, tradesAnalyzed: trades.length },
        timestamp: new Date()
      });

      return {
        largeOrders: largeOrders.map(order => ({
          size: order.size,
          side: order.side,
          price: order.price,
          timestamp: order.timestamp
        })),
        institutionalFlow,
        retailFlow,
        smartMoneyIndicator,
        liquidityShocks
      };
    } catch (error) {
      console.error('Order flow analysis error:', error);
      return {
        largeOrders: [],
        institutionalFlow: 0,
        retailFlow: 0,
        smartMoneyIndicator: 0,
        liquidityShocks: []
      };
    }
  }

  async trackWhaleMovements(symbol: string): Promise<WhaleAlert[]> {
    const alerts: WhaleAlert[] = [];

    try {
      // Monitor large on-chain transactions
      const onChainMovements = await this.getOnChainMovements(symbol);
      
      // Monitor exchange deposits/withdrawals
      const exchangeMovements = await this.getExchangeMovements(symbol);

      // Combine and analyze movements
      const allMovements = [...onChainMovements, ...exchangeMovements];

      for (const movement of allMovements) {
        if (movement.amount > this.whaleThreshold) {
          const significance = this.assessMovementSignificance(movement.amount, movement.type);
          const priceImpactEstimate = this.estimatePriceImpact(movement.amount, symbol);

          const alert: WhaleAlert = {
            address: movement.address,
            amount: movement.amount,
            type: movement.type,
            exchange: movement.exchange,
            significance,
            priceImpactEstimate
          };

          alerts.push(alert);

          // Record whale movement
          await db.insert(whaleMovements).values({
            symbol,
            address: movement.address,
            amount: movement.amount,
            movementType: movement.type,
            exchange: movement.exchange,
            significance,
            priceImpactEstimate,
            timestamp: new Date()
          });
        }
      }
    } catch (error) {
      console.error('Whale tracking error:', error);
    }

    return alerts;
  }

  async findArbitrageOpportunities(): Promise<CrossExchangeArbitrage[]> {
    const opportunities: CrossExchangeArbitrage[] = [];
    const symbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'];

    try {
      for (const symbol of symbols) {
        const prices = await this.getCrossExchangePrices(symbol);
        
        // Find best buy and sell prices
        const sortedPrices = Object.entries(prices).sort((a, b) => a[1] - b[1]);
        const lowestPrice = sortedPrices[0];
        const highestPrice = sortedPrices[sortedPrices.length - 1];

        if (lowestPrice && highestPrice) {
          const priceDifference = highestPrice[1] - lowestPrice[1];
          const percentageGap = (priceDifference / lowestPrice[1]) * 100;

          if (percentageGap > this.arbitrageThreshold * 100) {
            const requiredCapital = 10000; // $10k example
            const estimatedProfit = (requiredCapital * percentageGap / 100) - (requiredCapital * 0.002); // Minus fees

            if (estimatedProfit > 0) {
              const opportunity: CrossExchangeArbitrage = {
                symbol,
                buyExchange: lowestPrice[0],
                sellExchange: highestPrice[0],
                priceDifference,
                percentageGap,
                estimatedProfit,
                requiredCapital,
                riskLevel: percentageGap > 1 ? 'medium' : 'low'
              };

              opportunities.push(opportunity);

              // Record arbitrage opportunity
              await db.insert(arbitrageOpportunities).values({
                symbol,
                buyExchange: lowestPrice[0],
                sellExchange: highestPrice[0],
                priceDifference,
                percentageGap,
                estimatedProfit,
                requiredCapital,
                riskLevel: opportunity.riskLevel,
                timestamp: new Date()
              });
            }
          }
        }
      }
    } catch (error) {
      console.error('Arbitrage analysis error:', error);
    }

    return opportunities;
  }

  async analyzeOptionsFlow(symbol: string): Promise<OptionsFlowSignal> {
    try {
      // Get options data (simplified for demo)
      const optionsData = await this.getOptionsData(symbol);
      
      let bullishFlow = 0;
      let bearishFlow = 0;
      let unusualActivity = false;
      let maxPainLevel = 0;
      let expirationBias: 'bullish' | 'bearish' | 'neutral' = 'neutral';

      if (optionsData && optionsData.length > 0) {
        // Analyze call vs put volume
        const callVolume = optionsData.filter(o => o.type === 'call').reduce((sum, o) => sum + o.volume, 0);
        const putVolume = optionsData.filter(o => o.type === 'put').reduce((sum, o) => sum + o.volume, 0);

        bullishFlow = callVolume / (callVolume + putVolume);
        bearishFlow = putVolume / (callVolume + putVolume);

        // Detect unusual activity
        const avgVolume = optionsData.reduce((sum, o) => sum + o.volume, 0) / optionsData.length;
        const volumeSpike = Math.max(...optionsData.map(o => o.volume)) / avgVolume;
        unusualActivity = volumeSpike > 3;

        // Calculate max pain (simplified)
        maxPainLevel = this.calculateMaxPain(optionsData);

        // Determine bias
        if (bullishFlow > 0.6) expirationBias = 'bullish';
        else if (bearishFlow > 0.6) expirationBias = 'bearish';
        else expirationBias = 'neutral';
      }

      const significance = Math.abs(bullishFlow - bearishFlow) + (unusualActivity ? 0.3 : 0);

      // Record options flow
      await db.insert(optionsFlow).values({
        symbol,
        callVolume: bullishFlow * 1000, // Simplified
        putVolume: bearishFlow * 1000,
        callPutRatio: bullishFlow / Math.max(bearishFlow, 0.01),
        unusualActivity,
        maxPain: maxPainLevel,
        significance,
        timestamp: new Date()
      });

      return {
        symbol,
        bullishFlow,
        bearishFlow,
        unusualActivity,
        maxPainLevel,
        expirationBias,
        significance
      };
    } catch (error) {
      console.error('Options flow analysis error:', error);
      return {
        symbol,
        bullishFlow: 0.5,
        bearishFlow: 0.5,
        unusualActivity: false,
        maxPainLevel: 0,
        expirationBias: 'neutral',
        significance: 0
      };
    }
  }

  async getMarketIntelligenceSummary(symbol: string): Promise<any> {
    const [orderFlow, whales, arbitrage, options] = await Promise.all([
      this.analyzeOrderFlow(symbol),
      this.trackWhaleMovements(symbol),
      this.findArbitrageOpportunities(),
      this.analyzeOptionsFlow(symbol)
    ]);

    return {
      timestamp: Date.now(),
      symbol,
      orderFlow: {
        institutionalBias: orderFlow.institutionalFlow > 0.1 ? 'bullish' : orderFlow.institutionalFlow < -0.1 ? 'bearish' : 'neutral',
        smartMoney: orderFlow.smartMoneyIndicator,
        largeOrderCount: orderFlow.largeOrders.length,
        liquidityRisk: orderFlow.liquidityShocks.length > 0
      },
      whaleActivity: {
        alertCount: whales.length,
        significantMovements: whales.filter(w => w.significance === 'high' || w.significance === 'extreme').length,
        netFlow: whales.reduce((sum, w) => sum + (w.type === 'withdrawal' ? -w.amount : w.amount), 0),
        priceImpactRisk: Math.max(...whales.map(w => w.priceImpactEstimate), 0)
      },
      arbitrageOpportunities: {
        count: arbitrage.filter(a => a.symbol === symbol).length,
        maxProfit: Math.max(...arbitrage.filter(a => a.symbol === symbol).map(a => a.estimatedProfit), 0),
        avgGap: arbitrage.filter(a => a.symbol === symbol).reduce((sum, a) => sum + a.percentageGap, 0) / Math.max(arbitrage.filter(a => a.symbol === symbol).length, 1)
      },
      optionsSignals: {
        bias: options.expirationBias,
        strength: options.significance,
        unusualActivity: options.unusualActivity,
        maxPain: options.maxPainLevel
      }
    };
  }

  private async getMultiExchangeOrderBooks(symbol: string): Promise<any[]> {
    // Simplified implementation - would integrate with real exchange APIs
    return [
      { exchange: 'binance', bids: [], asks: [] },
      { exchange: 'coinbase', bids: [], asks: [] }
    ];
  }

  private async getRecentLargeTrades(symbol: string): Promise<any[]> {
    // Simplified implementation - would get real trade data
    const mockTrades = [];
    for (let i = 0; i < 10; i++) {
      mockTrades.push({
        size: Math.random() * 500000 + 10000,
        side: Math.random() > 0.5 ? 'buy' : 'sell',
        price: 114569 + (Math.random() - 0.5) * 1000,
        timestamp: Date.now() - (i * 60000)
      });
    }
    return mockTrades;
  }

  private calculateInstitutionalFlow(largeOrders: any[]): number {
    if (largeOrders.length === 0) return 0;
    
    const buyVolume = largeOrders.filter(o => o.side === 'buy').reduce((sum, o) => sum + o.size, 0);
    const sellVolume = largeOrders.filter(o => o.side === 'sell').reduce((sum, o) => sum + o.size, 0);
    const totalVolume = buyVolume + sellVolume;
    
    return totalVolume > 0 ? (buyVolume - sellVolume) / totalVolume : 0;
  }

  private calculateRetailFlow(trades: any[]): number {
    const smallTrades = trades.filter(t => t.size < 10000);
    if (smallTrades.length === 0) return 0;
    
    const buyVolume = smallTrades.filter(t => t.side === 'buy').reduce((sum, t) => sum + t.size, 0);
    const sellVolume = smallTrades.filter(t => t.side === 'sell').reduce((sum, t) => sum + t.size, 0);
    const totalVolume = buyVolume + sellVolume;
    
    return totalVolume > 0 ? (buyVolume - sellVolume) / totalVolume : 0;
  }

  private calculateSmartMoneyIndicator(orderBooks: any[], trades: any[]): number {
    // Simplified smart money calculation based on order flow imbalances
    const largeBuyOrders = trades.filter(t => t.side === 'buy' && t.size > 50000).length;
    const largeSellOrders = trades.filter(t => t.side === 'sell' && t.size > 50000).length;
    const totalLargeOrders = largeBuyOrders + largeSellOrders;
    
    return totalLargeOrders > 0 ? (largeBuyOrders - largeSellOrders) / totalLargeOrders : 0;
  }

  private detectLiquidityShocks(orderBooks: any[], trades: any[]): any[] {
    // Simplified liquidity shock detection
    const shocks = [];
    const largeMarketOrders = trades.filter(t => t.size > 100000);
    
    for (const order of largeMarketOrders) {
      shocks.push({
        price: order.price,
        impact: order.size / 1000000, // Normalized impact
        direction: order.side === 'buy' ? 'up' : 'down'
      });
    }
    
    return shocks;
  }

  private async getOnChainMovements(symbol: string): Promise<any[]> {
    // Simplified - would integrate with blockchain APIs
    return [
      {
        address: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
        amount: 2000000,
        type: 'transfer',
        timestamp: Date.now()
      }
    ];
  }

  private async getExchangeMovements(symbol: string): Promise<any[]> {
    // Simplified - would integrate with exchange APIs
    return [
      {
        address: 'binance_cold_wallet',
        amount: 5000000,
        type: 'deposit',
        exchange: 'binance',
        timestamp: Date.now()
      }
    ];
  }

  private assessMovementSignificance(amount: number, type: string): 'low' | 'medium' | 'high' | 'extreme' {
    if (amount > 50000000) return 'extreme';  // $50M+
    if (amount > 10000000) return 'high';     // $10M+
    if (amount > 5000000) return 'medium';    // $5M+
    return 'low';
  }

  private estimatePriceImpact(amount: number, symbol: string): number {
    // Simplified price impact calculation
    const marketCap = 1000000000000; // $1T for BTC
    return Math.min(0.05, amount / marketCap * 1000); // Max 5% impact
  }

  private async getCrossExchangePrices(symbol: string): Promise<{ [exchange: string]: number }> {
    // Simplified - would get real prices from multiple exchanges
    const basePrice = 114569;
    return {
      'binance': basePrice + (Math.random() - 0.5) * 100,
      'coinbase': basePrice + (Math.random() - 0.5) * 100,
      'kraken': basePrice + (Math.random() - 0.5) * 100,
      'bitfinex': basePrice + (Math.random() - 0.5) * 100
    };
  }

  private async getOptionsData(symbol: string): Promise<any[]> {
    // Simplified options data
    return [
      { type: 'call', strike: 120000, volume: 100, expiry: '2025-01-31' },
      { type: 'put', strike: 110000, volume: 80, expiry: '2025-01-31' },
      { type: 'call', strike: 125000, volume: 150, expiry: '2025-01-31' },
      { type: 'put', strike: 105000, volume: 120, expiry: '2025-01-31' }
    ];
  }

  private calculateMaxPain(optionsData: any[]): number {
    // Simplified max pain calculation
    const strikes = [...new Set(optionsData.map(o => o.strike))];
    let maxPain = 0;
    let minPain = Infinity;

    for (const strike of strikes) {
      let pain = 0;
      for (const option of optionsData) {
        if (option.type === 'call' && strike > option.strike) {
          pain += option.volume * (strike - option.strike);
        } else if (option.type === 'put' && strike < option.strike) {
          pain += option.volume * (option.strike - strike);
        }
      }
      
      if (pain < minPain) {
        minPain = pain;
        maxPain = strike;
      }
    }

    return maxPain;
  }
}

export default MarketIntelligenceService;