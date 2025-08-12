
import { logger } from '../utils/logger';

interface FeatureFlags {
  ExecutionRouter: boolean;
  StrategyRouter: boolean;
  BOCPD: boolean;
  DataQuality: 'strict' | 'relaxed' | 'disabled';
  RiskGuards: boolean;
  ProvenanceTracking: boolean;
  MetricsCollection: boolean;
}

export class FeatureFlagsService {
  private static instance: FeatureFlagsService;
  private flags: FeatureFlags;
  private envOverrides: Partial<FeatureFlags> = {};

  public static getInstance(): FeatureFlagsService {
    if (!FeatureFlagsService.instance) {
      FeatureFlagsService.instance = new FeatureFlagsService();
    }
    return FeatureFlagsService.instance;
  }

  constructor() {
    this.flags = {
      ExecutionRouter: true,
      StrategyRouter: true,
      BOCPD: true,
      DataQuality: 'strict',
      RiskGuards: true,
      ProvenanceTracking: true,
      MetricsCollection: true
    };

    this.loadFromEnv();
    logger.info('[FeatureFlags] Initialized:', this.flags);
  }

  private loadFromEnv(): void {
    // Load flags from environment variables
    if (process.env.FEATURE_EXECUTION_ROUTER !== undefined) {
      this.flags.ExecutionRouter = process.env.FEATURE_EXECUTION_ROUTER === 'true';
    }

    if (process.env.FEATURE_STRATEGY_ROUTER !== undefined) {
      this.flags.StrategyRouter = process.env.FEATURE_STRATEGY_ROUTER === 'true';
    }

    if (process.env.FEATURE_BOCPD !== undefined) {
      this.flags.BOCPD = process.env.FEATURE_BOCPD === 'true';
    }

    if (process.env.FEATURE_DATA_QUALITY !== undefined) {
      const value = process.env.FEATURE_DATA_QUALITY;
      if (['strict', 'relaxed', 'disabled'].includes(value)) {
        this.flags.DataQuality = value as 'strict' | 'relaxed' | 'disabled';
      }
    }

    if (process.env.FEATURE_RISK_GUARDS !== undefined) {
      this.flags.RiskGuards = process.env.FEATURE_RISK_GUARDS === 'true';
    }

    if (process.env.FEATURE_PROVENANCE_TRACKING !== undefined) {
      this.flags.ProvenanceTracking = process.env.FEATURE_PROVENANCE_TRACKING === 'true';
    }

    if (process.env.FEATURE_METRICS_COLLECTION !== undefined) {
      this.flags.MetricsCollection = process.env.FEATURE_METRICS_COLLECTION === 'true';
    }
  }

  getFlags(): FeatureFlags {
    return { ...this.flags, ...this.envOverrides };
  }

  getFlag<K extends keyof FeatureFlags>(flagName: K): FeatureFlags[K] {
    if (flagName in this.envOverrides) {
      return this.envOverrides[flagName] as FeatureFlags[K];
    }
    return this.flags[flagName];
  }

  setFlag<K extends keyof FeatureFlags>(flagName: K, value: FeatureFlags[K]): boolean {
    try {
      this.envOverrides[flagName] = value;
      logger.info(`[FeatureFlags] Set ${flagName} = ${value}`);
      return true;
    } catch (error) {
      logger.error(`[FeatureFlags] Failed to set ${flagName}:`, error);
      return false;
    }
  }

  setFlags(newFlags: Partial<FeatureFlags>): boolean {
    try {
      Object.assign(this.envOverrides, newFlags);
      logger.info('[FeatureFlags] Updated flags:', newFlags);
      return true;
    } catch (error) {
      logger.error('[FeatureFlags] Failed to set flags:', error);
      return false;
    }
  }

  resetOverrides(): void {
    this.envOverrides = {};
    logger.info('[FeatureFlags] Reset overrides');
  }

  isEnabled(flagName: keyof FeatureFlags): boolean {
    const value = this.getFlag(flagName);
    return value === true || (typeof value === 'string' && value !== 'disabled');
  }
}
