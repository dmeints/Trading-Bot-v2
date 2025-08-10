export type StevieConfig = {
  // risk & sizing
  baseRiskPct: number;            // % of equity per trade before tier scaling
  perSymbolCapPct: Record<string, number>;
  newsMaxRiskPct: number;

  // costs/limits
  takerBps: number;               // exchange taker fee (bps)
  makerRebateBps: number;         // maker rebate (bps, use 0 if none)
  costCapBps: number;             // max expected slippage bps allowed

  // router thresholds
  socialGo: number;               // min delta to treat as "go" on social
  volPctBreakout: number;         // > → breakout
  volPctMeanRevert: number;       // < → mean-revert

  // brackets (bps)
  tpBreakout: number; slBreakout: number;
  tpRevert: number;   slRevert: number;
  tpNews: number;     slNews: number;

  // cooldowns
  minInterTradeSec: number;       // per symbol
  burstCapPerMin: number;
};

export const defaultStevieConfig: StevieConfig = {
  baseRiskPct: 0.5,
  perSymbolCapPct: { BTCUSDT: 2.0, ETHUSDT: 1.5, SOLUSDT: 1.2 },
  newsMaxRiskPct: 0.5,

  takerBps: 7,                    // adjust to venue
  makerRebateBps: 0,
  costCapBps: 8,                  // block if expected slippage > 8 bps

  socialGo: 0.75,                 // z-scored delta threshold
  volPctBreakout: 70,
  volPctMeanRevert: 40,

  tpBreakout: 10, slBreakout: 6,
  tpRevert: 8,   slRevert: 5,
  tpNews: 12,    slNews: 8,

  minInterTradeSec: 20,
  burstCapPerMin: 3,
};