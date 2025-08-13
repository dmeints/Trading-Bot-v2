
import { z } from 'zod';

export const OptimizationRequestSchema = z.object({
  symbols: z.array(z.string()).min(1),
  cvarBudget: z.number().min(0).max(1),
  volTarget: z.number().positive()
});

export const OptimizationResultSchema = z.object({
  weights: z.record(z.string(), z.number()),
  achievedVol: z.number(),
  cvarBudgetUsed: z.number(),
  expectedReturn: z.number(),
  success: z.boolean()
});

export type OptimizationRequest = z.infer<typeof OptimizationRequestSchema>;
export type OptimizationResult = z.infer<typeof OptimizationResultSchema>;
