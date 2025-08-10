import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { env } from "./config/env";
import { requestIdMiddleware, type RequestWithId } from "./middleware/requestId";
import { logger } from "./utils/logger";
import { rateLimiters } from "./middleware/rateLimiter";
import { errorHandler, notFoundHandler } from "./utils/errorHandler";
import helmet from "helmet";

// Initialize telemetry
import { initializeTelemetry } from "./monitoring/telemetry";
import { metricsMiddleware } from "./monitoring/metrics";
initializeTelemetry();

// Validate environment variables on startup
logger.info('Starting Skippy Trading Platform', {
  nodeEnv: env.NODE_ENV,
  port: env.PORT,
  buildSha: env.BUILD_SHA,
  aiServicesEnabled: env.AI_SERVICES_ENABLED
});

const app = express();

// Trust proxy for correct IP handling behind Replit's proxy
app.set('trust proxy', 1);

// Security headers
app.use(helmet({ 
  contentSecurityPolicy: env.NODE_ENV === 'production' ? undefined : false 
}));

// Request ID middleware for tracking
app.use(requestIdMiddleware);

// General rate limiting for all API routes
app.use('/api', rateLimiters.default);

// Metrics middleware for monitoring
app.use(metricsMiddleware);

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req: any, res: any, next: any) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

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
      if (req.id) {
        logger.withRequest(req.id).info('API Request', {
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
  app.use(notFoundHandler);
  
  // Global error handler
  app.use(errorHandler);

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
