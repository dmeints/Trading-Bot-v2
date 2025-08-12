
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
