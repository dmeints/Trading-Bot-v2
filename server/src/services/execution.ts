import type { OrderRequest, OrderAck, Position, Fill, Account } from '../types/trading';

// TODO: integrate with existing paper engine. This is a minimal placeholder layer.
export async function placeOrder(req: OrderRequest): Promise<OrderAck>{
  // TODO: pre-validate (stepSize, tickSize, minNotional), risk checks, queue-nudge, self-trade prevention
  return { orderId: 'sim-'+Date.now(), status: 'accepted' };
}
export async function cancelOrder(orderId: string): Promise<boolean>{
  // TODO: route to engine
  return true;
}
export async function getPositions(): Promise<Position[]>{
  return [];
}
export async function getFills(limit:number): Promise<Fill[]>{
  return [];
}
export async function getAccount(): Promise<Account>{
  return { equity: 100000, cash: 100000, maintenanceMargin: 0 };
}
