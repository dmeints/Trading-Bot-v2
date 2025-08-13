
import { z } from 'zod';

export const ExecutionRequestSchema = z.object({
  symbol: z.string().min(1),
  baseSize: z.number().positive().optional()
});

export const ExecutionRecordSchema = z.object({
  id: z.string(),
  timestamp: z.date(),
  symbol: z.string(),
  policyId: z.string(),
  requestedSize: z.number(),
  finalSize: z.number(),
  fillPrice: z.number(),
  side: z.enum(['buy', 'sell', 'hold']),
  context: z.any(),
  uncertaintyWidth: z.number(),
  confidence: z.number()
});

export type ExecutionRequest = z.infer<typeof ExecutionRequestSchema>;
export type ExecutionRecord = z.infer<typeof ExecutionRecordSchema>;
