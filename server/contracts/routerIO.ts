
import { z } from 'zod';

export const ContextSchema = z.object({
  regime: z.string().optional(),
  vol: z.number().optional(),
  trend: z.number().optional(),
  funding: z.number().optional(),
  sentiment: z.number().optional(),
  eventsEmbedding: z.array(z.number()).optional()
});

export const ChoiceResultSchema = z.object({
  policyId: z.string(),
  score: z.number(),
  explorationBonus: z.number()
});

export const UpdateRequestSchema = z.object({
  policyId: z.string(),
  reward: z.number(),
  context: ContextSchema
});

export type Context = z.infer<typeof ContextSchema>;
export type ChoiceResult = z.infer<typeof ChoiceResultSchema>;
export type UpdateRequest = z.infer<typeof UpdateRequestSchema>;
