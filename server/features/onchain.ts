/**
 * On-chain Feature Builder
 * Analyzes gas spikes and blockchain activity bias
 */

import { db } from "../db";
import { onchainTicksExtended } from "@shared/schema";
import { desc, eq, gte, lte, and, inArray } from "drizzle-orm";

export interface OnchainFeatures {
  gas_spike_flag?: boolean;
  bias?: number;  // Activity bias: positive = bullish activity, negative = bearish
}

export async function calculateOnchain(
  symbol: string,
  fromTs: Date,
  toTs: Date
): Promise<OnchainFeatures | null> {
  try {
    // Determine chain based on symbol
    const chain = symbol.includes('ETH') ? 'ethereum' : 'bitcoin';
    
    // Get recent on-chain data
    const onchainData = await db
      .select()
      .from(onchainTicksExtended)
      .where(
        and(
          eq(onchainTicksExtended.chain, chain),
          gte(onchainTicksExtended.timestamp, fromTs),
          lte(onchainTicksExtended.timestamp, toTs),
          inArray(onchainTicksExtended.metric, ['gas_price', 'whale_transfers', 'active_addresses', 'hash_rate'])
        )
      )
      .orderBy(desc(onchainTicksExtended.timestamp))
      .limit(500);

    if (onchainData.length === 0) {
      return null;
    }

    // Group metrics by type
    const metrics: Record<string, number[]> = {};
    onchainData.forEach(tick => {
      if (!metrics[tick.metric]) {
        metrics[tick.metric] = [];
      }
      metrics[tick.metric].push(parseFloat(tick.value.toString()));
    });

    let gas_spike_flag = false;
    let bias = 0;

    // Gas spike detection (Ethereum only)
    if (chain === 'ethereum' && metrics.gas_price && metrics.gas_price.length > 0) {
      const gasValues = metrics.gas_price;
      const recent = gasValues.slice(0, Math.max(1, Math.floor(gasValues.length * 0.1)));
      const historical = gasValues.slice(Math.floor(gasValues.length * 0.1));
      
      if (historical.length > 0) {
        const historicalMean = historical.reduce((sum, val) => sum + val, 0) / historical.length;
        const historicalStd = Math.sqrt(
          historical.reduce((sum, val) => sum + Math.pow(val - historicalMean, 2), 0) / historical.length
        );
        
        const recentMean = recent.reduce((sum, val) => sum + val, 0) / recent.length;
        const gasZScore = historicalStd > 0 ? (recentMean - historicalMean) / historicalStd : 0;
        
        gas_spike_flag = gasZScore > 2.0; // Gas price is 2+ std devs above normal
      }
    }

    // Calculate activity bias
    let biasComponents: number[] = [];

    // Whale transfers bias (more transfers = more activity)
    if (metrics.whale_transfers && metrics.whale_transfers.length > 0) {
      const whaleValues = metrics.whale_transfers;
      const recent = whaleValues.slice(0, Math.max(1, Math.floor(whaleValues.length * 0.2)));
      const historical = whaleValues.slice(Math.floor(whaleValues.length * 0.2));
      
      if (historical.length > 0) {
        const recentMean = recent.reduce((sum, val) => sum + val, 0) / recent.length;
        const historicalMean = historical.reduce((sum, val) => sum + val, 0) / historical.length;
        const whaleChange = (recentMean - historicalMean) / Math.max(1, historicalMean);
        biasComponents.push(Math.tanh(whaleChange * 2)); // Normalize to [-1, 1]
      }
    }

    // Active addresses bias (more addresses = more adoption/activity)
    if (metrics.active_addresses && metrics.active_addresses.length > 0) {
      const addressValues = metrics.active_addresses;
      const recent = addressValues.slice(0, Math.max(1, Math.floor(addressValues.length * 0.2)));
      const historical = addressValues.slice(Math.floor(addressValues.length * 0.2));
      
      if (historical.length > 0) {
        const recentMean = recent.reduce((sum, val) => sum + val, 0) / recent.length;
        const historicalMean = historical.reduce((sum, val) => sum + val, 0) / historical.length;
        const addressChange = (recentMean - historicalMean) / Math.max(1, historicalMean);
        biasComponents.push(Math.tanh(addressChange * 1.5)); // Normalize to [-1, 1]
      }
    }

    // Hash rate bias (for Bitcoin - network security indicator)
    if (metrics.hash_rate && metrics.hash_rate.length > 0) {
      const hashValues = metrics.hash_rate;
      const recent = hashValues.slice(0, Math.max(1, Math.floor(hashValues.length * 0.1)));
      const historical = hashValues.slice(Math.floor(hashValues.length * 0.1));
      
      if (historical.length > 0) {
        const recentMean = recent.reduce((sum, val) => sum + val, 0) / recent.length;
        const historicalMean = historical.reduce((sum, val) => sum + val, 0) / historical.length;
        const hashChange = (recentMean - historicalMean) / Math.max(1, historicalMean);
        biasComponents.push(Math.tanh(hashChange)); // Normalize to [-1, 1]
      }
    }

    // Aggregate bias components
    if (biasComponents.length > 0) {
      bias = biasComponents.reduce((sum, component) => sum + component, 0) / biasComponents.length;
      bias = Math.round(bias * 1000) / 1000; // Round to 3 decimal places
    }

    return {
      gas_spike_flag,
      bias: bias !== 0 ? bias : undefined
    };

  } catch (error) {
    console.error('On-chain calculation error:', error);
    return null;
  }
}