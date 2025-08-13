
#!/usr/bin/env bash
set -euo pipefail

echo "==> Adding cross-cutting error handling, logging, and client boundaries"

mkdir -p shared server/middleware server/utils server/bootstrap client/src/components client/src/lib

########################################
# SHARED: Typed errors
########################################
cat > shared/errors.ts <<'TS'
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
TS

########################################
# SERVER: Logger
########################################
cat > server/utils/logger.ts <<'TS'
type Fields = Record<string, unknown>;

function ts() {
  return new Date().toISOString();
}

function line(level: string, msg: string, fields?: Fields) {
  const base = { t: ts(), level, msg, ...fields };
  // Keep it simple and Replit-friendly
  console.log(JSON.stringify(base));
}

export const logger = {
  info: (msg: string, fields?: Fields) => line('info', msg, fields),
  warn: (msg: string, fields?: Fields) => line('warn', msg, fields),
  error: (msg: string, fields?: Fields) => line('error', msg, fields),
};
TS

########################################
# SERVER: Request ID middleware
########################################
cat > server/middleware/requestId.ts <<'TS'
import type { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

export function requestId(req: Request, res: Response, next: NextFunction) {
  const incoming = (req.headers['x-request-id'] as string) || randomUUID();
  (req as any).requestId = incoming;
  res.setHeader('x-request-id', incoming);
  next();
}
TS

########################################
# SERVER: Async handler wrapper
########################################
cat > server/middleware/asyncHandler.ts <<'TS'
import type { Request, Response, NextFunction, RequestHandler } from 'express';

export const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => { fn(req, res, next).catch(next); };
TS

########################################
# SERVER: Not found handler
########################################
cat > server/middleware/notFound.ts <<'TS'
import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../../shared/errors';

export function notFound(_req: Request, _res: Response, next: NextFunction) {
  next(new AppError('NOT_FOUND', 'Route not found', undefined, true));
}
TS

########################################
# SERVER: Error handler
########################################
cat > server/middleware/errorHandler.ts <<'TS'
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
TS

########################################
# SERVER: Boot sanity checks
########################################
cat > server/bootstrap/sanity.ts <<'TS'
import { logger } from '../utils/logger';

export function bootSanityChecks() {
  const required = (process.env.REQUIRED_ENV_VARS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  const missing = required.filter(k => !(k in process.env) || String(process.env[k]).length === 0);

  if (missing.length) {
    logger.warn('missing_env', { missing });
  }

  // Catch common dev-time port reuse issues
  if (process.env.REUSE_PORT === 'true') {
    logger.warn('REUSE_PORT is true; this can cause binding conflicts. Consider disabling in dev.');
  }

  // Global process crash guards
  process.on('unhandledRejection', (reason: any) => {
    logger.error('unhandled_rejection', { reason: String(reason?.message || reason) });
  });

  process.on('uncaughtException', (err) => {
    logger.error('uncaught_exception', { err: String(err?.message || err) });
  });
}
TS

########################################
# CLIENT: ErrorBoundary
########################################
cat > client/src/components/ErrorBoundary.tsx <<'TSX'
import React from 'react';

type Props = { children: React.ReactNode };
type State = { hasError: boolean; message?: string };

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(err: any): State {
    return { hasError: true, message: err?.message || 'Something went wrong' };
  }

  componentDidCatch(error: any, info: any) {
    // Hook: send to server if desired
    console.error('ReactErrorBoundary', { error, info });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 16 }}>
          <h2>Something went wrong</h2>
          <pre style={{ whiteSpace: 'pre-wrap' }}>{this.state.message}</pre>
          <button onClick={() => this.setState({ hasError: false, message: undefined })}>
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
TSX

########################################
# CLIENT: Fetch wrapper
########################################
cat > client/src/lib/api.ts <<'TS'
type ErrorEnvelope = {
  ok: false;
  code: string;
  message: string;
  requestId?: string;
  details?: unknown;
};

export async function apiFetch<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const res = await fetch(input, {
    ...(init || {}),
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });

  const text = await res.text();
  const maybeJson = (() => { try { return JSON.parse(text); } catch { return null; } })();

  if (!res.ok) {
    const err: ErrorEnvelope | null = maybeJson && typeof maybeJson === 'object' ? (maybeJson as any) : null;
    const msg = err?.message || `HTTP ${res.status}`;
    const e = new Error(msg);
    (e as any).server = err;
    throw e;
  }

  return (maybeJson as T) ?? (text as unknown as T);
}
TS

########################################
# SMOKE TEST (simple)
########################################
mkdir -p scripts
cat > scripts/smoke.js <<'JS'
const http = require('http');

function hit(path) {
  return new Promise((resolve) => {
    http.get(`http://localhost:${process.env.PORT||5000}${path}`, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8');
        console.log('GET', path, res.statusCode, body.slice(0, 200));
        resolve();
      });
    }).on('error', (e) => {
      console.error('ERR', path, e.message);
      resolve();
    });
  });
}

(async () => {
  await hit('/api/health');
  await hit('/api/does-not-exist');
})();
JS

echo "==> Auto-Error Kit files installed."

echo "-----------------------------------------------------"
echo "NEXT STEPS:"
echo "1) Wire middlewares in server/index.ts (see instructions below)."
echo "2) Wrap React root with <ErrorBoundary>."
echo "-----------------------------------------------------"
