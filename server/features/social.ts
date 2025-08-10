/**
 * Social Sentiment Feature Builder
 * Aggregates sentiment from Twitter, Reddit, and CryptoPanic
 */

import { db } from "../db";
import { sentimentTicksExtended } from "@shared/schema";
import { desc, eq, gte, lte, and, inArray } from "drizzle-orm";

export interface SocialFeatures {
  z: number;          // Z-score of current sentiment
  delta: number;      // Change in sentiment
  spike?: boolean;    // Sudden sentiment spike detected
}

export async function calculateSocial(
  symbol: string,
  fromTs: Date,
  toTs: Date
): Promise<SocialFeatures | null> {
  try {
    // Get recent sentiment data from all sources
    const sentimentData = await db
      .select()
      .from(sentimentTicksExtended)
      .where(
        and(
          eq(sentimentTicksExtended.symbol, symbol),
          gte(sentimentTicksExtended.timestamp, fromTs),
          lte(sentimentTicksExtended.timestamp, toTs),
          inArray(sentimentTicksExtended.source, ['twitter', 'reddit', 'cryptopanic'])
        )
      )
      .orderBy(desc(sentimentTicksExtended.timestamp))
      .limit(200);

    if (sentimentData.length === 0) {
      return null;
    }

    // Group by source and calculate weighted scores
    const sourceScores: Record<string, number[]> = {
      twitter: [],
      reddit: [],
      cryptopanic: []
    };

    sentimentData.forEach(tick => {
      if (sourceScores[tick.source]) {
        // Weight by volume if available
        const volume = tick.volume || 1;
        const weightedScore = tick.score * Math.log(1 + volume);
        sourceScores[tick.source].push(weightedScore);
      }
    });

    // Calculate composite sentiment score
    const allScores: number[] = [];
    Object.values(sourceScores).forEach(scores => {
      allScores.push(...scores);
    });

    if (allScores.length === 0) {
      return null;
    }

    // Current sentiment (most recent 10% of data)
    const recentCount = Math.max(1, Math.floor(allScores.length * 0.1));
    const recentScores = allScores.slice(0, recentCount);
    const currentSentiment = recentScores.reduce((sum, score) => sum + score, 0) / recentScores.length;

    // Historical baseline (remaining 90% of data)
    const historicalScores = allScores.slice(recentCount);
    const historicalMean = historicalScores.reduce((sum, score) => sum + score, 0) / historicalScores.length;
    const historicalStd = Math.sqrt(
      historicalScores.reduce((sum, score) => sum + Math.pow(score - historicalMean, 2), 0) / historicalScores.length
    );

    // Calculate z-score
    const z = historicalStd > 0 ? (currentSentiment - historicalMean) / historicalStd : 0;

    // Calculate delta (change over time)
    const midPoint = Math.floor(allScores.length / 2);
    const earlierScores = allScores.slice(midPoint);
    const earlierMean = earlierScores.reduce((sum, score) => sum + score, 0) / earlierScores.length;
    const delta = currentSentiment - earlierMean;

    // Detect spikes (sudden high z-score with high volume)
    const recentVolume = sentimentData.slice(0, recentCount)
      .reduce((sum, tick) => sum + (tick.volume || 1), 0);
    const historicalVolumeAvg = sentimentData.slice(recentCount)
      .reduce((sum, tick) => sum + (tick.volume || 1), 0) / (sentimentData.length - recentCount);
    
    const volumeRatio = recentVolume / Math.max(1, historicalVolumeAvg);
    const spike = Math.abs(z) > 2.0 && volumeRatio > 1.5;

    return {
      z: Math.round(z * 1000) / 1000,
      delta: Math.round(delta * 1000) / 1000,
      spike
    };

  } catch (error) {
    console.error('Social sentiment calculation error:', error);
    return null;
  }
}