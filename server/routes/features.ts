/**
 * Real Features API - Provides ALL external data sources to Stevie's algorithm
 * Replaces mock data with actual market intelligence from 8 configured sources
 */

import express from 'express';
import { stevieDataIntegration } from '../services/stevieDataIntegration';
import { requireProvenance } from '../middleware/provenanceGuard';
import { logger } from '../utils/logger';

const router = express.Router();

// Apply provenance guard to prevent mock data
router.use(requireProvenance);

router.get('/live/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const validSymbols = ['BTC', 'ETH', 'SOL', 'ADA', 'DOT'];
    
    if (!validSymbols.includes(symbol)) {
      return res.status(400).json({ error: 'Invalid symbol' });
    }

    logger.info(`[Features API] Fetching comprehensive features for ${symbol}`);
    
    // Get real market data from ALL configured sources
    const comprehensiveData = await stevieDataIntegration.getComprehensiveMarketState(symbol);
    
    // Transform to Features format expected by Stevie algorithm
    const bars = comprehensiveData.priceHistory24h.map((price, i) => ({
      ts: Date.now() - (comprehensiveData.priceHistory24h.length - i) * 60000,
      o: price * 0.9995, // Rough OHLC estimation
      h: price * 1.001,
      l: price * 0.999,
      c: price,
      v: comprehensiveData.volumeHistory24h[i] || 0
    }));

    // Calculate spread from order book
    const spreadBps = comprehensiveData.orderBook.bidAskSpread 
      ? (comprehensiveData.orderBook.bidAskSpread / comprehensiveData.currentPrice) * 10000
      : 8; // fallback

    // Calculate volatility percentile
    const volPct = calculateVolatilityPercentile(comprehensiveData.priceHistory24h);
    
    // Calculate trade run length from price momentum
    const tradeRunLen = calculateTradeRunLength(comprehensiveData.priceHistory24h);

    const features = {
      bars,
      micro: {
        spread_bps: spreadBps,
        imbalance_1: comprehensiveData.orderBook.orderImbalance,
        micro_vol_ewma: calculateMicroVolEWMA(comprehensiveData.volumeHistory24h),
        trade_run_len: tradeRunLen
      },
      costs: {
        expected_slippage_bps: (sizePct: number) => {
          // Dynamic slippage based on liquidity depth
          const baseSlippage = 4;
          const liquidityFactor = comprehensiveData.orderBook.liquidityDepth > 1000 ? 0.8 : 1.5;
          return baseSlippage + (sizePct * liquidityFactor);
        }
      },
      social: {
        z: comprehensiveData.sentiment.overall * 2, // Convert to z-score
        delta: comprehensiveData.sentiment.overall,
        spike: Math.abs(comprehensiveData.sentiment.overall) > 0.7
      },
      onchain: {
        gas_spike_flag: comprehensiveData.onChain.gasPrice ? comprehensiveData.onChain.gasPrice > 50 : false,
        bias: calculateOnChainBias(comprehensiveData.onChain)
      },
      macro: {
        blackout: comprehensiveData.macroEvents.some(e => e.impact === 'high' && 
                   Math.abs(new Date(e.date).getTime() - Date.now()) < 3600000) // Within 1 hour
      },
      regime: {
        vol_pct: volPct,
        trend_strength: calculateTrendStrength(comprehensiveData.priceHistory24h),
        liquidity_tier: determineLiquidityTier(symbol, comprehensiveData.orderBook.liquidityDepth) as 1|2|3
      },
      provenance: {
        datasetId: `${symbol}-live`,
        commit: process.env.REPLIT_SHA || 'dev',
        generatedAt: new Date().toISOString()
      }
    };

    logger.info(`[Features API] Generated features for ${symbol}`, {
      volPct: features.regime.vol_pct,
      sentiment: features.social.delta,
      spreadBps: features.micro.spread_bps,
      onChainBias: features.onchain.bias
    });

    res.json(features);

  } catch (error) {
    logger.error('[Features API] Error generating features', { error, symbol: req.params.symbol });
    res.status(500).json({ 
      error: 'Failed to generate features',
      provenance: {
        commit: process.env.REPLIT_SHA || 'dev',
        generatedAt: new Date().toISOString()
      }
    });
  }
});

