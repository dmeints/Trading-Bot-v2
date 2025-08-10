#!/usr/bin/env tsx

/**
 * Phase J - Feature Drift Detection
 * Computes PSI (Population Stability Index) for trading features
 * comparing last 7 days vs prior 30 days
 * Fails if PSI > 0.25 on ≥2 features unless DRIFT_ACK=1
 */

import { db } from "../server/db";
import { marketBars, sentimentTicks } from "../shared/schema";
import { desc, gte, and, lte } from "drizzle-orm";
import { logger } from "../server/utils/logger";

interface FeatureStats {
  name: string;
  psi: number;
  status: 'pass' | 'fail';
  recent_mean: number;
  historical_mean: number;
  bins: number;
}

interface DriftReport {
  timestamp: string;
  features: FeatureStats[];
  failed_features: number;
  overall_status: 'pass' | 'fail';
  drift_acknowledged: boolean;
}

/**
 * Calculate Population Stability Index (PSI)
 * PSI measures the shift in distribution between two datasets
 * PSI < 0.1: No significant change
 * 0.1 ≤ PSI < 0.25: Moderate change
 * PSI ≥ 0.25: Significant change requiring attention
 */
function calculatePSI(recentData: number[], historicalData: number[], bins: number = 10): number {
  if (recentData.length === 0 || historicalData.length === 0) return 0;

  const allData = [...recentData, ...historicalData];
  const min = Math.min(...allData);
  const max = Math.max(...allData);
  const binSize = (max - min) / bins;

  let psi = 0;

  for (let i = 0; i < bins; i++) {
    const binMin = min + i * binSize;
    const binMax = min + (i + 1) * binSize;

    const recentCount = recentData.filter(x => x >= binMin && x < binMax).length;
    const historicalCount = historicalData.filter(x => x >= binMin && x < binMax).length;

    const recentPct = (recentCount / recentData.length) || 0.001; // Avoid zero division
    const historicalPct = (historicalCount / historicalData.length) || 0.001;

    psi += (recentPct - historicalPct) * Math.log(recentPct / historicalPct);
  }

  return Math.abs(psi);
}

/**
 * Extract spread basis points from market data
 */
function extractSpreadBps(bars: any[]): number[] {
  return bars
    .filter(bar => bar.high && bar.low && bar.high > bar.low)
    .map(bar => ((bar.high - bar.low) / bar.low) * 10000); // Convert to basis points
}

/**
 * Extract depth basis points from market data
 */
function extractDepthBps(bars: any[]): number[] {
  return bars
    .filter(bar => bar.volume && bar.close)
    .map(bar => Math.log(bar.volume + 1) * 100); // Log volume as depth proxy
}

/**
 * Extract sentiment volatility from sentiment ticks
 */
function extractSentimentVolatility(ticks: any[]): number[] {
  const sentimentValues = ticks
    .filter(tick => typeof tick.score === 'number')
    .map(tick => tick.score);

  if (sentimentValues.length < 10) return [];

  // Calculate rolling volatility (standard deviation over 10-period windows)
  const volatilities: number[] = [];
  for (let i = 9; i < sentimentValues.length; i++) {
    const window = sentimentValues.slice(i - 9, i + 1);
    const mean = window.reduce((sum, val) => sum + val, 0) / window.length;
    const variance = window.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / window.length;
    volatilities.push(Math.sqrt(variance) * 100); // Convert to percentage
  }

  return volatilities;
}

