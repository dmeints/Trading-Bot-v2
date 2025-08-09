export type Side = 'buy' | 'sell';
export type OrderType = 'market' | 'limit' | 'limit_maker' | 'ioc' | 'fok';

export interface OrderRequest { 
  symbol: string; 
  side: Side; 
  type: OrderType; 
  quantity: number; 
  price?: number; 
  tif?: 'GTC' | 'IOC' | 'FOK'; 
  clientId?: string; 
  bracket?: { 
    takeProfitPct?: number; 
    stopLossPct?: number; 
    reduceOnly?: boolean; 
  }; 
}

export interface OrderAck { 
  orderId: string; 
  status: 'accepted' | 'rejected'; 
  reason?: string; 
}

export interface Position { 
  symbol: string; 
  quantity: number; 
  avgPrice: number; 
  unrealizedPnl: number; 
  realizedPnl: number; 
}

export interface Fill { 
  id: string; 
  symbol: string; 
  side: Side; 
  price: number; 
  quantity: number; 
  timestamp: string; 
}

export interface Account { 
  equity: number; 
  cash: number; 
  maintenanceMargin: number; 
}

export interface RiskSettings { 
  maxPositionSizePct?: number; 
  maxDailyLoss?: number; 
  defaultStopPct?: number; 
  defaultTakeProfitPct?: number; 
  killSwitch?: boolean; 
  symbolTiers?: Record<string, { maxSizePct: number }>; 
}