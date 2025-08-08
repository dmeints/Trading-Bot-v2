/**
 * SMART ORDER ROUTER (SOR)
 * Simulates venue selection across Binance/Coinbase using LOB simulator outputs
 */

interface VenueQuote {
  venue: 'binance' | 'coinbase';
  side: 'buy' | 'sell';
  expectedFillPrice: number;
  latencyMs: number;
  fees: number;
  availableSize: number;
  slippage: number;
  fillProbability: number;
}

interface SORDecision {
  selectedVenue: string;
  expectedPrice: number;
  expectedLatency: number;
  expectedFees: number;
  counterfactuals: VenueQuote[];
  reasoning: string;
}

interface LOBState {
  symbol: string;
  timestamp: number;
  binance: {
    bid: number;
    ask: number;
    bidSize: number;
    askSize: number;
    latencyMs: number;
    makerFee: number;
    takerFee: number;
  };
  coinbase: {
    bid: number;
    ask: number;
    bidSize: number;
    askSize: number;
    latencyMs: number;
    makerFee: number;
    takerFee: number;
  };
}

export class SmartOrderRouter {
  private venueHistory: Map<string, VenueQuote[]> = new Map();
  private performanceTracker = new Map<string, { fills: number; totalValue: number; avgSlippage: number }>();

  constructor(private config: {
    slippageThreshold: number;
    latencyWeight: number;
    feeWeight: number;
    sizeWeight: number;
  } = {
    slippageThreshold: 0.001, // 0.1%
    latencyWeight: 0.3,
    feeWeight: 0.4,
    sizeWeight: 0.3
  }) {}

  /**
   * Select optimal venue based on LOB state and order requirements
   */
  async selectVenue(
    symbol: string,
    side: 'buy' | 'sell',
    size: number,
    lobState: LOBState
  ): Promise<SORDecision> {
    // Generate quotes from both venues
    const binanceQuote = this.generateVenueQuote('binance', side, size, lobState);
    const coinbaseQuote = this.generateVenueQuote('coinbase', side, size, lobState);
    
    // Calculate venue scores
    const binanceScore = this.calculateVenueScore(binanceQuote);
    const coinbaseScore = this.calculateVenueScore(coinbaseQuote);
    
    // Select best venue
    const selectedVenue = binanceScore >= coinbaseScore ? 'binance' : 'coinbase';
    const selectedQuote = selectedVenue === 'binance' ? binanceQuote : coinbaseQuote;
    const counterfactuals = [binanceQuote, coinbaseQuote];
    
    // Log decision for tracking
    this.logVenueDecision(symbol, selectedQuote, counterfactuals);
    
    return {
      selectedVenue,
      expectedPrice: selectedQuote.expectedFillPrice,
      expectedLatency: selectedQuote.latencyMs,
      expectedFees: selectedQuote.fees,
      counterfactuals,
      reasoning: this.generateReasoning(selectedQuote, counterfactuals, binanceScore, coinbaseScore)
    };
  }

  private generateVenueQuote(
    venue: 'binance' | 'coinbase',
    side: 'buy' | 'sell',
    size: number,
    lobState: LOBState
  ): VenueQuote {
    const venueData = venue === 'binance' ? lobState.binance : lobState.coinbase;
    
    // Calculate expected fill price with size-dependent slippage
    const basePrice = side === 'buy' ? venueData.ask : venueData.bid;
    const availableSize = side === 'buy' ? venueData.askSize : venueData.bidSize;
    
    // Size impact model: slippage increases with size/depth ratio
    const sizeRatio = Math.min(size / availableSize, 1.0);
    const slippage = this.calculateSlippage(sizeRatio, venue);
    
    const expectedFillPrice = side === 'buy' 
      ? basePrice * (1 + slippage)
      : basePrice * (1 - slippage);
    
    // Calculate fees
    const fees = size * expectedFillPrice * venueData.takerFee;
    
    // Fill probability based on size and market conditions
    const fillProbability = Math.max(0.7, 1 - (sizeRatio * 0.3));
    
    return {
      venue,
      side,
      expectedFillPrice,
      latencyMs: venueData.latencyMs + this.getNetworkJitter(),
      fees,
      availableSize,
      slippage,
      fillProbability
    };
  }

  private calculateSlippage(sizeRatio: number, venue: 'binance' | 'coinbase'): number {
    // Venue-specific slippage models
    const baseSlippage = venue === 'binance' ? 0.0001 : 0.00015; // Binance typically tighter
    return baseSlippage * (1 + Math.pow(sizeRatio, 2) * 5);
  }

