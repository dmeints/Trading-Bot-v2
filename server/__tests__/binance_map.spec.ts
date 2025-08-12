
import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { getOHLCV } from '../services/exchanges/binance.js';

vi.mock('axios');
const mockedAxios = vi.mocked(axios);

describe('Binance OHLCV', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should map Binance response to Candle format', async () => {
    const mockResponse = {
      data: [
        [1640995200000, "46000.00", "47000.00", "45500.00", "46500.00", "100.5", 1640998800000],
        [1640998800000, "46500.00", "46800.00", "46200.00", "46700.00", "85.2", 1641002400000]
      ]
    };

    mockedAxios.get.mockResolvedValueOnce(mockResponse);

    const candles = await getOHLCV('BTCUSDT', '1h', 2);

    expect(candles).toHaveLength(2);
    expect(candles[0]).toEqual({
      timestamp: 1640995200000,
      open: 46000,
      high: 47000,
      low: 45500,
      close: 46500,
      volume: 100.5
    });

    // Verify timestamps are ascending
    expect(candles[1].timestamp).toBeGreaterThan(candles[0].timestamp);

    // Verify all fields are numeric
    candles.forEach(candle => {
      expect(typeof candle.timestamp).toBe('number');
      expect(typeof candle.open).toBe('number');
      expect(typeof candle.high).toBe('number');
      expect(typeof candle.low).toBe('number');
      expect(typeof candle.close).toBe('number');
      expect(typeof candle.volume).toBe('number');
    });
  });

  it('should handle API errors gracefully', async () => {
    mockedAxios.get.mockRejectedValueOnce(new Error('Network error'));

    await expect(getOHLCV('BTCUSDT', '1h', 10)).rejects.toThrow('Network error');
  });
});
import { getOHLCV } from '../services/exchanges/binance';
import axios from 'axios';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('Binance OHLCV Mapping', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
