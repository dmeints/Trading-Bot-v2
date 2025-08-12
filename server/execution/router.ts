/**
 * Execution Router
 * Intelligent order routing with spread analysis and execution optimization
 */

export interface OrderRequest {
  symbol: string;
  side: 'buy' | 'sell';
  sizePct: number;
  type: 'market' | 'limit' | 'ioc' | 'fok';
  price?: number;
  timeInForce?: 'gtc' | 'ioc' | 'fok';
  reduceOnly?: boolean;
}

export interface MarketConditions {
  spread_bps: number;
  depth_usd: number;
  volatility_pct: number;
  liquidity_tier: 1 | 2 | 3;
  toxicity_score?: number; // 0-1 scale, higher = more toxic
}

export interface ExecutionPlan {
  primary: OrderRequest;
  fallbacks: OrderRequest[];
  reasoning: string;
  expectedCost_bps: number;
  confidence: number;
  uncertaintyAdjusted?: boolean;
  uncertaintyReasoning?: string;
}

// New interfaces and classes for Phase 3
export interface MarketData {
  bid: number;
  ask: number;
  bidSize: number;
  askSize: number;
  recentBidPrices?: number[]; // For volatility calculation
  recentAskPrices?: number[]; // For volatility calculation
}

export interface ExecutionContext {
  marketData: MarketData;
  orderSize: number; // in base currency units
  side: 'buy' | 'sell';
  urgency: 'low' | 'medium' | 'high';
}

export interface ExecutionDecision {
  orderType: 'market' | 'limit';
  executionStyle: 'maker' | 'IOC' | 'FOK' | 'adaptive';
  urgency: 'low' | 'medium' | 'high';
  reasoning: string;
  timeInForce: 'GTC' | 'IOC' | 'FOK';
  postOnly: boolean;
  confidence: number;
  marketConditions: {
    spread: number;
    volatility: number;
    liquidity: string;
  };
}

/**
 * Determine optimal execution strategy based on market conditions and uncertainty
 */
export function routeOrder(
  request: OrderRequest,
  conditions: MarketConditions,
  uncertaintyScore: number = 0
): ExecutionPlan {

  const { symbol, side, sizePct } = request;
  const { spread_bps, depth_usd, volatility_pct, liquidity_tier, toxicity_score = 0 } = conditions;

  // Calculate trade size in USD (approximate)
  const estimatedPrice = 50000; // Placeholder - should come from market data
  const tradeSize_usd = sizePct * estimatedPrice * 0.01; // Assuming 1% = $500 for $50k position

  // Decision logic based on market microstructure
  let primary: OrderRequest;
  const fallbacks: OrderRequest[] = [];
  let reasoning = '';
  let expectedCost_bps = 0;
  let confidence = 0.8;

  // Strategy 1: Small size + tight spread = Market order
  if (tradeSize_usd < 1000 && spread_bps <= 5 && toxicity_score < 0.3) {
    primary = { ...request, type: 'market' };
    reasoning = 'Small size with tight spread favors immediate market execution';
    expectedCost_bps = spread_bps / 2 + 1; // Half spread + impact
    confidence = 0.9;

    // Fallback: IOC limit at mid
    fallbacks.push({ ...request, type: 'ioc', timeInForce: 'ioc' });
  }

  // Strategy 2: Large size + wide spread = Limit maker
  else if (tradeSize_usd > 5000 || spread_bps > 10) {
    const limitPrice = estimatedPrice * (side === 'buy' ? 0.999 : 1.001); // Inside spread
    primary = {
      ...request,
      type: 'limit',
      price: limitPrice,
      timeInForce: 'gtc'
    };
    reasoning = 'Large size or wide spread benefits from limit order to capture rebates';
    expectedCost_bps = -(spread_bps * 0.25); // Negative = rebate
    confidence = 0.7;

    // Fallback: IOC if not filled quickly
    fallbacks.push({ ...request, type: 'ioc', timeInForce: 'ioc' });
    fallbacks.push({ ...request, type: 'market' }); // Final fallback
  }

  // Strategy 3: Medium size + normal conditions = IOC
  else {
    primary = { ...request, type: 'ioc', timeInForce: 'ioc' };
    reasoning = 'Medium size with normal conditions uses IOC for balance of speed and cost';
    expectedCost_bps = spread_bps * 0.3 + 2; // Partial spread crossing
    confidence = 0.8;

    // Fallback: Market if IOC doesn't fill
    fallbacks.push({ ...request, type: 'market' });
  }

  // Uncertainty-based execution adjustments
  let uncertaintyAdjusted = false;
  let uncertaintyReasoning = '';
  
  if (uncertaintyScore > 0.3) {
    uncertaintyAdjusted = true;
    
    // High uncertainty - prefer more conservative execution
    if (primary.type === 'market') {
      primary = { ...primary, type: 'ioc', timeInForce: 'ioc' };
      uncertaintyReasoning = 'High prediction uncertainty - switching to IOC from market order';
      expectedCost_bps += 2;
    } else if (primary.type === 'limit') {
      // Make limit orders more passive
      uncertaintyReasoning = 'High prediction uncertainty - using more passive limit strategy';
      expectedCost_bps -= 1; // More passive = better price
    }
    
    confidence -= uncertaintyScore * 0.3;
    reasoning += `. Uncertainty (${uncertaintyScore.toFixed(3)}) adjusted execution strategy`;
  }

  // Adjust for market conditions
  if (volatility_pct > 2.0) {
    // High volatility - prefer faster execution
    if (primary.type === 'limit') {
      primary = { ...primary, type: 'ioc', timeInForce: 'ioc' };
      reasoning += '. High volatility overrides limit strategy';
      expectedCost_bps += 3;
    }
    confidence -= 0.1;
  }

  if (toxicity_score > 0.5) {
    // High toxicity - avoid market impact
    reasoning += '. High toxicity detected - using conservative approach';
    expectedCost_bps += toxicity_score * 5;
    confidence -= 0.2;
  }

  if (liquidity_tier === 3) {
    // Low liquidity - be more conservative
    reasoning += '. Low liquidity tier - reducing aggression';
    expectedCost_bps += 5;
    confidence -= 0.1;
  }

  return {
    primary,
    fallbacks,
    reasoning,
    expectedCost_bps: Math.round(expectedCost_bps * 100) / 100,
    confidence: Math.max(0.1, Math.min(1.0, confidence)),
    uncertaintyAdjusted,
    uncertaintyReasoning
  };
}

