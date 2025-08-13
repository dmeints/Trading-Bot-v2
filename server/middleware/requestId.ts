import type { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

export function requestId(req: Request, res: Response, next: NextFunction) {
  const incoming = (req.headers['x-request-id'] as string) || randomUUID();
  (req as any).requestId = incoming;
  res.setHeader('x-request-id', incoming);
  next();
}
