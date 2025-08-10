
# Optuna refinement around BEST_* params. Writes artifacts/tuning/optuna_top10.csv
import os, json, math, random, csv, subprocess, time
import optuna

RDB = os.environ.get("OPTUNA_RDB", "sqlite:///artifacts/tuning/stevie_optuna.db")

def run_backtest(params: dict, tag: str):
    env = os.environ.copy()
    env["NO_BACKTEST_NETWORK"] = "1"
    for k,v in params.items():
        env[f"STEVIETUNE_{k}"] = str(v)
    
    # Adjust your CLI if needed:
    cmd = ["npm", "exec", "tsx", "cli/bench.ts", "--strategy", "stevie", "--version", tag, 
           "--symbols", "BTCUSDT,ETHUSDT", "--timeframe", "5m", 
           "--from", os.environ.get("TUNE_FROM", "2024-07-01"), 
           "--to", os.environ.get("TUNE_TO", "2024-07-31"), 
           "--rng-seed", "43"]
    
    r = subprocess.run(cmd, capture_output=True, text=True, env=env)
    out = (r.stdout or "") + (r.stderr or "")
    if r.returncode != 0:
        raise RuntimeError("backtest failed: " + out)
    
    # naive metrics path
    mpath = "artifacts/latest/metrics.json"
    if not os.path.exists(mpath):
        raise RuntimeError("metrics.json missing")
    
    with open(mpath, "r") as f:
        m = json.load(f)
    return m

def constraints(m):
    reasons = []
    pf = m.get("headline", {}).get("profitFactor", 0)
    mdd = m.get("headline", {}).get("maxDrawdownPct", 999)
    slip = m.get("slippage_error_bps", 999)
    tpd = m.get("tradesPerDay", 0)
    
    if pf < 1.2: reasons.append("pf<1.2")
    if mdd > 10: reasons.append("mdd>10%")
    if slip > 5: reasons.append("slippage_err>5bps")
    if tpd < 3 or tpd > 30: reasons.append("trades/day out of [3..30]")
    return reasons

def objective(trial: optuna.Trial):
    # Center around BEST_* if provided
    def around(name, default, lo, hi, step):
        base = float(os.environ.get(f"BEST_{name}", default))
        span = step * 3
        low = max(lo, base - span)
        high = min(hi, base + span)
        
        if step < 0.02:  # continuous-ish
            return trial.suggest_float(name, low, high)
        # discrete
        n = int(round((high - low) / step))
        return trial.suggest_categorical(name, [round(low + i * step, 10) for i in range(n + 1)])

    P = {}
    P["volPctBreakout"]   = around("volPctBreakout",   70, 60, 85, 2)
    P["volPctMeanRevert"] = around("volPctMeanRevert", 35, 25, 45, 2)
    P["socialGo"]         = around("socialGo",        0.8, 0.5, 1.2, 0.05)
    P["costCapBps"]       = around("costCapBps",        8, 5, 12, 1)
    P["tpBreakout"]       = around("tpBreakout",       10, 6, 18, 2)
    P["slBreakout"]       = around("slBreakout",        6, 4, 10, 1)
    P["tpRevert"]         = around("tpRevert",          8, 6, 16, 2)
    P["slRevert"]         = around("slRevert",          5, 4, 10, 1)
    P["tpNews"]           = around("tpNews",           12, 8, 20, 2)
    P["slNews"]           = around("slNews",            8, 6, 12, 1)
    P["minInterTradeSec"] = around("minInterTradeSec", 20, 10, 90, 5)
    P["burstCapPerMin"]   = around("burstCapPerMin",    3, 1, 5, 1)
    P["baseRiskPct"]      = around("baseRiskPct",     0.5, 0.2, 0.8, 0.05)
    P["varianceTargetPct"]= around("varianceTargetPct", 10, 8, 14, 1)
    P["temper"]           = around("temper",         0.5, 0.2, 0.7, 0.05)
    P["newsMaxRiskPct"]   = around("newsMaxRiskPct", 0.5, 0.2, 0.6, 0.05)

    m = run_backtest(P, "optuna")
    bad = constraints(m)
    if bad:
        # Penalize infeasible; large negative objective
        trial.set_user_attr("reasons", "|".join(bad))
        return -1e6
    
    # Objective: cash growth score; add small preference for lower MDD and slippage err
    score = m.get("headline", {}).get("cash_growth_score", 0)
    mdd   = m.get("headline", {}).get("maxDrawdownPct", 0)
    slip  = m.get("slippage_error_bps", 0)
    obj = score - 0.2 * mdd - 0.5 * max(0, slip - 2)  # light regularization
    
    trial.set_user_attr("metrics", m.get("headline", {}))
    return obj

