/**
 * Admin Authentication Middleware
 * 
 * Validates admin access using ADMIN_SECRET environment variable
 */

import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';
import { logger } from '../utils/logger';

export interface any extends Request {
  isAdmin?: boolean;
}

export function adminAuth(req: any, res: Response, next: NextFunction): void {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      logger.warn('Admin route accessed without authorization header', {
        path: req.path,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      
      res.status(401).json({
        success: false,
        error: 'Authorization required',
        message: 'Admin access requires authorization header'
      });
      return;
    }

    const [scheme, token] = authHeader.split(' ');
    
    if (scheme !== 'Bearer') {
      res.status(401).json({
        success: false,
        error: 'Invalid authorization scheme',
        message: 'Use Bearer token authorization'
      });
      return;
    }

    if (!token) {
      res.status(401).json({
        success: false,
        error: 'Missing token',
        message: 'Authorization token required'
      });
      return;
    }

    // Validate admin token
    if (token !== env.ADMIN_SECRET) {
      logger.warn('Invalid admin token used', {
        path: req.path,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      
      res.status(403).json({
        success: false,
        error: 'Invalid admin token',
        message: 'Access denied'
      });
      return;
    }

    // Add admin flag to request
    req.isAdmin = true;
    
    logger.info('Admin access granted', {
      path: req.path,
      ip: req.ip
    });
    
    next();

  } catch (error) {
    logger.error('Admin authentication error', { 
      error: error instanceof Error ? error.message : String(error),
      path: req.path 
    });
    
    res.status(500).json({
      success: false,
      error: 'Authentication system error'
    });
  }
}