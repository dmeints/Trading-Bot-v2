import type { Request, Response, NextFunction } from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { env } from "../bootstrap/config";

export function securityChain() {
  const limiter = rateLimit({
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    max: env.RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
  });
  return [helmet(), cors(), limiter] as unknown as ((req:Request,res:Response,next:NextFunction)=>void)[];
}
