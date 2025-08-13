
import { z } from 'zod';

export const OrderSideSchema = z.enum(['buy', 'sell']);
export const OrderTypeSchema = z.enum(['market', 'limit', 'stop_market', 'stop_limit']);
export const OrderStatusSchema = z.enum(['pending', 'open', 'filled', 'cancelled', 'rejected']);
export const TimeInForceSchema = z.enum(['GTC', 'IOC', 'FOK', 'GTD']);

export const ExecutionRequestSchema = z.object({
  symbol: z.string().min(1),
  side: OrderSideSchema,
  type: OrderTypeSchema,
  quantity: z.number().positive(),
  price: z.number().positive().optional(),
  stopPrice: z.number().positive().optional(),
  timeInForce: TimeInForceSchema.default('GTC'),
  clientOrderId: z.string().optional()
});

export const ExecutionResponseSchema = z.object({
  orderId: z.string(),
  clientOrderId: z.string().optional(),
  symbol: z.string(),
  side: OrderSideSchema,
  type: OrderTypeSchema,
  quantity: z.number(),
  price: z.number().optional(),
  stopPrice: z.number().optional(),
  status: OrderStatusSchema,
  fills: z.array(z.object({
    price: z.number(),
    quantity: z.number(),
    timestamp: z.number(),
    commission: z.number(),
    commissionAsset: z.string()
  })),
  timestamp: z.number()
});

export const SimulateRequestSchema = z.object({
  symbol: z.string(),
  size: z.number().positive()
});

export const SimulateResponseSchema = z.object({
  symbol: z.string(),
  size: z.number(),
  estimatedPrice: z.number(),
  estimatedCost: z.number(),
  estimatedSlippage: z.number(),
  confidence: z.number(),
  timestamp: z.number()
});

export type ExecutionRequest = z.infer<typeof ExecutionRequestSchema>;
export type ExecutionResponse = z.infer<typeof ExecutionResponseSchema>;
export type SimulateRequest = z.infer<typeof SimulateRequestSchema>;
export type SimulateResponse = z.infer<typeof SimulateResponseSchema>;
