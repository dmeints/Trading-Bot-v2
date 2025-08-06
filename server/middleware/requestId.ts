/**
 * Request ID Middleware
 * 
 * Generates unique request IDs for tracking and logging
 */

import type { Request, Response, NextFunction } from 'express';
import { nanoid } from 'nanoid';

export interface RequestWithId extends Request {
  id: string;
}

export function requestIdMiddleware(req: RequestWithId, res: Response, next: NextFunction) {
  // Use existing x-request-id header or generate new one
  req.id = (req.headers['x-request-id'] as string) || nanoid();
  
  // Set response header for client tracking
  res.setHeader('x-request-id', req.id);
  
  next();
}