import type { Request, Response } from "express";
import { env } from "../bootstrap/config";
import { isErrorBudgetBreached } from "../observability/metrics";

export function health(req: Request, res: Response) {
  res.json({ ok: true, ts: Date.now(), safeMode: !!env.SAFE_MODE, sloBreached: isErrorBudgetBreached() });
}

export function ready(_req: Request, res: Response) {
  res.json({ ok: true, ts: Date.now() });
}
