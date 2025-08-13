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
