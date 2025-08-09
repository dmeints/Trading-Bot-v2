import { Router } from 'express';
import type { OrderRequest, OrderAck, Position, Fill, Account, RiskSettings } from '../types/trading';
import * as execution from '../services/execution';
import * as risk from '../services/risk';

const r = Router();

r.post('/orders', async (req, res) => {
  try {
    const ack: OrderAck = await execution.placeOrder(req.body as OrderRequest);
    res.json(ack);
  } catch (e:any) {
    res.status(400).send(e?.message ?? 'order rejected');
  }
});

r.delete('/orders/:orderId', async (req, res) => {
  const ok = await execution.cancelOrder(req.params.orderId);
  res.json({ orderId: req.params.orderId, status: ok? 'canceled':'not_found' });
});

r.get('/positions', async (_req, res) => {
  const rows: Position[] = await execution.getPositions();
  res.json(rows);
});

r.get('/fills', async (req, res) => {
  const limit = Number(req.query.limit ?? 100);
  const rows: Fill[] = await execution.getFills(limit);
  res.json(rows);
});

r.get('/account', async (_req, res) => {
  const acct: Account = await execution.getAccount();
  res.json(acct);
});

r.get('/risk', async (_req, res)=>{ res.json(await risk.getRisk()); });

r.post('/risk', async (req, res)=>{ await risk.setRisk(req.body as RiskSettings); res.json({ saved: true }); });

export default r;
