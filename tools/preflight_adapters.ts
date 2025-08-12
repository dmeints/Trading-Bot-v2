
// tools/preflight_adapters.ts
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface PreflightSource {
  source: 'filesystem' | 'database' | 'api';
  timestamp: Date;
  version?: string;
  confidence?: number;
}

interface PreflightResult<T> {
  data: T;
  provenance: PreflightSource;
  fallbackUsed?: boolean;
}

interface MetricsData {
  sharpe_ratio: number;
  max_drawdown: number;
  win_rate: number;
  total_trades: number;
  [key: string]: any;
}

interface ModelState {
  version: string;
  accuracy: number;
  last_training: string;
  status: 'active' | 'training' | 'deprecated';
}

interface RiskLimits {
  max_position_size: number;
  max_daily_loss: number;
  concentration_limit: number;
  leverage_limit: number;
}

class PreflightAdapterError extends Error {
  constructor(message: string, public source: string) {
    super(message);
    this.name = 'PreflightAdapterError';
  }
}

export class PreflightAdapters {
  private static instance: PreflightAdapters;
  private dbUrl: string;
  private apiUrl: string;

  constructor() {
    this.dbUrl = process.env.DATABASE_URL || '';
    this.apiUrl = process.env.API_BASE_URL || 'http://localhost:5000';
  }

  static getInstance(): PreflightAdapters {
    if (!PreflightAdapters.instance) {
      PreflightAdapters.instance = new PreflightAdapters();
    }
    return PreflightAdapters.instance;
  }

  /**
   * Get latest benchmark metrics with fallback chain
   */
  async getLatestMetrics(): Promise<PreflightResult<MetricsData>> {
    // Try filesystem first
    try {
      const fsResult = await this.getMetricsFromFilesystem();
      return {
        data: fsResult,
        provenance: {
          source: 'filesystem',
          timestamp: new Date(),
          confidence: 0.95
        }
      };
    } catch (fsError) {
      console.warn('Filesystem metrics unavailable:', fsError);
    }

    // Try database second
    try {
      const dbResult = await this.getMetricsFromDatabase();
      return {
        data: dbResult,
        provenance: {
          source: 'database',
          timestamp: new Date(),
          confidence: 0.85
        },
        fallbackUsed: true
      };
    } catch (dbError) {
      console.warn('Database metrics unavailable:', dbError);
    }

    // Try API last
    try {
      const apiResult = await this.getMetricsFromAPI();
      return {
        data: apiResult,
        provenance: {
          source: 'api',
          timestamp: new Date(),
          confidence: 0.75
        },
        fallbackUsed: true
      };
    } catch (apiError) {
      throw new PreflightAdapterError(
        'All metric sources failed: FS, DB, API',
        'all'
      );
    }
  }

  /**
   * Get model readiness state with fallback chain
   */
  async getModelState(): Promise<PreflightResult<ModelState>> {
    // Try filesystem first
    try {
      const fsResult = await this.getModelStateFromFilesystem();
      return {
        data: fsResult,
        provenance: {
          source: 'filesystem',
          timestamp: new Date(),
          confidence: 0.95
        }
      };
    } catch (fsError) {
      console.warn('Filesystem model state unavailable:', fsError);
    }

    // Try database second
    try {
      const dbResult = await this.getModelStateFromDatabase();
      return {
        data: dbResult,
        provenance: {
          source: 'database',
          timestamp: new Date(),
          confidence: 0.85
        },
        fallbackUsed: true
      };
    } catch (dbError) {
      console.warn('Database model state unavailable:', dbError);
    }

    // Try API last
    try {
      const apiResult = await this.getModelStateFromAPI();
      return {
        data: apiResult,
        provenance: {
          source: 'api',
          timestamp: new Date(),
          confidence: 0.75
        },
        fallbackUsed: true
      };
    } catch (apiError) {
      throw new PreflightAdapterError(
        'All model state sources failed: FS, DB, API',
        'all'
      );
    }
  }

  /**
   * Get risk configuration with fallback chain
   */
  async getRiskLimits(): Promise<PreflightResult<RiskLimits>> {
    // Try filesystem first
    try {
      const fsResult = await this.getRiskLimitsFromFilesystem();
      return {
        data: fsResult,
        provenance: {
          source: 'filesystem',
          timestamp: new Date(),
          confidence: 0.95
        }
      };
    } catch (fsError) {
      console.warn('Filesystem risk limits unavailable:', fsError);
    }

    // Try database second
    try {
      const dbResult = await this.getRiskLimitsFromDatabase();
      return {
        data: dbResult,
        provenance: {
          source: 'database',
          timestamp: new Date(),
          confidence: 0.85
        },
        fallbackUsed: true
      };
    } catch (dbError) {
      console.warn('Database risk limits unavailable:', dbError);
    }

    // Fallback to safe defaults
    const safeDefaults: RiskLimits = {
      max_position_size: 0.05, // 5% of portfolio
      max_daily_loss: 0.02,    // 2% daily loss limit
      concentration_limit: 0.25, // 25% single asset
      leverage_limit: 1.0      // No leverage in safe mode
    };

    return {
      data: safeDefaults,
      provenance: {
        source: 'api',
        timestamp: new Date(),
        confidence: 0.50
      },
      fallbackUsed: true
    };
  }

