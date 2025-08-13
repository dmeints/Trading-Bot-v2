
import { z } from 'zod';

export const OHLCVSchema = z.object({
  timestamp: z.number().positive(),
  open: z.number().positive(),
  high: z.number().positive(),
  low: z.number().positive(),
  close: z.number().positive(),
  volume: z.number().nonnegative(),
  symbol: z.string().min(1)
});

export type OHLCV = z.infer<typeof OHLCVSchema>;
