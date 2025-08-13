# Skippy SLO & Safe Mode Runbook
- SLO window: 1 minute rolling, error-rate > 2% => breach.
- Observe /metrics histograms and counters.
- /api/health returns `sloBreached` indicator.
- Consider SAFE_MODE=true to suspend risky ops when breached.
- CHAOS_PROB>0 in dev to reproduce issues locally.
