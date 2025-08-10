/**
 * Unified Features API
 * Aggregates all feature builders into a single API endpoint
 */

import { calculateMicrostructure, MicrostructureFeatures } from "./microstructure";
import { calculateCosts, CostFeatures } from "./costs";
import { calculateSocial, SocialFeatures } from "./social";
import { calculateOnchain, OnchainFeatures } from "./onchain";
import { calculateMacro, MacroFeatures } from "./macro";
import { calculateRegime, RegimeFeatures } from "./regime";
import { db } from "../db";
import { marketBars } from "@shared/schema";
import { desc, eq, gte, lte, and } from "drizzle-orm";

export interface UnifiedFeatures {
  bars: Array<{
    ts: number;
    o: number;
    h: number;
    l: number;
    c: number;
    v?: number;
  }>;
  micro: MicrostructureFeatures | null;
  costs: CostFeatures | null;
  social: SocialFeatures | null;
  onchain: OnchainFeatures | null;
  macro: MacroFeatures | null;
  regime: RegimeFeatures | null;
  provenance: {
    datasetId?: string;
    commit: string;
    generatedAt: string;
  };
}

export async function calculateUnifiedFeatures(
  symbol: string,
  fromTs: Date,
  toTs: Date,
  timeframe: string = '5m'
): Promise<UnifiedFeatures> {
  try {
    // Get market bars
    const barData = await db
      .select()
      .from(marketBars)
      .where(
        and(
          eq(marketBars.symbol, symbol),
          gte(marketBars.timestamp, fromTs),
          lte(marketBars.timestamp, toTs)
        )
      )
      .orderBy(desc(marketBars.timestamp))
      .limit(300);

    const bars = barData.map(bar => ({
      ts: bar.timestamp.getTime(),
      o: parseFloat(bar.open),
      h: parseFloat(bar.high),
      l: parseFloat(bar.low),
      c: parseFloat(bar.close),
      v: bar.volume ? parseFloat(bar.volume) : undefined
    }));

    // Calculate all features in parallel
    const [micro, costs, social, onchain, macro, regime] = await Promise.all([
      calculateMicrostructure(symbol, fromTs, toTs),
      calculateCosts(symbol, fromTs, toTs),
      calculateSocial(symbol, fromTs, toTs),
      calculateOnchain(symbol, fromTs, toTs),
      calculateMacro(fromTs, toTs),
      calculateRegime(symbol, fromTs, toTs)
    ]);

    // Generate dataset ID from data hash
    const dataHash = Buffer.from(
      JSON.stringify({
        symbol,
        fromTs: fromTs.toISOString(),
        toTs: toTs.toISOString(),
        barCount: bars.length
      })
    ).toString('base64').slice(0, 12);

    return {
      bars,
      micro,
      costs,
      social,
      onchain,
      macro,
      regime,
      provenance: {
        datasetId: `features_${dataHash}`,
        commit: process.env.GIT_COMMIT || 'development',
        generatedAt: new Date().toISOString()
      }
    };

  } catch (error) {
    console.error('Unified features calculation error:', error);
    
    return {
      bars: [],
      micro: null,
      costs: null,
      social: null,
      onchain: null,
      macro: null,
      regime: null,
      provenance: {
        datasetId: 'error',
        commit: process.env.GIT_COMMIT || 'development',
        generatedAt: new Date().toISOString()
      }
    };
  }
}