// Helper functions for feature engineering
function calculateVolatilityPercentile(prices: number[]): number {
  if (prices.length < 2) return 50;
  
  const returns = prices.slice(1).map((price, i) => 
    Math.log(price / prices[i]) * 100
  );
  
  const variance = returns.reduce((sum, ret) => {
    const mean = returns.reduce((a, b) => a + b) / returns.length;
    return sum + Math.pow(ret - mean, 2);
  }, 0) / returns.length;
  
  const volatility = Math.sqrt(variance);
  
  // Convert to percentile (higher vol = higher percentile)
  return Math.min(95, Math.max(5, volatility * 10 + 50));
}

function calculateMicroVolEWMA(volumes: number[]): number {
  if (!volumes.length) return 0;
  
  const alpha = 0.1;
  let ewma = volumes[0];
  
  for (let i = 1; i < volumes.length; i++) {
    ewma = alpha * volumes[i] + (1 - alpha) * ewma;
  }
  
  return ewma;
}

function calculateTradeRunLength(prices: number[]): number {
  if (prices.length < 3) return 0;
  
  let runLength = 1;
  const lastDirection = prices[prices.length - 1] > prices[prices.length - 2] ? 1 : -1;
  
  for (let i = prices.length - 2; i > 0; i--) {
    const direction = prices[i] > prices[i - 1] ? 1 : -1;
    if (direction === lastDirection) {
      runLength++;
    } else {
      break;
    }
  }
  
  return runLength * lastDirection; // Positive for up runs, negative for down runs
}

function calculateOnChainBias(onChain: any): number {
  if (!onChain.whaleActivity || !onChain.transactionCount) return 0;
  
  // Bias based on whale activity vs normal activity
  const whaleRatio = onChain.whaleActivity / Math.max(1, onChain.transactionCount);
  const networkUtil = onChain.networkUtilization || 0;
  
  // Combine whale activity and network utilization
  let bias = (whaleRatio - 0.02) * 2; // Baseline whale ratio ~2%
  bias += (networkUtil - 0.5) * 0.5; // Network utilization effect
  
  return Math.max(-1, Math.min(1, bias));
}

function calculateTrendStrength(prices: number[]): number {
  if (prices.length < 10) return 0;
  
  const recent = prices.slice(-10);
  const slope = calculateLinearSlope(recent);
  const correlation = calculatePriceCorrelation(recent);
  
  return Math.abs(slope) * correlation;
}

function calculateLinearSlope(prices: number[]): number {
  const n = prices.length;
  const sumX = (n * (n - 1)) / 2;
  const sumY = prices.reduce((a, b) => a + b);
  const sumXY = prices.reduce((sum, price, i) => sum + i * price, 0);
  const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;
  
  return (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
}

function calculatePriceCorrelation(prices: number[]): number {
  const n = prices.length;
  const indices = Array.from({ length: n }, (_, i) => i);
  
  const meanX = (n - 1) / 2;
  const meanY = prices.reduce((a, b) => a + b) / n;
  
  let num = 0, denX = 0, denY = 0;
  
  for (let i = 0; i < n; i++) {
    const devX = indices[i] - meanX;
    const devY = prices[i] - meanY;
    num += devX * devY;
    denX += devX * devX;
    denY += devY * devY;
  }
  
  return denX && denY ? num / Math.sqrt(denX * denY) : 0;
}

function determineLiquidityTier(symbol: string, liquidityDepth: number): number {
  const tierThresholds = {
    'BTC': { tier1: 5000, tier2: 1000 },
    'ETH': { tier1: 3000, tier2: 800 },
    'SOL': { tier1: 2000, tier2: 500 },
    'ADA': { tier1: 1000, tier2: 300 },
    'DOT': { tier1: 1000, tier2: 300 }
  };
  
  const thresholds = tierThresholds[symbol as keyof typeof tierThresholds] || tierThresholds.DOT;
  
  if (liquidityDepth >= thresholds.tier1) return 1;
  if (liquidityDepth >= thresholds.tier2) return 2;
  return 3;
}

export default router;