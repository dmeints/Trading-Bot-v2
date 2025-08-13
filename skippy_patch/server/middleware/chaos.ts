import type { Request, Response, NextFunction } from "express";
import { env } from "../bootstrap/config";
export function chaos(_req: Request, _res: Response, next: NextFunction) {
  if (process.env.NODE_ENV !== "development") return next();
  if (env.CHAOS_PROB && Math.random() < env.CHAOS_PROB) {
    if (Math.random()<0.5) setTimeout(next, 200 + Math.random()*800);
    else next(new Error("Injected chaos error (dev only)"));
  } else next();
}
