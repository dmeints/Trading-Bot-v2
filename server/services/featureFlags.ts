interface FeatureFlag {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  rolloutPercentage: number;
  userGroups: string[];
  environments: string[];
  createdAt: Date;
  updatedAt: Date;
}

class FeatureFlagService {
  private flags: Map<string, FeatureFlag> = new Map();

  constructor() {
    this.initializeDefaultFlags();
  }

  async isEnabled(flagId: string, userId?: string, environment = 'development'): Promise<boolean> {
    const flag = this.flags.get(flagId);
    if (!flag) {
      console.warn(`[FeatureFlags] Flag '${flagId}' not found, defaulting to false`);
      return false;
    }

    // Check if flag is globally disabled
    if (!flag.enabled) {
      return false;
    }

    // Check environment
    if (flag.environments.length > 0 && !flag.environments.includes(environment)) {
      return false;
    }

    // Check rollout percentage
    if (flag.rolloutPercentage < 100) {
      const userHash = userId ? this.hashUserId(userId, flagId) : Math.random();
      if (userHash > flag.rolloutPercentage / 100) {
        return false;
      }
    }

    return true;
  }

  async createFlag(flagData: Omit<FeatureFlag, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const flag: FeatureFlag = {
      id: `flag_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...flagData,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.flags.set(flag.id, flag);
    console.log(`[FeatureFlags] Created flag: ${flag.name}`);
    
    return flag.id;
  }

  async updateFlag(flagId: string, updates: Partial<FeatureFlag>): Promise<boolean> {
    const flag = this.flags.get(flagId);
    if (!flag) {
      return false;
    }

    Object.assign(flag, updates, { updatedAt: new Date() });
    this.flags.set(flagId, flag);
    
    console.log(`[FeatureFlags] Updated flag: ${flag.name}`);
    return true;
  }

  async deleteFlag(flagId: string): Promise<boolean> {
    const deleted = this.flags.delete(flagId);
    if (deleted) {
      console.log(`[FeatureFlags] Deleted flag: ${flagId}`);
    }
    return deleted;
  }

  async getAllFlags(): Promise<FeatureFlag[]> {
    return Array.from(this.flags.values());
  }

  async getFlag(flagId: string): Promise<FeatureFlag | null> {
    return this.flags.get(flagId) || null;
  }

  async toggleFlag(flagId: string): Promise<boolean> {
    const flag = this.flags.get(flagId);
    if (!flag) {
      return false;
    }

    flag.enabled = !flag.enabled;
    flag.updatedAt = new Date();
    
    console.log(`[FeatureFlags] Toggled flag '${flag.name}' to ${flag.enabled ? 'enabled' : 'disabled'}`);
    return true;
  }

  async setRolloutPercentage(flagId: string, percentage: number): Promise<boolean> {
    const flag = this.flags.get(flagId);
    if (!flag || percentage < 0 || percentage > 100) {
      return false;
    }

    flag.rolloutPercentage = percentage;
    flag.updatedAt = new Date();
    
    console.log(`[FeatureFlags] Set rollout percentage for '${flag.name}' to ${percentage}%`);
    return true;
  }

  private initializeDefaultFlags(): void {
    const defaultFlags = [
      {
        id: 'FEATURE_TRADING',
        name: 'Trading Engine',
        description: 'Enable/disable the trading engine functionality',
        enabled: true,
        rolloutPercentage: 100,
        userGroups: [],
        environments: ['development', 'production'],
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'FEATURE_BACKTEST',
        name: 'Backtesting',
        description: 'Enable/disable backtesting capabilities',
        enabled: true,
        rolloutPercentage: 100,
        userGroups: [],
        environments: ['development', 'production'],
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'FEATURE_AI_COPILOT',
        name: 'AI Copilot',
        description: 'Enable/disable AI Copilot assistant',
        enabled: true,
        rolloutPercentage: 80,
        userGroups: [],
        environments: ['development', 'production'],
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'FEATURE_REVOLUTIONARY_AI',
        name: 'Revolutionary AI Systems',
        description: 'Enable/disable quantum consciousness and advanced AI features',
        enabled: true,
        rolloutPercentage: 100,
        userGroups: ['premium', 'beta'],
        environments: ['development'],
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'FEATURE_ADVANCED_METRICS',
        name: 'Advanced Metrics',
        description: 'Enable/disable advanced metrics and monitoring',
        enabled: true,
        rolloutPercentage: 90,
        userGroups: [],
        environments: ['development', 'production'],
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'FEATURE_REAL_TIME_ALERTS',
        name: 'Real-time Alerts',
        description: 'Enable/disable real-time alert system',
        enabled: true,
        rolloutPercentage: 75,
        userGroups: [],
        environments: ['development', 'production'],
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'FEATURE_DARK_MODE',
        name: 'Dark Mode',
        description: 'Enable/disable dark mode UI',
        enabled: true,
        rolloutPercentage: 100,
        userGroups: [],
        environments: ['development', 'production'],
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'FEATURE_MOBILE_OPTIMIZED',
        name: 'Mobile Optimized UI',
        description: 'Enable/disable mobile-optimized interface',
        enabled: true,
        rolloutPercentage: 85,
        userGroups: [],
        environments: ['development', 'production'],
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    defaultFlags.forEach(flag => {
      this.flags.set(flag.id, flag);
    });

    console.log(`[FeatureFlags] Initialized ${defaultFlags.length} default feature flags`);
  }

  private hashUserId(userId: string, flagId: string): number {
    // Simple hash function for consistent rollout
    const str = `${userId}_${flagId}`;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash) % 100 / 100;
  }
}

export const featureFlagService = new FeatureFlagService();