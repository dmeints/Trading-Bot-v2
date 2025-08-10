/**
 * Stevie Strategy Configuration
 * Core configuration for the Stevie trading algorithm
 */

export type StevieConfig = {
  baseRiskPct: number;
  perSymbolCapPct: Record<string, number>;
  newsMaxRiskPct: number;
  takerBps: number; 
  makerRebateBps: number; 
  costCapBps: number;
  socialGo: number; 
  volPctBreakout: number; 
  volPctMeanRevert: number;
  tpBreakout: number; 
  slBreakout: number; 
  tpRevert: number; 
  slRevert: number; 
  tpNews: number; 
  slNews: number;
  minInterTradeSec: number; 
  burstCapPerMin: number;
};

export const defaultStevieConfig: StevieConfig = {
  baseRiskPct: 0.5, 
  perSymbolCapPct: { BTCUSDT: 2.0, ETHUSDT: 1.5, SOLUSDT: 1.2 }, 
  newsMaxRiskPct: 0.5,
  takerBps: 7, 
  makerRebateBps: 0, 
  costCapBps: 8,
  socialGo: 0.75, 
  volPctBreakout: 70, 
  volPctMeanRevert: 40,
  tpBreakout: 10, 
  slBreakout: 6, 
  tpRevert: 8, 
  slRevert: 5, 
  tpNews: 12, 
  slNews: 8,
  minInterTradeSec: 20, 
  burstCapPerMin: 3
};