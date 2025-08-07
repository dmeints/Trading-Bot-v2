/**
 * Data Augmentation & Curriculum Learning
 * Enhance training robustness with synthetic noise and progressive difficulty
 */

import { logger } from '../utils/logger';
import * as fs from 'fs/promises';
import * as path from 'path';

interface MarketDataPoint {
  timestamp: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface AugmentationConfig {
  gaussianNoiseStd: number;
  volumeNoiseStd: number;
  priceShiftRange: number;
  volatilityMultiplierRange: [number, number];
  timeWarpProbability: number;
}

interface CurriculumStage {
  stageName: string;
  description: string;
  volatilityThreshold: number;
  liquidityThreshold: number;
  trendStrength: number;
  duration: number; // Training steps for this stage
}

export class DataAugmentationManager {
  private readonly defaultConfig: AugmentationConfig = {
    gaussianNoiseStd: 0.001,
    volumeNoiseStd: 0.05,
    priceShiftRange: 0.002,
    volatilityMultiplierRange: [0.8, 1.2],
    timeWarpProbability: 0.1
  };

  constructor(private config: AugmentationConfig = {}) {
    this.config = { ...this.defaultConfig, ...config };
    logger.info('[Augmentation] Data augmentation manager initialized');
  }

  /**
   * Apply Gaussian noise to OHLCV data for robustness
   */
  applyGaussianNoise(marketData: MarketDataPoint[]): MarketDataPoint[] {
    logger.info(`[Augmentation] Applying Gaussian noise to ${marketData.length} data points`);
    
    return marketData.map(point => {
      // Generate correlated noise for OHLC to maintain price relationships
      const baseNoise = this.generateGaussianNoise(0, this.config.gaussianNoiseStd);
      const highNoise = Math.max(baseNoise, this.generateGaussianNoise(0, this.config.gaussianNoiseStd * 0.5));
      const lowNoise = Math.min(baseNoise, this.generateGaussianNoise(0, this.config.gaussianNoiseStd * 0.5));
      
      return {
        ...point,
        open: point.open * (1 + baseNoise),
        high: point.high * (1 + highNoise),
        low: point.low * (1 + lowNoise),
        close: point.close * (1 + this.generateGaussianNoise(0, this.config.gaussianNoiseStd)),
        volume: point.volume * (1 + Math.abs(this.generateGaussianNoise(0, this.config.volumeNoiseStd)))
      };
    });
  }

  /**
   * Apply price shifts to simulate different market regimes
   */
  applyPriceShifts(marketData: MarketDataPoint[], shiftFactor?: number): MarketDataPoint[] {
    const shift = shiftFactor || (Math.random() - 0.5) * 2 * this.config.priceShiftRange;
    
    logger.info(`[Augmentation] Applying price shift of ${(shift * 100).toFixed(2)}%`);
    
    return marketData.map(point => ({
      ...point,
      open: point.open * (1 + shift),
      high: point.high * (1 + shift),
      low: point.low * (1 + shift),
      close: point.close * (1 + shift)
    }));
  }

  /**
   * Modify volatility to simulate different market conditions
   */
  modifyVolatility(marketData: MarketDataPoint[], volatilityMultiplier?: number): MarketDataPoint[] {
    const multiplier = volatilityMultiplier || 
      Math.random() * (this.config.volatilityMultiplierRange[1] - this.config.volatilityMultiplierRange[0]) +
      this.config.volatilityMultiplierRange[0];
    
    logger.info(`[Augmentation] Modifying volatility with multiplier ${multiplier.toFixed(2)}`);
    
    const basePrices = marketData.map(p => (p.open + p.high + p.low + p.close) / 4);
    
    return marketData.map((point, index) => {
      const basePrice = basePrices[index];
      const openDiff = (point.open - basePrice) * multiplier;
      const highDiff = (point.high - basePrice) * multiplier;
      const lowDiff = (point.low - basePrice) * multiplier;
      const closeDiff = (point.close - basePrice) * multiplier;
      
      return {
        ...point,
        open: basePrice + openDiff,
        high: basePrice + highDiff,
        low: basePrice + lowDiff,
        close: basePrice + closeDiff
      };
    });
  }

  /**
   * Apply time warping (stretching/compressing time periods)
   */
  applyTimeWarping(marketData: MarketDataPoint[]): MarketDataPoint[] {
    if (Math.random() > this.config.timeWarpProbability) {
      return marketData; // No warping
    }

    const warpFactor = 0.8 + Math.random() * 0.4; // 0.8 to 1.2
    logger.info(`[Augmentation] Applying time warping with factor ${warpFactor.toFixed(2)}`);
    
    const targetLength = Math.floor(marketData.length * warpFactor);
    const warpedData: MarketDataPoint[] = [];
    
    for (let i = 0; i < targetLength; i++) {
      const sourceIndex = Math.floor(i / warpFactor);
      if (sourceIndex < marketData.length) {
        warpedData.push({ ...marketData[sourceIndex] });
      }
    }
    
    return warpedData;
  }

