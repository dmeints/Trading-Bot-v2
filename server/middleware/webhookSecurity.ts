import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { analyticsLogger } from '../services/analyticsLogger';

export interface WebhookRequest extends Request {
  rawBody?: Buffer;
  webhookVerified?: boolean;
}

export function createWebhookVerifier(secretKey: string, headerName: string = 'x-signature-256') {
  return (req: WebhookRequest, res: Response, next: NextFunction) => {
    try {
      const signature = req.headers[headerName.toLowerCase()] as string;
      
      if (!signature) {
        analyticsLogger.logError({
          timestamp: new Date().toISOString(),
          level: 'warn',
          message: 'Webhook signature missing',
          endpoint: req.originalUrl,
          metadata: {
            ip: req.ip,
            userAgent: req.headers['user-agent'],
            headerName,
          },
        });
        return res.status(401).json({ error: 'signature_missing' });
      }

      // Get raw body for signature verification
      const rawBody = req.rawBody || Buffer.from(JSON.stringify(req.body));
      
      // Create expected signature
      const expectedSignature = crypto
        .createHmac('sha256', secretKey)
        .update(rawBody)
        .digest('hex');
      
      // Extract signature from header (format: sha256=<signature>)
      const providedSignature = signature.replace('sha256=', '');
      
      // Compare signatures using timing-safe comparison
      const isValid = crypto.timingSafeEqual(
        Buffer.from(expectedSignature, 'hex'),
        Buffer.from(providedSignature, 'hex')
      );
      
      if (!isValid) {
        analyticsLogger.logError({
          timestamp: new Date().toISOString(),
          level: 'warn',
          message: 'Webhook signature verification failed',
          endpoint: req.originalUrl,
          metadata: {
            ip: req.ip,
            userAgent: req.headers['user-agent'],
            expectedLength: expectedSignature.length,
            providedLength: providedSignature.length,
          },
        });
        return res.status(401).json({ error: 'signature_invalid' });
      }

      req.webhookVerified = true;
      analyticsLogger.logAnalyticsEvent({
        timestamp: new Date().toISOString(),
        tradeId: `webhook-${Date.now()}`,
        strategy: 'webhook-verified',
        regime: 'sideways',
        type: 'scalp',
        risk: 'low',
        source: 'webhook-security',
        pnl: 0,
        latencyMs: 0,
        signalStrength: 1.0,
        confidence: 1.0,
        metadata: { endpoint: req.originalUrl },
      });

      next();
    } catch (error) {
      analyticsLogger.logError({
        timestamp: new Date().toISOString(),
        level: 'error',
        message: 'Webhook verification error',
        stack: error instanceof Error ? error.stack : undefined,
        endpoint: req.originalUrl,
        metadata: { error: error instanceof Error ? error.message : 'Unknown error' },
      });
      res.status(500).json({ error: 'verification_failed' });
    }
  };
}

// Middleware to capture raw body for webhook verification
export function captureRawBody(req: WebhookRequest, res: Response, next: NextFunction) {
  if (req.headers['content-type'] === 'application/json') {
    let data = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => data += chunk);
    req.on('end', () => {
      req.rawBody = Buffer.from(data);
      try {
        req.body = JSON.parse(data);
      } catch (error) {
        // Invalid JSON - let it fail in the route handler
      }
      next();
    });
  } else {
    next();
  }
}

// Trading webhook verifier
export const tradingWebhookVerifier = createWebhookVerifier(
  process.env.TRADING_WEBHOOK_SECRET || 'default-webhook-secret',
  'x-trading-signature'
);

// Market data webhook verifier
export const marketDataWebhookVerifier = createWebhookVerifier(
  process.env.MARKET_WEBHOOK_SECRET || 'default-market-secret',
  'x-market-signature'
);

// Generic webhook verifier for third-party integrations
export const genericWebhookVerifier = createWebhookVerifier(
  process.env.GENERIC_WEBHOOK_SECRET || 'default-generic-secret',
  'x-webhook-signature'
);