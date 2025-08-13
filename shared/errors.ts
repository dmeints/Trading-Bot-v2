export type ErrorCode =
  | 'BAD_REQUEST'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'INTERNAL'
  | 'DEPENDENCY_FAILURE'
  | 'VALIDATION_FAILED';

const httpFromCode: Record<ErrorCode, number> = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  VALIDATION_FAILED: 422,
  DEPENDENCY_FAILURE: 502,
  INTERNAL: 500,
};

export class AppError extends Error {
  public code: ErrorCode;
  public details?: unknown;
  public expose: boolean;

  constructor(code: ErrorCode, message: string, details?: unknown, expose = false) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.details = details;
    this.expose = expose;
    Error.captureStackTrace?.(this, AppError);
  }

  toHttp() {
    return httpFromCode[this.code] ?? 500;
  }
}

export function toAppError(err: unknown): AppError {
  if (err instanceof AppError) return err;
  // Zod or validation-like error shape
  if (typeof err === 'object' && err && 'issues' in (err as any)) {
    return new AppError('VALIDATION_FAILED', 'Validation failed', err, true);
  }
  // Generic
  const message = (err as any)?.message ?? 'Internal error';
  return new AppError('INTERNAL', message);
}

export type ErrorEnvelope = {
  ok: false;
  code: ErrorCode;
  message: string;
  requestId?: string;
  details?: unknown; // only when expose=true or in development
};
