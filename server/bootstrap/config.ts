import { z } from "zod";

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development","test","production"]).default("development"),
  PORT: z.coerce.number().int().positive().max(65535).default(5000),
  SAFE_MODE: z.string().optional().transform(v => v === "true"),
  CHAOS_PROB: z.coerce.number().min(0).max(1).default(0),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(600),
  REQUIRED_ENV_VARS: z.string().optional().default(""),
  DATABASE_URL: z.string().optional(),
});
export type AppEnv = z.infer<typeof EnvSchema>;
export const env: AppEnv = EnvSchema.parse(process.env);