def main():
    storage = RDB
    study = optuna.create_study(direction="maximize", storage=storage, study_name="stevie_v2_1", load_if_exists=True)
    pruner = optuna.pruners.MedianPruner(n_warmup_steps=10)
    study.sampler = optuna.samplers.TPESampler(seed=123)
    
    for _ in range(int(os.environ.get("TRIALS", "80"))):
        study.optimize(objective, n_trials=1, gc_after_trial=True, callbacks=[], catch=(RuntimeError,))
    
    # Export top-10
    trials = sorted([t for t in study.trials if t.value is not None], key=lambda t: t.value, reverse=True)[:10]
    os.makedirs("artifacts/tuning", exist_ok=True)
    
    with open("artifacts/tuning/optuna_top10.csv", "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["value", "params", "reasons", "metrics"])
        for t in trials:
            w.writerow([t.value, json.dumps(t.params), t.user_attrs.get("reasons", ""), json.dumps(t.user_attrs.get("metrics", {}))])
    
    print("WROTE artifacts/tuning/optuna_top10.csv")

if __name__ == "__main__":
    main()
# Optuna refinement around BEST_* params. Writes artifacts/tuning/optuna_top10.csv
import os, json, math, random, csv, subprocess, time
import optuna

RDB = os.environ.get("OPTUNA_RDB", "sqlite:///artifacts/tuning/stevie_optuna.db")

def run_backtest(params: dict, tag: str):
    env = os.environ.copy()
    env["NO_BACKTEST_NETWORK"] = "1"
    for k,v in params.items():
        env[f"STEVIETUNE_{k}"] = str(v)
    
    # Adjust your CLI if needed:
    cmd = ["npm", "exec", "tsx", "cli/bench.ts", "--strategy", "stevie", "--version", tag, 
           "--symbols", "BTCUSDT,ETHUSDT", "--timeframe", "5m", 
           "--from", os.environ.get("TUNE_FROM", "2024-07-01"), 
           "--to", os.environ.get("TUNE_TO", "2024-07-31"), 
           "--rng-seed", "43"]
    
    r = subprocess.run(cmd, capture_output=True, text=True, env=env)
    out = (r.stdout or "") + (r.stderr or "")
    if r.returncode != 0:
        raise RuntimeError("backtest failed: " + out)
    
    # naive metrics path
    mpath = "artifacts/latest/metrics.json"
    if not os.path.exists(mpath):
        raise RuntimeError("metrics.json missing")
    
    with open(mpath, "r") as f:
        m = json.load(f)
    return m

def constraints(m):
    reasons = []
    pf = m.get("headline", {}).get("profitFactor", 0)
    mdd = m.get("headline", {}).get("maxDrawdownPct", 999)
    slip = m.get("slippage_error_bps", 999)
    tpd = m.get("tradesPerDay", 0)
    if pf < 1.2: reasons.append("pf<1.2")
    if mdd > 10: reasons.append("mdd>10%")
    if slip > 5: reasons.append("slippage_err>5bps")
    if tpd < 3 or tpd > 30: reasons.append("trades/day out of [3..30]")
    return reasons

def objective(trial: optuna.Trial):
    # Center around BEST_* if provided
    def around(name, default, lo, hi, step):
        base = float(os.environ.get(f"BEST_{name}", default))
        span = step * 3
        low = max(lo, base - span); high = min(hi, base + span)
        if step < 0.02:  # continuous-ish
            return trial.suggest_float(name, low, high)
        # discrete
        n = int(round((high - low)/step))
        return trial.suggest_categorical(name, [round(low + i*step, 10) for i in range(n+1)])

    P = {}
    P["volPctBreakout"]   = around("volPctBreakout",   70, 60, 85, 2)
    P["volPctMeanRevert"] = around("volPctMeanRevert", 35, 25, 45, 2)
    P["socialGo"]         = around("socialGo",        0.8, 0.5, 1.2, 0.05)
    P["costCapBps"]       = around("costCapBps",        8, 5, 12, 1)
    P["tpBreakout"]       = around("tpBreakout",       10, 6, 18, 2)
    P["slBreakout"]       = around("slBreakout",        6, 4, 10, 1)
    P["tpRevert"]         = around("tpRevert",          8, 6, 16, 2)
    P["slRevert"]         = around("slRevert",          5, 4, 10, 1)
    P["tpNews"]           = around("tpNews",           12, 8, 20, 2)
    P["slNews"]           = around("slNews",            8, 6, 12, 1)
    P["minInterTradeSec"] = around("minInterTradeSec", 20,10,90,5)
    P["burstCapPerMin"]   = around("burstCapPerMin",    3, 1, 5, 1)
    P["baseRiskPct"]      = around("baseRiskPct",     0.5,0.2,0.8,0.05)
    P["varianceTargetPct"]= around("varianceTargetPct",10, 8,14,1)
    P["temper"]           = around("temper",         0.5,0.2,0.7,0.05)
    P["newsMaxRiskPct"]   = around("newsMaxRiskPct", 0.5,0.2,0.6,0.05)

    m = run_backtest(P, "optuna")
    bad = constraints(m)
    if bad:
        # Penalize infeasible; large negative objective
        trial.set_user_attr("reasons", "|".join(bad))
        return -1e6
    # Objective: cash growth score; add small preference for lower MDD and slippage err
    score = m.get("headline", {}).get("cash_growth_score", 0)
    mdd   = m.get("headline", {}).get("maxDrawdownPct", 0)
    slip  = m.get("slippage_error_bps", 0)
    obj = score - 0.2*mdd - 0.5*max(0, slip-2)  # light regularization
    trial.set_user_attr("metrics", m.get("headline", {}))
    return obj

def main():
    storage = RDB
    study = optuna.create_study(direction="maximize", storage=storage, study_name="stevie_v2_1", load_if_exists=True)
    pruner = optuna.pruners.MedianPruner(n_warmup_steps=10)
    study.sampler = optuna.samplers.TPESampler(seed=123)
    for _ in range(int(os.environ.get("TRIALS", "80"))):
        study.optimize(objective, n_trials=1, gc_after_trial=True, callbacks=[], catch=(RuntimeError,))
    # Export top-10
    trials = sorted([t for t in study.trials if t.value is not None], key=lambda t: t.value, reverse=True)[:10]
    os.makedirs("artifacts/tuning", exist_ok=True)
    with open("artifacts/tuning/optuna_top10.csv", "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["value", "params", "reasons", "metrics"])
        for t in trials:
            w.writerow([t.value, json.dumps(t.params), t.user_attrs.get("reasons", ""), json.dumps(t.user_attrs.get("metrics", {}))])
    print("WROTE artifacts/tuning/optuna_top10.csv")

if __name__ == "__main__":
    main()
