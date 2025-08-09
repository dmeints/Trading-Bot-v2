import { Router } from 'express';
import type { OrderRequest, OrderAck, Position, Fill, Account, RiskSettings } from '../src/types/trading.js';
import { logger } from '../utils/logger.js';

const router = Router();

// Mock trading implementation - TODO: integrate with existing paper trading engine
export async function placeOrder(req: OrderRequest): Promise<OrderAck> {
  logger.info('[Trading] Order placement request', { symbol: req.symbol, side: req.side, type: req.type });
  return { orderId: 'sim-' + Date.now(), status: 'accepted' };
}

export async function cancelOrder(orderId: string): Promise<boolean> {
  logger.info('[Trading] Cancel order request', { orderId });
  return true;
}

export async function getPositions(): Promise<Position[]> {
  return [];
}

export async function getFills(limit: number): Promise<Fill[]> {
  return [];
}

export async function getAccount(): Promise<Account> {
  return { equity: 100000, cash: 100000, maintenanceMargin: 0 };
}

// In-memory risk settings - TODO: persist to database
let currentRiskSettings: RiskSettings = { 
  maxPositionSizePct: 25, 
  maxDailyLoss: 5, 
  defaultStopPct: 0.25, 
  defaultTakeProfitPct: 0.5, 
  killSwitch: false 
};

export async function getRisk(): Promise<RiskSettings> {
  return currentRiskSettings;
}

export async function setRisk(settings: RiskSettings): Promise<void> {
  currentRiskSettings = { ...currentRiskSettings, ...settings };
  logger.info('[Trading] Risk settings updated', currentRiskSettings);
}

// Trading API routes
router.post('/orders', async (req, res) => {
  try {
    const ack: OrderAck = await placeOrder(req.body as OrderRequest);
    res.json(ack);
  } catch (e: any) {
    logger.error('[Trading] Order placement failed', { error: e?.message });
    res.status(400).send(e?.message ?? 'order rejected');
  }
});

router.delete('/orders/:orderId', async (req, res) => {
  try {
    const ok = await cancelOrder(req.params.orderId);
    res.json({ orderId: req.params.orderId, status: ok ? 'canceled' : 'not_found' });
  } catch (e: any) {
    logger.error('[Trading] Order cancellation failed', { error: e?.message });
    res.status(400).json({ error: e?.message ?? 'cancel failed' });
  }
});

router.get('/positions', async (_req, res) => {
  try {
    const rows: Position[] = await getPositions();
    res.json(rows);
  } catch (e: any) {
    logger.error('[Trading] Failed to get positions', { error: e?.message });
    res.status(500).json({ error: e?.message ?? 'failed to get positions' });
  }
});

router.get('/fills', async (req, res) => {
  try {
    const limit = Number(req.query.limit ?? 100);
    const rows: Fill[] = await getFills(limit);
    res.json(rows);
  } catch (e: any) {
    logger.error('[Trading] Failed to get fills', { error: e?.message });
    res.status(500).json({ error: e?.message ?? 'failed to get fills' });
  }
});

router.get('/account', async (_req, res) => {
  try {
    const acct: Account = await getAccount();
    res.json(acct);
  } catch (e: any) {
    logger.error('[Trading] Failed to get account', { error: e?.message });
    res.status(500).json({ error: e?.message ?? 'failed to get account' });
  }
});

router.get('/risk', async (_req, res) => {
  try {
    const settings = await getRisk();
    res.json(settings);
  } catch (e: any) {
    logger.error('[Trading] Failed to get risk settings', { error: e?.message });
    res.status(500).json({ error: e?.message ?? 'failed to get risk settings' });
  }
});

router.post('/risk', async (req, res) => {
  try {
    await setRisk(req.body as RiskSettings);
    res.json({ saved: true });
  } catch (e: any) {
    logger.error('[Trading] Failed to save risk settings', { error: e?.message });
    res.status(500).json({ error: e?.message ?? 'failed to save risk settings' });
  }
});

export default router;