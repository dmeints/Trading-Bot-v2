
import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { getOHLCV } from '../services/exchanges/binance';

vi.mock('axios');
const mockedAxios = vi.mocked(axios);

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

    // Verify all fields are numeric
    result.forEach(candle => {
      expect(typeof candle.timestamp).toBe('number');
      expect(typeof candle.open).toBe('number');
      expect(typeof candle.high).toBe('number');
      expect(typeof candle.low).toBe('number');
      expect(typeof candle.close).toBe('number');
      expect(typeof candle.volume).toBe('number');
    });

    // Verify timestamps are ascending
    expect(result[1].timestamp).toBeGreaterThan(result[0].timestamp);
  });

  it('should handle API errors gracefully', async () => {
    mockedAxios.get.mockRejectedValue(new Error('Network error'));

    await expect(getOHLCV('BTCUSDT', '1h', 10)).rejects.toThrow(
      'Failed to fetch OHLCV data from Binance'
    );
  });
});
import { describe, it, expect, vi } from 'vitest';
import axios from 'axios';
import { getOHLCV } from '../services/exchanges/binance';

vi.mock('axios');
const mockedAxios = vi.mocked(axios);

describe('Binance OHLCV Mapper', () => {
  it('should map klines response to numeric OHLCV format', async () => {
    // Mock Binance klines response format
    const mockResponse = {
      data: [
        [
          1640995200000, // timestamp
          "50000.00",     // open
          "51000.00",     // high  
          "49500.00",     // low
          "50500.00",     // close
          "100.5",        // volume
          1640995259999,  // close time
          "5050000.00",   // quote volume
          1000,           // count
          "60.3",         // taker buy base
          "3030000.00",   // taker buy quote
          "0"             // ignore
        ],
        [
          1640995260000,
          "50500.00",
          "52000.00", 
          "50000.00",
          "51500.00",
          "200.8",
          1640995319999,
          "10300000.00",
          2000,
          "120.4",
          "6180000.00",
          "0"
        ]
      ]
    };

    mockedAxios.get.mockResolvedValueOnce(mockResponse);

    const result = await getOHLCV('BTCUSDT', '1m', 2);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      timestamp: 1640995200000,
      open: 50000.00,
      high: 51000.00,
      low: 49500.00,
      close: 50500.00,
      volume: 100.5
    });
    expect(result[1]).toEqual({
      timestamp: 1640995260000,
      open: 50500.00,
      high: 52000.00,
      low: 50000.00,
      close: 51500.00,
      volume: 200.8
    });

    // Verify timestamps are ascending
    expect(result[0].timestamp).toBeLessThan(result[1].timestamp);
    
    // Verify all values are numeric
    result.forEach(candle => {
      expect(typeof candle.timestamp).toBe('number');
      expect(typeof candle.open).toBe('number');
      expect(typeof candle.high).toBe('number');
      expect(typeof candle.low).toBe('number');
      expect(typeof candle.close).toBe('number');
      expect(typeof candle.volume).toBe('number');
    });
  });

  it('should handle empty response', async () => {
    mockedAxios.get.mockResolvedValueOnce({ data: [] });
    
    const result = await getOHLCV('BTCUSDT', '1m', 0);
    expect(result).toEqual([]);
  });
});
