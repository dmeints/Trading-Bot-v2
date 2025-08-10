/**
 * Default Stevie Configuration
 * Core algorithmic trading parameters for decision engine
 */

export interface StevieConfig {
  // Risk management
  maxPositionPct: number;       // Max position size as % of portfolio
  stopLossPct: number;          // Stop loss percentage
  takeProfitPct: number;        // Take profit percentage
  
  // Signal thresholds
  trendThreshold: number;       // Minimum trend strength to enter
  volatilityThreshold: number;  // Maximum volatility to enter
  volumeThreshold: number;      // Minimum volume confirmation
  
  // Feature weights
  technicalWeight: number;      // Weight for technical indicators
  sentimentWeight: number;      // Weight for social sentiment
  onchainWeight: number;        // Weight for on-chain metrics
  macroWeight: number;          // Weight for macro events
  
  // Trading parameters
  minHoldTimeMs: number;        // Minimum hold time
  maxHoldTimeMs: number;        // Maximum hold time
  slippageTolerance: number;    // Slippage tolerance in bps
  
  // Regime adaptation
  volatilityLookback: number;   // Periods for volatility calculation
  trendLookback: number;        // Periods for trend calculation
}

export const defaultStevieConfig: StevieConfig = {
  // Risk management
  maxPositionPct: 10,           // 10% max position
  stopLossPct: 2,               // 2% stop loss
  takeProfitPct: 6,             // 6% take profit
  
  // Signal thresholds
  trendThreshold: 0.3,          // 30% trend strength minimum
  volatilityThreshold: 50,      // 50% volatility maximum
  volumeThreshold: 1000,        // Minimum volume
  
  // Feature weights (must sum to 1.0)
  technicalWeight: 0.4,         // 40% technical
  sentimentWeight: 0.2,         // 20% sentiment
  onchainWeight: 0.2,           // 20% on-chain
  macroWeight: 0.2,             // 20% macro
  
  // Trading parameters
  minHoldTimeMs: 15 * 60 * 1000, // 15 minutes minimum
  maxHoldTimeMs: 24 * 60 * 60 * 1000, // 24 hours maximum
  slippageTolerance: 10,        // 10 bps slippage tolerance
  
  // Regime adaptation
  volatilityLookback: 20,       // 20 periods
  trendLookback: 14             // 14 periods (ADX standard)
};

// Alternative configurations for different market regimes
export const conservativeConfig: StevieConfig = {
  ...defaultStevieConfig,
  maxPositionPct: 5,            // Smaller positions
  stopLossPct: 1.5,             // Tighter stop loss
  takeProfitPct: 3,             // Lower take profit
  volatilityThreshold: 30,      // Lower volatility tolerance
  minHoldTimeMs: 30 * 60 * 1000 // Longer minimum hold
};

export const aggressiveConfig: StevieConfig = {
  ...defaultStevieConfig,
  maxPositionPct: 20,           // Larger positions
  stopLossPct: 3,               // Wider stop loss
  takeProfitPct: 10,            // Higher take profit
  volatilityThreshold: 80,      // Higher volatility tolerance
  minHoldTimeMs: 5 * 60 * 1000  // Shorter minimum hold
};

export const scalperConfig: StevieConfig = {
  ...defaultStevieConfig,
  maxPositionPct: 15,           // Medium positions
  stopLossPct: 0.5,             // Very tight stop loss
  takeProfitPct: 1.5,           // Quick take profit
  technicalWeight: 0.8,         // Heavy technical focus
  sentimentWeight: 0.1,         // Less sentiment weight
  onchainWeight: 0.05,          // Minimal on-chain
  macroWeight: 0.05,            // Minimal macro
  minHoldTimeMs: 60 * 1000,     // 1 minute minimum
  maxHoldTimeMs: 60 * 60 * 1000 // 1 hour maximum
};