  /**
   * Generate comprehensive augmented dataset
   */
  generateAugmentedDataset(
    baseData: MarketDataPoint[], 
    numVariations: number = 5
  ): MarketDataPoint[][] {
    logger.info(`[Augmentation] Generating ${numVariations} augmented variations`);
    
    const augmentedDatasets: MarketDataPoint[][] = [];
    
    // Original data
    augmentedDatasets.push([...baseData]);
    
    for (let i = 0; i < numVariations - 1; i++) {
      let augmentedData = [...baseData];
      
      // Apply random combination of augmentations
      if (Math.random() > 0.3) {
        augmentedData = this.applyGaussianNoise(augmentedData);
      }
      
      if (Math.random() > 0.5) {
        augmentedData = this.applyPriceShifts(augmentedData);
      }
      
      if (Math.random() > 0.4) {
        augmentedData = this.modifyVolatility(augmentedData);
      }
      
      if (Math.random() > 0.7) {
        augmentedData = this.applyTimeWarping(augmentedData);
      }
      
      augmentedDatasets.push(augmentedData);
    }
    
    return augmentedDatasets;
  }

  /**
   * Generate Gaussian noise
   */
  private generateGaussianNoise(mean: number = 0, std: number = 1): number {
    let u = 0, v = 0;
    while(u === 0) u = Math.random(); // Converting [0,1) to (0,1)
    while(v === 0) v = Math.random();
    
    const z0 = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    return mean + std * z0;
  }

  /**
   * Save augmented datasets
   */
  async saveAugmentedDatasets(datasets: MarketDataPoint[][], baseName: string = 'augmented'): Promise<string[]> {
    const savedPaths: string[] = [];
    await fs.mkdir('augmented_data', { recursive: true });
    
    for (let i = 0; i < datasets.length; i++) {
      const fileName = `${baseName}_${i}.json`;
      const filePath = path.join('augmented_data', fileName);
      
      await fs.writeFile(filePath, JSON.stringify(datasets[i], null, 2));
      savedPaths.push(filePath);
    }
    
    logger.info(`[Augmentation] Saved ${datasets.length} augmented datasets`);
    return savedPaths;
  }
}

export class CurriculumLearningManager {
  private readonly curriculumStages: CurriculumStage[] = [
    {
      stageName: "Stable Markets",
      description: "High liquidity, low volatility periods",
      volatilityThreshold: 0.15,
      liquidityThreshold: 1000000,
      trendStrength: 0.3,
      duration: 200000
    },
    {
      stageName: "Moderate Volatility",
      description: "Normal market conditions with moderate swings",
      volatilityThreshold: 0.25,
      liquidityThreshold: 500000,
      trendStrength: 0.5,
      duration: 300000
    },
    {
      stageName: "High Volatility",
      description: "Challenging conditions with high volatility",
      volatilityThreshold: 0.4,
      liquidityThreshold: 200000,
      trendStrength: 0.7,
      duration: 250000
    },
    {
      stageName: "Turbulent Markets",
      description: "Crisis periods with extreme volatility and low liquidity",
      volatilityThreshold: 0.6,
      liquidityThreshold: 100000,
      trendStrength: 0.9,
      duration: 200000
    }
  ];

  private currentStage = 0;
  private stageProgress = 0;

  constructor() {
    logger.info('[Curriculum] Curriculum learning manager initialized');
    logger.info(`[Curriculum] ${this.curriculumStages.length} stages defined`);
  }

  /**
   * Get current curriculum stage
   */
  getCurrentStage(): CurriculumStage {
    return this.curriculumStages[this.currentStage];
  }

  /**
   * Advance to next curriculum stage
   */
  advanceStage(): boolean {
    if (this.currentStage < this.curriculumStages.length - 1) {
      this.currentStage++;
      this.stageProgress = 0;
      
      const stage = this.getCurrentStage();
      logger.info(`[Curriculum] Advanced to stage ${this.currentStage + 1}: ${stage.stageName}`);
      logger.info(`[Curriculum] ${stage.description}`);
      
      return true;
    }
    return false;
  }

  /**
   * Update progress in current stage
   */
  updateProgress(steps: number): boolean {
    this.stageProgress += steps;
    const currentStage = this.getCurrentStage();
    
    const progressPct = (this.stageProgress / currentStage.duration) * 100;
    
    if (this.stageProgress % 50000 === 0) {
      logger.info(`[Curriculum] Stage progress: ${progressPct.toFixed(1)}% (${this.stageProgress}/${currentStage.duration})`);
    }
    
    return this.stageProgress >= currentStage.duration;
  }