  private calculateVenueScore(quote: VenueQuote): number {
    // Multi-factor scoring: lower is better for slippage/fees/latency
    const slippagePenalty = quote.slippage * 1000; // Scale to comparable range
    const latencyPenalty = quote.latencyMs / 100;
    const feePenalty = quote.fees;
    const sizePenalty = Math.max(0, 1 - quote.fillProbability) * 10;
    
    return -(
      slippagePenalty * this.config.latencyWeight +
      latencyPenalty * this.config.latencyWeight +
      feePenalty * this.config.feeWeight +
      sizePenalty * this.config.sizeWeight
    );
  }

  private getNetworkJitter(): number {
    // Simulate network variability: 0-20ms additional latency
    return Math.random() * 20;
  }

  private logVenueDecision(symbol: string, selected: VenueQuote, counterfactuals: VenueQuote[]): void {
    const key = `${symbol}_${selected.venue}`;
    
    if (!this.venueHistory.has(key)) {
      this.venueHistory.set(key, []);
    }
    
    this.venueHistory.get(key)!.push(selected);
    
    // Update performance tracking
    this.updatePerformanceStats(selected);
    
    // Keep only last 1000 decisions per venue
    const history = this.venueHistory.get(key)!;
    if (history.length > 1000) {
      history.shift();
    }
  }

  private updatePerformanceStats(quote: VenueQuote): void {
    const key = quote.venue;
    const current = this.performanceTracker.get(key) || { fills: 0, totalValue: 0, avgSlippage: 0 };
    
    current.fills++;
    current.totalValue += quote.expectedFillPrice;
    current.avgSlippage = (current.avgSlippage * (current.fills - 1) + quote.slippage) / current.fills;
    
    this.performanceTracker.set(key, current);
  }

  private generateReasoning(
    selected: VenueQuote,
    counterfactuals: VenueQuote[],
    binanceScore: number,
    coinbaseScore: number
  ): string {
    const other = counterfactuals.find(q => q.venue !== selected.venue)!;
    const slippageDiff = ((other.slippage - selected.slippage) * 10000).toFixed(1);
    const latencyDiff = (other.latencyMs - selected.latencyMs).toFixed(1);
    
    return `Selected ${selected.venue}: ${slippageDiff}bp less slippage, ${latencyDiff}ms faster. Score: ${binanceScore.toFixed(3)} vs ${coinbaseScore.toFixed(3)}`;
  }

  /**
   * Get venue performance statistics
   */
  getVenueStats(): Record<string, any> {
    const stats: Record<string, any> = {};
    
    this.performanceTracker.forEach((data, venue) => {
      stats[venue] = {
        totalFills: data.fills,
        avgSlippage: data.avgSlippage,
        avgFillPrice: data.totalValue / data.fills,
        winRate: this.calculateVenueWinRate(venue)
      };
    });
    
    return stats;
  }

  private calculateVenueWinRate(venue: string): number {
    const history = this.venueHistory.get(`BTC_${venue}`) || [];
    if (history.length < 2) return 0;
    
    let wins = 0;
    for (let i = 1; i < history.length; i++) {
      const current = history[i];
      const previous = history[i - 1];
      
      // Win if current slippage is better than previous
      if (current.slippage < previous.slippage) wins++;
    }
    
    return wins / (history.length - 1);
  }

  /**
   * Simulate LOB state for testing
   */
  static generateMockLOBState(symbol: string): LOBState {
    const basePrice = symbol === 'BTC' ? 50000 : symbol === 'ETH' ? 3000 : 100;
    const spread = basePrice * 0.0001; // 1bp spread
    
    return {
      symbol,
      timestamp: Date.now(),
      binance: {
        bid: basePrice - spread/2,
        ask: basePrice + spread/2,
        bidSize: 10 + Math.random() * 20,
        askSize: 10 + Math.random() * 20,
        latencyMs: 15 + Math.random() * 10,
        makerFee: 0.001,
        takerFee: 0.001
      },
      coinbase: {
        bid: basePrice - spread/2 * 1.1, // Slightly wider spread
        ask: basePrice + spread/2 * 1.1,
        bidSize: 8 + Math.random() * 15,
        askSize: 8 + Math.random() * 15,
        latencyMs: 25 + Math.random() * 15,
        makerFee: 0.0005,
        takerFee: 0.0005
      }
    };
  }
}

export default SmartOrderRouter;