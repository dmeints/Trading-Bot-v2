import type { RiskSettings } from '../types/trading';
let current: RiskSettings = { maxPositionSizePct: 25, maxDailyLoss: 5, defaultStopPct: 0.25, defaultTakeProfitPct: 0.5, killSwitch: false };
export async function getRisk(){ return current; }
export async function setRisk(next: RiskSettings){ current = { ...current, ...next }; }
