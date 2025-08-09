import { Router } from 'express';
import * as metrics from '../services/metrics';
import * as quotes from '../services/quotes';

const r = Router();

r.get('/', async (_req, res)=>{
  // TODO: wire actual checks (DB ping, queues, quotas)
  const status = 'ok' as const;
  const websocket = { status: quotes.isHealthy()? 'ok':'degraded', lastMessageAgoMs: quotes.lastAgeMs() };
  res.json({
    status,
    components: {
      db: 'ok',
      websocket,
      marketData: { binance: 'ok', coingecko: 'ok' },
      apiQuotas: { x:{used:0,limit:100}, reddit:{used:0,limit:800}, etherscan:{used:0,limit:50000}, cryptopanic:{used:0,limit:800} },
      jobs: { queued: 0, running: 0, lastRunIso: new Date().toISOString() }
    },
    metrics: metrics.snapshot()
  });
});

export default r;
