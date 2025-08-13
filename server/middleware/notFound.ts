import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../../shared/errors';

export function notFound(_req: Request, _res: Response, next: NextFunction) {
  next(new AppError('NOT_FOUND', 'Route not found', undefined, true));
}
