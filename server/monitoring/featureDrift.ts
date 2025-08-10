/**
 * Feature Drift Detection
 * PSI (Population Stability Index) calculations for monitoring model degradation
 */

export interface PSIResult {
  psi_score: number;
  risk_level: 'low' | 'medium' | 'high';
  bins: Array<{
    range: string;
    expected_pct: number;
    actual_pct: number;
    psi_contribution: number;
  }>;
  warning?: string;
}

export interface DriftReport {
  feature_name: string;
  measurement_date: string;
  baseline_period: { start: string; end: string };
  current_period: { start: string; end: string };
  psi_result: PSIResult;
  recommendation: string;
}

/**
 * Calculate Population Stability Index (PSI) to detect feature drift
 */
export function calculatePSI(
  baselineData: number[],
  currentData: number[],
  numBins: number = 10
): PSIResult {
  
  if (baselineData.length === 0 || currentData.length === 0) {
    return {
      psi_score: 999, // Invalid/high score
      risk_level: 'high',
      bins: [],
      warning: 'Insufficient data for PSI calculation'
    };
  }

  // Combine data to determine bin ranges
  const allData = [...baselineData, ...currentData];
  const minValue = Math.min(...allData);
  const maxValue = Math.max(...allData);
  
  // Handle edge case where all values are the same
  if (minValue === maxValue) {
    return {
      psi_score: 0,
      risk_level: 'low',
      bins: [{
        range: `${minValue}`,
        expected_pct: 100,
        actual_pct: 100,
        psi_contribution: 0
      }],
      warning: 'All values identical - no drift possible'
    };
  }

  // Create bins
  const binWidth = (maxValue - minValue) / numBins;
  const bins = Array.from({ length: numBins }, (_, i) => ({
    min: minValue + i * binWidth,
    max: minValue + (i + 1) * binWidth,
    expected_count: 0,
    actual_count: 0
  }));

  // Adjust last bin to include maximum value
  bins[bins.length - 1].max = maxValue + 0.001;

  // Count baseline data in bins
  for (const value of baselineData) {
    const binIndex = Math.min(
      Math.floor((value - minValue) / binWidth),
      numBins - 1
    );
    bins[binIndex].expected_count++;
  }

  // Count current data in bins
  for (const value of currentData) {
    const binIndex = Math.min(
      Math.floor((value - minValue) / binWidth),
      numBins - 1
    );
    bins[binIndex].actual_count++;
  }

  // Calculate percentages and PSI
  let psiScore = 0;
  const psiDetails = bins.map(bin => {
    const expectedPct = (bin.expected_count / baselineData.length) * 100;
    const actualPct = (bin.actual_count / currentData.length) * 100;
    
    // PSI calculation: (Actual% - Expected%) * ln(Actual% / Expected%)
    // Handle zero cases to avoid division by zero and log(0)
    let psiContribution = 0;
    
    if (expectedPct > 0 && actualPct > 0) {
      psiContribution = (actualPct - expectedPct) * Math.log(actualPct / expectedPct) / 100;
    } else if (expectedPct === 0 && actualPct > 0) {
      // New data in previously empty bin - significant drift
      psiContribution = actualPct * Math.log(actualPct / 0.001) / 100; // Use small number instead of 0
    } else if (expectedPct > 0 && actualPct === 0) {
      // Data disappeared from previously populated bin - significant drift
      psiContribution = -expectedPct * Math.log(0.001 / expectedPct) / 100;
    }
    
    psiScore += psiContribution;

    return {
      range: `${bin.min.toFixed(2)} - ${bin.max.toFixed(2)}`,
      expected_pct: Math.round(expectedPct * 100) / 100,
      actual_pct: Math.round(actualPct * 100) / 100,
      psi_contribution: Math.round(psiContribution * 10000) / 10000
    };
  });

  // Determine risk level based on PSI score
  let riskLevel: 'low' | 'medium' | 'high';
  if (psiScore < 0.1) {
    riskLevel = 'low';
  } else if (psiScore < 0.25) {
    riskLevel = 'medium';
  } else {
    riskLevel = 'high';
  }

  return {
    psi_score: Math.round(psiScore * 10000) / 10000,
    risk_level: riskLevel,
    bins: psiDetails
  };
}

/**
 * Monitor feature drift across multiple features
 */
export function generateDriftReport(
  featureName: string,
  baselineData: number[],
  currentData: number[],
  baselinePeriod: { start: Date; end: Date },
  currentPeriod: { start: Date; end: Date }
): DriftReport {
  
  const psiResult = calculatePSI(baselineData, currentData);
  
  // Generate recommendation based on PSI score
  let recommendation = '';
  switch (psiResult.risk_level) {
    case 'low':
      recommendation = 'No action required. Feature distribution is stable.';
      break;
    case 'medium':
      recommendation = 'Monitor closely. Consider investigation if drift continues.';
      break;
    case 'high':
      recommendation = 'URGENT: Significant drift detected. Review model performance and consider retraining.';
      break;
  }

  return {
    feature_name: featureName,
    measurement_date: new Date().toISOString(),
    baseline_period: {
      start: baselinePeriod.start.toISOString(),
      end: baselinePeriod.end.toISOString()
    },
    current_period: {
      start: currentPeriod.start.toISOString(),
      end: currentPeriod.end.toISOString()
    },
    psi_result: psiResult,
    recommendation
  };
}

/**
 * Batch process multiple features for drift detection
 */
export function batchDriftAnalysis(
  features: Record<string, { baseline: number[]; current: number[] }>,
  periods: { baseline: { start: Date; end: Date }; current: { start: Date; end: Date } }
): DriftReport[] {
  
  return Object.entries(features).map(([featureName, data]) => 
    generateDriftReport(
      featureName,
      data.baseline,
      data.current,
      periods.baseline,
      periods.current
    )
  );
}