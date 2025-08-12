
import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';

const mockedAxios = vi.mocked(axios);

// Mock function to simulate getOHLCV behavior
async function getOHLCV(symbol: string, interval: string, limit: number) {
  const response = await axios.get('/api/v3/klines', {
    params: { symbol, interval, limit }
  });
  
  return response.data.map((kline: any[]) => ({
    timestamp: kline[0],
    open: parseFloat(kline[1]),
    high: parseFloat(kline[2]),
    low: parseFloat(kline[3]),
    close: parseFloat(kline[4]),
    volume: parseFloat(kline[5])
  }));
}

describe('Binance OHLCV Mapping', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should map Binance API response to Candle format', async () => {
    const mockBinanceResponse = [
      [
        1640995200000, // openTime
        "45000.00",     // open
        "46000.00",     // high  
        "44000.00",     // low
        "45500.00",     // close
        "1234.56",      // volume
        1640998799999,  // closeTime
        "55555555.55",  // quote asset volume
        1000,           // number of trades
        "666.66",       // taker buy base asset volume
        "30000000.00",  // taker buy quote asset volume
        "0"             // ignore
      ],
      [
        1640998800000,
        "45500.00",
        "47000.00", 
        "45000.00",
        "46200.00",
        "2345.67",
        1641002399999,
        "111111111.11",
        2000,
        "777.77",
        "35000000.00", 
        "0"
      ]
    ];

    mockedAxios.get.mockResolvedValue({ data: mockBinanceResponse });

    const result = await getOHLCV('BTCUSDT', '1h', 2);

    expect(result).toHaveLength(2);
    
    // Test first candle
    expect(result[0]).toEqual({
      timestamp: 1640995200000,
      open: 45000,
      high: 46000,
      low: 44000,
      close: 45500,
      volume: 1234.56
    });

    // Test second candle
    expect(result[1]).toEqual({
      timestamp: 1640998800000,
      open: 45500,
      high: 47000,
      low: 45000,
      close: 46200,
      volume: 2345.67
    });

    // Verify timestamps are ascending
    expect(result[1].timestamp).toBeGreaterThan(result[0].timestamp);
    
    // Verify all fields are numeric
    result.forEach(candle => {
      expect(typeof candle.open).toBe('number');
      expect(typeof candle.high).toBe('number');
      expect(typeof candle.low).toBe('number');
      expect(typeof candle.close).toBe('number');
      expect(typeof candle.volume).toBe('number');
    });
  });
});
