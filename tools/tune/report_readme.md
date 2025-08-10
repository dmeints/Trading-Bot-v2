
# Stevie Hyperparameter Tuning Report

## Overview
This directory contains the results of Stevie's hyperparameter optimization using Optuna with walk-forward validation and stress testing.

## Files Generated

### Core Results
- `coarse_results.csv` - Coarse grid search results (120 random samples)
- `optuna_top10.csv` - Top 10 configurations from Optuna refinement
- `stevie.config.candidate.json` - Pareto-optimal configuration selected
- `walkforward_stress.csv` - Walk-forward validation and stress test results

### Analysis
- `stevie_optuna.db` - Optuna study database (SQLite)

## Methodology

### 1. Coarse Search
- Random sampling across 16-dimensional parameter space
- 120 configurations tested
- Constraints: PF ≥ 1.2, MDD ≤ 10%, slippage error ≤ 5 bps, 3-30 trades/day

### 2. Optuna Refinement  
- TPE sampler centered around best coarse result
- 80 trials (configurable via TRIALS env var)
- Median pruner for early stopping
- Multi-objective optimization (score↑, MDD↓, slippage↓)

### 3. Walk-Forward Validation
- 3 time windows: W1, W2, W3
- Train/Validate/Test split
- Stress scenarios: fees+25%, slip+25%, weekend, news

### 4. Pareto Selection
- Pareto frontier across 4 objectives
- Best score-optimized configuration selected

## Best Configuration

See `stevie.config.candidate.json` for the selected parameters.

## Usage

```bash
# Run full tuning pipeline
npm run tune:all

# Individual components
npm run tune:coarse
TRIALS=100 npm run tune:optuna
npm exec tsx tools/tune/select_and_emit.ts
npm exec tsx tools/tune/walkforward_and_stress.ts
```

## Constraints Verification

All selected configurations must pass:
- Profit Factor ≥ 1.2
- Maximum Drawdown ≤ 10%
- Slippage Error ≤ 5 bps  
- Trades per day: 3-30
