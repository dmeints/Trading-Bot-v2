import { Request, Response, NextFunction } from 'express';
import { analyticsLogger } from '../services/analyticsLogger';

export interface AdminRequest extends Request {
  isAdmin?: boolean;
}

export function adminAuthGuard(req: AdminRequest, res: Response, next: NextFunction) {
  const adminSecret = process.env.ADMIN_SECRET;
  const providedSecret = req.headers['x-admin-secret'] as string;
  
  if (!adminSecret) {
    analyticsLogger.logError({
      timestamp: new Date().toISOString(),
      level: 'error',
      message: 'ADMIN_SECRET not configured',
      endpoint: req.originalUrl,
    });
    return res.status(500).json({ error: 'admin_not_configured' });
  }
  
  if (!providedSecret || providedSecret !== adminSecret) {
    analyticsLogger.logError({
      timestamp: new Date().toISOString(),
      level: 'warn',
      message: 'Unauthorized admin access attempt',
      endpoint: req.originalUrl,
      metadata: {
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        hasSecret: !!providedSecret,
      },
    });
    return res.status(401).json({ error: 'unauthorized' });
  }
  
  req.isAdmin = true;
  next();
}

export function optionalAdminAuth(req: AdminRequest, res: Response, next: NextFunction) {
  const adminSecret = process.env.ADMIN_SECRET;
  const providedSecret = req.headers['x-admin-secret'] as string;
  
  if (adminSecret && providedSecret === adminSecret) {
    req.isAdmin = true;
  }
  
  next();
}