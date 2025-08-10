/**
 * Stevie Strategy Configuration
 * Core trading parameters and risk management settings
 */

export type StevieConfig = {
  // Base risk parameters
  baseRiskPct: number;
  perSymbolCapPct: Record<string, number>;
  newsMaxRiskPct: number;
  
  // Trading costs
  takerBps: number;
  makerRebateBps: number;
  costCapBps: number;
  
  // Signal thresholds
  socialGo: number;
  volPctBreakout: number;
  volPctMeanRevert: number;
  
  // Take profit / Stop loss settings (in basis points)
  tpBreakout: number;
  slBreakout: number;
  tpRevert: number;
  slRevert: number;
  tpNews: number;
  slNews: number;
  
  // Risk controls
  minInterTradeSec: number;
  burstCapPerMin: number;
};

export const defaultStevieConfig: StevieConfig = {
  // Risk management
  baseRiskPct: 0.5,
  perSymbolCapPct: {
    BTCUSDT: 2.0,
    ETHUSDT: 1.5,
    SOLUSDT: 1.2,
    ADAUSDT: 1.0,
    DOTUSDT: 1.0
  },
  newsMaxRiskPct: 0.5,
  
  // Cost structure
  takerBps: 7,
  makerRebateBps: 0,
  costCapBps: 8,
  
  // Signal sensitivity
  socialGo: 0.75,
  volPctBreakout: 70,
  volPctMeanRevert: 40,
  
  // Profit targets (basis points)
  tpBreakout: 10,
  slBreakout: 6,
  tpRevert: 8,
  slRevert: 5,
  tpNews: 12,
  slNews: 8,
  
  // Execution controls
  minInterTradeSec: 20,
  burstCapPerMin: 3
};

/**
 * Apply environment overrides for tuning (STEVIETUNE_* variables)
 */
export function getStevieConfigWithOverrides(): StevieConfig {
  const config = { ...defaultStevieConfig };
  
  // Apply STEVIETUNE_* environment overrides
  const overrides = Object.entries(process.env)
    .filter(([key]) => key.startsWith('STEVIETUNE_'))
    .map(([key, value]) => [key.replace('STEVIETUNE_', ''), value]);
  
  for (const [key, value] of overrides) {
    if (value && key in config) {
      const numValue = parseFloat(value);
      if (!isNaN(numValue)) {
        (config as any)[key] = numValue;
      }
    }
  }
  
  return config;
}