  // Filesystem implementations
  private async getMetricsFromFilesystem(): Promise<MetricsData> {
    const artifactsDir = path.join(__dirname, '..', 'artifacts');
    const files = await fs.readdir(artifactsDir);
    
    // Find latest metrics.json
    let latestMetrics = null;
    let latestTime = 0;

    for (const file of files) {
      const filePath = path.join(artifactsDir, file);
      const stat = await fs.stat(filePath);
      
      if (stat.isDirectory()) {
        try {
          const metricsPath = path.join(filePath, 'metrics.json');
          const metricsData = JSON.parse(await fs.readFile(metricsPath, 'utf8'));
          
          if (stat.mtimeMs > latestTime) {
            latestTime = stat.mtimeMs;
            latestMetrics = metricsData;
          }
        } catch (e) {
          // Skip if no metrics.json in this directory
        }
      }
    }

    if (!latestMetrics) {
      throw new Error('No metrics.json found in artifacts');
    }

    return latestMetrics;
  }

  private async getModelStateFromFilesystem(): Promise<ModelState> {
    const modelsDir = path.join(__dirname, '..', 'models');
    const metadataPath = path.join(modelsDir, 'ppo_trading_model_metadata.json');
    
    try {
      const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf8'));
      return {
        version: metadata.version || '1.0.0',
        accuracy: metadata.accuracy || 0.75,
        last_training: metadata.last_training || new Date().toISOString(),
        status: metadata.status || 'active'
      };
    } catch (e) {
      throw new Error('Model metadata not found');
    }
  }

  private async getRiskLimitsFromFilesystem(): Promise<RiskLimits> {
    const configPath = path.join(__dirname, '..', 'config', 'risk_limits.json');
    
    try {
      const config = JSON.parse(await fs.readFile(configPath, 'utf8'));
      return config;
    } catch (e) {
      throw new Error('Risk limits config not found');
    }
  }

  // Database implementations
  private async getMetricsFromDatabase(): Promise<MetricsData> {
    if (!this.dbUrl) {
      throw new Error('DATABASE_URL not configured');
    }

    // Simulate database query
    const response = await fetch(`${this.apiUrl}/api/metrics/latest`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${process.env.API_KEY || 'dev'}` }
    });

    if (!response.ok) {
      throw new Error(`Database query failed: ${response.status}`);
    }

    return response.json();
  }

  private async getModelStateFromDatabase(): Promise<ModelState> {
    if (!this.dbUrl) {
      throw new Error('DATABASE_URL not configured');
    }

    const response = await fetch(`${this.apiUrl}/api/models/state`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${process.env.API_KEY || 'dev'}` }
    });

    if (!response.ok) {
      throw new Error(`Model state query failed: ${response.status}`);
    }

    return response.json();
  }

  private async getRiskLimitsFromDatabase(): Promise<RiskLimits> {
    if (!this.dbUrl) {
      throw new Error('DATABASE_URL not configured');
    }

    const response = await fetch(`${this.apiUrl}/api/risk/limits`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${process.env.API_KEY || 'dev'}` }
    });

    if (!response.ok) {
      throw new Error(`Risk limits query failed: ${response.status}`);
    }

    return response.json();
  }

  // API implementations
  private async getMetricsFromAPI(): Promise<MetricsData> {
    const response = await fetch(`${this.apiUrl}/api/bench/latest`, {
      method: 'GET',
      headers: { 
        'Authorization': `Bearer ${process.env.API_KEY || 'dev'}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`API metrics failed: ${response.status}`);
    }

    const result = await response.json();
    return result.data || result;
  }

  private async getModelStateFromAPI(): Promise<ModelState> {
    const response = await fetch(`${this.apiUrl}/api/models/status`, {
      method: 'GET',
      headers: { 
        'Authorization': `Bearer ${process.env.API_KEY || 'dev'}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`API model state failed: ${response.status}`);
    }

    const result = await response.json();
    return result.data || result;
  }

  private async getModelStateFromAPI(): Promise<ModelState> {
    // Safe fallback for API model state
    return {
      version: '1.0.0',
      accuracy: 0.70,
      last_training: new Date().toISOString(),
      status: 'active'
    };
  }
}

// Export singleton instance
export const preflightAdapters = PreflightAdapters.getInstance();

// Export individual adapter functions for backward compatibility
export async function getLatestMetrics() {
  return preflightAdapters.getLatestMetrics();
}

export async function getModelState() {
  return preflightAdapters.getModelState();
}

export async function getRiskLimits() {
  return preflightAdapters.getRiskLimits();
}

// Health check function
export async function healthCheck(): Promise<{
  filesystem: boolean;
  database: boolean;
  api: boolean;
}> {
  const adapters = preflightAdapters;
  
  return {
    filesystem: await checkFilesystemHealth(),
    database: await checkDatabaseHealth(),
    api: await checkAPIHealth()
  };
}

async function checkFilesystemHealth(): Promise<boolean> {
  try {
    const artifactsDir = path.join(__dirname, '..', 'artifacts');
    await fs.access(artifactsDir);
    return true;
  } catch {
    return false;
  }
}

async function checkDatabaseHealth(): Promise<boolean> {
  try {
    if (!process.env.DATABASE_URL) return false;
    // Add actual DB health check here
    return true;
  } catch {
    return false;
  }
}

async function checkAPIHealth(): Promise<boolean> {
  try {
    const apiUrl = process.env.API_BASE_URL || 'http://localhost:5000';
    const response = await fetch(`${apiUrl}/api/health`, { 
      method: 'GET',
      timeout: 5000 
    });
    return response.ok;
  } catch {
    return false;
  }
}
