import type { Request, Response, NextFunction } from 'express';
import { AppError, toAppError, type ErrorEnvelope } from '../../shared/errors';
import { logger } from '../utils/logger';

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  const appErr: AppError = toAppError(err);
  const status = appErr.toHttp();
  const requestId = (req as any)?.requestId as string | undefined;

  const envelope: ErrorEnvelope = {
    ok: false,
    code: appErr.code,
    message: appErr.expose || process.env.NODE_ENV !== 'production'
      ? appErr.message
      : 'An unexpected error occurred.',
    requestId,
    details: appErr.expose || process.env.NODE_ENV !== 'production' ? appErr.details : undefined,
  };

  logger.error('request_error', { requestId, code: appErr.code, status, msg: appErr.message });

  res.status(status).json(envelope);
}
