import express from "express";
// @ts-ignore - Missing type definitions
import compression from "compression";
import { requestId } from "./middleware/requestId.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { notFound } from "./middleware/notFound.js";
import { bootSanityChecks } from "./bootstrap/sanity.js";
import { setupVite, serveStatic } from "./vite.js";
import { logger } from "./utils/logger.js";
import { createTradingConformalPredictor } from './brain/conformal.js';
import stevieCore from './routes/stevieCore.js';
import metaBrainRouter from './routes/metaBrain.js';
import scenarioCoverageRouter from './routes/scenarioCoverage.js';
import conformalTuningRouter from './routes/conformalTuning.js';

// Import routes
import healthRoutes from './routes/health.js';
import { registerTradingRoutes } from './routes/trading.js';
import { portfolioRouter } from './routes/portfolio.js';
import errorRoutes from './routes/errors.js';
import chartDataRoutes from './routes/chart-data.js';
import { bookMaintainer } from './services/l2/BookMaintainer.js';

const app = express();

// Load environment variables
import dotenv from 'dotenv';
dotenv.config();

// Boot sanity checks
bootSanityChecks();

app.use((compression as any)());
app.use(requestId);

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

  // Add error handling middleware after all routes
  app.use(notFound);      // 404 -> AppError
  app.use(errorHandler);  // Any error -> JSON envelope

  // Start server
  const PORT = Number(process.env.PORT || 5000);

  const httpServer = app.listen(PORT, "0.0.0.0", async () => {
    logger.info(`[Server] HTTP server listening on port ${PORT}`);
    logger.info(`[Server] WebSocket server ready`);
    logger.info(`[Server] Environment: ${process.env.NODE_ENV || 'development'}`);

    // Initialize price streaming
    try {
      const { priceStream } = await import('./services/priceStream.js');
      // Temporarily disable price streaming due to connection issues
      // priceStream.start();
    } catch (error) {
      logger.error('[Server] Failed to initialize price streaming:', { error: String(error) });
    }

    // Initialize L2 book maintenance
    await bookMaintainer.initializeAll();
    logger.info('L2 book maintainer initialized');
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
import burninDashboardRouter from './routes/burninDashboard.js';

// Add burn-in dashboard routes
app.use('/api/burnin-dashboard', burninDashboardRouter);

// Test error route for debugging
app.get('/api/_throw', (_req, _res) => {
  const { AppError } = require('../shared/errors.js');
  throw new AppError('BAD_REQUEST', 'Intentional test error', { why: 'manual' }, true);
});