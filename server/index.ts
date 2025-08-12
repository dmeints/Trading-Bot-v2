import express from "express";
// @ts-ignore - Missing type definitions
import compression from "compression";
import { setupVite, serveStatic } from "./vite";
import { notFoundHandler, errorHandler } from "./utils/errorHandler";
import { registerRoutes } from "./routes";
import { env } from "./config/env";
import { logger } from "./utils/logger";
import { createTradingConformalPredictor } from './brain/conformal';
import stevieCore from './routes/stevieCore';
import metaBrainRouter from './routes/metaBrain';
import scenarioCoverageRouter from './routes/scenarioCoverage';
import conformalTuningRouter from './routes/conformalTuning';

const app = express();

app.use((compression as any)());

// Request ID middleware for tracking
app.use((req: any, res, next) => {
  (req as any).id = Math.random().toString(36).substring(2, 15);
  next();
});

// Logging middleware
const log = (message: string) => {
  console.log(`${new Date().toLocaleTimeString('en-US', { hour12: false })} [express] ${message}`);
};

// Response capture middleware for logging
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: any = null;

  // Capture JSON responses for API endpoints
  if (path.startsWith("/api")) {
    const originalJson = res.json.bind(res);
    res.json = function(data: any) {
      capturedJsonResponse = data;
      return originalJson(data);
    };
  }

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);

      // Also log to structured logger for requests with IDs
      if ((req as any).id) {
        logger.withRequest((req as any).id).info('API Request', {
          method: req.method,
          path,
          statusCode: res.statusCode,
          duration,
          userAgent: req.headers['user-agent'],
          ip: req.ip
        });
      }
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // 404 handler for unknown routes (after frontend routing)
  app.use(notFoundHandler as any);

  // Global error handler
  app.use(errorHandler as any);

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = env.PORT;
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
    log('Server started successfully - AI services will initialize on first request');
  });
})();

// Initialize global conformal predictor for uncertainty quantification
(global as any).conformalPredictor = createTradingConformalPredictor();
logger.info('[Server] Initialized global conformal predictor for uncertainty quantification');

app.use('/api/uncertainty', stevieCore);
app.use('/api/meta-brain', metaBrainRouter);
app.use('/api/scenarios', scenarioCoverageRouter);
app.use('/api/conformal-tuning', conformalTuningRouter);

// Mount other routers
import burninDashboardRouter from './routes/burninDashboard';

// Add burn-in dashboard routes
app.use('/api/burnin-dashboard', burninDashboardRouter);
import safePromotionRouter from './routes/safePromotion';

// Register safe promotion routes
app.use('/api/safe-promotion', safePromotionRouter);
