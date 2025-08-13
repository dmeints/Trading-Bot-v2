import type { Request, Response, NextFunction } from "express";
import client from "prom-client";

export const register = new client.Registry();
client.collectDefaultMetrics({ register });

export const httpHistogram = new client.Histogram({
  name: "http_request_duration_seconds",
  help: "HTTP request duration in seconds",
  labelNames: ["method", "route", "status"] as const,
  buckets: [0.01,0.025,0.05,0.1,0.25,0.5,1,2,5,10]
});
register.registerMetric(httpHistogram);

export const httpErrors = new client.Counter({
  name: "http_request_errors_total",
  help: "Total number of error responses",
  labelNames: ["route","status"] as const,
});
register.registerMetric(httpErrors);

export const requestCounter = new client.Counter({
  name: "http_requests_total",
  help: "Total HTTP requests",
  labelNames: ["route","status"] as const,
});
register.registerMetric(requestCounter);

let errorBudgetBreached = false;
export function isErrorBudgetBreached(){ return errorBudgetBreached; }
let rolling = { req: 0, err: 0 };
setInterval(() => {
  const errRate = rolling.req ? (rolling.err / rolling.req) : 0;
  errorBudgetBreached = errRate > 0.02;
  rolling = { req: 0, err: 0 };
}, 60_000);

export function metricsTiming(req: Request, res: Response, next: NextFunction) {
  const route = (req.route?.path || req.path || "unknown");
  const end = httpHistogram.startTimer({ method: req.method, route });
  res.on("finish", () => {
    end({ status: String(res.statusCode) });
    requestCounter.inc({ route, status: String(res.statusCode) });
    if (res.statusCode >= 500) httpErrors.inc({ route, status: String(res.statusCode) });
    rolling.req += 1;
    if (res.statusCode >= 500) rolling.err += 1;
  });
  next();
}
