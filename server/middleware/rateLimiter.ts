/**
 * Advanced Rate Limiting System
 * Rate Limiting Middleware
 * Protects API endpoints from abuse and ensures system stability
 */

import rateLimit from 'express-rate-limit';

// Default rate limit: 100 requests per 15 minutes
export const defaultRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    error: "Too many requests from this IP, please try again later.",
    retryAfter: "15 minutes"
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// Strict rate limit for AI/ML intensive endpoints: 20 requests per 15 minutes
export const aiRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // limit each IP to 20 requests per windowMs
  message: {
    error: "Too many AI requests from this IP, please try again later.",
    retryAfter: "15 minutes"
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Admin rate limit: 1000 requests per 15 minutes
export const adminRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 1000 requests per windowMs
  message: {
    error: "Too many admin requests from this IP, please try again later.",
    retryAfter: "15 minutes"
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Features rate limit: 50 requests per 15 minutes
export const featuresRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // limit each IP to 50 requests per windowMs
  message: {
    error: "Too many feature requests from this IP, please try again later.",
    retryAfter: "15 minutes"
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Trading rate limit: 30 requests per minute
export const tradingRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // limit each IP to 30 requests per minute
  message: {
    error: "Too many trading requests from this IP, please try again later.",
    retryAfter: "1 minute"
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// WebSocket rate limit: 100 requests per minute
export const wsRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // limit each IP to 100 requests per minute
  message: {
    error: "Too many WebSocket requests from this IP, please try again later.",
    retryAfter: "1 minute"
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Webhook rate limit: 200 requests per 15 minutes
export const webhookRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // limit each IP to 200 requests per windowMs
  message: {
    error: "Too many webhook requests from this IP, please try again later.",
    retryAfter: "15 minutes"
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Auth rate limit: 10 requests per 5 minutes
export const authRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10, // limit each IP to 10 requests per windowMs
  message: {
    error: "Too many authentication attempts from this IP, please try again later.",
    retryAfter: "5 minutes"
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Strict rate limit for sensitive operations: 5 requests per 15 minutes
export const strictRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  message: {
    error: "Too many sensitive requests from this IP, please try again later.",
    retryAfter: "15 minutes"
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Collect all rate limiters for export
export const rateLimiters = {
  default: defaultRateLimit,
  general: defaultRateLimit,
  ai: aiRateLimit,
  admin: adminRateLimit,
  features: featuresRateLimit,
  trading: tradingRateLimit,
  ws: wsRateLimit,
  websocket: wsRateLimit,
  webhook: webhookRateLimit,
  auth: authRateLimit,
  strict: strictRateLimit
};

export default rateLimiters;