  /**
   * Filter market data based on current curriculum stage
   */
  filterDataForCurrentStage(marketData: MarketDataPoint[]): MarketDataPoint[] {
    const stage = this.getCurrentStage();
    
    // Calculate volatility for each point (simplified rolling volatility)
    const windowSize = 20;
    const volatilities = this.calculateRollingVolatility(marketData, windowSize);
    
    // Filter based on stage criteria
    const filteredData = marketData.filter((point, index) => {
      const volatility = volatilities[index] || 0;
      const meetsCriteria = (
        volatility <= stage.volatilityThreshold &&
        point.volume >= stage.liquidityThreshold
      );
      
      return meetsCriteria;
    });

    logger.info(`[Curriculum] Filtered ${marketData.length} -> ${filteredData.length} data points for stage: ${stage.stageName}`);
    
    // If too few data points, relax criteria slightly
    if (filteredData.length < 1000) {
      logger.warn(`[Curriculum] Too few data points (${filteredData.length}), relaxing criteria`);
      return marketData.filter((point, index) => {
        const volatility = volatilities[index] || 0;
        return volatility <= stage.volatilityThreshold * 1.5;
      });
    }
    
    return filteredData;
  }

  /**
   * Calculate rolling volatility
   */
  private calculateRollingVolatility(marketData: MarketDataPoint[], window: number): number[] {
    const volatilities: number[] = [];
    
    for (let i = 0; i < marketData.length; i++) {
      if (i < window) {
        volatilities.push(0.1); // Default volatility for early points
        continue;
      }
      
      const windowData = marketData.slice(i - window + 1, i + 1);
      const returns = windowData.slice(1).map((point, idx) => 
        Math.log(point.close / windowData[idx].close)
      );
      
      const meanReturn = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
      const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - meanReturn, 2), 0) / returns.length;
      const volatility = Math.sqrt(variance * 252); // Annualized
      
      volatilities.push(volatility);
    }
    
    return volatilities;
  }

  /**
   * Generate curriculum training plan
   */
  generateTrainingPlan(): {
    totalSteps: number;
    stages: Array<{
      stage: CurriculumStage;
      startStep: number;
      endStep: number;
    }>;
  } {
    let currentStep = 0;
    const stages = this.curriculumStages.map(stage => {
      const startStep = currentStep;
      const endStep = currentStep + stage.duration;
      currentStep = endStep;
      
      return {
        stage,
        startStep,
        endStep
      };
    });
    
    return {
      totalSteps: currentStep,
      stages
    };
  }

  /**
   * Save curriculum progress
   */
  async saveCurriculumProgress(): Promise<void> {
    const progress = {
      currentStage: this.currentStage,
      stageProgress: this.stageProgress,
      currentStageName: this.getCurrentStage().stageName,
      totalStages: this.curriculumStages.length,
      completionPercent: ((this.currentStage + (this.stageProgress / this.getCurrentStage().duration)) / this.curriculumStages.length) * 100,
      timestamp: new Date()
    };
    
    await fs.mkdir('curriculum_progress', { recursive: true });
    await fs.writeFile(
      'curriculum_progress/current_progress.json',
      JSON.stringify(progress, null, 2)
    );
    
    logger.info(`[Curriculum] Progress saved: Stage ${this.currentStage + 1}/${this.curriculumStages.length} (${progress.completionPercent.toFixed(1)}%)`);
  }

  /**
   * Load curriculum progress
   */
  async loadCurriculumProgress(): Promise<void> {
    try {
      const progressData = await fs.readFile('curriculum_progress/current_progress.json', 'utf-8');
      const progress = JSON.parse(progressData);
      
      this.currentStage = progress.currentStage || 0;
      this.stageProgress = progress.stageProgress || 0;
      
      logger.info(`[Curriculum] Progress loaded: Stage ${this.currentStage + 1}/${this.curriculumStages.length}`);
    } catch (error) {
      logger.info('[Curriculum] No previous progress found, starting from beginning');
    }
  }

  /**
   * Reset curriculum to beginning
   */
  resetCurriculum(): void {
    this.currentStage = 0;
    this.stageProgress = 0;
    logger.info('[Curriculum] Reset to beginning');
  }

  /**
   * Get curriculum statistics
   */
  getCurriculumStats(): {
    currentStage: number;
    totalStages: number;
    stageProgress: number;
    overallProgress: number;
    currentStageName: string;
    remainingSteps: number;
  } {
    const currentStageObj = this.getCurrentStage();
    const overallProgress = ((this.currentStage + (this.stageProgress / currentStageObj.duration)) / this.curriculumStages.length) * 100;
    const remainingSteps = currentStageObj.duration - this.stageProgress;
    
    return {
      currentStage: this.currentStage + 1,
      totalStages: this.curriculumStages.length,
      stageProgress: this.stageProgress,
      overallProgress,
      currentStageName: currentStageObj.stageName,
      remainingSteps
    };
  }
}

export const dataAugmentation = new DataAugmentationManager();
export const curriculumLearning = new CurriculumLearningManager();