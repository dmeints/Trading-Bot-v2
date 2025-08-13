
import { z } from 'zod';

export const ContextSchema = z.object({
  regime: z.string().optional(),
  vol: z.number().optional(),
  funding: z.number().optional(),
  trend: z.number().optional(),
  sentiment: z.number().optional(),
  sigmaHAR: z.number().optional(),
  sigmaGARCH: z.number().optional(),
  obi: z.number().optional(),
  ti: z.number().optional(),
  spread_bps: z.number().optional(),
  micro_vol: z.number().optional(),
  rr25: z.number().optional(),
  fly25: z.number().optional(),
  iv_term_slope: z.number().optional(),
  skew_z: z.number().optional(),
  funding_rate: z.number().optional(),
  sentiment_score: z.number().optional(),
  whale_activity: z.number().optional()
});

export const UpdateRequestSchema = z.object({
  policyId: z.string(),
  reward: z.number(),
  context: ContextSchema.optional()
});

export type RouterContext = z.infer<typeof ContextSchema>;
export type UpdateRequest = z.infer<typeof UpdateRequestSchema>;
