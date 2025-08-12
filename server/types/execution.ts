
export interface ExecutionRecord {
  id: string;
  timestamp: Date;
  symbol: string;
  policyId: string;
  requestedSize: number;
  finalSize: number;
  fillPrice: number;
  side: 'buy' | 'sell' | 'hold';
  context: any;
  uncertaintyWidth: number;
  confidence: number;
}

export interface ExecutionContext {
  symbol: string;
  side: 'buy' | 'sell';
  quantity: number;
  urgency?: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface SizingSnapshot {
  symbol: string;
  baseSize: number;
  uncertaintyWidth: number;
  finalSize: number;
  timestamp: Date;
  confidence: number;
}