async function runFeatureDriftAnalysis(): Promise<DriftReport> {
  const now = new Date();
  const recent7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const historical30d = new Date(now.getTime() - 37 * 24 * 60 * 60 * 1000); // 37 days ago to 7 days ago

  logger.info('[FeatureDrift] Starting PSI analysis', {
    recent_start: recent7d.toISOString(),
    historical_start: historical30d.toISOString(),
    historical_end: recent7d.toISOString()
  });

  // Fetch recent market data (last 7 days)
  const recentBars = await db
    .select()
    .from(marketBars)
    .where(gte(marketBars.timestamp, recent7d))
    .orderBy(desc(marketBars.timestamp))
    .limit(1000);

  // Fetch historical market data (30 days ago to 7 days ago)
  const historicalBars = await db
    .select()
    .from(marketBars)
    .where(
      and(
        gte(marketBars.timestamp, historical30d),
        lte(marketBars.timestamp, recent7d)
      )
    )
    .orderBy(desc(marketBars.timestamp))
    .limit(3000);

  // Fetch sentiment data for the same periods
  const recentSentiment = await db
    .select()
    .from(sentimentTicks)
    .where(gte(sentimentTicks.timestamp, recent7d))
    .orderBy(desc(sentimentTicks.timestamp))
    .limit(1000);

  const historicalSentiment = await db
    .select()
    .from(sentimentTicks)
    .where(
      and(
        gte(sentimentTicks.timestamp, historical30d),
        lte(sentimentTicks.timestamp, recent7d)
      )
    )
    .orderBy(desc(sentimentTicks.timestamp))
    .limit(3000);

  const features: FeatureStats[] = [];

  // Feature 1: Spread BPS
  const recentSpreadBps = extractSpreadBps(recentBars);
  const historicalSpreadBps = extractSpreadBps(historicalBars);
  
  if (recentSpreadBps.length > 0 && historicalSpreadBps.length > 0) {
    const spreadPsi = calculatePSI(recentSpreadBps, historicalSpreadBps);
    features.push({
      name: 'spread_bps',
      psi: spreadPsi,
      status: spreadPsi > 0.25 ? 'fail' : 'pass',
      recent_mean: recentSpreadBps.reduce((sum, val) => sum + val, 0) / recentSpreadBps.length,
      historical_mean: historicalSpreadBps.reduce((sum, val) => sum + val, 0) / historicalSpreadBps.length,
      bins: 10
    });
  }

  // Feature 2: Depth BPS (Volume-based proxy)
  const recentDepthBps = extractDepthBps(recentBars);
  const historicalDepthBps = extractDepthBps(historicalBars);
  
  if (recentDepthBps.length > 0 && historicalDepthBps.length > 0) {
    const depthPsi = calculatePSI(recentDepthBps, historicalDepthBps);
    features.push({
      name: 'depth1bp',
      psi: depthPsi,
      status: depthPsi > 0.25 ? 'fail' : 'pass',
      recent_mean: recentDepthBps.reduce((sum, val) => sum + val, 0) / recentDepthBps.length,
      historical_mean: historicalDepthBps.reduce((sum, val) => sum + val, 0) / historicalDepthBps.length,
      bins: 10
    });
  }

  // Feature 3: Sentiment Volatility
  const recentSentVol = extractSentimentVolatility(recentSentiment);
  const historicalSentVol = extractSentimentVolatility(historicalSentiment);
  
  if (recentSentVol.length > 0 && historicalSentVol.length > 0) {
    const sentimentPsi = calculatePSI(recentSentVol, historicalSentVol);
    features.push({
      name: 'sentiment_volatility',
      psi: sentimentPsi,
      status: sentimentPsi > 0.25 ? 'fail' : 'pass',
      recent_mean: recentSentVol.reduce((sum, val) => sum + val, 0) / recentSentVol.length,
      historical_mean: historicalSentVol.reduce((sum, val) => sum + val, 0) / historicalSentVol.length,
      bins: 10
    });
  }

  const failedFeatures = features.filter(f => f.status === 'fail').length;
  const driftAcknowledged = process.env.DRIFT_ACK === '1';
  const overallStatus = failedFeatures >= 2 && !driftAcknowledged ? 'fail' : 'pass';

  const report: DriftReport = {
    timestamp: now.toISOString(),
    features,
    failed_features: failedFeatures,
    overall_status: overallStatus,
    drift_acknowledged: driftAcknowledged
  };

  logger.info('[FeatureDrift] Analysis complete', {
    total_features: features.length,
    failed_features: failedFeatures,
    overall_status: overallStatus,
    drift_acknowledged: driftAcknowledged
  });

  return report;
}

async function main() {
  try {
    const report = await runFeatureDriftAnalysis();
    
    console.log('\n🔍 Feature Drift Analysis Report');
    console.log('================================');
    console.log(`Timestamp: ${report.timestamp}`);
    console.log(`Overall Status: ${report.overall_status.toUpperCase()}`);
    console.log(`Failed Features: ${report.failed_features}/${report.features.length}`);
    console.log(`Drift Acknowledged: ${report.drift_acknowledged ? 'YES' : 'NO'}`);
    
    console.log('\nFeature Details:');
    report.features.forEach(feature => {
      console.log(`\n📊 ${feature.name}`);
      console.log(`   PSI: ${feature.psi.toFixed(4)}`);
      console.log(`   Status: ${feature.status.toUpperCase()}`);
      console.log(`   Recent Mean: ${feature.recent_mean.toFixed(4)}`);
      console.log(`   Historical Mean: ${feature.historical_mean.toFixed(4)}`);
      console.log(`   Change: ${((feature.recent_mean / feature.historical_mean - 1) * 100).toFixed(2)}%`);
    });

    if (report.overall_status === 'fail') {
      console.log('\n⚠️  DRIFT ALERT: Significant feature drift detected!');
      console.log('   Action required: Review model performance and consider retraining');
      console.log('   To acknowledge drift and continue: DRIFT_ACK=1 npm run audit:drift');
      process.exit(1);
    } else {
      console.log('\n✅ Feature drift within acceptable limits');
    }

    // Save report to file
    const fs = await import('fs/promises');
    const reportPath = `logs/feature_drift_${Date.now()}.json`;
    await fs.mkdir('logs', { recursive: true });
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n📄 Report saved to: ${reportPath}`);

  } catch (error) {
    logger.error('[FeatureDrift] Analysis failed', error);
    console.error('❌ Feature drift analysis failed:', error);
    process.exit(1);
  }
}

// ES module main check
import { fileURLToPath } from 'url';
import { dirname } from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { runFeatureDriftAnalysis, calculatePSI };