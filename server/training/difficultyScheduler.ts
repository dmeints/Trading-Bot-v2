#!/usr/bin/env tsx

/**
 * STEVIE DIFFICULTY SCHEDULER
 * Manages version progression and difficulty scaling for Training Day
 */

export interface DifficultyConfig {
  version: string;
  days: number;
  marketShocks: number;
  noiseLevel: number;
  slippageRate: number;
  complexityFactors: string[];
}

export class SteveDifficultyScheduler {
  private baseConfig = {
    days: 7,
    marketShocks: 1,
    noiseLevel: 2,
    slippageRate: 0.1
  };

  /**
   * Increment version number following semantic versioning for training iterations
   * Format: Major.Minor (e.g., 1.1 → 1.2 → 1.3 ... 1.9 → 2.0)
   */
  increase(currentVersion: string): string {
    const [major, minor] = currentVersion.split('.').map(Number);
    
    if (minor >= 9) {
      // Roll over to next major version
      return `${major + 1}.0`;
    } else {
      // Increment minor version
      return `${major}.${minor + 1}`;
    }
  }

  /**
   * Get difficulty configuration for a specific version
   */
  getDifficultyConfig(version: string): DifficultyConfig {
    const [major, minor] = version.split('.').map(Number);
    const iterationNumber = (major - 1) * 10 + minor;
    
    // Scale difficulty exponentially with version
    const scaleFactor = 1 + (iterationNumber * 0.15); // 15% increase per version
    
    const config: DifficultyConfig = {
      version,
      days: Math.max(7, Math.floor(this.baseConfig.days * scaleFactor)),
      marketShocks: Math.floor(this.baseConfig.marketShocks * scaleFactor),
      noiseLevel: Math.min(20, this.baseConfig.noiseLevel * scaleFactor), // Cap at 20%
      slippageRate: Math.min(1.0, this.baseConfig.slippageRate * scaleFactor), // Cap at 1%
      complexityFactors: this.getComplexityFactors(iterationNumber)
    };

    return config;
  }

  /**
   * Determine if version represents a major difficulty milestone
   */
  isMajorMilestone(version: string): boolean {
    const [major, minor] = version.split('.').map(Number);
    return minor === 0 && major > 1; // 2.0, 3.0, etc.
  }

  /**
   * Get human-readable difficulty description
   */
  getDifficultyDescription(version: string): string {
    const config = this.getDifficultyConfig(version);
    const [major, minor] = version.split('.').map(Number);
    
    if (major === 1 && minor <= 3) {
      return 'Beginner - Basic market conditions';
    } else if (major === 1 && minor <= 6) {
      return 'Intermediate - Moderate volatility and noise';
    } else if (major === 1 && minor <= 9) {
      return 'Advanced - High complexity with market shocks';
    } else if (major === 2) {
      return 'Expert - Extreme conditions with maximum difficulty';
    } else {
      return 'Master - Beyond normal market conditions';
    }
  }

  /**
   * Calculate expected performance degradation for version
   */
  getExpectedPerformanceImpact(version: string): number {
    const [major, minor] = version.split('.').map(Number);
    const iterationNumber = (major - 1) * 10 + minor;
    
    // Each iteration should reduce performance by ~2-5%
    return Math.max(0.7, 1 - (iterationNumber * 0.025));
  }

  /**
   * Get stopping criteria for version
   */
  getStoppingCriteria(version: string): { minImprovement: number; maxIterations: number } {
    const [major] = version.split('.').map(Number);
    
    if (major <= 2) {
      return { minImprovement: 0.005, maxIterations: 20 }; // 0.5% minimum improvement
    } else if (major <= 4) {
      return { minImprovement: 0.003, maxIterations: 15 }; // 0.3% minimum improvement  
    } else {
      return { minImprovement: 0.001, maxIterations: 10 }; // 0.1% minimum improvement
    }
  }

  private getComplexityFactors(iterationNumber: number): string[] {
    const factors: string[] = [];
    
    if (iterationNumber >= 2) factors.push('extended_timeframe');
    if (iterationNumber >= 3) factors.push('market_volatility');
    if (iterationNumber >= 5) factors.push('transaction_costs');
    if (iterationNumber >= 7) factors.push('liquidity_constraints');
    if (iterationNumber >= 10) factors.push('regime_changes');
    if (iterationNumber >= 12) factors.push('correlation_breakdown');
    if (iterationNumber >= 15) factors.push('extreme_events');
    if (iterationNumber >= 18) factors.push('model_degradation');
    if (iterationNumber >= 20) factors.push('adversarial_conditions');
    
    return factors;
  }

  /**
   * Generate version progression roadmap
   */
  getVersionRoadmap(startVersion: string, maxVersions: number = 10): DifficultyConfig[] {
    const roadmap: DifficultyConfig[] = [];
    let currentVersion = startVersion;
    
    for (let i = 0; i < maxVersions; i++) {
      roadmap.push(this.getDifficultyConfig(currentVersion));
      currentVersion = this.increase(currentVersion);
    }
    
    return roadmap;
  }

  /**
   * Analyze version performance trends
   */
  analyzePerformanceTrend(results: Array<{ version: string; performance: number }>): {
    trend: 'improving' | 'stable' | 'degrading';
    degradationRate: number;
    recommendedAction: string;
  } {
    if (results.length < 2) {
      return {
        trend: 'stable',
        degradationRate: 0,
        recommendedAction: 'Continue training - insufficient data'
      };
    }

    const recent = results.slice(-3); // Last 3 results
    const avgRecent = recent.reduce((sum, r) => sum + r.performance, 0) / recent.length;
    const avgEarlier = results.slice(0, -3).reduce((sum, r) => sum + r.performance, 0) / Math.max(1, results.length - 3);
    
    const degradationRate = (avgEarlier - avgRecent) / avgEarlier;
    
    let trend: 'improving' | 'stable' | 'degrading';
    let recommendedAction: string;
    
    if (degradationRate < -0.05) {
      trend = 'improving';
      recommendedAction = 'Continue training - performance still improving';
    } else if (degradationRate < 0.02) {
      trend = 'stable';
      recommendedAction = 'Continue with caution - performance plateauing';
    } else {
      trend = 'degrading';
      recommendedAction = 'Consider stopping - performance degrading significantly';
    }

    return { trend, degradationRate, recommendedAction };
  }
}

// CLI execution for testing
if (import.meta.url === `file://${process.argv[1]}`) {
  const scheduler = new SteveDifficultyScheduler();
  
  console.log('🎚️ STEVIE DIFFICULTY SCHEDULER TEST');
  console.log('='.repeat(40));
  
  let version = '1.1';
  for (let i = 0; i < 12; i++) {
    const config = scheduler.getDifficultyConfig(version);
    const description = scheduler.getDifficultyDescription(version);
    const impact = scheduler.getExpectedPerformanceImpact(version);
    
    console.log(`v${version}: ${description}`);
    console.log(`  Days: ${config.days}, Shocks: ${config.marketShocks}, Noise: ${config.noiseLevel.toFixed(1)}%`);
    console.log(`  Expected Impact: ${((1-impact)*100).toFixed(1)}% performance reduction`);
    console.log(`  Complexity: ${config.complexityFactors.join(', ')}`);
    console.log('');
    
    version = scheduler.increase(version);
  }
}

export default SteveDifficultyScheduler;