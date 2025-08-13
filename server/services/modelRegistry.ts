
export interface ModelVersion {
  id: string;
  version: string;
  timestamp: Date;
  performance: Record<string, number>;
  active: boolean;
}

export class ModelRegistry {
  getCurrentVersion(): ModelVersion {
    return {
      id: 'baseline',
      version: '1.0.0',
      timestamp: new Date(),
      performance: { sharpe: 1.2, returns: 0.15 },
      active: true
    };
  }

  rollback(version: string): boolean {
    return true;
  }
}

export const modelRegistry = new ModelRegistry();
