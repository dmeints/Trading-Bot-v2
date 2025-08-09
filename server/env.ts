import { z } from "zod";

const Env = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.string().optional(),
  DATABASE_URL: z.string().url(),
  ADMIN_SECRET: z.string().min(16),
  COINGECKO_API_KEY: z.string().min(1),
  OPENAI_API_KEY: z.string().min(1),
  BENCH_ENABLED: z.string().optional(),
  PAPER_TRADING_UI: z.string().optional(),
  OCO_ENABLED: z.string().optional(),
}).passthrough();

export const env = (() => {
  const parsed = Env.safeParse(process.env);
  if (!parsed.success) {
    const redacted = parsed.error.flatten().fieldErrors;
    throw new Error("ENV VALIDATION FAILED: " + JSON.stringify(redacted));
  }
  return parsed.data;
})();