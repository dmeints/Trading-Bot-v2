
import { z } from 'zod';

export const OHLCVSchema = z.object({
  symbol: z.string().min(1),
  timestamp: z.number().int().positive(),
  open: z.number().positive(),
  high: z.number().positive(),
  low: z.number().positive(),
  close: z.number().positive(),
  volume: z.number().nonnegative(),
  interval: z.enum(['1m', '5m', '15m', '1h', '4h', '1d']).optional()
});

export const OHLCVArraySchema = z.array(OHLCVSchema);

export const OHLCVRequestSchema = z.object({
  symbol: z.string(),
  interval: z.enum(['1m', '5m', '15m', '1h', '4h', '1d']),
  startTime: z.number().optional(),
  endTime: z.number().optional(),
  limit: z.number().int().min(1).max(1000).default(100)
});

export type OHLCV = z.infer<typeof OHLCVSchema>;
export type OHLCVRequest = z.infer<typeof OHLCVRequestSchema>;
