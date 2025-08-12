
// server/services/exchanges/binance.ts
import axios from 'axios';

export type BinanceInterval = '1m'|'5m'|'15m'|'1h'|'4h'|'1d'|'1w';

export interface Candle {
  timestamp: number; 
  open: number; 
  high: number; 
  low: number; 
  close: number; 
  volume: number;
}

function mapTimeframe(tf: string): BinanceInterval {
  const m: Record<string, BinanceInterval> = { 
    '1m':'1m',
    '5m':'5m',
    '15m':'15m',
    '1H':'1h',
    '4H':'4h',
    '1D':'1d',
    '1W':'1w' 
  };
  return m[tf] ?? '1h';
}

export async function getOHLCV(symbol: string, timeframe: string, limit = 100): Promise<Candle[]> {
  const interval = mapTimeframe(timeframe);
  const url = 'https://api.binance.com/api/v3/klines';
  
  try {
    const { data } = await axios.get(url, { 
      params: { symbol, interval, limit }, 
      timeout: 10000 
    });
    
    // data: [ openTime, open, high, low, close, volume, closeTime, ... ]
    return (data as any[]).map(row => ({
      timestamp: row[0],
      open: parseFloat(row[1]),
      high: parseFloat(row[2]),
      low: parseFloat(row[3]),
      close: parseFloat(row[4]),
      volume: parseFloat(row[5]),
    }));
  } catch (error) {
    console.error('Binance API error:', error);
    throw new Error(`Failed to fetch OHLCV data from Binance: ${error}`);
  }
}
