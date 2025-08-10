
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
# Stevie v2.1 Hyperparameter Optimization Report

## Top-10 Optuna Results

Best configurations from TPE sampling around the coarse grid winner:

| Value | Params | Metrics |
|-------|--------|---------|
| (See optuna_top10.csv for full table) |

## Pareto Front Summary

Multi-objective optimization results (score↑, MDD↓, slipErr↓, PF↑):

- **Pareto frontier size**: {paretoSize} configurations  
- **Selected candidate**: Highest score with feasible constraints
- **Key metrics**: Score {score}, Sharpe {sharpe}, PF {pf}, MDD {mdd}%

## Best Candidate Parameters

```json
{candidateParams}
```

## Walk-Forward Validation

Time series cross-validation across 3 windows with stress testing:

- **Base performance**: See walkforward_stress.csv
- **Stress scenarios**: fees+25%, slip+25%, weekend, news
- **Stability check**: Consistent performance across time windows

## Files Generated

- `artifacts/tuning/coarse_results.csv` - Grid search results  
- `artifacts/tuning/optuna_top10.csv` - Bayesian optimization winners
- `artifacts/tuning/stevie.config.candidate.json` - Selected configuration
- `artifacts/tuning/walkforward_stress.csv` - Validation results

## Next Steps

Run the verification loop:
```bash
npm run tune:verify
```

If all gates pass, promote candidate to production via existing promotion gate.