/**
 * Analyze spread toxicity to detect adverse selection
 */
export function analyzeSpreadToxicity(
  recentSpreads: number[],
  recentVolumes: number[],
  timeWindow_ms: number = 60000
): number {
  if (recentSpreads.length < 5) return 0;

  // Calculate spread volatility
  const avgSpread = recentSpreads.reduce((sum, s) => sum + s, 0) / recentSpreads.length;
  const spreadVariance = recentSpreads.reduce((sum, s) => sum + Math.pow(s - avgSpread, 2), 0) / recentSpreads.length;
  const spreadVolatility = Math.sqrt(spreadVariance);

  // Calculate volume concentration
  const totalVolume = recentVolumes.reduce((sum, v) => sum + v, 0);
  const maxVolume = Math.max(...recentVolumes);
  const volumeConcentration = totalVolume > 0 ? maxVolume / totalVolume : 0;

  // Toxicity indicators
  const volatilityToxicity = Math.min(1, spreadVolatility / avgSpread); // Higher spread volatility = more toxic
  const concentrationToxicity = Math.min(1, volumeConcentration * 2); // Higher concentration = more toxic

  // Combined toxicity score (0-1)
  const toxicity = (volatilityToxicity * 0.6 + concentrationToxicity * 0.4);

  return Math.round(toxicity * 1000) / 1000;
}

/**
 * Execution Router
 * Intelligent order routing with decision making based on market conditions and urgency.
 */
export class ExecutionRouter {
  decideExecution(context: ExecutionContext): ExecutionDecision {
    const { marketData, orderSize, side, urgency } = context;

    // Calculate market conditions
    const spread = marketData.ask - marketData.bid;
    const midPrice = (marketData.ask + marketData.bid) / 2;
    const spreadBps = (spread / midPrice) * 10000;

    // Determine volatility from recent price movement
    const volatility = this.calculateVolatility(marketData);

    // Liquidity assessment
    const liquidity = this.assessLiquidity(marketData);

    // Decision logic
    let executionStyle: 'maker' | 'IOC' | 'FOK' | 'adaptive';
    let orderType: 'market' | 'limit';
    let timeInForce: 'GTC' | 'IOC' | 'FOK';
    let reasoning: string;
    let confidence: number;

    if (urgency === 'high' || spreadBps < 5) {
      // High urgency or tight spread - immediate execution
      executionStyle = 'IOC';
      orderType = 'market';
      timeInForce = 'IOC';
      reasoning = `High urgency (${urgency}) or tight spread (${spreadBps.toFixed(1)} bps) - immediate execution preferred`;
      confidence = 0.85;
    } else if (liquidity === 'poor' || orderSize > marketData.bidSize * 0.5) {
      // Poor liquidity or large order - fill or kill
      executionStyle = 'FOK';
      orderType = 'limit';
      timeInForce = 'FOK';
      reasoning = `Large order relative to book depth or poor liquidity - all-or-nothing execution`;
      confidence = 0.70;
    } else if (volatility < 0.02 && spreadBps > 10) {
      // Low volatility, wide spread - patient maker
      executionStyle = 'maker';
      orderType = 'limit';
      timeInForce = 'GTC';
      reasoning = `Low volatility (${(volatility * 100).toFixed(1)}%) and wide spread - patient liquidity provision`;
      confidence = 0.90;
    } else {
      // Adaptive execution based on conditions
      executionStyle = 'adaptive';
      orderType = 'limit';
      timeInForce = 'IOC';
      reasoning = `Balanced market conditions - adaptive execution with ${spreadBps.toFixed(1)} bps spread`;
      confidence = 0.75;
    }

    return {
      orderType,
      executionStyle,
      urgency,
      reasoning,
      timeInForce,
      postOnly: executionStyle === 'maker',
      confidence,
      marketConditions: {
        spread: spreadBps,
        volatility,
        liquidity
      }
    };
  }

  private calculateVolatility(marketData: any): number {
    // Simple volatility estimate from bid-ask spread
    const midPrice = (marketData.ask + marketData.bid) / 2;
    const spread = marketData.ask - marketData.bid;
    return spread / midPrice;
  }

  private assessLiquidity(marketData: any): string {
    const totalSize = marketData.bidSize + marketData.askSize;
    if (totalSize > 100) return 'good';
    if (totalSize > 50) return 'moderate';
    return 'poor';
  }
}